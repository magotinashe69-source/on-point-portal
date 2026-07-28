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
import type { ShotOption } from "@shared/penalty";
import {
  MIN_QUESTIONS, XP_PER_CORRECT_ANSWER,
  buildShotOptions, isPlayable, shuffle, gameLength, beatsRecord,
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

// The questions in a subject that can actually be played, each already turned
// into buttons. A question is only usable if it can be made into buttons (a
// numeric with no believable wrong answers to offer cannot), and each distinct
// question id appears once — a game never asks the same question twice, so the
// same id in two assignments must not fill two shots.
function usableQuestions(pool: { subject: string; question: Question }[], subject: string) {
  const numbers = numericPoolFor(pool, subject);
  const seen = new Set<string>();
  const out: { question: Question; options: ShotOption[] }[] = [];
  for (const { subject: s, question } of pool) {
    if (s !== subject) continue;
    if (seen.has(question.id)) continue;
    const options = buildShotOptions(question, numbers);
    if (!options) continue;
    seen.add(question.id);
    out.push({ question, options });
  }
  return out;
}

export interface SubjectChoice {
  subject: string;
  questionCount: number;  // distinct questions available to play
  shots: number;          // how long a game in this subject will be
  perRound: number;       // penalties taken, and saves made
  bestScore: number;
  bestOutOf: number;
  gamesPlayed: number;
}

// The subjects this child is enrolled in that have enough questions to play,
// each with their personal best so the child can see what to beat. A subject
// with fewer than two playable questions can't make a game (you need at least
// one penalty and one save) and is left out.
export async function listSubjects(student: Student): Promise<SubjectChoice[]> {
  const pool = await questionPool(student);
  const bests = await storage.getPenaltyBests(student.id);
  const subjects = Array.from(new Set(pool.map((p) => p.subject))).sort();

  return subjects.map((subject) => {
    const count = usableQuestions(pool, subject).length;
    const { perRound, total } = gameLength(count);
    const best = bests.find((b) => b.subject === subject);
    return {
      subject,
      questionCount: count,
      shots: total,
      perRound,
      bestScore: best?.bestScore ?? 0,
      bestOutOf: best?.bestOutOf ?? 0,
      gamesPlayed: best?.gamesPlayed ?? 0,
    };
  }).filter((s) => s.questionCount >= MIN_QUESTIONS);
}

export interface Game {
  subject: string;
  perRound: number; // penalties taken, then saves made
  shots: Shot[];    // every shot a DIFFERENT question, and no answer keys
}

// Build a game from the chosen subject. Every shot is a different question —
// nothing is ever asked twice — so a subject with fewer than 10 playable
// questions simply gets a shorter game rather than repeats.
export async function buildGame(student: Student, subject: string): Promise<Game | null> {
  const pool = await questionPool(student);
  const usable = usableQuestions(pool, subject);
  const { perRound, total } = gameLength(usable.length);
  if (total < MIN_QUESTIONS) return null;

  const picked = shuffle(usable).slice(0, total);
  const shots: Shot[] = picked.map((p, i) => ({
    questionId: p.question.id,
    round: (i < perRound ? "striker" : "keeper") as Round,
    index: i % perRound,
    questionText: p.question.questionText,
    options: p.options,
  }));
  return { subject, perRound, shots };
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
  outOf: number;      // decided by the server from the subject's question count
  perRound: number;
  strikerScore: number;
  keeperScore: number;
  bestScore: number;
  bestOutOf: number;
  previousBest: number;
  previousOutOf: number;
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

  // How long a game in this subject is, decided HERE — never taken from the
  // browser, so a made-up list of answers can't invent a longer game.
  const usable = usableQuestions(pool, subject);
  const { perRound, total: outOf } = gameLength(usable.length);

  let strikerScore = 0;
  let keeperScore = 0;
  // Every shot is a different question, so the same question id can only ever
  // score once. This is what stops ten copies of one known-correct answer
  // being sent up as a perfect game.
  const counted = new Set<string>();

  for (const a of answers) {
    if (counted.size >= outOf) break;
    if (counted.has(a.questionId)) continue;
    const found = pool.find((p) => p.subject === subject && p.question.id === a.questionId);
    if (!found) continue;
    counted.add(a.questionId);

    if (!markAnswer(found.question, a.answerText).correct) continue;
    // A round can only hold so many shots, so a flood of "keeper" answers
    // cannot spill past the real length of that round.
    if (a.round === "keeper") { if (keeperScore < perRound) keeperScore++; }
    else if (strikerScore < perRound) strikerScore++;
  }
  const score = strikerScore + keeperScore;

  // Personal best for THIS subject, compared as a fraction so a subject whose
  // game got longer (the teacher added questions) still compares fairly.
  const existing = await storage.getPenaltyBest(student.id, subject);
  const previousBest = existing?.bestScore ?? 0;
  const previousOutOf = existing?.bestOutOf ?? 0;
  const newRecord = beatsRecord(score, outOf, previousBest, previousOutOf);
  let gamesPlayed: number;

  if (!existing) {
    const created = await storage.createPenaltyBest({
      studentId: student.id, subject, bestScore: score, bestOutOf: outOf, gamesPlayed: 1,
    });
    gamesPlayed = created.gamesPlayed;
  } else {
    const updated = await storage.updatePenaltyBest(student.id, subject, {
      bestScore: newRecord ? score : previousBest,
      bestOutOf: newRecord ? outOf : previousOutOf,
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
    outOf,
    perRound,
    strikerScore,
    keeperScore,
    bestScore: newRecord ? score : previousBest,
    bestOutOf: newRecord ? outOf : previousOutOf,
    previousBest,
    previousOutOf,
    newRecord,
    gamesPlayed,
    xp,
  };
}
