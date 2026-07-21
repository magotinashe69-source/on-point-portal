// Dream World — server logic for the primary-only town-building game.
//
// Self-contained, like xp.ts / streaks.ts / rewards.ts: it reads and writes the
// dream_world table and never touches auto-marking, XP, or streaks. Resource
// payouts are awarded best-effort by the submission handler (see routes.ts), and
// building placement is validated here so a client can never spend resources it
// does not have or drop a building off the grid / onto another.

import { storage } from "./storage";
import type { DreamWorld } from "@shared/schema";
import {
  BUILDINGS, buildingById, canAfford, footprint, inBounds, occupiedCells,
  payoutForPercent, refundOf, type Payout, type Placed, type Wallet,
} from "@shared/dreamworld";

// Load a student's Dream World row, creating an empty one the first time.
async function loadOrCreate(studentId: number): Promise<DreamWorld> {
  let row = await storage.getDreamWorld(studentId);
  if (!row) {
    row = await storage.createDreamWorld({
      studentId, coins: 0, bricks: 0, wood: 0, gems: 0, layout: "[]",
    });
  }
  return row;
}

// Parse the stored layout JSON defensively — a bad value must never throw.
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

export interface DreamState {
  wallet: Wallet;
  layout: Placed[];
}

// The wallet + town a student currently has.
export async function getState(studentId: number): Promise<DreamState> {
  const row = await loadOrCreate(studentId);
  return { wallet: walletOf(row), layout: parseLayout(row.layout) };
}

// Award resources for completing an assignment (base payout + score gems).
// Called best-effort from the submission handler; returns what was granted so
// the results screen / reward modal can show it.
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

// A place/remove result: either the new authoritative state, or a friendly
// reason it could not happen (translated to a 400 by the route).
export type MutationResult =
  | { ok: true; wallet: Wallet; layout: Placed[] }
  | { ok: false; message: string };

// Place a building at (x, y) after checking bounds, that the tiles are free,
// and that the student can afford it. Deducts the cost and saves the layout.
export async function placeBuilding(
  studentId: number, buildingId: string, x: number, y: number,
): Promise<MutationResult> {
  const def = buildingById(buildingId);
  if (!def) return { ok: false, message: "Unknown building." };
  if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, message: "Invalid tile." };

  const row = await loadOrCreate(studentId);
  const layout = parseLayout(row.layout);

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
  const refund = def ? refundOf(def.cost) : {};
  const newLayout = layout.filter((b) => !(b.x === target.x && b.y === target.y && b.id === target.id));

  const updated = await storage.updateDreamWorld(studentId, {
    coins: row.coins + (refund.coins ?? 0),
    bricks: row.bricks + (refund.bricks ?? 0),
    wood: row.wood + (refund.wood ?? 0),
    layout: JSON.stringify(newLayout),
  });
  return { ok: true, wallet: walletOf(updated), layout: newLayout };
}

// Re-exported so routes can keep the building list in one place if needed.
export { BUILDINGS };
