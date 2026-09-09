// The teacher's view of game plays — a whole class at once.
//
// Deliberately NOT the parent view with more rows in it. The two are asking
// different questions:
//
//   A parent asks about one child: "is the phone being earned, or just used?"
//   A teacher asks about a class:  "is this reward actually pulling homework
//                                   in, and who is it not reaching?"
//
// So this view is built for scanning thirty names, not for reading one. Its
// centre is the four groups a class falls into on any given day, because that
// is what a teacher can act on:
//
//   * earned and played   — the reward is working as intended
//   * earned, not played  — did the work, has not collected. Nothing to fix.
//   * played, none earned — has plays left from earlier work, still playing
//   * neither             — the ones the reward is not reaching
//
// The last group is the point of the whole page. Everything else is context.
//
// Like the other shared files this holds only the SHAPES and the wording — no
// database access — so the figures are gathered in one place
// (server/teacher-plays.ts) and the wording can be swapped for Portuguese.

import { PLAY_GAMES, type PlayGame } from "./game-plays";

/** One child's line in the class list. */
export interface TeacherPlayRow {
  studentId: number;
  fullName: string;

  /** Distinct assignments handed in over the days being looked at. */
  assignmentsHandedIn: number;

  /** Plays those assignments earned, across BOTH games. */
  playsEarned: number;

  /** Plays actually used over those days, across both games. */
  playsUsed: number;

  /**
   * Plays still unused. Only meaningful for TODAY — plays do not carry over, so
   * "left" on a past day is not a thing a child could still spend. Null
   * whenever the range being looked at is not today alone.
   */
  playsLeft: number | null;

  /** Which of the four groups this child falls into. */
  group: PlayGroup;
}

/**
 * The four groups a class falls into. Named for what they describe rather than
 * numbered, so a change to the order cannot silently re-label a child.
 */
export const PLAY_GROUPS = ["earnedAndPlayed", "earnedNotPlayed", "playedNotEarned", "neither"] as const;
export type PlayGroup = (typeof PLAY_GROUPS)[number];

export function groupFor(playsEarned: number, playsUsed: number): PlayGroup {
  if (playsEarned > 0 && playsUsed > 0) return "earnedAndPlayed";
  if (playsEarned > 0) return "earnedNotPlayed";
  if (playsUsed > 0) return "playedNotEarned";
  return "neither";
}

export interface TeacherPlaysSummary {
  children: number;
  /** How many handed in at least one assignment. */
  earning: number;
  /** How many used at least one play. */
  playing: number;
  /** How many did neither — the group worth a teacher's attention. */
  neither: number;
  totalEarned: number;
  totalUsed: number;
}

export interface TeacherPlays {
  form: string;
  dateFrom: string; // YYYY-MM-DD, CAT
  dateTo: string;   // YYYY-MM-DD, CAT
  /** True when the range is today alone, which is when `playsLeft` means something. */
  isToday: boolean;

  /**
   * False for Forms 1-2. The games are Stages 3-6 only, so asking about a
   * secondary class gets a plain answer rather than a class of zeros, which
   * would read as "nobody in Form 1 is doing their homework".
   */
  available: boolean;

  summary: TeacherPlaysSummary;

  /** Every child in the class. Ordering is decided by the builder. */
  rows: TeacherPlayRow[];
}

export { PLAY_GAMES };
export type { PlayGame };

// --- Wording --------------------------------------------------------------

export const TEACHER_PLAYS_TEXT = {
  title: "Games and homework",
  subtitle: "Who is earning their game plays, and who the reward is not reaching.",

  /** The deal, so a teacher reading this page knows the rule it rests on. */
  howItWorks:
    "Every assignment a child hands in earns them one play of Target Blaster and one of Penalty Shootout. Plays reset every morning and do not carry over.",

  pickClass: "Choose a class",
  today: "Today",
  thisWeek: "This week",

  children: "Children",
  earning: "Handed in work",
  playing: "Played a game",
  neither: "Did neither",
  totalEarned: "Plays earned",
  totalUsed: "Plays used",

  /** The group headings, as a teacher would say them. */
  groups: {
    earnedAndPlayed: "Earned and played",
    earnedNotPlayed: "Earned, not played yet",
    playedNotEarned: "Played, earned nothing",
    neither: "Neither",
  } as Record<PlayGroup, string>,

  /** A line under each group saying what it means, so nobody has to guess. */
  groupNotes: {
    earnedAndPlayed: "Did their work and collected the reward.",
    earnedNotPlayed: "Did their work and has not played yet. Nothing to chase.",
    playedNotEarned: "Played, but handed nothing in over these days.",
    neither: "No work handed in and no games played.",
  } as Record<PlayGroup, string>,

  /** Forms 1-2 do not have the games at all. */
  notAvailable:
    "The games are for Stages 3 to 6, so there is nothing to show for this class.",

  emptyClass: "No pupils on the register for this class yet.",

  /**
   * Said plainly, in the same spirit as the attendance note on the parent's
   * page: this counts plays, not time, and must not be read as screen-time
   * monitoring.
   */
  notMinutes:
    "This counts plays earned and used, not minutes spent. The portal does not record how long a child plays for.",

  /** "3 of 4 used" — one child's plays at a glance. */
  usedLine(used: number, earned: number): string {
    return `${used} of ${earned} used`;
  },
} as const;

/** How many children fall in one group. */
export function countGroup(rows: TeacherPlayRow[], group: PlayGroup): number {
  return rows.reduce((n, r) => (r.group === group ? n + 1 : n), 0);
}
