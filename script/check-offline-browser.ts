// Offline mode, driven in a real browser.
//
//   npm run check:offline:browser   (start the server first: npm run dev)
//
// npm run check:offline proves the SERVER keeps its half of the promise: the
// same work arriving twice is stored once. This proves the other half, which
// happens entirely on a child's phone and cannot be tested by sending requests
// to anything:
//
//   * a paper saved to the device while there is signal
//   * answered with the network genuinely pulled out
//   * handed in, and kept — not refused, not lost
//   * sent on its own when the signal comes back, exactly once.
//
// Chrome's own network emulation is what makes it real: navigator.onLine really
// does go false and fetch() really does reject, which is the only way to
// exercise the paths a phone in a valley takes.
//
// The last section is the one that could not be produced any other way. A
// hand-in is held at the moment the SERVER HAS ALREADY STORED IT and the reply
// is still in the air, and the app is reloaded underneath it — the exact shape
// of a child closing the app on a bad connection. The work must not be thrown
// away (the school has not said anything yet), and when it is sent again it
// must not be stored twice.
//
// The service worker is NOT tested here: it is deliberately never registered in
// development. That is what check:offline:pwa is for.

import { OFFLINE_TEXT } from "../shared/offline";
import { Browser, type Page } from "./chrome";
import { onCleanup, runCheck } from "./cleanup";

const BASE = "http://localhost:5000";
const TEACHER = { email: "onpointeducationcentremoza@gmail.com", password: "onpoint123" };
const CHILD_PASSWORD = "offline123";

let passed = 0;
let failed = 0;
function check(ok: boolean, description: string, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${description}`); }
  else { failed++; console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`); }
}
function section(title: string) { console.log(`\n${title}`); }

/**
 * A fixture that has to exist for the run to mean anything.
 *
 * Deliberately NOT a check: a pupil who could not be created is not a failed
 * check, it is a run that never happened, and counting it as one failure among
 * thirty passes would read like a small problem instead of a wasted run.
 */
function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`Could not set up ${what}.`);
  return value;
}

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

// --- Reading the device itself ---
//
// Straight out of IndexedDB rather than off the screen. What a page happens to
// be showing is a rendering question; what is on the device is the promise.

const OPEN_DEVICE_STORE = (store: string) => `
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open("onpoint-offline");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("${store}")) { resolve([]); return; }
      const all = db.transaction("${store}", "readonly").objectStore("${store}").getAll();
      all.onsuccess = () => resolve(all.result);
      all.onerror = () => reject(all.error);
    };
  });
`;

function outbox(page: Page): Promise<any[]> {
  return page.evaluate<any[]>(OPEN_DEVICE_STORE("outbox"));
}

function savedPapers(page: Page): Promise<any[]> {
  return page.evaluate<any[]>(OPEN_DEVICE_STORE("papers"));
}

/**
 * A field that would be a CHILD'S RESULT, anywhere in what is on the device.
 *
 * Matched as whole field names rather than as text, and that distinction is the
 * entire point: a saved paper legitimately carries `maxScore` and `totalMarks`
 * — what a question is worth, which is part of the question. What it must never
 * carry is `totalScore` or `feedback` — what this child got, which goes stale
 * the moment a teacher changes a mark.
 */
const RESULT_FIELDS = new Set([
  "totalscore", "score", "percentage", "grade", "feedback", "iscorrect", "markedat", "mark",
]);
function holdsAResult(value: unknown, path = ""): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = holdsAResult(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [field, inner] of Object.entries(value)) {
      if (RESULT_FIELDS.has(field.toLowerCase())) return `${path}.${field}`;
      const found = holdsAResult(inner, `${path}.${field}`);
      if (found) return found;
    }
  }
  return null;
}

