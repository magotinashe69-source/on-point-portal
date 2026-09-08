// Gathering the figures for the parent's view of their child's finished work.
//
// The shapes and the wording live in shared/parent-work.ts. This file is the
// part that reads the database.
//
// Three things to keep in mind:
//
//  1. Every builder here is GIVEN a Student the caller has already proved
//     belongs to the parent asking. No builder looks up a child itself, so
//     there is no id in this file for anyone to tamper with. The checking is
//     done once, in the route (requireParent / requireParentSubmission).
//
//  2. The correct answer a parent sees comes from markAnswer() in
//     shared/auto-marking.ts — the very same function that marked the work.
//     Writing out the answer key a second time here would let the two drift,
//     and a parent would eventually be shown an "answer" the marker never
//     used.
//
//  3. Percentages use the SAME formula as everywhere else (total scored over
//     total available), imported from server/weekly-report.ts rather than
//     copied, so a parent and a teacher quoting a figure see the same number.

import { storage } from "./storage";
import { percentage } from "./weekly-report";
import { markAnswer } from "@shared/auto-marking";
import type {
  CompletedWorkItem,
  PractiseTopic,
  QuestionOutcome,
  ReviewedQuestion,
  SubjectSupport,
  SubmissionReview,
  SupportReport,
} from "@shared/parent-work";
import type { Student, Submission } from "@shared/schema";

/** How many topics we name per subject. A list longer than this is a wall. */
const TOPICS_PER_SUBJECT = 6;

/** The child's name and class, the same small shape every parent view uses. */
function childSummary(student: Student) {
  return { id: student.id, fullName: student.fullName, form: student.form };
}

/**
 * Everything the child has handed in, newest first.
 *
 * Handed in is not the same as marked: a piece waiting on the teacher is
 * listed with no score rather than being hidden or shown as zero.
 */
export async function buildCompletedWork(student: Student): Promise<CompletedWorkItem[]> {
  const submissions = await storage.getSubmissions({ studentId: student.id });
  const marks = await storage.getMarksBySubmissionIds(submissions.map(s => s.id));

  const items: CompletedWorkItem[] = [];

  for (const submission of submissions) {
    // Read the assignment one at a time rather than filtering a class-wide
    // list: a piece the teacher has since archived is still the child's work
    // and must not vanish from their parent's list.
    const assignment = await storage.getAssignment(submission.assignmentId);
    if (!assignment) continue; // the assignment is gone; nothing to show

    const mark = marks.get(submission.id);

    items.push({
      submissionId: submission.id,
      subject: assignment.subject,
      title: assignment.title,
      submittedAt: new Date(submission.submittedAt).toISOString(),
      marked: !!mark,
      score: mark ? mark.totalScore : null,
      outOf: assignment.totalMarks,
      percent: mark ? percentage(mark.totalScore, assignment.totalMarks) : null,
    });
  }

  items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return items;
}

/** Right, partly right, or not yet — from the marks, not from guesswork. */
function outcomeFor(score: number | null, maxScore: number): QuestionOutcome {
  if (score === null) return "not_marked";
  if (maxScore > 0 && score >= maxScore) return "correct";
  if (score > 0) return "partly";
  return "incorrect";
}

/**
 * One piece of work, opened up question by question.
 *
 * The submission passed in has already been checked against the parent's own
 * child by the route, so this only has to build the picture.
 */
export async function buildSubmissionReview(
  student: Student,
  submission: Submission,
): Promise<SubmissionReview | null> {
  const assignment = await storage.getAssignment(submission.assignmentId);
  if (!assignment) return null;

  const mark = await storage.getMark(submission.id);

  // Look-ups by question id, so a question the child skipped still appears in
  // the list with "no answer given" rather than dropping out of the paper.
  const answerFor = new Map(submission.answers.map(a => [a.questionId, a]));
  const markFor = new Map((mark?.questionMarks || []).map(m => [m.questionId, m]));

  const questions: ReviewedQuestion[] = assignment.questions.map((question, index) => {
    const answer = answerFor.get(question.id);
    const questionMark = markFor.get(question.id);

    const answerText = (answer?.answerText || "").trim();
    const answeredWithPhoto = !answerText && !!answer?.imageUrls?.length;

    // The correct answer, straight from the marking engine. For a hand-marked
    // "written" question it comes back empty, because the school has no model
    // answer stored for one — the page says so rather than pretending.
    const key = markAnswer(question, answer?.answerText ?? "");
    const correctAnswer = key.correctAnswerDisplay || null;

    const score = questionMark ? questionMark.score : null;
    const maxScore = questionMark?.maxScore ?? question.maxScore;

    // A multiple-choice answer is stored as the option's number, which would
    // read as a bare "2" to a parent. Show them the option itself.
    let childAnswer: string | null = answerText || null;
    if (childAnswer && question.type === "multiple_choice") {
      const chosen = question.options?.[Number(childAnswer)];
      if (chosen) childAnswer = chosen;
    }

    return {
      number: index + 1,
      questionText: question.questionText,
      childAnswer,
      answeredWithPhoto,
      correctAnswer,
      outcome: outcomeFor(score, maxScore),
      score,
      maxScore,
      teacherComment:
        questionMark?.feedback && questionMark.feedback.trim()
          ? questionMark.feedback.trim()
          : null,
      explanation: question.explanation?.trim() || null,
    };
  });

  return {
    child: childSummary(student),
    submissionId: submission.id,
    subject: assignment.subject,
    topic: assignment.topic?.trim() || null,
    title: assignment.title,
    submittedAt: new Date(submission.submittedAt).toISOString(),
    marked: !!mark,
    score: mark ? mark.totalScore : null,
    outOf: assignment.totalMarks,
    percent: mark ? percentage(mark.totalScore, assignment.totalMarks) : null,
    teacherFeedback: mark?.feedback && mark.feedback.trim() ? mark.feedback.trim() : null,
    questions,
  };
}

