// A tiny in-memory hand-off for the Dream World resource payout, mirroring the
// XP hand-off. Resources are awarded by the server when a submission is marked
// and come back in the submit response; the celebration shows on the results
// screen (a separate page). This carries the just-earned payout across, keyed
// by submission id. It lives only in memory, so it never replays on reload.

import type { Wallet } from "@shared/dreamworld";

const pending: Record<number, Wallet> = {};

export function setPendingResources(submissionId: number, payout: Wallet): void {
  pending[submissionId] = payout;
}

export function takePendingResources(submissionId: number): Wallet | undefined {
  const payout = pending[submissionId];
  delete pending[submissionId];
  return payout;
}
