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

// A note on how this script finishes.
//
// It sets process.exitCode and lets the process end by itself. It must NOT call
// process.exit().
//
// process.exit() tears the process down while fetch's keep-alive sockets are
// still open, and on Node 24 for Windows that trips an assertion inside libuv
// ("!(handle->flags & UV_HANDLE_CLOSING)"). Every check has already run and
// printed by then, but the process dies with code 127 — so a completely green
// run looks like a failure, which is worse than useless in CI.
//
// Ending naturally costs a few seconds while those sockets time out, and gives
// an honest 0 or 1.

/** Stop early: say why, mark the run failed, and let main() return. */
function abort(message: string) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  console.log(`\nParent security check against ${BASE}\n`);

  // --- Set up: a teacher, and two children with a parent account each -------

  const teacher = new Session("teacher");
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (login.status !== 200 || !login.body?.success) {
    abort("Could not log in as the teacher. Is the server running, and seeded?");
    console.error(JSON.stringify(login.body));
    return;
  }

  const studentsRes = await teacher.get("/api/students");
  const students = studentsRes.body;
  if (!Array.isArray(students) || students.length < 2) {
    abort("Need at least two pupils on the register to run this check.");
    return;
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
    abort(
      `Need two pupils with no parent account to run this check — only ${free.length} free.\n` +
      "Remove a parent account, or add another pupil, and try again. " +
      "(This check will not delete an account it did not create.)",
    );
    return;
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
    abort("\nCould not create the test parent accounts — stopping.");
    return;
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
  // A rate-limited login is not a broken portal, but it looks exactly like one:
  // every request after it comes back 401 and the rest of this file turns red
  // for the wrong reason. Say so once and stop, rather than printing thirty
  // failures that all mean "wait five minutes".
  if (/too many attempts/i.test(String(parentLogin.body?.message || "")) || parentLogin.status === 429) {
    await teacher.delete(`/api/parents/${parentAId}`);
    await teacher.delete(`/api/parents/${parentBId}`);
    abort(
      "\nParent login is rate limited (10 attempts per IP every 5 minutes, and this " +
      "check uses four).\nWait five minutes and run it again — this is the limiter " +
      "working, not a code failure.\nTest parent accounts removed.",
    );
    return;
  }

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

  // --- The completed-work view: the one address that carries an id --------
  //
  // Every other parent address deliberately carries no id, which is what makes
  // them impossible to tamper with. The completed-work view has to carry a
  // submission id — a parent taps a piece of work to open it — so it is the
  // one place in the portal where changing a number in the address bar is
  // worth trying. These checks are the reason requireParentSubmission exists.

  console.log("\nCompleted work, and the one id a parent can edit");

  const workRes = await parentA.get("/api/parent/completed-work");
  check(workRes.status === 200, "parent A can read their own child's completed work",
    `status ${workRes.status}`);
  check(Array.isArray(workRes.body?.work), "the completed work comes back as a list");

  const supportRes = await parentA.get("/api/parent/support-report");
  check(supportRes.status === 200, "parent A can read their own areas-to-practise report",
    `status ${supportRes.status}`);
  check(supportRes.body?.report?.child?.id === childA.id,
    "the report is about child A and nobody else", JSON.stringify(supportRes.body?.report?.child));

  // Any piece of work on the system that is NOT child A's. Asking the teacher
  // means this holds however the register is seeded, rather than depending on
  // a particular child having handed something in.
  const allSubmissions = (await teacher.get("/api/submissions")).body;
  const notChildAs = Array.isArray(allSubmissions)
    ? allSubmissions.find((sub: any) => sub.studentId !== childA.id)
    : undefined;

  if (notChildAs) {
    const stolen = await parentA.get(`/api/parent/submissions/${notChildAs.id}`);
    check(stolen.status === 403,
      "another child's work, by id in the address, is refused with 403", `got ${stolen.status}`);
    check(!JSON.stringify(stolen.body || {}).includes("question"),
      "the refusal carries none of that work with it");
  } else {
    console.log("  (no other child's work on the register to try — skipped)");
  }

  // 403 and not 404, for the same reason as everywhere else: a 404 would tell
  // a parent which submission ids are real.
  const madeUp = await parentA.get("/api/parent/submissions/999999999");
  check(madeUp.status === 403,
    "a submission id that does not exist is refused with 403, not 404", `got ${madeUp.status}`);

  const notANumber = await parentA.get("/api/parent/submissions/abc");
  check(notANumber.status === 403, "a non-numeric submission id is refused", `got ${notANumber.status}`);

  // The parent portal is read-only. Anything that is not a GET is refused
  // outright with 405 rather than quietly falling through to the React page,
  // which answers 200 and reads like it worked.
  const posted = await parentA.request("POST", "/api/parent/completed-work");
  check(posted.status === 405, "posting to the completed work list is refused", `got ${posted.status}`);
  const deleted = await parentA.request("DELETE", "/api/parent/submissions/1");
  check(deleted.status === 405, "deleting a piece of work is refused", `got ${deleted.status}`);
  const patched = await parentA.request("PATCH", "/api/parent/overview");
  check(patched.status === 405, "changing the overview is refused", `got ${patched.status}`);

  /**
   * Log a parent in, telling a rate-limited attempt apart from a failed one.
   *
   * Parent login allows 10 attempts per IP every 5 minutes (see
   * parentLoginLimiter in server/routes.ts). This whole check uses four of
   * them, so running it three times inside five minutes trips the limiter — and
   * a limiter doing its job then looks exactly like a broken portal, because
   * every request after it comes back 401.
   *
   * Worth keeping the limit rather than exempting the test from it: it sits in
   * front of a child's record, and a security check that turns the security off
   * to make itself pass is not a check. So the limiter stays and this says
   * plainly what happened instead.
   */
  async function loginParent(session: Session, username: string, password: string) {
    const res = await session.post("/api/auth/parent/login", { username, password });
    const message = String(res.body?.message || "");
    if (/too many attempts/i.test(message) || res.status === 429) return "rate-limited" as const;
    return res.body?.success === true ? ("ok" as const) : ("failed" as const);
  }

  // --- Game plays, as a parent sees them -----------------------------------
  //
  // The parent's figures must be the CHILD'S figures. A parent quoted "2 left"
  // while their child's screen says 3 is worse than no view at all, so this
  // section plays a real game as a real Stage 3 pupil and then compares the two
  // endpoints against each other rather than against numbers typed in here.
  //
  // It builds its own pupils, because the two children borrowed above come from
  // whatever is on the register and may be in any class — and the games are
  // Stages 3-6 only.

  console.log("\nGame plays, as a parent sees them");

  const playStamp = Date.now().toString().slice(-6);

  const gamesChild = (await teacher.post("/api/students", {
    studentId: `PP3-${playStamp}`, fullName: `Plays Parent Child ${playStamp}`,
    gender: "Female", form: "Stage 3",
  })).body?.student;

  const formChild = (await teacher.post("/api/students", {
    studentId: `PPF-${playStamp}`, fullName: `Plays Form Child ${playStamp}`,
    gender: "Male", form: "Form 1",
  })).body?.student;

  let gamesParentId: number | undefined;
  let formParentId: number | undefined;

  if (!gamesChild || !formChild) {
    check(false, "could create the pupils for the game-plays check");
  } else {
    // One assignment, handed in. That is one play of EACH game earned, so two
    // plays in the parent's terms.
    const paper = (await teacher.post("/api/assignments", {
      subject: "MATHS", topic: "Adding", form: "Stage 3",
      title: `Parent Plays ${playStamp}`, instructions: "Answer all questions.",
      dueDate: "2026-12-01", totalMarks: 2, createdById: 1,
      questions: [
        { id: "p1", questionText: "what is 2 + 2?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 },
        { id: "p2", questionText: "what is 3 + 3?", maxScore: 1, type: "numeric", correctNumber: 6, tolerance: 0 },
      ],
    })).body?.assignment;

    const pupil = new Session("pupil");
    await pupil.post("/api/auth/student/login", {
      fullName: gamesChild.fullName, password: "playspw123",
    });
    await pupil.post("/api/submissions", {
      assignmentId: paper.id, studentId: gamesChild.id,
      answers: [{ questionId: "p1", answerText: "4" }, { questionId: "p2", answerText: "6" }],
    });

    // Play ONE game right through, so there is a used play and a record.
    const game = await pupil.post(`/api/students/${gamesChild.id}/blaster/start`);
    for (const r of game.body?.rounds || []) {
      await pupil.post(`/api/students/${gamesChild.id}/blaster/answer`, {
        slot: r.index, ref: r.ref, answerText: "4",
      });
    }
    await pupil.post(`/api/students/${gamesChild.id}/blaster/finish`, { answers: [] });

    // What the CHILD is told, to compare the parent's view against.
    const childsOwn = (await pupil.get(`/api/students/${gamesChild.id}/plays`)).body?.plays;

    const gp = (await teacher.post(`/api/students/${gamesChild.id}/parent`, {
      fullName: "Test Parent Plays", username: `checkparent_p_${playStamp}`, password: "parentP123",
    })).body;
    gamesParentId = gp?.parent?.id;

    const fp = (await teacher.post(`/api/students/${formChild.id}/parent`, {
      fullName: "Test Parent Form", username: `checkparent_f_${playStamp}`, password: "parentF123",
    })).body;
    formParentId = fp?.parent?.id;

    const gamesParent = new Session("games parent");
    const gamesLogin = await loginParent(gamesParent, `checkparent_p_${playStamp}`, "parentP123");

    if (gamesLogin === "rate-limited") {
      check(false,
        "the game-plays checks could run",
        "parent login is rate limited (10 per 5 minutes) — this run used them up. " +
        "Wait five minutes and run it again. This is the limiter working, not a code failure.");
    } else {

    const view = await gamesParent.get("/api/parent/plays");
    check(view.status === 200 && view.body?.success === true,
      "a parent can read their child's game plays", `status ${view.status}`);

    const plays = view.body?.plays;
    check(plays?.child?.id === gamesChild.id,
      "the view is about their own child and nobody else", JSON.stringify(plays?.child));
    check(plays?.available === true, "a Stage 3 child's games are available",
      `got ${plays?.available}`);

    // The whole point: the parent's numbers ARE the child's numbers.
    const parentBlaster = (plays?.today?.games || []).find((g: any) => g.game === "blaster");
    const parentPenalty = (plays?.today?.games || []).find((g: any) => g.game === "penalty");
    check(
      parentBlaster?.earned === childsOwn?.blaster?.earned &&
      parentBlaster?.used === childsOwn?.blaster?.used &&
      parentBlaster?.left === childsOwn?.blaster?.left,
      "the parent is shown the same Target Blaster figures as the child",
      `parent ${JSON.stringify(parentBlaster)} vs child ${JSON.stringify(childsOwn?.blaster)}`,
    );
    check(
      parentPenalty?.earned === childsOwn?.penalty?.earned &&
      parentPenalty?.used === childsOwn?.penalty?.used &&
      parentPenalty?.left === childsOwn?.penalty?.left,
      "the parent is shown the same Penalty Shootout figures as the child",
      `parent ${JSON.stringify(parentPenalty)} vs child ${JSON.stringify(childsOwn?.penalty)}`,
    );

    check(plays?.today?.assignmentsHandedIn === 1,
      "today's one assignment is what earned the plays",
      `got ${plays?.today?.assignmentsHandedIn}`);
    check(parentBlaster?.used === 1, "the game that was played shows as used",
      `got ${parentBlaster?.used}`);

    // The week strip: seven days, newest first, today at the top.
    check(Array.isArray(plays?.week) && plays.week.length === 7,
      "the week strip covers seven days", `got ${plays?.week?.length}`);
    const daysDescending = (plays?.week || []).every(
      (d: any, i: number, all: any[]) => i === 0 || all[i - 1].day > d.day,
    );
    check(daysDescending, "newest day first", JSON.stringify((plays?.week || []).map((d: any) => d.day)));
    check(plays?.week?.[0]?.assignmentsHandedIn === 1,
      "today's row shows the assignment handed in", JSON.stringify(plays?.week?.[0]));

    // Earned and used are BOTH totals across the two games, so they can be read
    // against each other. One assignment earns two plays, one of which was used.
    check(plays?.week?.[0]?.playsEarned === 2,
      "today's row counts both games — one assignment is two plays",
      `got ${plays?.week?.[0]?.playsEarned}`);
    check(plays?.week?.[0]?.playsUsed === 1, "and one of them was used",
      `got ${plays?.week?.[0]?.playsUsed}`);

    const blasterRecord = (plays?.records || []).find((r: any) => r.game === "blaster");
    check(!!blasterRecord, "the finished game leaves a best score",
      JSON.stringify(plays?.records));

    // Read-only, like the rest of the portal: a parent may look at the plays
    // but never grant, take away or unlock one.
    const postPlays = await gamesParent.request("POST", "/api/parent/plays");
    check(postPlays.status === 405, "a parent cannot post to the plays view",
      `got ${postPlays.status}`);
    const patchPlays = await gamesParent.request("PATCH", "/api/parent/plays");
    check(patchPlays.status === 405, "nor change it", `got ${patchPlays.status}`);

    // A logged-out caller gets nothing, like everywhere else.
    const anonPlays = await new Session("anon").get("/api/parent/plays");
    check(anonPlays.status === 401, "a logged-out caller gets nothing from the plays view",
      `got ${anonPlays.status}`);

    // A secondary child has no games at all. Their parent must be told that
    // plainly rather than shown a row of zeros, which would read as "your child
    // has earned nothing".
    const formParent = new Session("form parent");
    await loginParent(formParent, `checkparent_f_${playStamp}`, "parentF123");
    const formView = await formParent.get("/api/parent/plays");
    check(formView.status === 200, "a Form child's parent still gets an answer",
      `status ${formView.status}`);
    check(formView.body?.plays?.available === false,
      "and is told the games do not apply to their child's class",
      `got ${formView.body?.plays?.available}`);
    check(
      (formView.body?.plays?.week || []).length === 0 &&
      (formView.body?.plays?.today?.games || []).length === 0,
      "with no figures at all, rather than a row of zeros",
      JSON.stringify(formView.body?.plays),
    );

    }

    // Tidy up this section's own pupils and accounts. Outside the branch above,
    // so a rate-limited run still clears up after itself.
    if (paper) await teacher.delete(`/api/assignments/${paper.id}`);
    if (gamesParentId) await teacher.delete(`/api/parents/${gamesParentId}`);
    if (formParentId) await teacher.delete(`/api/parents/${formParentId}`);
    await teacher.delete(`/api/students/${gamesChild.id}`);
    await teacher.delete(`/api/students/${formChild.id}`);
  }

  // --- The login pages must not log the parent straight back out ----------
  //
  // This one reads the source rather than the server, because the server was
  // never wrong. The parent portal once failed completely, with every
  // /api/parent/... request coming back 401, and the cause was in the browser:
  // the login page called logout() right after a successful login "to clear
  // any teacher or student", and logout() posts to /api/auth/parent/logout,
  // which destroys the session the login had just created. The browser still
  // remembered the parent, so the dashboard looked logged in while nothing on
  // it could load.
  //
  // A login page never needs to log anything out on the server: every login
  // goes through setSessionRole(), which already clears the other two roles.
  // It only needs forgetRememberedLogins(), which touches the browser alone.

  console.log("\nNo login page logs itself out again");
  const { readFileSync } = await import("node:fs");
  for (const page of ["parent", "student", "teacher"]) {
    const file = `client/src/pages/${page}/login.tsx`;
    let source = "";
    try {
      source = readFileSync(file, "utf8");
    } catch {
      check(false, `the ${page} login page could be read`, file);
      continue;
    }

    // A real call to logout(), not the word in a comment explaining why not to.
    const offending = source
      .split("\n")
      .map(line => line.trim())
      .filter(line => !line.startsWith("//") && !line.startsWith("*"))
      .filter(line => /(^|[^.\w])logout\s*\(\s*\)/.test(line));

    check(
      offending.length === 0,
      `the ${page} login page does not call logout()`,
      offending.length ? `${file}: ${offending[0]} — this destroys the session the login just created` : "",
    );
  }

  // --- Tidy up -------------------------------------------------------------

  await teacher.delete(`/api/parents/${parentAId}`);
  await teacher.delete(`/api/parents/${parentBId}`);
  console.log("\nTest parent accounts removed.");

  // --- Result --------------------------------------------------------------

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
