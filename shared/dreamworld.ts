// Dream World — a town-building reward game for primary students (Stages 3-6).
//
// Shared, framework-free definitions used by BOTH the client (to draw the build
// menu / shop and show unlock hints) and the server (to validate placements,
// resource spending, and unlocks authoritatively). Keeping the numbers here
// means the two sides can never disagree.
//
// Session 2 adds a subject-unlock system: completing assignments in a subject
// unlocks that subject's buildings (Tier 1 at 3 completions, Tier 2 at 8), and
// a universal School unlocks at 15 completions across all subjects.
//
// This module knows nothing about auto-marking, XP, or streaks — Dream World is
// built on top of them, never inside them.

// The plot is a fixed 8x8 grid of land tiles.
export const GRID_SIZE = 8;

// The four resources a student can hold.
export type ResourceKey = "coins" | "bricks" | "wood" | "gems";

export interface Wallet {
  coins: number;
  bricks: number;
  wood: number;
  gems: number;
}

export const RESOURCE_ICON: Record<ResourceKey, string> = {
  coins: "🪙",
  bricks: "🧱",
  wood: "🪵",
  gems: "💎",
};

// ---------------------------------------------------------------------------
// Payouts — earned when a primary student completes an auto-marked assignment.
// ---------------------------------------------------------------------------
export const BASE_PAYOUT = { coins: 30, bricks: 20, wood: 20 } as const;

export function gemsForPercent(percent: number): number {
  if (percent >= 100) return 2;
  if (percent >= 80) return 1;
  return 0;
}

export interface Payout extends Wallet {}

export function payoutForPercent(percent: number): Payout {
  return { ...BASE_PAYOUT, gems: gemsForPercent(percent) };
}

// ---------------------------------------------------------------------------
// Subject categories and the unlock system.
// ---------------------------------------------------------------------------
export type Category = "starter" | "maths" | "english" | "science" | "computing" | "universal";

// Completions the student has, per subject, plus the grand total (all subjects).
export interface Progress {
  maths: number;
  english: number;
  science: number;
  computing: number;
  total: number;
}

export const EMPTY_PROGRESS: Progress = { maths: 0, english: 0, science: 0, computing: 0, total: 0 };

export const TIER1_REQUIRED = 3;   // completions in a subject to unlock its Tier 1 building
export const TIER2_REQUIRED = 8;   // ... and its Tier 2 building
export const SCHOOL_REQUIRED = 15; // total completions (any subject) to unlock the School

// Display label + a themed emoji for each category (used in unlock hints and
// the shop's group headers).
export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  starter:   { label: "Starter Kit",   emoji: "🏠" },
  maths:     { label: "Maths",         emoji: "🏦" },
  english:   { label: "English",       emoji: "📚" },
  science:   { label: "Science",       emoji: "🔬" },
  computing: { label: "Computing",     emoji: "🤖" },
  universal: { label: "School",        emoji: "🏫" },
};

// The display order of the shop's groups.
export const CATEGORY_ORDER: Category[] = ["starter", "maths", "english", "science", "computing", "universal"];

// Map an assignment's subject text to a category (or null for "other" subjects,
// which still count toward the total but unlock no specific building).
export function subjectToCategory(subject: string): Exclude<Category, "starter" | "universal"> | null {
  const s = (subject || "").toLowerCase();
  if (s.includes("math")) return "maths";
  if (s.includes("english")) return "english";
  if (s.includes("science")) return "science";
  if (s.includes("comput") || s.includes("ict")) return "computing";
  return null;
}

// ---------------------------------------------------------------------------
// Buildings — the five starters plus the Session 2 subject buildings.
// ---------------------------------------------------------------------------
export type BuildingId =
  | "house" | "tree" | "road" | "flower" | "field"
  | "bank" | "engineering"
  | "library" | "theatre"
  | "laboratory" | "hospital"
  | "robot_kiosk" | "robot_factory"
  | "school";

export interface BuildingDef {
  id: BuildingId;
  name: string;
  size: 1 | 2;                 // footprint: 1 = one tile, 2 = a 2x2 block
  cost: Partial<Wallet>;       // coins/bricks/wood and (Tier 2) gems
  category: Category;
  tier?: 1 | 2;                // subject/universal buildings only
}

