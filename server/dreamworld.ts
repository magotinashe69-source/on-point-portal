// Dream World — server logic for the primary-only town-building game.
//
// Self-contained, like xp.ts / streaks.ts: it reads and writes the dream_world
// table (and reads submissions/assignments to count progress and find overdue
// work) and never modifies auto-marking, XP, or streaks. The server is the
// source of truth for the wallet AND for unlocks, so the browser can't cheat by
// editing resources or pretending a building is unlocked.

import { storage } from "./storage";
import type { DreamWorld, Student } from "@shared/schema";
import {
  buildingById, canAfford, footprint, inBounds, occupiedCells,
  payoutForPercent, refundOf, subjectToCategory, unlockedIds, isUnlocked,
  EMPTY_PROGRESS, type Payout, type Placed, type Progress, type Wallet,
} from "@shared/dreamworld";

async function loadOrCreate(studentId: number): Promise<DreamWorld> {
  let row = await storage.getDreamWorld(studentId);
  if (!row) {
    row = await storage.createDreamWorld({
      studentId, coins: 0, bricks: 0, wood: 0, gems: 0, layout: "[]", seenUnlocks: "",
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
  if (justUnlocked.length > 0) {
    await storage.updateDreamWorld(student.id, { seenUnlocks: unlocked.join(",") });
  }

  return { wallet: walletOf(row), layout: parseLayout(row.layout), progress, overdue, justUnlocked };
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

  const newLayout = [...layout, { id: def.id, x, y }];
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
