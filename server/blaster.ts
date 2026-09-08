// Target Blaster — server logic for the primary-only tap-the-answer game.
//
// Self-contained, like penalty.ts, xp.ts and streaks.ts. It reads the child's
// own completed assignments to find questions, reads and writes blaster_best,
// and spends a play from the shared ledger. It never changes auto-marking, XP
// or streak logic — it calls them.
//
// The three rules it inherits from Penalty Shootout, because they matter just
// as much here:
//
//   1. The answer key NEVER goes to the browser. These are real homework
//      questions, so sending the right answer would hand children the answers.
//      The server marks every shot.
//   2. Children can only be asked questions from work meant for them — and now
//      only from work they have ALREADY HANDED IN. A game is built out of their
//      own finished homework, not out of tonight's.
//   3. The game that was issued is what gets marked. Its questions are stored
//      when the play is spent, and the finish is scored slot by slot against
//      them, so nothing the browser sends decides which question was asked.

import { storage } from "./storage";
import type { Student, Assignment } from "@shared/schema";
import type { Question } from "@shared/auto-marking";
import { markAnswer } from "@shared/auto-marking";
import {
  ROUNDS_PER_GAME, SECONDS_PER_ROUND, XP_PER_CORRECT_ANSWER,
  buildShotOptions, isPlayable, dealShots, canPlay, beatsRecord, makeRef, readRef,
  type BlastAnswer, type BlastGame, type BlastRound, type ShotOption,
} from "@shared/blaster";
import { awardXp, type XpAward } from "./xp";
import { recordActivity } from "./streaks";
import { activeGame, clearActiveGame, getPlayState, spendPlay } from "./game-plays";
import type { PlayState } from "@shared/game-plays";

// One question a child may be asked, tied to the assignment it came from.
interface PoolItem {
  subject: string;
  assignmentId: number;
  ref: string;
  question: Question;
}

/**
 * Every question this child may be asked: from work they have ALREADY HANDED
 * IN, across every subject.
 *
 * Mixing the subjects is the point of this game — a blast is a quick run over
 * everything they have done lately, where Penalty Shootout is a subject at a
 * time.
 */
async function questionPool(student: Student): Promise<PoolItem[]> {
  const submissions = await storage.getSubmissions({ studentId: student.id });
  const completed = new Set(submissions.map((s) => s.assignmentId));
  if (completed.size === 0) return [];

  const assignments: Assignment[] = await storage.getAssignments(student.form, student.id, false);
  const out: PoolItem[] = [];
  for (const a of assignments) {
    if (!completed.has(a.id)) continue;
    for (const q of (a.questions || []) as Question[]) {
      if (isPlayable(q)) {
        out.push({ subject: a.subject, assignmentId: a.id, ref: makeRef(a.id, q.id), question: q });
      }
    }
  }
  return out;
}

// Every numeric answer the child has met, used as believable wrong targets to
// sit beside the right one. Drawn from the whole pool rather than one subject,
// because this game mixes them anyway.
function numericPool(pool: PoolItem[]): number[] {
  const seen = new Set<number>();
  for (const { question } of pool) {
    if (question.type === "numeric" && question.correctNumber != null) seen.add(question.correctNumber);
  }
  return Array.from(seen);
}

/**
 * The questions that can actually be turned into targets.
 *
 * Kept apart by their full reference, never by the bare question id: nearly
 * every assignment has a "q1", so deduping on that would throw away almost
 * everything the child had done.
 */
function usableQuestions(pool: PoolItem[]): { item: PoolItem; targets: ShotOption[] }[] {
  const numbers = numericPool(pool);
  const seen = new Set<string>();
  const out: { item: PoolItem; targets: ShotOption[] }[] = [];
  for (const item of pool) {
    if (seen.has(item.ref)) continue;
    const targets = buildShotOptions(item.question, numbers);
    if (!targets) continue; // a numeric with no believable wrong answers to offer
    seen.add(item.ref);
    out.push({ item, targets });
  }
  return out;
}

function findByRef(pool: PoolItem[], ref: string): PoolItem | undefined {
  const parsed = readRef(ref);
  if (!parsed) return undefined;
  return pool.find((p) => p.assignmentId === parsed.assignmentId && p.question.id === parsed.questionId);
}

/** How many questions this child has to blast at — 0 means nothing done yet. */
export async function availableQuestions(student: Student): Promise<number> {
  return usableQuestions(await questionPool(student)).length;
}

/**
 * Build a game: six rounds drawn from everything they have completed.
 *
 * dealShots fills the six however few questions there are — a child with two
 * meets each of them three times rather than being told there is no game. That
 * is the whole point: it is practice, and practice repeats.
 */
export async function buildGame(student: Student): Promise<BlastGame | null> {
  const pool = await questionPool(student);
  const usable = usableQuestions(pool);
  if (!canPlay(usable.length)) return null;

  const picked = dealShots(usable, ROUNDS_PER_GAME);
  const rounds: BlastRound[] = picked.map((p, i) => ({
    ref: p.item.ref,
    index: i,
    subject: p.item.subject,
    questionText: p.item.question.questionText,
    targets: p.targets,
    seconds: SECONDS_PER_ROUND,
  }));
  return { rounds, secondsPerRound: SECONDS_PER_ROUND };
}

