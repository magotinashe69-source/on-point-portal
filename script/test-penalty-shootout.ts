// Penalty Shootout — end-to-end test.
//
// Plays full games as a fake Stage 3 student against the RUNNING dev server
// and checks:
//   * the subject list only offers subjects the child is enrolled in,
//   * every game is a strict 5 + 5 of DIFFERENT questions, and a subject with
//     fewer than 10 playable questions is hidden rather than played short,
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

  // A shot is identified by "assignmentId:questionId", because question ids are
  // only unique WITHIN an assignment — nearly every assignment has a "q1".
  const ref = (assignmentId: number, questionId: string) => `${assignmentId}:${questionId}`;

  // --- A THIN subject: only 6 playable questions, so it must be hidden. ---
  const THIN = `Thin Subject ${stamp}`;
  const thinAssignment = await storage.createAssignment({
    subject: THIN, form: "Stage 3", title: `Thin ${stamp}`, instructions: "Quiz.",
    questions: [
      { id: "q1", questionText: "2 + 2 = ?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 },
      { id: "q2", questionText: "10 - 3 = ?", maxScore: 1, type: "numeric", correctNumber: 7, tolerance: 0 },
      { id: "q3", questionText: "5 x 3 = ?", maxScore: 1, type: "numeric", correctNumber: 15, tolerance: 0 },
      { id: "q4", questionText: "A triangle has 3 sides.", maxScore: 1, type: "true_false", correctBool: true },
      { id: "q5", questionText: "Which is even?", maxScore: 1, type: "multiple_choice", options: ["3", "8", "5"], correctOption: 1 },
      { id: "q6", questionText: "A circle has corners.", maxScore: 1, type: "true_false", correctBool: false },
      { id: "q7", questionText: "Write about your holiday.", maxScore: 5, type: "written" },
    ] as any,
    dueDate: "2027-01-01", totalMarks: 11, createdById: teacher.id,
    targetStudentIds: [student.id] as any,
  });
  const THIN_ANSWERS: Record<string, string> = {
    [ref(thinAssignment.id, "q1")]: "4",
    [ref(thinAssignment.id, "q2")]: "7",
    [ref(thinAssignment.id, "q3")]: "15",
    [ref(thinAssignment.id, "q4")]: "true",
    [ref(thinAssignment.id, "q5")]: "1",
    [ref(thinAssignment.id, "q6")]: "false",
  };

  // --- A FULL subject spread over TWO assignments that BOTH use q1..q6. ---
  // This is the real shape of the data: ids repeat, so the game must tell the
  // two "q1"s apart or it would see one question where there are two.
  const FULL = `Full Subject ${stamp}`;
  const FULL_ANSWERS: Record<string, string> = {};
  const half = (offset: number) => Array.from({ length: 6 }).map((_, i) => ({
    id: `q${i + 1}`,
    questionText: `What is ${offset + i} + 1?`,
    maxScore: 1, type: "numeric", correctNumber: offset + i + 1, tolerance: 0,
  }));
  const fullA = await storage.createAssignment({
    subject: FULL, form: "Stage 3", title: `Full A ${stamp}`, instructions: "Quiz.",
    questions: half(0) as any, dueDate: "2027-01-01", totalMarks: 6,
    createdById: teacher.id, targetStudentIds: [student.id] as any,
  });
  const fullB = await storage.createAssignment({
    subject: FULL, form: "Stage 3", title: `Full B ${stamp}`, instructions: "Quiz.",
    questions: half(100) as any, dueDate: "2027-01-01", totalMarks: 6,
    createdById: teacher.id, targetStudentIds: [student.id] as any,
  });
  for (let i = 0; i < 6; i++) {
    FULL_ANSWERS[ref(fullA.id, `q${i + 1}`)] = String(i + 1);
    FULL_ANSWERS[ref(fullB.id, `q${i + 1}`)] = String(100 + i + 1);
  }

  // --- Another form's subject, to prove subjects don't leak across classes. ---
  const OTHER = `Form Only ${stamp}`;
  const otherAssignment = await storage.createAssignment({
    subject: OTHER, form: "Form 1", title: `Form Only ${stamp}`, instructions: "x",
    questions: [{ id: "q1", questionText: "1 + 1 = ?", maxScore: 1, type: "numeric", correctNumber: 2, tolerance: 0 }] as any,
    dueDate: "2027-01-01", totalMarks: 1, createdById: teacher.id,
  });

  // === 1. Forms are blocked everywhere ===
  console.log("1) Secondary (Forms) cannot reach the game at all");
  const f = form1.id;
  check("subjects -> 403", (await http("GET", `/api/students/${f}/penalty/subjects`)).status === 403);
  check("start -> 403", (await http("POST", `/api/students/${f}/penalty/start`, { subject: OTHER })).status === 403);
  check("answer -> 403", (await http("POST", `/api/students/${f}/penalty/answer`, { subject: OTHER, ref: ref(otherAssignment.id, "q1"), answerText: "2" })).status === 403);
  check("finish -> 403", (await http("POST", `/api/students/${f}/penalty/finish`, { subject: OTHER, answers: [] })).status === 403);

  // === 2. Subject list — thin subjects are hidden ===
  console.log("\n2) Only subjects with a full game's worth of questions are offered");
  const subs = await http("GET", `/api/students/${student.id}/penalty/subjects`);
  const list = subs.json?.subjects ?? [];
  const thin = list.find((s: any) => s.subject === THIN);
  const full = list.find((s: any) => s.subject === FULL);
  check("our full subject is offered", !!full);
  check("the 6-question subject is HIDDEN", !thin, thin ? "it was offered" : "hidden");
  check("another form's subject is NOT offered", !list.some((s: any) => s.subject === OTHER));
  check("every offered subject has at least 10 questions",
    list.every((s: any) => s.questionCount >= 10),
    list.map((s: any) => `${s.subject}:${s.questionCount}`).join(", "));
  // The bug this guards: both assignments use q1..q6, so counting bare question
  // ids would see 6 questions here instead of 12 and hide the subject.
  check("questions repeated across assignments are counted separately",
    full?.questionCount === 12, `count=${full?.questionCount}`);
  check("no personal best yet", full?.bestOutOf === 0 && full?.gamesPlayed === 0);

  // === 3. A game is a strict 5 + 5 of different questions ===
  console.log("\n3) Every game is 5 + 5, and every shot a different question");
  const startFull = await http("POST", `/api/students/${student.id}/penalty/start`, { subject: FULL });
  const fullShots = startFull.json?.shots ?? [];
  check("10 shots", fullShots.length === 10, `shots=${fullShots.length}`);
  const fullIds = fullShots.map((s: any) => s.ref);
  check("all 10 questions are distinct", new Set(fullIds).size === 10, `distinct=${new Set(fullIds).size}`);
  check("shots name their assignment as well as the question",
    fullShots.every((s: any) => /^\d+:.+/.test(s.ref ?? "")), fullShots[0]?.ref);
  check("the two assignments' identical q1s are told apart",
    fullShots.every((s: any) => FULL_ANSWERS[s.ref] !== undefined), "every shot resolves to a known answer");
  check("first 5 are the striker round", fullShots.slice(0, 5).every((s: any) => s.round === "striker"));
  check("last 5 are the keeper round", fullShots.slice(5).every((s: any) => s.round === "keeper"));
  check("the server reports 5 per round", startFull.json?.perRound === 5, `perRound=${startFull.json?.perRound}`);
  check("every shot has at least 2 big buttons", fullShots.every((s: any) => (s.options?.length ?? 0) >= 2));

  // A hidden subject must also refuse to start, not just be left off the list.
  const startThin = await http("POST", `/api/students/${student.id}/penalty/start`, { subject: THIN });
  check("starting a hidden subject is refused (400)", startThin.status === 400, `status=${startThin.status}`);
  check("...with a message that explains why", (startThin.json?.message ?? "").includes("10"), startThin.json?.message);

  // The important one: nothing in the payload may reveal the answer.
  const raw = JSON.stringify(startFull.json);
  const leaks = ["correctOption", "correctBool", "correctNumber", "acceptedAnswers", "correctAnswerDisplay", "explanation"];
  check("no answer key of any kind is sent to the browser",
    leaks.every((k) => !raw.includes(k)), leaks.filter((k) => raw.includes(k)).join(", ") || "clean");

  // === 4. Marking one shot ===
  console.log("\n4) The server marks each shot");
  const q1A = ref(fullA.id, "q1"); // "What is 0 + 1?"  -> 1
  const q1B = ref(fullB.id, "q1"); // "What is 100 + 1?" -> 101
  const right = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: FULL, ref: q1A, answerText: "1" });
  check("a right answer is correct", right.json?.correct === true);
  const wrong = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: FULL, ref: q1A, answerText: "9" });
  check("a wrong answer is not correct", wrong.json?.correct === false);
  check("a wrong answer reveals the right one", wrong.json?.correctAnswerDisplay === "1", `got "${wrong.json?.correctAnswerDisplay}"`);

  // The heart of it: two questions both called "q1" must be marked separately.
  const otherQ1 = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: FULL, ref: q1B, answerText: "101" });
  check("the OTHER assignment's q1 marks against its own answer", otherQ1.json?.correct === true);
  const crossed = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: FULL, ref: q1B, answerText: "1" });
  check("...and does not accept the first q1's answer", crossed.json?.correct === false,
    `correctAnswer="${crossed.json?.correctAnswerDisplay}"`);
  check("...revealing its own correct answer", crossed.json?.correctAnswerDisplay === "101", `got "${crossed.json?.correctAnswerDisplay}"`);

  const foreign = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: FULL, ref: ref(otherAssignment.id, "q1"), answerText: "2" });
  check("a question from another form is refused (404)", foreign.status === 404, `status=${foreign.status}`);
  const nonsense = await http("POST", `/api/students/${student.id}/penalty/answer`, { subject: FULL, ref: "not-a-ref", answerText: "1" });
  check("a malformed reference is refused (404)", nonsense.status === 404, `status=${nonsense.status}`);

  // === 5. Play a full game: 7 right out of 10 ===
  console.log("\n5) Play the full subject — 7 correct out of 10");
  const answers = fullShots.map((s: any, i: number) => ({
    ref: s.ref,
    round: s.round,
    answerText: i < 7 ? FULL_ANSWERS[s.ref] : "999999", // miss the last three
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
    ref: s.ref, round: s.round, answerText: i < 3 ? FULL_ANSWERS[s.ref] : "999999",
  }));
  const second = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers: worse });
  check("a worse game is not a new record", second.json?.newRecord === false, `score=${second.json?.score}`);
  check("best stays at 7 out of 10", second.json?.bestScore === 7 && second.json?.bestOutOf === 10);
  check("games played is now 2", second.json?.gamesPlayed === 2, `played=${second.json?.gamesPlayed}`);

  const perfect = fullShots.map((s: any) => ({ ref: s.ref, round: s.round, answerText: FULL_ANSWERS[s.ref] }));
  const third = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers: perfect });
  check("a perfect game is 10 out of 10", third.json?.score === 10, `score=${third.json?.score}`);
  check("a perfect game IS a new record", third.json?.newRecord === true && third.json?.previousBest === 7);
  check("best is now 10 out of 10", third.json?.bestScore === 10 && third.json?.bestOutOf === 10);

  // === 9. A hidden subject cannot be scored at all ===
  console.log("\n9) A hidden subject can't be finished either");
  const thinAnswers = Object.entries(THIN_ANSWERS).map(([r, answerText], i) => ({
    ref: r, answerText, round: i < 3 ? "striker" : "keeper",
  }));
  const thinGame = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: THIN, answers: thinAnswers });
  check("all-correct answers in a hidden subject score 0", thinGame.json?.score === 0, `score=${thinGame.json?.score}`);
  check("...and set no record", thinGame.json?.newRecord === false && thinGame.json?.playable === false);
  const thinBest = await storage.getPenaltyBest(student.id, THIN);
  check("...and write no row at all", !thinBest, thinBest ? "a row was written" : "no row");

  const subs2 = await http("GET", `/api/students/${student.id}/penalty/subjects`);
  const list2 = subs2.json?.subjects ?? [];
  check("full subject shows 10/10", list2.find((s: any) => s.subject === FULL)?.bestScore === 10);
  check("thin subject is still hidden", !list2.some((s: any) => s.subject === THIN));

  // === 10. Repeated answers cannot inflate a score ===
  console.log("\n10) The score cannot be inflated from the browser");
  const flood = Array.from({ length: 50 }).map(() => ({ ref: q1A, round: "striker", answerText: FULL_ANSWERS[q1A] }));
  const flooded = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers: flood });
  check("50 copies of one right answer score only 1", flooded.json?.score === 1, `score=${flooded.json?.score}`);
  check("...still out of the real game length", flooded.json?.outOf === 10, `outOf=${flooded.json?.outOf}`);
  check("...and it is not a new record", flooded.json?.newRecord === false);

  const roundFlood = fullShots.map((s: any) => ({ ref: s.ref, round: "keeper", answerText: FULL_ANSWERS[s.ref] }));
  const rf = await http("POST", `/api/students/${student.id}/penalty/finish`, { subject: FULL, answers: roundFlood });
  check("claiming every answer for one round can't exceed that round",
    rf.json?.keeperScore <= 5, `keeper=${rf.json?.keeperScore}`);

  console.log(`\n${failures === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${failures} check(s) failed.\x1b[0m`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
