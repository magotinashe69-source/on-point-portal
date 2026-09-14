// The locks on the doors.
//
//   npm run check:security   (start the server first: npm run dev)
//
// Every other check script proves a feature works. This one proves the ways in
// are shut, and it grows as each fix lands. What it covers today:
//
//   * guessing a password is limited, PER ACCOUNT rather than per address, so a
//     class logging in together is never mistaken for an attack;
//   * a refusal never says which half was wrong, so the form cannot be used to
//     find out who is on the register;
//   * a password is never stored as the person typed it, and one stored that way
//     before is turned into a hash the moment its owner next signs in;
//   * somebody can change their own password, and only their own;
//   * a new pupil's account cannot be claimed by typing their name: the first
//     sign-in needs the one-time code their teacher was given;
//   * a first name two pupils share opens neither account;
//   * a login always starts a new session, so an id learned before it is
//     worth nothing after it;
//   * an upload is written once, and never over somebody else's.
//
// Everything here uses made-up accounts. That is not tidiness — the limiter's
// budget is keyed on the name being tried, so using a real one would lock a
// real teacher or pupil out for five minutes, and the check scripts that run
// after this one sign in as the teacher.

import { onCleanup, runCheck } from "./cleanup";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Browser } from "./chrome";
import { en } from "../client/src/lib/i18n/en";
import { db, ensureSchema } from "../server/db";
import { storage } from "../server/storage";
import { isHashed } from "../server/passwords";
import { students } from "@shared/schema";
import { eq } from "drizzle-orm";

const BASE = "http://localhost:5000";

let passed = 0;
let failed = 0;
function check(ok: boolean, description: string, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${description}`); }
  else { failed++; console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`); }
}
function section(title: string) { console.log(`\n${title}`); }

const stamp = Date.now().toString().slice(-6);

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json: any = null;
  try { json = JSON.parse(await res.text()); } catch { /* not JSON */ }
  return { status: res.status, body: json };
}

/** The same, but hands back the session cookie it was given. */
async function postWithCookie(path: string, body: unknown) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  let json: any = null;
  try { json = JSON.parse(await res.text()); } catch { /* not JSON */ }
  return { res: { status: res.status, body: json }, cookie };
}

/** Try one account until the door shuts, or give up. */
async function hammer(path: string, body: unknown, tries: number) {
  let blockedAt = 0;
  for (let i = 1; i <= tries; i++) {
    const res = await post(path, body);
    if (res.status === 429 || res.body?.code === "tooManyAttempts") { blockedAt = i; break; }
  }
  return blockedAt;
}

