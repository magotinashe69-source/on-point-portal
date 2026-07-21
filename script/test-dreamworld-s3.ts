// Dream World — Session 3 end-to-end test.
//
// Verifies town identity, visiting, class isolation, and Town Awards against the
// RUNNING dev server:
//   * naming a town (and a blocked rude word + once-a-week cooldown),
//   * visiting a same-class classmate's town (read-only data),
//   * cross-class and Forms visibility blocked (403),
//   * a teacher running Term Awards for a few fake students, then the award +
//     certificate data appearing on each child's town.
//
// Usage:
//   1. Terminal A:  npm run dev
//   2. Terminal B:  npx tsx script/test-dreamworld-s3.ts
//
// It creates fresh students in Stage 5 (the visiting class) and Stage 6 (a
// different class) each run, so runs never interfere.

import { storage } from "../server/storage";

const BASE = "http://localhost:5000";
const TEACHER_EMAIL = "onpointeducationcentremoza@gmail.com";
const TEACHER_PASSWORD = "onpoint123";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function http(method: string, path: string, body?: any, cookie?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json, res };
}

async function main() {
  console.log("Dream World — Session 3 test\n");

  const teacher = await storage.getTeacherByEmail(TEACHER_EMAIL);
  if (!teacher) { console.error("No seeded teacher."); process.exit(1); }
  const stamp = Date.now();

  // A visiting class (Stage 5) with three towns, and a different class (Stage 6).
  const mk = async (form: string, name: string, tag: string) =>
    storage.createStudent({ studentId: `S3T-${tag}-${stamp}`, fullName: name, gender: "Female", form, role: "student" });
  const A = await mk("Stage 5", "Ava Stone", "A");
  const B = await mk("Stage 5", "Ben Rivers", "B");
  const C = await mk("Stage 5", "Cara Hill", "C");
  const D = await mk("Stage 6", "Dan Frost", "D"); // different class
  const form2 = (await storage.getStudentsByForm("Form 2"))[0];
  console.log(`Class Stage 5: A#${A.id} Ava, B#${B.id} Ben, C#${C.id} Cara`);
  console.log(`Other class Stage 6: D#${D.id} Dan • Form 2: #${form2?.id} ${form2?.fullName}\n`);

  // ---- fund + build helpers ----
  async function fund(studentId: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = await storage.createAssignment({
        subject: "Maths", form: (await storage.getStudent(studentId))!.form, title: `Fund ${stamp}-${studentId}-${i}`,
        instructions: "auto", questions: [{ id: "q1", questionText: "2+2?", maxScore: 1, type: "numeric", correctNumber: 4, tolerance: 0 }] as any,
        dueDate: "2027-01-01", totalMarks: 1, createdById: teacher!.id, targetStudentIds: [studentId] as any,
      });
      await http("POST", "/api/submissions", { assignmentId: a.id, studentId, answers: [{ questionId: "q1", answerText: "4" }] });
    }
  }
  const place = (sid: number, buildingId: string, x: number, y: number) =>
    http("POST", `/api/students/${sid}/dreamworld/place`, { buildingId, x, y });

  // Build three distinct towns: Ava grandest (3), Ben greenest (2 trees), Cara best-planned (1 road).
  await fund(A.id, 4); await place(A.id, "house", 0, 0); await place(A.id, "house", 1, 0); await place(A.id, "road", 2, 0);
  await fund(B.id, 1); await place(B.id, "tree", 0, 0); await place(B.id, "tree", 1, 0);
  await fund(C.id, 1); await place(C.id, "road", 0, 0);

  // === 1. Naming a town ===
  console.log("1) Naming a town");
  const name1 = await http("POST", `/api/students/${A.id}/dreamworld/name`, { name: "Sunny Ville" });
  check("Ava names her town 'Sunny Ville'", name1.json?.success === true && name1.json?.townName === "Sunny Ville", name1.json?.message || "");
  const rude = await http("POST", `/api/students/${B.id}/dreamworld/name`, { name: "Damn City" });
  check("rude name is blocked (400)", rude.status === 400, rude.json?.message || "");
  const good = await http("POST", `/api/students/${B.id}/dreamworld/name`, { name: "Green Haven" });
  check("Ben names his town 'Green Haven'", good.json?.success === true && good.json?.townName === "Green Haven", good.json?.message || "");
  const rename = await http("POST", `/api/students/${A.id}/dreamworld/name`, { name: "Rename Too Soon" });
  check("renaming again within a week is blocked (400)", rename.status === 400, rename.json?.message || "");
  const banner = await http("GET", `/api/students/${A.id}/dreamworld`);
  check("town banner shows name + mayor + founded",
    banner.json?.townName === "Sunny Ville" && banner.json?.mayorFirstName === "Ava" && !!banner.json?.foundedAt,
    `${banner.json?.townName} • Mayor ${banner.json?.mayorFirstName}`);

  // === 2. Visit a same-class town (read-only) ===
  console.log("\n2) Visit a classmate's town (same class, read-only)");
  const neighbours = await http("GET", `/api/students/${A.id}/dreamworld/neighbours`);
  const ids = (neighbours.json?.neighbours ?? []).map((n: any) => n.studentId);
  check("Ava sees classmates Ben and Cara", ids.includes(B.id) && ids.includes(C.id), ids.join(","));
  check("Ava does NOT see Dan (different class)", !ids.includes(D.id));
  const view = await http("GET", `/api/students/${A.id}/dreamworld/town/${B.id}`);
  check("Ava can view Ben's town", view.json?.success === true, view.json?.message || "");
  check("Ben's town is Green Haven with 2 trees (view-only data)",
    view.json?.town?.townName === "Green Haven" && view.json?.town?.layout?.length === 2 && view.json?.town?.mayorFirstName === "Ben",
    `${view.json?.town?.townName}, ${view.json?.town?.layout?.length} buildings`);

  // === 3. Cross-class and Forms are blocked ===
  console.log("\n3) Cross-class and Forms visibility blocked");
  const crossClass = await http("GET", `/api/students/${A.id}/dreamworld/town/${D.id}`);
  check("viewing a different class (Stage 6) is blocked (403)", crossClass.status === 403, crossClass.json?.message || "");
  const viewForm2 = await http("GET", `/api/students/${A.id}/dreamworld/town/${form2.id}`);
  check("viewing a Form (secondary) town is blocked (403)", viewForm2.status === 403, viewForm2.json?.message || "");
  const form2Neighbours = await http("GET", `/api/students/${form2.id}/dreamworld/neighbours`);
  check("a Form 2 student can't list towns (403)", form2Neighbours.status === 403, form2Neighbours.json?.message || "");
  const form2World = await http("GET", `/api/students/${form2.id}/dreamworld`);
  check("a Form 2 student has no Dream World (403)", form2World.status === 403, form2World.json?.message || "");

  // === 4. Teacher runs Term Awards, then certificate data appears ===
  console.log("\n4) Teacher runs Term Awards");
  const noAuth = await http("POST", "/api/teacher/dream-world/awards", { term: "Term 3 2026" });
  check("awards endpoint requires a teacher login (401)", noAuth.status === 401, `status ${noAuth.status}`);
  const login = await http("POST", "/api/auth/teacher/login", { email: TEACHER_EMAIL, password: TEACHER_PASSWORD });
  const cookie = (login.res.headers.get("set-cookie") || "").split(";")[0];
  check("teacher logged in", login.json?.success === true && !!cookie);
  const run = await http("POST", "/api/teacher/dream-world/awards", { term: "Term 3 2026" }, cookie);
  check("Term Awards ran", run.json?.success === true, run.json?.message || "");
  const mine = (run.json?.results ?? []).filter((r: any) => [A.id, B.id, C.id].includes(r.studentId));
  const byId: Record<number, string> = {};
  for (const r of mine) byId[r.studentId] = r.award;
  console.log(`   awards → Ava: ${byId[A.id]}, Ben: ${byId[B.id]}, Cara: ${byId[C.id]}`);
  check("every one of the three towns won an award", !!byId[A.id] && !!byId[B.id] && !!byId[C.id]);

  // Certificate data (what the printable page renders) is on the child's town.
  const cert = await http("GET", `/api/students/${A.id}/dreamworld`);
  check("certificate data present (award + term + town name)",
    !!cert.json?.award && cert.json?.awardTerm === "Term 3 2026" && cert.json?.townName === "Sunny Ville",
    `${cert.json?.award} • ${cert.json?.awardTerm} • ${cert.json?.townName}`);

  console.log(`\n${failures === 0 ? "\x1b[32mAll checks passed.\x1b[0m" : `\x1b[31m${failures} check(s) failed.\x1b[0m`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
