// Staff roles: who may sign in, and what each kind of staff account may do.
//
//   npm run check:staff   (start the server first: npm run dev)
//
// Proved against a running server, straight from the database, and in a real
// browser:
//
//   * asking to join creates a PENDING, regular teacher account that cannot sign
//     in or do anything, and is told it is awaiting approval by the school;
//   * an administrator approves it and gives it classes, which are stored;
//   * the approved teacher CAN save bank questions, create and edit assignments,
//     read submissions and marks, mark work, and send announcements to families;
//   * the approved teacher CANNOT manage pupils, QR cards or parent accounts, or
//     approve staff — refused by the server with 403 and nothing changed — and is
//     shown "administrators only" when those addresses are typed;
//   * the school's existing account is still an administrator, and can still mark
//     work and manage everything;
//   * an account that stops being approved stops working on its next request.
//
// Everything it creates it removes, even if it falls over part way.

import { onCleanup, runCheck } from "./cleanup";
import { readFileSync } from "node:fs";
import { Browser } from "./chrome";
import { db, ensureSchema } from "../server/db";
import { storage } from "../server/storage";
import { isHashed } from "../server/passwords";
import { teachers } from "@shared/schema";
import { eq } from "drizzle-orm";

const BASE = "http://localhost:5000";
const ADMIN = { email: "onpointeducationcentremoza@gmail.com", password: "onpoint123" };

let passed = 0;
let failed = 0;
function check(ok: boolean, description: string, detail = "") {
  if (ok) { passed++; console.log(`  PASS  ${description}`); }
  else { failed++; console.log(`  FAIL  ${description}${detail ? ` — ${detail}` : ""}`); }
}
function section(title: string) { console.log(`\n${title}`); }

const stamp = Date.now().toString().slice(-6);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(test: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await test()) return true;
    await sleep(200);
  }
  return false;
}

/** One browser's worth of cookies, over plain HTTP. */
class Session {
  cookie = "";
  async request(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    let json: any = null;
    let text = "";
    try { text = await res.text(); json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json, text };
  }
  get(p: string) { return this.request("GET", p); }
  post(p: string, b?: unknown) { return this.request("POST", p, b ?? {}); }
  put(p: string, b?: unknown) { return this.request("PUT", p, b ?? {}); }
  delete(p: string) { return this.request("DELETE", p); }
}

/** A one-question written paper, so handed-in work waits to be marked by hand. */
function paper(title: string) {
  return {
    subject: "MATHS", topic: "Adding", form: "Stage 3", title,
    instructions: "Answer the question.", dueDate: "2026-12-01", totalMarks: 2, createdById: 0,
    questions: [{ id: "q1", questionText: "Explain how you would add 19 and 23.", maxScore: 2, type: "written" }],
  };
}

