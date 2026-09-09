// The Question Bank — the store (Stage 1) and the teacher's screens (Stage 2).
//
//   npm run check:bank
//
// Two halves. The first runs IN-PROCESS against storage: it calls
// ensureSchema() itself, which is what makes "was the table created?"
// answerable without a server. The second half walks the teacher's journey over
// HTTP against a running server — save a question with tags, find it, filter
// it, search it, edit it — which is the sequence the screens actually perform.
//
// So: start the server first (npm run dev). The in-process half runs either
// way; the HTTP half says plainly if it cannot reach a server rather than
// failing in a way that looks like broken code.
//
// It creates its own questions, tagged with a run stamp, and removes them at
// the end. It never touches anything else in the database.

import { ensureSchema } from "../server/db";
import { storage } from "../server/storage";
import { markAnswer } from "../shared/auto-marking";
import {
  validateBankQuestion,
  bankQuestionToAssignmentQuestion,
  type NewBankQuestion,
} from "../shared/question-bank";
import { apiErrorMessage } from "../client/src/lib/api-error";

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

const BASE = "http://localhost:5000";
const TEACHER = { email: "onpointeducationcentremoza@gmail.com", password: "onpoint123" };

/** A logged-in browser, near enough — it keeps the session cookie. */
class Session {
  private cookie = "";
  async request(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    let json: any = null;
    try { json = JSON.parse(await res.text()); } catch { /* not JSON */ }
    return { status: res.status, body: json };
  }
  get(p: string) { return this.request("GET", p); }
  post(p: string, b?: unknown) { return this.request("POST", p, b); }
  patch(p: string, b?: unknown) { return this.request("PATCH", p, b); }
  delete(p: string) { return this.request("DELETE", p); }
}

