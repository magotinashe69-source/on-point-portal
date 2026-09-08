// The games update, walked end to end as a real Stage 3 pupil.
//
// Complete 3 assignments -> 3 plays of each game -> play them down to 0 ->
// confirm both games build rounds from COMPLETED work with no "not ready" ->
// confirm Treasure Island still works -> confirm tomorrow resets the plays.
//
// Run against a live server: npx tsx <this file>

const BASE = "http://localhost:5000";
const TEACHER = { email: "onpointeducationcentremoza@gmail.com", password: "onpoint123" };

let passed = 0;
let failed = 0;
function check(ok: boolean, description: string, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${description}`); }
  else { failed++; console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`); }
}
function section(title: string) { console.log(`\n${title}`); }

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
    let json: any = null; let text = "";
    try { text = await res.text(); json = JSON.parse(text); } catch {}
    return { status: res.status, body: json, text };
  }
  get(p: string) { return this.request("GET", p); }
  post(p: string, b?: unknown) { return this.request("POST", p, b); }
  delete(p: string) { return this.request("DELETE", p); }
}

const stamp = Date.now().toString().slice(-6);

/** A quiz assignment whose questions can all become targets. */
function quizAssignment(subject: string, topic: string, title: string, ids: string[]) {
  return {
    subject, topic, form: "Stage 3", title, instructions: "Answer all questions.",
    dueDate: "2026-12-01", totalMarks: ids.length, createdById: 1,
    questions: ids.map((id, i) => ({
      id, questionText: `${topic} question ${i + 1}: what is ${i + 2} + ${i + 2}?`,
      maxScore: 1, type: "numeric", correctNumber: (i + 2) * 2, tolerance: 0,
    })),
  };
}

