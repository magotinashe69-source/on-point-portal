// Dream World — Session 4 end-to-end test (upgrades, decorations, plot expansion).
//
// Verifies against the RUNNING dev server:
//   * upgrading a building through its levels (scaling cost, town value grows,
//     max level enforced),
//   * decorations place but can't be upgraded,
//   * remove refunds half of everything invested (base + upgrades),
//   * plot expansion (8x8 -> 10x10) unlocks the far corner, once,
//   * Forms blocked from upgrade/expand.
//
// Usage:  npm run dev   then   npx tsx script/test-dreamworld-s4.ts

import { storage } from "../server/storage";
import { buildingById, buildingValue, levelOf, type Placed } from "../shared/dreamworld";

const BASE = "http://localhost:5000";
const TEACHER_EMAIL = "onpointeducationcentremoza@gmail.com";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function http(method: string, path: string, body?: any) {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function main() {
  console.log("Dream World — Session 4 test\n");
  const teacher = await storage.getTeacherByEmail(TEACHER_EMAIL);
  if (!teacher) { console.error("No seeded teacher."); process.exit(1); }
  const stamp = Date.now();
  const student = await storage.createStudent({ studentId: `S4-${stamp}`, fullName: "Upgrade Ursula", gender: "Female", form: "Stage 5", role: "student" });
  const form2 = (await storage.getStudentsByForm("Form 2"))[0];
  console.log(`Test student: #${student.id} (Stage 5) • Form 2 control: #${form2?.id}\n`);

  // Fund plenty (each 100% completion = 30c 20b 20w 2g).
  for (let i = 0; i < 15; i++) {
    const a = await storage.createAssignment({
      subject: "Maths", form: "Stage 5", title: `Fund ${stamp}-${i}`, instructions: "auto",
      questions: [{ id: "q1", questionText: "2+2?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 }] as any,
      dueDate: "2027-01-01", totalMarks: 1, createdById: teacher.id, targetStudentIds: [student.id] as any,
    });
    await http("POST", "/api/submissions", { assignmentId: a.id, studentId: student.id, answers: [{ questionId: "q1", answerText: "4" }] });
  }
  const get = async () => (await http("GET", `/api/students/${student.id}/dreamworld`)).json;
  const place = (id: string, x: number, y: number) => http("POST", `/api/students/${student.id}/dreamworld/place`, { buildingId: id, x, y });
  const upgrade = (x: number, y: number) => http("POST", `/api/students/${student.id}/dreamworld/upgrade`, { x, y });
  const levelAt = (layout: Placed[], x: number, y: number) => { const b = layout.find((p) => p.x === x && p.y === y); return b ? levelOf(b) : 0; };
  const houseValue = buildingValue(buildingById("house")!); // 70

  // === 1. Place + upgrade a house through its levels ===
  console.log("1) Build and upgrade a house");
  await place("house", 0, 0);
  let g = await get();
  check("house placed at Level 1", levelAt(g.layout, 0, 0) === 1);
  check(`town value = ${houseValue} (house L1)`, g.townValue === houseValue, `value=${g.townValue}`);

  const oobField = await place("field", 7, 7); // a 2x2 at (7,7) would spill off the 8x8 grid
  check("a 2x2 can't be placed at the 8x8 edge (400)", oobField.status === 400, oobField.json?.message || "");

  const before2 = (await get()).wallet;
  const up2 = await upgrade(0, 0);
  check("upgrade to Level 2 succeeds", up2.json?.success === true, up2.json?.message || "");
  g = await get();
  check("house is now Level 2", levelAt(g.layout, 0, 0) === 2);
  check("upgrade L1->L2 cost was base (-40c -30b)", before2.coins - g.wallet.coins === 40 && before2.bricks - g.wallet.bricks === 30, `Δcoins=${before2.coins - g.wallet.coins}`);
  check(`town value doubled to ${houseValue * 2}`, g.townValue === houseValue * 2, `value=${g.townValue}`);

  const before3 = g.wallet;
  await upgrade(0, 0);
  g = await get();
  check("house is now Level 3", levelAt(g.layout, 0, 0) === 3);
  check("upgrade L2->L3 cost was base×2 (-80c -60b)", before3.coins - g.wallet.coins === 80 && before3.bricks - g.wallet.bricks === 60, `Δcoins=${before3.coins - g.wallet.coins}`);
  check(`town value = ${houseValue * 3} (house L3)`, g.townValue === houseValue * 3, `value=${g.townValue}`);

  const upMax = await upgrade(0, 0);
  check("upgrading past max is blocked (400)", upMax.status === 400, upMax.json?.message || "");

  // === 2. Decorations place but never upgrade ===
  console.log("\n2) Decorations");
  const fence = await place("fence", 1, 0);
  check("fence (decoration) placed", fence.json?.success === true, fence.json?.message || "");
  const upFence = await upgrade(1, 0);
  check("a decoration can't be upgraded (400)", upFence.status === 400, upFence.json?.message || "");

  // === 3. Remove refunds half of everything invested ===
  console.log("\n3) Remove an upgraded building (half refund of base + upgrades)");
  const beforeRemove = (await get()).wallet;
  const rm = await http("POST", `/api/students/${student.id}/dreamworld/remove`, { x: 0, y: 0 });
  check("house removed", rm.json?.success === true);
  g = await get();
  // Invested at L3 = base×4 (160c/120b) → refund half = 80c/60b.
  check("refund was half of total invested (+80c +60b)", g.wallet.coins - beforeRemove.coins === 80 && g.wallet.bricks - beforeRemove.bricks === 60, `Δcoins=${g.wallet.coins - beforeRemove.coins}`);

  // === 4. Plot expansion ===
  console.log("\n4) Plot expansion (8x8 -> 10x10)");
  const farBefore = await place("house", 9, 9);
  check("corner (9,9) is out of bounds before expanding (400)", farBefore.status === 400, farBefore.json?.message || "");
  const beforeExpand = (await get()).wallet;
  const expand = await http("POST", `/api/students/${student.id}/dreamworld/expand`, {});
  check("plot expands", expand.json?.success === true && expand.json?.gridSize === 10, `gridSize=${expand.json?.gridSize}`);
  check("expansion cost deducted (-150c -100b -100w -2g)",
    beforeExpand.coins - expand.json.wallet.coins === 150 && beforeExpand.bricks - expand.json.wallet.bricks === 100 && beforeExpand.wood - expand.json.wallet.wood === 100 && beforeExpand.gems - expand.json.wallet.gems === 2);
  const farAfter = await place("house", 9, 9);
  check("corner (9,9) can be built after expanding", farAfter.json?.success === true, farAfter.json?.message || "");
  const expandAgain = await http("POST", `/api/students/${student.id}/dreamworld/expand`, {});
  check("can't expand twice (400)", expandAgain.status === 400, expandAgain.json?.message || "");

  // === 5. Forms blocked ===
  console.log("\n5) Forms blocked");
  const f2up = await http("POST", `/api/students/${form2.id}/dreamworld/upgrade`, { x: 0, y: 0 });
  check("Form 2 upgrade blocked (403)", f2up.status === 403);
  const f2ex = await http("POST", `/api/students/${form2.id}/dreamworld/expand`, {});
  check("Form 2 expand blocked (403)", f2ex.status === 403);

  console.log(`\n${failures === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${failures} check(s) failed.\x1b[0m`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
