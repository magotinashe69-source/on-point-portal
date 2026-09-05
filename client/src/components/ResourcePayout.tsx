// The "You earned 30 coins, 20 bricks, 20 wood, 1 gem" line shown on the results
// screen and the reward pop-up after a primary student completes an assignment.
// Resources with a zero amount (usually gems on a lower score) are hidden.

import { resourceLabel, type Wallet } from "@shared/dreamworld";

export function ResourcePayout({ payout }: { payout: Wallet }) {
  const parts = [
    { key: "coins" as const, n: payout.coins },
    { key: "bricks" as const, n: payout.bricks },
    { key: "wood" as const, n: payout.wood },
    { key: "gems" as const, n: payout.gems },
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
          {p.n} {resourceLabel(p.key, p.n)}
        </span>
      ))}
    </div>
  );
}