export const BUILDINGS: BuildingDef[] = [
  // Starter kit — always available.
  { id: "house",  name: "Small House",    size: 1, cost: { coins: 40, bricks: 30 }, category: "starter" },
  { id: "tree",   name: "Tree",           size: 1, cost: { wood: 10 }, category: "starter" },
  { id: "road",   name: "Road",           size: 1, cost: { bricks: 5 }, category: "starter" },
  { id: "flower", name: "Flower Patch",   size: 1, cost: { coins: 5 }, category: "starter" },
  { id: "field",  name: "Football Field", size: 2, cost: { coins: 60, wood: 40 }, category: "starter" },

  // Maths.
  { id: "bank",        name: "Bank",              size: 1, cost: { coins: 80, bricks: 50 }, category: "maths", tier: 1 },
  { id: "engineering", name: "Engineering Works", size: 2, cost: { coins: 150, bricks: 80, gems: 2 }, category: "maths", tier: 2 },

  // English.
  { id: "library", name: "Library", size: 1, cost: { coins: 70, wood: 40 }, category: "english", tier: 1 },
  { id: "theatre", name: "Theatre", size: 2, cost: { coins: 140, bricks: 60, wood: 60, gems: 2 }, category: "english", tier: 2 },

  // Science.
  { id: "laboratory", name: "Laboratory", size: 1, cost: { coins: 80, wood: 50 }, category: "science", tier: 1 },
  { id: "hospital",   name: "Hospital",   size: 2, cost: { coins: 160, bricks: 80, gems: 2 }, category: "science", tier: 2 },

  // Computing / ICT.
  { id: "robot_kiosk",   name: "Robot Kiosk",   size: 1, cost: { coins: 60, bricks: 30 }, category: "computing", tier: 1 },
  { id: "robot_factory", name: "Robot Factory", size: 2, cost: { coins: 150, bricks: 70, wood: 70, gems: 2 }, category: "computing", tier: 2 },

  // Universal reward.
  { id: "school", name: "School", size: 2, cost: { coins: 200, bricks: 100, wood: 100, gems: 3 }, category: "universal", tier: 2 },
];

export function buildingById(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

export function buildingsInCategory(cat: Category): BuildingDef[] {
  return BUILDINGS.filter((b) => b.category === cat);
}

// How many completions a building needs (0 for starters).
export function requirementFor(def: BuildingDef): number {
  if (def.category === "starter") return 0;
  if (def.category === "universal") return SCHOOL_REQUIRED;
  return def.tier === 2 ? TIER2_REQUIRED : TIER1_REQUIRED;
}

// The count that matters for a building: its subject's count, or the grand
// total for the universal School.
export function countFor(def: BuildingDef, p: Progress): number {
  if (def.category === "starter") return 0;
  if (def.category === "universal") return p.total;
  return p[def.category];
}

export function isUnlocked(def: BuildingDef, p: Progress): boolean {
  return countFor(def, p) >= requirementFor(def);
}

// How many more completions are needed to unlock a locked building.
export function remainingToUnlock(def: BuildingDef, p: Progress): number {
  return Math.max(0, requirementFor(def) - countFor(def, p));
}

// The friendly hint shown under a locked building, e.g.
// "Complete 2 more Science assignments to unlock the Laboratory! 🔬".
export function unlockHint(def: BuildingDef, p: Progress): string {
  const remaining = remainingToUnlock(def, p);
  const plural = remaining === 1 ? "assignment" : "assignments";
  if (def.category === "universal") {
    return `Complete ${remaining} more ${plural} to unlock the ${def.name}! ${CATEGORY_META.universal.emoji}`;
  }
  const label = CATEGORY_META[def.category].label;
  return `Complete ${remaining} more ${label} ${plural} to unlock the ${def.name}! ${CATEGORY_META[def.category].emoji}`;
}

// The ids of every currently-unlocked building that requires an unlock (used to
// detect newly-unlocked buildings for the celebration).
export function unlockedIds(p: Progress): BuildingId[] {
  return BUILDINGS.filter((b) => b.category !== "starter" && isUnlocked(b, p)).map((b) => b.id);
}

// ---------------------------------------------------------------------------
// Geometry.
// ---------------------------------------------------------------------------
export interface Placed {
  id: BuildingId;
  x: number;
  y: number;
}

export function footprint(x: number, y: number, size: 1 | 2): { x: number; y: number }[] {
  if (size === 1) return [{ x, y }];
  return [
    { x, y }, { x: x + 1, y },
    { x, y: y + 1 }, { x: x + 1, y: y + 1 },
  ];
}

export function inBounds(x: number, y: number, size: 1 | 2): boolean {
  return footprint(x, y, size).every(
    (c) => c.x >= 0 && c.y >= 0 && c.x < GRID_SIZE && c.y < GRID_SIZE,
  );
}

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

// ---------------------------------------------------------------------------
// Costs and refunds (Tier 2 buildings can cost gems, so all four count).
// ---------------------------------------------------------------------------
export function canAfford(wallet: Wallet, cost: Partial<Wallet>): boolean {
  return (
    wallet.coins >= (cost.coins ?? 0) &&
    wallet.bricks >= (cost.bricks ?? 0) &&
    wallet.wood >= (cost.wood ?? 0) &&
    wallet.gems >= (cost.gems ?? 0)
  );
}

export function refundOf(cost: Partial<Wallet>): Wallet {
  return {
    coins: Math.floor((cost.coins ?? 0) / 2),
    bricks: Math.floor((cost.bricks ?? 0) / 2),
    wood: Math.floor((cost.wood ?? 0) / 2),
    gems: Math.floor((cost.gems ?? 0) / 2),
  };
}

// True when the student can afford AND has unlocked at least one building —
// drives the friendly "go earn more" nudge.
export function canBuildAnything(wallet: Wallet, p: Progress): boolean {
  return BUILDINGS.some((b) => isUnlocked(b, p) && canAfford(wallet, b.cost));
}
