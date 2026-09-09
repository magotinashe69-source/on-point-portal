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
import { buildMasteryMap, type AnsweredQuestion, type MasteryMap } from "@shared/mastery";
import type { Assignment, Student } from "@shared/schema";

/**
 * Every question this child has answered AND had marked, reduced to what
 * mastery cares about.
 *
 * Handed in but not yet marked is deliberately absent: there is no score to
 * read, and guessing one would be inventing data. It appears on the map as
 * soon as the teacher marks it.
 */
async function answeredQuestions(student: Student): Promise<AnsweredQuestion[]> {
  const submissions = await storage.getSubmissions({ studentId: student.id });
  if (submissions.length === 0) return [];

  const marks = await storage.getMarksBySubmissionIds(submissions.map((s) => s.id));

  // The assignments behind those submissions. Fetched one by one and cached,
  // because an archived assignment is missing from the list view but its marks
  // are still real and still count towards what a child can do.
  const assignmentCache = new Map<number, Assignment | undefined>();
  const assignmentFor = async (id: number) => {
    if (!assignmentCache.has(id)) assignmentCache.set(id, await storage.getAssignment(id));
    return assignmentCache.get(id);
  };

  const out: AnsweredQuestion[] = [];

  for (const submission of submissions) {
    const mark = marks.get(submission.id);
    if (!mark) continue; // handed in, not marked yet — nothing to read

    const assignment = await assignmentFor(submission.assignmentId);
    if (!assignment) continue; // the paper has been deleted outright

    // The questions as they were SET, so each mark can be matched to what it
    // was actually for.
    const questions = (assignment.questions || []) as Array<{
      id: string;
      topic?: string;
    }>;
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
  return buildMasteryMap(await answeredQuestions(student));
}
