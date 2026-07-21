// Dream World — the town-building plot for primary students (Stages 3-6).
//
// Session 2 adds a subject shop: buildings are grouped by subject and unlock as
// the student completes assignments. Locked buildings show as silhouettes with
// the exact number of completions still needed. Unlocking a tier plays a small
// one-time celebration. If any assignment is overdue, the build menu is locked
// with a warm nudge (the town stays visible). The server is the source of truth
// for the wallet AND unlocks, so nothing here can be cheated from the browser.

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { isPrimaryForm } from "@shared/schema";
import {
  GRID_SIZE, RESOURCE_ICON, CATEGORY_ORDER, CATEGORY_META, EMPTY_PROGRESS,
  buildingById, buildingsInCategory, canAfford, canBuildAnything, footprint,
  inBounds, isUnlocked, occupiedCells, remainingToUnlock, unlockHint,
  type BuildingDef, type BuildingId, type Placed, type Progress, type Wallet,
} from "@shared/dreamworld";
import { DreamBuilding, TILE } from "@/components/DreamBuilding";
import logoPath from "@assets/logo.webp";

const ZERO: Wallet = { coins: 0, bricks: 0, wood: 0, gems: 0 };
const SIZE_PX = GRID_SIZE * TILE;

interface DreamData {
  success: boolean;
  wallet: Wallet;
  layout: Placed[];
  progress: Progress;
  overdue: { id: number; title: string } | null;
  justUnlocked: BuildingId[];
}