async function main() {
  console.log(`\nThe locks on the doors (run ${stamp})\n`);

  const reachable = await fetch(BASE + "/").then((r) => r.ok).catch(() => false);
  if (!reachable) {
    console.log("\n  The server is not answering. Start it first (npm run dev).\n");
    failed++;
    return;
  }

  // =======================================================================
  section("Guessing a teacher's password");
  // =======================================================================

  const fakeTeacher = `nobody-${stamp}@example.com`;
  const teacherBlocked = await hammer("/api/auth/teacher/login",
    { email: fakeTeacher, password: "not-the-password" }, 15);

  check(teacherBlocked > 0, "the door shuts on a teacher's login",
    "fifteen wrong passwords and it never refused");
  check(teacherBlocked <= 11, "and it shuts within about ten tries", `shut on attempt ${teacherBlocked}`);

  // THE ONE THAT MATTERS. A school has one public address, so a limit keyed on
  // the address alone would read a computer room as an attack and lock out the
  // back half of the register.
  const otherTeacher = await post("/api/auth/teacher/login",
    { email: `somebody-else-${stamp}@example.com`, password: "also-wrong" });
  check(otherTeacher.status !== 429 && otherTeacher.body?.code !== "tooManyAttempts",
    "but a DIFFERENT account from the same address is still let in to try",
    "one locked-out account locked out the whole school");

  // =======================================================================
  section("Guessing a pupil's password");
  // =======================================================================

  const fakePupil = `Nobody Of This Name ${stamp}`;
  const pupilBlocked = await hammer("/api/auth/student/login",
    { fullName: fakePupil, password: "not-the-password" }, 15);

  check(pupilBlocked > 0, "the door shuts on a pupil's login",
    "fifteen wrong passwords and it never refused");
  check(pupilBlocked <= 11, "and it shuts within about ten tries", `shut on attempt ${pupilBlocked}`);

  const otherPupil = await post("/api/auth/student/login",
    { fullName: `Some Other Child ${stamp}`, password: "also-wrong" });
  check(otherPupil.status !== 429 && otherPupil.body?.code !== "tooManyAttempts",
    "and the child sitting next to them can still sign in",
    "one child's wrong password locked out their class");

  // =======================================================================
  section("Signing in properly, over and over");
  // =======================================================================
  //
  // A limiter that counts every attempt locks a teacher out of their own
  // portal for signing in and out through a morning. Only a FAILED attempt may
  // spend the budget — and since a wrong password here is answered 200, the
  // status code cannot tell them apart, so this is worth proving rather than
  // assuming.

  const TEACHER = { email: "onpointeducationcentremoza@gmail.com", password: "onpoint123" };
  let goodLogins = 0;
  let lockedOut = false;
  for (let i = 0; i < 14; i++) {
    const res = await post("/api/auth/teacher/login", TEACHER);
    if (res.status === 429 || res.body?.code === "tooManyAttempts") { lockedOut = true; break; }
    if (res.body?.success === true) goodLogins++;
  }
  check(!lockedOut, "fourteen correct sign-ins in a row do not lock the teacher out",
    `locked out after ${goodLogins}`);
  check(goodLogins === 14, "and every one of them worked", `${goodLogins} of 14`);

  // =======================================================================
  section("A refusal gives nothing away");
  // =======================================================================

  // A form that says "no such pupil" for one name and "wrong password" for
  // another is a way of asking who is on the register.
  const unknownName = await post("/api/auth/student/login",
    { fullName: `Definitely Not Enrolled ${stamp}`, password: "x1234567" });
  check(unknownName.body?.success === false, "an unknown name is refused");
  check(unknownName.body?.code === "nameOrPasswordWrong",
    "with the same answer a real pupil's wrong password gets", String(unknownName.body?.code));

  const unknownTeacher = await post("/api/auth/teacher/login",
    { email: `no-such-teacher-${stamp}@example.com`, password: "x1234567" });
  check(unknownTeacher.body?.code === "wrongEmailOrPassword",
    "an unknown teacher email says only that the pair do not match",
    String(unknownTeacher.body?.code));

  // =======================================================================
  section("What is actually in the database");
  // =======================================================================
  //
  // Read straight out of the table rather than over HTTP. The whole point is
  // what is WRITTEN DOWN, and no endpoint will ever show you that.

  await ensureSchema();

  const teacher = await storage.getTeacherByEmail("onpointeducationcentremoza@gmail.com");
  check(isHashed(teacher?.password),
    "the teacher's password is not sitting in the database as they type it",
    String(teacher?.password).slice(0, 20));

  const PASSWORD = `pupil-${stamp}`;
  const pupil = await storage.createStudent({
    studentId: `SEC-${stamp}`, fullName: `Security Child ${stamp}`,
    gender: "Female", form: "Stage 3",
  } as any);
  onCleanup(`pupil ${pupil.id}`, () => storage.deleteStudent(pupil.id));

  // =======================================================================
  section("A new pupil's account cannot be claimed by typing their name");
  // =======================================================================
  //
  // A pupil starts with no password. Signing in by name used to SET one to
  // whatever was typed — so anybody who knew a child's name, and got there
  // before the child did, owned that child's account. The first sign-in now
  // needs the one-time code the teacher was shown.

  const nameOnly = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: PASSWORD });
  check(nameOnly.body?.success !== true,
    "knowing a new pupil's name is not enough to get into their account");
  check(nameOnly.body?.code === "nameOrPasswordWrong",
    "and it is answered exactly as a name that is not on the register", String(nameOnly.body?.code));
  check((await storage.getStudent(pupil.id))?.password == null,
    "nothing was written to the child's account");

  const CODE = await storage.resetStudentPassword(pupil.id);
  const withCode = await storage.getStudent(pupil.id);
  check(isHashed(withCode?.firstLoginCode), "the teacher's code is stored as a hash, like a password");
  check(!String(withCode?.firstLoginCode).includes(CODE.replace("-", "")),
    "and the code itself appears nowhere in what is stored");

  const codeOnly = await postWithCookie("/api/auth/student/login",
    { fullName: pupil.fullName, password: CODE });
  check(codeOnly.res.body?.choosePassword === true,
    "the right code asks the pupil to choose their own password", JSON.stringify(codeOnly.res.body));
  check(codeOnly.res.body?.success !== true && codeOnly.cookie === "",
    "without signing anybody in until they have");

  const wrongCode = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: "ABCD-EFGH", newPassword: PASSWORD });
  check(wrongCode.body?.success !== true && wrongCode.body?.code === "nameOrPasswordWrong",
    "a wrong code is refused, with that same answer", String(wrongCode.body?.code));

  // Typed the way children type it — lower case, a space for the dash — with
  // the password they want sent in the same step.
  const firstLogin = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: CODE.toLowerCase().replace("-", " "), newPassword: PASSWORD });
  check(firstLogin.body?.success === true,
    "with the code, however it is typed, the pupil signs in and sets their own password",
    JSON.stringify(firstLogin.body?.code));

  const codeAgain = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: CODE, newPassword: `taken-over-${stamp}` });
  check(codeAgain.body?.success !== true,
    "the code works once — it cannot be used again to take the account off them");
  check((await storage.getStudent(pupil.id))?.firstLoginCode == null,
    "choosing a password cleared the code from the account");

  const afterFirst = await storage.getStudent(pupil.id);
  check(isHashed(afterFirst?.password),
    "and what is written down is a hash, not the word they chose",
    String(afterFirst?.password).slice(0, 20));
  check(!String(afterFirst?.password).includes(PASSWORD),
    "their actual password appears nowhere in the stored value");

  const againHashed = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: PASSWORD });
  check(againHashed.body?.success === true, "and they can sign in again against that hash");

  const wrongOne = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: PASSWORD + "-no" });
  check(wrongOne.body?.success === false, "while a wrong password is still refused");
  check(wrongOne.body?.code === "nameOrPasswordWrong",
    "with the same answer a name not on the register gets — the form cannot tell a stranger who is enrolled",
    String(wrongOne.body?.code));

  // =======================================================================
  section("A password stored before any of this existed");
  // =======================================================================
  //
  // Every password in the school's database is in plain text today, and no
  // amount of hashing changes a row nobody has the password for. So a legacy
  // value has to keep working, and become a hash the moment its owner proves
  // they know it — otherwise the school has to reset every child.
  //
  // Written straight to the table, because storage hashes anything it is given,
  // which is the other half of the promise.

  const LEGACY = `legacy-${stamp}`;
  await db.update(students).set({ password: LEGACY }).where(eq(students.id, pupil.id));

  const planted = await storage.getStudent(pupil.id);
  check(!isHashed(planted?.password), "a plain password is planted, as an old row would be");

  const legacyLogin = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: LEGACY });
  check(legacyLogin.body?.success === true,
    "its owner is still let in — nobody is locked out by the change");

  const upgraded = await storage.getStudent(pupil.id);
  check(isHashed(upgraded?.password),
    "and it has been turned into a hash on the way through",
    String(upgraded?.password).slice(0, 20));

  const legacyAgain = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: LEGACY });
  check(legacyAgain.body?.success === true, "the same password still works afterwards");

  const legacyWrong = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: "not-it" });
  check(legacyWrong.body?.success === false, "and the wrong one does not");

  // =======================================================================
  section("The master password that used to be in the source");
  // =======================================================================
  //
  // It was a constant in shared/schema.ts, unchanged since the first commit, so
  // everyone who has ever had the repository has it — and it signs in as ANY
  // pupil. It cannot be un-published, so it is refused outright rather than
  // merely moved.

  const burned = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: "onpoint_admin_2024" });
  check(burned.body?.success !== true,
    "the old master password from the source code opens nobody's account",
    JSON.stringify(burned.body?.code ?? burned.body));
  check(burned.body?.isMasterAccess !== true, "and grants no master access");

  // =======================================================================
  section("Changing your own password");
  // =======================================================================
  //
  // Until this existed there was no way to, from inside the app at all. One
  // endpoint serves all three portals and works out who is asking from the
  // session, so the account changed is always the one asking — there is no id
  // in the request to point somewhere else.

  const signedIn = await postWithCookie("/api/auth/student/login",
    { fullName: pupil.fullName, password: LEGACY });
  check(signedIn.res.body?.success === true, "a pupil signs in, ready to change their password");
  const cookie = signedIn.cookie;

  const NEW_PASSWORD = `changed-${stamp}-ok`;

  const wrongCurrent = await post("/api/auth/change-password",
    { currentPassword: "not-their-password", newPassword: NEW_PASSWORD }, cookie);
  check(wrongCurrent.body?.code === "wrongCurrentPassword",
    "the wrong current password changes nothing — a screen left open cannot lock them out",
    String(wrongCurrent.body?.code));

  const sameAgain = await post("/api/auth/change-password",
    { currentPassword: LEGACY, newPassword: LEGACY }, cookie);
  check(sameAgain.body?.code === "samePassword",
    "and the one they already have is refused rather than quietly accepted",
    String(sameAgain.body?.code));

  const tooShort = await post("/api/auth/change-password",
    { currentPassword: LEGACY, newPassword: "short" }, cookie);
  check(tooShort.body?.success === false, "a new password under eight characters is refused");

  const notSignedIn = await post("/api/auth/change-password",
    { currentPassword: LEGACY, newPassword: NEW_PASSWORD });
  check(notSignedIn.body?.code === "notLoggedIn",
    "and nobody signed in changes nobody's password", String(notSignedIn.body?.code));

  const changed = await post("/api/auth/change-password",
    { currentPassword: LEGACY, newPassword: NEW_PASSWORD }, cookie);
  check(changed.body?.success === true, "with the right current password it goes through",
    JSON.stringify(changed.body?.code));

  const oldOne = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: LEGACY });
  check(oldOne.body?.success === false, "the old password stops working");

  const newOne = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: NEW_PASSWORD });
  check(newOne.body?.success === true, "and the new one works");

  const storedNew = await storage.getStudent(pupil.id);
  check(isHashed(storedNew?.password), "what was written down is a hash, like any other password");
  check(!String(storedNew?.password).includes(NEW_PASSWORD),
    "and does not contain what they typed");

  // =======================================================================
  section("A password never leaves the server");
  // =======================================================================

  const me = await post("/api/auth/student/login", { fullName: pupil.fullName, password: NEW_PASSWORD });
  check(me.body?.student && !("password" in me.body.student),
    "signing in hands back the pupil without their password");
  check(!JSON.stringify(me.body ?? {}).includes(NEW_PASSWORD),
    "and the password appears nowhere in the reply");

  // =======================================================================
  section("The screen itself, in a real browser");
  // =======================================================================
  //
  // The endpoint is proved above. This is the other half: that a person can
  // actually REACH it — the button is on their own dashboard, the form opens,
  // and what they type into it is what signs them in afterwards. An endpoint
  // nobody can find is not a way to change a password.
  //
  // Each message is checked by its exact wording rather than by "something is
  // showing". The error box stays on screen between attempts, so "not empty"
  // would pass on the PREVIOUS complaint and prove nothing about this one.

  const browser = await Browser.launch();
  onCleanup("the browser", () => browser.close());
  const page = await browser.newPage();

  const TYPED = `typed-${stamp}-ok`;

  await page.goto(`${BASE}/student/login`);
  await page.waitForTestId("input-fullname");
  await page.fill("input-fullname", pupil.fullName);
  await page.fill("input-password", NEW_PASSWORD);
  await page.click("button-login");
  await page.waitFor(`return location.pathname === "/student/dashboard"`, "the dashboard to open");

  check(await page.exists("button-change-password"),
    "a pupil can find the button on their own dashboard, without being told an address");

  await page.click("button-change-password");
  await page.waitForTestId("dialog-change-password");
  check(true, "and it opens the form");

  // The wrong current password first: the screen has to SAY so. Failing
  // silently, or closing as though it worked, is worse than not having a form.
  await page.fill("input-current-password", "not-their-password");
  await page.fill("input-new-password", TYPED);
  await page.fill("input-again-password", TYPED);
  await page.click("button-change-password-save");
  await page.waitForTestId("text-change-password-problem");
  await page.waitFor(
    `return document.querySelector('[data-testid="text-change-password-problem"]')
       ?.textContent?.includes(${JSON.stringify(en.server.wrongCurrentPassword)})`,
    "the screen to say the current password is wrong",
  );
  check(true, "the wrong current password is said out loud, in the server's own words");

  // Typing the new one differently the second time — the mistake people
  // actually make. Caught on the page, so it costs no round trip.
  await page.fill("input-current-password", NEW_PASSWORD);
  await page.fill("input-again-password", `${TYPED}-different`);
  await page.click("button-change-password-save");
  await page.waitFor(
    `return document.querySelector('[data-testid="text-change-password-problem"]')
       ?.textContent?.includes(${JSON.stringify(en.password.doNotMatch)})`,
    "the screen to say the two do not match",
  );
  check(true, "and so is typing the new one differently the second time");

  // Now properly.
  await page.fill("input-again-password", TYPED);
  await page.click("button-change-password-save");
  await page.waitFor(
    `return !document.querySelector('[data-testid="dialog-change-password"]')`,
    "the form to close once it worked",
  );
  check(true, "getting it right closes the form");

  const afterScreen = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: TYPED });
  check(afterScreen.body?.success === true,
    "and the password they typed on the SCREEN is the one that now signs them in");

  const beforeScreen = await post("/api/auth/student/login",
    { fullName: pupil.fullName, password: NEW_PASSWORD });
  check(beforeScreen.body?.success === false, "while the one before it does not");

  // =======================================================================
  section("Every route is guarded — including the ones in other files");
  // =======================================================================
  //
  // This is the check that exists because of how the upload hole happened.
  //
  // Every route in routes.ts goes through a guard, and that had been true for
  // so long that "the routes are guarded" was taken as read. But uploads are
  // registered on the same app from local_object_storage.ts, and that file had
  // no login check of any kind — so anyone at all could write files to the
  // school's disk and choose the content type served back from them.
  //
  // Reading the source rather than asking the server, because the question is
  // "could somebody add an unguarded route tomorrow and nobody notice", and no
  // amount of requests to today's server answers that.

  const GUARDS = [
    "requireTeacherOrStudent", "requireTeacherOrSelf", "requireTeacherAuth",
    "requireTeacher", "requireParentSubmission", "requireParentChild",
    "requireParent", "requirePrimaryStudent", "requireAnyLogin",
    "canUpload", "canRead",
  ];

  const routeFiles = ["server/routes.ts", "server/local_object_storage.ts"];
  const routesSource = readFileSync("server/routes.ts", "utf8");

  // The dev helpers are covered by a gate on the whole /api/dev prefix rather
  // than by a call in each body, so they are allowed to have no guard of their
  // own — but ONLY while that gate is really there and really requires a
  // teacher. Checked rather than assumed: whitelisting the path instead would
  // mean deleting the gate left five routes open and this check still green.
  const devGate =
    /app\.use\(\s*"\/api\/dev"/.test(routesSource) &&
    /app\.use\(\s*"\/api\/dev"[\s\S]{0,400}?requireTeacher\(/.test(routesSource);
  check(devGate,
    "the dev helpers are covered by one teacher-only gate on the whole /api/dev prefix");

  const unguarded: string[] = [];
  let routesSeen = 0;

  for (const file of routeFiles) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const starts: { line: number; what: string }[] = [];
    lines.forEach((text, i) => {
      const m = text.match(/^\s*app\.(get|post|patch|put|delete)\(\s*["'/]/);
      if (m) starts.push({ line: i, what: `${file}:${i + 1} ${text.trim().slice(0, 70)}` });
    });

    starts.forEach((start, idx) => {
      const end = idx + 1 < starts.length ? starts[idx + 1].line : lines.length;
      const body = lines.slice(start.line, end).join("\n");
      routesSeen++;

      // The login routes must answer somebody who is not logged in — that is
      // what they are for. Everything else must name a guard.
      const firstLine = body.split("\n")[0];
      const isLogin = /["']\/api\/auth\//.test(firstLine);
      if (isLogin) return;

      // Covered by the prefix gate checked above, not by a call of its own.
      if (devGate && /["']\/api\/dev\//.test(firstLine)) return;

      if (!GUARDS.some((g) => body.includes(g + "("))) unguarded.push(start.what);
    });
  }

  check(routesSeen > 90,
    `all ${routesSeen} routes were found and read (a regex that matched nothing would pass everything)`,
    String(routesSeen));

  check(unguarded.length === 0,
    "every route that is not a login names a guard",
    unguarded.length ? `NOT GUARDED:\n      ${unguarded.join("\n      ")}` : "");

  // And the same thing asked of the running server, for the routes that were
  // actually open. A source check and a live check fail in different ways.
  const anonUpload = await post("/api/uploads/request-url", {});
  check(anonUpload.status === 401,
    "a stranger cannot ask for somewhere to upload a file", `got ${anonUpload.status}`);

  const anonObject = await fetch(`${BASE}/objects/anything`, { redirect: "manual" });
  check(anonObject.status === 401,
    "and cannot read an uploaded file", `got ${anonObject.status}`);

  // =======================================================================
  section("The headers every answer carries");
  // =======================================================================
  //
  // nosniff is the one with teeth here: it is what stops a browser guessing a
  // type from the bytes and rendering as HTML a file the server has just said
  // is not HTML. The Content-Security-Policy is deliberately production-only —
  // Vite's dev server needs inline script and eval — so it is not checked here.

  const headers = (await fetch(`${BASE}/`, { redirect: "manual" })).headers;
  check(headers.get("x-content-type-options") === "nosniff",
    "a browser is told never to guess a file's type from its bytes");
  check(headers.get("x-frame-options") === "DENY",
    "and never to let another site frame the school's pages");
  check((headers.get("referrer-policy") ?? "").includes("same-origin"),
    "the address of a page — which can name a pupil — is not leaked off-site");

  // The redirect to HTTPS keys on the proxy's own header, so that a health
  // check or the production PWA test, which arrive without one, still work.
  const forwarded = await fetch(`${BASE}/api/auth/teacher/me`, {
    headers: { "X-Forwarded-Proto": "http" },
    redirect: "manual",
  });
  check(forwarded.status === 301,
    "a request that reached the proxy over plain http is sent to https");
  check((forwarded.headers.get("location") ?? "").startsWith("https://"),
    "and sent somewhere that actually is https", forwarded.headers.get("location") ?? "");

  const direct = await fetch(`${BASE}/api/auth/teacher/me`, { redirect: "manual" });
  check(direct.status !== 301,
    "while one that never went through a proxy is answered normally — a health check must not bounce");
  // =======================================================================
  section("Two pupils with the same first name");
  // =======================================================================
  //
  // A first name on its own used to open whichever pupil came first in the
  // table. With two in a class, one child could land in the other's account —
  // or set that child's first password.

  const twinFirst = `Twinname${stamp}`;
  const twinA = await storage.createStudent({
    studentId: `SECA-${stamp}`, fullName: `${twinFirst} Alpha`, gender: "Male", form: "Stage 3",
  } as any);
  onCleanup(`pupil ${twinA.id}`, () => storage.deleteStudent(twinA.id));
  const twinB = await storage.createStudent({
    studentId: `SECB-${stamp}`, fullName: `${twinFirst} Beta`, gender: "Female", form: "Stage 3",
  } as any);
  onCleanup(`pupil ${twinB.id}`, () => storage.deleteStudent(twinB.id));
  const twinCode = await storage.resetStudentPassword(twinA.id);

  const byShared = await post("/api/auth/student/login",
    { fullName: twinFirst, password: twinCode, newPassword: `twin-${stamp}-pw` });
  check(byShared.body?.success !== true, "a first name two pupils share opens neither account");
  check((await storage.getStudent(twinA.id))?.password == null &&
        (await storage.getStudent(twinB.id))?.password == null,
    "and sets neither child's password");

  const byFull = await post("/api/auth/student/login",
    { fullName: twinA.fullName, password: twinCode, newPassword: `twin-${stamp}-pw` });
  check(byFull.body?.success === true, "the full name still signs the right child in",
    JSON.stringify(byFull.body?.code));

  const solo = await storage.createStudent({
    studentId: `SECS-${stamp}`, fullName: `Soloname${stamp} Gamma`, gender: "Male", form: "Stage 3",
  } as any);
  onCleanup(`pupil ${solo.id}`, () => storage.deleteStudent(solo.id));
  const soloCode = await storage.resetStudentPassword(solo.id);
  const byUnique = await post("/api/auth/student/login",
    { fullName: `soloname${stamp}`, password: soloCode, newPassword: `solo-${stamp}-pw` });
  check(byUnique.body?.success === true,
    "while a first name nobody else has still works on its own", JSON.stringify(byUnique.body?.code));

  // =======================================================================
  section("A code is shown to the teacher once, and sent nowhere else");
  // =======================================================================

  const teacherIn = await postWithCookie("/api/auth/teacher/login", TEACHER);
  check(teacherIn.res.body?.success === true, "the teacher signs in");

  const addedName = `Added By Teacher ${stamp}`;
  const added = await post("/api/students", {
    studentId: `SECT-${stamp}`, fullName: addedName, gender: "Female", form: "Stage 4",
  }, teacherIn.cookie);
  const addedId = added.body?.student?.id;
  if (addedId) onCleanup(`pupil ${addedId}`, () => storage.deleteStudent(addedId));
  const addedCode = String(added.body?.student?.firstLoginCode ?? "");
  check(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(addedCode),
    "adding a pupil hands the teacher that pupil's first sign-in code", addedCode);

  const reset = await post(`/api/students/${addedId}/reset-password`, {}, teacherIn.cookie);
  const resetCode = String(reset.body?.firstLoginCode ?? "");
  check(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(resetCode) && resetCode !== addedCode,
    "resetting a pupil hands the teacher a NEW code", resetCode);

  const staleCode = await post("/api/auth/student/login",
    { fullName: addedName, password: addedCode, newPassword: `stale-${stamp}-pw` });
  check(staleCode.body?.success !== true, "and the code from before the reset no longer works");

  const register = await fetch(`${BASE}/api/students`, { headers: { Cookie: teacherIn.cookie } });
  const registerText = await register.text();
  check(register.status === 200 && !registerText.includes("firstLoginCode") && !registerText.includes("scrypt$"),
    "the register the teacher's screen loads carries no codes and no hashes", `status ${register.status}`);

  // =======================================================================
  section("A login always starts a new session");
  // =======================================================================
  //
  // Writing the new role onto the session a browser already had meant an id
  // learned BEFORE a login was still good AFTER it. On a shared classroom
  // computer: a pupil signs in and copies their cookie, the teacher signs in at
  // the same browser, and the copied id is now a teacher's session.

  const pupilFirst = await postWithCookie("/api/auth/student/login",
    { fullName: pupil.fullName, password: TYPED });
  check(pupilFirst.res.body?.success === true && pupilFirst.cookie !== "",
    "a pupil signs in on a shared computer");

  const teacherAfter = await fetch(`${BASE}/api/auth/teacher/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: pupilFirst.cookie },
    body: JSON.stringify(TEACHER),
    redirect: "manual",
  });
  const teacherAfterCookie = (teacherAfter.headers.get("set-cookie") ?? "").split(";")[0];
  check(teacherAfterCookie !== "" && teacherAfterCookie !== pupilFirst.cookie,
    "the teacher signing in at that browser is given a NEW session id");

  const copiedAsTeacher = await fetch(`${BASE}/api/auth/teacher/me`, { headers: { Cookie: pupilFirst.cookie } });
  check(copiedAsTeacher.status === 401,
    "so the pupil's copied id is not a teacher's session", `got ${copiedAsTeacher.status}`);
  const copiedAsPupil = await fetch(`${BASE}/api/auth/student/me`, { headers: { Cookie: pupilFirst.cookie } });
  check(copiedAsPupil.status === 401,
    "and is no longer anybody's session at all", `got ${copiedAsPupil.status}`);
  const teacherWorks = await fetch(`${BASE}/api/auth/teacher/me`, { headers: { Cookie: teacherAfterCookie } });
  check(teacherWorks.status === 200, "while the teacher's new session works", `got ${teacherWorks.status}`);

  // =======================================================================
  section("An upload is written once, and never over somebody else's");
  // =======================================================================
  //
  // The upload route used to write over whatever was at an address. Any
  // signed-in pupil holding the address of another child's photographed work
  // could replace it with their own bytes.

  const uploader = await postWithCookie("/api/auth/student/login",
    { fullName: pupil.fullName, password: TYPED });
  const slot = await post("/api/uploads/request-url",
    { name: "work.png", size: 5, contentType: "image/png" }, uploader.cookie);
  const uploadURL = String(slot.body?.uploadURL ?? "");
  const fileId = uploadURL.split("/").pop() ?? "";
  check(/^[0-9a-f-]{36}$/i.test(fileId), "a pupil is handed somewhere to upload their work", uploadURL);
  onCleanup(`upload ${fileId}`, async () => {
    for (const name of [fileId, `${fileId}.type`]) rmSync(join("uploads", name), { force: true });
  });

  const putBytes = (url: string, bytes: string) => fetch(`${BASE}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "image/png", Cookie: uploader.cookie },
    body: bytes,
  });

  const firstPut = await putBytes(uploadURL, "FIRST");
  check(firstPut.status === 200, "the upload is saved", `got ${firstPut.status}`);

  const secondPut = await putBytes(uploadURL, "SECOND");
  check(secondPut.status === 409, "uploading to that address again is refused", `got ${secondPut.status}`);

  const readBack = await fetch(`${BASE}${slot.body?.objectPath}`, { headers: { Cookie: uploader.cookie } });
  check((await readBack.text()) === "FIRST", "and the file already there is exactly as it was");

  const madeUp = await putBytes("/api/uploads/local/not-an-address-we-gave-out", "X");
  check(madeUp.status === 400, "an address the server never handed out is refused", `got ${madeUp.status}`);

  await putBytes(`/api/uploads/local/${fileId}.type`, "text/html");
  check(readFileSync(join("uploads", `${fileId}.type`), "utf8") === "image/png",
    "and the note of a file's type cannot be written over as though it were a file");
  // =======================================================================
  section("The first sign-in and the teacher's code, on the screen");
  // =======================================================================
  //
  // The endpoints are proved above. This is the half a person meets: the
  // teacher can actually SEE the code, and a child can type it into the login
  // page, choose a password and get in. A code nobody can read, or a login
  // page with nowhere to choose a password, would lock every new pupil out.

  const screenName = `Screen Child ${stamp}`;
  const screenPupil = await storage.createStudent({
    studentId: `SECW-${stamp}`, fullName: screenName, gender: "Female", form: "Stage 3",
  } as any);
  onCleanup(`pupil ${screenPupil.id}`, () => storage.deleteStudent(screenPupil.id));

  // --- The teacher resets the pupil and reads the code off the register ---
  const screens = await browser.newPage();
  await screens.goto(`${BASE}/teacher/login`);
  await screens.waitForTestId("input-email");
  await screens.fill("input-email", TEACHER.email);
  await screens.fill("input-password", TEACHER.password);
  await screens.click("button-login");
  await screens.waitFor(`return location.pathname === "/teacher/dashboard"`, "the teacher dashboard to open");

  await screens.goto(`${BASE}/teacher/students`);
  await screens.waitForTestId(`button-reset-${screenPupil.id}`);
  await screens.click(`button-reset-${screenPupil.id}`);
  await screens.waitForTestId("dialog-first-login-codes");
  const shownCode = (await screens.textOf("text-first-login-code")).trim();
  check(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(shownCode),
    "pressing reset on the register shows the teacher the pupil's code", shownCode);

  await screens.click("button-first-login-codes-done");
  await screens.waitFor(`return !document.querySelector('[data-testid="dialog-first-login-codes"]')`,
    "the code dialog to close");
  check(true, "and the teacher can close it once it is written down");

  // --- The child types their name and that code ---
  // Forget whoever this browser remembers first, or the login page sends us
  // straight past itself to a dashboard.
  await screens.waitFor(`localStorage.clear(); return true`, "the browser to forget its logins");
  await screens.goto(`${BASE}/student/login`);
  await screens.waitForTestId("input-fullname");
  await screens.fill("input-fullname", screenName);
  await screens.fill("input-password", shownCode.toLowerCase());
  await screens.click("button-login");
  await screens.waitForTestId("section-choose-password");
  check(true, "a child who types their name and the code is asked to choose a password");

  await screens.fill("input-choose-password", "short");
  await screens.fill("input-choose-password-again", "short");
  await screens.click("button-login");
  await screens.waitFor(
    `return document.querySelector('[data-testid="text-choose-password-problem"]')
       ?.textContent?.includes(${JSON.stringify(en.password.tooShort)})`,
    "the screen to say the password is too short",
  );
  check(true, "a password under eight characters is caught on the screen, in words");

  const CHOSEN = `chosen-${stamp}-pw`;
  await screens.fill("input-choose-password", CHOSEN);
  await screens.fill("input-choose-password-again", `${CHOSEN}-different`);
  await screens.click("button-login");
  await screens.waitFor(
    `return document.querySelector('[data-testid="text-choose-password-problem"]')
       ?.textContent?.includes(${JSON.stringify(en.password.doNotMatch)})`,
    "the screen to say the two do not match",
  );
  check(true, "and so is typing it differently the second time");

  await screens.fill("input-choose-password-again", CHOSEN);
  await screens.click("button-login");
  await screens.waitFor(`return location.pathname === "/student/dashboard"`, "the child's dashboard to open");
  check(true, "getting it right signs the child in and opens their dashboard");

  const chosenWorks = await post("/api/auth/student/login", { fullName: screenName, password: CHOSEN });
  check(chosenWorks.body?.success === true,
    "and the password chosen on the SCREEN is the one that now signs them in");
  const codeAfter = await post("/api/auth/student/login",
    { fullName: screenName, password: shownCode, newPassword: `again-${stamp}-pw` });
  check(codeAfter.body?.success !== true, "while the code from the screen no longer opens anything");
}

void runCheck(main, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);
  return failed === 0;
});
