// Dream World — the town-building plot for primary students (Stages 3-6).
//
// Mobile-first: an 8x8 SVG grid that always fits the screen (no pinch/scroll),
// a wallet strip, and a build menu. Tap a menu item then an empty tile to build
// (with a little pop); tap a placed building to remove it (half refund). The
// server validates every placement and is the source of truth for the wallet;
// we update optimistically for a snappy feel and reconcile with its response.

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2 } from "lucide-react";
import { isPrimaryForm } from "@shared/schema";
import {
  BUILDINGS, GRID_SIZE, RESOURCE_ICON, buildingById, canAfford, canAffordAnything,
  footprint, inBounds, occupiedCells,
  type BuildingId, type Placed, type Wallet,
} from "@shared/dreamworld";
import { DreamBuilding, TILE } from "@/components/DreamBuilding";
import logoPath from "@assets/logo.webp";

const ZERO: Wallet = { coins: 0, bricks: 0, wood: 0, gems: 0 };
const SIZE_PX = GRID_SIZE * TILE; // the SVG's own coordinate size

export default function DreamWorld() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  // Only logged-in primary students may see the plot. Anyone else is sent away.
  useEffect(() => {
    if (!student) {
      setLocation("/student/login");
    } else if (!isPrimaryForm(student.form)) {
      setLocation("/student/dashboard");
    }
  }, [student, setLocation]);

  const { data, isLoading } = useQuery<{ success: boolean; wallet: Wallet; layout: Placed[] }>({
    queryKey: ["/api/students/" + student?.id + "/dreamworld"],
    enabled: !!student && isPrimaryForm(student.form),
  });

  const [wallet, setWallet] = useState<Wallet>(ZERO);
  const [layout, setLayout] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<BuildingId | null>(null);
  const [popping, setPopping] = useState<string | null>(null); // "x,y" of the tile animating in
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load the saved wallet + town once it arrives from the server.
  useEffect(() => {
    if (data?.success) {
      setWallet(data.wallet);
      setLayout(data.layout ?? []);
    }
  }, [data]);

  if (!student || !isPrimaryForm(student.form)) return null;

  const occupied = occupiedCells(layout);

  async function placeAt(x: number, y: number) {
    if (busy || !selected) return;
    const def = buildingById(selected)!;
    if (!inBounds(x, y, def.size)) { setMessage("That doesn't fit here."); return; }
    if (footprint(x, y, def.size).some((c) => occupied.has(`${c.x},${c.y}`))) { setMessage("That space is taken."); return; }
    if (!canAfford(wallet, def.cost)) { setMessage("Not enough resources yet."); return; }

    // Optimistic: show it instantly, then reconcile with the server.
    const prevWallet = wallet, prevLayout = layout;
    setMessage(null);
    setLayout([...layout, { id: def.id, x, y }]);
    setWallet({
      coins: wallet.coins - (def.cost.coins ?? 0),
      bricks: wallet.bricks - (def.cost.bricks ?? 0),
      wood: wallet.wood - (def.cost.wood ?? 0),
      gems: wallet.gems,
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
    } finally {
      setBusy(false);
    }
  }

  async function removeAt(x: number, y: number) {
    if (busy) return;
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
        gems: wallet.gems,
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
    } finally {
      setBusy(false);
    }
  }

  function handleTileTap(x: number, y: number) {
    if (occupied.has(`${x},${y}`)) removeAt(x, y);
    else if (selected) placeAt(x, y);
    else setMessage("Pick something to build first!");
  }

  const broke = !canAffordAnything(wallet);

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        @keyframes dw-pop { 0% { transform: scale(.5); opacity: 0 } 65% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
        .dw-pop { animation: dw-pop .42s cubic-bezier(.2,.8,.3,1) both; transform-box: fill-box; transform-origin: center bottom; }
        @media (prefers-reduced-motion: reduce) { .dw-pop { animation-duration: .001s !important; } }
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
          <p className="text-muted-foreground text-sm mt-1">Build your town with the resources you earn from your work!</p>
        </div>

        {/* Wallet strip — the four resources the student holds. */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 flex-wrap" data-testid="wallet-strip">
          {(["coins", "bricks", "wood", "gems"] as const).map((k) => (
            <div key={k} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-bold tabular-nums">
              <span aria-hidden="true">{RESOURCE_ICON[k]}</span>
              <span data-testid={`wallet-${k}`}>{wallet[k]}</span>
            </div>
          ))}
        </div>

        {/* Friendly nudge when nothing is affordable. */}
        {broke && (
          <Link href="/student/dashboard">
            <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm font-medium text-primary cursor-pointer" data-testid="empty-wallet-nudge">
              Complete an assignment to earn more resources! →
            </div>
          </Link>
        )}

        {message && (
          <div className="mb-3 rounded-lg bg-muted px-4 py-2 text-center text-sm" data-testid="dream-message">{message}</div>
        )}

        {/* The plot — an 8x8 grid drawn as one SVG that scales to the screen. */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-xl border overflow-hidden shadow-sm bg-[#8FD673] dark:bg-[#3c6b39]">
            <svg viewBox={`0 0 ${SIZE_PX} ${SIZE_PX}`} className="w-full h-auto block touch-manipulation" role="img" aria-label="Your town plot, an 8 by 8 grid">
              {/* Land tiles — a soft two-tone green check. */}
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

              {/* Placed buildings. Field (size 2) is drawn over its 2x2 block. */}
              {layout.map((b, i) => {
                const def = buildingById(b.id);
                const isPopping = popping === `${b.x},${b.y}`;
                return (
                  <g
                    key={`b${i}-${b.id}-${b.x}-${b.y}`}
                    transform={`translate(${b.x * TILE} ${b.y * TILE})`}
                    className={isPopping ? "dw-pop" : undefined}
                    onClick={() => handleTileTap(b.x, b.y)}
                    style={{ cursor: "pointer" }}
                    data-testid={`placed-${b.id}-${b.x}-${b.y}`}
                  >
                    <title>{def?.name} — tap to remove (half refund)</title>
                    <DreamBuilding id={b.id} />
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* Build menu — tap to pick, then tap a tile. */}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-6 mb-2">Build menu</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="build-menu">
          {BUILDINGS.map((b) => {
            const affordable = canAfford(wallet, b.cost);
            const active = selected === b.id;
            const previewSize = b.size === 2 ? 80 : TILE;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => { setSelected(active ? null : b.id); setMessage(null); }}
                disabled={!affordable}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${active ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border"} ${affordable ? "hover-elevate cursor-pointer" : "opacity-45 cursor-not-allowed"}`}
                data-testid={`menu-${b.id}`}
              >
                <svg viewBox={`0 0 ${previewSize} ${previewSize}`} className="h-9 w-9 shrink-0" aria-hidden="true">
                  <rect x="0" y="0" width={previewSize} height={previewSize} fill="#8FD673" rx="3" />
                  <DreamBuilding id={b.id} />
                </svg>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{b.name}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {(["coins", "bricks", "wood"] as const)
                      .filter((k) => (b.cost[k] ?? 0) > 0)
                      .map((k) => `${RESOURCE_ICON[k]}${b.cost[k]}`)
                      .join(" ")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          {selected ? "Now tap an empty tile to build. Tap a building to remove it." : "Tap something above, then tap a tile to build."}
        </p>
      </main>
    </div>
  );
}
