// Most Improved — ranking a class by how far each child moved in a subject.
//
// The teacher's one hand-run certificate. Reads marks only; changes nothing.
//
// Percentages are marks scored over marks available, the SAME formula the
// weekly report, the Reports page, the Grade Book, the parent overview and the
// mastery map all use. A certificate quoting a figure a teacher cannot find
// anywhere else in the app would be worse than no certificate.

import { storage } from "./storage";
import { catDay } from "./weekly-report";
import { rankByImprovement, type ImprovementRow } from "@shared/certificates";
import type { Assignment } from "@shared/schema";

function percentOf(scored: number, available: number): number | null {
  if (available <= 0) return null;
  return Math.round((scored / available) * 100);
}

/**
 * How every child in a class moved in one subject, between two periods.
 *
 * The periods are inclusive YYYY-MM-DD ranges in CAT, taken from the day the
 * work was HANDED IN — not the day it was marked, which depends on when a
 * teacher got to it rather than on the child.
 *
 * A child with no marked work in one of the periods gets a null change. They
 * stay in the list so a teacher can see why they are not a candidate, but
 * rankByImprovement never puts them above somebody who actually improved.
 */
export async function improvementFor(
  form: string,
  subject: string,
  before: { from: string; to: string },
  after: { from: string; to: string },
): Promise<ImprovementRow[]> {
  const students = await storage.getStudentsByForm(form);
  if (students.length === 0) return [];

  const studentIds = new Set(students.map((s) => s.id));

  // Read in bulk: the register, every submission, their marks, and the
  // assignments behind them.
  const allSubmissions = await storage.getSubmissions();
  const mine = allSubmissions.filter((s) => studentIds.has(s.studentId));
  const marks = mine.length > 0
    ? await storage.getMarksBySubmissionIds(mine.map((s) => s.id))
    : new Map();

  const [active, archived] = await Promise.all([
    storage.getAssignments(form, undefined, false),
    storage.getAssignments(form, undefined, true),
  ]);
  const assignmentById = new Map<number, Assignment>();
  for (const a of [...active, ...archived]) assignmentById.set(a.id, a);
  // A child moved between classes can have work set for another form; fetch
  // those rather than dropping the marks, which would understate them.
  for (const s of mine) {
    if (assignmentById.has(s.assignmentId)) continue;
    const a = await storage.getAssignment(s.assignmentId);
    if (a) assignmentById.set(s.assignmentId, a);
  }

  const totals = new Map<number, {
    beforeScored: number; beforeAvailable: number; beforeMarked: number;
    afterScored: number; afterAvailable: number; afterMarked: number;
  }>();
  for (const s of students) {
    totals.set(s.id, {
      beforeScored: 0, beforeAvailable: 0, beforeMarked: 0,
      afterScored: 0, afterAvailable: 0, afterMarked: 0,
    });
  }

  for (const submission of mine) {
    const mark = marks.get(submission.id);
    if (!mark) continue; // handed in, not marked — no figure to compare

    const assignment = assignmentById.get(submission.assignmentId);
    if (!assignment || assignment.subject !== subject || assignment.totalMarks <= 0) continue;

    const day = catDay(submission.submittedAt);
    const row = totals.get(submission.studentId);
    if (!row) continue;

    if (day >= before.from && day <= before.to) {
      row.beforeScored += mark.totalScore;
      row.beforeAvailable += assignment.totalMarks;
      row.beforeMarked += 1;
    } else if (day >= after.from && day <= after.to) {
      row.afterScored += mark.totalScore;
      row.afterAvailable += assignment.totalMarks;
      row.afterMarked += 1;
    }
  }

  const rows: ImprovementRow[] = students.map((student) => {
    const t = totals.get(student.id)!;
    const beforePercent = percentOf(t.beforeScored, t.beforeAvailable);
    const afterPercent = percentOf(t.afterScored, t.afterAvailable);
    return {
      studentId: student.id,
      fullName: student.fullName,
      pupilId: student.studentId,
      beforePercent,
      afterPercent,
      changePercent: beforePercent !== null && afterPercent !== null
        ? afterPercent - beforePercent
        : null,
      beforeMarked: t.beforeMarked,
      afterMarked: t.afterMarked,
    };
  });

  return rankByImprovement(rows);
}
