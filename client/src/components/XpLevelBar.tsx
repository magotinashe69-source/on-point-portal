// A slim level + XP progress bar for the student dashboard.
//
// It shows the student's current level and how close they are to the next one.
// The data comes from the dashboard's existing stats request, so this adds no
// extra network call. Brand colours: navy track, gold fill and level chip.

const GOLD = "#BF9000";
const NAVY = "#1F3864";

interface XpLevelBarProps {
  level: number;
  xpIntoLevel: number;    // XP earned within the current level
  xpForNextLevel: number; // XP needed to fill a level (500)
  progressPercent: number;// 0..100 towards the next level
}

export function XpLevelBar({ level, xpIntoLevel, xpForNextLevel, progressPercent }: XpLevelBarProps) {
  // Clamp so a full bar never overflows its track.
  const width = Math.max(0, Math.min(100, progressPercent));

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2 mb-6"
      data-testid="xp-level-bar"
    >
      {/* Level chip. */}
      <div
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0"
        style={{ backgroundColor: GOLD, color: "#fff" }}
      >
        <span aria-hidden="true">⭐</span>
        <span data-testid="text-xp-level">Level {level}</span>
      </div>

      {/* Progress track + gold fill. */}
      <div className="flex-1">
        <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: `${NAVY}22` }}>
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${width}%`, background: `linear-gradient(90deg, ${GOLD}, #E0B93A)` }}
          />
        </div>
      </div>

      {/* Progress text. */}
      <span className="text-xs font-medium text-muted-foreground shrink-0 tabular-nums" data-testid="text-xp-progress">
        {xpIntoLevel} / {xpForNextLevel} XP
      </span>
    </div>
  );
}
