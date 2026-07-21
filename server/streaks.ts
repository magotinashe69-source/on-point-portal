// Daily streaks (gamification).
//
// A streak counts consecutive days on which a student completed at least one
// submission. It is deliberately self-contained, like xp.ts and rewards.ts: it
// reads and writes the student_streaks table and calls awardXp() for milestone
// bonuses, but it never modifies the XP, auto-marking, or Treasure Island code.
//
// The rules (all here so they are easy to find and change):
//   * a "day" is measured in Mozambique time (CAT, UTC+2) so it matches the
//     kids' real day — no daylight saving to worry about.
//   * miss a day and a streak freeze is spent automatically to save the streak.
//   * a student earns 1 freeze each time they level up, holding at most 2.
//   * milestones at 3, 7, 14 and 30 days give a one-time celebration + bonus XP
//     of 15 / 40 / 100 / 250 (the bonus still respects the 300 XP daily cap,
//     because it is awarded through the normal awardXp() path).
//   * losing a streak is never punishing — we show an encouraging note, not a
//     shaming one.

import { storage } from "./storage";
import { awardXp } from "./xp";

export const MAX_FREEZES = 2;

// Day count -> bonus XP. One-time each (see reachedMilestones).
export const MILESTONES: { day: number; bonus: number }[] = [
  { day: 3, bonus: 15 },
  { day: 7, bonus: 40 },
  { day: 14, bonus: 100 },
  { day: 30, bonus: 250 },
];

// ---------------------------------------------------------------------------
// "Today" in Mozambique time (CAT = UTC+2).
//
// For local testing we allow overriding today so streaks can be tested without
// waiting real days (see the dev-only routes). The override is ignored in
// production so it can never affect real students.
// ---------------------------------------------------------------------------
let simulatedToday: string | null = null;

export function setSimulatedToday(date: string | null): void {
  simulatedToday = date;
}
export function getSimulatedToday(): string | null {
  return simulatedToday;
}

// The current day as YYYY-MM-DD in CAT.
export function streakToday(): string {
  if (process.env.NODE_ENV !== "production" && simulatedToday) return simulatedToday;
  const cat = new Date(Date.now() + 2 * 60 * 60 * 1000); // shift UTC by +2h
  return cat.toISOString().slice(0, 10);
}

// Whole days from day `a` to day `b` (b - a), both YYYY-MM-DD.
function daysBetween(a: string, b: string): number {
  const ta = Date.parse(a + "T00:00:00Z");
  const tb = Date.parse(b + "T00:00:00Z");
  return Math.round((tb - ta) / 86400000);
}

// A day shifted by whole days (e.g. yesterday = addDays(today, -1)).
function addDays(day: string, delta: number): string {
  const t = Date.parse(day + "T00:00:00Z") + delta * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// The one-time note shown on the dashboard after something notable happens.
// (The message strings are grouped here so they are easy to translate later.)
// ---------------------------------------------------------------------------
export type StreakNotice =
  | { type: "freeze"; message: string }
  | { type: "lost"; record: number; message: string }
  | { type: "milestone"; day: number; bonusXp: number; message: string };

function dayWord(n: number): string {
  return n === 1 ? "day" : "days";
}

// ---------------------------------------------------------------------------
// Pure streak maths. `state` is the streak in memory; these functions never
// touch the database so they are easy to reason about and test.
// ---------------------------------------------------------------------------
interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // "" means "never active yet"
  freezes: number;
  reachedMilestones: number[];
}

function fromRow(row: {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  freezes: number;
  reachedMilestones: string;
}): StreakState {
  return {
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
    lastActiveDate: row.lastActiveDate,
    freezes: row.freezes,
    reachedMilestones: row.reachedMilestones
      ? row.reachedMilestones.split(",").map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n))
      : [],
  };
}

// Bring a streak up to date for `today` WITHOUT counting any activity today.
// This is what handles a missed day: freezes are spent to cover the gap, or the
// streak resets if there aren't enough. Returns the settled state and, if the
// day boundary caused something, a one-time note to show.
function settle(state: StreakState, today: string): { state: StreakState; notice: StreakNotice | null } {
  if (!state.lastActiveDate) return { state, notice: null }; // never active — nothing to settle

  const gap = daysBetween(state.lastActiveDate, today);

  // Active today already, or active yesterday (streak still alive, today pending).
  if (gap <= 1) return { state, notice: null };

  // gap >= 2 means there are (gap - 1) whole days that were missed (today itself
  // isn't "missed" yet — the student could still be active later today).
  const missed = gap - 1;

  if (state.freezes >= missed) {
    // Freezes cover every missed day: the streak survives. Anchor to yesterday
    // so a real submission today continues the streak, and a further miss later
    // is measured from here. Freeze days do not add to the count.
    return {
      state: { ...state, freezes: state.freezes - missed, lastActiveDate: addDays(today, -1) },
      notice: { type: "freeze", message: "Your streak freeze saved you! 🔥" },
    };
  }

  // Not enough freezes: the streak ends. Reset gently — keep the record so we
  // can cheer the student on with it.
  return {
    state: { ...state, currentStreak: 0, freezes: 0, lastActiveDate: "" },
    notice: {
      type: "lost",
      record: state.longestStreak,
      message: `Start a new streak today — your record is ${state.longestStreak} ${dayWord(state.longestStreak)}!`,
    },
  };
}

