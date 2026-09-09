// Gathering the figures for the teacher's view of game plays.
//
// The shapes and the wording live in shared/teacher-plays.ts. This file is the
// part that reads the database.
//
// Three things to keep in mind:
//
//  1. It reads a WHOLE CLASS in a fixed number of queries — the register, the
//     assignments, the submissions, and one bulk read of the play rows. A loop
//     of "one query per child per day per game" would be four hundred round
//     trips for a class of thirty over a week.
//
//  2. Plays EARNED are recounted from the assignments handed in, never read
//     from a stored figure, because earned is never stored (see
//     server/game-plays.ts). The same rule the child and the parent see.
//
//  3. Nothing here writes. Building a teacher's view must never spend, grant or
//     clear a play.

import { storage } from "./storage";
import { streakToday } from "./streaks";
import { catDay } from "./weekly-report";
import { playsEarned as playsPerAssignment, PLAY_GAMES } from "@shared/game-plays";
import {
  groupFor,
  type TeacherPlayRow,
  type TeacherPlays,
  type TeacherPlaysSummary,
} from "@shared/teacher-plays";
import { isPrimaryForm } from "@shared/schema";

/**
 * Build the class picture for one form over one range of days.
 *
 * `dateFrom`/`dateTo` are YYYY-MM-DD in CAT and inclusive. Passing the same day
 * twice is the "today" case, which is the only time "plays left" means
 * anything — plays do not carry over, so a past day has no leftovers a child
 * could still spend.
 */
export async function buildTeacherPlays(
  form: string, dateFrom: string, dateTo: string,
): Promise<TeacherPlays> {
  const today = streakToday();
  const isToday = dateFrom === today && dateTo === today;

  const empty: TeacherPlaysSummary = {
    children: 0, earning: 0, playing: 0, neither: 0, totalEarned: 0, totalUsed: 0,
  };

  // Forms 1-2 have no games. Answered plainly rather than as a class of zeros,
  // which would read as "nobody in Form 1 is doing their homework".
  if (!isPrimaryForm(form)) {
    return { form, dateFrom, dateTo, isToday, available: false, summary: empty, rows: [] };
  }

  const students = await storage.getStudentsByForm(form);
  if (students.length === 0) {
    return { form, dateFrom, dateTo, isToday, available: true, summary: empty, rows: [] };
  }

  const studentIds = students.map((s) => s.id);

  // Everything handed in, and everything used, in as few reads as possible.
  const [allSubmissions, playRows] = await Promise.all([
    storage.getSubmissions(),
    storage.getGamePlaysForStudents(studentIds, dateFrom, dateTo),
  ]);

  // Distinct assignments handed in, per child, inside the range. Counted per
  // ASSIGNMENT like the ledger itself, so handing the same piece in twice
  // cannot look like two pieces of work.
  const handedIn = new Map<number, Set<number>>();
  for (const sub of allSubmissions) {
    const day = catDay(sub.submittedAt);
    if (day < dateFrom || day > dateTo) continue;
    const set = handedIn.get(sub.studentId) || new Set<number>();
    set.add(sub.assignmentId);
    handedIn.set(sub.studentId, set);
  }

  // Plays used, per child, added across both games and every day in the range.
  const used = new Map<number, number>();
  for (const row of playRows) {
    used.set(row.studentId, (used.get(row.studentId) ?? 0) + (row.used ?? 0));
  }

  const rows: TeacherPlayRow[] = students.map((student) => {
    const assignmentsHandedIn = handedIn.get(student.id)?.size ?? 0;
    // One play of EACH game per assignment, so the total counts both — the same
    // way every figure on the parent's card does.
    const earned = playsPerAssignment(assignmentsHandedIn) * PLAY_GAMES.length;
    const usedCount = used.get(student.id) ?? 0;

    return {
      studentId: student.id,
      fullName: student.fullName,
      assignmentsHandedIn,
      playsEarned: earned,
      playsUsed: usedCount,
      // Only today has leftovers worth naming. Plays do not carry over, so
      // "3 left" on last Tuesday would describe something nobody can spend.
      playsLeft: isToday ? Math.max(0, earned - usedCount) : null,
      group: groupFor(earned, usedCount),
    };
  });

  // The children the reward is not reaching come FIRST. This page exists to
  // find them, and a teacher should not have to scroll a class of thirty to do
  // it. Within a group, by name, so the list reads the same way every time
  // rather than shuffling between requests.
  const order: Record<string, number> = {
    neither: 0, playedNotEarned: 1, earnedNotPlayed: 2, earnedAndPlayed: 3,
  };
  rows.sort((a, b) =>
    order[a.group] - order[b.group] || a.fullName.localeCompare(b.fullName),
  );

  const summary: TeacherPlaysSummary = {
    children: rows.length,
    earning: rows.filter((r) => r.playsEarned > 0).length,
    playing: rows.filter((r) => r.playsUsed > 0).length,
    neither: rows.filter((r) => r.group === "neither").length,
    totalEarned: rows.reduce((n, r) => n + r.playsEarned, 0),
    totalUsed: rows.reduce((n, r) => n + r.playsUsed, 0),
  };

  return { form, dateFrom, dateTo, isToday, available: true, summary, rows };
}
