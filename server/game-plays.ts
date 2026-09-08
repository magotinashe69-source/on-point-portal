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

import { storage } from "./storage";
import { streakToday } from "./streaks";
import { catDay } from "./weekly-report";
import {
  buildPlayState,
  type PlayGame,
  type PlayState,
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
 * A play is spent when a game STARTS, like a coin in an arcade machine. Walking
 * away halfway does not get it back — otherwise a child could restart until the
 * questions suited them, and the record they are chasing would mean nothing.
 *
 * The questions are stored with the spend, in the order they were asked. That
 * is what lets the finish be marked slot by slot against the questions actually
 * put to the child, rather than against whatever the browser sends back. It
 * matters more now than it used to: a game may legitimately repeat a question
 * when a child has not done much homework yet, so "have I seen this question
 * before?" is no longer a safe way to catch a replayed answer.
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
    activeSubject: subject,
  });

  return buildPlayState(game, state.completedToday, state.used + 1);
}

/** The questions of the game currently in flight, in the order they were asked. */
export async function activeGame(
  student: Student, game: PlayGame,
): Promise<{ refs: string[]; subject: string | null }> {
  const row = await storage.getGamePlays(student.id, streakToday(), game);
  return {
    refs: Array.isArray(row?.activeRefs) ? row!.activeRefs : [],
    subject: row?.activeSubject ?? null,
  };
}

/**
 * Forget the game in flight, once it has been finished and scored.
 *
 * Deliberately does NOT give the play back: it has been played. This only stops
 * the same finished game being sent up a second time to score twice.
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
    activeSubject: null,
  });
}
