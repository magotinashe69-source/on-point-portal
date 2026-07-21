// The 8x8 town plot, drawn as one scalable SVG. Shared by the student's own
// editable plot and the read-only "visit a classmate" view. Ambient life
// (chimney smoke, swaying trees, a blinking Laboratory light, a waving School
// flag, and drifting birds) is pure CSS on a handful of elements, so it costs
// almost nothing and switches off under prefers-reduced-motion.

import { GRID_SIZE, buildingById, occupiedCells, type Placed } from "@shared/dreamworld";
import { DreamBuilding, TILE } from "@/components/DreamBuilding";

const SIZE_PX = GRID_SIZE * TILE;

const AMBIENT_CSS = `
@keyframes dw-pop { 0% { transform: scale(.5); opacity: 0 } 65% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
.dw-pop { animation: dw-pop .42s cubic-bezier(.2,.8,.3,1) both; transform-box: fill-box; transform-origin: center bottom; }
.dw-live .dw-smoke { animation: dw-smoke 3.4s ease-in infinite; transform-box: fill-box; transform-origin: center; }
.dw-live .dw-smoke-2 { animation-delay: 1.7s; }
@keyframes dw-smoke { 0% { transform: translateY(1px) scale(.5); opacity: 0 } 25% { opacity: .5 } 100% { transform: translateY(-8px) scale(1.3); opacity: 0 } }
.dw-live .dw-sway { animation: dw-sway 4.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
@keyframes dw-sway { 0%,100% { transform: rotate(-2deg) } 50% { transform: rotate(2deg) } }
.dw-live .dw-blink { animation: dw-blink 1.8s steps(1,end) infinite; }
@keyframes dw-blink { 0%,55% { opacity: 1 } 56%,100% { opacity: .18 } }
.dw-live .dw-wave { animation: dw-wave 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: left center; }
@keyframes dw-wave { 0%,100% { transform: skewX(0) } 50% { transform: skewX(-7deg) skewY(1.5deg) } }
.dw-bird { animation-name: dw-bird; animation-timing-function: linear; animation-iteration-count: infinite; }
@keyframes dw-bird { 0% { transform: translateX(-16px) } 100% { transform: translateX(${SIZE_PX + 16}px) } }
@media (prefers-reduced-motion: reduce) {
  .dw-pop, .dw-sway, .dw-blink, .dw-wave { animation: none !important; }
  .dw-smoke, .dw-bird { display: none !important; }
}
`;

const BIRDS = [
  { y: 26, dur: "17s", delay: "0s" },
  { y: 48, dur: "23s", delay: "7s" },
  { y: 64, dur: "19s", delay: "13s" },
];

interface TownPlotProps {
  layout: Placed[];
  popping?: string | null;              // "x,y" of a building animating in
  onTileTap?: (x: number, y: number) => void;
  interactive?: boolean;                // false = read-only (visiting)
}

export function TownPlot({ layout, popping, onTileTap, interactive = false }: TownPlotProps) {
  const tap = interactive && onTileTap ? onTileTap : undefined;

  return (
    <div className="rounded-xl border overflow-hidden shadow-sm bg-[#8FD673] dark:bg-[#3c6b39]">
      <style>{AMBIENT_CSS}</style>
      <svg
        viewBox={`0 0 ${SIZE_PX} ${SIZE_PX}`}
        className="dw-live w-full h-auto block touch-manipulation"
        role="img"
        aria-label="Town plot, an 8 by 8 grid"
      >
        {Array.from({ length: GRID_SIZE }).map((_, y) =>
          Array.from({ length: GRID_SIZE }).map((_, x) => (
            <rect
              key={`t${x}-${y}`}
              x={x * TILE} y={y * TILE} width={TILE} height={TILE}
              fill={(x + y) % 2 === 0 ? "#8FD673" : "#83CD66"}
              stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1"
              onClick={tap ? () => tap(x, y) : undefined}
              style={tap ? { cursor: "pointer" } : undefined}
              data-testid={`tile-${x}-${y}`}
            />
          )),
        )}

        {layout.map((b, i) => (
          <g
            key={`b${i}-${b.id}-${b.x}-${b.y}`}
            transform={`translate(${b.x * TILE} ${b.y * TILE})`}
            className={popping === `${b.x},${b.y}` ? "dw-pop" : undefined}
            onClick={tap ? () => tap(b.x, b.y) : undefined}
            style={tap ? { cursor: "pointer" } : undefined}
            data-testid={`placed-${b.id}-${b.x}-${b.y}`}
          >
            <title>{buildingById(b.id)?.name}</title>
            <DreamBuilding id={b.id} />
          </g>
        ))}

        {/* Drifting birds — drawn last so they pass over the town. */}
        {BIRDS.map((b, i) => (
          <path
            key={`bird${i}`}
            className="dw-bird"
            style={{ animationDuration: b.dur, animationDelay: b.delay }}
            d={`M -10 ${b.y} q 3 -3 6 0 q 3 -3 6 0`}
            fill="none" stroke="#586170" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"
          />
        ))}
      </svg>
    </div>
  );
}

// Re-exported so callers don't also need to import occupiedCells separately.
export { occupiedCells };