async function main() {
  const teacher = new Session();
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (!login.body?.success) throw new Error("teacher login failed");

  section("Setting up a Stage 3 pupil with three assignments");

  const child = (await teacher.post("/api/students", {
    studentId: `G3-${stamp}`, fullName: `Games Test Child ${stamp}`, gender: "Female", form: "Stage 3",
  })).body?.student;
  check(!!child, "Stage 3 pupil created");
  if (!child) return finish();

  const a1 = (await teacher.post("/api/assignments", quizAssignment("MATHS", "Adding", `Adding ${stamp}`, ["m1", "m2", "m3"]))).body?.assignment;
  const a2 = (await teacher.post("/api/assignments", quizAssignment("SCIENCE", "Plants", `Plants ${stamp}`, ["s1", "s2"]))).body?.assignment;
  const a3 = (await teacher.post("/api/assignments", quizAssignment("ENGLISH", "Words", `Words ${stamp}`, ["e1", "e2"]))).body?.assignment;
  const a4 = (await teacher.post("/api/assignments", quizAssignment("HISTORY", "Long ago", `History ${stamp}`, ["h1", "h2"]))).body?.assignment;
  check(!!a1 && !!a2 && !!a3 && !!a4, "four assignments created (three to complete, one left undone)");
  if (!a1 || !a2 || !a3 || !a4) return finish();

  const pupil = new Session();
  const pupilLogin = await pupil.post("/api/auth/student/login", { fullName: child.fullName, password: "gamepw123" });
  check(pupilLogin.body?.success === true, "the pupil can log in");

  // =========================================================================
  section("Before any homework: no plays, and nothing to play");
  // =========================================================================

  const before = await pupil.get(`/api/students/${child.id}/plays`);
  check(before.status === 200, "the plays endpoint answers a pupil", `status ${before.status}`);
  check(before.body?.plays?.blaster?.left === 0 && before.body?.plays?.penalty?.left === 0,
    "no plays before any homework is handed in", JSON.stringify(before.body?.plays));

  const blastTooSoon = await pupil.post(`/api/students/${child.id}/blaster/start`);
  check(blastTooSoon.body?.success === false, "Target Blaster refuses when nothing has been done");

  // =========================================================================
  section("Complete 3 assignments -> 3 plays of each game");
  // =========================================================================

  for (const [assignment, answers] of [
    [a1, [{ questionId: "m1", answerText: "4" }, { questionId: "m2", answerText: "6" }, { questionId: "m3", answerText: "8" }]],
    [a2, [{ questionId: "s1", answerText: "4" }, { questionId: "s2", answerText: "6" }]],
    [a3, [{ questionId: "e1", answerText: "4" }, { questionId: "e2", answerText: "6" }]],
  ] as const) {
    await pupil.post("/api/submissions", { assignmentId: (assignment as any).id, studentId: child.id, answers });
  }

  const after3 = await pupil.get(`/api/students/${child.id}/plays`);
  check(after3.body?.plays?.blaster?.left === 3, "3 assignments = 3 plays of Target Blaster",
    `got ${after3.body?.plays?.blaster?.left}`);
  check(after3.body?.plays?.penalty?.left === 3, "3 assignments = 3 plays of Penalty Shootout",
    `got ${after3.body?.plays?.penalty?.left}`);
  check(after3.body?.plays?.blaster?.completedToday === 3, "it counts three assignments completed today",
    `got ${after3.body?.plays?.blaster?.completedToday}`);

  // =========================================================================
  section("Target Blaster: built from completed work, and plays count down");
  // =========================================================================

  const blast = await pupil.post(`/api/students/${child.id}/blaster/start`);
  check(blast.body?.success === true, "a blast starts", JSON.stringify(blast.body).slice(0, 150));
  const rounds = blast.body?.rounds || [];
  check(rounds.length === 6, "six rounds", `got ${rounds.length}`);
  check(blast.body?.plays?.left === 2, "starting a game spends a play (3 -> 2)", `got ${blast.body?.plays?.left}`);

  // Every round must come from work the child actually handed in.
  const doneTitles = [`Adding ${stamp}`, `Plants ${stamp}`, `Words ${stamp}`];
  const doneSubjects = new Set(["MATHS", "SCIENCE", "ENGLISH"]);
  check(rounds.every((r: any) => doneSubjects.has(r.subject)),
    "every round comes from a COMPLETED assignment", JSON.stringify(rounds.map((r: any) => r.subject)));
  check(!rounds.some((r: any) => r.subject === "HISTORY"),
    "the assignment they have NOT done is never used");
  check(rounds.every((r: any) => Array.isArray(r.targets) && r.targets.length >= 2),
    "every round has targets to tap");
  check(!blast.text.includes("correctNumber") && !blast.text.includes("correctOption"),
    "no answer key is sent to the browser");

  // Answer them all correctly. The right answer is in the question text
  // ("what is 4 + 4?"), which the server marks — the browser is never told.
  const blastAnswers = rounds.map((r: any) => {
    const m = /what is (\d+) \+ (\d+)\?/.exec(r.questionText);
    const value = m ? String(Number(m[1]) + Number(m[2])) : "";
    return { ref: r.ref, answerText: value };
  });
  const blastResult = await pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: blastAnswers });
  check(blastResult.body?.score === 6, "all six answered right scores 6", `got ${blastResult.body?.score}`);
  check(blastResult.body?.newRecord === true, "a first game sets a record");
  check(blastResult.body?.xp?.awarded > 0, "XP is awarded", JSON.stringify(blastResult.body?.xp));
  check(blastResult.body?.plays?.left === 2, "the play stays spent after finishing", `got ${blastResult.body?.plays?.left}`);

  // Sending the same winning game again must score nothing.
  const replay = await pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: blastAnswers });
  check(replay.body?.score === 0, "the same finished game cannot be sent up twice to score again",
    `got ${replay.body?.score}`);

  // =========================================================================
  section("Penalty Shootout: no 'not ready', questions from completed work");
  // =========================================================================

  const subjects = await pupil.get(`/api/students/${child.id}/penalty/subjects`);
  const list = subjects.body?.subjects || [];
  check(list.length >= 3, "every completed subject is offered — no 'no games ready'",
    JSON.stringify(list.map((s: any) => s.subject)));
  check(!list.some((s: any) => s.subject === "HISTORY"), "the undone subject is not offered");
  // MATHS has only 3 questions; a shootout is 10. It must still be playable.
  const maths = list.find((s: any) => s.subject === "MATHS");
  check(!!maths, "MATHS is offered even with only 3 questions (repeats are allowed)",
    JSON.stringify(list.map((s: any) => `${s.subject}:${s.questionCount}`)));

  const shootout = await pupil.post(`/api/students/${child.id}/penalty/start`, { subject: "MATHS" });
  check(shootout.body?.success === true, "a shootout starts in a thin subject",
    JSON.stringify(shootout.body).slice(0, 150));
  const shots = shootout.body?.shots || [];
  check(shots.length === 10, "ten shots, filled by repeating the three questions", `got ${shots.length}`);
  check(shootout.body?.plays?.left === 2, "it spends a penalty play (3 -> 2)", `got ${shootout.body?.plays?.left}`);
  check(!shootout.text.includes("correctNumber"), "no answer key is sent to the browser");

  const shotAnswers = shots.map((sh: any) => {
    const m = /what is (\d+) \+ (\d+)\?/.exec(sh.questionText);
    return { ref: sh.ref, answerText: m ? String(Number(m[1]) + Number(m[2])) : "", round: sh.round };
  });
  const shootResult = await pupil.post(`/api/students/${child.id}/penalty/finish`, { subject: "MATHS", answers: shotAnswers });
  check(shootResult.body?.score === 10, "all ten right scores 10, repeats included",
    `got ${shootResult.body?.score} — a repeated question must still score each time it is asked`);

  // =========================================================================
  section("Playing down to zero, then the wall");
  // =========================================================================

  // Two blaster plays left. Spend both.
  for (let i = 0; i < 2; i++) {
    const g = await pupil.post(`/api/students/${child.id}/blaster/start`);
    if (g.body?.success) {
      await pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: [] });
    }
  }
  const spentOut = await pupil.get(`/api/students/${child.id}/plays`);
  check(spentOut.body?.plays?.blaster?.left === 0, "all three blaster plays spent", `got ${spentOut.body?.plays?.blaster?.left}`);

  const refused = await pupil.post(`/api/students/${child.id}/blaster/start`);
  check(refused.body?.success === false && refused.body?.outOfPlays === true,
    "a fourth game is refused", JSON.stringify(refused.body).slice(0, 120));
  check(refused.status === 200, "and refused politely, not as an error", `status ${refused.status}`);
  check(/come back tomorrow/i.test(refused.body?.message || ""),
    "with the 'come back tomorrow' wording", refused.body?.message);

  // A fourth assignment earns a fourth play, mid-day.
  await pupil.post("/api/submissions", {
    assignmentId: a4.id, studentId: child.id,
    answers: [{ questionId: "h1", answerText: "4" }, { questionId: "h2", answerText: "6" }],
  });
  const earnedMore = await pupil.get(`/api/students/${child.id}/plays`);
  check(earnedMore.body?.plays?.blaster?.left === 1, "finishing another assignment earns another play",
    `got ${earnedMore.body?.plays?.blaster?.left}`);

  // =========================================================================
  section("Treasure Island still works, untouched");
  // =========================================================================

  const rewards = await pupil.get(`/api/students/${child.id}/rewards`);
  check(rewards.status === 200 && rewards.body?.success === true,
    "the rewards (chests) endpoint still answers", `status ${rewards.status}`);
  check(Array.isArray(rewards.body?.rewards), "and still returns the chest list");
  check(rewards.body.rewards.length > 0,
    "completing homework still earned chests — Treasure Island is unaffected",
    `${rewards.body.rewards.length} rewards`);

  // =========================================================================
  section("Forms still never see any of it");
  // =========================================================================

  const formChild = (await teacher.post("/api/students", {
    studentId: `F1-${stamp}`, fullName: `Form Test Child ${stamp}`, gender: "Male", form: "Form 1",
  })).body?.student;
  const formPupil = new Session();
  await formPupil.post("/api/auth/student/login", { fullName: formChild.fullName, password: "formpw123" });
  const formPlays = await formPupil.get(`/api/students/${formChild.id}/plays`);
  const formBlast = await formPupil.post(`/api/students/${formChild.id}/blaster/start`);
  const formPenalty = await formPupil.get(`/api/students/${formChild.id}/penalty/subjects`);
  check(formPlays.status === 403, "a Form pupil gets 403 from the plays endpoint", `got ${formPlays.status}`);
  check(formBlast.status === 403, "a Form pupil gets 403 from Target Blaster", `got ${formBlast.status}`);
  check(formPenalty.status === 403, "a Form pupil gets 403 from Penalty Shootout", `got ${formPenalty.status}`);

  // =========================================================================
  section("One child cannot spend another child's plays");
  // =========================================================================

  const otherBlast = await formPupil.post(`/api/students/${child.id}/blaster/start`);
  check(otherBlast.status === 401 || otherBlast.status === 403,
    "starting someone else's game is refused", `got ${otherBlast.status}`);

  // =========================================================================
  section("Tomorrow: plays reset, nothing carries over");
  // =========================================================================

  // The dev-only clock helper moves "today" for the streak, and the plays
  // ledger reads the same CAT day, so this is a real day-change test.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const simulated = await teacher.post("/api/dev/streak/sim-date", { date: tomorrow });
  if (simulated.body?.success === true && simulated.body?.today === tomorrow) {
    const nextDay = await pupil.get(`/api/students/${child.id}/plays`);
    check(nextDay.body?.plays?.blaster?.left === 0,
      "tomorrow starts at 0 plays — unused plays do not carry over",
      `got ${nextDay.body?.plays?.blaster?.left}`);
    check(nextDay.body?.plays?.blaster?.completedToday === 0,
      "and yesterday's homework no longer counts towards today",
      `got ${nextDay.body?.plays?.blaster?.completedToday}`);
    await teacher.post("/api/dev/streak/sim-date", { date: null });
    const backToToday = await pupil.get(`/api/students/${child.id}/plays`);
    check(backToToday.body?.plays?.blaster?.left === 1,
      "and today's plays are still there when the clock comes back",
      `got ${backToToday.body?.plays?.blaster?.left}`);
  } else {
    check(false, "the dev clock helper moved the day", `status ${simulated.status}, body ${JSON.stringify(simulated.body).slice(0, 80)}`);
  }

  // --- Tidy up -------------------------------------------------------------
  for (const a of [a1, a2, a3, a4]) await teacher.delete(`/api/assignments/${a.id}`);
  await teacher.delete(`/api/students/${child.id}`);
  await teacher.delete(`/api/students/${formChild.id}`);
  console.log("\nTest pupils and assignments removed.");

  finish();
}

// Sets process.exitCode and lets the process end by itself — never
// process.exit(), which trips a libuv assertion on Node 24 for Windows while
// fetch's keep-alive sockets are still open and reports a green run as 127.
function finish() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(err => { console.error(err); process.exitCode = 1; });