async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetch(BASE + "/api/question-bank");
    // 401 is the right answer to a logged-out caller, and proves the route is
    // registered — which a 200 (the React page from the catch-all) would not.
    return res.status === 401;
  } catch {
    return false;
  }
}

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
  section("A bank question converts into an assignment question (Stage 3)");
  // =======================================================================
  //
  // Carried across by NAME, not translated. If this ever needs renaming, the
  // decision Stage 1 made — give the bank the same field names an assignment
  // question uses — has been undone somewhere.

  const asAssignment = bankQuestionToAssignmentQuestion(backMcq!, "q_test_1");
  check(asAssignment.questionText === mcq.questionText, "the wording comes across");
  check(asAssignment.type === "multiple_choice", "the type comes across", asAssignment.type);
  check(asAssignment.maxScore === 1, "the marks come across", String(asAssignment.maxScore));
  check(
    JSON.stringify(asAssignment.options) === JSON.stringify(mcq.options),
    "the options come across in order", JSON.stringify(asAssignment.options),
  );
  check(asAssignment.correctOption === 1, "the correct answer comes across");
  check(asAssignment.explanation === mcq.explanation, "the explanation comes across");
  check(asAssignment.qid === "q_test_1", "it is given the new question id it was handed");

  // The tags describe where a question sits in the LIBRARY. On a paper the
  // subject and class come from the assignment itself, and a second copy on
  // each question would be one more thing to disagree with it.
  // Subject and class describe something the PAPER already knows, so a second
  // copy on each question would be one more thing to disagree with it.
  check(!("subject" in asAssignment), "the subject tag is NOT carried onto the paper");
  check(!("form" in asAssignment), "nor the class level");
  check(!("difficulty" in asAssignment), "nor the difficulty");
  check(!("id" in asAssignment), "and no link back to the bank row is kept");

  // The TOPIC is the exception, and deliberately so: it says something the
  // paper does not already know. An assignment has one topic, but a "Revision"
  // paper can hold one question about fractions and another about angles — and
  // the skills map (shared/mastery.ts) is built per question, so that finer
  // topic is exactly what it needs.
  check(asAssignment.topic === mcq.topic,
    "the topic DOES come across, so the question can feed the skills map",
    `got ${asAssignment.topic}, expected ${mcq.topic}`);

  // A converted question must be markable straight away — that is the point.
  check(markAnswer({ ...asAssignment, id: asAssignment.qid } as any, "1").correct === true,
    "the converted question marks correctly");

  // Unused fields get the same empty defaults a brand-new question has, so a
  // teacher who changes the type afterwards finds an editor ready to type in
  // rather than a broken one.
  const numAsAssignment = bankQuestionToAssignmentQuestion(backNum!, "q_test_2");
  check(Array.isArray(numAsAssignment.options) && numAsAssignment.options.length === 2,
    "a numeric question still arrives with an empty options editor",
    JSON.stringify(numAsAssignment.options));
  check(Array.isArray(numAsAssignment.acceptedAnswers) && numAsAssignment.acceptedAnswers.length === 1,
    "and an empty accepted-answers editor");
  check(numAsAssignment.correctNumber === 56, "while keeping its own answer");
  check(Array.isArray(numAsAssignment.imageUrls) && numAsAssignment.imageUrls.length === 0,
    "and carries no images — those belong to a paper, not to a saved question");

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

  // =======================================================================
  section("The teacher's journey, over HTTP (Stage 2)");
  // =======================================================================
  //
  // The sequence the screens actually perform: save a question with tags from
  // the assignment form, open the bank and see it, narrow by subject and
  // difficulty, search the wording, then edit it and see the change.

  if (!(await serverIsUp())) {
    check(false, "a server is running to check the teacher's screens against",
      `nothing answering on ${BASE} — start it with "npm run dev" and run this again`);
  } else {
    const teacher = new Session();
    const login = await teacher.post("/api/auth/teacher/login", TEACHER);
    check(login.body?.success === true, "the teacher can sign in", JSON.stringify(login.body).slice(0, 120));

    // --- 1. Save a question to the bank, with its tags -------------------
    const savedRes = await teacher.post("/api/question-bank", {
      questionText: `What is the capital of Zimbabwe? ${stamp}`,
      type: "short_text",
      maxScore: 1,
      acceptedAnswers: ["Harare"],
      subject: "GEOGRAPHY", topic: TOPIC, form: "Stage 5", difficulty: "easy",
    });
    check(savedRes.body?.success === true, "a question is saved to the bank with its tags",
      JSON.stringify(savedRes.body).slice(0, 160));
    const httpId: number | undefined = savedRes.body?.question?.id;
    if (httpId) saved.push(httpId);

    check(savedRes.body?.question?.subject === "GEOGRAPHY"
      && savedRes.body?.question?.difficulty === "easy"
      && savedRes.body?.question?.form === "Stage 5",
      "and comes back carrying those tags", JSON.stringify(savedRes.body?.question));

    // The teacher who saved it is taken from the SESSION, never the body —
    // so a browser cannot put another teacher's name on a question.
    const impersonated = await teacher.post("/api/question-bank", {
      questionText: `Impersonation attempt ${stamp}`,
      type: "true_false", correctBool: true, maxScore: 1,
      subject: "MATHS", topic: TOPIC, form: "Stage 3", difficulty: "easy",
      createdById: 999999,
    });
    if (impersonated.body?.question?.id) saved.push(impersonated.body.question.id);
    check(impersonated.body?.question?.createdById !== 999999,
      "the teacher in the body is ignored — the author comes from the session",
      `got ${impersonated.body?.question?.createdById}`);

    // --- 2. It appears when the bank is opened ---------------------------
    const listed = await teacher.get(`/api/question-bank?topic=${encodeURIComponent(TOPIC)}`);
    check(listed.body?.success === true, "the question bank opens", `status ${listed.status}`);
    check((listed.body?.questions || []).some((q: any) => q.id === httpId),
      "and the question just saved is in it");

    // --- 3. Filters ------------------------------------------------------
    const bySubject = await teacher.get(
      `/api/question-bank?topic=${encodeURIComponent(TOPIC)}&subject=GEOGRAPHY`);
    check((bySubject.body?.questions || []).length === 1,
      "filtering by subject narrows to it", `got ${(bySubject.body?.questions || []).length}`);

    const byDifficulty = await teacher.get(
      `/api/question-bank?topic=${encodeURIComponent(TOPIC)}&subject=GEOGRAPHY&difficulty=easy`);
    check((byDifficulty.body?.questions || []).length === 1,
      "and subject together with difficulty still finds it",
      `got ${(byDifficulty.body?.questions || []).length}`);

    const wrongDifficulty = await teacher.get(
      `/api/question-bank?topic=${encodeURIComponent(TOPIC)}&subject=GEOGRAPHY&difficulty=hard`);
    check((wrongDifficulty.body?.questions || []).length === 0,
      "asking for the wrong difficulty finds nothing — the filter really filters",
      `got ${(wrongDifficulty.body?.questions || []).length}`);

    // An untouched dropdown sends nothing, which must mean "no filter" rather
    // than "match the empty string".
    const blankFilters = await teacher.get(
      `/api/question-bank?topic=${encodeURIComponent(TOPIC)}&subject=&difficulty=&form=`);
    check((blankFilters.body?.questions || []).length >= 1,
      "empty filter values mean 'any', not 'match nothing'",
      `got ${(blankFilters.body?.questions || []).length}`);

    // --- 4. Search the wording -------------------------------------------
    const found = await teacher.get(
      `/api/question-bank?topic=${encodeURIComponent(TOPIC)}&search=capital`);
    check((found.body?.questions || []).some((q: any) => q.id === httpId),
      "searching a word in the question finds it");
    const notFound = await teacher.get(
      `/api/question-bank?topic=${encodeURIComponent(TOPIC)}&search=zzzznotaword`);
    check((notFound.body?.questions || []).length === 0,
      "and a word that is in no question finds nothing",
      `got ${(notFound.body?.questions || []).length}`);

    // --- 5. Edit it, and see the change ----------------------------------
    const edited = await teacher.patch(`/api/question-bank/${httpId}`, {
      questionText: `What is the capital city of Zimbabwe? ${stamp}`,
      difficulty: "medium",
      maxScore: 2,
    });
    check(edited.body?.success === true, "a saved question can be edited",
      JSON.stringify(edited.body).slice(0, 160));

    const afterEdit = await teacher.get(`/api/question-bank?topic=${encodeURIComponent(TOPIC)}&search=capital city`);
    const editedRow = (afterEdit.body?.questions || []).find((q: any) => q.id === httpId);
    check(!!editedRow, "the edit is there when the bank is read again");
    check(editedRow?.difficulty === "medium", "the new difficulty stuck", editedRow?.difficulty);
    check(editedRow?.maxScore === 2, "the new marks stuck", String(editedRow?.maxScore));
    check(
      (editedRow?.acceptedAnswers || []).includes("Harare"),
      "and the answer it was not asked to change is untouched",
      JSON.stringify(editedRow?.acceptedAnswers),
    );

    // Who saved it, and when, survives an edit.
    check(editedRow?.createdAt === savedRes.body?.question?.createdAt,
      "the date it was first saved is not rewritten by an edit");

    // An edit that would leave an unmarkable question is refused. The patch
    // looks harmless on its own — it is the MERGED question that is broken.
    const broken = await teacher.patch(`/api/question-bank/${httpId}`, { acceptedAnswers: [] });
    check(broken.status === 400,
      "an edit that would leave the question unmarkable is refused", `got ${broken.status}`);
    const stillFine = await teacher.get(`/api/question-bank?topic=${encodeURIComponent(TOPIC)}`);
    check(
      (stillFine.body?.questions || []).find((q: any) => q.id === httpId)?.acceptedAnswers?.length === 1,
      "and the question in the bank is left as it was",
    );

    // --- Teacher-only ----------------------------------------------------
    // These are the school's answer keys. A pupil who could read this endpoint
    // could read the answer to a question before it was ever set.
    const anon = new Session();
    check((await anon.get("/api/question-bank")).status === 401,
      "a logged-out caller cannot read the bank");
    check((await anon.post("/api/question-bank", { questionText: "x" })).status === 401,
      "nor save to it");
    check((await anon.delete(`/api/question-bank/${httpId}`)).status === 401,
      "nor delete from it");

    // --- Deleting --------------------------------------------------------
    const assignmentsBeforeDelete = await storage.getAssignments();
    const removed = await teacher.delete(`/api/question-bank/${httpId}`);
    check(removed.body?.success === true, "a question can be removed from the bank");
    const afterDelete = await teacher.get(`/api/question-bank?topic=${encodeURIComponent(TOPIC)}`);
    check(!(afterDelete.body?.questions || []).some((q: any) => q.id === httpId),
      "and is gone from the library");
    const assignmentsAfterDelete = await storage.getAssignments();
    check(assignmentsBeforeDelete.length === assignmentsAfterDelete.length,
      "and removing it changed no assignment",
      `${assignmentsBeforeDelete.length} -> ${assignmentsAfterDelete.length}`);

    const missing = await teacher.delete(`/api/question-bank/${httpId}`);
    check(missing.status === 404, "deleting it twice is a plain 404", `got ${missing.status}`);

    // --- A paper built from the bank does not move when the bank does ----
    //
    // The whole design in one check. A question is pulled into an assignment,
    // then the saved one is reworded and its answer changed, then deleted
    // outright. The paper must not budge, and a child answering it must be
    // marked against what the paper actually asks.

    const sourceRes = await teacher.post("/api/question-bank", {
      questionText: `Capital of France? ${stamp}`,
      type: "short_text", maxScore: 1, acceptedAnswers: ["Paris"],
      subject: "GEOGRAPHY", topic: TOPIC, form: "Form 2", difficulty: "easy",
    });
    const source = sourceRes.body?.question;
    check(!!source, "a question to pull from is saved", JSON.stringify(sourceRes.body).slice(0, 120));

    if (source) {
      // What the form does when a teacher ticks it in the picker.
      const pulled = bankQuestionToAssignmentQuestion(source, "qb1");

      const paperRes = await teacher.post("/api/assignments", {
        subject: "GEOGRAPHY", topic: "Capitals", form: "Form 2",
        title: `Built from the bank ${stamp}`,
        instructions: "Answer the question.",
        dueDate: "2026-12-01", totalMarks: 1, createdById: 1,
        questions: [{ ...pulled, id: pulled.qid }],
      });
      const paper = paperRes.body?.assignment;
      check(!!paper, "an assignment is created from it", JSON.stringify(paperRes.body).slice(0, 160));

      if (paper) {
        // Now change the saved question completely, and delete it.
        await teacher.patch(`/api/question-bank/${source.id}`, {
          questionText: `Capital of Germany? ${stamp}`,
          acceptedAnswers: ["Berlin"],
          maxScore: 5,
          difficulty: "hard",
        });
        await teacher.delete(`/api/question-bank/${source.id}`);

        const paperAfter = (await teacher.get(`/api/assignments/${paper.id}`)).body;
        const q = (paperAfter?.questions || [])[0];
        check(q?.questionText === `Capital of France? ${stamp}`,
          "the paper still asks what it asked when it was written", q?.questionText);
        check(
          JSON.stringify(q?.acceptedAnswers) === JSON.stringify(["Paris"]),
          "with the answer it was written with", JSON.stringify(q?.acceptedAnswers),
        );
        check(q?.maxScore === 1, "and the marks it was written with", String(q?.maxScore));

        // And a child answering it is marked against the PAPER, not against
        // whatever the library says today.
        const learner = (await teacher.post("/api/students", {
          studentId: `QB-${stamp}`, fullName: `Bank Paper Child ${stamp}`,
          gender: "Female", form: "Form 2",
        })).body?.student;

        if (learner) {
          const pupil = new Session();
          await pupil.post("/api/auth/student/login", {
            fullName: learner.fullName, password: "bankpw123",
          });
          const handIn = await pupil.post("/api/submissions", {
            assignmentId: paper.id, studentId: learner.id,
            answers: [{ questionId: pulled.qid, answerText: "Paris" }],
          });
          check(handIn.body?.mark?.totalScore === 1,
            "a child answering the paper is marked against the paper, not the library",
            JSON.stringify(handIn.body?.mark));

          await teacher.delete(`/api/students/${learner.id}`);
        }

        await teacher.delete(`/api/assignments/${paper.id}`);
      }
    }

    // --- What the teacher actually READS when a save is refused ----------
    //
    // apiRequest() throws on any non-2xx, so a refusal reaches the screen as an
    // exception rather than a reply. Caught carelessly that shows "check your
    // connection" to somebody whose connection is fine and whose question is
    // merely incomplete — so the server's own words are dug back out.
    const refusal = await teacher.post("/api/question-bank", {
      questionText: `No answer given ${stamp}`,
      type: "short_text", acceptedAnswers: [], maxScore: 1,
      subject: "MATHS", topic: TOPIC, form: "Stage 3", difficulty: "easy",
    });
    check(refusal.status === 400, "an incomplete question is refused with 400", `got ${refusal.status}`);
    check(/accepted answer/i.test(refusal.body?.message || ""),
      "and the refusal says what is missing, in plain words", refusal.body?.message);

    const thrown = new Error(`400: ${JSON.stringify(refusal.body)}`);
    check(
      apiErrorMessage(thrown, "Check your connection.") === refusal.body?.message,
      "the screen recovers that message instead of blaming the connection",
      apiErrorMessage(thrown, "Check your connection."),
    );
    check(
      apiErrorMessage(new TypeError("Failed to fetch"), "Check your connection.") === "Check your connection.",
      "and a real network failure still says to check the connection",
    );
  }

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
