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
  MIN_QUESTIONS, SHOTS_PER_ROUND, TOTAL_SHOTS, XP_PER_CORRECT_ANSWER,
  buildShotOptions, isPlayable, shuffle, canPlay, beatsRecord, makeRef, readRef,
  type Shot, type Round,
} from "@shared/penalty";
import { awardXp, type XpAward } from "./xp";
import { recordActivity } from "./streaks";

// One question a student may be asked, tied to the assignment it came from.
interface PoolItem {
  subject: string;
  assignmentId: number;
  ref: string;      // "assignmentId:questionId" — unique across the whole school
  question: Question;
}

// Every question this student is allowed to be asked. Built fresh from their
// assignments each time, so it can never drift and a child can never be served
// another class's questions.
async function questionPool(student: Student): Promise<PoolItem[]> {
  const assignments: Assignment[] = await storage.getAssignments(student.form, student.id, false);
  const out: PoolItem[] = [];
  for (const a of assignments) {
    for (const q of (a.questions || []) as Question[]) {
      if (isPlayable(q)) {
        out.push({ subject: a.subject, assignmentId: a.id, ref: makeRef(a.id, q.id), question: q });
      }
    }
  }
  return out;
}

// Find exactly one question in the pool by its reference. Looking it up by the
// bare question id would be ambiguous — "q1" exists in nearly every assignment.
function findByRef(pool: PoolItem[], subject: string, ref: string): PoolItem | undefined {
  const parsed = readRef(ref);
  if (!parsed) return undefined;
  return pool.find(
    (p) => p.subject === subject && p.assignmentId === parsed.assignmentId && p.question.id === parsed.questionId,
  );
}

// Every numeric answer in a subject, used as believable wrong answers to sit
// beside the right one.
function numericPoolFor(pool: PoolItem[], subject: string): number[] {
  const seen = new Set<number>();
  for (const { subject: s, question } of pool) {
    if (s !== subject) continue;
    if (question.type === "numeric" && question.correctNumber != null) seen.add(question.correctNumber);
  }
  return Array.from(seen);
}

// The questions in a subject that can actually be played, each already turned
// into buttons. A question is only usable if it can be made into buttons (a
// numeric with no believable wrong answers to offer cannot). Questions are kept
// apart by their full reference, NOT by the bare question id: nearly every
// assignment has a "q1", so deduping on that would throw away almost the whole
// subject and leave children with nothing to play.
function usableQuestions(pool: PoolItem[], subject: string) {
  const numbers = numericPoolFor(pool, subject);
  const seen = new Set<string>();
  const out: { item: PoolItem; options: ShotOption[] }[] = [];
  for (const item of pool) {
    if (item.subject !== subject) continue;
    if (seen.has(item.ref)) continue;
    const options = buildShotOptions(item.question, numbers);
    if (!options) continue;
    seen.add(item.ref);
    out.push({ item, options });
  }
  return out;
}

export interface SubjectChoice {
  subject: string;
  questionCount: number;  // distinct questions available to play
  bestScore: number;
  bestOutOf: number;
  gamesPlayed: number;
}

// The subjects this child can play, each with their personal best so they can
// see what to beat. A game is always 10 different questions, so a subject with
// fewer than that is hidden until the teacher sets a few more.
export async function listSubjects(student: Student): Promise<SubjectChoice[]> {
  const pool = await questionPool(student);
  const bests = await storage.getPenaltyBests(student.id);
  const subjects = Array.from(new Set(pool.map((p) => p.subject))).sort();

  return subjects.map((subject) => {
    const count = usableQuestions(pool, subject).length;
    const best = bests.find((b) => b.subject === subject);
    return {
      subject,
      questionCount: count,
      bestScore: best?.bestScore ?? 0,
      bestOutOf: best?.bestOutOf ?? 0,
      gamesPlayed: best?.gamesPlayed ?? 0,
    };
  }).filter((s) => canPlay(s.questionCount));
}

export interface Game {
  subject: string;
  perRound: number; // always 5: penalties taken, then saves made
  shots: Shot[];    // 10 shots, every one a DIFFERENT question, no answer keys
}

// Build a game from the chosen subject: 10 different questions, 5 to shoot and
// 5 to save. Returns null when the subject doesn't have 10 playable questions,
// which is also why it wouldn't have been offered in the first place.
export async function buildGame(student: Student, subject: string): Promise<Game | null> {
  const pool = await questionPool(student);
  const usable = usableQuestions(pool, subject);
  if (!canPlay(usable.length)) return null;

  const picked = shuffle(usable).slice(0, TOTAL_SHOTS);
  const shots: Shot[] = picked.map((p, i) => ({
    ref: p.item.ref,
    round: (i < SHOTS_PER_ROUND ? "striker" : "keeper") as Round,
    index: i % SHOTS_PER_ROUND,
    questionText: p.item.question.questionText,
    options: p.options,
  }));
  return { subject, perRound: SHOTS_PER_ROUND, shots };
}

// Mark ONE shot, for the instant feedback the game needs (ball in the net, or
// the keeper saving it). Marking is the existing auto-marker, untouched.
// Returns null if the question isn't one this child is allowed to be asked.
export async function markShot(
  student: Student, subject: string, ref: string, answerText: string,
): Promise<{ correct: boolean; correctAnswerDisplay: string; explanation?: string } | null> {
  const pool = await questionPool(student);
  const found = findByRef(pool, subject, ref);
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
  outOf: number;      // always 10 — the server's fixed game length
  perRound: number;   // always 5
  playable?: boolean; // false when the subject no longer has enough questions
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
  ref: string;
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

  // A game is always 10 shots, 5 per round — decided HERE, never taken from
  // the browser. A subject that can't fill a game scores nothing at all, so a
  // made-up request can't manufacture a record in a subject too thin to play.
  const usable = usableQuestions(pool, subject);
  const perRound = SHOTS_PER_ROUND;
  const outOf = TOTAL_SHOTS;
  if (!canPlay(usable.length)) {
    return {
      score: 0, outOf, perRound, strikerScore: 0, keeperScore: 0,
      bestScore: 0, bestOutOf: 0, previousBest: 0, previousOutOf: 0,
      newRecord: false, gamesPlayed: 0, playable: false,
    };
  }

  let strikerScore = 0;
  let keeperScore = 0;
  // Every shot is a different question, so the same question id can only ever
  // score once. This is what stops ten copies of one known-correct answer
  // being sent up as a perfect game.
  const counted = new Set<string>();

  for (const a of answers) {
    if (counted.size >= outOf) break;
    if (counted.has(a.ref)) continue;
    const found = findByRef(pool, subject, a.ref);
    if (!found) continue;
    counted.add(a.ref);

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
