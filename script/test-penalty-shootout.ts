// Penalty Shootout — end-to-end test.
//
// Plays full games as a fake Stage 3 student against the RUNNING dev server
// and checks:
//   * the subject list only offers subjects the child is enrolled in,
//   * every shot in a game is a DIFFERENT question, so a thin subject gets a
//     shorter (but still even) game rather than the same question twice,
//   * the answer key NEVER reaches the browser,
//   * shots are marked by the server (right and wrong both behave),
//   * the score, personal best, "new record" flag and XP are all correct,
//   * XP is 2 per correct answer through the existing capped system,
//   * playing counts towards the daily streak,
//   * repeated answers cannot inflate a score,
//   * a Form 1 (secondary) student is blocked from every endpoint.
//
// Usage:
//   1. Terminal A:  npm run dev
//   2. Terminal B:  npx tsx script/test-penalty-shootout.ts
//
// It creates its own Stage 3 student and its own assignments each run, targeted
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

  // --- A THIN subject: 6 playable questions, so a 3 + 3 game. ---
  const THIN = `Thin Subject ${stamp}`;
  const THIN_ANSWERS: Record<string, string> = { t1: "4", t2: "7", t3: "15", t4: "true", t5: "1", t6: "false" };
  await storage.createAssignment({
    subject: THIN, form: "Stage 3", title: `Thin ${stamp}`, instructions: "Quiz.",
    questions: [
      { id: "t1", questionText: "2 + 2 = ?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 },
      { id: "t2", questionText: "10 - 3 = ?", maxScore: 1, type: "numeric", correctNumber: 7, tolerance: 0 },
      { id: "t3", questionText: "5 x 3 = ?", maxScore: 1, type: "numeric", correctNumber: 15, tolerance: 0 },
      { id: "t4", questionText: "A triangle has 3 sides.", maxScore: 1, type: "true_false", correctBool: true },
      { id: "t5", questionText: "Which is even?", maxScore: 1, type: "multiple_choice", options: ["3", "8", "5"], correctOption: 1 },
      { id: "t6", questionText: "A circle has corners.", maxScore: 1, type: "true_false", correctBool: false },
      { id: "t7", questionText: "Write about your holiday.", maxScore: 5, type: "written" },
    ] as any,
    dueDate: "2027-01-01", totalMarks: 11, createdById: teacher.id,
    targetStudentIds: [student.id] as any,
  });

  // --- A FULL subject: 12 playable questions, so the full 5 + 5 game. ---
  const FULL = `Full Subject ${stamp}`;
  const FULL_ANSWERS: Record<string, string> = {};
  const fullQuestions = Array.from({ length: 12 }).map((_, i) => {
    const id = `f${i + 1}`;
    FULL_ANSWERS[id] = String(i + 1);
    return { id, questionText: `What is ${i} + 1?`, maxScore: 1, type: "numeric", correctNumber: i + 1, tolerance: 0 };
  });
  await storage.createAssignment({
    subject: FULL, form: "Stage 3", title: `Full ${stamp}`, instructions: "Quiz.",
    questions: fullQuestions as any,
    dueDate: "2027-01-01", totalMarks: 12, createdById: teacher.id,
    targetStudentIds: [student.id] as any,
  });

  // --- Another form's subject, to prove subjects don't leak across classes. ---
  const OTHER = `Form Only ${stamp}`;
  await storage.createAssignment({
    subject: OTHER, form: "Form 1", title: `Form Only ${stamp}`, instructions: "x",
    questions: [{ id: "x1", questionText: "1 + 1 = ?", maxScore: 1, type: "numeric", correctNumber: 2, tolerance: 0 }] as any,
    dueDate: "2027-01-01", totalMarks: 1, createdById: teacher.id,
  });

  // === 1. Forms are blocked everywhere ===
  console.log("1) Secondary (Forms) cannot reach the game at all");
  const f = form1.id;
  check("subjects -> 403", (await http("GET", `/api/students/${f}/penalty/subjects`)).status === 403);
  check("start -> 403", (await http("POST", `/api/students/${f}/penalty/start`, { subject: OTHER })).status === 403);
  check("answer -> 403", (await http("POST", `/api/students/${f}/penalty/answer`, { subject: OTHER, questionId: "x1", answerText: "2" })).status === 403);
  check("finish -> 403", (await http("POST", `/api/students/${f}/penalty/finish`, { subject: OTHER, answers: [] })).status === 403);

  // === 2. Subject list ===
  console.log("\n2) Subject list, with the right game length for each");
  const subs = await http("GET", `/api/students/${student.id}/penalty/subjects`);
  const list = subs.json?.subjects ?? [];
  const thin = list.find((s: any) => s.subject === THIN);
  const full = list.find((s: any) => s.subject === FULL);
  check("our thin subject is offered", !!thin);
  check("our full subject is offered", !!full);
  check("another form's subject is NOT offered", !list.some((s: any) => s.subject === OTHER));
  check("the hand-marked 'written' question is not counted", thin?.questionCount === 6, `count=${thin?.questionCount}`);
  check("thin subject makes a 3 + 3 game", thin?.perRound === 3 && thin?.shots === 6, `perRound=${thin?.perRound} shots=${thin?.shots}`);
  check("full subject makes the full 5 + 5 game", full?.perRound === 5 && full?.shots === 10, `perRound=${full?.perRound} shots=${full?.shots}`);
  check("no personal best yet", thin?.bestOutOf === 0 && thin?.gamesPlayed === 0);

  // === 3. A game never asks the same question twice ===
  console.log("\n3) Every shot is a different question");
  const startFull = await http("POST", `/api/students/${student.id}/penalty/start`, { subject: FULL });
  const fullShots = startFull.json?.shots ?? [];
  check("10 shots for the full subject", fullShots.length === 10, `shots=${fullShots.length}`);
  const fullIds = fullShots.map((s: any) => s.questionId);
  check("all 10 question ids are distinct", new Set(fullIds).size === 10, `distinct=${new Set(fullIds).size}`);
  check("first 5 are the striker round", fullShots.slice(0, 5).every((s: any) => s.round === "striker"));
  check("last 5 are the keeper round", fullShots.slice(5).every((s: any) => s.round === "keeper"));

  const startThin = await http("POST", `/api/students/${student.id}/penalty/start`, { subject: THIN });
  const thinShots = startThin.json?.shots ?? [];
  check("a thin subject gives 6 shots, not 10 with repeats", thinShots.length === 6, `shots=${thinShots.length}`);
  check("all 6 thin question ids are distinct", new Set(thinShots.map((s: any) => s.questionId)).size === 6);
  check("thin game is still even: 3 shots, 3 saves",
    thinShots.filter((s: any) => s.round === "striker").length === 3 &&
    thinShots.filter((s: any) => s.round === "keeper").length === 3);
  check("every shot has at least 2 big buttons", fullShots.every((s: any) => (s.options?.length ?? 0) >= 2));

  // The important one: nothing in the payload may reveal the answer.
  const raw = JSON.stringify(startFull.json);
  const leaks = ["correctOption", "correctBool", "correctNumber", "acceptedAnswers", "correctAnswerDisplay", "explanation"];
  check("no answer key of any kind is sent to the browser",
    leaks.every((k) => !raw.includes(k)), leaks.filter((k) => raw.includes(k)).join(", ") || "clean");

  // === 4. Marking one shot ===
  console.log("\n4) The server marks each shot");
  const right = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: THIN, questionId: "t1", answerText: "4" });
  check("a right answer is correct", right.json?.correct === true);
  const wrong = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: THIN, questionId: "t1", answerText: "9" });
  check("a wrong answer is not correct", wrong.json?.correct === false);
  check("a wrong answer reveals the right one", wrong.json?.correctAnswerDisplay === "4", `got "${wrong.json?.correctAnswerDisplay}"`);
  const foreign = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: THIN, questionId: "x1", answerText: "2" });
  check("a question from another form is refused (404)", foreign.status === 404, `status=${foreign.status}`);

  // === 5. Play a full game: 7 right out of 10 ===
  console.log("\n5) Play the full subject — 7 correct out of 10");
  const answers = fullShots.map((s: any, i: number) => ({
    questionId: s.questionId,
    round: s.round,
    answerText: i < 7 ? FULL_ANSWERS[s.questionId] : "999999", // miss the last three
  }));
  const xpBefore = (await storage.getStudentXp(student.id))?.totalXp ?? 0;
  const finish = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers });
  const r = finish.json;
  check("score is 7 out of 10", r?.score === 7 && r?.outOf === 10, `score=${r?.score}/${r?.outOf}`);
  check("striker + keeper add up to the score", (r?.strikerScore + r?.keeperScore) === r?.score,
    `striker=${r?.strikerScore} keeper=${r?.keeperScore}`);
  check("first game is a new personal best", r?.newRecord === true && r?.previousOutOf === 0);
  check("best saved as 7 out of 10", r?.bestScore === 7 && r?.bestOutOf === 10, `best=${r?.bestScore}/${r?.bestOutOf}`);

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

  // === 8. Records only move when genuinely beaten ===
  console.log("\n8) Personal best only moves when it is beaten");
  const worse = fullShots.map((s: any, i: number) => ({
    questionId: s.questionId, round: s.round, answerText: i < 3 ? FULL_ANSWERS[s.questionId] : "999999",
  }));
  const second = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers: worse });
  check("a worse game is not a new record", second.json?.newRecord === false, `score=${second.json?.score}`);
  check("best stays at 7 out of 10", second.json?.bestScore === 7 && second.json?.bestOutOf === 10);
  check("games played is now 2", second.json?.gamesPlayed === 2, `played=${second.json?.gamesPlayed}`);

  const perfect = fullShots.map((s: any) => ({ questionId: s.questionId, round: s.round, answerText: FULL_ANSWERS[s.questionId] }));
  const third = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers: perfect });
  check("a perfect game is 10 out of 10", third.json?.score === 10, `score=${third.json?.score}`);
  check("a perfect game IS a new record", third.json?.newRecord === true && third.json?.previousBest === 7);
  check("best is now 10 out of 10", third.json?.bestScore === 10 && third.json?.bestOutOf === 10);

  // === 9. Bests are kept per subject, at that subject's own length ===
  console.log("\n9) Each subject keeps its own record, at its own length");
  const thinAnswers = thinShots.map((s: any, i: number) => ({
    questionId: s.questionId, round: s.round, answerText: i < 4 ? THIN_ANSWERS[s.questionId] : "999999",
  }));
  const thinGame = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: THIN, answers: thinAnswers });
  check("thin game scores 4 out of 6", thinGame.json?.score === 4 && thinGame.json?.outOf === 6,
    `score=${thinGame.json?.score}/${thinGame.json?.outOf}`);
  check("thin subject keeps its own record", thinGame.json?.bestScore === 4 && thinGame.json?.bestOutOf === 6);

  const subs2 = await http("GET", `/api/students/${student.id}/penalty/subjects`);
  const list2 = subs2.json?.subjects ?? [];
  check("full subject still shows 10/10", list2.find((s: any) => s.subject === FULL)?.bestScore === 10);
  check("thin subject shows 4/6", list2.find((s: any) => s.subject === THIN)?.bestOutOf === 6);

  // === 10. Repeated answers cannot inflate a score ===
  console.log("\n10) The score cannot be inflated from the browser");
  const flood = Array.from({ length: 50 }).map(() => ({ questionId: "f1", round: "striker", answerText: FULL_ANSWERS.f1 }));
  const flooded = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers: flood });
  check("50 copies of one right answer score only 1", flooded.json?.score === 1, `score=${flooded.json?.score}`);
  check("...still out of the real game length", flooded.json?.outOf === 10, `outOf=${flooded.json?.outOf}`);
  check("...and it is not a new record", flooded.json?.newRecord === false);

  const roundFlood = fullShots.map((s: any) => ({ questionId: s.questionId, round: "keeper", answerText: FULL_ANSWERS[s.questionId] }));
  const rf = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers: roundFlood });
  check("claiming every answer for one round can't exceed that round",
    rf.json?.keeperScore <= 5, `keeper=${rf.json?.keeperScore}`);

  console.log(`\n${failures === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${failures} check(s) failed.\x1b[0m`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
