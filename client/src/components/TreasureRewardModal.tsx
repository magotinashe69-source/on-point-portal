// The reward pop-up that appears when a primary student finishes an assignment
// and earns a Treasure Hunt collectible. It plays a short chest-opening
// animation and reveals the treasure they found. Pure CSS animation — no extra
// libraries — and it politely stops moving if the child prefers reduced motion.

import { Button } from "@/components/ui/button";
import { COLLECTIBLES } from "@shared/collectibles";
import { collectibleEmoji } from "@/lib/collectible-emoji";

interface TreasureRewardModalProps {
  rewardName: string;    // e.g. "Golden Compass"
  onClose: () => void;   // "Continue" — usually back to the dashboard
  onViewMap: () => void; // "See it on the map" — go to Treasure Island
}

export function TreasureRewardModal({ rewardName, onClose, onViewMap }: TreasureRewardModalProps) {
  const emoji = collectibleEmoji(rewardName);
  const description = COLLECTIBLES.find((c) => c.name === rewardName)?.description ?? "";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`You earned a treasure: ${rewardName}`}
      onClick={onClose}
      data-testid="modal-treasure-reward"
    >
      {/* The keyframes for the whole reveal, scoped by the trm- class names. */}
      <style>{`
        @keyframes trm-pop { 0% { transform: scale(.7); opacity: 0 } 60% { transform: scale(1.03) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes trm-shake { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-3deg) } 40% { transform: rotate(3deg) } 60% { transform: rotate(-2deg) } 80% { transform: rotate(2deg) } }
        @keyframes trm-lid { 0% { transform: translateY(0) rotate(0) } 70% { transform: translateY(-34px) rotate(-13deg) } 100% { transform: translateY(-30px) rotate(-11deg) } }
        @keyframes trm-rise { 0% { transform: translateY(8px) scale(.2); opacity: 0 } 70% { transform: translateY(-30px) scale(1.15); opacity: 1 } 100% { transform: translateY(-24px) scale(1); opacity: 1 } }
        @keyframes trm-glow { 0% { transform: scale(0); opacity: 0 } 70% { transform: scale(1); opacity: .9 } 100% { transform: scale(1.05); opacity: .75 } }
        @keyframes trm-sparkle { 0%,100% { transform: scale(.4); opacity: 0 } 50% { transform: scale(1); opacity: 1 } }

        .trm-card    { animation: trm-pop .45s ease-out both; }
        .trm-shake   { animation: trm-shake .6s ease-in-out .2s both; transform-box: fill-box; transform-origin: center; }
        .trm-lid     { animation: trm-lid .7s cubic-bezier(.2,.8,.3,1) .85s both; transform-box: fill-box; transform-origin: center; }
        .trm-treasure{ animation: trm-rise .7s cubic-bezier(.2,.8,.3,1) 1.05s both; transform-box: fill-box; transform-origin: center bottom; }
        .trm-glow    { animation: trm-glow .8s ease-out 1s both; transform-box: fill-box; transform-origin: center; }
        .trm-sparkle { animation: trm-sparkle 1.3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        .trm-sparkle-2 { animation-delay: .4s; }
        .trm-sparkle-3 { animation-delay: .8s; }

        /* Some children prefer less motion — jump to the opened state instead. */
        @media (prefers-reduced-motion: reduce) {
          .trm-card, .trm-shake, .trm-lid, .trm-treasure, .trm-glow, .trm-sparkle {
            animation-duration: .001s !important;
            animation-delay: 0s !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <div
        className="trm-card w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <svg viewBox="0 0 240 210" className="w-full h-auto max-h-64" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="trmWood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c07d3a" />
              <stop offset="100%" stopColor="#9a5f28" />
            </linearGradient>
            <radialGradient id="trmGlow">
              <stop offset="0%" stopColor="#fff3c4" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#f6b93b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f6b93b" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Burst of light behind the treasure. */}
          <g className="trm-glow">
            <circle cx="120" cy="92" r="46" fill="url(#trmGlow)" />
          </g>

          {/* The chest — a little anticipation shake, then the lid swings open. */}
          <g className="trm-shake">
            {/* Body. */}
            <path
              d="M 60 120 h 120 v 44 q 0 8 -8 8 h -104 q -8 0 -8 -8 z"
              fill="url(#trmWood)"
              stroke="#5e3a18"
              strokeWidth="2"
            />
            {/* Dark open mouth with gold inside. */}
            <path d="M 70 120 h 100 v 6 q 0 4 -4 4 h -92 q -4 0 -4 -4 z" fill="#2e1c0e" />
            <ellipse cx="120" cy="125" rx="46" ry="6" fill="#f6b93b" />

            {/* Lid — starts closed on the seam, then lifts open. */}
            <g className="trm-lid">
              <path
                d="M 60 120 v -6 q 0 -30 60 -30 q 60 0 60 30 v 6 z"
                fill="url(#trmWood)"
                stroke="#5e3a18"
                strokeWidth="2"
              />
              <rect x="60" y="112" width="120" height="7" fill="#6b4a22" />
              <rect x="111" y="108" width="18" height="15" rx="2" fill="#f6b93b" stroke="#5e3a18" strokeWidth="1" />
              <circle cx="120" cy="115" r="2" fill="#5e3a18" />
            </g>
          </g>

          {/* The treasure you found, rising out of the chest. */}
          <g className="trm-treasure">
            <text x="120" y="116" textAnchor="middle" dominantBaseline="central" fontSize="48">{emoji}</text>
          </g>

          {/* A few twinkling sparkles. */}
          <text className="trm-sparkle" x="74" y="86" textAnchor="middle" dominantBaseline="central" fontSize="18">✨</text>
          <text className="trm-sparkle trm-sparkle-2" x="168" y="98" textAnchor="middle" dominantBaseline="central" fontSize="16">✨</text>
          <text className="trm-sparkle trm-sparkle-3" x="150" y="66" textAnchor="middle" dominantBaseline="central" fontSize="14">✨</text>
        </svg>

        <p className="text-sm font-semibold uppercase tracking-wide text-primary mt-2">Treasure Found!</p>
        <h2 className="text-2xl font-bold mt-1" data-testid="text-reward-name">{rewardName}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        <p className="text-xs text-muted-foreground mt-3">Added to your Treasure Island collection 🏝️</p>

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={onViewMap} data-testid="button-view-treasure-map">
            See it on the map
          </Button>
          <Button className="flex-1" onClick={onClose} data-testid="button-reward-continue">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
