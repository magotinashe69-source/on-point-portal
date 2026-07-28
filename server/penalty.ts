// Penalty Shootout — server logic for the primary-only football quiz game.
//
// Self-contained, like xp.ts and streaks.ts. It reads the student's own
// assignments to find questions, and reads/writes the penalty_best table. It
// never changes auto-marking, XP or streak logic — it calls them.
//
// Two rules matter most here:
//   1. The answer key NEVER goes to the browser. These questions come from real
//      homework, so sending correctAnswer would hand children the answers to
//      work they still have to do. The server marks every shot.
//   2. Children can only ever be asked questions from assignments meant for
//      them — their own form, and their own targeted assignments.

import { storage } from "./storage";
import type { Student, Assignment } from "@shared/schema";
import type { Question } from "@shared/auto-marking";
import { markAnswer } from "@shared/auto-marking";
import {
  SHOTS_PER_ROUND, TOTAL_SHOTS, XP_PER_CORRECT_ANSWER,
  buildShotOptions, isPlayable, shuffle,
  type Shot, type Round,
} from "@shared/penalty";
import { awardXp, type XpAward } from "./xp";
import { recordActivity } from "./streaks";

// Every question this student is allowed to be asked, with the subject it came
// from. Built fresh from their assignments each time, so it can never drift and
// a child can never be served another class's questions.
async function questionPool(student: Student): Promise<{ subject: string; question: Question }[]> {
  const assignments: Assignment[] = await storage.getAssignments(student.form, student.id, false);
  const out: { subject: string; question: Question }[] = [];
  for (const a of assignments) {
    for (const q of (a.questions || []) as Question[]) {
      if (isPlayable(q)) out.push({ subject: a.subject, question: q });
    }
  }
  return out;
}

// Every numeric answer in a subject, used as believable wrong answers to sit
// beside the right one.
function numericPoolFor(pool: { subject: string; question: Question }[], subject: string): number[] {
  const seen = new Set<number>();
  for (const { subject: s, question } of pool) {
    if (s !== subject) continue;
    if (question.type === "numeric" && question.correctNumber != null) seen.add(question.correctNumber);
  }
  return Array.from(seen);
}

// Can a subject actually fill a game? A question is only usable if it can be
// turned into buttons (a numeric with no wrong answers to offer cannot).
function playableCount(pool: { subject: string; question: Question }[], subject: string): number {
  const numbers = numericPoolFor(pool, subject);
  let n = 0;
  for (const { subject: s, question } of pool) {
    if (s !== subject) continue;
    if (buildShotOptions(question, numbers)) n++;
  }
  return n;
}

export interface SubjectChoice {
  subject: string;
  questionCount: number;
  bestScore: number;
  gamesPlayed: number;
  playable: boolean; // false when there aren't enough questions for a full game
}

// The subjects this child is enrolled in that have questions to play, each with
// their personal best so the dashboard can show what to beat.
export async function listSubjects(student: Student): Promise<SubjectChoice[]> {
  const pool = await questionPool(student);
  const bests = await storage.getPenaltyBests(student.id);
  const subjects = Array.from(new Set(pool.map((p) => p.subject))).sort();

  return subjects.map((subject) => {
    const count = playableCount(pool, subject);
    const best = bests.find((b) => b.subject === subject);
    return {
      subject,
      questionCount: count,
      bestScore: best?.bestScore ?? 0,
      gamesPlayed: best?.gamesPlayed ?? 0,
      // A game needs 10 questions. Below that we still let them play by asking
      // some questions twice, as long as there is at least one.
      playable: count > 0,
    };
  }).filter((s) => s.questionCount > 0);
}

export interface Game {
  subject: string;
  shots: Shot[]; // 10 shots: 5 striker then 5 keeper, no answer keys
}

