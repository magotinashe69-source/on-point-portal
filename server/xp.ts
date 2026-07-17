// XP + levels (gamification).
//
// This is deliberately lightweight and self-contained: it reads and writes the
// student_xp table (one row per student) and knows nothing about auto-marking.
// Callers award XP AFTER marking is done and wrap the call so a failure can
// never break or slow the marking response.
//
// The rules (all defined here so they are easy to find and change):
//   * 10 XP per correct answer
//   * 25 bonus for completing an assignment
//   * 50 bonus for beating your own previous score on a retry
//   * at most 300 XP per student per day (so one easy quiz can't be farmed)
//   * every 500 XP = 1 level, with no maximum

import { storage } from "./storage";

export const XP_PER_CORRECT = 10;
export const XP_COMPLETION_BONUS = 25;
export const XP_IMPROVEMENT_BONUS = 50;
export const XP_DAILY_CAP = 300;
export const XP_PER_LEVEL = 500;

// Level is simply how many full 500-XP blocks the student has earned.
export function levelForXp(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL);
}

// A plain YYYY-MM-DD day key (UTC) for the daily-cap window. UTC keeps it
// simple and predictable; for a UTC+2 school the day rolls over at 02:00 local.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// A transparent breakdown of where an award's XP came from, so the UI can
// explain it to the student.
export interface XpBreakdown {
  correct?: number;          // number of correct answers rewarded
  perCorrect?: number;       // XP given per correct answer
  completionBonus?: number;  // completion bonus included (0 if none)
  improvementBonus?: number; // improvement bonus included (0 if none)
}

export interface XpAward {
  requested: number;    // what the attempt was worth before the daily cap
  awarded: number;      // what was actually added after the cap
  dailyCapped: boolean; // true if the cap reduced the award
  totalXp: number;      // new lifetime total
  level: number;        // new level
  leveledUp: boolean;   // true if this award crossed into a new level
  breakdown: XpBreakdown;
}

// Add XP to a student, respecting the daily cap and recomputing their level.
// Returns exactly what happened so the caller can show it transparently.
export async function awardXp(
  studentId: number,
  requested: number,
  breakdown: XpBreakdown,
): Promise<XpAward> {
  const today = todayKey();

  let row = await storage.getStudentXp(studentId);
  if (!row) {
    row = await storage.createStudentXp({ studentId, totalXp: 0, level: 0, dailyXp: 0, dailyDate: today });
  }

  // A new day resets the daily allowance.
  const dailySoFar = row.dailyDate === today ? row.dailyXp : 0;
  const remainingToday = Math.max(0, XP_DAILY_CAP - dailySoFar);
  const awarded = Math.max(0, Math.min(requested, remainingToday));

  const newTotal = row.totalXp + awarded;
  const newLevel = levelForXp(newTotal);
  const leveledUp = newLevel > row.level;

  await storage.updateStudentXp(studentId, {
    totalXp: newTotal,
    level: newLevel,
    dailyXp: dailySoFar + awarded,
    dailyDate: today,
  });

  return {
    requested,
    awarded,
    dailyCapped: awarded < requested,
    totalXp: newTotal,
    level: newLevel,
    leveledUp,
    breakdown,
  };
}

// The numbers the dashboard bar needs: current level and progress to the next.
export interface XpProgress {
  totalXp: number;
  level: number;
  xpIntoLevel: number;    // XP earned within the current level (0..499)
  xpForNextLevel: number; // always XP_PER_LEVEL
  progressPercent: number;// 0..100 towards the next level
}

export function xpProgress(totalXp: number, level: number): XpProgress {
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  return {
    totalXp,
    level,
    xpIntoLevel,
    xpForNextLevel: XP_PER_LEVEL,
    progressPercent: Math.round((xpIntoLevel / XP_PER_LEVEL) * 100),
  };
}
