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
export type Category = "starter" | "maths" | "english" | "science" | "computing" | "universal" | "decor";

// Categories that need no completions to unlock.
export const FREE_CATEGORIES: Category[] = ["starter", "decor"];

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
  decor:     { label: "Decorations",   emoji: "🌷" },
};

// The display order of the shop's groups.
export const CATEGORY_ORDER: Category[] = ["starter", "maths", "english", "science", "computing", "universal", "decor"];

// Map an assignment's subject text to a category (or null for "other" subjects,
// which still count toward the total but unlock no specific building).
export function subjectToCategory(subject: string): "maths" | "english" | "science" | "computing" | null {
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
  | "school"
  // Session 4 decorations.
  | "fence" | "pond" | "lamppost" | "statue" | "bench";

export interface BuildingDef {
  id: BuildingId;
  name: string;
  size: 1 | 2;                 // footprint: 1 = one tile, 2 = a 2x2 block
  cost: Partial<Wallet>;       // coins/bricks/wood and (Tier 2) gems
  category: Category;
  tier?: 1 | 2;                // subject/universal buildings only
  maxLevel?: number;           // structures can be upgraded up to this level (default 1 = no upgrades)
}

export const BUILDINGS: BuildingDef[] = [
  // Starter kit — always available.
  { id: "house",  name: "Small House",    size: 1, cost: { coins: 40, bricks: 30 }, category: "starter", maxLevel: 3 },
  { id: "tree",   name: "Tree",           size: 1, cost: { wood: 10 }, category: "starter" },
  { id: "road",   name: "Road",           size: 1, cost: { bricks: 5 }, category: "starter" },
  { id: "flower", name: "Flower Patch",   size: 1, cost: { coins: 5 }, category: "starter" },
  { id: "field",  name: "Football Field", size: 2, cost: { coins: 60, wood: 40 }, category: "starter", maxLevel: 3 },

  // Maths.
  { id: "bank",        name: "Bank",              size: 1, cost: { coins: 80, bricks: 50 }, category: "maths", tier: 1, maxLevel: 3 },
  { id: "engineering", name: "Engineering Works", size: 2, cost: { coins: 150, bricks: 80, gems: 2 }, category: "maths", tier: 2, maxLevel: 3 },

  // English.
  { id: "library", name: "Library", size: 1, cost: { coins: 70, wood: 40 }, category: "english", tier: 1, maxLevel: 3 },
  { id: "theatre", name: "Theatre", size: 2, cost: { coins: 140, bricks: 60, wood: 60, gems: 2 }, category: "english", tier: 2, maxLevel: 3 },

  // Science.
  { id: "laboratory", name: "Laboratory", size: 1, cost: { coins: 80, wood: 50 }, category: "science", tier: 1, maxLevel: 3 },
  { id: "hospital",   name: "Hospital",   size: 2, cost: { coins: 160, bricks: 80, gems: 2 }, category: "science", tier: 2, maxLevel: 3 },

  // Computing / ICT.
  { id: "robot_kiosk",   name: "Robot Kiosk",   size: 1, cost: { coins: 60, bricks: 30 }, category: "computing", tier: 1, maxLevel: 3 },
  { id: "robot_factory", name: "Robot Factory", size: 2, cost: { coins: 150, bricks: 70, wood: 70, gems: 2 }, category: "computing", tier: 2, maxLevel: 3 },

  // Universal reward.
  { id: "school", name: "School", size: 2, cost: { coins: 200, bricks: 100, wood: 100, gems: 3 }, category: "universal", tier: 2, maxLevel: 3 },

  // Decorations — always available, cheap, cosmetic. Not upgradable.
  { id: "fence",    name: "Fence",    size: 1, cost: { wood: 3 }, category: "decor" },
  { id: "pond",     name: "Pond",     size: 1, cost: { coins: 8 }, category: "decor" },
  { id: "lamppost", name: "Lamppost", size: 1, cost: { bricks: 6 }, category: "decor" },
  { id: "bench",    name: "Bench",    size: 1, cost: { wood: 5 }, category: "decor" },
  { id: "statue",   name: "Statue",   size: 1, cost: { coins: 12, bricks: 6 }, category: "decor" },
];

export function buildingById(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

export function buildingsInCategory(cat: Category): BuildingDef[] {
  return BUILDINGS.filter((b) => b.category === cat);
}

// How many completions a building needs (0 for starters and decorations).
export function requirementFor(def: BuildingDef): number {
  if (FREE_CATEGORIES.includes(def.category)) return 0;
  if (def.category === "universal") return SCHOOL_REQUIRED;
  return def.tier === 2 ? TIER2_REQUIRED : TIER1_REQUIRED;
}

// The count that matters for a building: its subject's count, or the grand
// total for the universal School.
export function countFor(def: BuildingDef, p: Progress): number {
  switch (def.category) {
    case "maths": case "english": case "science": case "computing": return p[def.category];
    case "universal": return p.total;
    default: return 0; // starter, decor
  }
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
  return BUILDINGS.filter((b) => !FREE_CATEGORIES.includes(b.category) && isUnlocked(b, p)).map((b) => b.id);
}

// ---------------------------------------------------------------------------
// Geometry.
// ---------------------------------------------------------------------------
export interface Placed {
  id: BuildingId;
  x: number;
  y: number;
  placedAt?: number; // ms timestamp when placed (used for the "Rising Town" award)
  level?: number;    // upgrade level (1 = as placed); absent means 1
}

export function footprint(x: number, y: number, size: 1 | 2): { x: number; y: number }[] {
  if (size === 1) return [{ x, y }];
  return [
    { x, y }, { x: x + 1, y },
    { x, y: y + 1 }, { x: x + 1, y: y + 1 },
  ];
}

export function inBounds(x: number, y: number, size: 1 | 2, gridSize: number = GRID_SIZE): boolean {
  return footprint(x, y, size).every(
    (c) => c.x >= 0 && c.y >= 0 && c.x < gridSize && c.y < gridSize,
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

// ---------------------------------------------------------------------------
// Session 4 — building upgrades, town value, and plot expansion.
// ---------------------------------------------------------------------------
export function levelOf(b: Placed): number {
  return b.level && b.level > 1 ? b.level : 1;
}

export function maxLevelOf(def: BuildingDef): number {
  return def.maxLevel ?? 1;
}

export function isUpgradable(def: BuildingDef): boolean {
  return maxLevelOf(def) > 1;
}

// Cost to upgrade FROM the given current level to the next one. It scales with
// the level, so each upgrade costs more: Lv1→2 = one base cost, Lv2→3 = two.
export function upgradeCost(def: BuildingDef, currentLevel: number): Partial<Wallet> {
  const mult = currentLevel; // 1 for the first upgrade, 2 for the second
  return {
    coins: (def.cost.coins ?? 0) * mult,
    bricks: (def.cost.bricks ?? 0) * mult,
    wood: (def.cost.wood ?? 0) * mult,
    gems: (def.cost.gems ?? 0) * mult,
  };
}

// Total resources sunk into a building at a given level (base + all upgrades).
// Lv1 = base, Lv2 = base×2, Lv3 = base×4 (1 + 1 + 2).
const INVESTED_MULT = [1, 2, 4];
export function totalInvested(def: BuildingDef, level: number): Wallet {
  const m = INVESTED_MULT[Math.min(level, INVESTED_MULT.length) - 1] ?? 1;
  return {
    coins: (def.cost.coins ?? 0) * m,
    bricks: (def.cost.bricks ?? 0) * m,
    wood: (def.cost.wood ?? 0) * m,
    gems: (def.cost.gems ?? 0) * m,
  };
}

// Removing refunds half of everything invested (base + upgrades), rounded down.
export function refundForLevel(def: BuildingDef, level: number): Wallet {
  const t = totalInvested(def, level);
  return {
    coins: Math.floor(t.coins / 2),
    bricks: Math.floor(t.bricks / 2),
    wood: Math.floor(t.wood / 2),
    gems: Math.floor(t.gems / 2),
  };
}

// A single "value" number for a building's base cost (gems are worth more), used
// to score a town's prestige.
export function buildingValue(def: BuildingDef): number {
  return (def.cost.coins ?? 0) + (def.cost.bricks ?? 0) + (def.cost.wood ?? 0) + (def.cost.gems ?? 0) * 15;
}

// A town's total value = each building's base value times its level.
export function townValue(layout: Placed[]): number {
  let total = 0;
  for (const b of layout) {
    const def = buildingById(b.id);
    if (def) total += buildingValue(def) * levelOf(b);
  }
  return total;
}

// Plot expansion — one purchasable upgrade from 8x8 to 10x10.
export const MAX_GRID_SIZE = 10;
export const EXPAND_COST: Wallet = { coins: 150, bricks: 100, wood: 100, gems: 2 };
export function canExpand(gridSize: number): boolean {
  return gridSize < MAX_GRID_SIZE;
}

// ---------------------------------------------------------------------------
// Town identity — naming a town.
// ---------------------------------------------------------------------------
export const TOWN_NAME_MAX = 20;
export const RENAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // once per week

// ===========================================================================
// EDIT THIS LIST to add or remove blocked words. Matching is a simple
// case-insensitive substring check, so keep entries lowercase.
// ===========================================================================
export const BLOCKED_WORDS: string[] = [
  "damn", "hell", "crap", "stupid", "idiot", "dumb", "shutup", "hate", "loser",
];

// Validate and tidy a proposed town name. Letters, numbers and single spaces
// only, at most TOWN_NAME_MAX characters, and no blocked words.
export function cleanTownName(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, message: "Please type a town name." };
  if (trimmed.length > TOWN_NAME_MAX) return { ok: false, message: `Keep it to ${TOWN_NAME_MAX} characters or fewer.` };
  if (!/^[A-Za-z0-9 ]+$/.test(trimmed)) return { ok: false, message: "Use letters, numbers and spaces only." };
  const squashed = trimmed.toLowerCase().replace(/\s+/g, "");
  if (BLOCKED_WORDS.some((w) => squashed.includes(w))) return { ok: false, message: "Let's pick a friendlier name!" };
  return { ok: true, value: trimmed };
}

// The mayor's name is just the student's first name.
export function firstName(fullName: string): string {
  return (fullName || "").trim().split(/\s+/)[0] || "Mayor";
}

// ---------------------------------------------------------------------------
// Town Awards — one per student so every town wins something.
// ---------------------------------------------------------------------------
export type AwardId = "grandest" | "greenest" | "planned" | "scholar" | "rising" | "happy";

export interface AwardDef {
  id: AwardId;
  name: string;
  emoji: string;
  blurb: string; // shown on the certificate, e.g. "for the most buildings of all"
}

export const AWARDS: Record<AwardId, AwardDef> = {
  grandest: { id: "grandest", name: "Grandest Town",      emoji: "🏛️", blurb: "for building the grandest town of all" },
  greenest: { id: "greenest", name: "Greenest Town",      emoji: "🌳", blurb: "for the most trees and flowers" },
  planned:  { id: "planned",  name: "Best Planned Town",  emoji: "🛣️", blurb: "for the tidiest, best-planned roads" },
  scholar:  { id: "scholar",  name: "Scholar's City",     emoji: "🎓", blurb: "for building a grand School" },
  rising:   { id: "rising",   name: "Rising Town",        emoji: "🚀", blurb: "for growing the fastest this month" },
  happy:    { id: "happy",    name: "Happy Town",         emoji: "😊", blurb: "for being a wonderful place to live" },
};

export interface TownMetrics {
  total: number;      // total buildings
  green: number;      // trees + flowers
  roads: number;      // road tiles
  hasSchool: boolean; // built the School
  recent: number;     // buildings added in the last 30 days
}

export function townMetrics(layout: Placed[], now: number): TownMetrics {
  let green = 0, roads = 0, hasSchool = false, recent = 0;
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  for (const b of layout) {
    if (b.id === "tree" || b.id === "flower") green += 1;
    if (b.id === "road") roads += 1;
    if (b.id === "school") hasSchool = true;
    if (typeof b.placedAt === "number" && b.placedAt >= cutoff) recent += 1;
  }
  return { total: layout.length, green, roads, hasSchool, recent };
}

// Assign exactly one award to every entry so every town wins something. The
// four "most X" superlatives go to the single top town (positive score only);
// Scholar's City goes to any remaining town that built a School; everyone else
// gets Happy Town. Pure — the caller supplies the metrics.
export function assignAwards(entries: { studentId: number; metrics: TownMetrics }[]): Map<number, AwardId> {
  const result = new Map<number, AwardId>();
  const taken = new Set<number>();

  const topBy = (score: (m: TownMetrics) => number): number | null => {
    let best: number | null = null;
    let bestVal = 0; // must be strictly positive to win a superlative
    for (const e of entries) {
      if (taken.has(e.studentId)) continue;
      const v = score(e.metrics);
      if (v > bestVal) { bestVal = v; best = e.studentId; }
    }
    return best;
  };

  const give = (studentId: number | null, award: AwardId) => {
    if (studentId === null || taken.has(studentId)) return;
    result.set(studentId, award);
    taken.add(studentId);
  };

  give(topBy((m) => m.total), "grandest");
  give(topBy((m) => m.green), "greenest");
  give(topBy((m) => m.roads), "planned");
  for (const e of entries) if (!taken.has(e.studentId) && e.metrics.hasSchool) give(e.studentId, "scholar");
  give(topBy((m) => m.recent), "rising");
  for (const e of entries) if (!taken.has(e.studentId)) give(e.studentId, "happy");

  return result;
}
