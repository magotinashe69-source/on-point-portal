// Dream World — Session 1 end-to-end test.
//
// Exercises the whole loop for a fake Stage 3 student against the RUNNING dev
// server: complete assignments -> receive resources -> place/remove buildings ->
// reload to confirm the town persists. Also confirms a Form 2 (secondary)
// student is blocked (403) and never sees any of it.
//
// Usage:
//   1. Terminal A:  npm run dev
//   2. Terminal B:  npx tsx script/test-dreamworld.ts
//
// It seeds its own Stage 3 student + auto-marked assignments (there are none in
// the default data), and resets that student's wallet each run so results are
// deterministic. It touches only its own test student.

import { storage } from "../server/storage";
import { BUILDINGS } from "../shared/dreamworld";

const BASE = "http://localhost:5000";
const TEACHER_EMAILS = ["onpointeducationcentremoza@gmail.com", "onpointeducationcentre@gmail.com"];

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
function eqWallet(w: any, coins: number, bricks: number, wood: number, gems: number) {
  return w && w.coins === coins && w.bricks === bricks && w.wood === wood && w.gems === gems;
}
const show = (w: any) => `🪙${w?.coins} 🧱${w?.bricks} 🪵${w?.wood} 💎${w?.gems}`;

async function http(method: string, path: string, body?: any) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function main() {
  console.log("Dream World — Session 1 test\n");

  // --- Seed: a fake Stage 3 student and a teacher to own assignments ---
  let teacher;
  for (const email of TEACHER_EMAILS) {
    teacher = await storage.getTeacherByEmail(email);
    if (teacher) break;
  }
  if (!teacher) { console.error("No seeded teacher found — is the app seeded?"); process.exit(1); }

  let student = await storage.getStudentByStudentId("S3-DREAM");
  if (!student) {
    student = await storage.createStudent({
      studentId: "S3-DREAM", fullName: "Dreamer Test", gender: "Female", form: "Stage 3", role: "student",
    });
  }
  const form2 = (await storage.getStudentsByForm("Form 2"))[0];

  // Reset this student's wallet + town so the run is deterministic.
  if (await storage.getDreamWorld(student.id)) {
    await storage.updateDreamWorld(student.id, { coins: 0, bricks: 0, wood: 0, gems: 0, layout: "[]" });
  }
  console.log(`Test student: #${student.id} ${student.fullName} (${student.form})`);
  console.log(`Form 2 control: #${form2?.id} ${form2?.fullName} (${form2?.form})\n`);

  // Helper: create a fresh auto-marked Stage 3 assignment and complete it 100%.
  async function completeOneAssignment(n: number) {
    const questions = [
      { id: "q1", questionText: "2 + 2 = ?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 },
      { id: "q2", questionText: "The sun is a star.", maxScore: 1, type: "true_false", correctBool: true },
    ];
    const assignment = await storage.createAssignment({
      subject: "Maths", form: "Stage 3", title: `Dream World Test #${n}-${Date.now()}`,
      instructions: "Auto-marked test assignment.", questions: questions as any,
      dueDate: "2027-01-01", totalMarks: 2, createdById: teacher!.id,
    });
    const r = await http("POST", "/api/submissions", {
      assignmentId: assignment.id, studentId: student!.id,
      answers: [{ questionId: "q1", answerText: "4" }, { questionId: "q2", answerText: "true" }],
    });
    return r;
  }

  // === 1. Complete an assignment -> receive resources ===
  console.log("1) Complete an assignment (100%) — receive resources");
  const first = await completeOneAssignment(1);
  check("submission succeeded", first.json?.success === true, first.json?.message || "");
  check("scored 100% (2/2)", first.json?.mark?.totalScore === 2);
  check("payout is 🪙30 🧱20 🪵20 💎2 (100% => 2 gems)",
    eqWallet(first.json?.resources, 30, 20, 20, 2), show(first.json?.resources));

  // Complete three more so we can afford the bigger builds (all via the real path).
  for (let i = 2; i <= 4; i++) await completeOneAssignment(i);
  const afterEarning = await http("GET", `/api/students/${student.id}/dreamworld`);
  console.log(`   wallet after 4 completions: ${show(afterEarning.json?.wallet)}`);
  check("wallet accumulated to 🪙120 🧱80 🪵80 💎8",
    eqWallet(afterEarning.json?.wallet, 120, 80, 80, 8), show(afterEarning.json?.wallet));

  // === 2. Place buildings -> resources deduct ===
  console.log("\n2) Place buildings — resources deduct, layout grows");
  const house = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "house", x: 0, y: 0 });
  check("placed Small House at (0,0)", house.json?.success === true, house.json?.message || "");
  check("wallet after house = 🪙80 🧱50 🪵80 💎8 (-40c -30b)", eqWallet(house.json?.wallet, 80, 50, 80, 8), show(house.json?.wallet));

  const field = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "field", x: 2, y: 2 });
  check("placed Football Field (2x2) at (2,2)", field.json?.success === true, field.json?.message || "");
  check("wallet after field = 🪙20 🧱50 🪵40 💎8 (-60c -40w)", eqWallet(field.json?.wallet, 20, 50, 40, 8), show(field.json?.wallet));

  const tree = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "tree", x: 5, y: 5 });
  check("placed Tree at (5,5)", tree.json?.success === true, tree.json?.message || "");
  check("layout now has 3 buildings", field.json && tree.json?.layout?.length === 3, `len=${tree.json?.layout?.length}`);

  // === 3. Validation guards ===
  console.log("\n3) Placement rules");
  const onField = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "flower", x: 3, y: 3 });
  check("cannot build on a tile the field covers (400)", onField.status === 400, onField.json?.message || "");
  const oob = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "field", x: 7, y: 7 });
  check("cannot place a 2x2 off the edge (400)", oob.status === 400, oob.json?.message || "");
  const tooExpensive = await http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: "field", x: 6, y: 0 });
  check("cannot afford a second field (400)", tooExpensive.status === 400, tooExpensive.json?.message || "");

  // === 4. Remove a building -> half refund ===
  console.log("\n4) Remove a building — half refund");
  const remove = await http("POST", `/api/students/${student.id}/dreamworld/remove`, { x: 0, y: 0 });
  check("removed the house", remove.json?.success === true, remove.json?.message || "");
  check("refunded half (🪙+20 🧱+15) => 🪙40 🧱65 🪵30 💎8", eqWallet(remove.json?.wallet, 40, 65, 30, 8), show(remove.json?.wallet));
  check("layout back to 2 buildings", remove.json?.layout?.length === 2);

  // === 5. Persistence — reload from a fresh request ===
  console.log("\n5) Persistence — reload the plot");
  const reload = await http("GET", `/api/students/${student.id}/dreamworld`);
  const ids = (reload.json?.layout ?? []).map((b: any) => `${b.id}@${b.x},${b.y}`).sort();
  check("town reloads exactly as left (field + tree)",
    JSON.stringify(ids) === JSON.stringify(["field@2,2", "tree@5,5"]), ids.join(" "));
  check("wallet persists at 🪙40 🧱65 🪵30 💎8", eqWallet(reload.json?.wallet, 40, 65, 30, 8), show(reload.json?.wallet));

  // === 6. A Form 2 student is blocked ===
  console.log("\n6) Secondary (Form 2) student is blocked");
  const f2get = await http("GET", `/api/students/${form2.id}/dreamworld`);
  check("GET dreamworld -> 403 for Form 2", f2get.status === 403, f2get.json?.message || "");
  const f2place = await http("POST", `/api/students/${form2.id}/dreamworld/place`, { buildingId: "tree", x: 0, y: 0 });
  check("POST place -> 403 for Form 2", f2place.status === 403, f2place.json?.message || "");

  console.log(`\n${failures === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${failures} check(s) failed.\x1b[0m`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
