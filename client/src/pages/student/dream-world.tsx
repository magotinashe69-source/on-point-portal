// Dream World — the town-building plot for primary students (Stages 3-6).
//
// Session 3 adds town identity (name your town, mayor, founded date), a "Visit
// Towns" button, a Town Award banner + certificate link, and ambient life on
// the plot (handled by <TownPlot/>). The server stays the source of truth for
// the wallet, unlocks, town name, and awards.

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, Lock, Pencil, Users, ArrowUpCircle, Trash2, Maximize2 } from "lucide-react";
import { isPrimaryForm } from "@shared/schema";
import {
  RESOURCE_ICON, CATEGORY_ORDER, CATEGORY_META, EMPTY_PROGRESS, AWARDS, TOWN_NAME_MAX,
  buildingById, buildingsInCategory, canAfford, canBuildAnything, cleanTownName, footprint,
  inBounds, isUnlocked, occupiedCells, remainingToUnlock, unlockHint,
  townValue, levelOf, maxLevelOf, isUpgradable, upgradeCost, canExpand, EXPAND_COST,
  type AwardId, type BuildingDef, type BuildingId, type Placed, type Progress, type Wallet,
} from "@shared/dreamworld";
import { DreamBuilding, TILE } from "@/components/DreamBuilding";
import { TownPlot } from "@/components/TownPlot";
import logoPath from "@assets/logo.webp";

const ZERO: Wallet = { coins: 0, bricks: 0, wood: 0, gems: 0 };

interface DreamData {
  success: boolean;
  wallet: Wallet;
  layout: Placed[];
  progress: Progress;
  overdue: { id: number; title: string } | null;
  justUnlocked: BuildingId[];
  townName: string;
  mayorFirstName: string;
  foundedAt: string;
  canRename: boolean;
  award: string;
  awardTerm: string;
  gridSize: number;
  townValue: number;
}

