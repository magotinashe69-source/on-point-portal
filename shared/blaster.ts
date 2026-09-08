// Target Blaster — the pure rules of the tap-the-answer game.
//
// A round shows a question and four targets drifting across the screen, one of
// them right. Tap it before they drift off. Six rounds and the game is over.
//
// Deliberately different from Penalty Shootout so the two are worth having:
//
//                 Penalty Shootout          Target Blaster
//   questions     one subject you pick      every subject you have done, mixed
//   length        10 shots                  6 rounds
//   pressure      none, think it through    a timer per round
//   record        one per subject           one, overall
//
// Like shared/penalty.ts and shared/auto-marking.ts this file is pure: it turns
// inputs into outputs with no database or network access, so the server and the
// browser can share it and neither can drift.
//
// IMPORTANT, and the same rule as Penalty Shootout: this file never decides
// whether an answer is right. Marking is the existing auto-marker. And the
// answer key NEVER goes to the browser — these are real homework questions.

import type { Question } from "./auto-marking";
import { buildShotOptions, isPlayable, shuffle, dealShots, makeRef, readRef, type ShotOption } from "./penalty";

// --- Game shape -----------------------------------------------------------

/** Six rounds: long enough to feel like a game, short enough for one play. */
export const ROUNDS_PER_GAME = 6;

/** How long a child has to hit the target before it drifts away. */
export const SECONDS_PER_ROUND = 12;

/** Same as Penalty Shootout, so neither game is the better XP deal. */
export const XP_PER_CORRECT_ANSWER = 2;

/** One playable question is enough — the pack is re-dealt when it runs short. */
export const MIN_QUESTIONS = 1;

export function canPlay(availableQuestions: number): boolean {
  return availableQuestions >= MIN_QUESTIONS;
}

/**
 * One round as the CHILD sees it: a question and the targets to shoot at.
 * No answer key, exactly like a penalty Shot.
 */
export interface BlastRound {
  ref: string;        // "assignmentId:questionId" — handed back untouched
  index: number;      // 0-5
  subject: string;    // shown on the round, since a game mixes subjects
  questionText: string;
  targets: ShotOption[];
  seconds: number;    // how long this round lasts
}

export interface BlastGame {
  rounds: BlastRound[];
  secondsPerRound: number;
}

/** What the child sends back. Position decides the round, not `ref`. */
export interface BlastAnswer {
  ref?: string;
  answerText: string;
  /** True when the targets drifted away before they tapped one. */
  timedOut?: boolean;
}

// Re-exported so the game's own modules can reach these without importing from
// penalty.ts directly, which would read oddly in a file about shooting targets.
export { buildShotOptions, isPlayable, shuffle, dealShots, makeRef, readRef };
export type { ShotOption };

// --- Records --------------------------------------------------------------

/**
 * Is a personal best beaten? Compared as a fraction so a game that ever changes
 * length still compares fairly — the same rule Penalty Shootout uses.
 */
export function beatsRecord(
  score: number, outOf: number, bestScore: number, bestOutOf: number,
): boolean {
  if (outOf <= 0) return false;
  if (bestOutOf <= 0) return score > 0; // no real record yet
  return score / outOf > bestScore / bestOutOf;
}

// --- Wording --------------------------------------------------------------
// Grouped for translation, and written to a child.

export const BLASTER_TEXT = {
  title: "Target Blaster",
  tagline: "Tap the right target before it drifts away.",

  start: "Start blasting",
  round(n: number, total: number): string {
    return `Round ${n} of ${total}`;
  },

  hit: "Hit!",
  missed: "Missed",
  timedOut: "Too slow — it got away!",

  // Shown when a child has handed nothing in yet, so there is nothing to ask.
  nothingYet:
    "Finish an assignment first — Target Blaster is built from questions you have already answered.",

  scoreLine(score: number, outOf: number): string {
    return `You hit ${score} of ${outOf}`;
  },
  newRecord: "New record!",
  bestSoFar: "Your best",
  playAgain: "Play again",
  backToDashboard: "Back to dashboard",
} as const;
