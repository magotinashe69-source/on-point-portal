// The service worker, in the only place it exists: the built app.
//
//   npm run check:offline:pwa
//
// This one builds the app and starts it the way a server would, because the
// service worker is deliberately NEVER registered in development (see
// client/src/lib/pwa.ts) — an old cached bundle while you are editing code is
// maddening. So `npm run dev` cannot exercise a single line of client/public/sw.js,
// and the file that decides whether a child can open the app with no internet
// would otherwise be the one file nothing tests.
//
// What it is here to prove:
//
//   * the app itself is saved, so it STARTS with no internet. This is the whole
//     point. The fallback used to be a page saying "you are offline" and
//     nothing else — a dead end, because a child who had saved their homework
//     could not reach it: the app never started, so nothing ever read the
//     device.
//   * /api/ is never in a cache. A cached mark is a mark a teacher has already
//     changed, shown to a child as though it were true.
//
// Everything is on its own port and its own build, so a dev server can be left
// running while this runs.
//
// It is slower than the other checks — it really does build the app. SKIP_BUILD=1
// reuses whatever is in dist/ when iterating on the checks themselves.

import { spawn, type ChildProcess } from "node:child_process";
import { Browser, type Page } from "./chrome";
import { onCleanup, runCheck } from "./cleanup";

const PORT = parseInt(process.env.PWA_PORT || "5050", 10);
const BASE = `http://localhost:${PORT}`;
const TEACHER = { email: "onpointeducationcentremoza@gmail.com", password: "onpoint123" };
const CHILD_PASSWORD = "offline123";
const OFFLINE_PAGE_TITLE = "No connection | On Point Homework";

let passed = 0;
let failed = 0;
function check(ok: boolean, description: string, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${description}`); }
  else { failed++; console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`); }
}
function section(title: string) { console.log(`\n${title}`); }

function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`Could not set up ${what}.`);
  return value;
}

const stamp = Date.now().toString().slice(-6);
const FORM = "Stage 3";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

// --- Building it and running it ---

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
    child.on("error", reject);
  });
}

async function startBuiltServer(): Promise<ChildProcess> {
  const server = spawn(process.execPath, ["dist/index.cjs"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT) },
  });

  let output = "";
  server.stdout?.on("data", (c) => { output += c.toString(); });
  server.stderr?.on("data", (c) => { output += c.toString(); });

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`The built server would not start (${server.exitCode}).\n${output.slice(-2000)}`);
    }
    try {
      const res = await fetch(BASE + "/");
      if (res.ok) return server;
    } catch { /* still starting */ }
    await sleep(300);
  }
  throw new Error(`The built server never answered on ${BASE}.\n${output.slice(-2000)}`);
}

// --- Reading what the browser has saved ---

/** Every cache, and every address in it. */
function cacheContents(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate<Record<string, string[]>>(`
    const out = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      out[name] = (await cache.keys()).map((request) => request.url);
    }
    return out;
  `);
}

function everyCachedUrl(contents: Record<string, string[]>): string[] {
  return Object.values(contents).flat();
}

function outbox(page: Page): Promise<any[]> {
  return page.evaluate<any[]>(`
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open("onpoint-offline");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("outbox")) { resolve([]); return; }
        const all = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
        all.onsuccess = () => resolve(all.result);
        all.onerror = () => reject(all.error);
      };
    });
  `);
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
  await page.waitFor(
    `const b = document.querySelector('[data-testid="button-save-offline"]'); return !!b && !b.disabled;`,
    "the save button to be ready",
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.click("button-save-offline");
    try {
      await page.waitForTestId("text-saved-offline", 5000);
      return;
    } catch { /* the paper may have re-rendered under the tap; try again */ }
  }
  throw new Error(`Saving the paper to the device never took. The page says: ${(await page.bodyText()).slice(0, 300)}`);
}