async function main() {
  console.log(`\nOffline mode in a real browser (run ${stamp})\n`);

  // =======================================================================
  // A class, a paper, and a child — made over HTTP, because none of it is
  // what is being tested.
  // =======================================================================

  const teacher = new Session();
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (!login.body?.success) {
    console.log("\n  Could not sign in as the teacher. Is the server running? (npm run dev)\n");
    failed++;
    return;
  }

  const pupil = must((await teacher.post("/api/students", {
    studentId: `OFFB-${stamp}`, fullName: `Browser Child ${stamp}`, gender: "Female", form: FORM,
  })).body?.student, "a pupil");
  onCleanup(`pupil ${pupil.id}`, () => teacher.delete(`/api/students/${pupil.id}`));

  const questions = [2, 3, 4, 5].map((n, i) => ({
    id: `q${i + 1}`, questionText: `What is ${n} + ${n}?`, maxScore: 1,
    type: "numeric", correctNumber: n * 2, tolerance: 0,
  }));
  const rightAnswers = questions.map((q) => String(q.correctNumber));

  async function makePaper(title: string) {
    const paper = must((await teacher.post("/api/assignments", {
      subject: "MATHS", topic: "Adding", form: FORM, title,
      instructions: "Answer all four.", dueDate: "2026-12-01", totalMarks: 4,
      createdById: 1, questions,
    })).body?.assignment, "a paper");
    onCleanup(`assignment ${paper.id}`, () => teacher.delete(`/api/assignments/${paper.id}`));
    return paper;
  }

  const paper = await makePaper(`Browser paper ${stamp}`);
  const second = await makePaper(`Browser paper two ${stamp}`);

  // The child's first login sets their password, so this is also what puts one
  // on the account the browser is about to use.
  const child = new Session();
  must((await child.post("/api/auth/student/login", {
    fullName: pupil.fullName, password: CHILD_PASSWORD,
  })).body?.success || null, "the pupil's login");

  /** What the SCHOOL has, asked over HTTP — never through the browser. */
  async function submissionsAtSchool(assignmentId: number): Promise<any[]> {
    const res = await child.get(`/api/submissions?assignmentId=${assignmentId}&studentId=${pupil.id}`);
    return Array.isArray(res.body) ? res.body : [];
  }

  const browser = await Browser.launch();
  onCleanup("the browser", () => browser.close());

  const page = await browser.newPage();

  // =======================================================================
  section("A child signing in on their own phone");
  // =======================================================================

  await page.goto(`${BASE}/student/login`);
  check(await page.exists("input-fullname"), "the app opens in a real browser");

  await page.fill("input-fullname", pupil.fullName);
  await page.fill("input-password", CHILD_PASSWORD);
  await page.click("button-login");
  await page.waitFor(`return location.pathname === "/student/dashboard"`, "the dashboard to open");
  check(true, "the child is signed in and lands on their dashboard");

  // =======================================================================
  section("Saving a paper to the device, while there is still signal");
  // =======================================================================

  await page.goto(`${BASE}/student/submit/${paper.id}`);
  await page.waitForTestId("button-submit");
  check((await page.bodyText()).includes(paper.title), "the paper opens");

  check(await page.exists("button-save-offline"), "it can be saved to the device");
  await saveToDevice(page);
  check(true, "and the page then says it is saved");

  const papers = await savedPapers(page);
  const savedPaper = papers.find((p) => p.key === `${pupil.id}:${paper.id}`);
  check(!!savedPaper, "the paper really is on the device, under this child's own key",
    `keys: ${papers.map((p) => p.key).join(", ") || "none"}`);

  check(savedPaper?.assignment?.questions?.length === 4,
    "the saved copy carries the questions", `${savedPaper?.assignment?.questions?.length} questions`);

  // A shared family phone gets one of these written to it. It must not be
  // carrying the answer key for a paper nobody has sat yet.
  const key = JSON.stringify(savedPaper?.assignment ?? {});
  check(!/correctNumber|correctOption|correctBool|acceptedAnswers|modelAnswer/.test(key),
    "and no answer key travelled with it");

  // =======================================================================
  section("The signal goes");
  // =======================================================================

  const networkPulledAt = Date.now();
  await browser.setOffline(true);

  await page.waitFor(`return navigator.onLine === false`, "the phone to notice the signal has gone");
  check(true, "the phone knows it has no signal");

  await page.waitForTestId("alert-offline-paper");
  check(true, "the paper says there is no internet instead of showing an error");

  check((await page.bodyText()).includes(OFFLINE_TEXT.markComesLater),
    "and says the mark will come later, so a missing score does not look broken");

  // =======================================================================
  section("Answering it anyway");
  // =======================================================================

  for (let i = 0; i < rightAnswers.length; i++) {
    await page.fill(`input-number-${i}`, rightAnswers[i]);
  }
  const typed = await page.evaluate<string[]>(`
    return Array.from(document.querySelectorAll('[data-testid^="input-number-"]')).map((el) => el.value);
  `);
  check(typed.join(",") === rightAnswers.join(","), "every answer can be typed with no signal",
    `got ${typed.join(",")}`);

  await page.click("button-submit");
  await page.waitFor(`return location.pathname === "/student/dashboard"`, "the hand-in to be accepted");
  check(true, "handing in is accepted rather than refused");

  check((await page.bodyText()).includes(OFFLINE_TEXT.handedInOffline),
    "and the child is told their work is safe on the phone");

  check((await submissionsAtSchool(paper.id)).length === 0,
    "nothing reached the school — there is no submission");

  const waiting = await outbox(page);
  check(waiting.length === 1, "the work is waiting on the device", `${waiting.length} items`);

  const queued = waiting[0] ?? {};
  check(typeof queued.clientId === "string" && queued.clientId.length >= 8,
    "it carries a device id, which is what makes sending it twice harmless",
    String(queued.clientId));

  const completedAt = new Date(queued.completedAt ?? 0).getTime();
  check(completedAt >= networkPulledAt && completedAt <= Date.now(),
    "it is dated by the child's own clock, in the window they had no signal",
    `${queued.completedAt}`);

  check(holdsAResult(queued) === null,
    "and no mark is stored beside it", `found ${holdsAResult(queued)}`);

  await page.waitForTestId("sync-status");
  check(await page.exists("badge-offline"), "the dashboard says there is no internet");
  check((await page.textOf("text-sync-summary")).length > 0,
    "and says, in a sentence, that work is waiting to be sent",
    await page.textOf("text-sync-summary"));

  // =======================================================================
  section("The signal comes back");
  // =======================================================================

  // A deliberate few seconds still with no signal, so "when the child finished"
  // and "when it reached the school" are provably different numbers instead of
  // the same instant read twice.
  await sleep(3500);
  const reachedSchoolAt = Date.now();
  await browser.setOffline(false);

  await page.waitFor(`return navigator.onLine === true`, "the phone to notice the signal is back");

  // Nobody taps anything. The queue goes because the connection came back.
  const emptied = await waitUntil(async () => (await outbox(page)).length === 0, 20000);
  check(emptied, "the work goes on its own, with no tap");

  const arrived = await submissionsAtSchool(paper.id);
  check(arrived.length === 1, "the school has exactly one piece of work", `${arrived.length}`);

  const submissionId = arrived[0]?.id;

  // Stored to the second, so this is "the same moment", not "the same string".
  const storedAt = new Date(arrived[0]?.submittedAt ?? 0).getTime();
  const finishedAt = new Date(queued.completedAt).getTime();
  check(Math.abs(storedAt - finishedAt) < 1000,
    "dated when the CHILD finished, by the clock on their own phone",
    `${arrived[0]?.submittedAt} vs ${queued.completedAt}`);

  check(reachedSchoolAt - storedAt >= 2000,
    "and provably NOT when it arrived — it sat on the phone for seconds first",
    `${((reachedSchoolAt - storedAt) / 1000).toFixed(1)}s`);

  // /api/marks/:id answers with the mark spread across the top level, not
  // wrapped — the bare-shape trap CLAUDE.md warns about.
  const markBody = (await child.get(`/api/marks/${submissionId}`)).body;
  const mark = markBody?.mark ?? markBody;
  check(mark?.totalScore === 4, "and marked on arrival, like any other hand-in",
    `totalScore ${mark?.totalScore}`);

  check(await page.exists("text-sync-done"), "the child is told it reached their teacher");

  const deviceAfter = { outbox: await outbox(page), papers: await savedPapers(page) };
  check(holdsAResult(deviceAfter) === null,
    "and the device still holds no mark — a saved score would go stale",
    `found ${holdsAResult(deviceAfter)}`);

  // =======================================================================
  section("The reply that never arrived");
  // =======================================================================
  //
  // The dangerous case, and the only one that needs a browser held open at a
  // precise moment: the work REACHES the school, and the app is closed before
  // the reply gets back. Nothing on the phone knows it arrived.

  await page.goto(`${BASE}/student/submit/${second.id}`);
  await saveToDevice(page);

  await browser.setOffline(true);
  await page.waitFor(`return navigator.onLine === false`, "the signal to go again");
  await page.waitForTestId("alert-offline-paper");
  for (let i = 0; i < rightAnswers.length; i++) {
    await page.fill(`input-number-${i}`, rightAnswers[i]);
  }
  await page.click("button-submit");
  await page.waitFor(`return location.pathname === "/student/dashboard"`, "the second hand-in to be kept");

  const queuedAgain = await outbox(page);
  check(queuedAgain.length === 1, "a second piece of work is waiting on the device",
    `${queuedAgain.length} items`);

  // Catch the hand-in on its way back, after the server has answered it.
  const held: any[] = [];
  page.onRequestPaused((params) => { held.push(params); });
  await page.interceptRequests("*/api/submissions", "Response");

  await browser.setOffline(false);
  const caught = await waitUntil(async () => held.length > 0, 20000);
  check(caught, "the hand-in is caught on its way back, reply still in the air");

  check((await submissionsAtSchool(second.id)).length === 1,
    "the school has the work — but the phone has not been told yet");

  const midSend = await outbox(page);
  check(midSend.length === 1 && midSend[0]?.state === "sending",
    "the work is still on the device: nothing is thrown away before the school confirms it",
    `${midSend.length} items, state ${midSend[0]?.state}`);

  // The app is reloaded before it can hear the answer, and the interception is
  // lifted only once the page that was listening for it is already gone.
  const reloading = page.reload();
  await page.stopIntercepting();
  await reloading;

  const emptiedAfterReload = await waitUntil(async () => (await outbox(page)).length === 0, 25000);
  check(emptiedAfterReload, "the reopened app sends it again and the queue empties");

  const secondAtSchool = await submissionsAtSchool(second.id);
  check(secondAtSchool.length === 1,
    "and the school still has exactly ONE copy of it", `${secondAtSchool.length}`);
}

