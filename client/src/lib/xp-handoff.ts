// A tiny in-memory hand-off for the "+X XP" reward moment.
//
// XP is awarded by the server when a submission is marked, and the amount comes
// back in the submit response. But the celebration happens on the results
// screen, which is a separate page. This module carries the just-earned award
// from the submit page to the results page (keyed by submission id).
//
// It intentionally lives only in memory: after a full page reload there is no
// pending award, so the animation never replays when a student revisits their
// old results.

export interface XpAward {
  requested: number;    // XP the attempt was worth before the daily cap
  awarded: number;      // XP actually added after the cap
  dailyCapped: boolean; // true if the daily cap reduced the award
  totalXp: number;      // new lifetime total
  level: number;        // new level
  leveledUp: boolean;   // true if this award crossed into a new level
  breakdown?: {
    correct?: number;
    perCorrect?: number;
    completionBonus?: number;
    improvementBonus?: number;
  };
}

const pending: Record<number, XpAward> = {};

// Remember an award to show on the results screen for this submission.
export function setPendingXp(submissionId: number, award: XpAward): void {
  pending[submissionId] = award;
}

// Read and clear the pending award for a submission (so it only shows once).
export function takePendingXp(submissionId: number): XpAward | undefined {
  const award = pending[submissionId];
  delete pending[submissionId];
  return award;
}

// Turn an award into a short, friendly message. Covers the daily-cap and
// no-improvement cases so the student always sees something encouraging.
export function xpMessage(award: XpAward): string {
  if (award.awarded > 0 && !award.dailyCapped) return `+${award.awarded} XP earned`;
  if (award.awarded > 0 && award.dailyCapped) return `+${award.awarded} XP (daily max reached!)`;
  if (award.awarded === 0 && award.dailyCapped) return `+0 XP (daily max reached — come back tomorrow!)`;
  // awarded 0 and not capped → a retry that didn't beat the previous score
  return `+0 XP — beat your best score for +50!`;
}
