// Gathering the figures for the parent's view of their child.
//
// The shapes and the wording live in shared/parent-overview.ts. This file is
// the part that reads the database.
//
// Two things to keep in mind:
//
//  1. Percentages use the SAME formula as the weekly report, the Reports page
//     and the Grade Book — total scored over total available, not the mean of
//     individual percentages. The helpers are imported from
//     server/weekly-report.ts rather than copied, so the two can never drift
//     apart and quote a parent different numbers.
//
//  2. This builder is given a Student that the caller has already proved
//     belongs to the parent asking. It never looks up a child itself, so
//     there is no id here for anyone to tamper with.

import { storage } from "./storage";
import { streakToday } from "./streaks";
import { catDay, dueDateFor, percentage } from "./weekly-report";
import { addDays } from "@shared/weekly-report";
import type {
  ParentOverview,
  RecentMark,
  SubjectAverage,
  OutstandingItem,
} from "@shared/parent-overview";
import type { Assignment, Student } from "@shared/schema";

/** How many marked pieces a parent sees on the dashboard. */
const RECENT_MARK_LIMIT = 12;

/** How many notices a parent sees. */
const ANNOUNCEMENT_LIMIT = 10;

/**
 * Build the full picture of one child for their parent.
 *
 * Everything returned is read-only information — there is nothing here a
 * parent could send back to change.
 */
export async function buildParentOverview(student: Student): Promise<ParentOverview> {
  // Everything this child has ever handed in, and everything set for them.
  // A single pupil's history is small, so reading it all and working in memory
  // is simpler than adding new database queries.
  const submissions = await storage.getSubmissions({ studentId: student.id });
  const assignments = await storage.getAssignments(student.form, student.id);

  const assignmentById = new Map<number, Assignment>();
  for (const a of assignments) assignmentById.set(a.id, a);

  // --- Homework set and handed in ---
  const submittedAssignmentIds = new Set(submissions.map(s => s.assignmentId));
  const completed = assignments.filter(a => submittedAssignmentIds.has(a.id)).length;

  // What is left to do, soonest deadline first. Uses this child's own due
  // date, so work a teacher gave them extra time on is not shown as overdue.
  const outstanding: OutstandingItem[] = assignments
    .filter(a => !submittedAssignmentIds.has(a.id))
    .map(a => ({ subject: a.subject, title: a.title, dueDate: dueDateFor(a, student.id) }))
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate));

  // --- Marks: the overall average, per subject, and the recent list ---
  const marks = await storage.getMarksBySubmissionIds(submissions.map(s => s.id));

  let scored = 0;
  let available = 0;
  const bySubject = new Map<string, { scored: number; available: number; marked: number }>();
  const recent: RecentMark[] = [];

  for (const submission of submissions) {
    const mark = marks.get(submission.id);
    if (!mark) continue; // handed in but not marked yet — no score to report

    // The assignment may have been archived, and so be missing from the list
    // above. The mark is still real, so fetch it rather than dropping it.
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

    recent.push({
      subject: assignment.subject,
      title: assignment.title,
      score: mark.totalScore,
      outOf: assignment.totalMarks,
      // Safe to use ! here: totalMarks is above zero, so this is never null.
      percent: percentage(mark.totalScore, assignment.totalMarks)!,
      markedAt: new Date(mark.markedAt).toISOString(),
      // An empty comment box is the same as no feedback, and should not show
      // up as a blank note on the parent's page.
      feedback: mark.feedback && mark.feedback.trim() ? mark.feedback.trim() : null,
    });
  }

  // Newest marking first, then only as many as the page shows.
  recent.sort((a, b) => b.markedAt.localeCompare(a.markedAt));
  const recentMarks = recent.slice(0, RECENT_MARK_LIMIT);

  const subjects: SubjectAverage[] = [];
  // Array.from keeps this working under the project's TypeScript target,
  // which does not allow iterating a Map directly.
  for (const [subject, row] of Array.from(bySubject.entries())) {
    const pct = percentage(row.scored, row.available);
    if (pct !== null) subjects.push({ subject, averagePercent: pct, marked: row.marked });
  }
  // Best first. Ties fall back to the subject name so the page always reads
  // the same way rather than shuffling between requests.
  subjects.sort((a, b) =>
    b.averagePercent - a.averagePercent || a.subject.localeCompare(b.subject),
  );

  // --- Days active on homework (NOT school attendance) ---
  // The portal keeps no attendance register, so the honest figure is the
  // number of distinct days recently that the child handed something in.
  const from = addDays(streakToday(), -27); // today plus the 27 days before it
  const activeDays = new Set(
    submissions
      .map(s => catDay(s.submittedAt))
      .filter(day => day >= from),
  );

  // --- School announcements ---
  // Their class's notices plus the ones addressed to everybody. Already sorted
  // urgent-first, newest-first by storage.
  const announcements = await storage.getAnnouncements(student.form);

  return {
    child: { id: student.id, fullName: student.fullName, form: student.form },
    averagePercent: percentage(scored, available),
    subjects,
    recentMarks,
    homework: {
      assigned: assignments.length,
      completed,
      outstanding,
    },
    attendance: {
      recorded: false,
      daysActiveLast4Weeks: activeDays.size,
    },
    announcements: announcements.slice(0, ANNOUNCEMENT_LIMIT).map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority || "normal",
      createdAt: new Date(a.createdAt).toISOString(),
    })),
  };
}