async function waitUntil(condition: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await condition()) return true; } catch { /* mid-navigation */ }
    await sleep(200);
  }
  return false;
}

async function main() {
  console.log(`\nThe built app, with no internet (run ${stamp})\n`);

  if (process.env.SKIP_BUILD === "1") {
    console.log("  (SKIP_BUILD=1 — using whatever is already in dist/)\n");
  } else {
    console.log("  Building the app, which is the only way to get a service worker...\n");
    await run("npm", ["run", "build"]);
  }

  const server = await startBuiltServer();
  // Registered FIRST so it is torn down LAST: everything below needs it alive
  // to tidy itself up.
  onCleanup("the built server", async () => { server.kill(); });
  console.log(`\n  Serving the built app on ${BASE}\n`);

  // --- A child and a paper, over HTTP ---

  const teacher = new Session();
  must((await teacher.post("/api/auth/teacher/login", TEACHER)).body?.success || null, "the teacher's login");

  const pupil = must((await teacher.post("/api/students", {
    studentId: `OFFP-${stamp}`, fullName: `PWA Child ${stamp}`, gender: "Male", form: FORM,
  })).body?.student, "a pupil");
  onCleanup(`pupil ${pupil.id}`, () => teacher.delete(`/api/students/${pupil.id}`));

  const questions = [2, 3, 4, 5].map((n, i) => ({
    id: `q${i + 1}`, questionText: `What is ${n} + ${n}?`, maxScore: 1,
    type: "numeric", correctNumber: n * 2, tolerance: 0,
  }));
  const rightAnswers = questions.map((q) => String(q.correctNumber));

  const paper = must((await teacher.post("/api/assignments", {
    subject: "MATHS", topic: "Adding", form: FORM, title: `PWA paper ${stamp}`,
    instructions: "Answer all four.", dueDate: "2026-12-01", totalMarks: 4,
    createdById: 1, questions,
  })).body?.assignment, "a paper");
  onCleanup(`assignment ${paper.id}`, () => teacher.delete(`/api/assignments/${paper.id}`));

  const child = new Session();
  must((await child.post("/api/auth/student/login", {
    fullName: pupil.fullName, password: CHILD_PASSWORD,
  })).body?.success || null, "the pupil's login");

  async function submissionsAtSchool(): Promise<any[]> {
    const res = await child.get(`/api/submissions?assignmentId=${paper.id}&studentId=${pupil.id}`);
    return Array.isArray(res.body) ? res.body : [];
  }

  const browser = await Browser.launch();
  onCleanup("the browser", () => browser.close());
  const page = await browser.newPage();

  // =======================================================================
  section("A child who has used the app before");
  // =======================================================================

  await page.goto(`${BASE}/student/login`);
  await page.fill("input-fullname", pupil.fullName);
  await page.fill("input-password", CHILD_PASSWORD);
  await page.click("button-login");
  await page.waitFor(`return location.pathname === "/student/dashboard"`, "the dashboard to open");

  const tookCharge = await waitUntil(
    async () => page.evaluate<boolean>(`return !!navigator.serviceWorker.controller`),
    30000,
  );
  check(tookCharge, "the service worker installs and takes charge of the page");

  await page.goto(`${BASE}/student/submit/${paper.id}`);
  await saveToDevice(page);
  check(true, "and saves a paper to the device while there is still signal");

  // One ordinary load with the worker now in charge, which is what puts the
  // app's own files in the cache. A child who has opened the app twice.
  await page.goto(`${BASE}/student/dashboard`);

  const cached = await cacheContents(page);
  const urls = everyCachedUrl(cached);

  check(urls.includes(`${BASE}/`),
    "the app itself is saved, so it can start with no internet",
    Object.keys(cached).join(", "));

  check(urls.some((url) => url.includes("/assets/")),
    "and the built files it needs to run are saved beside it",
    `${urls.length} things cached`);

  // =======================================================================
  section("The signal goes, and the app is closed and reopened");
  // =======================================================================

  await browser.setOffline(true);
  await page.waitFor(`return navigator.onLine === false`, "the phone to notice the signal has gone");

  // The whole point of the service worker. Not a soft navigation inside a
  // running app — the app is GONE, and has to start from what is on the device.
  await page.reload();

  const title = await page.evaluate<string>(`return document.title`);
  check(title !== OFFLINE_PAGE_TITLE,
    "reopening it with no internet does not land on a dead end", title);

  const started = await waitUntil(
    async () => page.evaluate<boolean>(`return (document.querySelector("#root")?.childElementCount ?? 0) > 0`),
    20000,
  );
  check(started, "the app really starts, from the copy saved on the device");

  // Without this, the check above could be passed by a browser quietly serving
  // its own cache, and the service worker — the thing being tested — could be
  // doing nothing at all. workerStart is only ever set when a service worker
  // handled the request.
  const servedByWorker = await page.evaluate<number>(`
    return performance.getEntriesByType("navigation")[0]?.workerStart ?? 0;
  `);
  check(servedByWorker > 0, "and it was the service worker that served it, not a browser cache",
    `workerStart ${servedByWorker}`);

  check(await page.exists("sync-status") || await page.exists("button-logout"),
    "and the child is still signed in, on their own dashboard");

  // =======================================================================
  section("Answering the saved paper with nothing but the phone");
  // =======================================================================

  await page.goto(`${BASE}/student/submit/${paper.id}`);
  await page.waitForTestId("alert-offline-paper");
  const shown = await page.evaluate<number>(
    `return document.querySelectorAll('[data-testid^="input-number-"]').length`,
  );
  check(shown === 4, "the saved paper opens with all its questions, read off the device", `${shown} questions`);

  for (let i = 0; i < rightAnswers.length; i++) {
    await page.fill(`input-number-${i}`, rightAnswers[i]);
  }
  await page.click("button-submit");
  await page.waitFor(`return location.pathname === "/student/dashboard"`, "the hand-in to be kept");

  const waiting = await outbox(page);
  check(waiting.length === 1, "handing it in is accepted and kept on the device", `${waiting.length} items`);
  check((await submissionsAtSchool()).length === 0, "with nothing yet at the school");

  // =======================================================================
  section("The signal comes back");
  // =======================================================================

  // The child gets home and opens the app again — which is the path that
  // matters here, and the one startSyncing() exists for: it empties the queue
  // on load, with nothing tapped and no button to find.
  //
  // Worth knowing when reading this: Chrome's emulation does NOT replay the
  // online/offline transition into a document that was LOADED while the network
  // was already off, so no "online" event ever arrives in a page opened with no
  // signal. A real phone does fire one, and check:offline:browser covers that
  // path with a page that was open the whole time. Reopening the app here is
  // both the more realistic story and independent of the quirk.
  await browser.setOffline(false);
  await page.reload();

  const emptied = await waitUntil(async () => (await outbox(page)).length === 0, 25000);
  check(emptied, "opening the app again with signal sends the work on its own");

  const arrived = await submissionsAtSchool();
  check(arrived.length === 1, "and the school has exactly one copy of it", `${arrived.length}`);

  // =======================================================================
  section("What must never have been saved");
  // =======================================================================

  const finalCaches = await cacheContents(page);
  const finalUrls = everyCachedUrl(finalCaches);

  const liveData = finalUrls.filter((url) => new URL(url).pathname.startsWith("/api/"));
  check(liveData.length === 0,
    "no live data was cached — a saved mark is one a teacher has already changed",
    liveData.slice(0, 3).join(", "));

  const uploads = finalUrls.filter((url) => new URL(url).pathname.startsWith("/uploads/"));
  check(uploads.length === 0,
    "and no uploaded work either, which is nobody else's to keep on this phone",
    uploads.slice(0, 3).join(", "));
}

void runCheck(main, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);
  return failed === 0;
});
