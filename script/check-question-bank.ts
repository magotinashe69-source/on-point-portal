// The Question Bank, Stage 1 — proving the table exists and holds a question.
//
// Unlike the other check scripts this one does NOT talk to a running server.
// There are no HTTP endpoints for the bank yet (that comes with the teacher
// screen in the next stage), so it runs in-process against storage directly —
// which is the "internal way" this stage is about.
//
//   npm run check:bank
//
// It creates its own questions, tagged with a run stamp, and removes them at
// the end. It never touches anything else in the database.

import { ensureSchema } from "../server/db";
import { storage } from "../server/storage";
import { markAnswer } from "../shared/auto-marking";
import {
  validateBankQuestion,
  type NewBankQuestion,
} from "../shared/question-bank";

let passed = 0;
let failed = 0;

function check(ok: boolean, description: string, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${description}`); }
  else { failed++; console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`); }
}
function section(title: string) { console.log(`\n${title}`); }

// A stamp so this run's questions are recognisable and removable, and cannot
// collide with a previous run left half-finished.
const stamp = Date.now().toString().slice(-6);
const TOPIC = `BankCheck ${stamp}`;

async function main() {
  console.log(`\nQuestion Bank check (topic tag "${TOPIC}")\n`);

  // The same call the server makes on startup. On SQLite it creates any table
  // that is missing, which is what makes "was the table created?" answerable.
  await ensureSchema();

  const saved: number[] = [];

  // =======================================================================
  section("The table exists and can be read");
  // =======================================================================

  let readable = true;
  try {
    await storage.getBankQuestions({ topic: TOPIC });
  } catch (error) {
    readable = false;
    console.log(`        ${String(error).slice(0, 200)}`);
  }
  check(readable, "the question_bank table can be queried");

  // =======================================================================
  section("It holds a question of every type, answer key intact");
  // =======================================================================

  const mcq: NewBankQuestion = {
    questionText: "Which gas do plants take in?",
    type: "multiple_choice",
    maxScore: 1,
    options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"],
    correctOption: 1,
    explanation: "They take in carbon dioxide and give out oxygen.",
    subject: "SCIENCE", topic: TOPIC, form: "Stage 4", difficulty: "easy",
    createdById: 1,
  };
  const tf: NewBankQuestion = {
    questionText: "Water boils at 100 degrees Celsius.",
    type: "true_false", maxScore: 1, correctBool: true,
    subject: "SCIENCE", topic: TOPIC, form: "Stage 4", difficulty: "easy",
    createdById: 1,
  };
  const num: NewBankQuestion = {
    questionText: "What is 7 x 8?",
    type: "numeric", maxScore: 2, correctNumber: 56, tolerance: 0,
    subject: "MATHS", topic: TOPIC, form: "Stage 5", difficulty: "medium",
    createdById: 1,
  };
  const text: NewBankQuestion = {
    questionText: "Name the force that pulls things down.",
    type: "short_text", maxScore: 1,
    acceptedAnswers: ["gravity", "the force of gravity"],
    subject: "SCIENCE", topic: TOPIC, form: "Stage 6", difficulty: "hard",
    createdById: 1,
  };

  const savedMcq = await storage.createBankQuestion(mcq);
  const savedTf = await storage.createBankQuestion(tf);
  const savedNum = await storage.createBankQuestion(num);
  const savedText = await storage.createBankQuestion(text);
  saved.push(savedMcq.id, savedTf.id, savedNum.id, savedText.id);

  check(savedMcq.id > 0, "a multiple-choice question is saved and given an id", `id ${savedMcq.id}`);
  check(!!savedMcq.createdAt, "and the date it was saved", savedMcq.createdAt);
  check(savedMcq.createdById === 1, "and which teacher saved it", String(savedMcq.createdById));

  // Read it back fresh, so this proves what the TABLE holds rather than what
  // the insert happened to return.
  const backMcq = await storage.getBankQuestion(savedMcq.id);
  check(backMcq?.questionText === mcq.questionText, "the question text comes back", backMcq?.questionText);
  check(
    JSON.stringify(backMcq?.options) === JSON.stringify(mcq.options),
    "the options come back in order", JSON.stringify(backMcq?.options),
  );
  check(backMcq?.correctOption === 1, "the correct option comes back", String(backMcq?.correctOption));
  check(backMcq?.explanation === mcq.explanation, "the explanation comes back");
  check(backMcq?.maxScore === 1, "the marks come back", String(backMcq?.maxScore));
  check(backMcq?.subject === "SCIENCE" && backMcq?.form === "Stage 4" && backMcq?.difficulty === "easy",
    "the tags come back", JSON.stringify({ s: backMcq?.subject, f: backMcq?.form, d: backMcq?.difficulty }));

  const backTf = await storage.getBankQuestion(savedTf.id);
  check(backTf?.correctBool === true, "true/false keeps its answer", String(backTf?.correctBool));

  const backNum = await storage.getBankQuestion(savedNum.id);
  check(backNum?.correctNumber === 56, "a numeric answer keeps its value", String(backNum?.correctNumber));
  check(backNum?.tolerance === 0, "and its tolerance", String(backNum?.tolerance));
  check(backNum?.maxScore === 2, "a question worth 2 marks keeps them", String(backNum?.maxScore));

  const backText = await storage.getBankQuestion(savedText.id);
  check(
    JSON.stringify(backText?.acceptedAnswers) === JSON.stringify(text.acceptedAnswers),
    "short text keeps every accepted answer", JSON.stringify(backText?.acceptedAnswers),
  );

  // =======================================================================
  section("A saved question can be marked without translating it");
  // =======================================================================
  //
  // The point of naming the columns after the assignment's own fields. If this
  // ever fails, copying a bank question into an assignment has started needing
  // a conversion layer.

  const asQuestion = { ...backMcq!, id: "q1" } as any;
  check(markAnswer(asQuestion, "1").correct === true,
    "the right answer marks correct straight from the bank row");
  check(markAnswer(asQuestion, "0").correct === false, "and a wrong one marks wrong");
  check(markAnswer({ ...backNum!, id: "q2" } as any, "56").correct === true,
    "a numeric bank question marks correct too");

  // =======================================================================
  section("Questions are found by what they are about");
  // =======================================================================

  const bySubject = await storage.getBankQuestions({ subject: "SCIENCE", topic: TOPIC });
  check(bySubject.length === 3, "filtering by subject finds the three science ones", `got ${bySubject.length}`);

  const byForm = await storage.getBankQuestions({ form: "Stage 4", topic: TOPIC });
  check(byForm.length === 2, "filtering by class level finds the two Stage 4 ones", `got ${byForm.length}`);

  const byDifficulty = await storage.getBankQuestions({ difficulty: "hard", topic: TOPIC });
  check(byDifficulty.length === 1, "filtering by difficulty finds the one hard question", `got ${byDifficulty.length}`);
  check(byDifficulty[0]?.questionText === text.questionText, "and it is the right one");

  const byTopic = await storage.getBankQuestions({ topic: TOPIC });
  check(byTopic.length === 4, "filtering by topic finds all four", `got ${byTopic.length}`);

  // The filters narrow TOGETHER, not separately.
  const combined = await storage.getBankQuestions({
    subject: "SCIENCE", form: "Stage 4", difficulty: "easy", topic: TOPIC,
  });
  check(combined.length === 2, "subject AND class AND difficulty narrow together", `got ${combined.length}`);

  const noMatch = await storage.getBankQuestions({
    subject: "MATHS", form: "Stage 4", topic: TOPIC,
  });
  check(noMatch.length === 0, "a combination nothing matches finds nothing", `got ${noMatch.length}`);

  const byType = await storage.getBankQuestions({ type: "numeric", topic: TOPIC });
  check(byType.length === 1, "filtering by question type works", `got ${byType.length}`);

  const bySearch = await storage.getBankQuestions({ search: "7 x 8", topic: TOPIC });
  check(bySearch.length === 1, "searching the wording finds a question by what it says", `got ${bySearch.length}`);

  check(byTopic[0]?.id === savedText.id, "newest is first", `got id ${byTopic[0]?.id}`);

  const limited = await storage.getBankQuestions({ topic: TOPIC, limit: 2 });
  check(limited.length === 2, "a limit is respected", `got ${limited.length}`);

  // =======================================================================
  section("A question that could not be marked is refused");
  // =======================================================================
  //
  // A bank question is reused many times, so a broken answer key would mark
  // children wrong over and over on papers set months apart.

  const brokenCases: Array<{ q: any; why: string }> = [
    { q: { ...mcq, options: ["Only one"] }, why: "multiple choice with one option" },
    { q: { ...mcq, correctOption: 9 }, why: "a correct option past the end of the list" },
    { q: { ...mcq, correctOption: undefined }, why: "multiple choice with no correct answer marked" },
    { q: { ...tf, correctBool: undefined }, why: "true/false with no answer" },
    { q: { ...num, correctNumber: undefined }, why: "a numeric question with no number" },
    { q: { ...num, tolerance: -1 }, why: "a negative tolerance" },
    { q: { ...text, acceptedAnswers: [] }, why: "short text with no accepted answer" },
    { q: { ...mcq, questionText: "  " }, why: "a question with no words" },
    { q: { ...mcq, maxScore: 0 }, why: "a question worth no marks" },
    { q: { ...mcq, difficulty: "tricky" }, why: "a difficulty that is not easy, medium or hard" },
    { q: { ...mcq, type: "written" }, why: "a written question, which has no answer key" },
    { q: { ...mcq, subject: "" }, why: "a question with no subject to find it by" },
  ];

  for (const { q, why } of brokenCases) {
    check(validateBankQuestion(q).length > 0, `the checker rejects ${why}`);
    let refused = false;
    try {
      const bad = await storage.createBankQuestion(q);
      saved.push(bad.id); // saved when it should not have been — clean it up
    } catch {
      refused = true;
    }
    check(refused, `and saving ${why} is refused`);
  }

  const afterBroken = await storage.getBankQuestions({ topic: TOPIC });
  check(afterBroken.length === 4, "nothing broken made it into the library", `got ${afterBroken.length}`);

  // =======================================================================
  section("The bank is separate from assignments");
  // =======================================================================
  //
  // Stage 1 adds a library beside the existing questions, it does not change
  // how assignments work. Saving to it must leave them completely alone.

  const assignmentsBefore = await storage.getAssignments();
  const extra = await storage.createBankQuestion({ ...num, questionText: `Separateness ${stamp}` });
  saved.push(extra.id);
  const assignmentsAfter = await storage.getAssignments();
  check(assignmentsBefore.length === assignmentsAfter.length,
    "saving a bank question creates no assignment",
    `${assignmentsBefore.length} -> ${assignmentsAfter.length}`);
  check(
    assignmentsAfter.every(a =>
      !(a.questions || []).some((q: any) => q.questionText === `Separateness ${stamp}`)),
    "and puts nothing into an existing assignment's questions",
  );

  // =======================================================================
  section("A question can be removed again");
  // =======================================================================

  await storage.deleteBankQuestion(extra.id);
  check(!(await storage.getBankQuestion(extra.id)), "a deleted question is gone");

  // --- Tidy up -----------------------------------------------------------
  for (const id of saved) {
    try { await storage.deleteBankQuestion(id); } catch { /* already gone */ }
  }
  const leftOver = await storage.getBankQuestions({ topic: TOPIC });
  check(leftOver.length === 0, "the check removed everything it created", `${leftOver.length} left`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  // Set the code and let the process end by itself — never process.exit(),
  // which tears down open sockets and reports a green run as a failure.
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
