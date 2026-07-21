// Dream World — server logic for the primary-only town-building game.
//
// Self-contained, like xp.ts / streaks.ts: it reads and writes the dream_world
// table (and reads submissions/assignments to count progress and find overdue
// work) and never modifies auto-marking, XP, or streaks. The server is the
// source of truth for the wallet AND for unlocks, so the browser can't cheat by
// editing resources or pretending a building is unlocked.

import { storage } from "./storage";
import type { DreamWorld, Student } from "@shared/schema";
import { isPrimaryForm, PRIMARY_FORMS } from "@shared/schema";
import {
  buildingById, canAfford, footprint, inBounds, occupiedCells,
  payoutForPercent, refundOf, subjectToCategory, unlockedIds, isUnlocked,
  cleanTownName, firstName, townMetrics, assignAwards, RENAME_COOLDOWN_MS,
  EMPTY_PROGRESS, type AwardId, type Payout, type Placed, type Progress, type Wallet,
} from "@shared/dreamworld";

async function loadOrCreate(studentId: number): Promise<DreamWorld> {
  let row = await storage.getDreamWorld(studentId);
  if (!row) {
    row = await storage.createDreamWorld({
      studentId, coins: 0, bricks: 0, wood: 0, gems: 0, layout: "[]", seenUnlocks: "",
      foundedAt: new Date().toISOString(),
    });
  }
  return row;
}

function parseLayout(raw: string): Placed[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Placed =>
        p && typeof p.x === "number" && typeof p.y === "number" && !!buildingById(p.id),
    );
  } catch {
    return [];
  }
}

function walletOf(row: DreamWorld): Wallet {
  return { coins: row.coins, bricks: row.bricks, wood: row.wood, gems: row.gems };
}

// Count a student's completed (submitted + marked) assignments per subject, and
// the grand total. This is computed from the real submissions/assignments each
// time, so it can never drift or be spoofed by the client.
export async function computeProgress(studentId: number): Promise<Progress> {
  const submissions = await storage.getSubmissions({ studentId });
  const marked = submissions.filter((s) => s.status === "MARKED");
  const p: Progress = { ...EMPTY_PROGRESS };
  for (const sub of marked) {
    p.total += 1;
    const assignment = await storage.getAssignment(sub.assignmentId);
    if (assignment) {
      const cat = subjectToCategory(assignment.subject);
      if (cat) p[cat] += 1;
    }
  }
  return p;
}

// Find one assignment that is overdue for this student: assigned to them, not
// archived, past its (possibly extended) due date, and not yet submitted.
export async function computeOverdue(student: Student): Promise<{ id: number; title: string } | null> {
  const assignments = await storage.getAssignments(student.form, student.id, false);
  const submissions = await storage.getSubmissions({ studentId: student.id });
  const submitted = new Set(submissions.map((s) => s.assignmentId));
  const now = Date.now();

  for (const a of assignments) {
    if (submitted.has(a.id)) continue;
    // A per-student extended deadline overrides the assignment due date.
    const ext = (a.extendedDeadlines ?? []).find((e) => e.studentId === student.id);
    const due = ext ? ext.newDueDate : a.dueDate;
    const dueMs = Date.parse(due);
    if (!Number.isNaN(dueMs) && dueMs < now) {
      return { id: a.id, title: a.title };
    }
  }
  return null;
}

export interface DreamState {
  wallet: Wallet;
  layout: Placed[];
  progress: Progress;
  overdue: { id: number; title: string } | null;
  justUnlocked: string[]; // buildings unlocked since the last visit (for the celebration)
  townName: string;
  mayorFirstName: string;
  foundedAt: string;
  canRename: boolean;     // false while the once-a-week cooldown is active
  award: string;          // current award id (or "")
  awardTerm: string;
  buildingCount: number;
}

