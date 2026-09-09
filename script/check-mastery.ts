// The Learner Mastery Map, walked end to end as a real pupil.
//
//   npm run check:mastery   (start the server first: npm run dev)
//
// Two halves. The first checks the calculation on its own — the band
// boundaries especially, because an off-by-one there quietly tells a child they
// are failing something they have nearly got. The second builds a real pupil
// with real marked homework across several topics and reads the map back over
// HTTP, which is the path the dashboard actually takes.
//
// It creates its own pupil and assignments and removes them at the end.

import {
  buildMasteryMap, bandFor, MASTERED_AT, DEVELOPING_AT, MIN_MARKS_FOR_A_TOPIC,
  type AnsweredQuestion,
} from "../shared/mastery";

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

/** A question worth one mark whose answer is in its own wording. */
function q(id: string, a: number, b: number, topic?: string) {
  return {
    id,
    questionText: `What is ${a} + ${b}?`,
    maxScore: 1,
    type: "numeric",
    correctNumber: a + b,
    tolerance: 0,
    ...(topic ? { topic } : {}),
  };
}

function paper(subject: string, topic: string | undefined, title: string, questions: any[]) {
  return {
    subject,
    ...(topic ? { topic } : {}),
    form: "Stage 4",
    title,
    instructions: "Answer all questions.",
    dueDate: "2026-12-01",
    totalMarks: questions.length,
    createdById: 1,
    questions,
  };
}

/** Answer `right` of the questions correctly and the rest wrong. */
function answers(questions: any[], right: number) {
  return questions.map((question, i) => {
    const m = /What is (\d+) \+ (\d+)\?/.exec(question.questionText)!;
    const correct = String(Number(m[1]) + Number(m[2]));
    return {
      questionId: question.id,
      answerText: i < right ? correct : "999999",
    };
  });
}