export interface StartedBlast {
  game: BlastGame;
  plays: PlayState;
}

/**
 * Start a blast: check they have a play, build it, then spend the play.
 *
 * Same order and same reasoning as Penalty Shootout — a child must never be
 * charged for a game that could not be built.
 */
export async function startGame(
  student: Student,
): Promise<StartedBlast | { outOfPlays: true; plays: PlayState } | null> {
  const plays = await getPlayState(student, "blaster");
  if (plays.left <= 0) return { outOfPlays: true, plays };

  const game = await buildGame(student);
  if (!game) return null;

  const spent = await spendPlay(student, "blaster", game.rounds.map((r) => r.ref), null);
  if (!spent) return { outOfPlays: true, plays };

  return { game, plays: spent };
}

/**
 * Mark ONE round, for the instant "hit!" or "missed" the game needs.
 * Marking is the existing auto-marker, untouched.
 */
export async function markRound(
  student: Student, ref: string, answerText: string,
): Promise<{ correct: boolean; correctAnswerDisplay: string; explanation?: string } | null> {
  const pool = await questionPool(student);
  const found = findByRef(pool, ref);
  if (!found) return null;

  const result = markAnswer(found.question, answerText);
  return {
    correct: result.correct,
    correctAnswerDisplay: result.correctAnswerDisplay,
    explanation: result.explanation,
  };
}

export interface BlastResult {
  score: number;
  outOf: number;
  playable?: boolean;
  bestScore: number;
  bestOutOf: number;
  previousBest: number;
  previousOutOf: number;
  newRecord: boolean;
  gamesPlayed: number;
  xp?: XpAward;
  plays?: PlayState;
}

/**
 * Finish a blast: re-mark everything on the server, save a new record, award XP
 * through the existing capped system, and count the game towards the streak.
 *
 * Scored slot by slot against the questions that were actually issued, for the
 * same reason Penalty Shootout is: a game may legitimately repeat a question,
 * so "have I seen this one before?" cannot be used to catch a replayed answer.
 * A game already finished has no stored questions left, so sending a winning
 * result up twice scores nothing the second time.
 */
export async function finishGame(
  student: Student, answers: BlastAnswer[],
): Promise<BlastResult> {
  const pool = await questionPool(student);
  const outOf = ROUNDS_PER_GAME;

  const empty = (): BlastResult => ({
    score: 0, outOf, bestScore: 0, bestOutOf: 0,
    previousBest: 0, previousOutOf: 0, newRecord: false, gamesPlayed: 0, playable: false,
  });

  if (!canPlay(usableQuestions(pool).length)) return empty();

  const active = await activeGame(student, "blaster");
  if (active.refs.length === 0) return empty();

  let score = 0;
  active.refs.slice(0, outOf).forEach((ref, slot) => {
    const answer = answers[slot];
    if (!answer) return;            // no answer sent for this round — a miss
    if (answer.timedOut) return;    // the targets got away — also a miss

    const found = findByRef(pool, ref);
    if (!found) return;
    if (markAnswer(found.question, answer.answerText ?? "").correct) score++;
  });

  await clearActiveGame(student, "blaster");

  // The record: one per child, not one per subject, because a blast mixes them.
  const existing = await storage.getBlasterBest(student.id);
  const previousBest = existing?.bestScore ?? 0;
  const previousOutOf = existing?.bestOutOf ?? 0;
  const newRecord = beatsRecord(score, outOf, previousBest, previousOutOf);
  let gamesPlayed: number;

  if (!existing) {
    const created = await storage.createBlasterBest({
      studentId: student.id, bestScore: score, bestOutOf: outOf, gamesPlayed: 1,
    });
    gamesPlayed = created.gamesPlayed;
  } else {
    const updated = await storage.updateBlasterBest(student.id, {
      bestScore: newRecord ? score : previousBest,
      bestOutOf: newRecord ? outOf : previousOutOf,
      gamesPlayed: existing.gamesPlayed + 1,
    });
    gamesPlayed = updated.gamesPlayed;
  }

  // XP through the existing daily-capped system, at the same rate as Penalty
  // Shootout. Best-effort: a failure here must never lose a child their game.
  let xp: XpAward | undefined;
  if (score > 0) {
    try {
      xp = await awardXp(student.id, score * XP_PER_CORRECT_ANSWER, {
        correct: score,
        perCorrect: XP_PER_CORRECT_ANSWER,
      });
    } catch (error) {
      console.error("Blaster XP award failed (game still counted):", error);
    }
  }

  // Playing counts as activity for today's streak, like completing homework.
  try {
    await recordActivity(student.id);
  } catch (error) {
    console.error("Blaster streak update failed (game still counted):", error);
  }

  const plays = await getPlayState(student, "blaster");

  return {
    score,
    outOf,
    bestScore: newRecord ? score : previousBest,
    bestOutOf: newRecord ? outOf : previousOutOf,
    previousBest,
    previousOutOf,
    newRecord,
    gamesPlayed,
    xp,
    plays,
  };
}