async function main() {
  console.log(`\nStaff roles (run ${stamp})\n`);

  const reachable = await fetch(BASE + "/").then((r) => r.ok).catch(() => false);
  if (!reachable) {
    console.log("\n  The server is not answering. Start it first (npm run dev).\n");
    failed++;
    return;
  }
  await ensureSchema();

  // Registered FIRST so it runs LAST: everything a staff account made has to be
  // gone before the account itself can be removed.
  const createdEmails: string[] = [];
  onCleanup("staff accounts this check created", async () => {
    for (const email of createdEmails) {
      const row = await storage.getTeacherByEmail(email);
      if (row) await db.delete(teachers).where(eq(teachers.id, row.id));
    }
  });

  // =======================================================================
  section("The school's existing account");
  // =======================================================================

  const admin = new Session();
  const adminLogin = await admin.post("/api/auth/teacher/login", ADMIN);
  check(adminLogin.body?.success === true, "signs in exactly as before", JSON.stringify(adminLogin.body?.code));
  if (!adminLogin.body?.success) return;

  const adminMe = await admin.get("/api/auth/teacher/me");
  const adminId: number = adminMe.body?.teacher?.id;
  check(adminMe.body?.teacher?.staffRole === "teacher_admin", "is an administrator (teacher_admin)",
    String(adminMe.body?.teacher?.staffRole));
  check(!("password" in (adminMe.body?.teacher ?? {})), "and its password is not sent back");
  const adminRow = await storage.getTeacher(adminId);
  check(adminRow?.staffRole == null || adminRow?.staffRole === "teacher_admin",
    "its row was not turned into a regular teacher by the migration", String(adminRow?.staffRole));

  // =======================================================================
  section("Setting up: a pupil with a QR card and a parent, and work handed in");
  // =======================================================================

  const QR = `STAFF-${stamp}`;
  const created = await admin.post("/api/students", {
    studentId: `STF-${stamp}`, fullName: `Staff Check Child ${stamp}`, gender: "Female", form: "Stage 3", qrCode: QR,
  });
  const pupil = created.body?.student;
  check(!!pupil?.id, "an administrator adds a pupil with a QR card", JSON.stringify(created.body).slice(0, 160));
  if (!pupil?.id) return;
  onCleanup(`pupil ${pupil.id}`, () => storage.deleteStudent(pupil.id));

  const PARENT = { fullName: `Staff Check Parent ${stamp}`, username: `staffparent${stamp}`, password: "parentpw123" };
  const parentMade = await admin.post(`/api/students/${pupil.id}/parent`, PARENT);
  check(parentMade.body?.success === true, "and a parent account for them", JSON.stringify(parentMade.body?.code));

  const set = (await admin.post("/api/assignments", paper(`Staff check paper ${stamp}`))).body?.assignment;
  check(!!set?.id, "and sets a paper");
  if (!set?.id) return;
  onCleanup(`assignment ${set.id}`, () => admin.delete(`/api/assignments/${set.id}`));

  const child = new Session();
  await child.post("/api/auth/student/login", { fullName: pupil.fullName, password: pupil.firstLoginCode, newPassword: "staffchild123" });
  const handIn = await child.post("/api/submissions", {
    assignmentId: set.id, studentId: pupil.id, answers: [{ questionId: "q1", answerText: "Add 20 and 23, then take away 1." }],
  });
  const submissionId: number = handIn.body?.submission?.id;
  check(!!submissionId, "the pupil hands the work in", JSON.stringify(handIn.body).slice(0, 160));

  // =======================================================================
  section("Asking to join creates an account that can do nothing yet");
  // =======================================================================

  const EMAIL = `staff-check-${stamp}@example.com`;
  const PASSWORD = `staff-${stamp}-pw`;
  createdEmails.push(EMAIL);

  const asker = new Session();
  const asked = await asker.post("/api/auth/teacher/register", {
    fullName: `Staff Check Teacher ${stamp}`, email: EMAIL.toUpperCase(), password: PASSWORD,
  });
  check(asked.body?.success === true, "a teacher can ask to join", JSON.stringify(asked.body));
  check(asked.body?.code === "awaitingApproval", "and is told the account is awaiting approval by the school",
    String(asked.body?.code));
  check(asker.cookie === "", "asking to join signs nobody in");

  const row = await storage.getTeacherByEmail(EMAIL);
  check(!!row, "the request is stored, with the email in lower case");
  if (!row) return;
  check(row.staffRole === "teacher", "as a regular teacher — never an administrator", String(row.staffRole));
  check(row.approvalStatus === "pending", "and pending", String(row.approvalStatus));
  check(isHashed(row.password) && !row.password.includes(PASSWORD), "with the password stored as a hash");

  const twice = await new Session().post("/api/auth/teacher/register", {
    fullName: "Somebody Else", email: EMAIL, password: "another-password-1",
  });
  check(twice.body?.success !== true && twice.body?.code === "teacherEmailTaken",
    "the same email cannot ask twice", String(twice.body?.code));

  const SHORT_EMAIL = `staff-short-${stamp}@example.com`;
  const short = await new Session().post("/api/auth/teacher/register", { fullName: "Short", email: SHORT_EMAIL, password: "short" });
  check(short.body?.success !== true, "a password under eight characters is refused");
  check(!(await storage.getTeacherByEmail(SHORT_EMAIL)), "and nothing is stored for it");

  const pendingLogin = await asker.post("/api/auth/teacher/login", { email: EMAIL, password: PASSWORD });
  check(pendingLogin.body?.success !== true, "a pending account CANNOT sign in");
  check(pendingLogin.body?.code === "awaitingApproval", "and is told why: it is awaiting approval",
    String(pendingLogin.body?.code));
  check(asker.cookie === "", "no session is created for it");

  const wrongPassword = await new Session().post("/api/auth/teacher/login", { email: EMAIL, password: "not-the-password" });
  check(wrongPassword.body?.code === "wrongEmailOrPassword",
    "with a wrong password it gets the ordinary refusal — the form does not reveal who has asked to join",
    String(wrongPassword.body?.code));

  for (const [method, path] of [["GET", "/api/assignments"], ["POST", "/api/question-bank"], ["GET", "/api/staff"]] as const) {
    const r = await asker.request(method, path, method === "POST" ? {} : undefined);
    check(r.status === 401, `the pending teacher gets nothing from ${method} ${path}`, `got ${r.status}`);
  }

  // =======================================================================
  section("An administrator approves the request and gives classes");
  // =======================================================================

  const list = await admin.get("/api/staff");
  const listed = (list.body?.staff ?? []).find((s: any) => s.email === EMAIL);
  check(listed?.approvalStatus === "pending", "the request is on the administrator's Staff list, waiting",
    JSON.stringify(listed));
  check(!list.text.includes("scrypt$") && !list.text.includes('"password"'), "the list carries no passwords or hashes");

  const approved = await admin.post(`/api/staff/${row.id}/approve`);
  check(approved.body?.teacher?.approvalStatus === "approved", "the administrator approves it", JSON.stringify(approved.body));

  const classes = await admin.put(`/api/staff/${row.id}/classes`, { classes: ["Form 1", "Stage 3", "Stage 3"] });
  const WANT = JSON.stringify(["Stage 3", "Form 1"]);
  check(JSON.stringify(classes.body?.teacher?.assignedClasses) === WANT,
    "and gives it classes, kept once each and in the school's order", JSON.stringify(classes.body));
  check(JSON.stringify((await storage.getTeacher(row.id))?.assignedClasses) === WANT,
    "the classes are stored on the teacher's own account");

  const badClass = await admin.put(`/api/staff/${row.id}/classes`, { classes: ["Grade 9"] });
  check(badClass.status === 400 && badClass.body?.code === "notAClass",
    "a class that is not one of the school's is refused", `${badClass.status} ${badClass.body?.code}`);

  const lockOut = await admin.post(`/api/staff/${adminId}/reject`);
  check(lockOut.status === 400 && lockOut.body?.code === "cannotRejectAdmin",
    "an administrator's account cannot be rejected, so nobody can lock the school out", `got ${lockOut.status}`);

  // =======================================================================
  section("The approved teacher can do the teaching");
  // =======================================================================

  const teacher = new Session();
  const teacherLogin = await teacher.post("/api/auth/teacher/login", { email: EMAIL, password: PASSWORD });
  check(teacherLogin.body?.success === true, "the approved teacher can now sign in", JSON.stringify(teacherLogin.body?.code));
  check(teacherLogin.body?.teacher?.staffRole === "teacher", "as a regular teacher");
  const me = await teacher.get("/api/auth/teacher/me");
  check(JSON.stringify(me.body?.teacher?.assignedClasses) === WANT, "and their account shows the classes they were given");

  const bank = await teacher.post("/api/question-bank", {
    questionText: `Staff check: the capital of Zimbabwe? ${stamp}`, type: "short_text", maxScore: 1,
    acceptedAnswers: ["Harare"], subject: "GEOGRAPHY", topic: "Capitals", form: "Stage 3", difficulty: "easy",
  });
  check(bank.body?.success === true, "CAN add a question to the Question Bank", JSON.stringify(bank.body).slice(0, 160));
  if (bank.body?.question?.id) onCleanup("bank question", () => admin.delete(`/api/question-bank/${bank.body.question.id}`));

  const own = await teacher.post("/api/assignments", paper(`Staff check teacher paper ${stamp}`));
  const ownId: number = own.body?.assignment?.id;
  check(!!ownId, "CAN create an assignment", JSON.stringify(own.body).slice(0, 160));
  if (ownId) {
    onCleanup("the teacher's assignment", () => admin.delete(`/api/assignments/${ownId}`));
    const edit = await teacher.put(`/api/assignments/${ownId}`, paper(`Staff check teacher paper ${stamp} (edited)`));
    const reread = await teacher.get(`/api/assignments/${ownId}`);
    check(edit.status === 200 && String(reread.body?.title).endsWith("(edited)"),
      "CAN edit an assignment", `${edit.status} ${String(reread.body?.title)}`);
  }

  const subs = await teacher.get(`/api/submissions?assignmentId=${set.id}`);
  check(subs.status === 200 && Array.isArray(subs.body) && subs.body.some((s: any) => s.id === submissionId),
    "CAN view pupils' submissions", `got ${subs.status}`);

  const marked = await teacher.post("/api/marks", {
    submissionId, totalScore: 2, feedback: "Clearly explained.", markedById: 0,
    questionMarks: [{ questionId: "q1", score: 2, maxScore: 2 }],
  });
  check(marked.body?.success === true, "CAN mark work", JSON.stringify(marked.body).slice(0, 160));
  const markRead = await teacher.get(`/api/marks/${submissionId}`);
  check(markRead.status === 200 && (markRead.body?.totalScore ?? markRead.body?.mark?.totalScore) === 2,
    "CAN view marks", `got ${markRead.status}`);

  const message = `Staff check: reading week starts on Monday ${stamp}`;
  const news = await teacher.post("/api/announcements", {
    title: message, content: "Please read with your child every evening.", form: "Stage 3", priority: "normal", createdById: 0,
  });
  check(news.body?.success === true, "CAN send a message to the families of a class", JSON.stringify(news.body).slice(0, 160));
  if (news.body?.announcement?.id) onCleanup("announcement", () => admin.delete(`/api/announcements/${news.body.announcement.id}`));
  const family = new Session();
  await family.post("/api/auth/parent/login", { username: PARENT.username, password: PARENT.password });
  const overview = await family.get("/api/parent/overview");
  check(overview.text.includes(message), "and the pupil's parent reads it in their portal");

  const teacherList = await teacher.get("/api/students");
  const seen = (Array.isArray(teacherList.body) ? teacherList.body : []).find((s: any) => s.id === pupil.id);
  check(!!seen, "can still read pupils' names and classes, which assignments and reports need");
  check(!!seen && !("qrCode" in seen) && !teacherList.text.includes(QR), "but is never sent a pupil's QR card code");
  const onePupil = await teacher.get(`/api/students/${pupil.id}`);
  check(onePupil.status === 200 && !onePupil.text.includes(QR), "not even when reading one pupil");
  check((await admin.get("/api/students")).text.includes(QR), "while an administrator is sent it");

  // =======================================================================
  section("The approved teacher cannot manage pupils, QR cards, parents or staff");
  // =======================================================================

  const pupilBefore = await storage.getStudent(pupil.id);
  const parentBefore = await storage.getParentByStudentId(pupil.id);
  const refused: Array<[string, string, unknown?]> = [
    ["POST", "/api/students", { studentId: `NOPE-${stamp}`, fullName: `Should Not Exist ${stamp}`, gender: "Male", form: "Stage 3" }],
    ["PUT", `/api/students/${pupil.id}`, { fullName: "Renamed By A Teacher" }],
    ["PUT", `/api/students/${pupil.id}`, { qrCode: `STOLEN-${stamp}` }],
    ["DELETE", `/api/students/${pupil.id}`],
    ["POST", `/api/students/${pupil.id}/reset-password`, {}],
    ["GET", `/api/students/by-code/${QR}`],
    ["GET", "/api/parents"],
    ["POST", `/api/students/${pupil.id}/parent`, { fullName: "Another Parent", username: `nope${stamp}`, password: "parentpw123" }],
    ["PATCH", `/api/parents/${parentBefore?.id}`, { fullName: "Renamed Parent" }],
    ["DELETE", `/api/parents/${parentBefore?.id}`],
    ["GET", "/api/staff"],
    ["POST", `/api/staff/${row.id}/approve`, {}],
    ["POST", `/api/staff/${adminId}/reject`, {}],
    ["PUT", `/api/staff/${row.id}/classes`, { classes: ["Form 2"] }],
  ];
  for (const [method, path, body] of refused) {
    const r = await teacher.request(method, path, body);
    check(r.status === 403 && r.body?.code === "adminOnly", `refused on the server: ${method} ${path}`,
      `got ${r.status} ${r.body?.code ?? ""}`);
  }

  const pupilAfter = await storage.getStudent(pupil.id);
  const pick = (s: any) => JSON.stringify([s?.fullName, s?.qrCode, s?.password, s?.active, s?.form]);
  check(pick(pupilAfter) === pick(pupilBefore), "the pupil's record — name, card, password — is exactly as it was");
  const parentAfter = await storage.getParentByStudentId(pupil.id);
  check(!!parentAfter && parentAfter.fullName === parentBefore?.fullName, "the parent account is untouched");
  check(!(await storage.getStudentByStudentId(`NOPE-${stamp}`)), "no pupil was created");
  check(JSON.stringify((await storage.getTeacher(row.id))?.assignedClasses) === WANT, "and the teacher's own classes did not change");

  // =======================================================================
  section("Every management route checks for an administrator first");
  // =======================================================================
  //
  // Read from the source, because "could somebody add a management route
  // tomorrow and forget" is not something a running server can answer.

  const source = readFileSync("server/routes.ts", "utf8");
  const ADMIN_ONLY: Array<[string, string]> = [
    ["get", "/api/parents"], ["post", "/api/students/:id/parent"], ["patch", "/api/parents/:id"],
    ["delete", "/api/parents/:id"], ["get", "/api/students/by-code/:code"], ["post", "/api/students"],
    ["put", "/api/students/:id"], ["delete", "/api/students/:id"], ["post", "/api/students/:id/reset-password"],
    ["get", "/api/staff"], ["post", "/api/staff/:id/approve"], ["post", "/api/staff/:id/reject"],
    ["put", "/api/staff/:id/classes"],
  ];
  for (const [method, path] of ADMIN_ONLY) {
    const at = source.indexOf(`app.${method}("${path}", async (req, res) => {`);
    const opening = at < 0 ? "" : source.slice(at, at + 400);
    check(at >= 0 && opening.includes("requireTeacherAdmin(req, res)"),
      `${method.toUpperCase()} ${path} names requireTeacherAdmin`, at < 0 ? "route not found" : "");
  }

  // =======================================================================
  section("The administrator can mark work and manage everything");
  // =======================================================================

  const adminMark = await admin.post("/api/marks", {
    submissionId, totalScore: 1, feedback: "Re-marked by the head teacher.", markedById: 0,
    questionMarks: [{ questionId: "q1", score: 1, maxScore: 2 }],
  });
  check(adminMark.body?.success === true, "the head teacher CAN mark work", JSON.stringify(adminMark.body).slice(0, 160));
  const adminEdit = await admin.put(`/api/students/${pupil.id}`, { fullName: `${pupil.fullName} Updated` });
  check(adminEdit.body?.success === true, "and edit a pupil", JSON.stringify(adminEdit.body?.code));
  check((await admin.get(`/api/students/by-code/${QR}`)).status === 200, "and look a pupil up by their QR card");
  check((await admin.get("/api/parents")).status === 200, "and manage parent accounts");
  check((await admin.get("/api/staff")).status === 200, "and approve staff");

  // =======================================================================
  section("In a real browser");
  // =======================================================================

  const browser = await Browser.launch();
  onCleanup("the browser", () => browser.close());
  const page = await browser.newPage();

  // --- asking to join, on the screen
  const UI_EMAIL = `staff-screen-${stamp}@example.com`;
  createdEmails.push(UI_EMAIL);
  await page.goto(`${BASE}/teacher/login`);
  await page.click("link-register-teacher");
  await page.waitFor(`return location.pathname === "/teacher/register"`, "the register page");
  await page.fill("input-register-name", `Screen Teacher ${stamp}`);
  await page.fill("input-register-email", UI_EMAIL);
  await page.fill("input-register-password", PASSWORD);
  await page.fill("input-register-again", PASSWORD);
  await page.click("button-register");
  await page.waitForTestId("panel-request-sent");
  check((await page.textOf("text-awaiting-approval")).includes("awaiting approval by the school"),
    "the teacher login offers Register as a teacher, and the screen says the request awaits approval");

  await page.click("link-back-to-login");
  await page.waitForTestId("input-email");
  await page.fill("input-email", UI_EMAIL);
  await page.fill("input-password", PASSWORD);
  await page.click("button-login");
  await page.waitForTestId("text-awaiting-approval");
  check((await page.url()) === "/teacher/login",
    "signing in before approval stays on the login page, and says the account is awaiting approval");

  // --- the administrator approves it and gives a class, on the screen
  const screenRow = await storage.getTeacherByEmail(UI_EMAIL);
  check(screenRow?.approvalStatus === "pending", "that request is pending");
  if (!screenRow) return;
  await page.fill("input-email", ADMIN.email);
  await page.fill("input-password", ADMIN.password);
  await page.click("button-login");
  await page.waitFor(`return location.pathname === "/teacher/dashboard"`, "the administrator's dashboard");
  await page.waitForTestId("link-staff");
  check(await page.exists("link-students"), "an administrator's dashboard shows both Manage Students and Staff");

  await page.click("link-staff");
  await page.waitForTestId(`row-pending-${screenRow.id}`);
  await page.click(`button-approve-${screenRow.id}`);
  await page.waitForTestId(`row-staff-${screenRow.id}`);
  check((await storage.getTeacher(screenRow.id))?.approvalStatus === "approved",
    "the administrator approves the request on the Staff screen");
  await page.click(`checkbox-class-${screenRow.id}-Stage-4`);
  await page.click(`button-save-classes-${screenRow.id}`);
  check(await waitUntil(async () =>
      JSON.stringify((await storage.getTeacher(screenRow.id))?.assignedClasses) === JSON.stringify(["Stage 4"]), 10000),
    "and gives them a class there, stored on their account");

  await page.goto(`${BASE}/teacher/mark/${submissionId}`);
  await page.waitForTestId("button-submit-mark");
  check(true, "the administrator can open work to mark it");

  // --- the regular teacher, including typing the administrators' addresses
  await page.waitFor(`localStorage.clear(); return true`, "the browser to forget the administrator");
  await page.goto(`${BASE}/teacher/login`);
  await page.fill("input-email", EMAIL);
  await page.fill("input-password", PASSWORD);
  await page.click("button-login");
  await page.waitFor(`return location.pathname === "/teacher/dashboard"`, "the teacher's dashboard");
  await page.waitForTestId("link-question-bank");
  check(!(await page.exists("link-students")) && !(await page.exists("link-staff")),
    "a regular teacher's dashboard shows neither Manage Students nor Staff");
  check(await page.exists("link-gradebook") && await page.exists("link-reports"), "but still shows the teaching tools");

  for (const path of ["/teacher/students", "/teacher/staff"]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForTestId("admin-only");
    const text = await page.bodyText();
    check(!text.includes("Add New Student") && !text.includes(pupil.fullName),
      `typing ${path} shows "administrators only" — not the screen, and no pupil's name`);
  }

  await page.goto(`${BASE}/teacher/question-bank`);
  await page.waitForTestId("input-bank-search");
  check(true, "the teacher can open the Question Bank");
  await page.goto(`${BASE}/teacher/assignments/new`);
  await page.waitForTestId("button-create");
  check(true, "and the screen to create an assignment");
  await page.goto(`${BASE}/teacher/mark/${submissionId}`);
  await page.waitForTestId("button-submit-mark");
  check(true, "and open work to mark");

  // =======================================================================
  section("An account that stops being approved stops working at once");
  // =======================================================================

  await storage.updateTeacherStaffDetails(row.id, { approvalStatus: "rejected" });
  const afterReject = await teacher.get("/api/assignments");
  check(afterReject.status === 401,
    "a signed-in teacher whose account is rejected is refused on the very next request", `got ${afterReject.status}`);
  const rejectedLogin = await new Session().post("/api/auth/teacher/login", { email: EMAIL, password: PASSWORD });
  check(rejectedLogin.body?.code === "teacherRequestRejected",
    "and signing in again says the school has not approved the account", String(rejectedLogin.body?.code));
}

void runCheck(main, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);
  return failed === 0;
});
