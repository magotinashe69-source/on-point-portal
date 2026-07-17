// The "+X XP earned" reward moment.
//
// Shows a small gold chip that pops in after a submission is marked. A bigger
// celebration — a burst of stars plus a "Level N reached!" line — appears ONLY
// when the student levels up, not on every submission. Pure CSS animation, and
// it respects a reduced-motion preference.

import { XpAward, xpMessage } from "@/lib/xp-handoff";

const GOLD = "#BF9000";

// Eight directions the level-up stars fly out towards (points on a circle).
const STAR_DIRECTIONS = [
  [46, 0], [33, 33], [0, 46], [-33, 33],
  [-46, 0], [-33, -33], [0, -46], [33, -33],
];

export function XpRewardBadge({ award }: { award: XpAward }) {
  const positive = award.awarded > 0;

  return (
    <div className="relative inline-flex flex-col items-center gap-1.5" data-testid="xp-reward-badge">
      <style>{`
        @keyframes xprb-pop { 0% { transform: scale(.5); opacity: 0 } 60% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes xprb-burst { 0% { transform: translate(0,0) scale(.3); opacity: 0 } 25% { opacity: 1 } 100% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 0 } }
        .xprb-chip { animation: xprb-pop .5s ease-out both; }
        .xprb-levelup { animation: xprb-pop .5s ease-out .25s both; }
        .xprb-star { position: absolute; left: 50%; top: 10px; animation: xprb-burst .9s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .xprb-chip, .xprb-levelup, .xprb-star { animation-duration: .001s !important; animation-delay: 0s !important; }
        }
      `}</style>

      {/* Level-up star burst — only when they actually leveled up. */}
      {award.leveledUp && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0" aria-hidden="true">
          {STAR_DIRECTIONS.map(([tx, ty], i) => (
            <span
              key={i}
              className="xprb-star text-lg"
              style={{ ["--tx" as string]: `${tx}px`, ["--ty" as string]: `${ty}px`, animationDelay: `${i * 0.03}s` }}
            >
              ⭐
            </span>
          ))}
        </div>
      )}

      {/* The XP chip. Gold when XP was earned; muted when it was 0. */}
      <div
        className={`xprb-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
          positive ? "text-white shadow-sm" : "bg-muted text-muted-foreground"
        }`}
        style={positive ? { background: `linear-gradient(90deg, ${GOLD}, #E0B93A)` } : undefined}
      >
        <span aria-hidden="true">⚡</span>
        <span data-testid="text-xp-message">{xpMessage(award)}</span>
      </div>

      {/* The level-up line. */}
      {award.leveledUp && (
        <div className="xprb-levelup text-sm font-extrabold" style={{ color: GOLD }} data-testid="text-level-up">
          🎉 Level {award.level} reached!
        </div>
      )}
    </div>
  );
}
