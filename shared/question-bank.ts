// The Question Bank — a library of reusable questions.
//
// Stage 1: the store itself. A teacher can save a question once, tagged, and
// find it again later. Assignments will draw from it in a later stage; nothing
// reads from it yet.
//
// WHY IT IS A SEPARATE TABLE.
//
// A question inside an assignment belongs to that assignment: it is one entry
// in the `questions` JSON column, it has no life of its own, and it disappears
// with the paper it was set on. A bank question is the opposite — it exists on
// its own, is meant to be used many times, and must be findable by what it is
// ABOUT rather than by which paper happened to use it.
//
// So this is a new table beside the old one, not a change to it. Existing
// assignments keep working exactly as they do, and nothing here can affect a
// paper a child is sitting.
//
// WHY THE FIELD NAMES MATCH THE ASSIGNMENT'S OWN.
//
// The answer key below uses the SAME names as a question inside an assignment
// (`options`, `correctOption`, `correctBool`, `correctNumber`, `tolerance`,
// `acceptedAnswers`, `explanation`, `maxScore`). That is deliberate: a later
// stage can copy a bank question into an assignment without renaming a single
// field, and markAnswer() in shared/auto-marking.ts can mark it unchanged. New
// names here would have cost a translation layer in every stage that follows.
//
// Like the other shared files this is pure — no database access — so the server
// and the browser can both use it and neither can drift from the other.

import { AUTO_TYPES, type AutoType } from "./auto-marking";

// --- Tags -----------------------------------------------------------------
//
// What a question is ABOUT, which is how a teacher looks for one. Subject and
// class level reuse the vocabulary the rest of the app already speaks, so a
// bank question can be filtered with the same words as an assignment.

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

/**
 * The types a bank question may have.
 *
 * The four the auto-marker can handle, and deliberately NOT "written". A
 * written question has no answer key, so it is not a reusable question-with-an
 * answer — it is a prompt a teacher marks by hand. Letting one in would mean
 * the bank held rows that could not be marked, which is the one thing a
 * question bank must not do.
 */
export const BANK_TYPES = AUTO_TYPES;
export type BankType = AutoType;

export function isBankType(value: string): value is BankType {
  return (BANK_TYPES as readonly string[]).includes(value);
}

// --- The question ---------------------------------------------------------

/** A question as it is SAVED — no id or dates yet, those come from the table. */
export interface NewBankQuestion {
  questionText: string;
  type: BankType;
  maxScore: number;

  // The answer key. Which of these matter depends on `type`; the validator
  // below is the single place that says which.
  options?: string[];
  correctOption?: number;
  correctBool?: boolean;
  correctNumber?: number;
  tolerance?: number;
  acceptedAnswers?: string[];
  explanation?: string;

  // Tags — what the question is about.
  subject: string;
  topic: string;
  form: string;            // the class level: "Stage 3" … "Form 2"
  difficulty: Difficulty;

  /** The teacher who saved it. Taken from the session, never from the browser. */
  createdById: number;
}

/** A question as it comes BACK, with what the table added. */
export interface BankQuestion extends NewBankQuestion {
  id: number;
  createdAt: string; // ISO date-time
}

// --- Validation -----------------------------------------------------------

/**
 * Check a question is complete enough to be marked.
 *
 * Worth doing at the point of SAVING rather than leaving to whoever uses it
 * later. A multiple-choice question saved with no options, or a correctOption
 * pointing past the end of the list, marks every child wrong — and a bank
 * question is meant to be used many times, so one bad row does that damage over
 * and over, on papers written months apart by teachers who never saw it go in.
 *
 * Returns the problems in plain words, empty when there are none, so a caller
 * can show a teacher what to fix rather than just refusing.
 */