// Build a game: 10 questions from the chosen subject, shuffled, turned into
// buttons. If the subject has fewer than 10 usable questions we cycle through
// them again rather than refusing to play.
export async function buildGame(student: Student, subject: string): Promise<Game | null> {
  const pool = await questionPool(student);
  const numbers = numericPoolFor(pool, subject);

  const usable = pool
    .filter((p) => p.subject === subject)
    .map((p) => ({ question: p.question, options: buildShotOptions(p.question, numbers) }))
    .filter((p): p is { question: Question; options: NonNullable<ReturnType<typeof buildShotOptions>> } => !!p.options);

  if (usable.length === 0) return null;

  const shuffled = shuffle(usable);
  const shots: Shot[] = [];
  for (let i = 0; i < TOTAL_SHOTS; i++) {
    const picked = shuffled[i % shuffled.length];
    const round: Round = i < SHOTS_PER_ROUND ? "striker" : "keeper";
    shots.push({
      questionId: picked.question.id,
      round,
      index: i % SHOTS_PER_ROUND,
      questionText: picked.question.questionText,
      // Re-shuffle per shot so a repeated question doesn't look identical.
      options: shuffle(picked.options),
    });
  }
  return { subject, shots };
}

// Mark ONE shot, for the instant feedback the game needs (ball in the net, or
// the keeper saving it). Marking is the existing auto-marker, untouched.
// Returns null if the question isn't one this child is allowed to be asked.
export async function markShot(
  student: Student, subject: string, questionId: string, answerText: string,
): Promise<{ correct: boolean; correctAnswerDisplay: string; explanation?: string } | null> {
  const pool = await questionPool(student);
  const found = pool.find((p) => p.subject === subject && p.question.id === questionId);
  if (!found) return null;

  const result = markAnswer(found.question, answerText);
  return {
    correct: result.correct,
    correctAnswerDisplay: result.correctAnswerDisplay,
    explanation: result.explanation,
  };
}

export interface GameResult {
  score: number;
  outOf: number;
  strikerScore: number;
  keeperScore: number;
  bestScore: number;
  previousBest: number;
  newRecord: boolean;
  gamesPlayed: number;
  xp?: XpAward;
}

export interface SubmittedAnswer {
  questionId: string;
  answerText: string;
  round: Round;
}

// Finish a game: re-mark every answer on the server (the browser is never
// trusted with the score), save a new personal best, award XP through the
// existing capped system, and count the game towards the daily streak.
export async function finishGame(
  student: Student, subject: string, answers: SubmittedAnswer[],
): Promise<GameResult> {
  const pool = await questionPool(student);

  // Only ever mark questions this child is allowed to be asked, and never more
  // than a full game's worth.
  const capped = answers.slice(0, TOTAL_SHOTS);
  let strikerScore = 0;
  let keeperScore = 0;

  for (const a of capped) {
    const found = pool.find((p) => p.subject === subject && p.question.id === a.questionId);
    if (!found) continue;
    if (!markAnswer(found.question, a.answerText).correct) continue;
    if (a.round === "keeper") keeperScore++;
    else strikerScore++;
  }
  const score = strikerScore + keeperScore;

  // Personal best for THIS subject.
  const existing = await storage.getPenaltyBest(student.id, subject);
  const previousBest = existing?.bestScore ?? 0;
  const newRecord = score > previousBest;
  let gamesPlayed: number;

  if (!existing) {
    const created = await storage.createPenaltyBest({
      studentId: student.id, subject, bestScore: score, gamesPlayed: 1,
    });
    gamesPlayed = created.gamesPlayed;
  } else {
    const updated = await storage.updatePenaltyBest(student.id, subject, {
      bestScore: Math.max(previousBest, score),
      gamesPlayed: existing.gamesPlayed + 1,
    });
    gamesPlayed = updated.gamesPlayed;
  }

  // XP: 2 per correct answer, through the existing daily-capped system.
  // Best-effort, exactly like the submission flow — a failure here must never
  // lose the child their game result.
  let xp: XpAward | undefined;
  if (score > 0) {
    try {
      xp = await awardXp(student.id, score * XP_PER_CORRECT_ANSWER, {
        correct: score,
        perCorrect: XP_PER_CORRECT_ANSWER,
      });
    } catch (error) {
      console.error("Penalty XP award failed (game still counted):", error);
    }
  }

  // Playing counts as activity for today's streak, like completing homework.
  try {
    await recordActivity(student.id);
  } catch (error) {
    console.error("Penalty streak update failed (game still counted):", error);
  }

  return {
    score,
    outOf: TOTAL_SHOTS,
    strikerScore,
    keeperScore,
    bestScore: Math.max(previousBest, score),
    previousBest,
    newRecord,
    gamesPlayed,
    xp,
  };
}
