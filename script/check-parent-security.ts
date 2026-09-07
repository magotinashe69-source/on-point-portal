// The parent security check.
//
// This is the test behind the most important rule in the portal: a parent may
// see their own child and nothing else, however they edit the address bar.
//
// It runs against a REAL running server (npm run dev), so it proves the rule
// as the server actually enforces it rather than as the code appears to read.
//
// What it does:
//   1. Logs in as the teacher and creates a parent account for TWO different
//      children — parent A for child A, parent B for child B.
//   2. Logs in as parent A and checks they can see child A.
//   3. Still as parent A, tries every way we could think of to reach child B:
//      the pupil id in the address, the teacher endpoints, the report, the
//      register, and writing. Every one must be refused.
//   4. Checks a parent cannot reach any teacher page.
//   5. Tidies up the two test accounts it made.
//
// Run it with:  npx tsx script/check-parent-security.ts
// The server must already be running on http://localhost:5000.

const BASE = process.env.CHECK_BASE_URL || "http://localhost:5000";

const TEACHER = {
  email: "onpointeducationcentremoza@gmail.com",
  password: "onpoint123",
};

// ---------------------------------------------------------------------------
// A very small test harness. Nothing clever — it counts passes and failures
// and prints a line for each check so the output can be read at a glance.
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function check(ok: boolean, description: string, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${description}`);
  } else {
    failed++;
    console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * One browser's worth of cookies.
 *
 * Sessions are cookie-based, so each "who am I logged in as" needs its own
 * cookie jar. Keeping them separate is what lets this script hold a teacher
 * session and a parent session side by side without one clobbering the other.
 */
class Session {
  private cookie = "";

  constructor(public readonly name: string) {}

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

    // Keep whatever cookie the server sets, so the session sticks.
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // Some responses are not JSON (a redirect, or the React page). The
      // status is what these checks care about, so that is fine.
    }
    return { status: res.status, body: json };
  }

  get = (path: string) => this.request("GET", path);
  post = (path: string, body?: unknown) => this.request("POST", path, body);
  patch = (path: string, body?: unknown) => this.request("PATCH", path, body);
  delete = (path: string) => this.request("DELETE", path);
}

/** A request a parent must never get data from. 401 or 403, never 200. */
async function mustBeRefused(session: Session, method: string, path: string, label: string) {
  const res = await session.request(method, path);
  check(
    res.status === 401 || res.status === 403,
    `${label} is refused`,
    `got ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`,
  );
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nParent security check against ${BASE}\n`);

  // --- Set up: a teacher, and two children with a parent account each -------

  const teacher = new Session("teacher");
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (login.status !== 200 || !login.body?.success) {
    console.error("Could not log in as the teacher. Is the server running, and seeded?");
    console.error(JSON.stringify(login.body));
    process.exit(1);
  }

  const studentsRes = await teacher.get("/api/students");
  const students = studentsRes.body;
  if (!Array.isArray(students) || students.length < 2) {
    console.error("Need at least two pupils on the register to run this check.");
    process.exit(1);
  }

  // Clear up after a previous run that was interrupted before it tidied up.
  // ONLY accounts this check created are removed — they are recognisable by
  // their username. A real parent account is never touched: this script may be
  // pointed at a database that people depend on, and a test that quietly
  // deletes a family's login is worse than no test at all.
  const before = (await teacher.get("/api/parents")).body || [];
  for (const p of before) {
    if (typeof p.username === "string" && p.username.startsWith("checkparent_")) {
      await teacher.delete(`/api/parents/${p.id}`);
    }
  }

  // Two children who do NOT already have a parent account, because there is
  // one account per child and this check needs to create its own.
  const taken = new Set(
    ((await teacher.get("/api/parents")).body || []).map((p: any) => p.studentId),
  );
  const free = students.filter((s: any) => !taken.has(s.id));
  if (free.length < 2) {
    console.error(
      `Need two pupils with no parent account to run this check — only ${free.length} free.\n` +
      "Remove a parent account, or add another pupil, and try again. " +
      "(This check will not delete an account it did not create.)",
    );
    process.exit(1);
  }

  const childA = free[0];
  const childB = free[1];
  console.log(`Child A: ${childA.fullName} (id ${childA.id})`);
  console.log(`Child B: ${childB.fullName} (id ${childB.id})\n`);

  const stamp = Date.now();
  const credsA = { fullName: "Test Parent A", username: `checkparent_a_${stamp}`, password: "parentA123" };
  const credsB = { fullName: "Test Parent B", username: `checkparent_b_${stamp}`, password: "parentB123" };

  const createdA = await teacher.post(`/api/students/${childA.id}/parent`, credsA);
  const createdB = await teacher.post(`/api/students/${childB.id}/parent`, credsB);
  check(createdA.body?.success === true, "parent A created for child A", JSON.stringify(createdA.body));
  check(createdB.body?.success === true, "parent B created for child B", JSON.stringify(createdB.body));

  if (!createdA.body?.success || !createdB.body?.success) {
    console.error("\nCould not create the test parent accounts — stopping.");
    process.exit(1);
  }

  const parentAId = createdA.body.parent.id;
  const parentBId = createdB.body.parent.id;

  // Passwords must never come back out of the server.
  check(createdA.body.parent.password === undefined, "a created parent's password is not returned");
  check(
    ((await teacher.get("/api/parents")).body || []).every((p: any) => p.password === undefined),
    "the parent list never includes passwords",
  );

  // --- Editing an account keeps it on the same child ------------------------

  console.log("\nEditing a parent account");
  const renamed = await teacher.patch(`/api/parents/${parentAId}`, {
    fullName: "Test Parent A (renamed)",
    username: credsA.username,
    password: "", // blank means keep the current password
  });
  check(renamed.body?.success === true, "a teacher can edit a parent's details", JSON.stringify(renamed.body));
  check(renamed.body?.parent?.studentId === childA.id, "editing does NOT move the account to another child");

  // Even asking outright to move it is ignored: the route never reads a child.
  const moveAttempt = await teacher.patch(`/api/parents/${parentAId}`, {
    fullName: "Test Parent A (renamed)",
    username: credsA.username,
    studentId: childB.id, // <- should be ignored entirely
  });
  const afterMove = ((await teacher.get("/api/parents")).body || []).find((p: any) => p.id === parentAId);
  check(
    afterMove?.studentId === childA.id,
    "a studentId sent in an edit is ignored — the link cannot be moved",
    `studentId is now ${afterMove?.studentId}, expected ${childA.id}`,
  );

  // --- Parent A logs in ----------------------------------------------------

  console.log("\nParent A signs in");
  const parentA = new Session("parentA");
  const parentLogin = await parentA.post("/api/auth/parent/login", {
    username: credsA.username,
    password: credsA.password,
  });
  check(parentLogin.body?.success === true, "parent A can log in", JSON.stringify(parentLogin.body));
  check(parentLogin.body?.parent?.password === undefined, "the login reply does not include the password");

  // --- Parent A sees child A ----------------------------------------------

  console.log("\nParent A sees their own child");
  const childRes = await parentA.get("/api/parent/child");
  check(childRes.status === 200 && childRes.body?.child?.id === childA.id,
    "GET /api/parent/child returns child A",
    `got ${JSON.stringify(childRes.body).slice(0, 120)}`);

  const overviewRes = await parentA.get("/api/parent/overview");
  check(overviewRes.status === 200 && overviewRes.body?.overview?.child?.id === childA.id,
    "GET /api/parent/overview returns child A",
    `got ${JSON.stringify(overviewRes.body).slice(0, 120)}`);

  const reportRes = await parentA.get("/api/parent/weekly-report");
  check(reportRes.status === 200 && reportRes.body?.report?.child?.id === childA.id,
    "GET /api/parent/weekly-report returns child A");

  const ownIdRes = await parentA.get(`/api/parent/students/${childA.id}`);
  check(ownIdRes.status === 200 && ownIdRes.body?.child?.id === childA.id,
    "asking for their own child by id works",
    `got ${ownIdRes.status} ${JSON.stringify(ownIdRes.body).slice(0, 120)}`);

  // Nothing about the other child may appear anywhere in what parent A is
  // sent — not as a leaked field, not buried in a list. Refusing the direct
  // request is no good if the data arrives by another door.
  const parentAPayload = JSON.stringify([childRes.body, overviewRes.body, reportRes.body]);
  check(!parentAPayload.includes(childB.fullName),
    "child B's name appears nowhere in what parent A is sent");

  // --- THE WALL: parent A tries to reach child B ---------------------------

  console.log("\nParent A tries to reach child B (all of these must be refused)");

  await mustBeRefused(parentA, "GET", `/api/parent/students/${childB.id}`, "child B by id in the parent route");
  await mustBeRefused(parentA, "GET", `/api/students/${childB.id}`, "child B on the teacher student route");
  await mustBeRefused(parentA, "GET", `/api/students/${childB.id}/weekly-report`, "child B's weekly report");
  await mustBeRefused(parentA, "GET", `/api/submissions?studentId=${childB.id}`, "child B's submissions");
  await mustBeRefused(parentA, "GET", `/api/students/${childB.id}/streak`, "child B's streak");

  // An id that does not exist must be refused the same way. Answering "not
  // found" for a made-up id but "forbidden" for a real one would tell a parent
  // which pupils exist.
  const missing = await parentA.get("/api/parent/students/999999");
  check(missing.status === 403, "a pupil id that does not exist is refused, not 404",
    `got ${missing.status}`);

  // Nonsense in the address must not slip through either.
  const nonsense = await parentA.get("/api/parent/students/abc");
  check(nonsense.status === 403, "a non-numeric pupil id is refused", `got ${nonsense.status}`);

  // --- THE WALL: parent A tries to reach teacher pages ---------------------

  console.log("\nParent A tries to reach teacher pages (all of these must be refused)");

  await mustBeRefused(parentA, "GET", "/api/students", "the full student register");
  await mustBeRefused(parentA, "GET", "/api/parents", "the list of parent accounts");
  await mustBeRefused(parentA, "GET", "/api/assignments", "the assignment list");
  await mustBeRefused(parentA, "GET", "/api/announcements", "the teacher announcements route");
  await mustBeRefused(parentA, "GET", "/api/submissions", "all submissions");
  await mustBeRefused(parentA, "GET", "/api/teacher/dashboard-stats", "the teacher dashboard figures");
  await mustBeRefused(parentA, "GET", "/api/dev/streak-state", "the dev-only helpers");

  // --- THE WALL: a parent may not change anything --------------------------

  console.log("\nParent A tries to change things (a parent may only ever read)");

  await mustBeRefused(parentA, "POST", "/api/students", "creating a pupil");
  await mustBeRefused(parentA, "DELETE", `/api/students/${childB.id}`, "deleting child B");
  await mustBeRefused(parentA, "DELETE", `/api/parents/${parentBId}`, "deleting parent B's account");
  await mustBeRefused(parentA, "PATCH", `/api/parents/${parentBId}`, "editing parent B's account");
  await mustBeRefused(parentA, "POST", "/api/announcements", "posting an announcement");

  // --- A parent session is only ever a parent session ----------------------

  console.log("\nA parent session is not a student or teacher session");
  const me = await parentA.get("/api/auth/parent/me");
  check(me.status === 200 && me.body?.parent?.id === parentAId, "the parent is who they say they are");
  await mustBeRefused(parentA, "GET", "/api/auth/teacher/me", "the teacher identity check");

  // --- Parent B sees only child B -----------------------------------------

  console.log("\nParent B signs in and sees only child B");
  const parentB = new Session("parentB");
  await parentB.post("/api/auth/parent/login", {
    username: credsB.username,
    password: credsB.password,
  });
  const bChild = await parentB.get("/api/parent/child");
  check(bChild.status === 200 && bChild.body?.child?.id === childB.id, "parent B sees child B");
  await mustBeRefused(parentB, "GET", `/api/parent/students/${childA.id}`, "parent B asking for child A");

  // --- Logged out gets nothing --------------------------------------------

  console.log("\nA caller who is not logged in gets nothing");
  const anon = new Session("anon");
  await mustBeRefused(anon, "GET", "/api/parent/child", "the parent dashboard while logged out");
  await mustBeRefused(anon, "GET", "/api/parent/overview", "the parent overview while logged out");
  await mustBeRefused(anon, "GET", `/api/parent/students/${childA.id}`, "a pupil by id while logged out");
  await mustBeRefused(anon, "GET", "/api/students", "the register while logged out");

  // --- Tidy up -------------------------------------------------------------

  await teacher.delete(`/api/parents/${parentAId}`);
  await teacher.delete(`/api/parents/${parentBId}`);
  console.log("\nTest parent accounts removed.");

  // --- Result --------------------------------------------------------------

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
