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

    // ---- Maths ----
    case "bank":
      return (
        <g>
          <rect x="6" y="31" width="28" height="4" rx="0.5" fill="#B7AE9C" />
          <rect x="8" y="17" width="24" height="14" fill="#ECE8DE" stroke="#B7AE9C" strokeWidth="1" />
          <polygon points="5,17 20,7 35,17" fill="#D8D1C0" stroke="#AEA690" strokeWidth="1" strokeLinejoin="round" />
          <rect x="11" y="19" width="3" height="12" fill="#FBFAF6" />
          <rect x="18.5" y="19" width="3" height="12" fill="#FBFAF6" />
          <rect x="26" y="19" width="3" height="12" fill="#FBFAF6" />
          <circle cx="20" cy="12.5" r="2.6" fill="#E8B23A" stroke="#B0851E" strokeWidth="0.6" />
        </g>
      );
    case "engineering":
      return (
        <g>
          <rect x="10" y="36" width="60" height="36" fill="#9BA6B0" stroke="#6E7A85" strokeWidth="1.5" />
          <polygon points="10,36 21,26 21,36" fill="#7E8A95" />
          <polygon points="21,36 32,26 32,36" fill="#7E8A95" />
          <polygon points="32,36 43,26 43,36" fill="#7E8A95" />
          <rect x="52" y="18" width="8" height="20" fill="#7E8A95" />
          <Gear cx={40} cy={54} r={11} fill="#C98A3C" stroke="#9C6A26" hub="#9BA6B0" />
        </g>
      );

    // ---- English ----
    case "library":
      return (
        <g>
          <rect x="6" y="31" width="28" height="4" rx="0.5" fill="#9C7A45" />
          <rect x="8" y="17" width="24" height="14" fill="#C9A66B" stroke="#8F6A38" strokeWidth="1" />
          <polygon points="5,17 20,8 35,17" fill="#8F6A38" strokeLinejoin="round" />
          <path d="M 20 22 L 12 20.5 L 12 28 L 20 29.5 Z" fill="#FBF7EC" stroke="#8F6A38" strokeWidth="0.7" />
          <path d="M 20 22 L 28 20.5 L 28 28 L 20 29.5 Z" fill="#FBF7EC" stroke="#8F6A38" strokeWidth="0.7" />
          <line x1="20" y1="22" x2="20" y2="29.5" stroke="#8F6A38" strokeWidth="0.7" />
        </g>
      );
    case "theatre":
      return (
        <g>
          <rect x="8" y="20" width="64" height="52" rx="2" fill="#6E2333" stroke="#4A1522" strokeWidth="1.5" />
          <rect x="16" y="30" width="48" height="36" rx="1" fill="#2A0E15" />
          <path d="M 16 30 q 8 10 0 36 z" fill="#B23A4A" />
          <path d="M 64 30 q -8 10 0 36 z" fill="#B23A4A" />
          <path d="M 30 30 q 10 8 20 0 z" fill="#C24A5A" />
          <polygon points="40,12 43,19 50,19 44,23 46,30 40,26 34,30 36,23 30,19 37,19" fill="#F0C64A" />
        </g>
      );

    // ---- Science ----
    case "laboratory":
      return (
        <g>
          <rect x="7" y="16" width="26" height="18" rx="1" fill="#EEF3F1" stroke="#9FB4AD" strokeWidth="1" />
          <polygon points="6,16 20,8 34,16" fill="#CBD8D3" stroke="#9FB4AD" strokeWidth="1" strokeLinejoin="round" />
          <path d="M 17 19 h 6 v 4 l 4 8 a 2 2 0 0 1 -2 3 h -10 a 2 2 0 0 1 -2 -3 l 4 -8 z" fill="#DFF3EA" stroke="#5EA98A" strokeWidth="1" />
          <path d="M 14.5 27 h 11 l 1.5 4 a 2 2 0 0 1 -2 3 h -10 a 2 2 0 0 1 -2 -3 z" fill="#3FBE86" />
          <circle cx="19" cy="30" r="1" fill="#DFF3EA" />
          <circle cx="23" cy="31" r="0.8" fill="#DFF3EA" />
        </g>
      );
    case "hospital":
      return (
        <g>
          <rect x="10" y="18" width="60" height="54" rx="2" fill="#F2F5F6" stroke="#BFCBD0" strokeWidth="1.5" />
          <rect x="34" y="26" width="12" height="4" fill="#D9463E" />
          <rect x="38" y="22" width="4" height="12" fill="#D9463E" />
          <rect x="34" y="52" width="12" height="20" fill="#C7D2D6" />
          <rect x="16" y="40" width="8" height="8" fill="#BFE0EC" />
          <rect x="56" y="40" width="8" height="8" fill="#BFE0EC" />
        </g>
      );

    // ---- Computing / ICT ----
    case "robot_kiosk":
      return (
        <g>
          <rect x="18" y="30" width="4" height="6" fill="#8A8F98" />
          <rect x="9" y="12" width="22" height="20" rx="2" fill="#5A6B8C" stroke="#3C4A66" strokeWidth="1" />
          <rect x="12" y="15" width="16" height="14" rx="1" fill="#B7E4F2" />
          <circle cx="17" cy="21" r="1.8" fill="#2C3E66" />
          <circle cx="23" cy="21" r="1.8" fill="#2C3E66" />
          <path d="M 17 25 q 3 2 6 0" fill="none" stroke="#2C3E66" strokeWidth="1" strokeLinecap="round" />
          <line x1="20" y1="12" x2="20" y2="8" stroke="#3C4A66" strokeWidth="1" />
          <circle cx="20" cy="7" r="1.6" fill="#F0C64A" />
        </g>
      );
    case "robot_factory":
      return (
        <g>
          <rect x="10" y="34" width="60" height="38" fill="#5A6B8C" stroke="#3C4A66" strokeWidth="1.5" />
          <polygon points="10,34 22,24 22,34" fill="#47567A" />
          <polygon points="22,34 34,24 34,34" fill="#47567A" />
          <polygon points="34,34 46,24 46,34" fill="#47567A" />
          <rect x="24" y="44" width="20" height="20" rx="2" fill="#B7C4DC" stroke="#3C4A66" strokeWidth="1" />
          <circle cx="30" cy="52" r="2.2" fill="#2C3E66" />
          <circle cx="38" cy="52" r="2.2" fill="#2C3E66" />
          <rect x="29" y="58" width="10" height="2.4" rx="1" fill="#2C3E66" />
          <Gear cx={58} cy={52} r={9} fill="#C98A3C" stroke="#9C6A26" hub="#5A6B8C" />
        </g>
      );

    // ---- Universal ----
    case "school":
      return (
        <g>
          <rect x="8" y="34" width="64" height="38" fill="#E6C79A" stroke="#B8925E" strokeWidth="1.5" />
          <polygon points="8,34 40,20 72,34" fill="#B45A3C" stroke="#8F3F2A" strokeWidth="1" strokeLinejoin="round" />
          <rect x="34" y="8" width="12" height="16" fill="#C96A4A" stroke="#8F3F2A" strokeWidth="1" />
          <polygon points="34,8 40,2 46,8" fill="#8F3F2A" />
          <circle cx="40" cy="16" r="3.4" fill="#FBF3DC" stroke="#8F3F2A" strokeWidth="0.8" />
          <line x1="40" y1="16" x2="40" y2="13.5" stroke="#8F3F2A" strokeWidth="0.7" />
          <line x1="40" y1="16" x2="42" y2="16" stroke="#8F3F2A" strokeWidth="0.7" />
          <rect x="34" y="56" width="12" height="16" fill="#8A5A32" />
          <rect x="16" y="44" width="10" height="9" fill="#BFE0EC" stroke="#B8925E" strokeWidth="0.8" />
          <rect x="54" y="44" width="10" height="9" fill="#BFE0EC" stroke="#B8925E" strokeWidth="0.8" />
        </g>
      );

    default:
      return null;
  }
}

// A simple cog/gear: a hub circle with eight teeth around a body circle.
function Gear({ cx, cy, r, fill, stroke, hub }: { cx: number; cy: number; r: number; fill: string; stroke: string; hub: string }) {
  const teeth = Array.from({ length: 8 }).map((_, i) => {
    const a = (i * Math.PI) / 4;
    return { x: cx + Math.cos(a) * (r + 1.5), y: cy + Math.sin(a) * (r + 1.5) };
  });
  return (
    <g stroke={stroke} strokeWidth="1">
      {teeth.map((t, i) => (
        <rect key={i} x={t.x - 2} y={t.y - 2} width="4" height="4" fill={fill} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <circle cx={cx} cy={cy} r={r * 0.38} fill={hub} strokeWidth="0" />
    </g>
  );
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
