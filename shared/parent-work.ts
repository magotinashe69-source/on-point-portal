// The parent's view of their child's finished work.
//
// Three things live here, and they are the three things a teacher goes through
// with a parent on consultation day:
//
//   1. Completed work  — everything the child has handed in, with the mark.
//   2. One piece of work, question by question — what the child wrote, what
//      the right answer was, whether it was right, and what the teacher said.
//   3. Areas to practise — the topics the child keeps getting wrong, grouped
//      by subject, so a parent knows what to sit down and go over.
//
// Like shared/weekly-report.ts and shared/parent-overview.ts, this file holds
// only the SHAPES and the WORDING. No database access, so it is easy to read
// and the figures are gathered in one place (server/parent-work.ts).
//
// Everything here is read-only by design. There is nothing in these shapes a
// parent could send back to change anything.

// --- Completed work -------------------------------------------------------

/** One piece of work the child has handed in. */
export type CompletedWorkItem = {
  // The parent taps a row to open it, and this is the only id in the whole
  // parent portal that travels in an address. The server checks it belongs to
  // their child before answering — see requireParentSubmission in routes.ts.
  submissionId: number;
  subject: string;
  title: string;
  submittedAt: string; // ISO date-time
  // Handed in is not the same as marked. A child can be waiting on their
  // teacher, and saying "not marked yet" is honest where a 0% would not be.
  marked: boolean;
  score: number | null;
  outOf: number;
  percent: number | null;
};

// --- One piece of work, question by question ------------------------------

/**
 * How one question went.
 *
 * Not just right or wrong: a hand-marked question can earn 3 out of 5, and
 * calling that "wrong" would be untrue and discouraging. "partly" is that
 * middle ground. "not_marked" means the teacher has not looked at it yet.
 */
export type QuestionOutcome = "correct" | "partly" | "incorrect" | "not_marked";

/** One question as a parent reads it. */
export type ReviewedQuestion = {
  number: number; // 1, 2, 3… as the child saw them
  questionText: string;

  // What the child wrote. Null when they left it blank; the photo note covers
  // handwritten work handed in as a picture.
  childAnswer: string | null;
  answeredWithPhoto: boolean;

  // The right answer, when the school has one written down.
  //
  // Two different things can end up here, and the page must not present them
  // the same way:
  //
  //   "key"   — the exact answer the marking engine used, from an auto-marked
  //             question. Anything else was wrong.
  //   "model" — the teacher's own model answer to a written question. It is an
  //             example of a good answer, NOT the only right one, and a child
  //             who wrote something different may still have full marks.
  //
  // Null when neither exists: a written question the teacher marked by hand
  // without writing a model answer. The page says so rather than inventing one.
  correctAnswer: string | null;
  correctAnswerKind: "key" | "model" | null;

  outcome: QuestionOutcome;
  score: number | null; // null until it has been marked
  maxScore: number;

  teacherComment: string | null; // what the teacher wrote on this question
  explanation: string | null;    // the note stored with the answer key
};

/** One whole piece of work, opened up. */
export type SubmissionReview = {
  child: { id: number; fullName: string; form: string };
  submissionId: number;
  subject: string;
  topic: string | null;
  title: string;
  submittedAt: string;

  marked: boolean;
  score: number | null;
  outOf: number;
  percent: number | null;
  teacherFeedback: string | null; // the overall comment on the whole piece

  questions: ReviewedQuestion[];
};

// --- Areas to practise ----------------------------------------------------

/** One thing worth going over again. */
export type PractiseTopic = {
  // The assignment's topic when the teacher set one ("Fractions"), otherwise
  // the assignment's title, which is the next most useful thing to name.
  topic: string;
  // How many questions on that topic are not yet fully right. Ordering by this
  // puts the thing that would help most at the top.
  missed: number;
};

/** One subject's areas to practise. */
export type SubjectSupport = {
  subject: string;
  averagePercent: number | null;
  topics: PractiseTopic[]; // most-missed first
};

export type SupportReport = {
  child: { id: number; fullName: string; form: string };

  // Best and hardest subject.
  //
  // Both stay null until TWO or more subjects have been marked — the same rule
  // the weekly report uses. With one subject there is no strongest or hardest,
  // and telling a parent their child's only subject is both would be nonsense.
  strongest: { subject: string; averagePercent: number } | null;
  workingOn: { subject: string; averagePercent: number } | null;

  // Only subjects that actually have something to practise.
  subjects: SubjectSupport[];

  // How many marked questions this report looked at, so a parent can see
  // whether it is based on one piece of work or a term's worth.
  questionsReviewed: number;
};

// --- Wording --------------------------------------------------------------
// Grouped here so the whole thing can be translated in one place.
//
// The tone matters as much as the figures. A parent reading this should come
// away with something to DO, not a list of their child's failures — so it is
// "areas to practise" and "working on", never "weaknesses" or "failed".

export const WORK_TEXT = {
  // Completed work
  completedTitle: "Completed work",
  completedNote: "Everything your child has handed in. Tap any piece to see it question by question.",
  completedEmpty: "Your child has not handed anything in yet.",
  notMarkedYet: "Not marked yet",
  handedIn: "Handed in",

  // One piece of work
  reviewNote: "This is the same thing a teacher would show you on consultation day.",
  yourChildsAnswer: "Your child's answer",
  correctAnswer: "Correct answer",
  modelAnswer: "What a good answer looks like",
  modelAnswerNote:
    "Your teacher's example. Your child's answer does not have to match it word for word — the mark above is what counts.",
  noAnswerGiven: "No answer given",
  answeredWithPhoto: "Answered with a photo of their written work",
  markedByTeacher: "Marked by your teacher",
  markedByTeacherNote:
    "This question was written out in full and marked by hand, so there is no single set answer to compare it with.",
  teacherComment: "Teacher's comment",
  overallFeedback: "Teacher's feedback on this piece",
  awaitingMarking: "Your child's teacher has not marked this yet.",

  outcomeCorrect: "Correct",
  outcomePartly: "Partly correct",
  outcomeIncorrect: "Not yet",
  outcomeNotMarked: "Not marked yet",

  // Areas to practise
  supportTitle: "Areas to practise",
  supportNote:
    "Everything here is something your child can get better at with a little practice. It is a plan for what to go over together, not a list of failures.",
  supportEmpty:
    "Nothing to practise just yet. Once your child's work has been marked, anything worth going over again will appear here.",
  supportAllCorrect:
    "There is nothing to practise at the moment — your child has got everything right in the work marked so far. Well done to them.",
  practise: "Practise",
  strongest: "Strongest subject",
  workingOn: "Working on",
  basedOn: "Based on",
  questionsMarked: "marked questions",

  // Shared
  back: "Back",
  readOnly: "This is a view-only account. You can see your child's work but not change it.",
} as const;

/** "Practise: fractions, photosynthesis" — the one-line version of a subject. */
export function practiseLine(topics: PractiseTopic[]): string {
  return topics.map(t => t.topic).join(", ");
}
