// Penalty Shootout — server logic for the primary-only football quiz game.
//
// Self-contained, like xp.ts and streaks.ts. It reads the student's own
// assignments to find questions, and reads/writes the penalty_best table. It
// never changes auto-marking, XP or streak logic — it calls them.
//
// Two rules matter most here:
//   1. The answer key NEVER goes to the browser. These questions come from real
//      homework, so sending correctAnswer would hand children the answers to
//      work they still have to do. The server marks every shot.
//   2. Children can only ever be asked questions from assignments meant for
//      them — their own form, and their own targeted assignments.

import { storage } from "./storage";
import type { Student, Assignment } from "@shared/schema";
import type { Question } from "@shared/auto-marking";
import { markAnswer } from "@shared/auto-marking";
import type { ShotOption } from "@shared/penalty";
import {
  MIN_QUESTIONS, SHOTS_PER_ROUND, TOTAL_SHOTS, XP_PER_CORRECT_ANSWER,
  buildShotOptions, isPlayable, shuffle, dealShots, canPlay, beatsRecord, makeRef, readRef,
  type Shot, type Round,
} from "@shared/penalty";
import { awardXp, type XpAward } from "./xp";
import { recordActivity } from "./streaks";
import { activeGame, clearActiveGame, getPlayState, spendPlay } from "./game-plays";
import type { PlayState } from "@shared/game-plays";

// One question a student may be asked, tied to the assignment it came from.
interface PoolItem {
  subject: string;
  assignmentId: number;
  ref: string;      // "assignmentId:questionId" — unique across the whole school
  question: Question;
}

// Every question this student is allowed to be asked: the ones from work they
// have ALREADY HANDED IN.
//
// It used to be every assignment set for their class, done or not, which was
// wrong twice over. It put questions from tonight's unfinished homework into a
// game — handing a child a preview of work they still had to do — and it made
// the game depend on what a teacher happened to have set rather than on what
// the child had actually earned.
//
// Now the game is a reward built out of their own finished work: questions they
// have already met, coming round again. Built fresh each time, so a child can
// never be served another class's questions.
async function questionPool(student: Student): Promise<PoolItem[]> {
  // Which assignments this child has handed in. A set, so handing the same
  // piece in twice cannot double its questions up in the pool.
  const submissions = await storage.getSubmissions({ studentId: student.id });
  const completed = new Set(submissions.map((s) => s.assignmentId));
  if (completed.size === 0) return [];

  const assignments: Assignment[] = await storage.getAssignments(student.form, student.id, false);
  const out: PoolItem[] = [];
  for (const a of assignments) {
    if (!completed.has(a.id)) continue; // not done yet — not theirs to play with
    for (const q of (a.questions || []) as Question[]) {
      if (isPlayable(q)) {
        out.push({ subject: a.subject, assignmentId: a.id, ref: makeRef(a.id, q.id), question: q });
      }
    }
  }
  return out;
}

// Find exactly one question in the pool by its reference. Looking it up by the
// bare question id would be ambiguous — "q1" exists in nearly every assignment.
function findByRef(pool: PoolItem[], subject: string, ref: string): PoolItem | undefined {
  const parsed = readRef(ref);
  if (!parsed) return undefined;
  return pool.find(
    (p) => p.subject === subject && p.assignmentId === parsed.assignmentId && p.question.id === parsed.questionId,
  );
}

// Every numeric answer in a subject, used as believable wrong answers to sit
// beside the right one.
function numericPoolFor(pool: PoolItem[], subject: string): number[] {
  const seen = new Set<number>();
  for (const { subject: s, question } of pool) {
    if (s !== subject) continue;
    if (question.type === "numeric" && question.correctNumber != null) seen.add(question.correctNumber);
  }
  return Array.from(seen);
}

// The questions in a subject that can actually be played, each already turned
// into buttons. A question is only usable if it can be made into buttons (a
// numeric with no believable wrong answers to offer cannot). Questions are kept
// apart by their full reference, NOT by the bare question id: nearly every
// assignment has a "q1", so deduping on that would throw away almost the whole
// subject and leave children with nothing to play.
function usableQuestions(pool: PoolItem[], subject: string) {
  const numbers = numericPoolFor(pool, subject);
  const seen = new Set<string>();
  const out: { item: PoolItem; options: ShotOption[] }[] = [];
  for (const item of pool) {
    if (item.subject !== subject) continue;
    if (seen.has(item.ref)) continue;
    const options = buildShotOptions(item.question, numbers);
    if (!options) continue;
    seen.add(item.ref);
    out.push({ item, options });
  }
  return out;
}

export interface SubjectChoice {
  subject: string;
  questionCount: number;  // distinct questions available to play
  bestScore: number;
  bestOutOf: number;
  gamesPlayed: number;
}

