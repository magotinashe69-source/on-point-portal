// Gathering the figures for one child's weekly parent report.
//
// The shapes, the week maths and the WhatsApp message live in
// shared/weekly-report.ts. This file is the part that reads the database.
//
// Percentages are worked out the same way as the Reports page and the Grade
// Book: total marks scored divided by total marks available, not the mean of
// individual percentages. That matters — a parent comparing this report with a
// figure a teacher quotes must see the same number.

import { storage } from "./storage";
import { streakToday, peekStreak } from "./streaks";
import {
  weekWindow,
  isWithin,
  type WeeklyReport,
  type SubjectScore,
} from "@shared/weekly-report";
import type { Assignment, Student } from "@shared/schema";

/**
 * The day a moment falls on in CAT (Mozambique time, UTC+2), as YYYY-MM-DD.
 * Matches how streaks decide which day a submission belongs to, so "days
 * active" here and the streak the child sees never disagree by a day.
 */
export function catDay(when: Date | string | number): string {
  const ms = when instanceof Date ? when.getTime() : new Date(when).getTime();
  return new Date(ms + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * When this assignment is actually due for THIS child.
 *
 * A teacher can extend a deadline for one pupil, and if we ignored that the
 * report would tell a parent their child missed work that was never late.
 */
export function dueDateFor(assignment: Assignment, studentId: number): string {
  const extension = (assignment.extendedDeadlines || []).find(e => e.studentId === studentId);
  return extension?.newDueDate || assignment.dueDate;
}

/** Total scored / total available, as a whole percentage. Null when nothing counts. */
export function percentage(scored: number, available: number): number | null {
  if (available <= 0) return null;
  return Math.round((scored / available) * 100);
}

/**
 * Build the weekly report for one child.
 *
 * `weekOffset` 0 is the current week, 1 the week just gone.
 */
export async function buildWeeklyReport(
  student: Student,
  weekOffset = 0,
): Promise<WeeklyReport> {
  const week = weekWindow(streakToday(), weekOffset);

  // Everything this child has ever handed in, then narrowed to the week. There
  // is no "submissions between two dates" query, and a single pupil's history
  // is small, so filtering here is simpler than a new storage method.
  const allSubmissions = await storage.getSubmissions({ studentId: student.id });
  const weekSubmissions = allSubmissions.filter(s =>
    isWithin(catDay(s.submittedAt), week.start, week.end),
  );

  // --- Days active on homework ---
  // Distinct days, so three pieces handed in on Monday still count as one day.
  const activeDays = new Set(weekSubmissions.map(s => catDay(s.submittedAt)));

  // --- Homework set and handed in ---
  // The child's assignments: their class's work plus anything aimed at them
  // personally. getAssignments already drops drafts and archived work.
  const assignments = await storage.getAssignments(student.form, student.id);
  const dueThisWeek = assignments.filter(a =>
    isWithin(dueDateFor(a, student.id), week.start, week.end),
  );

  // Handed in at any point — a piece due Friday and handed in Saturday still
  // counts as done. The parent is being told whether the work exists, not
  // whether it was punctual.
  const submittedAssignmentIds = new Set(allSubmissions.map(s => s.assignmentId));
  const completed = dueThisWeek.filter(a => submittedAssignmentIds.has(a.id)).length;

  // --- Marks: the overall average, and the per-subject picture ---
  const marks = await storage.getMarksBySubmissionIds(weekSubmissions.map(s => s.id));
  const assignmentById = new Map<number, Assignment>();
  for (const a of assignments) assignmentById.set(a.id, a);

  let scored = 0;
  let available = 0;
  // subject -> running totals
  const bySubject = new Map<string, { scored: number; available: number; marked: number }>();

  for (const submission of weekSubmissions) {
    const mark = marks.get(submission.id);
    if (!mark) continue; // handed in but not marked yet — no score to report

    // The assignment may be archived (and so missing from the list above), in
    // which case fetch it: the mark is still real and should still count.
    const assignment =
      assignmentById.get(submission.assignmentId) ||
      (await storage.getAssignment(submission.assignmentId));
    if (!assignment || assignment.totalMarks <= 0) continue;

    scored += mark.totalScore;
    available += assignment.totalMarks;

    const row = bySubject.get(assignment.subject) || { scored: 0, available: 0, marked: 0 };
    row.scored += mark.totalScore;
    row.available += assignment.totalMarks;
    row.marked += 1;
    bySubject.set(assignment.subject, row);
  }

  const subjectScores: SubjectScore[] = [];
  // Array.from keeps this working under the project's TypeScript target,
  // which does not allow iterating a Map directly.
  for (const [subject, row] of Array.from(bySubject.entries())) {
    const pct = percentage(row.scored, row.available);
    if (pct !== null) subjectScores.push({ subject, averagePercent: pct, marked: row.marked });
  }
  // Best first. Ties fall back to subject name so the same week always reads
  // the same way rather than shuffling between requests.
  subjectScores.sort((a, b) =>
    b.averagePercent - a.averagePercent || a.subject.localeCompare(b.subject),
  );

  // With only one subject marked there is no "strongest" and no "weakest" to
  // draw — naming the single subject as both would be misleading. So a lone
  // subject is reported as the strongest only.
  const strongest = subjectScores.length > 0 ? subjectScores[0] : null;
  const needsAttention =
    subjectScores.length >= 2 ? subjectScores[subjectScores.length - 1] : null;

  const streak = await peekStreak(student.id);

  return {
    child: { id: student.id, fullName: student.fullName, form: student.form },
    week,
    daysActive: activeDays.size,
    homework: { due: dueThisWeek.length, completed },
    averagePercent: percentage(scored, available),
    strongest,
    needsAttention,
    streak: { current: streak.current, longest: streak.longest },
  };
}