// The full Dream World state for the plot screen. Also detects buildings that
// have become unlocked since the last visit (so the client can celebrate them
// once) and remembers that they've been shown.
export async function getState(student: Student): Promise<DreamState> {
  const row = await loadOrCreate(student.id);
  const progress = await computeProgress(student.id);
  const overdue = await computeOverdue(student);

  const unlocked = unlockedIds(progress);
  const seen = row.seenUnlocks ? row.seenUnlocks.split(",").filter(Boolean) : [];
  const justUnlocked = unlocked.filter((id) => !seen.includes(id));

  // Backfill a founding date for towns created before this existed.
  let foundedAt = row.foundedAt;
  const patch: Record<string, string> = {};
  if (!foundedAt) { foundedAt = new Date().toISOString(); patch.foundedAt = foundedAt; }
  if (justUnlocked.length > 0) patch.seenUnlocks = unlocked.join(",");
  if (Object.keys(patch).length > 0) await storage.updateDreamWorld(student.id, patch);

  const layout = parseLayout(row.layout);
  const canRename = !row.townNamedAt || (Date.now() - Date.parse(row.townNamedAt) >= RENAME_COOLDOWN_MS);

  return {
    wallet: walletOf(row), layout, progress, overdue, justUnlocked,
    townName: row.townName, mayorFirstName: firstName(student.fullName), foundedAt, canRename,
    award: row.award, awardTerm: row.awardTerm, buildingCount: layout.length,
  };
}

// Name (or rename) the town, once a week. Server-validated (length, allowed
// characters, blocked words) so the browser can't slip anything through.
export async function setTownName(
  student: Student, raw: string,
): Promise<{ ok: true; townName: string } | { ok: false; message: string }> {
  const cleaned = cleanTownName(raw);
  if (!cleaned.ok) return { ok: false, message: cleaned.message };
  const row = await loadOrCreate(student.id);
  if (row.townNamedAt && Date.now() - Date.parse(row.townNamedAt) < RENAME_COOLDOWN_MS) {
    return { ok: false, message: "You can rename your town once a week — try again in a few days!" };
  }
  await storage.updateDreamWorld(student.id, { townName: cleaned.value, townNamedAt: new Date().toISOString() });
  return { ok: true, townName: cleaned.value };
}

// Classmates in the SAME class (same form), with their town name and building
// count. The caller has already checked the requester is a primary student, and
// getStudentsByForm returns only the same class — so this never leaks other
// classes or Forms.
export interface Neighbour { studentId: number; firstName: string; townName: string; buildingCount: number; }

export async function getNeighbours(student: Student): Promise<Neighbour[]> {
  const classmates = await storage.getStudentsByForm(student.form);
  const out: Neighbour[] = [];
  for (const c of classmates) {
    if (c.id === student.id) continue;
    const row = await storage.getDreamWorld(c.id);
    const layout = row ? parseLayout(row.layout) : [];
    out.push({ studentId: c.id, firstName: firstName(c.fullName), townName: row?.townName || "", buildingCount: layout.length });
  }
  return out;
}

// A read-only view of another student's town — allowed ONLY when the target is
// a primary student in the SAME class as the viewer. No editing, no social
// features: just the town to look at.
export interface TownView {
  studentId: number;
  townName: string;
  mayorFirstName: string;
  foundedAt: string;
  layout: Placed[];
  award: string;
  buildingCount: number;
}

export async function getTownView(
  viewer: Student, targetId: number,
): Promise<{ ok: true; town: TownView } | { ok: false; code: number; message: string }> {
  const target = await storage.getStudent(targetId);
  if (!target) return { ok: false, code: 404, message: "Town not found." };
  if (!isPrimaryForm(target.form) || target.form !== viewer.form) {
    return { ok: false, code: 403, message: "You can only visit towns in your own class." };
  }
  const row = await storage.getDreamWorld(targetId);
  const layout = row ? parseLayout(row.layout) : [];
  return {
    ok: true,
    town: {
      studentId: targetId, townName: row?.townName || "", mayorFirstName: firstName(target.fullName),
      foundedAt: row?.foundedAt || "", layout, award: row?.award || "", buildingCount: layout.length,
    },
  };
}

// Teacher action: award one Town Award to every town, computed per class so each
// class has its own winners. Only students who have a town (a dream_world row)
// are awarded. Returns a summary for the teacher.
export interface AwardResult { studentId: number; form: string; firstName: string; townName: string; award: AwardId; }