/**
 * Tap "Save for offline" and wait until the page says it took.
 *
 * The button is on the screen before the paper it saves has arrived, and it is
 * disabled until then — so waiting for the SUBMIT button first is what makes
 * this reliable: it only exists once the questions are really rendered.
 */
async function saveToDevice(page: Page): Promise<void> {
  await page.waitForTestId("button-submit");

  for (let attempt = 0; attempt < 3; attempt++) {
    // Before EVERY tap, not just the first. The button disables itself while a
    // save is in flight, so a retry that does not wait taps a disabled button
    // and reports that as the failure instead of whatever went wrong.
    await page.waitFor(
      `const b = document.querySelector('[data-testid="button-save-offline"]'); return !!b && !b.disabled;`,
      "the save button to be ready",
    );
    await page.click("button-save-offline");
    try {
      await page.waitForTestId("text-saved-offline", 5000);
      return;
    } catch { /* the paper may have re-rendered under the tap; try again */ }
  }
  throw new Error(`Saving the paper to the device never took. The page says: ${(await page.bodyText()).slice(0, 300)}`);
}

/** Poll until true, or give up. Used where the app acts on its own. */
async function waitUntil(condition: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await condition()) return true; } catch { /* mid-navigation */ }
    await sleep(200);
  }
  return false;
}

void runCheck(main, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);
  return failed === 0;
});
