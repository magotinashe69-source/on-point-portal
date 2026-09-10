// Does a pupil ever get handed the answers?
//
// A question carries its answer key in the same row as its wording, so an
// assignment sent out whole put the correct option, the accepted spellings and
// the right number in the page before the child had written a word — invisible
// on screen, plain in the browser's network tab.
//
// This walks the whole journey as a REAL logged-in pupil: fetch the paper,
// answer it, get it marked, read the results. It checks the answers are absent
// on the way out, present on the way back, and — the part that could quietly
// break — that auto-marking still scores exactly right.
//
// Run against a live server: npx tsx <this file>

import { onCleanup, runCheck } from "./cleanup";

const BASE = "http://localhost:5000";
const TEACHER = { email: "onpointeducationcentremoza@gmail.com", password: "onpoint123" };

let passed = 0;
let failed = 0;
function check(ok: boolean, description: string, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${description}`); }
  else { failed++; console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`); }
}

class Session {
  private cookie = "";
  async request(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    let json: any = null;
    let text = "";
    try { text = await res.text(); json = JSON.parse(text); } catch {}
    return { status: res.status, body: json, text };
  }
  get(p: string) { return this.request("GET", p); }
  post(p: string, b?: unknown) { return this.request("POST", p, b); }
  delete(p: string) { return this.request("DELETE", p); }
}

const stamp = Date.now().toString().slice(-6);

// Every field that gives an answer away. Named here so a new one added to the
// schema without being stripped shows up as a failure rather than a surprise.
const SECRET_FIELDS = ["correctOption", "correctBool", "correctNumber", "tolerance", "acceptedAnswers", "explanation", "modelAnswer"];

function secretsIn(question: any): string[] {
  return SECRET_FIELDS.filter(f => f in (question || {}));
}