export default function DreamWorld() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  useEffect(() => {
    if (!student) setLocation("/student/login");
    else if (!isPrimaryForm(student.form)) setLocation("/student/dashboard");
  }, [student, setLocation]);

  const { data, isLoading, refetch } = useQuery<DreamData>({
    queryKey: ["/api/students/" + student?.id + "/dreamworld"],
    enabled: !!student && isPrimaryForm(student.form),
  });

  const [wallet, setWallet] = useState<Wallet>(ZERO);
  const [layout, setLayout] = useState<Placed[]>([]);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [overdue, setOverdue] = useState<{ id: number; title: string } | null>(null);
  const [town, setTown] = useState<{ name: string; mayor: string; founded: string; canRename: boolean; award: string; term: string }>({ name: "", mayor: "", founded: "", canRename: true, award: "", term: "" });
  const [selected, setSelected] = useState<BuildingId | null>(null);
  const [popping, setPopping] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<BuildingId[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(8);
  const [actioning, setActioning] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (data?.success) {
      setWallet(data.wallet);
      setLayout(data.layout ?? []);
      setProgress(data.progress ?? EMPTY_PROGRESS);
      setOverdue(data.overdue ?? null);
      setTown({ name: data.townName, mayor: data.mayorFirstName, founded: data.foundedAt, canRename: data.canRename, award: data.award, term: data.awardTerm });
      setGridSize(data.gridSize ?? 8);
      if (data.justUnlocked && data.justUnlocked.length > 0) setCelebrate(data.justUnlocked);
    }
  }, [data]);

  if (!student || !isPrimaryForm(student.form)) return null;

  const occupied = occupiedCells(layout);
  const locked = !!overdue;
  const value = townValue(layout);

  async function placeAt(x: number, y: number) {
    if (busy || locked || !selected) return;
    const def = buildingById(selected)!;
    if (!isUnlocked(def, progress)) { setMessage(unlockHint(def, progress)); return; }
    if (!inBounds(x, y, def.size, gridSize)) { setMessage("That doesn't fit here."); return; }
    if (footprint(x, y, def.size).some((c) => occupied.has(`${c.x},${c.y}`))) { setMessage("That space is taken."); return; }
    if (!canAfford(wallet, def.cost)) { setMessage("Not enough resources yet."); return; }

    const prevWallet = wallet, prevLayout = layout;
    setMessage(null);
    setLayout([...layout, { id: def.id, x, y }]);
    setWallet({
      coins: wallet.coins - (def.cost.coins ?? 0),
      bricks: wallet.bricks - (def.cost.bricks ?? 0),
      wood: wallet.wood - (def.cost.wood ?? 0),
      gems: wallet.gems - (def.cost.gems ?? 0),
    });
    setPopping(`${x},${y}`);
    window.setTimeout(() => setPopping((k) => (k === `${x},${y}` ? null : k)), 450);

    setBusy(true);
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/dreamworld/place`, { buildingId: def.id, x, y });
      const body = await res.json();
      if (body.success) { setWallet(body.wallet); setLayout(body.layout); }
      else { setWallet(prevWallet); setLayout(prevLayout); setMessage(body.message || "Couldn't build that."); }
    } catch {
      setWallet(prevWallet); setLayout(prevLayout); setMessage("Couldn't build that — try again.");
    } finally { setBusy(false); }
  }

  async function removeAt(x: number, y: number) {
    if (busy || locked) return;
    const target = occupied.get(`${x},${y}`);
    if (!target) return;
    const def = buildingById(target.id);

    const prevWallet = wallet, prevLayout = layout;
    setMessage(null);
    setLayout(layout.filter((b) => !(b.x === target.x && b.y === target.y && b.id === target.id)));
    if (def) {
      setWallet({
        coins: wallet.coins + Math.floor((def.cost.coins ?? 0) / 2),
        bricks: wallet.bricks + Math.floor((def.cost.bricks ?? 0) / 2),
        wood: wallet.wood + Math.floor((def.cost.wood ?? 0) / 2),
        gems: wallet.gems + Math.floor((def.cost.gems ?? 0) / 2),
      });
    }
    setBusy(true);
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/dreamworld/remove`, { x, y });
      const body = await res.json();
      if (body.success) { setWallet(body.wallet); setLayout(body.layout); setActioning(null); }
      else { setWallet(prevWallet); setLayout(prevLayout); setMessage(body.message || "Couldn't remove that."); }
    } catch { setWallet(prevWallet); setLayout(prevLayout); }
    finally { setBusy(false); }
  }

  function handleTileTap(x: number, y: number) {
    if (locked) { setMessage("Finish your homework first, then come back to build!"); return; }
    const here = occupied.get(`${x},${y}`);
    if (here) { setActioning({ x: here.x, y: here.y }); return; } // open upgrade/remove
    if (selected) placeAt(x, y);
    else setMessage("Pick something to build first!");
  }

  async function upgradeAt(x: number, y: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/dreamworld/upgrade`, { x, y });
      const body = await res.json();
      if (body.success) { setWallet(body.wallet); setLayout(body.layout); setActioning(null); }
      else setMessage(body.message || "Couldn't upgrade that.");
    } catch { setMessage("Couldn't upgrade — try again."); }
    finally { setBusy(false); }
  }

  async function expandPlot() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/dreamworld/expand`, {});
      const body = await res.json();
      if (body.success) { setWallet(body.wallet); setGridSize(body.gridSize); setMessage("Your plot is bigger now! 🎉"); }
      else setMessage(body.message || "Couldn't expand the plot.");
    } catch { setMessage("Couldn't expand — try again."); }
    finally { setBusy(false); }
  }

  async function saveName() {
    const check = cleanTownName(nameInput);
    if (!check.ok) { setNameError(check.message); return; }
    setBusy(true);
    try {
      const res = await apiRequest("POST", `/api/students/${student!.id}/dreamworld/name`, { name: nameInput });
      const body = await res.json();
      if (body.success) { setEditingName(false); setNameError(null); refetch(); }
      else setNameError(body.message || "Couldn't save that name.");
    } catch { setNameError("Couldn't save that name — try again."); }
    finally { setBusy(false); }
  }

  const showNudge = !locked && !canBuildAnything(wallet, progress);
  const foundedDate = town.founded ? new Date(town.founded).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  const award = town.award ? AWARDS[town.award as AwardId] : null;

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes dw-modal { 0% { transform: scale(.7); opacity: 0 } 60% { transform: scale(1.04) } 100% { transform: scale(1); opacity: 1 } }
        .dw-modal { animation: dw-modal .4s ease-out both; }
        @keyframes dw-twinkle { 0%,100% { transform: scale(.6); opacity: .4 } 50% { transform: scale(1); opacity: 1 } }
        .dw-twinkle { animation: dw-twinkle 1.1s ease-in-out infinite; }
        .dw-locked-preview { filter: brightness(0); opacity: .26; }
        @media (prefers-reduced-motion: reduce) { .dw-modal, .dw-twinkle { animation-duration: .001s !important; } }
      `}</style>

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/student/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Town identity banner. */}
        <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-transparent px-4 py-3 mb-3 text-center">
          {editingName ? (
            <div className="flex flex-col items-center gap-2">
              <input
                autoFocus value={nameInput} maxLength={TOWN_NAME_MAX}
                onChange={(e) => { setNameInput(e.target.value); setNameError(null); }}
                placeholder="Name your town"
                className="w-full max-w-xs rounded-lg border bg-background px-3 py-2 text-center text-sm"
                data-testid="input-town-name"
              />
              <div className="flex gap-2">
                <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50" onClick={saveName} disabled={busy} data-testid="button-save-town-name">Save</button>
                <button className="rounded-lg border px-3 py-1.5 text-xs" onClick={() => { setEditingName(false); setNameError(null); }}>Cancel</button>
              </div>
              {nameError && <p className="text-xs text-destructive" data-testid="text-name-error">{nameError}</p>}
              <p className="text-[11px] text-muted-foreground">Letters, numbers &amp; spaces • up to {TOWN_NAME_MAX} • rename once a week</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="font-bold" data-testid="text-town-banner">
                🏙️ {town.name || "My Town"}
                {town.mayor && <span className="text-muted-foreground font-normal"> • Mayor {town.mayor}</span>}
                {foundedDate && <span className="text-muted-foreground font-normal"> • Founded {foundedDate}</span>}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#BF9000]/15 px-2 py-0.5 text-xs font-bold text-[#8a6a00] dark:text-[#E0B93A] tabular-nums" data-testid="town-value">
                ⭐ {value}
              </span>
              {town.canRename && (
                <button
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover-elevate"
                  onClick={() => { setNameInput(town.name); setEditingName(true); }}
                  data-testid="button-edit-town-name"
                >
                  <Pencil className="h-3 w-3" /> {town.name ? "Rename" : "Name it"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Award banner + certificate link. */}
        {award && (
          <Link href="/student/certificate">
            <div className="mb-3 rounded-xl border-2 border-[#BF9000]/50 bg-[#BF9000]/10 px-4 py-3 text-center cursor-pointer" data-testid="award-banner">
              <span className="font-bold">{award.emoji} {award.name}</span>
              {town.term && <span className="text-muted-foreground"> • {town.term}</span>}
              <span className="block text-xs text-primary mt-0.5">View &amp; print your certificate →</span>
            </div>
          </Link>
        )}

        {/* Wallet + Visit Towns. */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 flex-wrap" data-testid="wallet-strip">
          {(["coins", "bricks", "wood", "gems"] as const).map((k) => (
            <div key={k} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-bold tabular-nums">
              <span aria-hidden="true">{RESOURCE_ICON[k]}</span>
              <span data-testid={`wallet-${k}`}>{wallet[k]}</span>
            </div>
          ))}
          <Link href="/student/visit">
            <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold hover-elevate cursor-pointer" data-testid="button-visit-towns">
              <Users className="h-4 w-4" /> Visit Towns 🏘️
            </div>
          </Link>
        </div>

        {showNudge && (
          <Link href="/student/dashboard">
            <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm font-medium text-primary cursor-pointer" data-testid="empty-wallet-nudge">
              Complete an assignment to earn more resources! →
            </div>
          </Link>
        )}

        {message && (
          <div className="mb-3 rounded-lg bg-muted px-4 py-2 text-center text-sm" data-testid="dream-message">{message}</div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <TownPlot layout={layout} popping={popping} onTileTap={handleTileTap} interactive gridSize={gridSize} />
        )}

        {/* Plot expansion. */}
        {!locked && canExpand(gridSize) && (
          <button
            type="button"
            onClick={expandPlot}
            disabled={busy || !canAfford(wallet, EXPAND_COST)}
            className="mt-3 w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary disabled:opacity-45 hover-elevate"
            data-testid="button-expand-plot"
          >
            <Maximize2 className="inline h-4 w-4 mr-1.5" />
            Expand your plot to 10×10 — {(["coins", "bricks", "wood", "gems"] as const).filter((k) => EXPAND_COST[k] > 0).map((k) => `${RESOURCE_ICON[k]}${EXPAND_COST[k]}`).join(" ")}
          </button>
        )}

        {overdue && (
          <Link href={`/student/submit/${overdue.id}`}>
            <div className="mt-4 rounded-xl border border-orange-400/50 bg-orange-500/10 px-4 py-3 text-sm cursor-pointer" data-testid="overdue-lock">
              <span className="font-semibold">📚 Homework first!</span>{" "}
              You have an assignment due: <span className="font-semibold">“{overdue.title}”</span>. Finish it to unlock building again. →
            </div>
          </Link>
        )}

        {/* The shop. */}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-6 mb-2">Build shop</h2>
        <div className={locked ? "opacity-40 pointer-events-none select-none" : ""} aria-disabled={locked} data-testid="build-shop">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = buildingsInCategory(cat);
            const showCount = cat !== "starter" && cat !== "decor";
            const count = cat === "universal" ? progress.total : (progress as any)[cat] ?? 0;
            return (
              <div key={cat} className="mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span aria-hidden="true">{meta.emoji}</span>
                  <span className="text-xs font-bold uppercase tracking-wide">{meta.label}</span>
                  {showCount && <span className="text-[11px] text-muted-foreground tabular-nums">{count} completed</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {items.map((b) => (
                    <BuildingTile
                      key={b.id}
                      def={b}
                      unlocked={isUnlocked(b, progress)}
                      affordable={canAfford(wallet, b.cost)}
                      active={selected === b.id}
                      remaining={remainingToUnlock(b, progress)}
                      onPick={() => {
                        if (!isUnlocked(b, progress)) { setMessage(unlockHint(b, progress)); return; }
                        setSelected((s) => (s === b.id ? null : b.id));
                        setMessage(null);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          {locked ? "Building is paused until your homework is done." : selected ? "Now tap an empty tile to build. Tap a building to remove it." : "Tap an unlocked building, then tap a tile."}
        </p>
      </main>

      {/* Building action sheet — upgrade or remove the tapped building. */}
      {actioning && (() => {
        const b = occupied.get(`${actioning.x},${actioning.y}`);
        const def = b ? buildingById(b.id) : undefined;
        if (!b || !def) return null;
        const level = levelOf(b);
        const max = maxLevelOf(def);
        const canUp = isUpgradable(def) && level < max;
        const up = canUp ? upgradeCost(def, level) : null;
        const affordUp = up ? canAfford(wallet, up) : false;
        const px = def.size === 2 ? 80 : TILE;
        return (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" onClick={() => setActioning(null)} data-testid="building-actions">
            <div className="dw-modal w-full max-w-xs rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <svg viewBox={`0 0 ${px} ${px}`} className="h-12 w-12 shrink-0" aria-hidden="true">
                  <rect x="0" y="0" width={px} height={px} fill="#8FD673" rx="4" />
                  <DreamBuilding id={def.id} />
                </svg>
                <div>
                  <div className="font-bold">{def.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {isUpgradable(def) ? `Level ${level} of ${max}` : "Decoration"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {canUp ? (
                  <button
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-45"
                    onClick={() => upgradeAt(actioning.x, actioning.y)}
                    disabled={busy || !affordUp}
                    data-testid="button-upgrade"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Upgrade to Level {level + 1} — {(["coins", "bricks", "wood", "gems"] as const).filter((k) => (up![k] ?? 0) > 0).map((k) => `${RESOURCE_ICON[k]}${up![k]}`).join(" ")}
                  </button>
                ) : isUpgradable(def) ? (
                  <div className="rounded-lg bg-muted px-4 py-2 text-center text-sm font-medium">⭐ Max level reached!</div>
                ) : null}

                <button
                  className="flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium text-destructive disabled:opacity-45"
                  onClick={() => removeAt(actioning.x, actioning.y)}
                  disabled={busy}
                  data-testid="button-remove"
                >
                  <Trash2 className="h-4 w-4" /> Remove (half refund)
                </button>
                <button className="rounded-lg px-4 py-2 text-sm text-muted-foreground" onClick={() => setActioning(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {celebrate && celebrate.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" onClick={() => setCelebrate(null)} data-testid="unlock-celebration">
          <div className="dw-modal w-full max-w-xs rounded-2xl border bg-card p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-1"><span className="dw-twinkle inline-block">🎉</span></div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">New building unlocked!</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              {celebrate.map((id) => {
                const def = buildingById(id);
                const px = def?.size === 2 ? 80 : TILE;
                return (
                  <div key={id} className="flex flex-col items-center gap-1">
                    <svg viewBox={`0 0 ${px} ${px}`} className="h-14 w-14" aria-hidden="true">
                      <rect x="0" y="0" width={px} height={px} fill="#8FD673" rx="4" />
                      {def && <DreamBuilding id={id} />}
                    </svg>
                    <span className="text-xs font-bold">{def?.name}</span>
                  </div>
                );
              })}
            </div>
            <button className="mt-5 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => setCelebrate(null)} data-testid="celebration-continue">Let’s build!</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BuildingTile({ def, unlocked, affordable, active, remaining, onPick }: {
  def: BuildingDef; unlocked: boolean; affordable: boolean; active: boolean; remaining: number; onPick: () => void;
}) {
  const previewSize = def.size === 2 ? 80 : TILE;
  const canPick = unlocked && affordable;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={unlocked && !affordable}
      aria-pressed={active}
      className={`relative flex items-center gap-2 rounded-xl border p-2 text-left transition ${active ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border"} ${!unlocked ? "cursor-pointer bg-muted/40" : canPick ? "hover-elevate cursor-pointer" : "opacity-45 cursor-not-allowed"}`}
      data-testid={`menu-${def.id}`}
      data-unlocked={unlocked}
    >
      <svg viewBox={`0 0 ${previewSize} ${previewSize}`} className="h-9 w-9 shrink-0" aria-hidden="true">
        <rect x="0" y="0" width={previewSize} height={previewSize} fill="#8FD673" rx="3" />
        <g className={unlocked ? undefined : "dw-locked-preview"}>
          <DreamBuilding id={def.id} />
        </g>
      </svg>
      {!unlocked && <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" />}
      <div className="min-w-0">
        <div className="text-xs font-bold truncate">{unlocked ? def.name : "Locked"}</div>
        {unlocked ? (
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {(["coins", "bricks", "wood", "gems"] as const)
              .filter((k) => (def.cost[k] ?? 0) > 0)
              .map((k) => `${RESOURCE_ICON[k]}${def.cost[k]}`)
              .join(" ")}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground" data-testid={`hint-${def.id}`}>{remaining} more to unlock</div>
        )}
      </div>
    </button>
  );
}
