// English and Portuguese, proved in a real browser.
//
//   npm run check:language   (start the server first: npm run dev)
//
// Two halves.
//
// The dictionaries on their own. `npm run check` already proves Portuguese has
// every key English has — that is what the Translation type in lib/i18n is for.
// What a type CANNOT see is a key that was added to en.ts and pasted unchanged
// into pt.ts, which typechecks perfectly and shows a Mozambican family an
// English sentence. So every string is compared against its English twin.
//
// Then a real browser, because the promise here is about what a person SEES:
// switch to Portuguese, walk the screens a family actually uses, come back to
// English, and reload to prove the choice stuck.
//
// The check that matters most is the last one on the assignment screen: the
// interface is in Portuguese while the teacher's own question is still, word
// for word, exactly what they typed. Translating a child's homework would
// change the meaning of the thing they are being marked on.

import { en } from "../client/src/lib/i18n/en";
import { pt } from "../client/src/lib/i18n/pt";
import { Browser, type Page } from "./chrome";
import { onCleanup, runCheck } from "./cleanup";

const BASE = "http://localhost:5000";
const TEACHER = { email: "onpointeducationcentremoza@gmail.com", password: "onpoint123" };
const CHILD_PASSWORD = "lang123";

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

/**
 * Words that are genuinely the same in both languages.
 *
 * Short and argued for one by one, because the whole value of the check below
 * is that this list is the ONLY way a string can be identical in both.
 */
const SAME_IN_BOTH = new Set([
  "Normal",                       // the same word, and used as a priority level
  "— On Point Education Centre",  // the school's own name
  "—",                            // a dash, standing in for a score nobody has yet
]);

/**
 * Keys whose output is the same in both languages ON PURPOSE.
 *
 * forClass() is "— Stage 4": a dash and the school's own name for a class.
 * There is nothing in it to translate, and inventing a difference would mean
 * renaming the school's classes.
 */
const SAME_BY_DESIGN = ["teacherDash.forClass"];

/** Every leaf of a dictionary, as path -> value. Functions are called first. */
function flatten(value: unknown, path = "", into: Record<string, string> = {}): Record<string, string> {
  if (typeof value === "string") { into[path] = value; return into; }
  if (typeof value === "function") {
    // Called with sample values so a translated sentence can be compared. Both
    // dictionaries get the same samples, so the comparison is fair.
    const samples: unknown[][] = [[1], [2], ["Stage 4"], [3, 4], [1, 2, false]];
    for (const args of samples) {
      try {
        const out = (value as (...a: unknown[]) => unknown)(...args);
        if (typeof out === "string") { into[`${path}(${args.join(",")})`] = out; }
      } catch { /* wrong shape of argument for this one */ }
    }
    return into;
  }
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) flatten(inner, path ? `${path}.${key}` : key, into);
  }
  return into;
}

