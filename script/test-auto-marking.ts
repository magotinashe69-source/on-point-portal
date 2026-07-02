// A tiny test for the auto-marking engine.
// Run it with:  npx tsx script/test-auto-marking.ts
//
// It checks each question type against a few sample answers and prints a
// PASS/FAIL line for each. No test framework needed.

import { markAnswer, markSubmission, isFullyAutoMarked } from "../shared/auto-marking";
import type { Question } from "../shared/auto-marking";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

// Helper to make a question with sensible defaults.
function q(partial: Partial<Question>): Question {
  return { id: "q1", questionText: "?", maxScore: 5, ...partial } as Question;
}

console.log("\nMultiple choice");
{
  const question = q({ type: "multiple_choice", options: ["Paris", "Rome", "Cairo"], correctOption: 0 });
  check("correct pick earns full marks", markAnswer(question, "0").score, 5);
  check("wrong pick earns 0", markAnswer(question, "1").score, 0);
  check("blank earns 0", markAnswer(question, "").score, 0);
  check("shows the correct option text", markAnswer(question, "1").correctAnswerDisplay, "Paris");
}

console.log("\nTrue / false");
{
  const question = q({ type: "true_false", correctBool: true });
  check("'true' is correct", markAnswer(question, "true").correct, true);
  check("'false' is wrong", markAnswer(question, "false").correct, false);
  check("case-insensitive 'True'", markAnswer(question, "True").correct, true);
}

console.log("\nNumeric with tolerance");
{
  const question = q({ type: "numeric", correctNumber: 3.14, tolerance: 0.05 });
  check("exact value correct", markAnswer(question, "3.14").correct, true);
  check("within tolerance correct", markAnswer(question, "3.1").correct, true);
  check("just outside tolerance wrong", markAnswer(question, "3.2").correct, false);
  check("non-number wrong", markAnswer(question, "abc").correct, false);
}
{
  const exact = q({ type: "numeric", correctNumber: 10 }); // no tolerance = exact
  check("no tolerance means exact match", markAnswer(exact, "10").correct, true);
  check("no tolerance rejects 10.1", markAnswer(exact, "10.1").correct, false);
}

console.log("\nShort text (case-insensitive, spaces ignored)");
{
  const question = q({ type: "short_text", acceptedAnswers: ["photosynthesis", "photo synthesis"] });
  check("exact match", markAnswer(question, "photosynthesis").correct, true);
  check("different case", markAnswer(question, "Photosynthesis").correct, true);
  check("extra spaces ignored", markAnswer(question, "  photosynthesis  ").correct, true);
  check("second accepted answer", markAnswer(question, "photo synthesis").correct, true);
  check("wrong word", markAnswer(question, "respiration").correct, false);
}

console.log("\nWhole submission totals");
{
  const questions: Question[] = [
    q({ id: "a", type: "true_false", correctBool: true, maxScore: 2 }),
    q({ id: "b", type: "numeric", correctNumber: 42, maxScore: 3 }),
    q({ id: "c", type: "short_text", acceptedAnswers: ["cat"], maxScore: 5 }),
  ];
  const answers = [
    { questionId: "a", answerText: "true" },   // correct  -> 2
    { questionId: "b", answerText: "40" },     // wrong    -> 0
    { questionId: "c", answerText: "CAT" },    // correct  -> 5
  ];
  check("total adds up correct questions", markSubmission(questions, answers).totalScore, 7);
  check("assignment is fully auto-marked", isFullyAutoMarked(questions), true);
}

console.log("\nMixed assignment is NOT fully auto-marked");
{
  const mixed: Question[] = [
    q({ id: "a", type: "true_false", correctBool: true }),
    q({ id: "b", type: "written" }),
  ];
  check("mixed with a written question", isFullyAutoMarked(mixed), false);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
