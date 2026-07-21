// Rewards logic (gamification foundation).
//
// Right now this holds a single internal helper: give a student a random
// Treasure Hunt collectible for finishing an assignment. It is intentionally
// NOT wired into any route or screen yet — it is the building block a later
// step will call after an assignment is completed.

import { storage } from "./storage";
import { COLLECTIBLES } from "@shared/collectibles";
import type { StudentReward } from "@shared/schema";

// Award one collectible to a student for a completed assignment. Prefers a
// collectible they don't have yet, so that finishing assignments actually
// works towards "collect all 12" (no duplicates until the set is complete).
// Once every collectible is earned, it falls back to a random one so the
// chest-opening reward moment still plays.
export async function awardRandomCollectible(
  studentId: number,
  assignmentId: number,
): Promise<StudentReward> {
  const earned = new Set((await storage.getStudentRewards(studentId)).map((r) => r.rewardName));
  const unearned = COLLECTIBLES.filter((c) => !earned.has(c.name));
  const pool = unearned.length > 0 ? unearned : COLLECTIBLES;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  return storage.createStudentReward({
    studentId,
    rewardType: "collectible",
    rewardName: pick.name,
    assignmentId,
  });
}
