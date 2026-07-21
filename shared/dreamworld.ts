// Dream World — a town-building reward game for primary students (Stages 3-6).
//
// Shared, framework-free definitions used by BOTH the client (to draw the build
// menu and validate taps) and the server (to validate placements and deduct
// resources authoritatively). Keeping the numbers here means the two sides can
// never disagree about a cost or the grid size.
//
// This module knows nothing about auto-marking, XP, or streaks — Dream World is
// built on top of them, never inside them.

// The plot is a fixed 8x8 grid of land tiles.
export const GRID_SIZE = 8;

// The four resources a student can hold. Buildings cost some of coins/bricks/
// wood; gems are earned from high scores and (in a later session) spend on
// special things. Order here is the order shown in the wallet.
export type ResourceKey = "coins" | "bricks" | "wood" | "gems";

export interface Wallet {
  coins: number;
  bricks: number;
  wood: number;
  gems: number;
}

// The little icons used for the wallet counts and payouts (kept together so the
// same symbols are used everywhere).
export const RESOURCE_ICON: Record<ResourceKey, string> = {
  coins: "🪙",
  bricks: "🧱",
  wood: "🪵",
  gems: "💎",
};

// ---------------------------------------------------------------------------
// Payouts — earned when a primary student completes an auto-marked assignment.
// Awarded through the same best-effort path as XP, so a failure never blocks
// the submission.
// ---------------------------------------------------------------------------
export const BASE_PAYOUT = { coins: 30, bricks: 20, wood: 20 } as const;

// Bonus gems for a strong score: 2 for a perfect 100%, 1 for 80%+.
export function gemsForPercent(percent: number): number {
  if (percent >= 100) return 2;
  if (percent >= 80) return 1;
  return 0;
}

export interface Payout extends Wallet {}

// The full payout (base resources + score gems) for a completed assignment.
export function payoutForPercent(percent: number): Payout {
  return { ...BASE_PAYOUT, gems: gemsForPercent(percent) };
}

// ---------------------------------------------------------------------------
// Buildings — the five starter items in the build menu.
// ---------------------------------------------------------------------------
export type BuildingId = "house" | "tree" | "road" | "flower" | "field";

export interface BuildingDef {
  id: BuildingId;
  name: string;
  size: 1 | 2;                 // footprint: 1 = one tile, 2 = a 2x2 block
  cost: Partial<Wallet>;       // what it costs to place (coins/bricks/wood)
}

export const BUILDINGS: BuildingDef[] = [
  { id: "house",  name: "Small House",    size: 1, cost: { coins: 40, bricks: 30 } },
  { id: "tree",   name: "Tree",           size: 1, cost: { wood: 10 } },
  { id: "road",   name: "Road",           size: 1, cost: { bricks: 5 } },
  { id: "flower", name: "Flower Patch",   size: 1, cost: { coins: 5 } },
  { id: "field",  name: "Football Field", size: 2, cost: { coins: 60, wood: 40 } },
];

export function buildingById(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

// A placed building: the building id and the top-left tile it sits on.
export interface Placed {
  id: BuildingId;
  x: number; // column 0..GRID_SIZE-1
  y: number; // row 0..GRID_SIZE-1
}

// Every tile a building covers, given its top-left anchor. A size-1 building
// covers one tile; a size-2 (football field) covers a 2x2 block.
export function footprint(x: number, y: number, size: 1 | 2): { x: number; y: number }[] {
  if (size === 1) return [{ x, y }];
  return [
    { x, y }, { x: x + 1, y },
    { x, y: y + 1 }, { x: x + 1, y: y + 1 },
  ];
}

// True if the whole footprint fits inside the grid.
export function inBounds(x: number, y: number, size: 1 | 2): boolean {
  return footprint(x, y, size).every(
    (c) => c.x >= 0 && c.y >= 0 && c.x < GRID_SIZE && c.y < GRID_SIZE,
  );
}

// The set of "col,row" keys occupied by a layout — used to check a tile is free
// before placing, and to find which building a tapped tile belongs to.
export function occupiedCells(layout: Placed[]): Map<string, Placed> {
  const map = new Map<string, Placed>();
  for (const b of layout) {
    const def = buildingById(b.id);
    const size = def?.size ?? 1;
    for (const c of footprint(b.x, b.y, size)) {
      map.set(`${c.x},${c.y}`, b);
    }
  }
  return map;
}

// Can this wallet afford a cost? (gems are never a building cost.)
export function canAfford(wallet: Wallet, cost: Partial<Wallet>): boolean {
  return (
    wallet.coins >= (cost.coins ?? 0) &&
    wallet.bricks >= (cost.bricks ?? 0) &&
    wallet.wood >= (cost.wood ?? 0)
  );
}

// Removing a building refunds half of what it cost (rounded down).
export function refundOf(cost: Partial<Wallet>): Partial<Wallet> {
  return {
    coins: Math.floor((cost.coins ?? 0) / 2),
    bricks: Math.floor((cost.bricks ?? 0) / 2),
    wood: Math.floor((cost.wood ?? 0) / 2),
  };
}

// True when the student cannot afford ANY building — used to show the friendly
// "go earn more" nudge.
export function canAffordAnything(wallet: Wallet): boolean {
  return BUILDINGS.some((b) => canAfford(wallet, b.cost));
}
