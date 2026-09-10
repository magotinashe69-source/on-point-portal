// Certificates & Awards, walked end to end as a real pupil.
//
//   npm run check:certs   (start the server first: npm run dev)
//
// Makes a pupil score full marks and hold a seven-day streak, then checks the
// certificates they are owed appear, carry the right words and the right dates,
// and cannot be earned twice by looking twice.
//
// It creates its own pupil and assignments and removes them at the end. It
// also puts the streak clock back where it found it.

import {
  CERTIFICATE_TEXT, STREAK_STAR_DAYS, certificateDate, certificateKey,
} from "../shared/certificates";

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
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  console.log(`\nCertificates check (run ${stamp})\n`);

  const teacher = new Session();
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (!login.body?.success) {
    check(false, "the teacher can sign in", "is the server running? npm run dev");
    return finish();
  }

  const child = (await teacher.post("/api/students", {
    studentId: `CERT-${stamp}`, fullName: `Certificate Child ${stamp}`,
    gender: "Female", form: "Stage 4",
  })).body?.student;
  check(!!child, "a pupil is created");
  if (!child) return finish();

  const pupil = new Session();
  await pupil.post("/api/auth/student/login", { fullName: child.fullName, password: "certpw1234" });

  // =======================================================================
  section("Perfect Score");
  // =======================================================================

  const q = (id: string, a: number, b: number) => ({
    id, questionText: `What is ${a} + ${b}?`, maxScore: 1,
    type: "numeric", correctNumber: a + b, tolerance: 0,
  });
  const questions = [1, 2, 3, 4].map((n, i) => q(`c${n}`, i + 2, i + 2));
  const paper = (await teacher.post("/api/assignments", {
    subject: "MATHS", topic: `Adding ${stamp}`, form: "Stage 4",
    title: `Perfect paper ${stamp}`, instructions: "Answer all.",
    dueDate: "2026-12-01", totalMarks: 4, createdById: 1, questions,
  })).body?.assignment;
  check(!!paper, "a paper is created");
  if (!paper) return finish();

  // Everything right, so the mark is full.
  const handIn = await pupil.post("/api/submissions", {
    assignmentId: paper.id, studentId: child.id,
    answers: questions.map((qq) => {
      const m = /What is (\d+) \+ (\d+)\?/.exec(qq.questionText)!;
      return { questionId: qq.id, answerText: String(+m[1] + +m[2]) };
    }),
  });
  check(handIn.body?.mark?.totalScore === 4, "the pupil scores full marks",
    JSON.stringify(handIn.body?.mark?.totalScore));

  const first = await pupil.get(`/api/students/${child.id}/certificates`);
  check(first.body?.success === true, "the pupil can read their certificates",
    `status ${first.status}`);

  const list = () => (first.body?.certificates || []);
  const perfect = list().find((c: any) => c.kind === "perfect_score");
  check(!!perfect, "a Perfect Score certificate is earned",
    JSON.stringify(list().map((c: any) => c.kind)));
  check(perfect?.title === CERTIFICATE_TEXT.titles.perfect_score,
    "titled Perfect Score", perfect?.title);
  check(/full marks/i.test(perfect?.detail || ""),
    "and says what it was for", perfect?.detail);
  check((perfect?.detail || "").includes(`Perfect paper ${stamp}`),
    "naming the paper", perfect?.detail);
  check(perfect?.key === certificateKey.perfectScore(handIn.body?.submission?.id),
    "keyed to the submission, so a second perfect paper earns its own",
    perfect?.key);

  // The date must come from the MARK, not from the moment the page was opened.
  const markedAt = handIn.body?.mark?.markedAt;
  check(
    !!markedAt && new Date(perfect?.earnedAt).getTime() === new Date(markedAt).getTime(),
    "dated by when the work was marked, not by when the page was read",
    `certificate ${perfect?.earnedAt} vs mark ${markedAt}`,
  );

  // =======================================================================
  section("Earned once, however often it is read");
  // =======================================================================

  const before = list().length;
  await pupil.get(`/api/students/${child.id}/certificates`);
  await pupil.get(`/api/students/${child.id}/certificates`);
  const again = await pupil.get(`/api/students/${child.id}/certificates`);
  check((again.body?.certificates || []).length === before,
    "reading the page three more times earns nothing more",
    `${before} -> ${(again.body?.certificates || []).length}`);

  // =======================================================================
  section("Streak Star");
  // =======================================================================
  //
  // Walked day by day with the dev clock, so the streak is a real one built the
  // way a child's is rather than a number written straight into the table.

  const startToday = (await teacher.get("/api/dev/streak/sim-date")).body?.today;
  let ok = true;
  for (let i = 0; i < STREAK_STAR_DAYS; i++) {
    const day = addDays(startToday, i);
    const set = await teacher.post("/api/dev/streak/sim-date", { date: day });
    if (set.body?.today !== day) { ok = false; break; }
    await teacher.post("/api/dev/streak/activity", { studentId: child.id });
  }
  check(ok, "the clock can be walked forward a day at a time",
    "the dev streak helper is needed for this check");

  // The dev endpoint answers with a StreakSummary, whose field is `longest` —
  // not `longestStreak`, which is the column name on the table.
  const streak = (await teacher.post("/api/dev/streak/activity", { studentId: child.id })).body?.streak;
  check((streak?.longest ?? 0) >= STREAK_STAR_DAYS,
    `the pupil reaches a ${STREAK_STAR_DAYS}-day streak`,
    `longest ${streak?.longest}, current ${streak?.current}`);

  const afterStreak = await pupil.get(`/api/students/${child.id}/certificates`);
  const star = (afterStreak.body?.certificates || []).find((c: any) => c.kind === "streak_star");
  check(!!star, "a Streak Star certificate is earned",
    JSON.stringify((afterStreak.body?.certificates || []).map((c: any) => c.kind)));
  check(star?.title === CERTIFICATE_TEXT.titles.streak_star, "titled Streak Star", star?.title);
  check((star?.detail || "").includes(String(STREAK_STAR_DAYS)),
    "and says how many days", star?.detail);

  const stars = (afterStreak.body?.certificates || []).filter((c: any) => c.kind === "streak_star");
  check(stars.length === 1, "only one, however many days beyond seven they go",
    String(stars.length));

  // Put the clock back before anything else runs.
  await teacher.post("/api/dev/streak/sim-date", { date: null });

  // =======================================================================
  section("Topic Master and Level Up");
  // =======================================================================

  const withTopic = await pupil.get(`/api/students/${child.id}/certificates`);
  const all = withTopic.body?.certificates || [];

  const master = all.find((c: any) => c.kind === "topic_master");
  check(!!master, "a mastered topic earns a Topic Master certificate",
    JSON.stringify(all.map((c: any) => c.kind)));
  check((master?.detail || "").includes(`Adding ${stamp}`),
    "naming the topic that was mastered", master?.detail);

  // A precise invariant that holds whatever level the pupil happens to be:
  // one certificate per level reached, and none for level 0.
  const stats = (await pupil.get(`/api/students/${child.id}/stats`)).body;
  const level = stats?.stats?.level ?? (await pupil.get(`/api/students/${child.id}/streak`)).body?.level ?? 0;
  const levelCerts = all.filter((c: any) => c.kind === "level_up");
  check(levelCerts.length === Math.max(0, level),
    "there is exactly one Level Up certificate per level reached",
    `level ${level}, certificates ${levelCerts.length}`);

  // =======================================================================
  section("Whose certificates are they?");
  // =======================================================================

  const other = (await teacher.post("/api/students", {
    studentId: `CERTX-${stamp}`, fullName: `Certificate Other ${stamp}`,
    gender: "Male", form: "Stage 4",
  })).body?.student;
  check(!!other, "a second pupil is created",
    "if this fails the checks below are SKIPPED, not passing");
  if (other) {
    const otherPupil = new Session();
    await otherPupil.post("/api/auth/student/login", { fullName: other.fullName, password: "certpw5678" });
    const peek = await otherPupil.get(`/api/students/${child.id}/certificates`);
    check(peek.status === 403 || peek.status === 401,
      "one pupil cannot read another pupil's certificates", `got ${peek.status}`);
    await teacher.delete(`/api/students/${other.id}`);
  }

  const anon = await new Session().get(`/api/students/${child.id}/certificates`);
  check(anon.status === 401, "a logged-out caller cannot either", `got ${anon.status}`);

  const teacherView = await teacher.get(`/api/students/${child.id}/certificates`);
  check(teacherView.body?.success === true, "a teacher can see a pupil's certificates",
    `status ${teacherView.status}`);

  // =======================================================================
  section("Most Improved, run by a teacher");
  // =======================================================================

  const today = (await teacher.get("/api/dev/streak/sim-date")).body?.today;
  const compare = await teacher.get(
    `/api/reports/most-improved?form=Stage%204&subject=MATHS` +
    `&beforeFrom=${addDays(today, -60)}&beforeTo=${addDays(today, -30)}` +
    `&afterFrom=${addDays(today, -29)}&afterTo=${today}`);
  check(compare.body?.success === true, "a teacher can compare two periods",
    `status ${compare.status}`);
  check(Array.isArray(compare.body?.rows), "and gets a row per pupil in the class");

  const mine = (compare.body?.rows || []).find((r: any) => r.studentId === child.id);
  check(!!mine, "including the pupil who handed work in");
  check(mine?.pupilId === `CERT-${stamp}`,
    "carrying their school id, so two children sharing a name can be told apart",
    mine?.pupilId);

  // Awarding is separate from looking, so a teacher can compare freely.
  const awarded = await teacher.post("/api/reports/most-improved/award", {
    studentId: child.id, subject: "MATHS",
    beforePercent: 40, afterPercent: 75,
    from: addDays(today, -60), to: today,
  });
  check(awarded.body?.success === true, "a Most Improved certificate can be awarded",
    JSON.stringify(awarded.body).slice(0, 140));
  check(awarded.body?.certificate?.kind === "most_improved", "of the right kind");
  check(/40% to 75%/.test(awarded.body?.certificate?.detail || ""),
    "carrying the movement it was awarded for", awarded.body?.certificate?.detail);
  check(/35 points/.test(awarded.body?.certificate?.detail || ""),
    "and the size of the climb", awarded.body?.certificate?.detail);

  const twice = await teacher.post("/api/reports/most-improved/award", {
    studentId: child.id, subject: "MATHS",
    beforePercent: 40, afterPercent: 75,
    from: addDays(today, -60), to: today,
  });
  check(twice.body?.alreadyAwarded === true,
    "awarding the same period twice says so rather than duplicating it",
    JSON.stringify(twice.body).slice(0, 120));

  const onChild = await pupil.get(`/api/students/${child.id}/certificates`);
  check((onChild.body?.certificates || []).some((c: any) => c.kind === "most_improved"),
    "and it appears among the pupil's own certificates");

  // A pupil must not be able to award themselves one.
  const selfAward = await pupil.post("/api/reports/most-improved/award", {
    studentId: child.id, subject: "MATHS", beforePercent: 1, afterPercent: 99,
    from: today, to: today,
  });
  check(selfAward.status === 401 || selfAward.status === 403,
    "a pupil cannot award themselves a certificate", `got ${selfAward.status}`);

  // =======================================================================
  section("Nothing upstream was changed");
  // =======================================================================
  //
  // The whole feature reads. If asking for certificates could alter a mark, a
  // streak or an XP total, it would be rewriting the very thing it reports on.

  const markNow = (await pupil.get(`/api/marks/${handIn.body?.submission?.id}`)).body;
  check(markNow?.totalScore === handIn.body?.mark?.totalScore,
    "the mark is exactly as it was before any certificate was earned",
    `${handIn.body?.mark?.totalScore} -> ${markNow?.totalScore}`);

  const oneCert = (onChild.body?.certificates || [])[0];
  const single = await pupil.get(`/api/students/${child.id}/certificates/${oneCert?.id}`);
  check(single.body?.success === true, "one certificate can be opened on its own",
    `status ${single.status}`);
  check(single.body?.student?.fullName === child.fullName,
    "and carries the pupil's name for the printed page", single.body?.student?.fullName);
  check(!!certificateDate(single.body?.certificate?.earnedAt),
    "and a date that reads properly on a certificate",
    certificateDate(single.body?.certificate?.earnedAt));

  // --- Tidy up ----------------------------------------------------------
  await teacher.post("/api/dev/streak/sim-date", { date: null });
  await teacher.delete(`/api/assignments/${paper.id}`);
  await teacher.delete(`/api/students/${child.id}`);
  console.log("\nTest pupil and assignment removed, streak clock reset.");

  finish();
}

function finish() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
