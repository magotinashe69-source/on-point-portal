// Report cards — assembling a term's marks into a printable page.
//
// The rules and the wording are in shared/report-card.ts. This file reads.
//
// It changes NOTHING. No mark is recalculated, no score altered, no assignment
// touched. A report card is a statement about work that has already been done,
// so producing one must not be able to change what it reports.
//
// A WHOLE CLASS AT ONCE, always. Even a single child's card needs the class
// average beside their own, which means reading every child's marks anyway — so
// the class is built in one pass and one card is picked out of it. Doing it per
// child would read the same marks once per child.

import { storage } from "./storage";
import { catDay } from "./weekly-report";
import {
  DEFAULT_BOUNDARIES, gradeFor, sortBoundaries,
  type GradeBoundary, type ReportCard, type SubjectReport,
} from "@shared/report-card";
import type { Assignment, Student } from "@shared/schema";

/** The school's boundaries, or the Cambridge defaults until they set their own. */
export async function boundaries(): Promise<GradeBoundary[]> {
  const row = await storage.getReportSettings();
  const stored = row?.boundaries as GradeBoundary[] | undefined;
  return stored && stored.length > 0 ? sortBoundaries(stored) : sortBoundaries(DEFAULT_BOUNDARIES);
}

function percentOf(scored: number, available: number): number | null {
  if (available <= 0) return null;
  return Math.round((scored / available) * 100);
}

/**
 * A term's key: its name AND its dates.
 *
 * Two terms called "Term 1" in different years are different terms, and a
 * comment written for one must not appear on the other's card.
 */
export function termKeyFor(label: string, from: string, to: string): string {
  return `${label.trim()}|${from}|${to}`;
}

interface Totals { scored: number; available: number; marked: number }

/**
 * Build a report card for every child in a class, for one term.
 *
 * Read in bulk — the register, every submission, their marks, and the
 * assignments behind them — then totalled per child and per subject in memory.
 */
export async function buildClassReportCards(
  form: string,
  term: { label: string; from: string; to: string },
): Promise<ReportCard[]> {
  const students = await storage.getStudentsByForm(form);
  if (students.length === 0) return [];

  const studentIds = new Set(students.map((s) => s.id));
  const grades = await boundaries();
  const key = termKeyFor(term.label, term.from, term.to);

  const [allSubmissions, comments] = await Promise.all([
    storage.getSubmissions(),
    storage.getReportComments(students.map((s) => s.id), key),
  ]);
  const mine = allSubmissions.filter((s) => studentIds.has(s.studentId));
  const marks = mine.length > 0
    ? await storage.getMarksBySubmissionIds(mine.map((s) => s.id))
    : new Map();

  // Active AND archived: a mark on an archived paper still counts towards the
  // term it was earned in.
  const [active, archived] = await Promise.all([
    storage.getAssignments(form, undefined, false),
    storage.getAssignments(form, undefined, true),
  ]);
  const assignmentById = new Map<number, Assignment>();
  for (const a of [...active, ...archived]) assignmentById.set(a.id, a);
  // A child moved between classes can have work set for another form. Fetch
  // those rather than dropping the marks, which would understate their term.
  for (const s of mine) {
    if (assignmentById.has(s.assignmentId)) continue;
    const a = await storage.getAssignment(s.assignmentId);
    if (a) assignmentById.set(s.assignmentId, a);
  }

  // Per child per subject, and the class totals beside them.
  const perChild = new Map<number, Map<string, Totals>>();
  const perClass = new Map<string, Totals & { children: Set<number> }>();
  const daysActive = new Map<number, Set<string>>();
  for (const s of students) perChild.set(s.id, new Map());

  for (const submission of mine) {
    const mark = marks.get(submission.id);
    if (!mark) continue; // handed in, not marked — no figure for a report

    const assignment = assignmentById.get(submission.assignmentId);
    if (!assignment || assignment.totalMarks <= 0) continue;

    // The term is decided by when the work was HANDED IN, not when it was
    // marked — marking date depends on when a teacher got to it, which is not
    // something a child's term should hinge on.
    const day = catDay(submission.submittedAt);
    if (day < term.from || day > term.to) continue;

    const bySubject = perChild.get(submission.studentId);
    if (!bySubject) continue;

    const row = bySubject.get(assignment.subject) ?? { scored: 0, available: 0, marked: 0 };
    row.scored += mark.totalScore;
    row.available += assignment.totalMarks;
    row.marked += 1;
    bySubject.set(assignment.subject, row);

    const cls = perClass.get(assignment.subject)
      ?? { scored: 0, available: 0, marked: 0, children: new Set<number>() };
    cls.scored += mark.totalScore;
    cls.available += assignment.totalMarks;
    cls.marked += 1;
    cls.children.add(submission.studentId);
    perClass.set(assignment.subject, cls);

    const days = daysActive.get(submission.studentId) ?? new Set<string>();
    days.add(day);
    daysActive.set(submission.studentId, days);
  }

  // The class's overall figure, for the line under the table.
  const classScored = Array.from(perClass.values()).reduce((n, r) => n + r.scored, 0);
  const classAvailable = Array.from(perClass.values()).reduce((n, r) => n + r.available, 0);
  const classOverall = percentOf(classScored, classAvailable);

  const commentFor = new Map(comments.map((c) => [c.studentId, c.comment]));
  const issuedAt = new Date().toISOString();

  return students.map((student: Student) => {
    const bySubject = perChild.get(student.id) ?? new Map<string, Totals>();

    // Every subject the CLASS was marked in, so a child with nothing in one
    // still shows a line for it. A missing row would read as "not taught"
    // rather than "nothing marked", and the class average beside it is the
    // useful part either way.
    const subjectNames = Array.from(new Set([
      ...Array.from(bySubject.keys()),
      ...Array.from(perClass.keys()),
    ])).sort();

    const subjects: SubjectReport[] = subjectNames.map((subject) => {
      const own = bySubject.get(subject);
      const cls = perClass.get(subject);
      const percent = own ? percentOf(own.scored, own.available) : null;
      return {
        subject,
        percent,
        grade: percent === null ? null : gradeFor(percent, grades),
        marked: own?.marked ?? 0,
        classPercent: cls ? percentOf(cls.scored, cls.available) : null,
        classChildren: cls?.children.size ?? 0,
      };
    });

    const scored = Array.from(bySubject.values()).reduce((n, r) => n + r.scored, 0);
    const available = Array.from(bySubject.values()).reduce((n, r) => n + r.available, 0);
    const overallPercent = percentOf(scored, available);

    return {
      student: {
        id: student.id,
        fullName: student.fullName,
        pupilId: student.studentId,
        form: student.form,
      },
      term,
      subjects,
      overallPercent,
      overallGrade: overallPercent === null ? null : gradeFor(overallPercent, grades),
      classOverallPercent: classOverall,
      attendance: {
        // The portal keeps no attendance register. See shared/report-card.ts —
        // this is days the child handed work in, and the card says so.
        recorded: false as const,
        daysActive: daysActive.get(student.id)?.size ?? 0,
        schoolDays: null,
      },
      comment: commentFor.get(student.id) ?? null,
      boundaries: grades,
      issuedAt,
    };
  });
}

/** One child's card, built from the class pass so the comparison is real. */
export async function buildReportCard(
  student: Student,
  term: { label: string; from: string; to: string },
): Promise<ReportCard | null> {
  const cards = await buildClassReportCards(student.form, term);
  return cards.find((c) => c.student.id === student.id) ?? null;
}