export function validateBankQuestion(q: Partial<NewBankQuestion>): string[] {
  const problems: string[] = [];

  if (!q.questionText || !q.questionText.trim()) {
    problems.push("The question needs some words.");
  }

  if (!q.type || !isBankType(q.type)) {
    problems.push(`Pick a question type: ${BANK_TYPES.join(", ")}.`);
  }

  if (typeof q.maxScore !== "number" || !Number.isFinite(q.maxScore) || q.maxScore <= 0) {
    problems.push("Marks must be a number above zero.");
  }

  // Tags. A question nobody can find again is not in a library, it is lost.
  if (!q.subject || !q.subject.trim()) problems.push("Choose a subject.");
  if (!q.topic || !q.topic.trim()) problems.push("Choose a topic.");
  if (!q.form || !q.form.trim()) problems.push("Choose a class level.");
  if (!q.difficulty || !isDifficulty(q.difficulty)) {
    problems.push(`Choose a difficulty: ${DIFFICULTIES.join(", ")}.`);
  }

  if (typeof q.createdById !== "number") {
    problems.push("A saved question must record which teacher saved it.");
  }

  // The answer key, per type.
  switch (q.type) {
    case "multiple_choice": {
      const options = q.options ?? [];
      if (options.length < 2) {
        problems.push("A multiple-choice question needs at least two options.");
      }
      if (options.some((o) => !o || !o.trim())) {
        problems.push("Every option needs some words.");
      }
      if (
        typeof q.correctOption !== "number" ||
        !Number.isInteger(q.correctOption) ||
        q.correctOption < 0 ||
        q.correctOption >= options.length
      ) {
        problems.push("Mark which option is the correct one.");
      }
      break;
    }

    case "true_false": {
      if (typeof q.correctBool !== "boolean") {
        problems.push("Say whether the answer is true or false.");
      }
      break;
    }

    case "numeric": {
      if (typeof q.correctNumber !== "number" || !Number.isFinite(q.correctNumber)) {
        problems.push("Give the correct number.");
      }
      // Tolerance is optional — no tolerance means "exactly this" — but a
      // negative one would quietly reject the right answer.
      if (q.tolerance != null && (!Number.isFinite(q.tolerance) || q.tolerance < 0)) {
        problems.push("Tolerance cannot be negative.");
      }
      break;
    }

    case "short_text": {
      const accepted = (q.acceptedAnswers ?? []).filter((a) => a && a.trim());
      if (accepted.length === 0) {
        problems.push("Give at least one accepted answer.");
      }
      break;
    }
  }

  return problems;
}

/** True when a question can be saved as it stands. */
export function isValidBankQuestion(q: Partial<NewBankQuestion>): boolean {
  return validateBankQuestion(q).length === 0;
}

// --- Filters --------------------------------------------------------------

/**
 * How a teacher looks for a question. Every field is optional and they narrow
 * together: subject AND topic AND form AND difficulty.
 *
 * `search` matches the question's words, so a teacher who remembers the
 * question but not its tags can still find it.
 */
export interface BankFilters {
  subject?: string;
  topic?: string;
  form?: string;
  difficulty?: Difficulty;
  type?: BankType;
  search?: string;
  limit?: number;
}

/** How many questions a fetch returns when the caller does not say. */
export const DEFAULT_BANK_LIMIT = 100;

// --- Wording --------------------------------------------------------------
// Grouped for translation, as everywhere else.

export const BANK_TEXT = {
  title: "Question Bank",
  subtitle: "Questions you have saved, ready to use again.",

  difficulties: {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  } as Record<Difficulty, string>,

  types: {
    multiple_choice: "Multiple choice",
    true_false: "True / False",
    numeric: "Number",
    short_text: "Short text",
  } as Record<BankType, string>,

  answer: "Answer",
  saved: "Saved to the question bank.",
  searchPlaceholder: "Search the wording of a question",

  empty: "No saved questions match that yet.",
  emptyLibrary:
    "Nothing saved yet. Open an assignment, write a question, and use \u201cSave to bank\u201d on it.",

  /**
   * Said wherever a bank question is changed or removed, because a teacher
   * cannot be expected to assume it: the library and the papers already set
   * from it are separate things.
   */
  editWarning:
    "This changes only the saved copy. Assignments that already use this question are not affected, and marks already given stand.",
  deleteWarning:
    "This removes it from the library only. Assignments that already use this question keep it, and marks already given stand.",

  /** Shown when a teacher tries to bank a question that has no answer key. */
  cannotSaveWritten:
    "A written question is marked by hand, so it has no answer to save. Only multiple choice, true/false, number and short text questions can go in the bank.",
} as const;

/** The question's type, as a teacher would say it. */
export function typeLabel(type: BankType | string): string {
  return (BANK_TEXT.types as Record<string, string>)[type] ?? type;
}

/**
 * The answer in words, for a teacher scanning the library.
 *
 * One place, so the browse screen, the save dialog and anything later all
 * describe an answer the same way. It shows the answer deliberately: this is a
 * teacher-only screen, and a question whose answer cannot be seen cannot be
 * checked before it is set as homework.
 */
export function describeAnswer(q: {
  type: BankType | string;
  options?: string[];
  correctOption?: number;
  correctBool?: boolean;
  correctNumber?: number;
  tolerance?: number;
  acceptedAnswers?: string[];
}): string {
  switch (q.type) {
    case "multiple_choice": {
      const options = q.options ?? [];
      const at = q.correctOption;
      return at != null && at >= 0 && at < options.length ? options[at] : "\u2014";
    }
    case "true_false":
      return q.correctBool ? "True" : "False";
    case "numeric": {
      if (q.correctNumber == null) return "\u2014";
      // A tolerance changes what counts as right, so it belongs beside the
      // number rather than hidden — "10" and "10 (\u00b10.5)" are different keys.
      return q.tolerance ? `${q.correctNumber} (\u00b1${q.tolerance})` : String(q.correctNumber);
    }
    case "short_text": {
      const accepted = (q.acceptedAnswers ?? []).filter((a) => a && a.trim());
      return accepted.length > 0 ? accepted.join(", ") : "\u2014";
    }
    default:
      return "\u2014";
  }
}
