// Grade Book submission review — end-to-end test.
//
// 3 fake students submit the same assignment with different mistakes. Verifies:
//   * the review shows each student's answer (option text for MCQ), the correct
//     answer, tolerance, marks, and right/wrong verdicts,
//   * teacher override of a mark updates the total AND the student's XP and
//     flags it teacher-adjusted,
//   * the class per-question breakdown counts are correct,
//   * every teacher endpoint requires a login,
//   * the gradebook rows carry a submissionId to link from.
//
// Usage:  npm run dev   then   npx tsx script/test-submission-review.ts

import { storage } from "../server/storage";

const BASE = "http://localhost:5000";
const TEACHER_EMAIL = "onpointeducationcentremoza@gmail.com";
const TEACHER_PASSWORD = "onpoint123";

let fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}${d ? "  — " + d : ""}`); if (!c) fail++; };
async function http(method: string, path: string, body?: any, cookie?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch {}
  return { status: res.status, json, res };
}

async function main() {
  console.log("Grade Book — submission review test\n");
  const teacher = await storage.getTeacherByEmail(TEACHER_EMAIL);
  if (!teacher) { console.error("No teacher"); process.exit(1); }
  const stamp = Date.now();

  const mk = (tag: string, name: string) => storage.createStudent({ studentId: `REV-${tag}-${stamp}`, fullName: name, gender: "Male", form: "Form 1", role: "student" });
  const S1 = await mk("A", "Ana Review");
  const S2 = await mk("B", "Ben Review");
  const S3 = await mk("C", "Cara Review");

  const assignment = await storage.createAssignment({
    subject: "MATHS", form: "Form 1", title: `Review Test ${stamp}`, instructions: "t",
    questions: [
      { id: "q1", questionText: "2+2?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 },
      { id: "q2", questionText: "Sky is blue?", maxScore: 1, type: "true_false", correctBool: true },
      { id: "q3", questionText: "Pick A", maxScore: 1, type: "multiple_choice", options: ["A", "B", "C"], correctOption: 0 },
    ] as any,
    dueDate: "2027-01-01", totalMarks: 3, createdById: teacher.id,
    targetStudentIds: [S1.id, S2.id, S3.id] as any,
  });

  const submit = (sid: number, a: [string, string, string]) => http("POST", "/api/submissions", { assignmentId: assignment.id, studentId: sid,
    answers: [{ questionId: "q1", answerText: a[0] }, { questionId: "q2", answerText: a[1] }, { questionId: "q3", answerText: a[2] }] });
  const sub1 = (await submit(S1.id, ["4", "true", "1"])).json.submission.id;  // q3 wrong (B). 2/3
  const sub2 = (await submit(S2.id, ["5", "true", "0"])).json.submission.id;  // q1 wrong. 2/3
  const sub3 = (await submit(S3.id, ["4", "false", "2"])).json.submission.id; // q2,q3 wrong. 1/3

  // === Auth ===
  console.log("1) Teacher-only endpoints");
  ok("review without login -> 401", (await http("GET", `/api/teacher/submissions/${sub1}/review`)).status === 401);
  ok("override without login -> 401", (await http("POST", `/api/teacher/submissions/${sub1}/questions/q1/mark`, { score: 0 })).status === 401);
  ok("question-stats without login -> 401", (await http("GET", `/api/teacher/assignments/${assignment.id}/question-stats`)).status === 401);
  // The Grade Book listing must be teacher-only too. It used to be open, so a
  // dead session still filled the table while opening a row failed — which is
  // what made this look like "the review feature is broken".
  ok("gradebook without login -> 401", (await http("GET", "/api/gradebook")).status === 401);
  ok("grades CSV export without login -> 401", (await http("GET", "/api/export/grades")).status === 401);
  ok("session check without login -> 401", (await http("GET", "/api/auth/teacher/me")).status === 401);

  const login = await http("POST", "/api/auth/teacher/login", { email: TEACHER_EMAIL, password: TEACHER_PASSWORD });
  const cookie = (login.res.headers.get("set-cookie") || "").split(";")[0];
  ok("teacher logged in", !!cookie);
  const me = await http("GET", "/api/auth/teacher/me", undefined, cookie);
  ok("session check with login -> the teacher", me.status === 200 && me.json?.teacher?.email === TEACHER_EMAIL);
  ok("session check never leaks the password", me.json?.teacher?.password === undefined);

  // === Review accuracy (Ana: q1 right, q2 right, q3 wrong) ===
  console.log("\n2) Review shows answers, correct answers, verdicts, marks");
  const r = (await http("GET", `/api/teacher/submissions/${sub1}/review`, undefined, cookie)).json.review;
  ok("total is 2/3", r.totalScore === 2, `total=${r.totalScore}`);
  const q = (i: number) => r.questions[i];
  ok("q1 numeric correct, shows tolerance", q(0).verdict === "correct" && q(0).correctAnswerDisplay === "4" && q(0).tolerance === 0);
  ok("q2 true/false correct, answer shows 'True'", q(1).verdict === "correct" && q(1).studentAnswerDisplay === "True" && q(1).correctAnswerDisplay === "True");
  ok("q3 MCQ wrong: student answer shows option text 'B', correct 'A', score 0",
    q(2).verdict === "wrong" && q(2).studentAnswerDisplay === "B" && q(2).correctAnswerDisplay === "A" && q(2).score === 0,
    `ans=${q(2).studentAnswerDisplay} correct=${q(2).correctAnswerDisplay} verdict=${q(2).verdict}`);
  ok("per-question answers were saved at submission time", r.hasAnswerData === true);
  ok("every question carries the student's answer", r.questions.every((x: any) => x.studentAnswerText !== ""));

  // A submission with no stored answers must say so rather than look blank.
  console.log("\n2b) Submission with no recorded answers");
  const emptySub = await storage.createSubmission({ assignmentId: assignment.id, studentId: S1.id, answers: [] as any });
  const rEmpty = (await http("GET", `/api/teacher/submissions/${emptySub.id}/review`, undefined, cookie)).json.review;
  ok("review still loads (does not error)", !!rEmpty, "review returned");
  ok("flagged as having no answer data", rEmpty?.hasAnswerData === false);
  ok("all questions still listed for context", rEmpty?.questions.length === 3, `n=${rEmpty?.questions.length}`);

  // === Class per-question breakdown (baseline, before any override) ===
  console.log("\n3) Class per-question breakdown counts");
  const stats = (await http("GET", `/api/teacher/assignments/${assignment.id}/question-stats`, undefined, cookie)).json;
  ok("3 marked submissions", stats.totalMarked === 3, `total=${stats.totalMarked}`);
  const st = (i: number) => stats.stats[i];
  ok("Q1 wrong = 1 (Ben's 5)", st(0).wrong === 1, `wrong=${st(0).wrong}`);
  ok("Q2 wrong = 1 (Cara's false)", st(1).wrong === 1, `wrong=${st(1).wrong}`);
  ok("Q3 wrong = 2 (Ana, Cara)", st(2).wrong === 2, `wrong=${st(2).wrong}`);

  // === Teacher override: give Cara credit on q2 (0 -> 1) ===
  console.log("\n4) Teacher override updates total + XP + flags adjusted");
  const xpBefore = (await storage.getStudentXp(S3.id))!.totalXp; // 1 correct*10 + 25 = 35
  ok("Cara XP starts at 35", xpBefore === 35, `xp=${xpBefore}`);
  const ov = await http("POST", `/api/teacher/submissions/${sub3}/questions/q2/mark`, { score: 1 }, cookie);
  ok("override succeeds, new total 2", ov.json?.success === true && ov.json?.totalScore === 2, JSON.stringify(ov.json));
  const xpAfter = (await storage.getStudentXp(S3.id))!.totalXp;
  ok("Cara XP rose by 10 (35 -> 45)", xpAfter === 45, `xp=${xpAfter}`);
  const r3 = (await http("GET", `/api/teacher/submissions/${sub3}/review`, undefined, cookie)).json.review;
  ok("Cara q2 now correct, score 1, teacher-adjusted", r3.questions[1].verdict === "correct" && r3.questions[1].score === 1 && r3.questions[1].teacherAdjusted === true);
  ok("Cara review total now 2/3", r3.totalScore === 2, `total=${r3.totalScore}`);

  // clamping: over-max is clamped
  const clamp = await http("POST", `/api/teacher/submissions/${sub3}/questions/q2/mark`, { score: 99 }, cookie);
  ok("over-max score clamps to maxScore (1)", clamp.json?.score === 1, `score=${clamp.json?.score}`);

  // === Gradebook rows carry submissionId ===
  console.log("\n5) Grade Book rows link to submissions");
  const gb = (await http("GET", `/api/gradebook?assignmentId=${assignment.id}`, undefined, cookie)).json;
  const anaRow = (gb.rows || []).find((x: any) => x.studentId === S1.id);
  ok("Ana's gradebook row has her submissionId", anaRow?.submissionId === sub1, `submissionId=${anaRow?.submissionId}`);

  console.log(`\n${fail === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${fail} failed.\x1b[0m`}`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