export async function runTermAwards(term: string): Promise<AwardResult[]> {
  const now = Date.now();
  const results: AwardResult[] = [];

  for (const form of PRIMARY_FORMS) {
    const students = await storage.getStudentsByForm(form);
    const played: { student: Student; layout: Placed[] }[] = [];
    for (const s of students) {
      const row = await storage.getDreamWorld(s.id);
      if (!row) continue; // no town yet — nothing to award
      played.push({ student: s, layout: parseLayout(row.layout) });
    }
    if (played.length === 0) continue;

    const awards = assignAwards(played.map((p) => ({ studentId: p.student.id, metrics: townMetrics(p.layout, now) })));
    for (const p of played) {
      const award = (awards.get(p.student.id) ?? "happy") as AwardId;
      const updated = await storage.updateDreamWorld(p.student.id, { award, awardTerm: term });
      results.push({
        studentId: p.student.id, form, firstName: firstName(p.student.fullName),
        townName: updated.townName || "", award,
      });
    }
  }
  return results;
}

// Award resources for completing an assignment (base payout + score gems).
export async function awardResources(studentId: number, percent: number): Promise<Payout> {
  const row = await loadOrCreate(studentId);
  const payout = payoutForPercent(percent);
  await storage.updateDreamWorld(studentId, {
    coins: row.coins + payout.coins,
    bricks: row.bricks + payout.bricks,
    wood: row.wood + payout.wood,
    gems: row.gems + payout.gems,
  });
  return payout;
}

export type MutationResult =
  | { ok: true; wallet: Wallet; layout: Placed[] }
  | { ok: false; message: string };

// Place a building after checking it is unlocked, fits, the tiles are free, and
// the student can afford it. All four checks are authoritative here.
export async function placeBuilding(
  studentId: number, buildingId: string, x: number, y: number,
): Promise<MutationResult> {
  const def = buildingById(buildingId);
  if (!def) return { ok: false, message: "Unknown building." };
  if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, message: "Invalid tile." };

  const row = await loadOrCreate(studentId);
  const layout = parseLayout(row.layout);

  // Unlock check — computed from real completions, never trusted from the client.
  const progress = await computeProgress(studentId);
  if (!isUnlocked(def, progress)) return { ok: false, message: "That building isn't unlocked yet." };

  if (!inBounds(x, y, def.size)) return { ok: false, message: "That doesn't fit on the map." };

  const occupied = occupiedCells(layout);
  const overlaps = footprint(x, y, def.size).some((c) => occupied.has(`${c.x},${c.y}`));
  if (overlaps) return { ok: false, message: "That space is already taken." };

  const wallet = walletOf(row);
  if (!canAfford(wallet, def.cost)) return { ok: false, message: "Not enough resources yet." };

  const newLayout: Placed[] = [...layout, { id: def.id, x, y, placedAt: Date.now() }];
  const updated = await storage.updateDreamWorld(studentId, {
    coins: row.coins - (def.cost.coins ?? 0),
    bricks: row.bricks - (def.cost.bricks ?? 0),
    wood: row.wood - (def.cost.wood ?? 0),
    gems: row.gems - (def.cost.gems ?? 0),
    layout: JSON.stringify(newLayout),
  });
  return { ok: true, wallet: walletOf(updated), layout: newLayout };
}

// Remove whichever building covers tile (x, y), refunding half its cost.
export async function removeBuilding(
  studentId: number, x: number, y: number,
): Promise<MutationResult> {
  const row = await loadOrCreate(studentId);
  const layout = parseLayout(row.layout);

  const occupied = occupiedCells(layout);
  const target = occupied.get(`${x},${y}`);
  if (!target) return { ok: false, message: "Nothing to remove there." };

  const def = buildingById(target.id);
  const refund = def ? refundOf(def.cost) : { coins: 0, bricks: 0, wood: 0, gems: 0 };
  const newLayout = layout.filter((b) => !(b.x === target.x && b.y === target.y && b.id === target.id));

  const updated = await storage.updateDreamWorld(studentId, {
    coins: row.coins + refund.coins,
    bricks: row.bricks + refund.bricks,
    wood: row.wood + refund.wood,
    gems: row.gems + refund.gems,
    layout: JSON.stringify(newLayout),
  });
  return { ok: true, wallet: walletOf(updated), layout: newLayout };
}
