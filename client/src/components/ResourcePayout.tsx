// The "You earned 🪙30 🧱20 🪵20 💎1" line shown on the results screen and the
// reward pop-up after a primary student completes an assignment. Resources with
// a zero amount (usually gems on a lower score) are hidden.

import { RESOURCE_ICON, type Wallet } from "@shared/dreamworld";

export function ResourcePayout({ payout }: { payout: Wallet }) {
  const parts = [
    { icon: RESOURCE_ICON.coins, n: payout.coins },
    { icon: RESOURCE_ICON.bricks, n: payout.bricks },
    { icon: RESOURCE_ICON.wood, n: payout.wood },
    { icon: RESOURCE_ICON.gems, n: payout.gems },
  ].filter((p) => p.n > 0);

  if (parts.length === 0) return null;

  return (
    <div
      className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border bg-muted/40 px-4 py-2 text-sm"
      data-testid="resource-payout"
    >
      <span className="text-muted-foreground">You earned</span>
      {parts.map((p, i) => (
        <span key={i} className="font-bold tabular-nums">
          <span aria-hidden="true">{p.icon}</span>
          {p.n}
        </span>
      ))}
    </div>
  );
}
