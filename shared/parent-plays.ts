// The parent's view of game plays.
//
// A parent's real question about the games is not "what did he score?" — it is
// **"is the phone being earned, or just used?"** So this view is built around
// the deal the child is on:
//
//   Every assignment handed in today earns ONE play of Target Blaster and ONE
//   of Penalty Shootout. Unused plays do not carry over to tomorrow.
//
// which means a parent can read the week and see homework and screen time as
// the same number, because they are.
//
// Like shared/parent-overview.ts this file holds only the SHAPES and the
// wording — no database access — so the figures are gathered in one place
// (server/parent-plays.ts) and the wording can be swapped for Portuguese.
//
// Everything here is read-only by design. There is nothing in these shapes a
// parent could send back to change: a parent cannot grant plays, take them
// away, or unlock a game. The whole parent portal answers 405 to anything but
// a GET, and that is deliberate — see the guard on /api/parent in routes.ts.

import { PLAY_GAMES, type PlayGame } from "./game-plays";

/** What one game costs and what is left of it today. */
export interface ParentGameToday {
  game: PlayGame;
  /** The game's name as a parent would say it, not its internal key. */
  label: string;
  earned: number;
  used: number;
  left: number;
}

/** One day of the week strip. */
export interface ParentPlayDay {
  day: string; // YYYY-MM-DD, CAT — the same day the streak and the games use
  assignmentsHandedIn: number;
  /**
   * Plays that day's homework earned, ACROSS BOTH GAMES — one assignment earns
   * one play of each, so two assignments are four plays.
   *
   * Held as its own figure rather than left for the page to multiply out: every
   * number a parent is shown is then a total across both games, and "earned 4,
   * used 3" reads correctly. A page doing its own arithmetic is how one figure
   * ends up per-game and the one beside it a total.
   */
  playsEarned: number;
  /** Plays actually used that day, both games added together. */
  playsUsed: number;
}

/** A child's best at one game, shown as encouragement rather than a report. */
export interface ParentGameRecord {
  game: PlayGame;
  label: string;
  bestScore: number;
  bestOutOf: number;
  gamesPlayed: number;
  /** Penalty Shootout keeps a record per subject; this is the best one. */
  subject: string | null;
}

export interface ParentPlays {
  child: { id: number; fullName: string; form: string };

  /**
   * False for Forms 1-2. The games are Stages 3-6 only, so a secondary child's
   * parent must be told that plainly rather than shown a row of zeros, which
   * would read as "your child has earned nothing".
   */
  available: boolean;

  today: {
    /** Assignments handed in today — where today's plays came from. */
    assignmentsHandedIn: number;
    games: ParentGameToday[];
  };

  /** The last seven days, NEWEST FIRST. Empty when the games do not apply. */
  week: ParentPlayDay[];

  /** Best scores so far. Empty until the child has finished a game. */
  records: ParentGameRecord[];
}

/** The games' names as a parent would say them. */
export const GAME_LABELS: Record<PlayGame, string> = {
  blaster: "Target Blaster",
  penalty: "Penalty Shootout",
};

/** Guards against a label going missing if a game is ever added. */
export function gameLabel(game: PlayGame): string {
  return GAME_LABELS[game] ?? game;
}

export { PLAY_GAMES };
export type { PlayGame };

// Every total below counts BOTH games together, so they can be read against
// each other. The per-game split is in `today.games`.

/** Plays earned today, across both games. */
export function earnedToday(games: ParentGameToday[]): number {
  return games.reduce((n, g) => n + g.earned, 0);
}

/** Plays used today, across both games. */
export function usedToday(games: ParentGameToday[]): number {
  return games.reduce((n, g) => n + g.used, 0);
}

/** Plays still unused today, across both games. */
export function leftToday(games: ParentGameToday[]): number {
  return games.reduce((n, g) => n + g.left, 0);
}

/** Plays earned across the week, across both games. */
export function weekEarned(week: ParentPlayDay[]): number {
  return week.reduce((n, d) => n + d.playsEarned, 0);
}

/** Plays used across the week, across both games. */
export function weekUsed(week: ParentPlayDay[]): number {
  return week.reduce((n, d) => n + d.playsUsed, 0);
}

/** Days in the week the child handed something in. */
export function weekActiveDays(week: ParentPlayDay[]): number {
  return week.reduce((n, d) => (d.assignmentsHandedIn > 0 ? n + 1 : n), 0);
}

// --- Wording --------------------------------------------------------------
// Grouped here so the whole parent view can be translated in one place, and
// written to a parent: plain, specific, and never nagging about their child.

export const PLAYS_PARENT_TEXT = {
  title: "Games and screen time",

  /** The deal, in one line. This is the thing a parent most needs to know. */
  howItWorks:
    "Games are earned, not given. Every assignment your child hands in earns them one play of each game.",

  /** So a parent knows plays cannot be hoarded into a long session. */
  resetNote: "Plays reset every morning. Unused plays do not carry over.",

  // Labelled "plays", and every one of these three counts both games together
  // so they add up against each other.
  earnedToday: "Plays earned today",
  usedToday: "Plays used today",
  leftToday: "Plays left today",

  /** Spells out the split, since one assignment earns a play of EACH game. */
  bothGamesNote: "One assignment earns one play of each game, so both games are counted here.",

  /** Shown above the strip of days. */
  week: "The last seven days",
  weekEarned: "Plays earned",
  weekUsed: "Plays used",
  weekActive: "Days with homework handed in",

  /** When the child has done nothing at all today. Stated, not scolded. */
  nothingToday:
    "No assignments handed in today, so no plays earned today.",

  /** When they have earned plays and not spent them. */
  allUnused: "Earned today and not used yet.",

  records: "Best scores",
  recordsEmpty: "No finished games yet.",

  /** Forms 1-2 do not have the games at all. */
  notAvailable:
    "The games are for Stages 3 to 6. Your child's class does not have them, so there is nothing to earn or use here.",

  /**
   * The honesty note, in the same spirit as the attendance one on the
   * dashboard: say plainly what this figure is NOT, so it cannot be mistaken
   * for something the portal does not actually record.
   */
  notMinutes:
    "This counts plays earned and used, not minutes spent. The portal does not record how long your child plays for.",

  /** Wording for one game's line. */
  gameLine(label: string, left: number, earned: number): string {
    if (earned === 0) return `${label}: nothing earned today.`;
    if (left === 0) return `${label}: all ${earned} used.`;
    return `${label}: ${left} of ${earned} left.`;
  },

  /** "3 of 6" — how a best score reads. */
  recordLine(score: number, outOf: number): string {
    return outOf > 0 ? `${score} of ${outOf}` : "—";
  },
} as const;
