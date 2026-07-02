// Auto-marking engine.
//
// This file marks a student's answers against the teacher's answer key,
// instantly and in plain code (no AI). It is a "pure" module: every function
// just turns inputs into outputs with no database or network access, so it is
// easy to test and safe to reuse on both the server and the client.
//
// A question is only auto-marked when its `type` is one of the four supported
// types below. Questions with no type (or type "written") are left for the
// teacher to mark by hand, exactly as before.

import type { Assignment, Submission } from "./schema";

// A single question, taken straight from an assignment. Using the assignment's
// own type keeps this in sync with the database schema automatically.
export type Question = Assignment["questions"][number];

// A single answer, taken straight from a submission.
export type Answer = Submission["answers"][number];

// The four question types the engine can mark on its own.
export const AUTO_TYPES = ["multiple_choice", "true_false", "numeric", "short_text"] as const;
export type AutoType = (typeof AUTO_TYPES)[number];

// The result of marking one question.
export interface QuestionResult {
  questionId: string;
  correct: boolean;
  score: number;        // marks earned (maxScore if correct, else 0)
  maxScore: number;     // marks the question was worth
  // A human-readable version of the correct answer, for the feedback screen
  // (e.g. the correct option text, "True", "3.14", or the first accepted answer).
  correctAnswerDisplay: string;
  explanation?: string; // the teacher's one-line note, if any
}

// True when a single question can be marked automatically.
export function isAutoMarkable(q: Pick<Question, "type">): boolean {
  return !!q.type && (AUTO_TYPES as readonly string[]).includes(q.type);
}

// True when EVERY question in an assignment can be marked automatically.
// We only auto-mark an assignment when all of its questions are auto-markable;
// if it mixes in a hand-marked "written" question, we leave it for the teacher.
export function isFullyAutoMarked(questions: Question[]): boolean {
  return questions.length > 0 && questions.every(isAutoMarkable);
}

// Tidy up text so small differences don't count as wrong:
// trim the ends, collapse runs of spaces into one, and lower-case it.
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

// Mark one answer against one question's answer key.
export function markAnswer(question: Question, answerText: string): QuestionResult {
  const raw = (answerText ?? "").trim();

  // Everything shares these defaults; each type below fills in the specifics.
  const base = {
    questionId: question.id,
    maxScore: question.maxScore,
    explanation: question.explanation,
  };

  let correct = false;
  let correctAnswerDisplay = "";

  switch (question.type) {
    case "multiple_choice": {
      const options = question.options ?? [];
      const correctIndex = question.correctOption;
      correctAnswerDisplay =
        correctIndex != null ? options[correctIndex] ?? "" : "";
      // Students submit the chosen option's index as text, e.g. "2".
      correct = raw !== "" && Number(raw) === correctIndex;
      break;
    }

    case "true_false": {
      correctAnswerDisplay = question.correctBool ? "True" : "False";
      // Students submit "true" or "false".
      correct = raw.toLowerCase() === String(question.correctBool);
      break;
    }

    case "numeric": {
      correctAnswerDisplay =
        question.correctNumber != null ? String(question.correctNumber) : "";
      const value = parseFloat(raw);
      const tolerance = question.tolerance ?? 0; // 0 means an exact match
      correct =
        raw !== "" &&
        !Number.isNaN(value) &&
        question.correctNumber != null &&
        Math.abs(value - question.correctNumber) <= tolerance;
      break;
    }

    case "short_text": {
      const accepted = question.acceptedAnswers ?? [];
      correctAnswerDisplay = accepted[0] ?? "";
      // Any accepted answer counts, comparing without case or extra spaces.
      correct =
        raw !== "" &&
        accepted.some((a) => normalizeText(a) === normalizeText(raw));
      break;
    }

    default:
      // "written" or unknown: not auto-marked. Return 0 with no correct answer;
      // a teacher will mark this by hand.
      return { ...base, correct: false, score: 0, correctAnswerDisplay: "" };
  }

  return {
    ...base,
    correct,
    score: correct ? question.maxScore : 0,
    correctAnswerDisplay,
  };
}

// Mark a whole submission: match each question to its answer, mark it, and add
// up the scores. Returns the per-question results and the total.
export function markSubmission(
  questions: Question[],
  answers: Answer[],
): { results: QuestionResult[]; totalScore: number } {
  const results = questions.map((question) => {
    const answer = answers.find((a) => a.questionId === question.id);
    return markAnswer(question, answer?.answerText ?? "");
  });

  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  return { results, totalScore };
}

// Build the short feedback line a student sees for one question.
// Correct → a tick message; wrong → the right answer plus the explanation.
export function buildFeedback(result: QuestionResult): string {
  if (result.correct) {
    return result.explanation ? `Correct! ${result.explanation}` : "Correct!";
  }
  const parts: string[] = [];
  if (result.correctAnswerDisplay) {
    parts.push(`Correct answer: ${result.correctAnswerDisplay}.`);
  } else {
    parts.push("Not quite.");
  }
  if (result.explanation) parts.push(result.explanation);
  return parts.join(" ");
}
