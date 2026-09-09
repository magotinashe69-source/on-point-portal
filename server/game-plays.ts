// Plays earned by doing homework — the part that reads the database.
//
// The rules themselves are in shared/game-plays.ts. This file only counts and
// records.
//
// The one idea worth understanding here: PLAYS EARNED ARE NEVER STORED. They
// are counted, every time, from the assignments the child handed in today. Only
// what they have USED is written down.
//
// That is what makes the daily reset free rather than something to remember:
//
//   * "Today" is the CAT date from streakToday(), the same function the streak
//     uses, so a game and a streak can never disagree about what day it is.
//   * The day is part of the row's key. Tomorrow finds no row, so used starts
//     at 0 and earned is recounted from tomorrow's homework.
//   * Unused plays cannot carry over because there is nothing to carry — an old
//     row is simply left behind. Nothing has to be cleared overnight, and no
//     cron job can fail to run.
//
// The row also holds the GAME IN FLIGHT: the questions issued and how far the
// child has got through them. That is what stops a play being lost when a child
// walks away — they come back to the same game rather than to nothing. The
// reasoning behind keeping the game instead of refunding the play is written
// out in shared/game-plays.ts.

import { storage } from "./storage";
import { streakToday } from "./streaks";
import { catDay } from "./weekly-report";
import {
  buildPlayState,
  emptyProgress,
  firstUnplayedSlot,
  readProgress,
  type PlayGame,
  type PlayState,
  type SlotProgress,
  type SlotResult,
} from "@shared/game-plays";
import type { Student } from "@shared/schema";

/**
 * How many assignments this child handed in today (CAT).
 *
 * Handed in, not marked: a child earns their play the moment they finish the
 * work, not whenever their teacher gets round to marking it. Waiting for
 * marking would make the reward feel random and days late.
 *
 * Counted per ASSIGNMENT, so re-handing in the same piece cannot mint plays.
 */
export async function assignmentsCompletedToday(student: Student): Promise<number> {
  const today = streakToday();
  const submissions = await storage.getSubmissions({ studentId: student.id });
  const assignmentIds = new Set<number>();
  for (const s of submissions) {
    if (catDay(s.submittedAt) === today) assignmentIds.add(s.assignmentId);
  }
  return assignmentIds.size;
}

/** What this child has left for one game right now. */
export async function getPlayState(student: Student, game: PlayGame): Promise<PlayState> {
  const completedToday = await assignmentsCompletedToday(student);
  const row = await storage.getGamePlays(student.id, streakToday(), game);
  return buildPlayState(game, completedToday, row?.used ?? 0);
}

/** Both games at once, for the dashboard. */
export async function getAllPlayStates(student: Student): Promise<Record<PlayGame, PlayState>> {
  const [blaster, penalty] = await Promise.all([
    getPlayState(student, "blaster"),
    getPlayState(student, "penalty"),
  ]);
  return { blaster, penalty };
}

/**
 * Spend one play and remember the game it bought.
 *
 * Returns null when there is nothing left to spend, which is the caller's cue
 * to refuse the game rather than start one.
 *
 * A play is spent when a game STARTS, like a coin in an arcade machine. What it
 * buys, though, is the whole game — not "the game as long as you stay on the
 * page". Walking away does not use the play up: the game is kept, and the child
 * is put back into it where they left off (see activeGame and resumeSlot).
 *
 * The questions are stored with the spend, in the order they were asked, and
 * beside them an empty slot for each. Those slots are filled in as the child
 * plays. Together they are the whole of a game in flight:
 *
 *   * they let the finish be marked against the questions actually put to the
 *     child, rather than against whatever the browser sends back;
 *   * they let a half-finished game be handed back exactly as it was;
 *   * and because a played slot is never re-offered, a child cannot be shown an
 *     answer, walk away, and come back to be asked the same question again.
 */
export async function spendPlay(
  student: Student, game: PlayGame, refs: string[], subject: string | null,
): Promise<PlayState | null> {
  const day = streakToday();
  const state = await getPlayState(student, game);
  if (state.left <= 0) return null;

  const row = await storage.getGamePlays(student.id, day, game);
  await storage.upsertGamePlays({
    studentId: student.id,
    day,
    game,
    used: (row?.used ?? 0) + 1,
    activeRefs: refs,
    activeAnswers: emptyProgress(refs.length),
    activeSubject: subject,
  });

  return buildPlayState(game, state.completedToday, state.used + 1);
}

/** A game in flight: its questions in order, and how far the child has got. */
export interface ActiveGame {
  refs: string[];
  /** One entry per ref: null until that round is played, then how it went. */
  progress: SlotProgress;
  subject: string | null;
  /** The round to put the child back on — equals refs.length when finished. */
  resumeSlot: number;
  /** True when there is a half-finished game to go back to. */
  resumable: boolean;
}

/**
 * The game currently in flight, if there is one.
 *
 * `refs` empty means there is nothing in flight: either the child has not
 * started a game today, or they finished the last one and it was cleared.
 */
export async function activeGame(student: Student, game: PlayGame): Promise<ActiveGame> {
  const row = await storage.getGamePlays(student.id, streakToday(), game);
  const refs = Array.isArray(row?.activeRefs) ? row!.activeRefs : [];
  const progress = readProgress(row?.activeAnswers, refs.length);
  const resumeSlot = firstUnplayedSlot(progress);
  return {
    refs,
    progress,
    subject: row?.activeSubject ?? null,
    resumeSlot,
    resumable: refs.length > 0 && resumeSlot < refs.length,
  };
}

/**
 * Write down what happened in one round, as it happens.
 *
 * Recorded server-side the moment the round is played, which is what makes
 * walking away safe: the marks are already saved, so they survive the tab
 * closing, and the finish is scored from these rather than from anything the
 * browser sends up at the end.
 *
 * Refuses to overwrite a slot that has already been played. That is the rule
 * that stops "answer, see the right answer, quit, come back" being a way to
 * farm a perfect score — a round is played once and stays played.
 */
export async function recordSlot(
  student: Student, game: PlayGame, slot: number, result: SlotResult,
): Promise<boolean> {
  const day = streakToday();
  const row = await storage.getGamePlays(student.id, day, game);
  if (!row) return false;

  const refs = Array.isArray(row.activeRefs) ? row.activeRefs : [];
  if (slot < 0 || slot >= refs.length) return false;

  const progress = readProgress(row.activeAnswers, refs.length);
  if (progress[slot]) return false; // already played — never marked twice

  progress[slot] = result;
  await storage.upsertGamePlays({
    studentId: student.id,
    day,
    game,
    used: row.used,
    activeRefs: refs,
    activeAnswers: progress,
    activeSubject: row.activeSubject ?? null,
  });
  return true;
}

/**
 * Forget the game in flight, once it has been finished and scored.
 *
 * Deliberately does NOT give the play back: it has been played, all the way
 * through. This only stops the same finished game being sent up a second time
 * to score twice.
 *
 * Note what this is NOT for: a game the child walked out of is left exactly
 * where it is, so they can come back to it. Only a finished one is cleared.
 */
export async function clearActiveGame(student: Student, game: PlayGame): Promise<void> {
  const day = streakToday();
  const row = await storage.getGamePlays(student.id, day, game);
  if (!row) return;
  await storage.upsertGamePlays({
    studentId: student.id,
    day,
    game,
    used: row.used,
    activeRefs: [],
    activeAnswers: [],
    activeSubject: null,
  });
}