async function main() {
  console.log(`\nEnglish and Portuguese (run ${stamp})\n`);

  // =======================================================================
  section("The two dictionaries, side by side");
  // =======================================================================

  const english = flatten(en);
  const portuguese = flatten(pt);

  const englishKeys = Object.keys(english);
  check(englishKeys.length > 200, "there is a real dictionary to check", `${englishKeys.length} strings`);

  const missing = englishKeys.filter((k) => !(k in portuguese));
  check(missing.length === 0, "every English string has a Portuguese one",
    missing.slice(0, 3).join(", "));

  const extra = Object.keys(portuguese).filter((k) => !(k in english));
  check(extra.length === 0, "and Portuguese has nothing English does not", extra.slice(0, 3).join(", "));

  const blank = englishKeys.filter((k) => !portuguese[k]?.trim());
  check(blank.length === 0, "no Portuguese string was left blank", blank.slice(0, 3).join(", "));

  // The one a type cannot catch: English pasted into pt.ts.
  const untranslated = englishKeys.filter(
    (k) =>
      k in portuguese &&
      portuguese[k] === english[k] &&
      !SAME_IN_BOTH.has(english[k]) &&
      !SAME_BY_DESIGN.some((prefix) => k.startsWith(prefix)),
  );
  check(untranslated.length === 0,
    "and nothing was left sitting in English inside the Portuguese file",
    untranslated.slice(0, 4).map((k) => `${k}: "${english[k]}"`).join(" | "));

  // =======================================================================
  section("Setting up a class to look at");
  // =======================================================================

  const teacher = new Session();
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (!login.body?.success) {
    console.log("\n  Could not sign in as the teacher. Is the server running? (npm run dev)\n");
    failed++;
    return;
  }

  const pupil = must((await teacher.post("/api/students", {
    studentId: `LANG-${stamp}`, fullName: `Language Child ${stamp}`, gender: "Female", form: FORM,
  })).body?.student, "a pupil");
  onCleanup(`pupil ${pupil.id}`, () => teacher.delete(`/api/students/${pupil.id}`));

  // The teacher's own words. Deliberately English, deliberately specific, and
  // checked character for character further down.
  const QUESTION = "What is 2 + 2, and how did you work it out?";
  const TITLE = `Adding up ${stamp}`;
  const INSTRUCTIONS = "Answer both questions in your own words.";

  const paper = must((await teacher.post("/api/assignments", {
    subject: "MATHS", topic: "Adding", form: FORM, title: TITLE,
    instructions: INSTRUCTIONS, dueDate: "2026-12-01", totalMarks: 2, createdById: 1,
    questions: [
      { id: "q1", questionText: QUESTION, maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 },
      { id: "q2", questionText: "Name one thing you found tricky.", maxScore: 1, type: "short_text", acceptedAnswers: ["nothing"] },
    ],
  })).body?.assignment, "a paper");
  onCleanup(`assignment ${paper.id}`, () => teacher.delete(`/api/assignments/${paper.id}`));

  // A parent account for this child, so the parent portal can be looked at too.
  const parentCreds = { fullName: "Language Parent", username: `checklang_${stamp}`, password: "parent123" };
  const parent = must((await teacher.post(`/api/students/${pupil.id}/parent`, parentCreds)).body?.parent, "a parent account");
  onCleanup(`parent account ${parentCreds.username}`, () => teacher.delete(`/api/parents/${parent.id}`));

  // First login sets the pupil's password.
  const child = new Session();
  must((await child.post("/api/auth/student/login", {
    fullName: pupil.fullName, password: CHILD_PASSWORD,
  })).body?.success || null, "the pupil's login");

  const browser = await Browser.launch();
  onCleanup("the browser", () => browser.close());
  const page = await browser.newPage();

  /** Switch language by tapping the toggle, the way a person would. */
  async function switchTo(language: "en" | "pt") {
    await page.click(`button-language-${language}`);
    await page.waitFor(
      `return document.documentElement.lang === "${language}"`,
      `the page to switch to ${language}`,
    );
  }

  // =======================================================================
  section("A family that reads Portuguese, arriving at the login page");
  // =======================================================================

  await page.goto(`${BASE}/student/login`);
  await page.waitForTestId("language-toggle");
  check((await page.bodyText()).includes(en.login.student.title),
    "the login page opens in English to begin with");

  check(await page.exists("button-language-pt"),
    "the language toggle is there BEFORE anyone signs in, which is when it is needed");

  await switchTo("pt");
  const loginPt = await page.bodyText();
  check(loginPt.includes(pt.login.student.title), "the login page is in Portuguese", pt.login.student.title);
  check(loginPt.includes(pt.common.password), "including the password label", pt.common.password);
  check(!loginPt.includes(en.login.student.title), "and none of the English is left behind");

  check(await page.evaluate<string>(`return document.documentElement.lang`) === "pt",
    "the page tells the browser it is in Portuguese, so a screen reader knows");

  // =======================================================================
  section("The choice is remembered");
  // =======================================================================

  check(await page.evaluate<string | null>(`return localStorage.getItem("onpoint-language")`) === "pt",
    "the choice is written to the device");

  await page.reload();
  await page.waitForTestId("language-toggle");
  check((await page.bodyText()).includes(pt.login.student.title),
    "and it is still Portuguese after the app is reloaded");

  // =======================================================================
  section("A child's own screens, in Portuguese");
  // =======================================================================

  await page.fill("input-fullname", pupil.fullName);
  await page.fill("input-password", CHILD_PASSWORD);
  await page.click("button-login");
  await page.waitFor(`return location.pathname === "/student/dashboard"`, "the dashboard to open");

  // The homework list is fetched after the page itself loads, so wait for it
  // instead of reading a dashboard that has not finished arriving.
  await page.waitFor(
    `return (document.body.innerText || "").includes(${JSON.stringify(TITLE)})`,
    "the homework list to arrive",
  );
  const dash = await page.bodyText();
  check(dash.includes(pt.studentDash.portal), "the dashboard is in Portuguese", pt.studentDash.portal);
  check(dash.includes(pt.studentDash.assignments), "including the homework heading", pt.studentDash.assignments);
  check(dash.includes(pt.studentDash.results), "and the results heading", pt.studentDash.results);
  check(!dash.includes(en.studentDash.portal), "with no English heading left on it");

  // The teacher's own title, on a Portuguese screen, exactly as they typed it.
  check(dash.includes(TITLE), "and the teacher's own assignment title is untouched", TITLE);

  // =======================================================================
  section("The assignment screen — the interface only");
  // =======================================================================

  await page.goto(`${BASE}/student/submit/${paper.id}`);
  await page.waitForTestId("button-submit");
  const paperPage = await page.bodyText();

  check(paperPage.includes(pt.submit.instructions), "the labels are in Portuguese", pt.submit.instructions);
  check(paperPage.includes(pt.submit.handIn), "including the hand-in button", pt.submit.handIn);
  check(paperPage.includes(pt.offline.saveForOffline), "and the offline wording", pt.offline.saveForOffline);

  // THE RULE. The teacher wrote these; nothing may touch them.
  check(paperPage.includes(QUESTION), "the teacher's QUESTION is word for word as they typed it", QUESTION);
  check(paperPage.includes(INSTRUCTIONS), "so are their instructions", INSTRUCTIONS);
  check(paperPage.includes(TITLE), "and the title of their paper", TITLE);
  check(paperPage.includes(pupil.fullName) || dash.includes(pupil.fullName),
    "and the child's name is their own, not a translation of it");

  // =======================================================================
  section("Switching back to English");
  // =======================================================================

  await switchTo("en");
  const backToEnglish = await page.bodyText();
  check(backToEnglish.includes(en.submit.instructions), "the interface is English again", en.submit.instructions);
  check(!backToEnglish.includes(pt.submit.instructions), "with the Portuguese gone");
  check(backToEnglish.includes(QUESTION), "and the teacher's question STILL exactly as they typed it");

  // =======================================================================
  section("A teacher's dashboard");
  // =======================================================================

  const teacherPage = await browser.newPage();
  await teacherPage.goto(`${BASE}/teacher/login`);
  await teacherPage.waitForTestId("language-toggle");
  await teacherPage.click("button-language-pt");
  await teacherPage.waitFor(`return document.documentElement.lang === "pt"`, "the teacher login to switch");
  check((await teacherPage.bodyText()).includes(pt.login.teacher.title),
    "the teacher's login is in Portuguese", pt.login.teacher.title);

  await teacherPage.fill("input-email", TEACHER.email);
  await teacherPage.fill("input-password", TEACHER.password);
  await teacherPage.click("button-login");
  await teacherPage.waitFor(`return location.pathname === "/teacher/dashboard"`, "the teacher dashboard to open");

  // Same as the pupil's list: the assignments arrive after the page does.
  await teacherPage.waitFor(
    `return (document.body.innerText || "").includes(${JSON.stringify(TITLE)})`,
    "the teacher's assignment list to arrive",
  );
  const teacherDash = await teacherPage.bodyText();
  check(teacherDash.includes(pt.teacherDash.portal), "the teacher's dashboard is in Portuguese", pt.teacherDash.portal);
  check(teacherDash.includes(pt.teacherDash.totalStudents), "including the figures along the top", pt.teacherDash.totalStudents);
  check(teacherDash.includes(pt.teacherDash.questionBank), "and the tiles", pt.teacherDash.questionBank);
  check(!teacherDash.includes(en.teacherDash.totalStudents), "with no English left among them");
  check(teacherDash.includes(TITLE), "and the teacher's own paper is titled as they typed it");

  // The language was chosen in a different tab, on a different portal. It is
  // one setting for this device, so it applies here too.
  check(await teacherPage.evaluate<string>(`return document.documentElement.lang`) === "pt",
    "one choice covers the whole app, not one portal at a time");

  // =======================================================================
  section("A parent's portal");
  // =======================================================================

  const parentPage = await browser.newPage();
  await parentPage.goto(`${BASE}/parent/login`);
  await parentPage.waitForTestId("language-toggle");
  check((await parentPage.bodyText()).includes(pt.login.parent.title),
    "the parent's login is already in Portuguese, because the device remembers",
    pt.login.parent.title);

  await parentPage.fill("input-parent-username", parentCreds.username);
  await parentPage.fill("input-parent-password", parentCreds.password);
  await parentPage.click("button-parent-login");
  await parentPage.waitFor(`return location.pathname === "/parent/dashboard"`, "the parent dashboard to open");
  await sleep(1500); // its panels load one after another

  const parentDash = await parentPage.bodyText();
  check(parentDash.includes(pt.parentDash.portal), "the parent's portal is in Portuguese", pt.parentDash.portal);
  check(parentDash.includes(pt.parentDash.yourChild), "including the child's card", pt.parentDash.yourChild);
  check(parentDash.includes(pt.report.title) || parentDash.includes(pt.overview.average),
    "and the weekly report, whose wording lives in shared/");
  check(!parentDash.includes(en.parentDash.portal), "with no English portal heading");
  check(parentDash.includes(pupil.fullName), "and their child is named exactly as the school registered them");
}

void runCheck(main, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);
  return failed === 0;
});
