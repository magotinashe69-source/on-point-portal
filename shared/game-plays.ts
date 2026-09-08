// Plays earned by doing homework — the pure rules.
//
// The deal is simple enough for a nine-year-old to hold in their head:
//
//   Every assignment you hand in today gives you ONE play of Target Blaster
//   and ONE play of Penalty Shootout. Hand in three, get three of each.
//
// Like shared/auto-marking.ts and shared/penalty.ts this file is pure: it turns
// inputs into outputs with no database or network access, so the server and the
// browser can both use it and neither can drift from the other.
//
// Treasure Island is NOT in here. It has always rewarded completing assignments
// with chests and is left exactly as it was.

/** The games that cost a play. Treasure Island is deliberately not one. */
export const PLAY_GAMES = ["blaster", "penalty"] as const;
export type PlayGame = (typeof PLAY_GAMES)[number];

/** One play of each game, per assignment handed in today. */
export const PLAYS_PER_ASSIGNMENT = 1;

export function isPlayGame(game: string): game is PlayGame {
  return (PLAY_GAMES as readonly string[]).includes(game);
}

/** How many plays a day's homework is worth. */
export function playsEarned(assignmentsCompletedToday: number): number {
  return Math.max(0, assignmentsCompletedToday) * PLAYS_PER_ASSIGNMENT;
}

/**
 * How many plays are left right now.
 *
 * Never below zero: a child whose teacher deletes an assignment after they have
 * already played should see "0 left", not a negative number.
 */
export function playsLeft(earned: number, used: number): number {
  return Math.max(0, earned - used);
}

/** The state of one game's plays, as both the server and the page see it. */
export interface PlayState {
  game: PlayGame;
  earned: number;
  used: number;
  left: number;
  /** How many assignments today earned those plays — used in the wording. */
  completedToday: number;
}

export function buildPlayState(
  game: PlayGame, completedToday: number, used: number,
): PlayState {
  const earned = playsEarned(completedToday);
  return { game, earned, used, left: playsLeft(earned, used), completedToday };
}

// --- Wording --------------------------------------------------------------
//
// Grouped here so it can be translated in one place, and so the two games say
// exactly the same thing. It is written to a child: what they have, and what to
// do about it — never "you have run out" on its own, which just reads as a door
// closing.

export const PLAYS_TEXT = {
  title: "Plays left today",

  /** "2 plays left — finish more assignments to earn more!" */
  left(n: number): string {
    return `${n} ${n === 1 ? "play" : "plays"} left — finish more assignments to earn more!`;
  },

  /** What a child sees when they have used them all up. */
  none: "Come back tomorrow, or finish another assignment to earn more plays.",

  /** What a child sees who has not handed anything in today at all. */
  noneEarnedYet:
    "Hand in an assignment today to earn a play. Every assignment you finish gives you one play of each game.",

  /** Shown after a game, so the next step is obvious. */
  spent(n: number): string {
    return n > 0
      ? `${n} ${n === 1 ? "play" : "plays"} left today.`
      : "That was your last play today. Finish another assignment to earn more.";
  },

  earnedNote: "You earn 1 play of each game for every assignment you hand in.",
  resetNote: "Plays reset every morning. Unused plays do not carry over.",
} as const;

/** The one line to show a child, whatever state they are in. */
export function playsMessage(state: PlayState): string {
  if (state.left > 0) return PLAYS_TEXT.left(state.left);
  if (state.earned === 0) return PLAYS_TEXT.noneEarnedYet;
  return PLAYS_TEXT.none;
}