export default function DreamWorld() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  useEffect(() => {
    if (!student) setLocation("/student/login");
    else if (!isPrimaryForm(student.form)) setLocation("/student/dashboard");
  }, [student, setLocation]);

  const { data, isLoading } = useQuery<DreamData>({
    queryKey: ["/api/students/" + student?.id + "/dreamworld"],
    enabled: !!student && isPrimaryForm(student.form),
  });

  const [wallet, setWallet] = useState<Wallet>(ZERO);
  const [layout, setLayout] = useState<Placed[]>([]);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [overdue, setOverdue] = useState<{ id: number; title: string } | null>(null);
  const [selected, setSelected] = useState<BuildingId | null>(null);
  const [popping, setPopping] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<BuildingId[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.success) {
      setWallet(data.wallet);
      setLayout(data.layout ?? []);
      setProgress(data.progress ?? EMPTY_PROGRESS);
      setOverdue(data.overdue ?? null);
      if (data.justUnlocked && data.justUnlocked.length > 0) setCelebrate(data.justUnlocked);
    }
  }, [data]);

  if (!student || !isPrimaryForm(student.form)) return null;

  const occupied = occupiedCells(layout);
  const locked = !!overdue; // build/edit locked while homework is overdue

  async function placeAt(x: number, y: number) {
    if (busy || locked || !selected) return;
    const def = buildingById(selected)!;
    if (!isUnlocked(def, progress)) { setMessage(unlockHint(def, progress)); return; }
    if (!inBounds(x, y, def.size)) { setMessage("That doesn't fit here."); return; }
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
      if (body.success) { setWallet(body.wallet); setLayout(body.layout); }
      else { setWallet(prevWallet); setLayout(prevLayout); setMessage(body.message || "Couldn't remove that."); }
    } catch {
      setWallet(prevWallet); setLayout(prevLayout);
    } finally { setBusy(false); }
  }

  function handleTileTap(x: number, y: number) {
    if (locked) { setMessage("Finish your homework first, then come back to build!"); return; }
    if (occupied.has(`${x},${y}`)) removeAt(x, y);
    else if (selected) placeAt(x, y);
    else setMessage("Pick something to build first!");
  }

  const showNudge = !locked && !canBuildAnything(wallet, progress);

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes dw-pop { 0% { transform: scale(.5); opacity: 0 } 65% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
        .dw-pop { animation: dw-pop .42s cubic-bezier(.2,.8,.3,1) both; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes dw-modal { 0% { transform: scale(.7); opacity: 0 } 60% { transform: scale(1.04) } 100% { transform: scale(1); opacity: 1 } }
        .dw-modal { animation: dw-modal .4s ease-out both; }
        @keyframes dw-twinkle { 0%,100% { transform: scale(.6); opacity: .4 } 50% { transform: scale(1); opacity: 1 } }
        .dw-twinkle { animation: dw-twinkle 1.1s ease-in-out infinite; }
        .dw-locked-preview { filter: brightness(0); opacity: .26; }
        @media (prefers-reduced-motion: reduce) { .dw-pop, .dw-modal, .dw-twinkle { animation-duration: .001s !important; } }
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
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold">🏙️ My Dream World</h1>
          <p className="text-muted-foreground text-sm mt-1">Finish assignments to earn resources and unlock new buildings!</p>
        </div>

        {/* Wallet strip. */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 flex-wrap" data-testid="wallet-strip">
          {(["coins", "bricks", "wood", "gems"] as const).map((k) => (
            <div key={k} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-bold tabular-nums">
              <span aria-hidden="true">{RESOURCE_ICON[k]}</span>
              <span data-testid={`wallet-${k}`}>{wallet[k]}</span>
            </div>
          ))}
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

        {/* The plot. */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-xl border overflow-hidden shadow-sm bg-[#8FD673] dark:bg-[#3c6b39]">
            <svg viewBox={`0 0 ${SIZE_PX} ${SIZE_PX}`} className="w-full h-auto block touch-manipulation" role="img" aria-label="Your town plot, an 8 by 8 grid">
              {Array.from({ length: GRID_SIZE }).map((_, y) =>
                Array.from({ length: GRID_SIZE }).map((_, x) => (
                  <rect
                    key={`t${x}-${y}`}
                    x={x * TILE} y={y * TILE} width={TILE} height={TILE}
                    fill={(x + y) % 2 === 0 ? "#8FD673" : "#83CD66"}
                    stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1"
                    onClick={() => handleTileTap(x, y)}
                    style={{ cursor: "pointer" }}
                    data-testid={`tile-${x}-${y}`}
                  />
                )),
              )}
              {layout.map((b, i) => (
                <g
                  key={`b${i}-${b.id}-${b.x}-${b.y}`}
                  transform={`translate(${b.x * TILE} ${b.y * TILE})`}
                  className={popping === `${b.x},${b.y}` ? "dw-pop" : undefined}
                  onClick={() => handleTileTap(b.x, b.y)}
                  style={{ cursor: "pointer" }}
                  data-testid={`placed-${b.id}-${b.x}-${b.y}`}
                >
                  <title>{buildingById(b.id)?.name} — tap to remove (half refund)</title>
                  <DreamBuilding id={b.id} />
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Overdue lock — warm nudge naming one overdue assignment. */}
        {overdue && (
          <Link href={`/student/submit/${overdue.id}`}>
            <div className="mt-4 rounded-xl border border-orange-400/50 bg-orange-500/10 px-4 py-3 text-sm cursor-pointer" data-testid="overdue-lock">
              <span className="font-semibold">📚 Homework first!</span>{" "}
              You have an assignment due: <span className="font-semibold">“{overdue.title}”</span>. Finish it to unlock building again. →
            </div>
          </Link>
        )}

        {/* The shop — buildings grouped by subject. */}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-6 mb-2">Build shop</h2>
        <div className={locked ? "opacity-40 pointer-events-none select-none" : ""} aria-disabled={locked} data-testid="build-shop">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = buildingsInCategory(cat);
            const showCount = cat !== "starter";
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

      {/* One-time unlock celebration. */}
      {celebrate && celebrate.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog" aria-modal="true" onClick={() => setCelebrate(null)} data-testid="unlock-celebration"
        >
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
            <button
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              onClick={() => setCelebrate(null)}
              data-testid="celebration-continue"
            >
              Let’s build!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// One build-menu tile: an unlocked building you can pick, or a locked silhouette
// with the exact number of completions still needed.
function BuildingTile({ def, unlocked, affordable, active, remaining, onPick }: {
  def: BuildingDef;
  unlocked: boolean;
  affordable: boolean;
  active: boolean;
  remaining: number;
  onPick: () => void;
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
      {!unlocked && (
        <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
      )}
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
          <div className="text-[11px] text-muted-foreground" data-testid={`hint-${def.id}`}>
            {remaining} more to unlock
          </div>
        )}
      </div>
    </button>
  );
}
