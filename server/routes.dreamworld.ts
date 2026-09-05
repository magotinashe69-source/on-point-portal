// Dream World — the retired town-building reward game (route layer).
//
// THIS FILE IS NOT WIRED UP. Nothing imports it, so none of these endpoints
// exist at runtime; requests to them are answered 410 Gone by the gate in
// routes.ts. It is kept, whole and working, so the game can be brought back
// without rewriting it.
//
// To restore Dream World:
//   1. Delete the 410 gate in server/routes.ts (search for "Dream World — RETIRED").
//   2. Import and call this from registerRoutes():
//        import { registerDreamWorldRoutes } from "./routes.dreamworld";
//        registerDreamWorldRoutes(app, { requireTeacherAuth, requirePrimaryStudent });
//   3. Put back the entry points in the student dashboard and App.tsx routes,
//      and the awardResources() call in the submission flow.
//
// Every endpoint is restricted to primary students (Stages 3-6); secondary
// Forms get a 403 and never see the game. Placement and resource spending are
// validated server-side, so the browser can't cheat.

import type { Express, Request, Response } from "express";
import type { Student } from "@shared/schema";
import {
  getState as getDreamState,
  placeBuilding,
  removeBuilding,
  upgradeBuilding,
  expandPlot,
  setTownName,
  getNeighbours,
  getTownView,
  runTermAwards,
  computeOverdue,
} from "./dreamworld";

// Both guards live in routes.ts, where the still-live rewards endpoint also
// uses the primary-class check. They are handed in rather than duplicated.
interface Deps {
  requireTeacherAuth: (req: Request, res: Response) => Promise<string | null>;
  requirePrimaryStudent: (studentId: number, res: Response) => Promise<Student | null>;
}

export function registerDreamWorldRoutes(app: Express, { requireTeacherAuth, requirePrimaryStudent }: Deps) {
  // The student's wallet and saved town layout.
  app.get("/api/students/:id/dreamworld", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), res);
      if (!student) return;
      const state = await getDreamState(student);
      res.json({ success: true, ...state });
    } catch (error) {
      console.error("Get Dream World error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Building is paused while the student has overdue homework. Enforced here on
  // the server (not just in the UI) so it can't be bypassed by calling the API
  // directly. Returns true and responds 403 when blocked.
  async function blockedByOverdue(student: Student, res: Response): Promise<boolean> {
    const overdue = await computeOverdue(student);
    if (overdue) {
      res.status(403).json({ success: false, message: "Finish your overdue homework before you build." });
      return true;
    }
    return false;
  }

  // Place a building. The server validates bounds, free tiles, and cost.
  app.post("/api/students/:id/dreamworld/place", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), res);
      if (!student) return;
      if (await blockedByOverdue(student, res)) return;
      const { buildingId, x, y } = req.body ?? {};
      const result = await placeBuilding(student.id, buildingId, x, y);
      if (!result.ok) return res.status(400).json({ success: false, message: result.message });
      res.json({ success: true, wallet: result.wallet, layout: result.layout });
    } catch (error) {
      console.error("Place building error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Remove the building on a tile (refunds half its cost).
  app.post("/api/students/:id/dreamworld/remove", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), res);
      if (!student) return;
      const { x, y } = req.body ?? {};
      const result = await removeBuilding(student.id, x, y);
      if (!result.ok) return res.status(400).json({ success: false, message: result.message });
      res.json({ success: true, wallet: result.wallet, layout: result.layout });
    } catch (error) {
      console.error("Remove building error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Upgrade the building on a tile to the next level.
  app.post("/api/students/:id/dreamworld/upgrade", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), res);
      if (!student) return;
      if (await blockedByOverdue(student, res)) return;
      const { x, y } = req.body ?? {};
      const result = await upgradeBuilding(student.id, x, y);
      if (!result.ok) return res.status(400).json({ success: false, message: result.message });
      res.json({ success: true, wallet: result.wallet, layout: result.layout });
    } catch (error) {
      console.error("Upgrade building error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Expand the plot (8x8 -> 10x10), once.
  app.post("/api/students/:id/dreamworld/expand", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), res);
      if (!student) return;
      if (await blockedByOverdue(student, res)) return;
      const result = await expandPlot(student.id);
      if (!result.ok) return res.status(400).json({ success: false, message: result.message });
      res.json({ success: true, wallet: result.wallet, gridSize: result.gridSize });
    } catch (error) {
      console.error("Expand plot error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Name (or rename) the town — once a week, server-validated.
  app.post("/api/students/:id/dreamworld/name", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), res);
      if (!student) return;
      const result = await setTownName(student, req.body?.name ?? "");
      if (!result.ok) return res.status(400).json({ success: false, message: result.message });
      res.json({ success: true, townName: result.townName });
    } catch (error) {
      console.error("Name town error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Classmates (same class only) to visit.
  app.get("/api/students/:id/dreamworld/neighbours", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), res);
      if (!student) return;
      res.json({ success: true, neighbours: await getNeighbours(student) });
    } catch (error) {
      console.error("Neighbours error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // View a classmate's town (read-only, same class only).
  app.get("/api/students/:id/dreamworld/town/:otherId", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), res);
      if (!student) return;
      const result = await getTownView(student, parseInt(req.params.otherId));
      if (!result.ok) return res.status(result.code).json({ success: false, message: result.message });
      res.json({ success: true, town: result.town });
    } catch (error) {
      console.error("View town error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Teacher action: run Town Awards for the term (one award per town, per class).
  app.post("/api/teacher/dream-world/awards", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;
      const raw = typeof req.body?.term === "string" ? req.body.term.trim() : "";
      const term = raw || "This Term";
      const results = await runTermAwards(term);
      res.json({ success: true, term, count: results.length, results });
    } catch (error) {
      console.error("Run term awards error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
}
