// Offline mode, tested where it can actually go wrong.
//
//   npm run check:offline   (start the server first: npm run dev)
//
// The promise this feature makes is narrow and absolute: work answered with no
// signal reaches the school EXACTLY ONCE. Never lost, never twice. Everything
// below exists to try to break one half of that.
//
// Three parts:
//
//   1. The rules on their own — no server, no browser. What to do with every
//      shape of reply, including the ones designed to fool us.
//   2. The source itself — two promises that cannot be tested by asking the
//      server anything: that no mark is ever written to a device, and that the
//      service worker still refuses to cache live data.
//   3. A live server — the same piece of work sent twice, five times at once,
//      after it has been marked, and by the wrong child.

import {
  MAX_ATTEMPTS, STALE_SENDING_MS,
  classifyOutcome, interpretReply, isStaleSending, itemsToSend,
  newClientId, resolveCompletedAt, summarise,
  type OutboxItem,
} from "../shared/offline";
import { onCleanup, runCheck } from "./cleanup";
import { readFileSync } from "node:fs";

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
  delete(p: string) { return this.request("DELETE", p); }
}

const stamp = Date.now().toString().slice(-6);
const FORM = "Stage 3";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A queued item, for the pure checks. */
function item(over: Partial<OutboxItem> = {}): OutboxItem {
  return {
    clientId: "c1", studentId: 1, assignmentId: 1, assignmentTitle: "Paper",
    answers: [], completedAt: "2026-01-01T00:00:00.000Z",
    state: "pending", attempts: 0, ...over,
  };
}