/**
 * What the child is finding hard, framed as what to practise.
 *
 * Every question they did not get full marks on is counted against a topic —
 * the teacher's topic when they set one, otherwise the assignment's title —
 * and the topics are grouped by subject, most-missed first. That turns a term
 * of marks into "practise: fractions, photosynthesis", which is something a
 * parent can actually sit down and do.
 */
export async function buildSupportReport(student: Student): Promise<SupportReport> {
  const submissions = await storage.getSubmissions({ studentId: student.id });
  const marks = await storage.getMarksBySubmissionIds(submissions.map(s => s.id));

  // subject -> topic -> how many questions are not yet right
  const missedBySubject = new Map<string, Map<string, number>>();
  // subject -> the running totals its average is worked out from
  const totals = new Map<string, { scored: number; available: number }>();
  let questionsReviewed = 0;

  for (const submission of submissions) {
    const mark = marks.get(submission.id);
    if (!mark) continue; // not marked yet, so nothing to learn from it

    const assignment = await storage.getAssignment(submission.assignmentId);
    if (!assignment) continue;

    // The topic the teacher set is the useful name. Without one, the title of
    // the piece is the next best thing a parent can look up in a book.
    const topic = assignment.topic?.trim() || assignment.title;

    const subjectTotal = totals.get(assignment.subject) || { scored: 0, available: 0 };
    subjectTotal.scored += mark.totalScore;
    subjectTotal.available += assignment.totalMarks;
    totals.set(assignment.subject, subjectTotal);

    for (const questionMark of mark.questionMarks || []) {
      questionsReviewed += 1;
      // Full marks means there is nothing to practise here.
      if (questionMark.maxScore > 0 && questionMark.score >= questionMark.maxScore) continue;

      const byTopic = missedBySubject.get(assignment.subject) || new Map<string, number>();
      byTopic.set(topic, (byTopic.get(topic) || 0) + 1);
      missedBySubject.set(assignment.subject, byTopic);
    }
  }

  // --- Subject averages, and from them the strongest and the hardest ---
  const averages: Array<{ subject: string; averagePercent: number }> = [];
  // Array.from keeps this working under the project's TypeScript target,
  // which does not allow iterating a Map directly.
  for (const [subject, row] of Array.from(totals.entries())) {
    const pct = percentage(row.scored, row.available);
    if (pct !== null) averages.push({ subject, averagePercent: pct });
  }
  averages.sort((a, b) =>
    b.averagePercent - a.averagePercent || a.subject.localeCompare(b.subject),
  );

  // Only name a strongest and a hardest when there are two or more subjects to
  // compare — the same rule the weekly report follows. With one subject there
  // is no "weakest", and saying so would be nonsense.
  const strongest = averages.length >= 2 ? averages[0] : null;
  const workingOn = averages.length >= 2 ? averages[averages.length - 1] : null;

  // --- The practise lists ---
  const subjects: SubjectSupport[] = [];
  for (const [subject, byTopic] of Array.from(missedBySubject.entries())) {
    const topics: PractiseTopic[] = Array.from(byTopic.entries())
      .map(([topic, missed]) => ({ topic, missed }))
      // Most-missed first, then by name so the list never reshuffles between
      // two requests that say the same thing.
      .sort((a, b) => b.missed - a.missed || a.topic.localeCompare(b.topic))
      .slice(0, TOPICS_PER_SUBJECT);

    subjects.push({
      subject,
      averagePercent: averages.find(a => a.subject === subject)?.averagePercent ?? null,
      topics,
    });
  }

  // The subject with the most to practise reads first.
  subjects.sort((a, b) => {
    const aMissed = a.topics.reduce((sum, t) => sum + t.missed, 0);
    const bMissed = b.topics.reduce((sum, t) => sum + t.missed, 0);
    return bMissed - aMissed || a.subject.localeCompare(b.subject);
  });

  return {
    child: childSummary(student),
    strongest,
    workingOn,
    subjects,
    questionsReviewed,
  };
}
