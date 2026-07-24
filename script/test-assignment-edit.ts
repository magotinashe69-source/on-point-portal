// Assignment editing — end-to-end test of the submissions-safety rules.
//
// Creates an auto-marked assignment, submits as a fake student (which marks it
// and awards XP), then edits as the teacher and checks:
//   * a plain edit (typo / type change) NEVER silently re-marks,
//   * changing a correct answer + Re-mark updates that question's score, the
//     total, and the student's XP,
//   * deleting a question with answers cleanly removes its marks + XP,
//   * edit/re-mark routes require a teacher login (401 without),
//   * re-marking a hand-marked (written) question is refused,
//   * the student always sees the current version.
//
// Usage:  npm run dev   then   npx tsx script/test-assignment-edit.ts

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
  console.log("Assignment editing — safety-rule test\n");
  const teacher = await storage.getTeacherByEmail(TEACHER_EMAIL);
  if (!teacher) { console.error("No teacher"); process.exit(1); }
  const stamp = Date.now();

  const student = await storage.createStudent({ studentId: `EDIT-${stamp}`, fullName: "Edit Tester", gender: "Female", form: "Form 1", role: "student" });

  // Auto-marked assignment: numeric(=4), true_false(=true), multiple_choice(correct index 0).
  const q = (over: any) => ({ id: over.id, questionText: over.text, maxScore: 1, type: over.type, ...over.key });
  const assignment = await storage.createAssignment({
    subject: "MATHS", form: "Form 1", title: `Edit Test ${stamp}`, instructions: "test",
    questions: [
      q({ id: "q1", text: "2+2?", type: "numeric", key: { correctNumber: 4, tolerance: 0 } }),
      q({ id: "q2", text: "Sky is blue?", type: "true_false", key: { correctBool: true } }),
      q({ id: "q3", text: "Pick A", type: "multiple_choice", key: { options: ["A", "B"], correctOption: 0 } }),
    ] as any,
    dueDate: "2027-01-01", totalMarks: 3, createdById: teacher.id, targetStudentIds: [student.id] as any,
  });

  // Submit: q1 right (4), q2 right (true), q3 WRONG (picks index 1 = "B").
  const sub = await http("POST", "/api/submissions", { assignmentId: assignment.id, studentId: student.id,
    answers: [{ questionId: "q1", answerText: "4" }, { questionId: "q2", answerText: "true" }, { questionId: "q3", answerText: "1" }] });
  const submissionId = sub.json?.submission?.id;
  const xp0 = (await storage.getStudentXp(student.id))!.totalXp;
  const mark0 = (await storage.getMark(submissionId))!;
  console.log(`Baseline: total=${mark0.totalScore}/3 (2 correct), XP=${xp0}`);
  ok("marked 2/3 on submit", mark0.totalScore === 2);
  ok("XP = 45 (2×10 + 25 completion)", xp0 === 45, `xp=${xp0}`);

  // Full question payloads for PUT (must preserve ids).
  const Q1 = { id: "q1", questionText: "2 + 2 = ?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 };
  const Q2 = { id: "q2", questionText: "The sky is blue.", maxScore: 1, type: "true_false", correctBool: true };
  const Q3 = { id: "q3", questionText: "Pick A", maxScore: 1, type: "multiple_choice", options: ["A", "B"], correctOption: 0 };

  // === Auth ===
  console.log("\n1) Edit routes are teacher-only");
  ok("PUT without login -> 401", (await http("PUT", `/api/assignments/${assignment.id}`, { title: "x" })).status === 401);
  ok("re-mark without login -> 401", (await http("POST", `/api/assignments/${assignment.id}/questions/q3/remark`, {})).status === 401);
  const login = await http("POST", "/api/auth/teacher/login", { email: TEACHER_EMAIL, password: TEACHER_PASSWORD });
  const cookie = (login.res.headers.get("set-cookie") || "").split(";")[0];
  ok("teacher logged in", !!cookie);

  // === Plain edit never re-marks ===
  console.log("\n2) Plain edits (typo + type change) never re-mark");
  await http("PUT", `/api/assignments/${assignment.id}`, { title: "Edited Title", questions: [Q1, Q2, Q3] }, cookie);
  let mark = (await storage.getMark(submissionId))!;
  let xp = (await storage.getStudentXp(student.id))!.totalXp;
  ok("marks unchanged after typo edit (total still 2)", mark.totalScore === 2 && xp === 45, `total=${mark.totalScore} xp=${xp}`);
  // change q2 type to numeric (converting) — still no re-mark
  const Q2asNumeric = { id: "q2", questionText: "The sky is blue.", maxScore: 1, type: "numeric", correctNumber: 5, tolerance: 0 };
  await http("PUT", `/api/assignments/${assignment.id}`, { questions: [Q1, Q2asNumeric, Q3] }, cookie);
  mark = (await storage.getMark(submissionId))!;
  ok("marks unchanged after q2 type change (total still 2)", mark.totalScore === 2, `total=${mark.totalScore}`);
  // restore q2 to true_false for later
  await http("PUT", `/api/assignments/${assignment.id}`, { questions: [Q1, Q2, Q3] }, cookie);

  // === Change correct answer + re-mark ===
  console.log("\n3) Change a correct answer + Re-mark");
  const Q3fixed = { ...Q3, correctOption: 1 }; // now the student's "1" is correct
  await http("PUT", `/api/assignments/${assignment.id}`, { questions: [Q1, Q2, Q3fixed] }, cookie);
  let markBeforeRemark = (await storage.getMark(submissionId))!;
  ok("still 2/3 before re-mark (save alone didn't re-mark)", markBeforeRemark.totalScore === 2, `total=${markBeforeRemark.totalScore}`);
  const remark = await http("POST", `/api/assignments/${assignment.id}/questions/q3/remark`, {}, cookie);
  ok("re-mark reports 1 affected", remark.json?.affected === 1, JSON.stringify(remark.json));
  mark = (await storage.getMark(submissionId))!;
  xp = (await storage.getStudentXp(student.id))!.totalXp;
  const q3mark = mark.questionMarks.find((m: any) => m.questionId === "q3");
  ok("q3 now scored correct (score 1)", q3mark?.score === 1);
  ok("total is now 3/3", mark.totalScore === 3, `total=${mark.totalScore}`);
  ok("XP went up by 10 (45 -> 55)", xp === 55, `xp=${xp}`);

  // === Delete a question with answers ===
  console.log("\n4) Delete a question that has answers");
  await http("PUT", `/api/assignments/${assignment.id}`, { questions: [Q2, Q3fixed] }, cookie); // drop q1 (student had it right)
  mark = (await storage.getMark(submissionId))!;
  xp = (await storage.getStudentXp(student.id))!.totalXp;
  ok("q1 removed from the mark", !mark.questionMarks.find((m: any) => m.questionId === "q1"));
  ok("total dropped by q1's mark (3 -> 2)", mark.totalScore === 2, `total=${mark.totalScore}`);
  ok("XP dropped by 10 for the removed correct answer (55 -> 45)", xp === 45, `xp=${xp}`);
  const freshAssign = await http("GET", `/api/assignments/${assignment.id}`);
  ok("assignment (student's view) now has 2 questions", (freshAssign.json?.questions || []).length === 2);
  ok("totalMarks recalculated to 2", freshAssign.json?.totalMarks === 2, `totalMarks=${freshAssign.json?.totalMarks}`);

  // === Re-mark refuses a written question ===
  console.log("\n5) Re-marking a hand-marked question is refused");
  await http("PUT", `/api/assignments/${assignment.id}`, { questions: [{ id: "q2", questionText: "Explain the sky.", maxScore: 1, type: "written" }, Q3fixed] }, cookie);
  const remWritten = await http("POST", `/api/assignments/${assignment.id}/questions/q2/remark`, {}, cookie);
  ok("re-mark on a written question -> 400", remWritten.status === 400, remWritten.json?.message || "");

  console.log(`\n${fail === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${fail} failed.\x1b[0m`}`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
