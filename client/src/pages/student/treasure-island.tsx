import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { XpLevelBar } from "@/components/XpLevelBar";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, Lock, CheckCircle } from "lucide-react";
import { COLLECTIBLES, TREASURE_HUNT_TOTAL } from "@shared/collectibles";
import { isPrimaryForm, type StudentReward } from "@shared/schema";
import { collectibleEmoji } from "@/lib/collectible-emoji";
import logoPath from "@assets/logo.webp";

// Where each of the 12 treasures sits on the island. The order matches
// COLLECTIBLES (spot 1 is the first item, spot 12 the last), and the trail is
// drawn straight through these points — so moving a spot moves the path with it.
// Coordinates are in the SVG's own 400 x 760 grid, not screen pixels.
const SPOTS: { x: number; y: number }[] = [
  { x: 70, y: 690 },
  { x: 165, y: 655 },
  { x: 270, y: 615 },
  { x: 330, y: 545 },
  { x: 250, y: 500 },
  { x: 140, y: 470 },
  { x: 70, y: 410 },
  { x: 155, y: 360 },
  { x: 260, y: 335 },
  { x: 330, y: 265 },
  { x: 295, y: 185 },
  { x: 195, y: 120 },
];

// Turn the list of spots into one smooth, winding line for an SVG <path>.
// Beginner note: between each pair of spots we add a gentle curve (instead of a
// hard corner) using the neighbouring spots to decide which way to bend. The
// result is the "d" string that <path> understands.
function buildTrail(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`,
    );
  }
  return d.join(" ");
}

// Built once — the spots never change, so neither does the trail.
const TRAIL_PATH = buildTrail(SPOTS);

// The three states a treasure spot can be in:
//   "open"   — collected. An open chest with the treasure popping out.
//   "next"   — the one to aim for next. A glowing, closed chest.
//   "locked" — not reached yet. A faded, padlocked chest (a mystery).
type SpotState = "open" | "next" | "locked";

// One treasure chest, drawn to match its state. It is centred on (0,0) so the
// map can just drop it at a spot's position. Beginner note: a chest is only a
// few shapes — a body, a lid, a metal band and a lock — and we change their
// colours (and lift the lid) depending on the state.
function TreasureSpot({ state, emoji, name }: { state: SpotState; emoji: string; name: string }) {
  const isLocked = state === "locked";

  // Warm wooden chest normally; drained to grey when still locked.
  const wood = isLocked ? "#a49e93" : "#a86a2e";
  const lid = isLocked ? "#b9b4a9" : "#c07d3a";
  const band = isLocked ? "#7d786f" : "#6b4a22";
  const outline = isLocked ? "#7d786f" : "#5e3a18";

  return (
    <g opacity={isLocked ? 0.9 : 1}>
      {/* A soft glowing halo behind the treasure you should open next. */}
      {state === "next" && <circle r="27" fill="url(#spotGlow)" className="animate-pulse" />}

      {/* A shadow so the chest looks like it rests on the trail. */}
      <ellipse cx="0" cy="15" rx="18" ry="4" fill="#000000" opacity="0.15" />

      {/* Chest body (bottom half) — the same in every state. */}
      <path
        d="M -17 -1 h 34 v 11 q 0 3 -3 3 h -28 q -3 0 -3 -3 z"
        fill={wood}
        stroke={outline}
        strokeWidth="1.5"
      />

      {state === "open" ? (
        <>
          {/* The dark open mouth, with gold treasure glinting inside. */}
          <path d="M -15 -1 h 30 v 2 q 0 2 -2 2 h -26 q -2 0 -2 -2 z" fill="#2e1c0e" />
          <ellipse cx="0" cy="2" rx="12" ry="3" fill="#f6b93b" />
          {/* The lid, lifted and tilted open behind the chest. */}
          <path
            d="M -17 -1 v -3 q 0 -13 17 -13 q 17 0 17 13 v 3 z"
            fill={lid}
            stroke={outline}
            strokeWidth="1.5"
            transform="translate(0 -13) rotate(-10)"
          />
          {/* The treasure you found, popping out with a little sparkle. */}
          <text x="0" y="-26" textAnchor="middle" dominantBaseline="central" fontSize="20">{emoji}</text>
          <text x="14" y="-32" textAnchor="middle" dominantBaseline="central" fontSize="12">✨</text>
        </>
      ) : (
        <>
          {/* Closed lid. */}
          <path
            d="M -17 -1 v -3 q 0 -13 17 -13 q 17 0 17 13 v 3 z"
            fill={lid}
            stroke={outline}
            strokeWidth="1.5"
          />
          {/* Metal band across the seam and a lock plate in the middle. */}
          <rect x="-17" y="-3" width="34" height="4" fill={band} />
          <rect
            x="-4"
            y="-1"
            width="8"
            height="8"
            rx="1.5"
            fill={isLocked ? "#8d8880" : "#f6b93b"}
            stroke={outline}
            strokeWidth="0.8"
          />
          <circle cx="0" cy="2.5" r="1.2" fill={outline} />
          {/* A padlock badge makes a locked chest unmistakable. */}
          {isLocked && (
            <text x="0" y="-25" textAnchor="middle" dominantBaseline="central" fontSize="15">🔒</text>
          )}
        </>
      )}

      <title>
        {state === "open"
          ? name
          : state === "next"
            ? "Your next treasure — finish an assignment to open it!"
            : "Locked treasure — keep going!"}
      </title>
    </g>
  );
}

// The island map. Shows the winding trail with all 12 spots: earned treasures
// glow in gold with their picture; ones you haven't found yet stay a faded,
// dashed mystery. The next treasure to aim for gets a gentle pulsing ring.
function IslandMap({ earnedNames }: { earnedNames: Set<string> }) {
  // The first treasure the student hasn't collected yet — highlighted as "next".
  const nextIndex = COLLECTIBLES.findIndex((c) => !earnedNames.has(c.name));

  return (
    <div className="rounded-xl border overflow-hidden shadow-sm">
      <svg
        viewBox="0 0 400 760"
        className="w-full h-auto block"
        role="img"
        aria-label="Treasure island map showing which treasures you have collected"
      >
        {/* A soft gold glow used behind the "next" treasure. */}
        <defs>
          <radialGradient id="spotGlow">
            <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#f6b93b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f6b93b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The sea. */}
        <rect x="0" y="0" width="400" height="760" fill="#a8d8ea" />
        {/* A few calm little waves. */}
        {[
          "M 30 90 q 12 -8 24 0 t 24 0",
          "M 300 700 q 12 -8 24 0 t 24 0",
          "M 40 640 q 12 -8 24 0 t 24 0",
        ].map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.5" />
        ))}

        {/* The island itself — a sandy landmass with a patch of grass. */}
        <path
          d="M 45 400 C 20 300, 35 170, 150 115 C 250 68, 340 100, 360 200 C 378 285, 355 360, 350 450 C 345 560, 360 650, 250 695 C 150 735, 60 705, 48 610 C 40 520, 70 470, 45 400 Z"
          fill="#f3e2b3"
          stroke="#e0cd93"
          strokeWidth="3"
        />
        <path
          d="M 110 360 C 90 280, 130 190, 210 175 C 300 160, 330 250, 315 330 C 300 420, 250 470, 180 455 C 130 445, 120 410, 110 360 Z"
          fill="#b7d98f"
          opacity="0.85"
        />

        {/* Decorations — just for fun. */}
        <text x="120" y="230" fontSize="26" textAnchor="middle">🌴</text>
        <text x="290" y="420" fontSize="26" textAnchor="middle">🌴</text>
        <text x="355" y="720" fontSize="22" textAnchor="middle">🧭</text>

        {/* The winding trail: a soft wide road with a dashed line on top. */}
        <path d={TRAIL_PATH} fill="none" stroke="#8a6d3b" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
        <path d={TRAIL_PATH} fill="none" stroke="#6b4f2a" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />

        {/* The 12 treasure spots, each a chest that changes with its state. */}
        {COLLECTIBLES.map((c, i) => {
          const p = SPOTS[i];
          const state: SpotState = earnedNames.has(c.name)
            ? "open"
            : i === nextIndex
              ? "next"
              : "locked";
          return (
            <g key={c.name} transform={`translate(${p.x} ${p.y})`}>
              <TreasureSpot state={state} emoji={collectibleEmoji(c.name)} name={c.name} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function TreasureIsland() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  // Only logged-in primary students may see the map. Anyone else is sent away.
  useEffect(() => {
    if (!student) {
      setLocation("/student/login");
    } else if (!isPrimaryForm(student.form)) {
      setLocation("/student/dashboard");
    }
  }, [student, setLocation]);

  const { data, isLoading } = useQuery<{ success: boolean; rewards: StudentReward[] }>({
    queryKey: ["/api/students/" + student?.id + "/rewards"],
    enabled: !!student && isPrimaryForm(student.form),
  });

  // The student's XP/level, from the same stats endpoint the dashboard uses,
  // so the treasure map can show XP right alongside the chests (no new call).
  const { data: statsData } = useQuery<{
    success: boolean;
    stats: {
      xp?: { level: number; xpIntoLevel: number; xpForNextLevel: number; progressPercent: number };
    };
  }>({
    queryKey: ["/api/students", student?.id, "stats"],
    enabled: !!student && isPrimaryForm(student.form),
  });

  if (!student || !isPrimaryForm(student.form)) return null;

  // The set of collectible names this student has already earned. We use a set
  // so earning the same item twice still counts as one collected treasure.
  const earnedNames = new Set((data?.rewards ?? []).map((r) => r.rewardName));
  const collectedCount = COLLECTIBLES.filter((c) => earnedNames.has(c.name)).length;
  const percent = Math.round((collectedCount / TREASURE_HUNT_TOTAL) * 100);

  return (
    <div className="min-h-screen bg-background">
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Island banner — warm gold on navy to match the school colours. */}
        <div className="rounded-xl border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 mb-6 text-center shadow-sm">
          <div className="text-4xl mb-2">🏴‍☠️ 🏝️</div>
          <h1 className="text-2xl font-bold">Treasure Island</h1>
          <p className="text-primary-foreground/80 mt-1">
            Finish assignments to collect all {TREASURE_HUNT_TOTAL} treasures!
          </p>
        </div>

        {/* Level + XP, shown alongside the chests. Uses the stats already
            fetched above, so it adds no extra request. Zeroed until it loads. */}
        <XpLevelBar
          level={statsData?.stats.xp?.level ?? 0}
          xpIntoLevel={statsData?.stats.xp?.xpIntoLevel ?? 0}
          xpForNextLevel={statsData?.stats.xp?.xpForNextLevel ?? 500}
          progressPercent={statsData?.stats.xp?.progressPercent ?? 0}
        />

        {/* Progress towards collecting the whole set. */}
        <Card className="mb-6">
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Your Treasure Chest</span>
              <span className="text-sm font-semibold text-primary" data-testid="text-collected-count">
                {collectedCount} / {TREASURE_HUNT_TOTAL} collected
              </span>
            </div>
            <Progress value={percent} className="h-3" />
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* The island map — the winding trail with all 12 treasure spots. */}
            <IslandMap earnedNames={earnedNames} />

            {/* The full treasure log below the map, with names and descriptions. */}
            <h2 className="text-lg font-semibold mt-8 mb-3">Your Treasure Log</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {COLLECTIBLES.map((collectible) => {
              const earned = earnedNames.has(collectible.name);
              return (
                <Card
                  key={collectible.name}
                  className={earned ? "border-primary/40" : "opacity-80"}
                  data-testid={`collectible-${earned ? "earned" : "locked"}`}
                >
                  <CardContent className="p-4 text-center flex flex-col items-center gap-2 h-full">
                    {/* Earned treasures show their picture; locked ones stay a mystery. */}
                    <div className={`text-4xl ${earned ? "" : "grayscale opacity-40"}`}>
                      {earned ? collectibleEmoji(collectible.name) : "❓"}
                    </div>
                    {earned ? (
                      <>
                        <div className="flex items-center gap-1 font-semibold text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                          {collectible.name}
                        </div>
                        <p className="text-xs text-muted-foreground">{collectible.description}</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 font-semibold text-sm text-muted-foreground">
                          <Lock className="h-4 w-4 shrink-0" />
                          Locked
                        </div>
                        <p className="text-xs text-muted-foreground">Keep going to unlock this treasure!</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
