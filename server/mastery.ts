// Gathering the figures for a child's mastery map.
//
// The rules and the wording live in shared/mastery.ts. This file only reads.
//
// Three things to keep in mind:
//
//  1. It changes NOTHING about marking. It reads marks that were written when
//     the work was handed in, months ago in some cases, and groups them. No
//     question is re-marked and no score is recalculated.
//
//  2. A question's topic is resolved HERE, because only this file can see both
//     the question and the assignment it came from. The question's own topic
//     wins; the assignment's topic is the fallback; neither means the question
//     is not a skill and is left out.
//
//  3. It is given a Student the caller has already proved the asker may see.
//     It never looks a child up itself.

import { storage } from "./storage";
import {
  buildMasteryMap, buildClassMasteryMap,
  type AnsweredQuestion, type ChildMastery, type ClassMastery, type MasteryMap,
} from "@shared/mastery";
import type { Assignment, Mark, Student, Submission } from "@shared/schema";

/**
 * Turn one child's marked work into the questions mastery cares about.
 *
 * Given the data rather than fetching it, so the SAME reduction serves one
 * child and a whole class. That matters more than saving a few lines: a
 * teacher's figure for a topic and the child's own figure for it must be the
 * same number, and the surest way to guarantee that is to have one definition
 * of what counts and where its topic comes from.
 *
 * Handed in but not yet marked is deliberately absent: there is no score to
 * read, and guessing one would be inventing data. It appears on the map as soon
 * as the teacher marks it.
 */
export function answeredFrom(
  submissions: Submission[],
  marks: Map<number, Mark>,
  assignmentById: Map<number, Assignment>,
): AnsweredQuestion[] {
  const out: AnsweredQuestion[] = [];

  for (const submission of submissions) {
    const mark = marks.get(submission.id);
    if (!mark) continue; // handed in, not marked yet — nothing to read

    const assignment = assignmentById.get(submission.assignmentId);
    if (!assignment) continue; // the paper has been deleted outright

    // The questions as they were SET, so each mark can be matched to what it
    // was actually for.
    const questions = (assignment.questions || []) as Array<{ id: string; topic?: string }>;
    const questionById = new Map(questions.map((q) => [q.id, q]));

    for (const qm of mark.questionMarks || []) {
      const question = questionById.get(qm.questionId);

      // A mark for a question that is no longer on the paper — the teacher
      // edited it after marking. There is no way to know what it was about, so
      // it cannot be a skill.
      if (!question) continue;

      out.push({
        subject: assignment.subject,
        // The question's own topic first, the assignment's second, neither
        // third. See the note at the top of shared/mastery.ts.
        topic: question.topic?.trim() || assignment.topic?.trim() || null,
        scored: qm.score ?? 0,
        available: qm.maxScore ?? 0,
      });
    }
  }

  return out;
}

/** Build the mastery map for one child. */
export async function buildMastery(student: Student): Promise<MasteryMap> {
  const submissions = await storage.getSubmissions({ studentId: student.id });
  if (submissions.length === 0) return buildMasteryMap([]);

  const marks = await storage.getMarksBySubmissionIds(submissions.map((s) => s.id));

  // Fetched one by one and cached. An archived assignment is missing from the
  // list view, but its marks are still real and still count towards what a
  // child can do.
  const assignmentById = new Map<number, Assignment>();
  for (const s of submissions) {
    if (assignmentById.has(s.assignmentId)) continue;
    const a = await storage.getAssignment(s.assignmentId);
    if (a) assignmentById.set(s.assignmentId, a);
  }

  return buildMasteryMap(answeredFrom(submissions, marks, assignmentById));
}

/**
 * Build the class picture for one form.
 *
 * Read in BULK — the register, every submission, their marks, and the
 * assignments behind them — then worked out per child in memory. Calling
 * buildMastery() thirty times would be ninety round trips for one page.
 *
 * Each child's map is built by the same buildMasteryMap() their own dashboard
 * uses, from the same answeredFrom() reduction, so a teacher and a child can
 * never be looking at different numbers for the same topic.
 */
export async function buildClassMastery(form: string): Promise<ClassMastery> {
  const students = await storage.getStudentsByForm(form);
  if (students.length === 0) return buildClassMasteryMap(form, []);

  const studentIds = new Set(students.map((s) => s.id));

  // Every submission on the system, kept down to this class's children. One
  // read rather than one per child.
  const allSubmissions = await storage.getSubmissions();
  const mine = allSubmissions.filter((s) => studentIds.has(s.studentId));
  if (mine.length === 0) {
    return buildClassMasteryMap(form, students.map((s) => ({
      studentId: s.id, fullName: s.fullName, map: buildMasteryMap([]),
    })));
  }

  const marks = await storage.getMarksBySubmissionIds(mine.map((s) => s.id));

  // Active AND archived: a mark on an archived paper is still real, and still
  // says what a child can do.
  const [active, archived] = await Promise.all([
    storage.getAssignments(form, undefined, false),
    storage.getAssignments(form, undefined, true),
  ]);
  const assignmentById = new Map<number, Assignment>();
  for (const a of [...active, ...archived]) assignmentById.set(a.id, a);

  // A child may have been moved between classes, so a submission can point at
  // an assignment set for another form. Fetch those few individually rather
  // than dropping the marks, which would silently thin their map.
  for (const s of mine) {
    if (assignmentById.has(s.assignmentId)) continue;
    const a = await storage.getAssignment(s.assignmentId);
    if (a) assignmentById.set(s.assignmentId, a);
  }

  const submissionsByStudent = new Map<number, Submission[]>();
  for (const s of mine) {
    const list = submissionsByStudent.get(s.studentId) ?? [];
    list.push(s);
    submissionsByStudent.set(s.studentId, list);
  }

  const children: ChildMastery[] = students.map((student) => ({
    studentId: student.id,
    fullName: student.fullName,
    map: buildMasteryMap(
      answeredFrom(submissionsByStudent.get(student.id) ?? [], marks, assignmentById),
    ),
  }));

  return buildClassMasteryMap(form, children);
}
