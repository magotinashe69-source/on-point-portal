// A small flame + day-count chip for the student dashboard, shown next to the
// XP bar. The data comes from the dashboard's existing stats request, so this
// adds no extra network call. Any freezes the student is holding show as tiny
// snowflakes, so they know they are protected against missing a day.

const GOLD = "#BF9000";

interface StreakFlameProps {
  current: number;    // current streak length in days
  freezes: number;    // streak freezes held (0..2)
  maxFreezes: number; // the cap (for the tooltip)
}

export function StreakFlame({ current, freezes, maxFreezes }: StreakFlameProps) {
  const hasStreak = current > 0;

  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2 mb-6 shrink-0"
      data-testid="streak-flame"
      title={
        hasStreak
          ? `${current}-day streak${freezes > 0 ? ` — ${freezes}/${maxFreezes} freezes held` : ""}`
          : "Complete an assignment today to start a streak!"
      }
    >
      {/* A bright flame while the streak is alive; a dim one at zero. */}
      <span className={`text-xl ${hasStreak ? "" : "grayscale opacity-50"}`} aria-hidden="true">
        🔥
      </span>

      <div className="leading-tight">
        <div className="text-sm font-bold tabular-nums" style={{ color: hasStreak ? GOLD : undefined }}>
          <span data-testid="text-streak-days">{current}</span> day{current === 1 ? "" : "s"}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {freezes > 0 ? (
            <span data-testid="text-streak-freezes">
              {"❄️".repeat(freezes)} {freezes} freeze{freezes === 1 ? "" : "s"}
            </span>
          ) : (
            "day streak"
          )}
        </div>
      </div>
    </div>
  );
}
