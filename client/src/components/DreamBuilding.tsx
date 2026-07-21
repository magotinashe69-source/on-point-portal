// Flat SVG for each Dream World building, drawn in a 40-unit tile (the football
// field spans an 80-unit 2x2 block). No images, no gradients beyond flat fills —
// so it stays crisp and light on a cheap Android. Used both on the plot grid and
// as the little previews in the build menu.

import type { BuildingId } from "@shared/dreamworld";

export const TILE = 40; // pixels-ish per tile in the SVG's own coordinate space

export function DreamBuilding({ id }: { id: BuildingId }) {
  switch (id) {
    case "house":
      return (
        <g>
          <rect x="9" y="17" width="22" height="17" rx="1" fill="#EAD1A6" stroke="#9C7A45" strokeWidth="1" />
          <polygon points="6,18 20,6 34,18" fill="#C55A3B" stroke="#8F3F2A" strokeWidth="1" strokeLinejoin="round" />
          <rect x="17" y="24" width="6" height="10" rx="0.5" fill="#8A5A2B" />
          <rect x="12" y="20" width="5" height="4" fill="#BFE3F2" stroke="#9C7A45" strokeWidth="0.6" />
        </g>
      );
    case "tree":
      return (
        <g>
          <rect x="18" y="24" width="4" height="10" rx="1" fill="#7C4A24" />
          <circle cx="15" cy="18" r="7" fill="#4FAE5E" />
          <circle cx="20" cy="14" r="8" fill="#47A457" />
          <circle cx="25" cy="19" r="7" fill="#3F9B50" />
        </g>
      );
    case "road":
      return (
        <g>
          <rect x="2" y="2" width="36" height="36" rx="1.5" fill="#8B9096" />
          <line x1="20" y1="4" x2="20" y2="36" stroke="#F2F2F2" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
        </g>
      );
    case "flower":
      return (
        <g>
          <rect x="2" y="2" width="36" height="36" rx="4" fill="#86CF63" />
          <Flower cx="12" cy="14" petal="#E86A9A" />
          <Flower cx="27" cy="13" petal="#F4C430" />
          <Flower cx="14" cy="27" petal="#B57CE0" />
          <Flower cx="28" cy="27" petal="#EC6B5A" />
        </g>
      );
    case "field":
      return (
        <g>
          <rect x="4" y="10" width="72" height="60" rx="2" fill="#3FA35A" stroke="#F4F7F5" strokeWidth="2" />
          <line x1="40" y1="10" x2="40" y2="70" stroke="#F4F7F5" strokeWidth="1.6" />
          <circle cx="40" cy="40" r="9" fill="none" stroke="#F4F7F5" strokeWidth="1.6" />
          <circle cx="40" cy="40" r="1.6" fill="#F4F7F5" />
          <rect x="30" y="10" width="20" height="5" fill="none" stroke="#F4F7F5" strokeWidth="1.4" />
          <rect x="30" y="65" width="20" height="5" fill="none" stroke="#F4F7F5" strokeWidth="1.4" />
        </g>
      );
    default:
      return null;
  }
}

// A tiny four-petal flower.
function Flower({ cx, cy, petal }: { cx: string; cy: string; petal: string }) {
  const x = Number(cx);
  const y = Number(cy);
  return (
    <g>
      <circle cx={x} cy={y - 3} r="2.4" fill={petal} />
      <circle cx={x + 3} cy={y} r="2.4" fill={petal} />
      <circle cx={x} cy={y + 3} r="2.4" fill={petal} />
      <circle cx={x - 3} cy={y} r="2.4" fill={petal} />
      <circle cx={x} cy={y} r="2" fill="#FFF4C2" />
    </g>
  );
}
