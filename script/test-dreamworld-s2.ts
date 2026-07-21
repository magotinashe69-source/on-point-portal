// Dream World — Session 2 end-to-end test.
//
// Verifies the subject-unlock system against the RUNNING dev server:
//   * completing a 3rd Maths assignment unlocks the Bank (with a one-time
//     "just unlocked" celebration signal),
//   * a locked Science building shows the correct remaining count + hint,
//   * the balance guard rejects placing a locked building server-side,
//   * an overdue assignment appears in the state and clears once submitted,
//   * a Form 2 (secondary) student is blocked entirely.
//
// Usage:
//   1. Terminal A:  npm run dev
//   2. Terminal B:  npx tsx script/test-dreamworld-s2.ts
//
// It creates a FRESH Stage 3 student each run (so completion counts start at 0)
// and targets every assignment to that student, so runs never interfere.

import { storage } from "../server/storage";
import { remainingToUnlock, unlockHint, buildingById, isUnlocked, type Progress } from "../shared/dreamworld";

const BASE = "http://localhost:5000";
const TEACHER_EMAILS = ["onpointeducationcentremoza@gmail.com", "onpointeducationcentre@gmail.com"];

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function http(method: string, path: string, body?: any) {
  const res = await fetch(BASE + path, {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function main() {
  console.log("Dream World — Session 2 test\n");

  let teacher;
  for (const email of TEACHER_EMAILS) { teacher = await storage.getTeacherByEmail(email); if (teacher) break; }
  if (!teacher) { console.error("No seeded teacher found."); process.exit(1); }

  const stamp = Date.now();
  const student = await storage.createStudent({
    studentId: `S3-DW2-${stamp}`, fullName: "Dreamer Two", gender: "Male", form: "Stage 3", role: "student",
  });
  const form2 = (await storage.getStudentsByForm("Form 2"))[0];
  console.log(`Test student: #${student.id} ${student.fullName} (Stage 3)`);
  console.log(`Form 2 control: #${form2?.id} ${form2?.fullName}\n`);

  const get = async () => (await http("GET", `/api/students/${student.id}/dreamworld`)).json;

  // Create an auto-marked assignment targeted to this student and, unless
  // `dueDate` is overdue, complete it 100%.
  async function makeAssignment(subject: string, opts: { due?: string; title?: string } = {}) {
    return storage.createAssignment({
      subject, form: "Stage 3", title: opts.title ?? `${subject} ${stamp}-${Math.round(Math.random() * 1e6)}`,
      instructions: "auto-marked", questions: [{ id: "q1", questionText: "2+2?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 }] as any,
      dueDate: opts.due ?? "2027-01-01", totalMarks: 1, createdById: teacher!.id, targetStudentIds: [student.id] as any,
    });
  }
  async function complete(subject: string) {
    const a = await makeAssignment(subject);
    return http("POST", "/api/submissions", { assignmentId: a.id, studentId: student.id, answers: [{ questionId: "q1", answerText: "4" }] });
  }

  // === 1. Build a Maths streak to unlock the Bank at the 3rd completion ===
  console.log("1) Complete Maths assignments — Bank unlocks at the 3rd");
  await complete("Maths");
  let g = await get();
  check("after 1 Maths: progress.maths = 1", g.progress?.maths === 1, `maths=${g.progress?.maths}`);
  check("Bank still locked (justUnlocked empty)", (g.justUnlocked ?? []).length === 0);
  const earlyPlace = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "bank", x: 0, y: 0 });
  check("balance guard: placing the locked Bank is rejected (400)", earlyPlace.status === 400, earlyPlace.json?.message || "");

  await complete("Maths");
  g = await get();
  check("after 2 Maths: progress.maths = 2", g.progress?.maths === 2, `maths=${g.progress?.maths}`);

  await complete("Maths"); // the 3rd
  g = await get();
  check("after 3 Maths: progress.maths = 3", g.progress?.maths === 3, `maths=${g.progress?.maths}`);
  check("🎉 Bank is in justUnlocked (celebration)", (g.justUnlocked ?? []).includes("bank"), (g.justUnlocked ?? []).join(","));
  check("Bank now counts as unlocked", isUnlocked(buildingById("bank")!, g.progress as Progress));
  const g2 = await get();
  check("celebration is one-time (justUnlocked now empty)", (g2.justUnlocked ?? []).length === 0, (g2.justUnlocked ?? []).join(","));

  // === 2. A locked Science building shows the right remaining count + hint ===
  console.log("\n2) Locked Science building shows the correct remaining count");
  await complete("Science");
  g = await get();
  check("after 1 Science: progress.science = 1", g.progress?.science === 1, `science=${g.progress?.science}`);
  const lab = buildingById("laboratory")!;
  const remaining = remainingToUnlock(lab, g.progress as Progress);
  check("Laboratory needs 2 more (3 - 1)", remaining === 2, `remaining=${remaining}`);
  const hint = unlockHint(lab, g.progress as Progress);
  check('hint = "Complete 2 more Science assignments to unlock the Laboratory! 🔬"',
    hint === "Complete 2 more Science assignments to unlock the Laboratory! 🔬", hint);

  // === 3. Balance guard on other locked buildings ===
  console.log("\n3) Balance guard — locked buildings can't be placed");
  const placeLab = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "laboratory", x: 2, y: 2 });
  check("placing locked Laboratory rejected (400)", placeLab.status === 400, placeLab.json?.message || "");
  const placeEng = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "engineering", x: 4, y: 4 });
  check("placing locked Engineering Works (Tier 2, needs 8) rejected (400)", placeEng.status === 400, placeEng.json?.message || "");

  // === 4. Placing the now-unlocked Bank works and deducts ===
  console.log("\n4) Place the unlocked Bank");
  const before = await get(); // 4 completions => 🪙120 🧱80 🪵80 💎8
  check("wallet is 🪙120 🧱80 🪵80 💎8 after 4 completions",
    before.wallet?.coins === 120 && before.wallet?.bricks === 80 && before.wallet?.wood === 80 && before.wallet?.gems === 8,
    `🪙${before.wallet?.coins} 🧱${before.wallet?.bricks} 🪵${before.wallet?.wood} 💎${before.wallet?.gems}`);
  const bank = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "bank", x: 0, y: 0 });
  check("placed the Bank", bank.json?.success === true, bank.json?.message || "");
  check("wallet after Bank = 🪙40 🧱30 🪵80 💎8 (-80c -50b)",
    bank.json?.wallet?.coins === 40 && bank.json?.wallet?.bricks === 30 && bank.json?.wallet?.wood === 80 && bank.json?.wallet?.gems === 8,
    `🪙${bank.json?.wallet?.coins} 🧱${bank.json?.wallet?.bricks} 🪵${bank.json?.wallet?.wood} 💎${bank.json?.wallet?.gems}`);

  // === 5. Overdue lock appears, then clears when submitted ===
  console.log("\n5) Overdue lock appears and clears");
  const overdueAssignment = await makeAssignment("Art", { due: "2020-01-01", title: `Overdue Poster ${stamp}` });
  g = await get();
  check("overdue assignment is reported", g.overdue?.id === overdueAssignment.id, g.overdue?.title || "none");
  check("overdue names the assignment", g.overdue?.title === `Overdue Poster ${stamp}`, g.overdue?.title || "");
  // Submit it to clear the overdue lock.
  await http("POST", "/api/submissions", { assignmentId: overdueAssignment.id, studentId: student.id, answers: [{ questionId: "q1", answerText: "4" }] });
  g = await get();
  check("overdue clears once the assignment is submitted", g.overdue === null, JSON.stringify(g.overdue));

  // === 6. Form 2 sees nothing ===
  console.log("\n6) Secondary (Form 2) student is blocked");
  const f2 = await http("GET", `/api/students/${form2.id}/dreamworld`);
  check("GET dreamworld -> 403 for Form 2", f2.status === 403, f2.json?.message || "");

  console.log(`\n${failures === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${failures} check(s) failed.\x1b[0m`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