async function main() {
  const teacher = new Session();
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (!login.body?.success) throw new Error("teacher login failed");

  console.log("\nSetting up one pupil and one assignment of every markable kind");

  const child = (await teacher.post("/api/students", {
    studentId: `KEY-${stamp}`, fullName: `Key Test Child ${stamp}`, gender: "Female", form: "Form 2",
  })).body?.student;
  check(!!child, "test pupil created");
  if (!child) return;
  onCleanup(`pupil ${child.studentId}`, () => teacher.delete(`/api/students/${child.id}`));

  // One assignment covering every auto-marked type plus a written one, so the
  // whole key surface is exercised at once.
  const assignment = (await teacher.post("/api/assignments", {
    subject: "SCIENCE", topic: "Mixed revision", form: "Form 2",
    title: `Answer key check ${stamp}`, instructions: "Answer all questions.",
    dueDate: "2026-12-01", totalMarks: 4, createdById: 1,
    questions: [
      { id: "k1", questionText: "Which gas do plants take in?", maxScore: 1, type: "multiple_choice",
        options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"], correctOption: 1,
        explanation: "They take in carbon dioxide and give out oxygen." },
      { id: "k2", questionText: "Water boils at 100 degrees Celsius.", maxScore: 1, type: "true_false", correctBool: true },
      { id: "k3", questionText: "How many legs does an insect have?", maxScore: 1, type: "numeric", correctNumber: 6, tolerance: 0 },
      { id: "k4", questionText: "Name the force that pulls things down.", maxScore: 1, type: "short_text",
        acceptedAnswers: ["gravity", "the force of gravity"] },
    ],
  })).body?.assignment;
  check(!!assignment, "assignment created");
  if (!assignment) return;
  onCleanup(`assignment ${assignment.title}`, () => teacher.delete(`/api/assignments/${assignment.id}`));

  // A separate written one, to check the model answer is stripped too.
  const written = (await teacher.post("/api/assignments", {
    subject: "ENGLISH", topic: "Composition", form: "Form 2",
    title: `Written key check ${stamp}`, instructions: "Write a paragraph.",
    dueDate: "2026-12-01", totalMarks: 5, createdById: 1,
    questions: [{ id: "wk1", questionText: "Describe your favourite place.", maxScore: 5, type: "written",
      modelAnswer: "A strong answer uses the five senses and at least two adjectives." }],
  })).body?.assignment;
  if (written) onCleanup(`assignment ${written.title}`, () => teacher.delete(`/api/assignments/${written.id}`));
  check(!!written, "written assignment created");

  // =========================================================================
  console.log("\nThe pupil fetches the paper — the answers must not be on it");
  // =========================================================================

  const pupil = new Session();
  const pupilLogin = await pupil.post("/api/auth/student/login", {
    fullName: child.fullName, password: "keypw1234",
  });
  check(pupilLogin.body?.success === true, "the pupil can log in", JSON.stringify(pupilLogin.body).slice(0, 120));

  const paper = await pupil.get(`/api/assignments/${assignment.id}`);
  const paperQuestions = paper.body?.questions || [];
  check(paper.status === 200 && paperQuestions.length === 4, "the pupil gets all four questions",
    `status ${paper.status}, ${paperQuestions.length} questions`);

  for (const q of paperQuestions) {
    const leaked = secretsIn(q);
    check(leaked.length === 0, `${q.id}: no answer key on the question`, leaked.join(", "));
  }

  // The values themselves, not just the field names — in case one is ever
  // copied somewhere else in the payload.
  check(!paper.text.includes('"correctOption"'), "the raw response names no correct option");
  check(!paper.text.includes("gravity"), "the raw response does not contain the short-text answer");
  check(!paper.text.includes("give out oxygen"), "the raw response does not contain the explanation");

  // What the pupil still NEEDS in order to answer.
  const mcq = paperQuestions.find((q: any) => q.id === "k1");
  check(mcq?.type === "multiple_choice", "the question type survives, so the right input is drawn");
  check(Array.isArray(mcq?.options) && mcq.options.length === 4,
    "the four options survive — the paper is unanswerable without them", JSON.stringify(mcq?.options));
  check(mcq?.questionText?.includes("plants take in"), "the question wording survives");
  check(mcq?.maxScore === 1, "the marks available survive");

  const writtenPaper = await pupil.get(`/api/assignments/${written.id}`);
  const wq = writtenPaper.body?.questions?.[0];
  check(secretsIn(wq).length === 0, "the written question carries no model answer", secretsIn(wq).join(", "));
  check(!writtenPaper.text.includes("five senses"), "the raw response does not contain the model answer");

  // The list endpoint, not just one assignment.
  const list = await pupil.get("/api/assignments?form=Form%202");
  const listed = (list.body || []).find((a: any) => a.id === assignment.id);
  check(!!listed, "the assignment appears in the pupil's list");
  if (listed) {
    const leaked = (listed.questions || []).flatMap(secretsIn);
    check(leaked.length === 0, "the assignment LIST carries no answer key either", leaked.join(", "));
  }

  // =========================================================================
  console.log("\nThe pupil answers it — marking must be unchanged");
  // =========================================================================

  // Three right, one wrong. If stripping the key had broken marking, this is
  // where it would show: the score would come back 0, or 4.
  const submitted = await pupil.post("/api/submissions", {
    assignmentId: assignment.id, studentId: child.id,
    answers: [
      { questionId: "k1", answerText: "1" },        // right (Carbon dioxide)
      { questionId: "k2", answerText: "true" },     // right
      { questionId: "k3", answerText: "8" },        // WRONG (insects have 6)
      { questionId: "k4", answerText: "Gravity" },  // right, different capitals
    ],
  });
  check(submitted.body?.success === true, "the pupil can hand the work in",
    JSON.stringify(submitted.body).slice(0, 150));

  const submissionId = submitted.body?.submission?.id;
  check(!!submissionId, "the submission was saved");
  if (!submissionId) return;

  const marked = await pupil.get(`/api/marks/${submissionId}`);
  check(marked.status === 200, "it was auto-marked straight away", `status ${marked.status}`);
  check(marked.body?.totalScore === 3,
    "auto-marking still scores exactly right: 3 of 4", `got ${marked.body?.totalScore}`);

  const qm = (marked.body?.questionMarks || []) as any[];
  check(qm.find(m => m.questionId === "k1")?.score === 1, "the multiple-choice answer was marked right");
  check(qm.find(m => m.questionId === "k3")?.score === 0, "the wrong numeric answer was marked wrong");
  check(qm.find(m => m.questionId === "k4")?.score === 1,
    "the short-text answer was accepted despite the capital G");

  // =========================================================================
  console.log("\nAfterwards, the pupil is told what the answers were");
  // =========================================================================

  // The point of the whole exercise: the answers are not hidden from a child,
  // they are just not handed over early.
  const k3Feedback = qm.find(m => m.questionId === "k3")?.feedback || "";
  check(k3Feedback.includes("6"), "the feedback on the wrong answer tells them it was 6", k3Feedback);
  const k1Feedback = qm.find(m => m.questionId === "k1")?.feedback || "";
  check(k1Feedback.toLowerCase().includes("correct"), "a right answer is confirmed as correct", k1Feedback);

  // And their own results page still knows enough to draw itself.
  const results = await pupil.get(`/api/submissions/${submissionId}`);
  check(results.status === 200 && results.body?.assignment?.questions?.length === 4,
    "the results page still gets all four questions", `status ${results.status}`);
  const resultLeaks = (results.body?.assignment?.questions || []).flatMap(secretsIn);
  check(resultLeaks.length === 0, "and still without the key on them", resultLeaks.join(", "));

  // =========================================================================
  console.log("\nThe teacher still gets everything — they wrote it");
  // =========================================================================

  const teacherPaper = await teacher.get(`/api/assignments/${assignment.id}`);
  const tq = (teacherPaper.body?.questions || []).find((q: any) => q.id === "k1");
  check(tq?.correctOption === 1, "the teacher still sees the correct option", JSON.stringify(tq?.correctOption));
  check(tq?.explanation?.includes("oxygen"), "the teacher still sees the explanation");
  const tWritten = await teacher.get(`/api/assignments/${written.id}`);
  check(tWritten.body?.questions?.[0]?.modelAnswer?.includes("five senses"),
    "the teacher still sees the model answer");

  // --- Tidy up -------------------------------------------------------------
  await teacher.delete(`/api/assignments/${assignment.id}`);
  await teacher.delete(`/api/assignments/${written.id}`);
  await teacher.delete(`/api/students/${child.id}`);
  console.log("\nTest pupil and assignments removed.");

}

// A note on how this script finishes.
//
// It sets process.exitCode and lets the process end by itself. It must NOT call
// process.exit().
//
// process.exit() tears the process down while fetch's keep-alive sockets are
// still open, and on Node 24 for Windows that trips an assertion inside libuv
// ("!(handle->flags & UV_HANDLE_CLOSING)"). Every check has already run and
// printed by then, but the process dies with code 127 — so a completely green
// run looks like a failure, which is worse than useless in CI.
//
// Ending naturally costs a few seconds while those sockets time out, and gives
// an honest 0 or 1.
// No tidy-up block at the end on purpose. Everything this check creates
// registers its own removal with onCleanup() at the moment it is made, and
// runCheck runs those in a `finally` — so a run that throws partway, or one
// killed by the dev server restarting under it, still cleans up after itself.

function summary(): boolean {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

runCheck(main, summary);
