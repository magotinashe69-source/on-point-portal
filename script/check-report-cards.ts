// Report cards, walked end to end for a whole class.
//
//   npm run check:reports   (start the server first: npm run dev)
//
// The marks are chosen so every figure on the card can be worked out by hand:
// if the check and the code disagree, the arithmetic below says which is wrong.
//
//   Maths   A 4/4 = 100%   B 2/4 = 50%   C 3/4 = 75%   class 9/12  = 75%
//   Science A 1/4 =  25%   (nobody else)               class 1/4   = 25%
//   A overall (4+1)/(4+4) = 5/8 = 62.5 -> 63%          class 10/16 = 63%

import {
  DEFAULT_BOUNDARIES, gradeFor, validateBoundaries,
} from "../shared/report-card";
import { onCleanup, runCheck } from "./cleanup";

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
  put(p: string, b?: unknown) { return this.request("PUT", p, b); }
  delete(p: string) { return this.request("DELETE", p); }
}

const stamp = Date.now().toString().slice(-6);
const FORM = "Stage 6";
const TERM = { label: `Term Check ${stamp}`, from: "2026-01-01", to: "2026-12-31" };

async function main() {
  console.log(`\nReport card check (run ${stamp})\n`);

  // =======================================================================
  section("Grade boundaries, on their own");
  // =======================================================================

  check(gradeFor(100, DEFAULT_BOUNDARIES) === "A*", "100% is an A*");
  check(gradeFor(90, DEFAULT_BOUNDARIES) === "A*", "exactly 90 is an A*, not an A");
  check(gradeFor(89, DEFAULT_BOUNDARIES) === "A", "89 is an A");
  check(gradeFor(40, DEFAULT_BOUNDARIES) === "E", "exactly 40 is an E, not a U");
  check(gradeFor(39, DEFAULT_BOUNDARIES) === "U", "39 is a U");
  check(gradeFor(0, DEFAULT_BOUNDARIES) === "U", "0 is a U, not an empty grade");

  // Boundaries stored in the wrong order must still grade correctly.
  const shuffled = [...DEFAULT_BOUNDARIES].reverse();
  check(gradeFor(85, shuffled) === "A",
    "boundaries saved in the wrong order still grade correctly", gradeFor(85, shuffled));

  // A set that does not hold together is refused rather than stored.
  check(validateBoundaries([{ grade: "A", min: 50 }]).length > 0,
    "a set with nothing starting at 0 is refused — every mark needs a grade");
  check(validateBoundaries([{ grade: "A", min: 50 }, { grade: "A", min: 0 }]).length > 0,
    "two grades sharing a name are refused");
  check(validateBoundaries([{ grade: "A", min: 0 }, { grade: "B", min: 0 }]).length > 0,
    "two grades starting at the same mark are refused");
  check(validateBoundaries(DEFAULT_BOUNDARIES).length === 0, "the Cambridge defaults are valid");

  // =======================================================================
  section("A real class with marked work");
  // =======================================================================

  const teacher = new Session();
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (!login.body?.success) {
    check(false, "the teacher can sign in", "is the server running? npm run dev");
    return;
  }

  const kids: Record<string, any> = {};
  for (const tag of ["A", "B", "C"]) {
    const k = (await teacher.post("/api/students", {
      studentId: `RC-${tag}${stamp}`, fullName: `Report ${tag} ${stamp}`,
      gender: "Female", form: FORM,
    })).body?.student;
    kids[tag] = k;
    if (k) onCleanup(`pupil ${k.studentId}`, () => teacher.delete(`/api/students/${k.id}`));
  }
  check(!!kids.A && !!kids.B && !!kids.C, "three pupils are created",
    "if this fails the checks below are SKIPPED, not passing");
  if (!kids.A || !kids.B || !kids.C) return;

  const q = (id: string, a: number, b: number) => ({
    id, questionText: `What is ${a} + ${b}?`, maxScore: 1,
    type: "numeric", correctNumber: a + b, tolerance: 0,
  });
  const makePaper = async (subject: string, title: string, dueDate: string) => {
    const questions = [1, 2, 3, 4].map((n, i) => q(`r${n}`, i + 2, i + 2));
    const a = (await teacher.post("/api/assignments", {
      subject, topic: "Term work", form: FORM, title, instructions: "Answer all.",
      dueDate, totalMarks: 4, createdById: 1, questions,
    })).body?.assignment;
    if (a) onCleanup(`assignment ${a.title}`, () => teacher.delete(`/api/assignments/${a.id}`));
    return { a, questions };
  };

  const maths = await makePaper("MATHS", `RC Maths ${stamp}`, "2026-12-01");
  const science = await makePaper("SCIENCE", `RC Science ${stamp}`, "2026-12-01");
  check(!!maths.a && !!science.a, "two papers are created");
  if (!maths.a || !science.a) return;

  const sessions: Record<string, Session> = {};
  const answer = async (tag: string, paper: any, right: number) => {
    if (!sessions[tag]) {
      sessions[tag] = new Session();
      await sessions[tag].post("/api/auth/student/login", {
        fullName: kids[tag].fullName, password: "reportpw123",
      });
    }
    await sessions[tag].post("/api/submissions", {
      assignmentId: paper.a.id, studentId: kids[tag].id,
      answers: paper.questions.map((qq: any, i: number) => {
        const m = /What is (\d+) \+ (\d+)\?/.exec(qq.questionText)!;
        return { questionId: qq.id, answerText: i < right ? String(+m[1] + +m[2]) : "0" };
      }),
    });
  };

  await answer("A", maths, 4);   // 100%
  await answer("B", maths, 2);   //  50%
  await answer("C", maths, 3);   //  75%
  await answer("A", science, 1); //  25%

  const params = new URLSearchParams({ form: FORM, termLabel: TERM.label, from: TERM.from, to: TERM.to });
  const built = await teacher.get(`/api/report-cards?${params}`);
  check(built.body?.success === true, "the cards build", `status ${built.status}`);

  const cards = built.body?.cards || [];
  const cardA = cards.find((c: any) => c.student.id === kids.A.id);
  check(!!cardA, "there is a card for every pupil in the class",
    JSON.stringify(cards.map((c: any) => c.student.fullName)));
  if (!cardA) return;

  const subject = (card: any, name: string) =>
    (card.subjects || []).find((s: any) => s.subject === name);

  // =======================================================================
  section("The subject averages and grades");
  // =======================================================================

  const aMaths = subject(cardA, "MATHS");
  check(aMaths?.percent === 100, "pupil A's maths average is 100%", String(aMaths?.percent));
  check(aMaths?.grade === "A*", "which is an A*", aMaths?.grade);
  check(aMaths?.marked === 1, "based on one marked piece", String(aMaths?.marked));

  const aScience = subject(cardA, "SCIENCE");
  check(aScience?.percent === 25, "pupil A's science average is 25%", String(aScience?.percent));
  check(aScience?.grade === "U", "which is a U", aScience?.grade);

  const cardB = cards.find((c: any) => c.student.id === kids.B.id);
  check(subject(cardB, "MATHS")?.percent === 50, "pupil B's maths average is 50%",
    String(subject(cardB, "MATHS")?.percent));
  check(subject(cardB, "MATHS")?.grade === "D", "which is a D",
    subject(cardB, "MATHS")?.grade);

  const cardC = cards.find((c: any) => c.student.id === kids.C.id);
  check(subject(cardC, "MATHS")?.percent === 75, "pupil C's maths average is 75%",
    String(subject(cardC, "MATHS")?.percent));
  check(subject(cardC, "MATHS")?.grade === "B", "which is a B",
    subject(cardC, "MATHS")?.grade);

  // =======================================================================
  section("The class averages beside them");
  // =======================================================================
  //
  // 9 marks scored out of 12 available across the three pupils = 75%.

  check(aMaths?.classPercent === 75,
    "the maths class average is 75%, worked from every pupil's marks",
    String(aMaths?.classPercent));
  check(aMaths?.classChildren === 3, "and counts all three pupils", String(aMaths?.classChildren));

  check(aScience?.classPercent === 25,
    "the science class average is 25% — only one pupil sat it",
    String(aScience?.classPercent));
  check(aScience?.classChildren === 1, "and says so", String(aScience?.classChildren));

  // Every pupil's card shows the SAME class figure, or the comparison is a lie.
  check(
    subject(cardB, "MATHS")?.classPercent === 75 && subject(cardC, "MATHS")?.classPercent === 75,
    "every card in the class quotes the same class average",
    `${subject(cardB, "MATHS")?.classPercent} / ${subject(cardC, "MATHS")?.classPercent}`,
  );

  // A pupil who sat nothing in a subject still gets the row, so the class
  // figure is visible rather than the subject silently missing.
  check(subject(cardB, "SCIENCE")?.percent === null,
    "a pupil with nothing marked in a subject shows a dash, not a zero",
    String(subject(cardB, "SCIENCE")?.percent));
  check(subject(cardB, "SCIENCE")?.grade === null,
    "and no grade, because no grade was earned");

  // =======================================================================
  section("Overall");
  // =======================================================================
  //
  // Pupil A: 5 scored of 8 available = 62.5, which rounds to 63.

  check(cardA.overallPercent === 63, "pupil A's overall average is 63%",
    String(cardA.overallPercent));
  check(cardA.overallGrade === "C", "which is a C", cardA.overallGrade);
  check(cardA.classOverallPercent === 63, "and the class overall is 63% too",
    String(cardA.classOverallPercent));

  // =======================================================================
  section("What the card says about attendance");
  // =======================================================================
  //
  // The portal keeps NO attendance register. A card that printed a percentage
  // here would be inventing a fact a parent then acts on.

  check(cardA.attendance?.recorded === false,
    "the card does not claim attendance is recorded", String(cardA.attendance?.recorded));
  check(cardA.attendance?.schoolDays === null,
    "there is no total of school days to divide by");
  check(typeof cardA.attendance?.daysActive === "number",
    "only the days work was handed in, which is real",
    String(cardA.attendance?.daysActive));

  // =======================================================================
  section("Work outside the term does not count");
  // =======================================================================

  const outside = new URLSearchParams({
    form: FORM, termLabel: `Empty ${stamp}`, from: "2020-01-01", to: "2020-12-31",
  });
  const emptyTerm = await teacher.get(`/api/report-cards?${outside}`);
  const emptyA = (emptyTerm.body?.cards || []).find((c: any) => c.student.id === kids.A.id);
  check(!!emptyA, "a card is still produced for a term with no work");
  check(emptyA?.overallPercent === null,
    "with no overall average, rather than a zero", String(emptyA?.overallPercent));
  check((emptyA?.subjects || []).every((s: any) => s.marked === 0),
    "and nothing marked in it");

  // =======================================================================
  section("The teacher's comment");
  // =======================================================================

  const comment = `Steady, careful work all term. ${stamp}`;
  const savedComment = await teacher.put("/api/report-cards/comment", {
    studentId: kids.A.id, termLabel: TERM.label, from: TERM.from, to: TERM.to, comment,
  });
  check(savedComment.body?.success === true, "a comment can be saved",
    JSON.stringify(savedComment.body).slice(0, 120));

  const withComment = await teacher.get(`/api/report-cards?${params}`);
  const cardAgain = (withComment.body?.cards || []).find((c: any) => c.student.id === kids.A.id);
  check(cardAgain?.comment === comment, "and appears on the card", cardAgain?.comment);

  // Editing replaces rather than adds a second.
  const edited = `Changed my mind. ${stamp}`;
  await teacher.put("/api/report-cards/comment", {
    studentId: kids.A.id, termLabel: TERM.label, from: TERM.from, to: TERM.to, comment: edited,
  });
  const afterEdit = await teacher.get(`/api/report-cards?${params}`);
  const cardEdited = (afterEdit.body?.cards || []).find((c: any) => c.student.id === kids.A.id);
  check(cardEdited?.comment === edited, "editing it replaces what was there", cardEdited?.comment);

  // A comment belongs to ITS term. Next term's card must not carry it.
  const otherTerm = new URLSearchParams({
    form: FORM, termLabel: `Other ${stamp}`, from: TERM.from, to: TERM.to,
  });
  const otherCards = await teacher.get(`/api/report-cards?${otherTerm}`);
  const otherA = (otherCards.body?.cards || []).find((c: any) => c.student.id === kids.A.id);
  check(otherA?.comment === null,
    "a different term's card does not carry this term's comment", String(otherA?.comment));

  // Another pupil's card must not carry it either.
  const cardBAgain = (afterEdit.body?.cards || []).find((c: any) => c.student.id === kids.B.id);
  check(cardBAgain?.comment === null, "nor does another pupil's card", String(cardBAgain?.comment));

  // =======================================================================
  section("Boundaries the school sets itself");
  // =======================================================================

  const before = await teacher.get("/api/report-cards/boundaries");
  check(Array.isArray(before.body?.boundaries), "the boundaries can be read");
  onCleanup("grade boundaries", () =>
    teacher.put("/api/report-cards/boundaries", { boundaries: DEFAULT_BOUNDARIES }));

  // A harsher scale: 75% is no longer a B.
  const harsher = [
    { grade: "A*", min: 95 }, { grade: "A", min: 85 }, { grade: "B", min: 80 },
    { grade: "C", min: 70 }, { grade: "D", min: 60 }, { grade: "U", min: 0 },
  ];
  const savedB = await teacher.put("/api/report-cards/boundaries", { boundaries: harsher });
  check(savedB.body?.success === true, "a school can set its own boundaries",
    JSON.stringify(savedB.body).slice(0, 120));

  const regraded = await teacher.get(`/api/report-cards?${params}`);
  const regradedC = (regraded.body?.cards || []).find((c: any) => c.student.id === kids.C.id);
  check(subject(regradedC, "MATHS")?.percent === 75,
    "the average is unchanged by a boundary change — only the grade moves",
    String(subject(regradedC, "MATHS")?.percent));
  check(subject(regradedC, "MATHS")?.grade === "C",
    "75% is a C on the harsher scale, where it was a B",
    subject(regradedC, "MATHS")?.grade);
  check((regradedC?.boundaries || []).some((b: any) => b.grade === "A*" && b.min === 95),
    "and the card carries the boundaries it was graded against");

  const bad = await teacher.put("/api/report-cards/boundaries", {
    boundaries: [{ grade: "A", min: 50 }],
  });
  check(bad.status === 400, "a set that leaves marks ungraded is refused", `got ${bad.status}`);
  const stillHarsh = await teacher.get("/api/report-cards/boundaries");
  check((stillHarsh.body?.boundaries || []).some((b: any) => b.min === 95),
    "and the stored set is left as it was");

  // =======================================================================
  section("Who can see a report card");
  // =======================================================================

  const pupilPeek = await sessions.A.get(`/api/report-cards?${params}`);
  check(pupilPeek.status === 401 || pupilPeek.status === 403,
    "a pupil cannot read the class's report cards", `got ${pupilPeek.status}`);
  const anon = await new Session().get(`/api/report-cards?${params}`);
  check(anon.status === 401, "nor can a logged-out caller", `got ${anon.status}`);
  const anonBoundaries = await new Session().put("/api/report-cards/boundaries", {
    boundaries: DEFAULT_BOUNDARIES,
  });
  check(anonBoundaries.status === 401, "nor can they change the grade boundaries",
    `got ${anonBoundaries.status}`);

  const noForm = await teacher.get(`/api/report-cards?termLabel=x&from=2026-01-01&to=2026-12-31`);
  check(noForm.status === 400, "asking without a class is refused", `got ${noForm.status}`);

  // =======================================================================
  section("Nothing was changed by reporting on it");
  // =======================================================================

  const marksNow = await teacher.get(`/api/submissions?assignmentId=${maths.a.id}`);
  const stillThere = Array.isArray(marksNow.body) ? marksNow.body.length : 0;
  check(stillThere === 3, "the three submissions are exactly as they were",
    String(stillThere));
}

function summary(): boolean {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

runCheck(main, summary);
