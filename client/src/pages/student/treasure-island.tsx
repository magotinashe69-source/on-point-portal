import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, Lock, CheckCircle } from "lucide-react";
import { COLLECTIBLES, TREASURE_HUNT_TOTAL } from "@shared/collectibles";
import { isPrimaryForm, type StudentReward } from "@shared/schema";
import logoPath from "@assets/logo.webp";

// A little picture for each collectible. This is just for show on the map,
// so it lives here (not in the shared data) as a simple name -> emoji lookup.
const COLLECTIBLE_EMOJI: Record<string, string> = {
  "Ruby Gem": "💎",
  "Golden Compass": "🧭",
  "Old Map Piece": "🗺️",
  "Parrot": "🦜",
  "Pearl": "🦪",
  "Anchor": "⚓",
  "Spyglass": "🔭",
  "Treasure Key": "🗝️",
  "Silver Coin": "🪙",
  "Message in a Bottle": "📜",
  "Pirate Flag": "🏴‍☠️",
  "Crown": "👑",
};

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
                      {earned ? COLLECTIBLE_EMOJI[collectible.name] ?? "🎁" : "❓"}
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
        )}
      </main>
    </div>
  );
}