// The subjects this child can play, each with their personal best so they can
// see what to beat.
//
// A subject appears as soon as the child has completed ONE piece of playable
// work in it. It used to need ten different questions, which is how a child who
// had done their homework could still be shown an empty screen. A thin subject
// now repeats questions instead of disappearing.
export async function listSubjects(student: Student): Promise<SubjectChoice[]> {
  const pool = await questionPool(student);
  const bests = await storage.getPenaltyBests(student.id);
  const subjects = Array.from(new Set(pool.map((p) => p.subject))).sort();

  return subjects.map((subject) => {
    const count = usableQuestions(pool, subject).length;
    const best = bests.find((b) => b.subject === subject);
    return {
      subject,
      questionCount: count,
      bestScore: best?.bestScore ?? 0,
      bestOutOf: best?.bestOutOf ?? 0,
      gamesPlayed: best?.gamesPlayed ?? 0,
    };
  }).filter((s) => canPlay(s.questionCount));
}

export interface Game {
  subject: string;
  perRound: number; // always 5: penalties taken, then saves made
  // 10 shots, never with an answer key. A question may appear more than once
  // when the child has not completed much work in this subject yet.
  shots: Shot[];
}

// Build a game from the chosen subject: 10 shots, 5 to shoot and 5 to save.
//
// dealShots fills those 10 from however many questions the child has. With ten
// or more it is the old behaviour exactly — shuffle and take ten, no repeats.
// With fewer it deals the pack again rather than refusing to play, so a child
// who has done two pieces of maths still gets a full game.
//
// Returns null only when there is genuinely nothing to ask: no completed work
// in that subject at all.
export async function buildGame(student: Student, subject: string): Promise<Game | null> {
  const pool = await questionPool(student);
  const usable = usableQuestions(pool, subject);
  if (!canPlay(usable.length)) return null;

  const picked = dealShots(usable, TOTAL_SHOTS);
  const shots: Shot[] = picked.map((p, i) => ({
    ref: p.item.ref,
    round: (i < SHOTS_PER_ROUND ? "striker" : "keeper") as Round,
    index: i % SHOTS_PER_ROUND,
    questionText: p.item.question.questionText,
    options: p.options,
  }));
  return { subject, perRound: SHOTS_PER_ROUND, shots };
}

/** A game, together with what the child has left after paying for it. */
export interface StartedGame {
  game: Game;
  plays: PlayState;
}

/**
 * Start a game: check they have a play, build it, then spend the play.
 *
 * In that order on purpose. Building first and charging afterwards would take a
 * play off a child whose subject turned out to have nothing in it, and charging
 * first would lose them a play for the same reason.
 *
 * `outOfPlays` is a refusal, not an error — the page turns it into "come back
 * tomorrow", not something that looks broken.
 */
export async function startGame(
  student: Student, subject: string,
): Promise<StartedGame | { outOfPlays: true; plays: PlayState } | null> {
  const plays = await getPlayState(student, "penalty");
  if (plays.left <= 0) return { outOfPlays: true, plays };

  const game = await buildGame(student, subject);
  if (!game) return null;

  // Store the questions in the order they were asked, so the finish can be
  // marked against what was actually put to the child.
  const spent = await spendPlay(student, "penalty", game.shots.map((sh) => sh.ref), subject);
  if (!spent) return { outOfPlays: true, plays };

  return { game, plays: spent };
}

// Mark ONE shot, for the instant feedback the game needs (ball in the net, or
// the keeper saving it). Marking is the existing auto-marker, untouched.
// Returns null if the question isn't one this child is allowed to be asked.
export async function markShot(
  student: Student, subject: string, ref: string, answerText: string,
): Promise<{ correct: boolean; correctAnswerDisplay: string; explanation?: string } | null> {
  const pool = await questionPool(student);
  const found = findByRef(pool, subject, ref);
  if (!found) return null;

  const result = markAnswer(found.question, answerText);
  return {
    correct: result.correct,
    correctAnswerDisplay: result.correctAnswerDisplay,
    explanation: result.explanation,
  };
}

export interface GameResult {
  score: number;
  outOf: number;      // always 10 — the server's fixed game length
  perRound: number;   // always 5
  playable?: boolean; // false when the subject no longer has enough questions
  strikerScore: number;
  keeperScore: number;
  bestScore: number;
  bestOutOf: number;
  previousBest: number;
  previousOutOf: number;
  newRecord: boolean;
  gamesPlayed: number;
  xp?: XpAward;
}

export interface SubmittedAnswer {
  // `ref` and `round` are still sent by the game and kept here so the shape does
  // not change under it, but the server no longer believes either of them: which
  // question an answer belongs to, and which half of the game it is in, are both
  // decided by its POSITION against the stored game. See finishGame below.
  ref?: string;
  answerText: string;
  round?: Round;
}