// ---------------------------------------------------------------------------
// Database-backed operations.
// ---------------------------------------------------------------------------

// Load a student's streak row, creating a fresh one the first time.
async function loadOrCreate(studentId: number) {
  let row = await storage.getStudentStreak(studentId);
  if (!row) {
    row = await storage.createStudentStreak({
      studentId,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: "",
      freezes: 0,
      reachedMilestones: "",
      pendingNotice: "",
    });
  }
  return row;
}

// Record that a student completed a submission today. Idempotent per day: the
// second submission on the same day changes nothing. Best-effort caller wraps
// this in try/catch, so it can never break the submission response.
export async function recordActivity(studentId: number): Promise<void> {
  const today = streakToday();
  const row = await loadOrCreate(studentId);

  // First bring the streak up to date (this may spend a freeze or reset it).
  const settled = settle(fromRow(row), today);
  let state = settled.state;
  let notice: StreakNotice | null = settled.notice;

  const alreadyToday = state.lastActiveDate === today;
  if (!alreadyToday) {
    // A new active day extends the streak (or starts a fresh one at 1).
    state.currentStreak = state.lastActiveDate === "" ? 1 : state.currentStreak + 1;
    state.lastActiveDate = today;
    if (state.currentStreak > state.longestStreak) state.longestStreak = state.currentStreak;

    // A milestone we haven't celebrated before: award bonus XP (through the
    // normal XP path, so the 300/day cap still applies) and remember it.
    const milestone = MILESTONES.find(
      (m) => m.day === state.currentStreak && !state.reachedMilestones.includes(m.day),
    );
    if (milestone) {
      state.reachedMilestones = [...state.reachedMilestones, milestone.day];
      try {
        await awardXp(studentId, milestone.bonus, {});
      } catch (err) {
        console.error("Milestone XP award failed (streak still saved):", err);
      }
      notice = {
        type: "milestone",
        day: milestone.day,
        bonusXp: milestone.bonus,
        message: `🔥 ${milestone.day}-day streak! +${milestone.bonus} XP`,
      };
    }
  }

  await storage.updateStudentStreak(studentId, {
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    lastActiveDate: state.lastActiveDate,
    freezes: state.freezes,
    reachedMilestones: state.reachedMilestones.join(","),
    // Stash a note (if any) so the dashboard can show it once. Keep any existing
    // note if nothing new happened this time.
    pendingNotice: notice ? JSON.stringify(notice) : row.pendingNotice,
  });
}

// Give a student a freeze for levelling up, capped at MAX_FREEZES held. Called
// after an XP award reports a level-up. Best-effort.
export async function grantFreezeForLevelUp(studentId: number): Promise<void> {
  const row = await loadOrCreate(studentId);
  if (row.freezes >= MAX_FREEZES) return; // already holding the max
  await storage.updateStudentStreak(studentId, { freezes: Math.min(MAX_FREEZES, row.freezes + 1) });
}

// What the dashboard shows: the current flame, best-ever, freezes held, and a
// one-time note if there is one. This also settles the streak on read, so a
// missed day is noticed (and a freeze spent / streak reset) even if the student
// only opens the dashboard. Returns notice at most once per event.
export interface StreakSummary {
  current: number;
  longest: number;
  freezes: number;
  maxFreezes: number;
  notice: StreakNotice | null;
}

export async function refreshStreak(studentId: number): Promise<StreakSummary> {
  const today = streakToday();
  const row = await storage.getStudentStreak(studentId);

  // No row yet means the student has never completed anything — show zeros and
  // don't bother creating a row until there is real activity.
  if (!row) {
    return { current: 0, longest: 0, freezes: 0, maxFreezes: MAX_FREEZES, notice: null };
  }

  const before = fromRow(row);
  const settled = settle(before, today);
  const state = settled.state;

  // A live freeze/lost note from crossing the day boundary right now takes
  // priority; otherwise deliver any note stashed by a recent submission.
  const stored: StreakNotice | null = row.pendingNotice ? safeParse(row.pendingNotice) : null;
  const notice = settled.notice ?? stored;

  // Persist only when something actually changed (settle moved the state) or we
  // are clearing a stored note — the dashboard reads this often.
  const stateChanged =
    state.currentStreak !== before.currentStreak ||
    state.freezes !== before.freezes ||
    state.lastActiveDate !== before.lastActiveDate;

  if (stateChanged || row.pendingNotice) {
    await storage.updateStudentStreak(studentId, {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: state.lastActiveDate,
      freezes: state.freezes,
      reachedMilestones: state.reachedMilestones.join(","),
      pendingNotice: "", // the note (if any) is being delivered in this response
    });
  }

  return {
    current: state.currentStreak,
    longest: state.longestStreak,
    freezes: state.freezes,
    maxFreezes: MAX_FREEZES,
    notice,
  };
}

function safeParse(json: string): StreakNotice | null {
  try {
    return JSON.parse(json) as StreakNotice;
  } catch {
    return null;
  }
}

// Dev/testing helper: wipe a student's streak back to nothing.
export async function resetStreak(studentId: number): Promise<void> {
  const row = await storage.getStudentStreak(studentId);
  if (!row) return;
  await storage.updateStudentStreak(studentId, {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: "",
    freezes: 0,
    reachedMilestones: "",
    pendingNotice: "",
  });
}
