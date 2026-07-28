// Penalty Shootout — the pure rules of the football quiz game.
//
// Like shared/auto-marking.ts this is a "pure" module: every function just
// turns inputs into outputs, with no database or network access. It is shared
// by the server (which builds the games) and the client (which draws them).
//
// IMPORTANT: this file never decides whether an answer is right. Marking is
// done by the existing auto-marker (shared/auto-marking.ts), untouched. All
// this file does is turn a teacher's question into a row of big touch buttons
// a child can tap on a phone.

import type { Question } from "./auto-marking";

// --- Game shape -----------------------------------------------------------
// Every game is the same: 5 penalties taken, then 5 saved, and no question is
// ever asked twice. That fixed shape is what makes scores worth comparing.
export const SHOTS_PER_ROUND = 5;
export const TOTAL_SHOTS = SHOTS_PER_ROUND * 2; // always 10 questions
export const XP_PER_CORRECT_ANSWER = 2; // fed into the existing capped XP system
export const ANSWER_REVEAL_MS = 3000;   // how long a missed answer stays on screen

// Because a game needs 10 different questions, a subject with fewer than that
// simply isn't offered yet — better than a half-length game or the same
// question twice. Teachers just need to set a few more quiz questions.
export const MIN_QUESTIONS = TOTAL_SHOTS;

export function canPlay(availableQuestions: number): boolean {
  return availableQuestions >= MIN_QUESTIONS;
}

// Is a personal best beaten? Every game is 10 shots, so this is a plain
// comparison. bestOutOf is still carried alongside so a score always displays
// against the length it was scored over, and rows saved before that was
// recorded (bestOutOf 0) read as "no record yet" and reset on the next game.
export function beatsRecord(
  score: number, outOf: number, bestScore: number, bestOutOf: number,
): boolean {
  if (outOf <= 0) return false;
  if (bestOutOf <= 0) return score > 0; // no real record yet
  return score / outOf > bestScore / bestOutOf;
}

export type Round = "striker" | "keeper";
export const CORNERS = ["left", "middle", "right"] as const;
export type Corner = (typeof CORNERS)[number];

// One tappable button. `label` is what the child reads; `value` is exactly the
// answerText to send back, in the form the auto-marker already expects
// (an option index for multiple choice, "true"/"false", or the number typed out).
export interface ShotOption {
  label: string;
  value: string;
}

// A question as the CHILD sees it — deliberately with no answer key. These
// questions come from real homework, so the correct answer must never be sent
// to the browser.
export interface Shot {
  // Which question this is. Question ids ("q1", "q2") are only unique WITHIN an
  // assignment — the same "q1" exists in dozens of them — so a shot has to name
  // the assignment too, or the wrong question gets marked. The browser just
  // hands this back untouched.
  ref: string;
  round: Round;
  index: number;        // 0-4 within its round
  questionText: string;
  options: ShotOption[];
}

// Build and read that reference. Assignment ids are numbers, so a colon can
// never appear in the first half.
export function makeRef(assignmentId: number, questionId: string): string {
  return `${assignmentId}:${questionId}`;
}

export function readRef(ref: string): { assignmentId: number; questionId: string } | null {
  const at = String(ref ?? "").indexOf(":");
  if (at <= 0) return null;
  const assignmentId = Number(ref.slice(0, at));
  const questionId = ref.slice(at + 1);
  if (!Number.isInteger(assignmentId) || !questionId) return null;
  return { assignmentId, questionId };
}

// The question types this game can turn into buttons. "written" is hand-marked
// and short_text rarely has enough wrong answers to choose from, so neither is
// used here.
export const PLAYABLE_TYPES = ["multiple_choice", "true_false", "numeric"] as const;

export function isPlayable(q: Pick<Question, "type">): boolean {
  return !!q.type && (PLAYABLE_TYPES as readonly string[]).includes(q.type);
}

// --- Small helpers --------------------------------------------------------

// Fisher-Yates shuffle on a copy, using a supplied random function so tests can
// make it predictable.
export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Wrong numbers to sit beside the right one. We prefer real answers from other
// questions in the same subject (they look plausible), then fall back to
// near-misses. Anything within the question's tolerance is skipped, because the
// auto-marker would count it as correct too.
function numericDistractors(correct: number, tolerance: number, pool: number[]): number[] {
  const tooClose = (n: number) => Math.abs(n - correct) <= Math.max(tolerance, 0);
  const picked: number[] = [];
  const add = (n: number) => {
    if (!Number.isFinite(n)) return;
    if (tooClose(n)) return;
    if (picked.some((p) => Math.abs(p - n) <= Math.max(tolerance, 0))) return;
    picked.push(n);
  };

  for (const n of pool) {
    if (picked.length >= 3) break;
    add(n);
  }
  // Near-misses, in a fixed order so a game is reproducible from its seed.
  const step = Math.max(1, Math.abs(Math.round(correct * 0.1)) || 1);
  for (const delta of [step, -step, step * 2, -step * 2, 10, -10, 1, -1]) {
    if (picked.length >= 3) break;
    const candidate = correct + delta;
    // Keep answers sensible for young children: no negatives unless the real
    // answer is negative too.
    if (candidate < 0 && correct >= 0) continue;
    add(candidate);
  }
  return picked.slice(0, 3);
}

// Tidy a number for display: drop a trailing ".0" so 4 shows as "4".
function showNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

// Turn one question into a row of buttons. Returns null when the question
// can't be made into buttons (for example a numeric with no wrong answers
// available), so the caller can simply skip it.
export function buildShotOptions(
  q: Question,
  numericPool: number[] = [],
  rand: () => number = Math.random,
): ShotOption[] | null {
  switch (q.type) {
    case "multiple_choice": {
      const options = q.options ?? [];
      if (options.length < 2 || q.correctOption == null) return null;
      // Keep each option's ORIGINAL index as its value — that is what the
      // auto-marker compares against — then shuffle, so the order gives
      // nothing away.
      return shuffle(options.map((label, i) => ({ label, value: String(i) })), rand);
    }

    case "true_false": {
      if (q.correctBool == null) return null;
      // Always shown in the same order: children find a moving True/False
      // confusing, and the order reveals nothing on its own.
      return [
        { label: "True", value: "true" },
        { label: "False", value: "false" },
      ];
    }

    case "numeric": {
      if (q.correctNumber == null) return null;
      const wrong = numericDistractors(q.correctNumber, q.tolerance ?? 0, numericPool);
      if (wrong.length === 0) return null; // nothing to choose between
      const all = [q.correctNumber, ...wrong].map((n) => ({
        label: showNumber(n),
        value: showNumber(n),
      }));
      return shuffle(all, rand);
    }

    default:
      return null;
  }
}

// How the child's score reads on the results screen. Judged as a share of the
// game, since games can be different lengths.
export function scoreLine(score: number, outOf: number): string {
  if (outOf <= 0) return "Have a go!";
  if (score === outOf) return "Perfect! Every single one! 🏆";
  const share = score / outOf;
  if (share >= 0.8) return "Brilliant shooting! ⚽";
  if (share >= 0.6) return "Good game — keep practising!";
  if (share >= 0.4) return "Nice try — you'll beat that next time!";
  return "Every champion starts somewhere. Try again!";
}