async function main() {
  console.log(`\nMastery map check (run ${stamp})\n`);

  // =======================================================================
  section("The bands, worked out on their own");
  // =======================================================================
  //
  // Checked exactly ON the boundaries. This is where an off-by-one tells a
  // child they are failing something they have in fact nearly mastered.

  check(bandFor(100) === "mastered", "100% is mastered");
  check(bandFor(MASTERED_AT) === "mastered", `exactly ${MASTERED_AT}% is mastered, not developing`);
  check(bandFor(MASTERED_AT - 1) === "developing", `${MASTERED_AT - 1}% is developing`);
  check(bandFor(DEVELOPING_AT) === "developing", `exactly ${DEVELOPING_AT}% is developing, not practise`);
  check(bandFor(DEVELOPING_AT - 1) === "practise", `${DEVELOPING_AT - 1}% needs practice`);
  check(bandFor(0) === "practise", "0% needs practice");

  // A topic with too little behind it is not a skill yet.
  const thin: AnsweredQuestion[] = [
    { subject: "MATHS", topic: "Thin", scored: 0, available: MIN_MARKS_FOR_A_TOPIC - 1 },
  ];
  check(buildMasteryMap(thin).totals.topics === 0,
    "one or two marks is not enough to call something a skill");

  // Untagged work is counted but never shown, and never as a failure.
  const untagged: AnsweredQuestion[] = [
    { subject: "MATHS", topic: null, scored: 0, available: 10 },
    { subject: "MATHS", topic: "", scored: 0, available: 10 },
  ];
  const untaggedMap = buildMasteryMap(untagged);
  check(untaggedMap.totals.topics === 0, "questions with no topic are not skills");
  check(untaggedMap.untagged === 2, "but they are counted, so a thin map can be explained",
    String(untaggedMap.untagged));
  check(untaggedMap.hasEnough === false, "and on their own they do not make a map");

  // Partial credit counts honestly: 3 out of 5 on a written answer is not zero.
  const partial = buildMasteryMap([
    { subject: "ENGLISH", topic: "Essays", scored: 3, available: 5 },
  ]);
  check(partial.subjects[0]?.topics[0]?.percent === 60,
    "a part-marked answer counts what it earned, not nothing",
    String(partial.subjects[0]?.topics[0]?.percent));

  // The same topic name in two subjects is two different skills.
  const sameName = buildMasteryMap([
    { subject: "MATHS", topic: "Graphs", scored: 4, available: 4 },
    { subject: "GEOGRAPHY", topic: "Graphs", scored: 0, available: 4 },
  ]);
  check(sameName.totals.topics === 2,
    "the same topic in two subjects is two skills, not one",
    String(sameName.totals.topics));
  check(sameName.subjects.length === 2, "and they sit under their own subjects");

  // Strongest first, so a child reads what they can do before what they cannot.
  const ordered = buildMasteryMap([
    { subject: "MATHS", topic: "Weak", scored: 0, available: 4 },
    { subject: "MATHS", topic: "Strong", scored: 4, available: 4 },
  ]);
  check(ordered.subjects[0]?.topics[0]?.topic === "Strong",
    "the strongest skill is listed first");

  // =======================================================================
  section("A real pupil, with real marked homework");
  // =======================================================================

  const teacher = new Session();
  const login = await teacher.post("/api/auth/teacher/login", TEACHER);
  if (!login.body?.success) {
    check(false, "the teacher can sign in", "is the server running? npm run dev");
    return finish();
  }

  const child = (await teacher.post("/api/students", {
    studentId: `MS-${stamp}`, fullName: `Mastery Test Child ${stamp}`,
    gender: "Female", form: "Stage 4",
  })).body?.student;
  check(!!child, "a Stage 4 pupil is created");
  if (!child) return finish();

  // Four papers, chosen so each lands in a different band, plus one with no
  // topic at all.
  const fractions = [q("f1", 2, 2), q("f2", 3, 3), q("f3", 4, 4), q("f4", 5, 5)];
  const angles = [q("a1", 2, 2), q("a2", 3, 3), q("a3", 4, 4), q("a4", 5, 5)];
  const plants = [q("p1", 2, 2), q("p2", 3, 3), q("p3", 4, 4), q("p4", 5, 5)];
  const untitled = [q("u1", 2, 2), q("u2", 3, 3), q("u3", 4, 4), q("u4", 5, 5)];
  // A "Revision" paper whose questions each carry their own topic — the finer
  // case the Question Bank feeds.
  const revision = [
    q("r1", 2, 2, `Shapes ${stamp}`), q("r2", 3, 3, `Shapes ${stamp}`),
    q("r3", 4, 4, `Shapes ${stamp}`), q("r4", 5, 5, `Shapes ${stamp}`),
  ];

  const made = [
    { key: "fractions", body: paper("MATHS", `Fractions ${stamp}`, `Fractions ${stamp}`, fractions), right: 4 },
    { key: "angles", body: paper("MATHS", `Angles ${stamp}`, `Angles ${stamp}`, angles), right: 2 },
    { key: "plants", body: paper("SCIENCE", `Plants ${stamp}`, `Plants ${stamp}`, plants), right: 1 },
    { key: "untitled", body: paper("MATHS", undefined, `No topic ${stamp}`, untitled), right: 0 },
    { key: "revision", body: paper("MATHS", `Revision ${stamp}`, `Revision ${stamp}`, revision), right: 3 },
  ];

  const created: Record<string, any> = {};
  for (const m of made) {
    created[m.key] = (await teacher.post("/api/assignments", m.body)).body?.assignment;
  }
  check(Object.values(created).every(Boolean), "five papers are created",
    JSON.stringify(Object.entries(created).map(([k, v]) => `${k}:${!!v}`)));

  const pupil = new Session();
  await pupil.post("/api/auth/student/login", { fullName: child.fullName, password: "masterypw1" });

  for (const m of made) {
    const a = created[m.key];
    if (!a) continue;
    await pupil.post("/api/submissions", {
      assignmentId: a.id, studentId: child.id,
      answers: answers(m.body.questions, m.right),
    });
  }

  const res = await pupil.get(`/api/students/${child.id}/mastery`);
  check(res.body?.success === true, "the pupil can read their own map", `status ${res.status}`);
  const map = res.body?.mastery;

  const topicNamed = (name: string) =>
    (map?.subjects || []).flatMap((s: any) => s.topics).find((t: any) => t.topic === name);

  // --- The colours ------------------------------------------------------
  const fr = topicNamed(`Fractions ${stamp}`);
  check(fr?.percent === 100, "4 right out of 4 is 100%", String(fr?.percent));
  check(fr?.band === "mastered", "and shows as mastered (green)", fr?.band);

  const an = topicNamed(`Angles ${stamp}`);
  check(an?.percent === 50, "2 right out of 4 is 50%", String(an?.percent));
  check(an?.band === "developing", "and shows as developing (amber), on the boundary", an?.band);

  const pl = topicNamed(`Plants ${stamp}`);
  check(pl?.percent === 25, "1 right out of 4 is 25%", String(pl?.percent));
  check(pl?.band === "practise", "and shows as needing practice (red)", pl?.band);

  // --- Subjects group ---------------------------------------------------
  const maths = (map?.subjects || []).find((s: any) => s.subject === "MATHS");
  const science = (map?.subjects || []).find((s: any) => s.subject === "SCIENCE");
  check(!!maths && !!science, "both subjects appear");
  const mathsTopics = (maths?.topics || []).map((t: any) => t.topic);
  check(mathsTopics.includes(`Fractions ${stamp}`) && mathsTopics.includes(`Angles ${stamp}`),
    "the maths topics are grouped under maths", JSON.stringify(mathsTopics));
  check((science?.topics || []).some((t: any) => t.topic === `Plants ${stamp}`),
    "and the science topic under science");
  check(!mathsTopics.includes(`Plants ${stamp}`), "science work is not filed under maths");

  // --- A question's own topic beats the paper's -------------------------
  check(!!topicNamed(`Shapes ${stamp}`),
    "a question's own topic becomes its skill");
  check(!topicNamed(`Revision ${stamp}`),
    "and the paper's broader topic is not used when the question has its own");

  // --- Untagged work does not break anything ----------------------------
  check((map?.untagged ?? 0) >= 4,
    "questions with no topic anywhere are counted as untagged",
    String(map?.untagged));
  const allTopics = (map?.subjects || []).flatMap((s: any) => s.topics).map((t: any) => t.topic);
  check(!allTopics.some((t: string) => /No topic/.test(t)),
    "and never appear as a skill", JSON.stringify(allTopics));
  check(!allTopics.includes("") && !allTopics.includes(null),
    "and never appear as an empty red band");
  check(map?.hasEnough === true, "the map still draws despite them", String(map?.hasEnough));

  // --- Totals -----------------------------------------------------------
  check(map?.totals?.mastered >= 1 && map?.totals?.practise >= 1,
    "the totals count each band", JSON.stringify(map?.totals));

  // --- A child with nothing gets an invitation, not a verdict ------------
  const fresh = (await teacher.post("/api/students", {
    studentId: `MS0-${stamp}`, fullName: `Mastery Empty Child ${stamp}`,
    gender: "Male", form: "Stage 4",
  })).body?.student;
  check(!!fresh, "a pupil with no work is created",
    "if this fails the checks below are SKIPPED, not passing");
  if (fresh) {
    const freshPupil = new Session();
    await freshPupil.post("/api/auth/student/login", { fullName: fresh.fullName, password: "masterypw2" });
    const emptyRes = await freshPupil.get(`/api/students/${fresh.id}/mastery`);
    check(emptyRes.body?.success === true, "a pupil who has done nothing still gets an answer");
    check(emptyRes.body?.mastery?.hasEnough === false,
      "with hasEnough false, so the page invites them rather than showing zeros");
    check((emptyRes.body?.mastery?.subjects || []).length === 0,
      "and no subjects at all — never a screen full of 0%");
    await teacher.delete(`/api/students/${fresh.id}`);
  }

  // --- Whose map is it? -------------------------------------------------
  // A list of what one named child is weakest at is not something another
  // pupil should be able to read.
  const other = (await teacher.post("/api/students", {
    studentId: `MSX-${stamp}`, fullName: `Mastery Other Child ${stamp}`,
    gender: "Male", form: "Stage 4",
  })).body?.student;
  check(!!other, "a second pupil is created to try reading someone else's map",
    "if this fails the checks below are SKIPPED, not passing");
  if (other) {
    const otherPupil = new Session();
    await otherPupil.post("/api/auth/student/login", { fullName: other.fullName, password: "masterypw3" });
    const peek = await otherPupil.get(`/api/students/${child.id}/mastery`);
    check(peek.status === 403 || peek.status === 401,
      "one pupil cannot read another pupil's map", `got ${peek.status}`);
    await teacher.delete(`/api/students/${other.id}`);
  }

  const teacherView = await teacher.get(`/api/students/${child.id}/mastery`);
  check(teacherView.body?.success === true, "a teacher can read a pupil's map",
    `status ${teacherView.status}`);

  const anon = await new Session().get(`/api/students/${child.id}/mastery`);
  check(anon.status === 401, "a logged-out caller cannot", `got ${anon.status}`);

  // =======================================================================
  section("The class view a teacher sees");
  // =======================================================================
  //
  // The one thing this view must not do is hide a split class. So two topics
  // are built that BOTH sit at 50% for the class as a whole — one where every
  // child is at 50%, and one where half the class has it perfectly and half has
  // none of it. The average cannot tell them apart. The spread must.

  const classForm = "Stage 5";
  const kidA = (await teacher.post("/api/students", {
    studentId: `MC-A${stamp}`, fullName: `Class Mastery A ${stamp}`,
    gender: "Female", form: classForm,
  })).body?.student;
  const kidB = (await teacher.post("/api/students", {
    studentId: `MC-B${stamp}`, fullName: `Class Mastery B ${stamp}`,
    gender: "Male", form: classForm,
  })).body?.student;
  check(!!kidA && !!kidB, "two pupils are created in one class");

  const classPapers: any[] = [];
  if (kidA && kidB) {
    const splitQs = [q("s1", 2, 2), q("s2", 3, 3), q("s3", 4, 4), q("s4", 5, 5)];
    const togetherQs = [q("t1", 2, 2), q("t2", 3, 3), q("t3", 4, 4), q("t4", 5, 5)];
    const strongQs = [q("g1", 2, 2), q("g2", 3, 3), q("g3", 4, 4), q("g4", 5, 5)];

    const mk = (subject: string, topic: string, title: string, questions: any[]) => ({
      subject, topic, form: classForm, title,
      instructions: "Answer all questions.",
      dueDate: "2026-12-01", totalMarks: questions.length, createdById: 1, questions,
    });

    const splitPaper = (await teacher.post("/api/assignments",
      mk("MATHS", `Split ${stamp}`, `Split paper ${stamp}`, splitQs))).body?.assignment;
    const togetherPaper = (await teacher.post("/api/assignments",
      mk("SCIENCE", `Together ${stamp}`, `Together paper ${stamp}`, togetherQs))).body?.assignment;
    const strongPaper = (await teacher.post("/api/assignments",
      mk("ENGLISH", `Strong ${stamp}`, `Strong paper ${stamp}`, strongQs))).body?.assignment;
    classPapers.push(splitPaper, togetherPaper, strongPaper);

    const sessionFor = async (kid: any, password: string) => {
      const sess = new Session();
      await sess.post("/api/auth/student/login", { fullName: kid.fullName, password });
      return sess;
    };
    const aSess = await sessionFor(kidA, "classpw1");
    const bSess = await sessionFor(kidB, "classpw2");

    // Split: A gets everything, B gets nothing. Class lands on 50%.
    await aSess.post("/api/submissions", {
      assignmentId: splitPaper.id, studentId: kidA.id, answers: answers(splitQs, 4),
    });
    await bSess.post("/api/submissions", {
      assignmentId: splitPaper.id, studentId: kidB.id, answers: answers(splitQs, 0),
    });

    // Together: both get half. Class lands on 50% as well.
    await aSess.post("/api/submissions", {
      assignmentId: togetherPaper.id, studentId: kidA.id, answers: answers(togetherQs, 2),
    });
    await bSess.post("/api/submissions", {
      assignmentId: togetherPaper.id, studentId: kidB.id, answers: answers(togetherQs, 2),
    });

    // Strong: both get everything.
    await aSess.post("/api/submissions", {
      assignmentId: strongPaper.id, studentId: kidA.id, answers: answers(strongQs, 4),
    });
    await bSess.post("/api/submissions", {
      assignmentId: strongPaper.id, studentId: kidB.id, answers: answers(strongQs, 4),
    });

    const classRes = await teacher.get(`/api/reports/mastery?form=${encodeURIComponent(classForm)}`);
    check(classRes.body?.success === true, "a teacher can read the class view", `status ${classRes.status}`);
    const cm = classRes.body?.mastery;

    const classTopic = (name: string) =>
      (cm?.topics || []).find((t: any) => t.topic === name);

    const split = classTopic(`Split ${stamp}`);
    const together = classTopic(`Together ${stamp}`);
    const strong = classTopic(`Strong ${stamp}`);

    check(!!split && !!together && !!strong, "all three topics appear for the class");

    // --- The two 50%s that mean completely different things --------------
    check(split?.percent === 50, "the split topic reads 50% for the class", String(split?.percent));
    check(together?.percent === 50, "and so does the even topic", String(together?.percent));

    check(split?.mastered === 1 && split?.practise === 1,
      "but the SPREAD shows the split: one pupil has it, one does not",
      JSON.stringify({ m: split?.mastered, d: split?.developing, p: split?.practise }));
    check(together?.developing === 2 && together?.mastered === 0 && together?.practise === 0,
      "while the even topic shows both pupils in the same band",
      JSON.stringify({ m: together?.mastered, d: together?.developing, p: together?.practise }));

    check(split?.children === 2 && together?.children === 2,
      "both topics count both pupils");

    // --- Weakest first ---------------------------------------------------
    const mineInOrder = (cm?.topics || [])
      .filter((t: any) => t.topic.endsWith(stamp))
      .map((t: any) => t.percent);
    check(
      mineInOrder.every((p: number, i: number) => i === 0 || mineInOrder[i - 1] <= p),
      "the class list is WEAKEST first — the opposite of a child's own map",
      JSON.stringify(mineInOrder),
    );
    check(strong?.percent === 100 && mineInOrder[mineInOrder.length - 1] === 100,
      "so the topic they have all mastered is last");

    // --- The teacher's figure IS the children's figure -------------------
    const aMap = (await teacher.get(`/api/students/${kidA.id}/mastery`)).body?.mastery;
    const aSplit = (aMap?.subjects || []).flatMap((x: any) => x.topics)
      .find((t: any) => t.topic === `Split ${stamp}`);
    check(aSplit?.percent === 100,
      "pupil A's own map shows the split topic at 100%", String(aSplit?.percent));
    check(aSplit?.band === "mastered",
      "and counts towards the class's 'mastered' tally", aSplit?.band);

    // --- Who needs a hand ------------------------------------------------
    const support = (cm?.needSupport || []);
    const bSupport = support.find((c: any) => c.studentId === kidB.id);
    const aSupport = support.find((c: any) => c.studentId === kidA.id);
    check(!!bSupport, "the pupil who got nothing right is flagged for support");
    check(!aSupport, "and the pupil who did well is not");
    check((bSupport?.topics || []).some((t: any) => t.topic === `Split ${stamp}`),
      "with the topic they are stuck on named",
      JSON.stringify(bSupport?.topics));
    check(!(bSupport?.topics || []).some((t: any) => t.topic === `Strong ${stamp}`),
      "and a topic they have mastered is not held against them");

    check(cm?.children >= 2, "the class total counts the pupils on the register",
      String(cm?.children));
    check(cm?.withWork >= 2, "and how many have marked work", String(cm?.withWork));

    // --- Teacher-only ----------------------------------------------------
    // It names children and says what each is weakest at.
    const pupilPeek = await aSess.get(`/api/reports/mastery?form=${encodeURIComponent(classForm)}`);
    check(pupilPeek.status === 401 || pupilPeek.status === 403,
      "a pupil cannot read the class view", `got ${pupilPeek.status}`);
    const anonPeek = await new Session().get(`/api/reports/mastery?form=${encodeURIComponent(classForm)}`);
    check(anonPeek.status === 401, "nor can a logged-out caller", `got ${anonPeek.status}`);

    const noForm = await teacher.get(`/api/reports/mastery`);
    check(noForm.status === 400, "asking without a class is refused", `got ${noForm.status}`);
  }

  for (const a of classPapers) if (a) await teacher.delete(`/api/assignments/${a.id}`);
  if (kidA) await teacher.delete(`/api/students/${kidA.id}`);
  if (kidB) await teacher.delete(`/api/students/${kidB.id}`);

  // --- Tidy up ----------------------------------------------------------
  for (const a of Object.values(created)) {
    if (a) await teacher.delete(`/api/assignments/${a.id}`);
  }
  await teacher.delete(`/api/students/${child.id}`);
  console.log("\nTest pupils and assignments removed.");

  finish();
}

function finish() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  // Never process.exit(): it tears down open sockets and reports a green run
  // as a failure. See the note in CLAUDE.md.
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
