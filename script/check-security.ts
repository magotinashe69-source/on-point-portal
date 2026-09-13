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
//     find out who is on the register.
//
// Everything here uses made-up accounts. That is not tidiness — the limiter's
// budget is keyed on the name being tried, so using a real one would lock a
// real teacher or pupil out for five minutes, and the check scripts that run
// after this one sign in as the teacher.

import { runCheck } from "./cleanup";

const BASE = "http://localhost:5000";

let passed = 0;
let failed = 0;
function check(ok: boolean, description: string, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${description}`); }
  else { failed++; console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`); }
}
function section(title: string) { console.log(`\n${title}`); }

const stamp = Date.now().toString().slice(-6);

async function post(path: string, body: unknown) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json: any = null;
  try { json = JSON.parse(await res.text()); } catch { /* not JSON */ }
  return { status: res.status, body: json };
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
  check(unknownName.body?.code === "notOnClassList",
    "with the same answer a real pupil's wrong password gets", String(unknownName.body?.code));

  const unknownTeacher = await post("/api/auth/teacher/login",
    { email: `no-such-teacher-${stamp}@example.com`, password: "x1234567" });
  check(unknownTeacher.body?.code === "wrongEmailOrPassword",
    "an unknown teacher email says only that the pair do not match",
    String(unknownTeacher.body?.code));
}

void runCheck(main, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);
  return failed === 0;
});