// Finish a game: re-mark every answer on the server (the browser is never
// trusted with the score), save a new personal best, award XP through the
// existing capped system, and count the game towards the daily streak.
//
// HOW CHEATING IS STOPPED, and why it had to change.
//
// This used to refuse to count the same question twice: ten copies of one
// known-correct answer scored 1, not 10. That worked while every shot in a game
// was a different question — but a game may now legitimately repeat one, and
// that rule would have quietly robbed an honest child of the marks.
//
// So the game itself is the record now. Its questions were stored, in order,
// when the play was spent (server/game-plays.ts). The answer in position 3 is
// marked against whatever question was actually asked in position 3, and the
// round comes from that position too. Nothing the browser sends decides which
// question is being answered, so a replayed answer lands in a slot that is
// asking something else.
//
// A game that has already been finished has no stored questions left, so
// sending the same winning game up twice scores nothing the second time.
export async function finishGame(
  student: Student, subject: string, answers: SubmittedAnswer[],
): Promise<GameResult> {
  const pool = await questionPool(student);
  const perRound = SHOTS_PER_ROUND;
  const outOf = TOTAL_SHOTS;

  const empty = (): GameResult => ({
    score: 0, outOf, perRound, strikerScore: 0, keeperScore: 0,
    bestScore: 0, bestOutOf: 0, previousBest: 0, previousOutOf: 0,
    newRecord: false, gamesPlayed: 0, playable: false,
  });

  // Nothing to play in this subject at all — the same answer as before.
  if (!canPlay(usableQuestions(pool, subject).length)) return empty();

  // The questions this child was actually asked, in order.
  const active = await activeGame(student, "penalty");
  if (active.refs.length === 0 || active.subject !== subject) {
    // No game in flight for this subject: either it has already been finished
    // and scored, or this result was never started here. Either way it scores
    // nothing rather than being taken on trust.
    return empty();
  }

  let strikerScore = 0;
  let keeperScore = 0;

  // Slot by slot. The child's Nth answer is marked against the Nth question
  // they were asked, and a missing answer is simply a miss.
  active.refs.slice(0, outOf).forEach((ref, slot) => {
    const answer = answers[slot];
    if (!answer) return;

    const found = findByRef(pool, subject, ref);
    if (!found) return; // the assignment went away mid-game

    if (!markAnswer(found.question, answer.answerText ?? "").correct) return;

    // Which half of the game this slot belongs to is decided here, not by the
    // browser: the first five are penalties taken, the rest are saves.
    if (slot < perRound) strikerScore++;
    else keeperScore++;
  });

  const score = strikerScore + keeperScore;

  // The game is over: forget it, so it cannot be sent up again to score twice.
  // This does NOT give the play back — it has been played.
  await clearActiveGame(student, "penalty");

  // Personal best for THIS subject, compared as a fraction so a subject whose
  // game got longer (the teacher added questions) still compares fairly.
  const existing = await storage.getPenaltyBest(student.id, subject);
  const previousBest = existing?.bestScore ?? 0;
  const previousOutOf = existing?.bestOutOf ?? 0;
  const newRecord = beatsRecord(score, outOf, previousBest, previousOutOf);
  let gamesPlayed: number;

  if (!existing) {
    const created = await storage.createPenaltyBest({
      studentId: student.id, subject, bestScore: score, bestOutOf: outOf, gamesPlayed: 1,
    });
    gamesPlayed = created.gamesPlayed;
  } else {
    const updated = await storage.updatePenaltyBest(student.id, subject, {
      bestScore: newRecord ? score : previousBest,
      bestOutOf: newRecord ? outOf : previousOutOf,
      gamesPlayed: existing.gamesPlayed + 1,
    });
    gamesPlayed = updated.gamesPlayed;
  }

  // XP: 2 per correct answer, through the existing daily-capped system.
  // Best-effort, exactly like the submission flow — a failure here must never
  // lose the child their game result.
  let xp: XpAward | undefined;
  if (score > 0) {
    try {
      xp = await awardXp(student.id, score * XP_PER_CORRECT_ANSWER, {
        correct: score,
        perCorrect: XP_PER_CORRECT_ANSWER,
      });
    } catch (error) {
      console.error("Penalty XP award failed (game still counted):", error);
    }
  }

  // Playing counts as activity for today's streak, like completing homework.
  try {
    await recordActivity(student.id);
  } catch (error) {
    console.error("Penalty streak update failed (game still counted):", error);
  }

  return {
    score,
    outOf,
    perRound,
    strikerScore,
    keeperScore,
    bestScore: newRecord ? score : previousBest,
    bestOutOf: newRecord ? outOf : previousOutOf,
    previousBest,
    previousOutOf,
    newRecord,
    gamesPlayed,
    xp,
  };
}
