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

// --- A game left half-finished ---------------------------------------------
//
// A play is spent when a game STARTS, like a coin in an arcade machine. But a
// child whose battery dies, whose tab is closed by a parent, or who mis-taps
// "back" in round two has not had their play — and telling them they have is
// how a reward turns into a punishment.
//
// So an unfinished game is not refunded, it is KEPT. Come back and you are put
// back into the same game, at the round you had reached, with the rounds you
// already played still marked as they were.
//
// Keeping it rather than refunding it is what makes this safe to give away:
//
//   * The questions are the ones already issued, so quitting cannot be used to
//     re-roll until an easy set comes up.
//   * The rounds already played keep their marks, so a child cannot quit a game
//     they are losing and start it again for a better score.
//   * A round whose answer they have already been shown is not asked twice,
//     so quitting after each answer cannot be used to learn the answers.
//
// The progress lives beside the questions in the same row (server/game-plays.ts),
// so nothing has to be cleared up and no timer has to expire.

/** What happened in one slot of a game. `null` means "not played yet". */
export interface SlotResult {
  /** What the child actually tapped. Kept so a resumed round can show it. */
  answerText: string;
  correct: boolean;
  /** True when the round ran out of time rather than being answered. */
  timedOut?: boolean;
}

/** One entry per question issued, in the order they were asked. */
export type SlotProgress = (SlotResult | null)[];

/**
 * Read progress back out of the database, forced to the right length.
 *
 * Anything unrecognised becomes "not played yet" rather than throwing: a row
 * written by an older version of the app, or a game whose length changed, must
 * still let the child play rather than showing them an error.
 */
export function readProgress(raw: unknown, length: number): SlotProgress {
  const arr = Array.isArray(raw) ? raw : [];
  const out: SlotProgress = [];
  for (let i = 0; i < length; i++) {
    const slot = arr[i];
    if (slot && typeof slot === "object" && typeof (slot as SlotResult).correct === "boolean") {
      const s = slot as SlotResult;
      out.push({ answerText: String(s.answerText ?? ""), correct: s.correct, timedOut: !!s.timedOut });
    } else {
      out.push(null);
    }
  }
  return out;
}

/** A fresh, wholly unplayed game of `length` rounds. */
export function emptyProgress(length: number): SlotProgress {
  return new Array(length).fill(null);
}

/** Has this slot already been played? Answered or timed out both count. */
export function slotPlayed(progress: SlotProgress, slot: number): boolean {
  return !!progress[slot];
}

/**
 * The round to put the child back on: the first one they have not played.
 *
 * Returns the game's length when every round has been played, which the caller
 * reads as "this game is finished, score it".
 */
export function firstUnplayedSlot(progress: SlotProgress): number {
  const at = progress.findIndex((s) => !s);
  return at === -1 ? progress.length : at;
}

/** How many rounds are still to play. */
export function slotsLeft(progress: SlotProgress): number {
  return progress.reduce((n, s) => (s ? n : n + 1), 0);
}

/** The score so far, from the server's own record of what happened. */
export function scoreProgress(progress: SlotProgress): number {
  return progress.reduce((n, s) => (s?.correct ? n + 1 : n), 0);
}

/** Is there a half-finished game to go back to? */
export function isResumable(progress: SlotProgress): boolean {
  return progress.length > 0 && firstUnplayedSlot(progress) < progress.length;
}

export const RESUME_TEXT = {
  /** Shown when a child opens a game they walked away from. */
  banner: "You left this game half-finished — carry on where you left off.",

  /**
   * "Back at round 3 of 6 — 1 so far."
   *
   * `unit` is the game's own word for a turn, so Target Blaster says "round"
   * and Penalty Shootout says "shot" without either owning the sentence.
   */
  where(unit: string, n: number, total: number, score: number): string {
    return `Back at ${unit} ${n} of ${total} — ${score} so far.`;
  },

  /** Reassurance on the start screen, so quitting never feels costly. */
  noCost: "Leaving a game does not use up your play — you can come back and finish it.",
} as const;
