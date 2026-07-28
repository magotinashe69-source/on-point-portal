// Penalty Shootout — end-to-end test.
//
// Plays a full game as a fake Stage 3 student against the RUNNING dev server
// and checks:
//   * the subject list only offers subjects the child is enrolled in,
//   * a game is 10 shots: 5 striker then 5 keeper, with big-button options,
//   * the answer key NEVER reaches the browser,
//   * shots are marked by the server (right and wrong both behave),
//   * the score, personal best, "new record" flag and XP are all correct,
//   * XP is 2 per correct answer through the existing capped system,
//   * playing counts towards the daily streak,
//   * a Form 1 (secondary) student is blocked from every endpoint.
//
// Usage:
//   1. Terminal A:  npm run dev
//   2. Terminal B:  npx tsx script/test-penalty-shootout.ts
//
// It creates its own Stage 3 student and its own assignment each run, targeted
// to that student, so it never disturbs real data.

import { storage } from "../server/storage";

const BASE = "http://localhost:5000";
const TEACHER_EMAIL = "onpointeducationcentremoza@gmail.com";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function http(method: string, path: string, body?: any) {
  const res = await fetch(BASE + path, {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function main() {
  console.log("Penalty Shootout — end-to-end test\n");

  const teacher = await storage.getTeacherByEmail(TEACHER_EMAIL);
  if (!teacher) { console.error("No seeded teacher found."); process.exit(1); }

  const stamp = Date.now();
  const student = await storage.createStudent({
    studentId: `PK-${stamp}`, fullName: "Penalty Pele", gender: "Male", form: "Stage 3", role: "student",
  });
  const form1 = await storage.createStudent({
    studentId: `PK-F1-${stamp}`, fullName: "Form One Control", gender: "Female", form: "Form 1", role: "student",
  });
  console.log(`Stage 3 student: #${student.id} • Form 1 control: #${form1.id}\n`);

  // A subject with a good mix of question types, targeted to this student only.
  const SUBJECT = `Football Maths ${stamp}`;
  await storage.createAssignment({
    subject: SUBJECT, form: "Stage 3", title: `Penalty Practice ${stamp}`, instructions: "Quiz questions.",
    questions: [
      { id: "p1", questionText: "2 + 2 = ?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 },
      { id: "p2", questionText: "10 - 3 = ?", maxScore: 1, type: "numeric", correctNumber: 7, tolerance: 0 },
      { id: "p3", questionText: "5 x 3 = ?", maxScore: 1, type: "numeric", correctNumber: 15, tolerance: 0 },
      { id: "p4", questionText: "A triangle has 3 sides.", maxScore: 1, type: "true_false", correctBool: true },
      { id: "p5", questionText: "Which is even?", maxScore: 1, type: "multiple_choice", options: ["3", "8", "5"], correctOption: 1 },
      { id: "p6", questionText: "A circle has corners.", maxScore: 1, type: "true_false", correctBool: false },
      { id: "p7", questionText: "Write about your holiday.", maxScore: 5, type: "written" },
    ] as any,
    dueDate: "2027-01-01", totalMarks: 11, createdById: teacher.id,
    targetStudentIds: [student.id] as any,
  });

  // A different subject for ANOTHER form, to prove subjects don't leak across classes.
  const OTHER_SUBJECT = `Form Only ${stamp}`;
  await storage.createAssignment({
    subject: OTHER_SUBJECT, form: "Form 1", title: `Form Only ${stamp}`, instructions: "x",
    questions: [{ id: "f1", questionText: "1 + 1 = ?", maxScore: 1, type: "numeric", correctNumber: 2, tolerance: 0 }] as any,
    dueDate: "2027-01-01", totalMarks: 1, createdById: teacher.id,
  });

  // === 1. Forms are blocked everywhere ===
  console.log("1) Secondary (Forms) cannot reach the game at all");
  const f = form1.id;
  check("subjects -> 403", (await http("GET", `/api/students/${f}/penalty/subjects`)).status === 403);
  check("start -> 403", (await http("POST", `/api/students/${f}/penalty/start`, { subject: OTHER_SUBJECT })).status === 403);
  check("answer -> 403", (await http("POST", `/api/students/${f}/penalty/answer`, { subject: OTHER_SUBJECT, questionId: "f1", answerText: "2" })).status === 403);
  check("finish -> 403", (await http("POST", `/api/students/${f}/penalty/finish`, { subject: OTHER_SUBJECT, answers: [] })).status === 403);

  // === 2. Subject list ===
  console.log("\n2) Subject list offers only this child's own subjects");
  const subs = await http("GET", `/api/students/${student.id}/penalty/subjects`);
  const mine = (subs.json?.subjects ?? []).find((s: any) => s.subject === SUBJECT);
  check("our subject is offered", !!mine, `subjects=${(subs.json?.subjects ?? []).map((s: any) => s.subject).join(", ")}`);
  check("another form's subject is NOT offered", !(subs.json?.subjects ?? []).some((s: any) => s.subject === OTHER_SUBJECT));
  check("the hand-marked 'written' question is not counted", mine?.questionCount === 6, `count=${mine?.questionCount}`);
  check("starts with no personal best", mine?.bestScore === 0 && mine?.gamesPlayed === 0);

  // === 3. Starting a game ===
  console.log("\n3) A game is 10 shots and carries no answers");
  const start = await http("POST", `/api/students/${student.id}/penalty/start`, { subject: SUBJECT });
  const shots = start.json?.shots ?? [];
  check("10 shots", shots.length === 10, `shots=${shots.length}`);
  check("first 5 are the striker round", shots.slice(0, 5).every((s: any) => s.round === "striker"));
  check("last 5 are the keeper round", shots.slice(5).every((s: any) => s.round === "keeper"));
  check("every shot has at least 2 big buttons", shots.every((s: any) => (s.options?.length ?? 0) >= 2));
  check("every shot has its question text", shots.every((s: any) => !!s.questionText));

  // The important one: nothing in the payload may reveal the answer.
  const raw = JSON.stringify(start.json);
  const leaks = ["correctOption", "correctBool", "correctNumber", "acceptedAnswers", "correctAnswerDisplay", "explanation"];
  check("no answer key of any kind is sent to the browser",
    leaks.every((k) => !raw.includes(k)), leaks.filter((k) => raw.includes(k)).join(", ") || "clean");

  // === 4. Marking one shot ===
  console.log("\n4) The server marks each shot");
  const right = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: SUBJECT, questionId: "p1", answerText: "4" });
  check("a right answer is correct", right.json?.correct === true);
  const wrong = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: SUBJECT, questionId: "p1", answerText: "9" });
  check("a wrong answer is not correct", wrong.json?.correct === false);
  check("a wrong answer reveals the right one", wrong.json?.correctAnswerDisplay === "4", `got "${wrong.json?.correctAnswerDisplay}"`);
  const foreign = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: SUBJECT, questionId: "f1", answerText: "2" });
  check("a question from another form is refused (404)", foreign.status === 404, `status=${foreign.status}`);

  // === 5. Play a full game: 7 right, 3 wrong ===
  console.log("\n5) Play a full game — 7 correct out of 10");
  const CORRECT: Record<string, string> = { p1: "4", p2: "7", p3: "15", p4: "true", p5: "1", p6: "false" };
  const answers = shots.map((s: any, i: number) => ({
    questionId: s.questionId,
    round: s.round,
    // Deliberately miss shots 8, 9 and 10 so the score is a known 7.
    answerText: i < 7 ? CORRECT[s.questionId] : "999999",
  }));
  const xpBefore = (await storage.getStudentXp(student.id))?.totalXp ?? 0;
  const finish = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: SUBJECT, answers });
  const r = finish.json;
  check("score is 7 out of 10", r?.score === 7 && r?.outOf === 10, `score=${r?.score}/${r?.outOf}`);
  check("striker + keeper add up to the score", (r?.strikerScore + r?.keeperScore) === r?.score,
    `striker=${r?.strikerScore} keeper=${r?.keeperScore}`);
  check("first game is a new personal best", r?.newRecord === true && r?.previousBest === 0);
  check("best score saved as 7", r?.bestScore === 7, `best=${r?.bestScore}`);

  // === 6. XP through the existing capped system ===
  console.log("\n6) XP is 2 per correct answer, through the existing system");
  const xpAfter = (await storage.getStudentXp(student.id))?.totalXp ?? 0;
  check("XP rose by 14 (7 correct x 2)", xpAfter - xpBefore === 14, `before=${xpBefore} after=${xpAfter}`);
  check("the award reports 2 per correct", r?.xp?.breakdown?.perCorrect === 2 && r?.xp?.breakdown?.correct === 7,
    JSON.stringify(r?.xp?.breakdown));

  // === 7. Streaks ===
  console.log("\n7) Playing counts towards the daily streak");
  const streak = await storage.getStudentStreak(student.id);
  check("a streak row now exists", !!streak);
  check("the streak counted today", (streak?.currentStreak ?? 0) >= 1, `current=${streak?.currentStreak}`);

  // === 8. Beating (and not beating) the record ===
  console.log("\n8) Personal best only moves when it is beaten");
  const worse = shots.map((s: any, i: number) => ({
    questionId: s.questionId, round: s.round, answerText: i < 3 ? CORRECT[s.questionId] : "999999",
  }));
  const second = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: SUBJECT, answers: worse });
  check("a worse game is not a new record", second.json?.newRecord === false, `score=${second.json?.score}`);
  check("best stays at 7", second.json?.bestScore === 7, `best=${second.json?.bestScore}`);
  check("games played is now 2", second.json?.gamesPlayed === 2, `played=${second.json?.gamesPlayed}`);

  const better = shots.map((s: any) => ({ questionId: s.questionId, round: s.round, answerText: CORRECT[s.questionId] }));
  const third = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: SUBJECT, answers: better });
  check("a perfect game is 10 out of 10", third.json?.score === 10, `score=${third.json?.score}`);
  check("a perfect game IS a new record", third.json?.newRecord === true && third.json?.previousBest === 7);
  check("best is now 10", third.json?.bestScore === 10);

  // === 9. The best shows up on the subject list ===
  console.log("\n9) The subject list shows the record to beat");
  const subs2 = await http("GET", `/api/students/${student.id}/penalty/subjects`);
  const mine2 = (subs2.json?.subjects ?? []).find((s: any) => s.subject === SUBJECT);
  check("personal best is 10", mine2?.bestScore === 10, `best=${mine2?.bestScore}`);
  check("games played is 3", mine2?.gamesPlayed === 3, `played=${mine2?.gamesPlayed}`);

  // === 10. Cheating guards ===
  console.log("\n10) The score cannot be inflated from the browser");
  const flood = Array.from({ length: 50 }).map(() => ({ questionId: "p1", round: "striker", answerText: "4" }));
  const flooded = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: SUBJECT, answers: flood });
  check("more than 10 answers still scores at most 10", flooded.json?.score <= 10, `score=${flooded.json?.score}`);

  console.log(`\n${failures === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${failures} check(s) failed.\x1b[0m`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