async function main() {
  console.log(`\nOffline mode check (run ${stamp})\n`);

  // =======================================================================
  section("What to do with each reply, on its own");
  // =======================================================================

  check(classifyOutcome({ kind: "accepted", submissionId: 7 }, 0).next === "done",
    "an accepted send is finished with");

  const refused = classifyOutcome({ kind: "refused", message: "Paper withdrawn." }, 0);
  check(refused.next === "blocked" && refused.message === "Paper withdrawn.",
    "a refusal stops, and keeps the server's own words for the child to read");

  check(classifyOutcome({ kind: "offline" }, 0).next === "retry",
    "no connection means try again later");

  // The rule that stops a child in a valley losing an evening's work: a dead
  // connection is not a failed attempt, it is a non-event.
  check(classifyOutcome({ kind: "offline" }, MAX_ATTEMPTS + 50).next === "retry",
    "no connection NEVER gives up, however many times it happens");

  check(classifyOutcome({ kind: "serverError", message: "x" }, 0).next === "retry",
    "a server problem is worth another try");
  check(classifyOutcome({ kind: "serverError", message: "still broken" }, MAX_ATTEMPTS - 1).next === "blocked",
    "a server problem that never clears eventually asks the child for help");

  // =======================================================================
  section("Reading the server's reply — the shapes that could lose work");
  // =======================================================================

  const good = interpretReply({ status: 200, body: { success: true, submission: { id: 42 } } });
  check(good.kind === "accepted" && good.submissionId === 42, "a proper success is accepted");

  // A server that recognised the device id answers exactly the same way, which
  // is the point: to the phone, "stored just now" and "we already had it" are
  // the same fact.
  const replayed = interpretReply({ status: 200, body: { success: true, submission: { id: 42 }, duplicate: true } as any });
  check(replayed.kind === "accepted" && replayed.submissionId === 42,
    "a recognised repeat is accepted too, and names the SAME submission");

  // THE ONE THAT MATTERS MOST. School WiFi that wants you to sign in answers
  // every request with its own web page and a cheerful 200. Treating that as
  // success would delete a child's work and send it nowhere.
  check(interpretReply({ status: 200, body: null }).kind === "serverError",
    "a 200 we cannot read as JSON is NOT success — the captive-WiFi trap");
  check(interpretReply({ status: 200, body: {} }).kind === "serverError",
    "a 200 with no success flag is not success");
  check(interpretReply({ status: 200, body: { success: true } }).kind === "serverError",
    "a success with no submission id is not enough to throw the work away");
  check(interpretReply({ status: 200, body: { success: true, submission: { id: "42" } } as any }).kind === "serverError",
    "a submission id that is not a number is not accepted");

  const said_no = interpretReply({ status: 200, body: { success: false, message: "You have already handed this in." } });
  check(said_no.kind === "refused" && said_no.message === "You have already handed this in.",
    "a plain refusal is passed through word for word");

  check(interpretReply({ status: 401, body: null }).kind === "serverError",
    "an ended login keeps the work rather than throwing it away");
  check(interpretReply({ status: 500, body: null }).kind === "serverError",
    "a broken server keeps the work");
  check(interpretReply({ status: 503, body: { success: false, message: "down" } }).kind === "serverError",
    "a 503 is a server problem, not a refusal, even when it says success:false");

  // =======================================================================
  section("Picking up work left behind by an app that closed");
  // =======================================================================

  const now = Date.now();
  check(!isStaleSending(item({ state: "pending" }), now), "waiting work is not mistaken for a dead send");
  check(!isStaleSending(item({ state: "sending", sendingSince: now - 1000 }), now),
    "a send that started a second ago is left alone");
  check(isStaleSending(item({ state: "sending", sendingSince: now - STALE_SENDING_MS - 1 }), now),
    "a send with nobody behind it any more is picked up again");
  check(isStaleSending(item({ state: "sending" }), now),
    "a send with no start time at all is picked up — it cannot be in flight");

  const queue = itemsToSend([
    item({ clientId: "b", completedAt: "2026-03-02T00:00:00.000Z" }),
    item({ clientId: "a", completedAt: "2026-03-01T00:00:00.000Z" }),
    item({ clientId: "blocked", state: "blocked" }),
    item({ clientId: "gone", state: "done" }),
    item({ clientId: "inflight", state: "sending", sendingSince: now }),
    item({ clientId: "orphan", state: "sending", sendingSince: now - STALE_SENDING_MS - 1, completedAt: "2026-03-03T00:00:00.000Z" }),
  ], now);
  check(queue.length === 3, "only work that can be sent is queued", `got ${queue.length}`);
  check(queue.map((i) => i.clientId).join(",") === "a,b,orphan",
    "oldest finished first, and a dead send is back in the queue", queue.map((i) => i.clientId).join(","));
  check(!queue.some((i) => i.clientId === "blocked" || i.clientId === "gone"),
    "work already dealt with is never sent again");
  check(!queue.some((i) => i.clientId === "inflight"),
    "a send actually in flight is not started a second time");

  // =======================================================================
  section("What the child is told");
  // =======================================================================

  check(summarise([]).text === "Everything is synced", "nothing waiting says so");
  check(summarise([item()]).text === "1 item waiting to sync", "one item, in the singular");
  check(summarise([item({ clientId: "a" }), item({ clientId: "b" })]).text === "2 items waiting to sync",
    "two items, in the plural");
  check(summarise([item({ state: "sending", sendingSince: now })]).text.startsWith("Sending"),
    "work on its way says so, rather than looking stuck");
  const withBlocked = summarise([item({ state: "blocked", message: "no" })]);
  check(withBlocked.blocked === 1 && withBlocked.text.includes("attention"),
    "work the school refused is never silently dropped from the count");

  // =======================================================================
  section("Whose clock decides when the work was done");
  // =======================================================================

  const serverNow = new Date("2026-05-10T12:00:00.000Z");
  const setOn = new Date("2026-05-01T08:00:00.000Z");

  const honest = resolveCompletedAt({ completedAt: "2026-05-09T19:30:00.000Z", now: serverNow, assignmentCreatedAt: setOn });
  check(honest.verdict === "trusted" && honest.submittedAt.toISOString() === "2026-05-09T19:30:00.000Z",
    "work finished last night is dated last night, not whenever it synced");

  // A phone that has been off for a fortnight has a legitimately old time.
  const fortnight = resolveCompletedAt({ completedAt: "2026-05-02T09:00:00.000Z", now: serverNow, assignmentCreatedAt: setOn });
  check(fortnight.verdict === "trusted", "a phone that was offline for days is still believed");

  const ahead = resolveCompletedAt({ completedAt: "2026-06-01T00:00:00.000Z", now: serverNow, assignmentCreatedAt: setOn });
  check(ahead.verdict === "in-future" && ahead.submittedAt === serverNow,
    "a clock running fast cannot date work in the future");

  const behind = resolveCompletedAt({ completedAt: "1970-01-01T00:00:00.000Z", now: serverNow, assignmentCreatedAt: setOn });
  check(behind.verdict === "before-assignment" && behind.submittedAt === serverNow,
    "a clock claiming the work was done before the paper existed is not believed");

  check(resolveCompletedAt({ completedAt: "not a date", now: serverNow, assignmentCreatedAt: setOn }).verdict === "unreadable",
    "a time that cannot be read falls back to server time");
  check(resolveCompletedAt({ completedAt: null, now: serverNow, assignmentCreatedAt: setOn }).verdict === "no-claim",
    "an ordinary online hand-in, which claims nothing, is dated now");

  const ids = new Set(Array.from({ length: 2000 }, () => newClientId()));
  check(ids.size === 2000, "two thousand device ids, no two the same", `${ids.size} unique`);

  // =======================================================================
  section("Promises the server cannot be asked about");
  // =======================================================================

  // A mark on a phone goes stale, and a stale mark is worse than no mark: a
  // child would be shown a score their teacher had already changed. Nothing
  // that writes to the device may so much as mention one.
  const deviceCode = ["client/src/lib/offline-db.ts", "client/src/lib/outbox.ts"]
    .map((f) => readFileSync(f, "utf-8"));
  const storedShape = readFileSync("shared/offline.ts", "utf-8");
  const marky = /totalScore|questionMarks|\bfeedback\b|percentage/;
  check(!marky.test(deviceCode[0]), "the device store never handles a mark");
  check(!marky.test(deviceCode[1]), "the outbox never handles a mark");
  check(!marky.test(storedShape.split("export interface OutboxItem")[1].split("}")[0]),
    "the queued item has no score field to accidentally fill in");
  check(deviceCode[1].includes("recentlySent") && !/localStorage|saveItem\(.*submissionId/.test(deviceCode[1].split("recentlySent")[0].slice(-400)),
    "the 'just sent' list is memory only, so nothing survives to go stale");

  // The service worker's oldest rule, still true after being taught to serve
  // the app offline.
  const sw = readFileSync("client/public/sw.js", "utf-8");
  check(/isPrivateOrLiveData[\s\S]{0,200}\/api\//.test(sw),
    "the service worker still refuses to cache anything under /api/");
  check(/if \(isPrivateOrLiveData\(url\)\) return;/.test(sw),
    "and it bows out of those requests entirely, rather than handling them");

  // =======================================================================
  section("Setting up a real class");
  // =======================================================================

  const teacher = new Session();
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (!login.body?.success) {
    console.log("\n  Could not sign in as the teacher. Is the server running? (npm run dev)\n");
    failed++;
    return;
  }
  check(true, "signed in as a teacher");

  const pupil = (await teacher.post("/api/students", {
    studentId: `OFF-${stamp}`, fullName: `Offline Child ${stamp}`, gender: "Female", form: FORM,
  })).body?.student;
  // If this fails, every check below is SKIPPED, not passing.
  check(!!pupil?.id, "a pupil to hand work in", "no pupil created");
  if (!pupil?.id) return;
  onCleanup(`pupil ${pupil.id}`, () => teacher.delete(`/api/students/${pupil.id}`));

  const other = (await teacher.post("/api/students", {
    studentId: `OFF2-${stamp}`, fullName: `Other Child ${stamp}`, gender: "Male", form: FORM,
  })).body?.student;
  check(!!other?.id, "a second pupil, to try reading the first one's work", "no pupil created");
  if (!other?.id) return;
  onCleanup(`pupil ${other.id}`, () => teacher.delete(`/api/students/${other.id}`));

  const questions = [2, 3, 4, 5].map((n, i) => ({
    id: `q${i + 1}`, questionText: `What is ${n} + ${n}?`, maxScore: 1,
    type: "numeric", correctNumber: n * 2, tolerance: 0,
  }));
  const paper = (await teacher.post("/api/assignments", {
    subject: "MATHS", topic: "Adding", form: FORM, title: `Offline paper ${stamp}`,
    instructions: "Answer all four.", dueDate: "2026-12-01", totalMarks: 4,
    createdById: 1, questions,
  })).body?.assignment;
  check(!!paper?.id, "a paper to answer", "no assignment created");
  if (!paper?.id) return;
  onCleanup(`assignment ${paper.id}`, () => teacher.delete(`/api/assignments/${paper.id}`));

  const second = (await teacher.post("/api/assignments", {
    subject: "ENGLISH", topic: "Spelling", form: FORM, title: `Second paper ${stamp}`,
    instructions: "Answer all four.", dueDate: "2026-12-01", totalMarks: 4,
    createdById: 1, questions,
  })).body?.assignment;
  check(!!second?.id, "a second paper", "no assignment created");
  if (!second?.id) return;
  onCleanup(`assignment ${second.id}`, () => teacher.delete(`/api/assignments/${second.id}`));

  const child = new Session();
  const childLogin = await child.post("/api/auth/student/login", {
    fullName: pupil.fullName, password: "offline123",
  });
  check(childLogin.body?.success === true, "the pupil can sign in");

  // All four right, so there is a mark to find afterwards.
  const answers = questions.map((q) => ({ questionId: q.id, answerText: String(q.correctNumber) }));

  /** How many submissions this pupil has for a paper. The endpoint answers with
   *  a BARE ARRAY, so nothing here reads a wrapper that does not exist. */
  async function countSubmissions(assignmentId: number): Promise<number> {
    const res = await child.get(`/api/submissions?assignmentId=${assignmentId}&studentId=${pupil.id}`);
    if (!Array.isArray(res.body)) return -1;
    return res.body.length;
  }

  // =======================================================================
  section("Work answered on the bus, arriving once");
  // =======================================================================

  // A gap between the paper being set and the child finishing, so "the device's
  // time" and "the server's time" are provably different numbers.
  await sleep(3000);
  const paperSetAt = new Date(paper.createdAt).getTime();
  const finishedAt = new Date(paperSetAt + 1000).toISOString();
  const deviceId = newClientId();

  const first = await child.post("/api/submissions", {
    assignmentId: paper.id, studentId: pupil.id, answers,
    clientSubmissionId: deviceId, completedAt: finishedAt,
  });
  check(first.body?.success === true, "offline work is accepted", JSON.stringify(first.body?.message));
  const submissionId = first.body?.submission?.id;
  check(typeof submissionId === "number", "and comes back with a submission id");
  if (typeof submissionId !== "number") return;
  check(first.body?.duplicate !== true, "the first arrival is not called a repeat");
  check(await countSubmissions(paper.id) === 1, "exactly one submission exists");

  check(first.body?.mark?.totalScore === 4,
    "it was marked on arrival, like any other hand-in", String(first.body?.mark?.totalScore));

  const stored = first.body?.submission;
  check(new Date(stored.submittedAt).toISOString() === finishedAt,
    "it is dated when the CHILD finished, not when it reached us",
    `${stored.submittedAt} vs ${finishedAt}`);
  check(!!stored.receivedAt && new Date(stored.receivedAt).getTime() > new Date(finishedAt).getTime(),
    "and the moment it actually arrived is recorded beside it");

  // =======================================================================
  section("The same work, sent again");
  // =======================================================================

  const xpBefore = (await child.get(`/api/students/${pupil.id}/stats`)).body?.stats?.xp?.totalXp;
  check(typeof xpBefore === "number", "the pupil's XP can be read, to prove it does not move");

  const again = await child.post("/api/submissions", {
    assignmentId: paper.id, studentId: pupil.id, answers,
    clientSubmissionId: deviceId, completedAt: finishedAt,
  });
  check(again.body?.success === true, "a repeat is accepted, not refused");
  check(again.body?.duplicate === true, "and is plainly labelled as one we already had");
  check(again.body?.submission?.id === submissionId,
    "it names the SAME submission", `${again.body?.submission?.id} vs ${submissionId}`);
  check(await countSubmissions(paper.id) === 1, "still exactly one submission");

  // This is what a child sees when their phone finally syncs: their real mark.
  check(again.body?.mark?.totalScore === 4,
    "the mark comes back with it, so the result appears after syncing");

  const xpAfter = (await child.get(`/api/students/${pupil.id}/stats`)).body?.stats?.xp?.totalXp;
  check(xpAfter === xpBefore, "no XP is awarded a second time", `${xpBefore} -> ${xpAfter}`);

  // The whole point of the id: a phone that reconnects, is closed mid-sync and
  // reopened will send this over and over. It must stay one submission.
  for (let i = 0; i < 4; i++) {
    await child.post("/api/submissions", {
      assignmentId: paper.id, studentId: pupil.id, answers,
      clientSubmissionId: deviceId, completedAt: finishedAt,
    });
  }
  check(await countSubmissions(paper.id) === 1, "sent four more times: still exactly one submission");
  const afterMany = (await child.get(`/api/students/${pupil.id}/stats`)).body?.stats?.xp?.totalXp;
  check(afterMany === xpBefore, "and still no extra XP");

  // =======================================================================
  section("Five at once — the race a 'look first' check cannot win");
  // =======================================================================

  const raceId = newClientId();
  const raceCompleted = new Date(paperSetAt + 1500).toISOString();
  const together = await Promise.all(
    Array.from({ length: 5 }, () =>
      child.post("/api/submissions", {
        assignmentId: second.id, studentId: pupil.id, answers,
        clientSubmissionId: raceId, completedAt: raceCompleted,
      })),
  );
  const accepted = together.filter((r) => r.body?.success === true);
  check(accepted.length === 5, "every one of five simultaneous sends is answered successfully",
    `${accepted.length} of 5`);
  const idsBack = new Set(accepted.map((r) => r.body?.submission?.id));
  check(idsBack.size === 1, "and every one names the same submission", `${idsBack.size} different ids`);
  check(await countSubmissions(second.id) === 1,
    "the database holds exactly one, whichever of them won the race");

  // =======================================================================
  section("The ways it should NOT go through");
  // =======================================================================

  // Different work, same paper. This is not a repeat, it is a second attempt —
  // and it is refused, so the phone shows it to the child rather than the
  // school ending up with two.
  const differentId = await child.post("/api/submissions", {
    assignmentId: paper.id, studentId: pupil.id, answers,
    clientSubmissionId: newClientId(), completedAt: finishedAt,
  });
  check(differentId.body?.success === false,
    "a NEW device id for a paper already handed in is refused, not stored twice");
  check(typeof differentId.body?.message === "string" && differentId.body.message.length > 0,
    "and the refusal says why, in words a child can read");
  check(await countSubmissions(paper.id) === 1, "still exactly one submission");
  check(interpretReply({ status: differentId.status, body: differentId.body }).kind === "refused",
    "the phone reads that refusal as 'stop and tell them', not 'try again'");

  // A device id is not a password.
  const thief = new Session();
  await thief.post("/api/auth/student/login", { fullName: other.fullName, password: "offline123" });
  const stealAttempt = await thief.post("/api/submissions", {
    assignmentId: paper.id, studentId: other.id, answers,
    clientSubmissionId: deviceId, completedAt: finishedAt,
  });
  check(stealAttempt.status === 403,
    "another pupil sending someone else's device id is refused", String(stealAttempt.status));
  check(JSON.stringify(stealAttempt.body ?? {}).indexOf(String(submissionId)) === -1,
    "and is told nothing about the work that id belongs to");

  const strangers = new Session();
  const loggedOut = await strangers.post("/api/submissions", {
    assignmentId: paper.id, studentId: pupil.id, answers, clientSubmissionId: newClientId(),
  });
  check(loggedOut.status === 401, "a logged-out caller cannot hand work in", String(loggedOut.status));

  // =======================================================================
  section("Nothing changed for work handed in the ordinary way");
  // =======================================================================

  const third = (await teacher.post("/api/assignments", {
    subject: "SCIENCE", topic: "Plants", form: FORM, title: `Online paper ${stamp}`,
    instructions: "Answer all four.", dueDate: "2026-12-01", totalMarks: 4,
    createdById: 1, questions,
  })).body?.assignment;
  check(!!third?.id, "a third paper, for an ordinary hand-in");
  if (!third?.id) return;
  onCleanup(`assignment ${third.id}`, () => teacher.delete(`/api/assignments/${third.id}`));

  const ordinary = await child.post("/api/submissions", {
    assignmentId: third.id, studentId: pupil.id, answers,
  });
  check(ordinary.body?.success === true, "a hand-in with no device id works exactly as before");
  check(ordinary.body?.mark?.totalScore === 4, "and is marked as before");
  check(ordinary.body?.submission?.clientSubmissionId == null,
    "it carries no device id");
  check(ordinary.body?.submission?.receivedAt == null,
    "and no arrival time, because there was no gap to record");
  const dated = new Date(ordinary.body?.submission?.submittedAt).getTime();
  check(Math.abs(Date.now() - dated) < 60_000,
    "an ordinary hand-in is still dated now");

  // =======================================================================
  section("A clock that cannot be believed");
  // =======================================================================

  const fourth = (await teacher.post("/api/assignments", {
    subject: "MATHS", topic: "Clocks", form: FORM, title: `Clock paper ${stamp}`,
    instructions: "Answer all four.", dueDate: "2026-12-01", totalMarks: 4,
    createdById: 1, questions,
  })).body?.assignment;
  check(!!fourth?.id, "a fourth paper, for the clock checks");
  if (!fourth?.id) return;
  onCleanup(`assignment ${fourth.id}`, () => teacher.delete(`/api/assignments/${fourth.id}`));

  // Set the clock back to before the paper existed — which is what beating a
  // deadline would look like.
  const backdated = await child.post("/api/submissions", {
    assignmentId: fourth.id, studentId: pupil.id, answers,
    clientSubmissionId: newClientId(), completedAt: "2020-01-01T00:00:00.000Z",
  });
  check(backdated.body?.success === true, "the work is still accepted — the child is not punished");
  const backTime = new Date(backdated.body?.submission?.submittedAt).getTime();
  check(Math.abs(Date.now() - backTime) < 60_000,
    "but a claim from before the paper was set is not used",
    backdated.body?.submission?.submittedAt);

  const fifth = (await teacher.post("/api/assignments", {
    subject: "MATHS", topic: "Clocks", form: FORM, title: `Future paper ${stamp}`,
    instructions: "Answer all four.", dueDate: "2026-12-01", totalMarks: 4,
    createdById: 1, questions,
  })).body?.assignment;
  check(!!fifth?.id, "a fifth paper, for a clock running fast");
  if (!fifth?.id) return;
  onCleanup(`assignment ${fifth.id}`, () => teacher.delete(`/api/assignments/${fifth.id}`));

  const future = await child.post("/api/submissions", {
    assignmentId: fifth.id, studentId: pupil.id, answers,
    clientSubmissionId: newClientId(), completedAt: "2030-01-01T00:00:00.000Z",
  });
  const futureTime = new Date(future.body?.submission?.submittedAt).getTime();
  check(future.body?.success === true && Math.abs(Date.now() - futureTime) < 60_000,
    "work cannot be dated in the future, which would break the day's game plays",
    future.body?.submission?.submittedAt);

  // =======================================================================
  section("A device id that is not one");
  // =======================================================================

  const sixth = (await teacher.post("/api/assignments", {
    subject: "MATHS", topic: "Ids", form: FORM, title: `Id paper ${stamp}`,
    instructions: "Answer all four.", dueDate: "2026-12-01", totalMarks: 4,
    createdById: 1, questions,
  })).body?.assignment;
  check(!!sixth?.id, "a sixth paper, for a rubbish device id");
  if (!sixth?.id) return;
  onCleanup(`assignment ${sixth.id}`, () => teacher.delete(`/api/assignments/${sixth.id}`));

  const tooShort = await child.post("/api/submissions", {
    assignmentId: sixth.id, studentId: pupil.id, answers, clientSubmissionId: "abc",
  });
  check(tooShort.body?.success === false,
    "an id too short to be unique is refused rather than risking a collision");
  check(await countSubmissions(sixth.id) === 0, "and nothing was stored");
}

function summary(): boolean {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);
  return failed === 0;
}

void runCheck(main, summary);
