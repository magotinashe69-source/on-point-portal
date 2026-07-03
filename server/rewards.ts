// Rewards logic (gamification foundation).
//
// Right now this holds a single internal helper: give a student a random
// Treasure Hunt collectible for finishing an assignment. It is intentionally
// NOT wired into any route or screen yet — it is the building block a later
// step will call after an assignment is completed.

import { storage } from "./storage";
import { COLLECTIBLES } from "@shared/collectibles";
import type { StudentReward } from "@shared/schema";

// Award one random collectible to a student for a completed assignment.
// Returns the saved reward row so a caller could show it to the student later.
export async function awardRandomCollectible(
  studentId: number,
  assignmentId: number,
): Promise<StudentReward> {
  // Pick a random item from the 12-collectible set.
  const pick = COLLECTIBLES[Math.floor(Math.random() * COLLECTIBLES.length)];

  return storage.createStudentReward({
    studentId,
    rewardType: "collectible",
    rewardName: pick.name,
    assignmentId,
  });
}
