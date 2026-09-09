// The games update, walked end to end as a real Stage 3 pupil.
//
// Complete 3 assignments -> 3 plays of each game -> play them down to 0 ->
// confirm both games build rounds from COMPLETED work with no "not ready" ->
// confirm walking out of a game does not cost the play ->
// confirm Treasure Island still works -> confirm tomorrow resets the plays.
//
// Run against a live server: npx tsx <this file>

// The same helpers the two game pages import. Used below to work out exactly
// what a child would be shown when they come back to a half-finished game, so
// a change to that logic breaks this test rather than a child's game.
import { readProgress, scoreProgress } from "../shared/game-plays";

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

/**
 * The answer to "Adding question 1: what is 4 + 4?", worked out from the
 * question text. The browser is never told the answer, so the test cannot be
 * told it either — it does what a child does and reads the question.
 */
function answerTo(questionText: string): string {
  const m = /what is (\d+) \+ (\d+)\?/.exec(questionText);
  return m ? String(Number(m[1]) + Number(m[2])) : "";
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

  // Playing a round is now what records it. The server marks and saves each
  // round as it is played and adds them up at the end, so a game has to be
  // PLAYED rather than posted in one lump at the finish.
  const blastRound = (r: any, answerText?: string) =>
    pupil.post(`/api/students/${child.id}/blaster/answer`, {
      slot: r.index, ref: r.ref, answerText: answerText ?? answerTo(r.questionText),
    });
  const penaltyShot = (subject: string, sh: any, answerText?: string) =>
    pupil.post(`/api/students/${child.id}/penalty/answer`, {
      subject, slot: sh.slot, ref: sh.ref, answerText: answerText ?? answerTo(sh.questionText),
    });
  /** Play a blast right through, so it can be finished and the play used up. */
  const playBlastOut = async () => {
    const g = await pupil.post(`/api/students/${child.id}/blaster/start`);
    if (!g.body?.success) return g;
    for (const r of g.body.rounds || []) await blastRound(r);
    return pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: [] });
  };

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

  // Play them all correctly. The right answer is in the question text
  // ("what is 4 + 4?"), which the server marks — the browser is never told.
  for (const r of rounds) await blastRound(r);

  // The finish sends NO answers: the score is the server's own record of the
  // rounds as they were played, not anything the browser hands up.
  const blastResult = await pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: [] });
  check(blastResult.body?.score === 6, "all six answered right scores 6", `got ${blastResult.body?.score}`);
  check(blastResult.body?.newRecord === true, "a first game sets a record");
  check(blastResult.body?.xp?.awarded > 0, "XP is awarded", JSON.stringify(blastResult.body?.xp));
  check(blastResult.body?.plays?.left === 2, "the play stays spent after finishing", `got ${blastResult.body?.plays?.left}`);

  // Sending the same winning game again must score nothing.
  const replay = await pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: [] });
  check(replay.body?.score === 0, "the same finished game cannot be sent up twice to score again",
    `got ${replay.body?.score}`);

  // The browser cannot talk its way to a score it did not earn.
  const madeUp = await pupil.post(`/api/students/${child.id}/blaster/finish`, {
    answers: rounds.map((r: any) => ({ ref: r.ref, answerText: answerTo(r.questionText) })),
  });
  check(madeUp.body?.score === 0, "a made-up set of answers scores nothing on a finished game",
    `got ${madeUp.body?.score}`);

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

  for (const sh of shots) await penaltyShot("MATHS", sh);
  const shootResult = await pupil.post(`/api/students/${child.id}/penalty/finish`, { subject: "MATHS", answers: [] });
  check(shootResult.body?.score === 10, "all ten right scores 10, repeats included",
    `got ${shootResult.body?.score} — a repeated question must still score each time it is asked`);

  // =========================================================================
  section("Playing down to zero, then the wall");
  // =========================================================================

  // Two blaster plays left. Play both right through — a game merely walked out
  // of would be waiting to be picked up, not spent.
  for (let i = 0; i < 2; i++) await playBlastOut();
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
  section("Walking out of a game does not cost the play");
  // =========================================================================
  //
  // The rule: a game left half-played is KEPT, not refunded and not thrown
  // away. Come back and the same game is waiting at the round it reached. That
  // is what stops quitting being both a punishment and a loophole.

  const playsBefore = (await pupil.get(`/api/students/${child.id}/plays`)).body?.plays?.blaster?.left;
  const walked = await pupil.post(`/api/students/${child.id}/blaster/start`);
  check(walked.body?.success === true, "a blast starts with the newly earned play",
    JSON.stringify(walked.body).slice(0, 120));
  const walkedRounds = walked.body?.rounds || [];
  check(walked.body?.plays?.left === playsBefore - 1, "starting it spends the play",
    `${playsBefore} -> ${walked.body?.plays?.left}`);

  // Play two rounds, one right and one wrong, then walk away — close the tab,
  // flat battery, tapped "back". Nothing else is sent.
  await blastRound(walkedRounds[0]);
  await blastRound(walkedRounds[1], "definitely wrong");

  const midStatus = await pupil.get(`/api/students/${child.id}/blaster`);
  check(midStatus.body?.resumable === true, "the half-finished game is waiting to be picked up");
  check(midStatus.body?.resumeSlot === 2, "waiting at the round they had reached",
    `got ${midStatus.body?.resumeSlot}`);

  // Coming back.
  const resumeA = await pupil.post(`/api/students/${child.id}/blaster/start`);
  check(resumeA.body?.resumed === true, "coming back picks the same game up rather than starting a new one");
  check(resumeA.body?.plays?.left === playsBefore - 1, "and does NOT spend a second play",
    `got ${resumeA.body?.plays?.left}, expected ${playsBefore - 1}`);
  check(resumeA.body?.resumeSlot === 2, "back at the round they left", `got ${resumeA.body?.resumeSlot}`);

  // The shape the PAGE reads to work out which rounds are still to play. If
  // this drifts, a child would be asked rounds they have already played.
  const prog = resumeA.body?.progress;
  check(Array.isArray(prog) && prog.length === 6, "progress comes back, one entry per round",
    JSON.stringify(prog));
  check(prog?.[0]?.correct === true, "the round they got right is recorded as right",
    JSON.stringify(prog?.[0]));
  check(prog?.[1]?.correct === false, "the round they got wrong is recorded as wrong",
    JSON.stringify(prog?.[1]));
  check([2, 3, 4, 5].every((i) => prog?.[i] === null), "the rounds not yet played are empty",
    JSON.stringify(prog?.slice(2)));

  const resumedRounds = resumeA.body?.rounds || [];
  const sameQuestions = resumedRounds.every((r: any) => r.ref === walkedRounds[r.index]?.ref);
  check(sameQuestions, "the questions are the SAME ones — quitting cannot re-roll for an easier set");
  check(resumedRounds.filter((r: any) => r.index >= 2).length === 4,
    "the four rounds still to play come back",
    `got ${resumedRounds.filter((r: any) => r.index >= 2).length}`);

  // The round they got wrong stays wrong. Otherwise "answer, see the right
  // answer, quit, come back" would be a way to farm a perfect score.
  const retry = await blastRound(walkedRounds[1]);
  check(retry.body?.alreadyPlayed === true, "a round already played cannot be played again");
  check(retry.body?.correct === false, "and keeps the mark it got the first time",
    `got ${retry.body?.correct}`);

  // What the PAGE does with all that. This is the page's own arithmetic, run
  // over the server's real answer: which rounds it puts in front of the child,
  // and the score it starts them on.
  const pageProgress = readProgress(resumeA.body?.progress, 6);
  const pageTodo = (resumeA.body?.rounds || []).filter((r: any) => !pageProgress[r.index]);
  check(pageTodo.length === 4, "the page would offer exactly the four rounds still to play",
    `got ${pageTodo.length}`);
  check(pageTodo.every((r: any) => r.index >= 2), "and none they have already played",
    JSON.stringify(pageTodo.map((r: any) => r.index)));
  check(scoreProgress(pageProgress) === 1, "and would start them on the score they had earned",
    `got ${scoreProgress(pageProgress)}`);
  check(pageTodo[0]?.index === 2, "starting at the round they walked out of",
    `got ${pageTodo[0]?.index}`);

  // Finishing early must not bank a short game, nor lose it.
  const early = await pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: [] });
  check(early.body?.unfinished === true, "a game with rounds still to play cannot be finished early");
  const stillThere = await pupil.get(`/api/students/${child.id}/blaster`);
  check(stillThere.body?.resumable === true, "and is still waiting afterwards, not thrown away");

  // Play it out. The score must cover BOTH sittings: 1 right before walking
  // away, 4 right after, and the one they got wrong staying wrong.
  for (const r of resumedRounds) await blastRound(r);
  const across = await pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: [] });
  check(across.body?.score === 5, "a game played across two sittings scores what it earned",
    `got ${across.body?.score}, expected 5 (1 before + 4 after, 1 wrong)`);
  check(across.body?.plays?.left === playsBefore - 1, "and the play is spent exactly once",
    `got ${across.body?.plays?.left}`);

  // A game already paid for is still yours to finish when the balance is empty.
  // Taken from the POST's own reply, like every other assignment in this file.
  // It used to be looked up again with a GET and read as `body.assignments` —
  // but that endpoint answers with a BARE ARRAY, so `extra` was always
  // undefined, the whole block below was silently skipped, and the two checks
  // in it never ran while the assignment above was left behind on every run.
  const extra = (await teacher.post(
    "/api/assignments", quizAssignment("MATHS", "More adding", `More ${stamp}`, ["x1", "x2"]),
  )).body?.assignment;
  check(!!extra, "an extra assignment is created to earn one more play",
    "if this fails the checks below are being skipped, not passing");
  if (extra) {
    await pupil.post("/api/submissions", {
      assignmentId: extra.id, studentId: child.id,
      answers: [{ questionId: "x1", answerText: "4" }, { questionId: "x2", answerText: "6" }],
    });
    const paidFor = await pupil.post(`/api/students/${child.id}/blaster/start`);
    const paidRounds = paidFor.body?.rounds || [];
    await blastRound(paidRounds[0]);
    const stranded = await pupil.get(`/api/students/${child.id}/plays`);
    check(stranded.body?.plays?.blaster?.left === 0, "the balance is empty while a game is still open",
      `got ${stranded.body?.plays?.blaster?.left}`);
    const rescued = await pupil.post(`/api/students/${child.id}/blaster/start`);
    check(rescued.body?.resumed === true,
      "a game already paid for can still be picked up with no plays left",
      JSON.stringify(rescued.body).slice(0, 120));
    for (const r of rescued.body?.rounds || []) await blastRound(r);
    await pupil.post(`/api/students/${child.id}/blaster/finish`, { answers: [] });
  }

  // The same rule in Penalty Shootout, including across subjects.
  const pPlays = (await pupil.get(`/api/students/${child.id}/plays`)).body?.plays?.penalty?.left ?? 0;
  if (pPlays > 0) {
    const pGame = await pupil.post(`/api/students/${child.id}/penalty/start`, { subject: "MATHS" });
    const pShots = pGame.body?.shots || [];
    await penaltyShot("MATHS", pShots[0]);

    // Picking a DIFFERENT subject must not start a fresh game — that would be
    // a free re-roll out of one that is going badly.
    const switched = await pupil.post(`/api/students/${child.id}/penalty/start`, { subject: "ENGLISH" });
    check(switched.body?.resumed === true && switched.body?.subject === "MATHS",
      "picking another subject goes back to the game in flight, not a new one",
      `got ${switched.body?.subject}, resumed=${switched.body?.resumed}`);
    check(switched.body?.plays?.left === pGame.body?.plays?.left,
      "and spends no extra play", `${pGame.body?.plays?.left} -> ${switched.body?.plays?.left}`);

    const pSubjects = await pupil.get(`/api/students/${child.id}/penalty/subjects`);
    check(pSubjects.body?.resumable === true && pSubjects.body?.resumeSubject === "MATHS",
      "the subject picker offers to carry on with it",
      JSON.stringify({ r: pSubjects.body?.resumable, s: pSubjects.body?.resumeSubject }));

    for (const sh of switched.body?.shots || []) await penaltyShot("MATHS", sh);
    const pDone = await pupil.post(`/api/students/${child.id}/penalty/finish`, { subject: "MATHS", answers: [] });
    check(pDone.body?.score === 10, "the shootout finishes across two sittings with every shot counted",
      `got ${pDone.body?.score}`);
  }

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
  // Today's state, to compare against after the clock has been and come back.
  // Compared rather than hard-coded: how many plays are left here depends on
  // how many the sections above spent, which is not what this test is about.
  const todayState = (await pupil.get(`/api/students/${child.id}/plays`)).body?.plays?.blaster;
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
    const back = backToToday.body?.plays?.blaster;
    check(
      back?.earned === todayState?.earned &&
      back?.used === todayState?.used &&
      back?.left === todayState?.left &&
      back?.completedToday === todayState?.completedToday,
      "and today's plays are still there when the clock comes back",
      `was ${JSON.stringify(todayState)}, came back as ${JSON.stringify(back)}`);
    check((todayState?.completedToday ?? 0) > 0,
      "today really did have homework in it, so that comparison means something",
      `completedToday ${todayState?.completedToday}`);
  } else {
    check(false, "the dev clock helper moved the day", `status ${simulated.status}, body ${JSON.stringify(simulated.body).slice(0, 80)}`);
  }

  // =========================================================================
  section("The teacher's class view of game plays");
  // =========================================================================
  //
  // A teacher asks a different question from a parent: not "is my child
  // earning it?" but "who is this reward not reaching?". So the class is split
  // into four groups and the children who handed nothing in and played nothing
  // are listed first.

  // A second Stage 3 pupil who does NOTHING, so there is somebody in the
  // "neither" group to find. A class where everyone has worked would not test
  // the thing this page exists for.
  const idleChild = (await teacher.post("/api/students", {
    studentId: `G3I-${stamp}`, fullName: `Idle Test Child ${stamp}`, gender: "Male", form: "Stage 3",
  })).body?.student;

  const classView = await teacher.get(`/api/reports/plays?form=Stage%203`);
  check(classView.status === 200 && classView.body?.success === true,
    "a teacher can read the class view", `status ${classView.status}`);

  const cp = classView.body?.plays;
  check(cp?.available === true, "Stage 3 has the games", `got ${cp?.available}`);
  check(cp?.isToday === true, "with no dates it answers for today", `got ${cp?.isToday}`);

  const rows = cp?.rows || [];
  const worked = rows.find((r: any) => r.studentId === child.id);
  const idle = rows.find((r: any) => r.studentId === idleChild?.id);

  check(!!worked && !!idle, "every child in the class has a row",
    `worked ${!!worked}, idle ${!!idle}`);

  // The child who did the homework. Their figures must match the ledger: five
  // assignments handed in today, so ten plays across the two games.
  const ledger = (await pupil.get(`/api/students/${child.id}/plays`)).body?.plays;
  const ledgerEarned = (ledger?.blaster?.earned ?? 0) + (ledger?.penalty?.earned ?? 0);
  const ledgerUsed = (ledger?.blaster?.used ?? 0) + (ledger?.penalty?.used ?? 0);
  check(worked?.playsEarned === ledgerEarned,
    "the teacher sees the same plays earned as the ledger",
    `teacher ${worked?.playsEarned} vs ledger ${ledgerEarned}`);
  check(worked?.playsUsed === ledgerUsed,
    "and the same plays used",
    `teacher ${worked?.playsUsed} vs ledger ${ledgerUsed}`);
  check(worked?.group === "earnedAndPlayed",
    "a child who did the work and played is grouped as earned-and-played",
    `got ${worked?.group}`);

  // The child who did nothing at all — the group the page exists to surface.
  check(idle?.playsEarned === 0 && idle?.playsUsed === 0,
    "a child who did nothing has nothing", JSON.stringify(idle));
  check(idle?.group === "neither", "and is grouped as neither", `got ${idle?.group}`);
  check(rows[0]?.group === "neither",
    "the children the reward is not reaching are listed FIRST",
    `first row is ${rows[0]?.group}`);

  check(cp?.summary?.neither >= 1, "the summary counts them",
    JSON.stringify(cp?.summary));
  check(cp?.summary?.children === rows.length, "the summary counts the whole class",
    `${cp?.summary?.children} vs ${rows.length}`);
  check(
    cp?.summary?.totalEarned === rows.reduce((n: number, r: any) => n + r.playsEarned, 0),
    "and the totals are the rows added up", JSON.stringify(cp?.summary),
  );

  // "Left" only means something today: plays do not carry over, so a past day
  // has no leftovers anybody could spend.
  check(typeof worked?.playsLeft === "number", "today's rows say how many plays are left",
    `got ${worked?.playsLeft}`);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const pastView = await teacher.get(`/api/reports/plays?form=Stage%203&date=${yesterday}`);
  check(pastView.body?.plays?.isToday === false, "a past day is not today",
    `got ${pastView.body?.plays?.isToday}`);
  check(
    (pastView.body?.plays?.rows || []).every((r: any) => r.playsLeft === null),
    "and a past day never claims plays are left to spend",
    JSON.stringify((pastView.body?.plays?.rows || []).map((r: any) => r.playsLeft)),
  );

  // A secondary class has no games. Said plainly rather than as a class of
  // zeros, which would read as "nobody in Form 1 does their homework".
  const formView = await teacher.get(`/api/reports/plays?form=Form%201`);
  check(formView.body?.plays?.available === false,
    "a Form class is told the games do not apply", `got ${formView.body?.plays?.available}`);
  check((formView.body?.plays?.rows || []).length === 0,
    "with no rows at all", JSON.stringify(formView.body?.plays?.rows?.length));

  // Teacher-only: this hands out every child's name in a class.
  const pupilPeek = await pupil.get(`/api/reports/plays?form=Stage%203`);
  check(pupilPeek.status === 401 || pupilPeek.status === 403,
    "a pupil cannot read the class view", `got ${pupilPeek.status}`);
  const anonPeek = await new Session().get(`/api/reports/plays?form=Stage%203`);
  check(anonPeek.status === 401 || anonPeek.status === 403,
    "nor can a logged-out caller", `got ${anonPeek.status}`);

  // A class must be named — without one there is nothing to report on.
  const noForm = await teacher.get(`/api/reports/plays`);
  check(noForm.status === 400, "asking without a class is refused", `got ${noForm.status}`);

  if (idleChild) await teacher.delete(`/api/students/${idleChild.id}`);

  // --- Tidy up -------------------------------------------------------------
  // `extra` belongs here too. It was left out when this section was written,
  // and every run of this check quietly added one more assignment to a live
  // register — a test that dirties the database it is pointed at is worse than
  // no test.
  for (const a of [a1, a2, a3, a4, extra]) {
    if (a) await teacher.delete(`/api/assignments/${a.id}`);
  }
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
