// Gathering the figures for the parent's view of game plays.
//
// The shapes and the wording live in shared/parent-plays.ts. This file is the
// part that reads the database.
//
// Three things to keep in mind:
//
//  1. Today's figures come from getPlayState() — the SAME function the child's
//     own game screens use — rather than being counted again here. A parent and
//     their child must never be quoted different numbers, and the surest way to
//     guarantee that is to have only one place that works them out. Same
//     reasoning as parent-overview.ts importing its percentages from
//     weekly-report.ts instead of copying the formula.
//
//  2. This builder is given a Student the caller has already proved belongs to
//     the parent asking. It never looks up a child itself, so there is no id
//     here for anyone to tamper with.
//
//  3. Nothing here writes. Building a parent's view must never spend, grant or
//     clear a play — it only reads what is already there.

import { storage } from "./storage";
import { streakToday } from "./streaks";
import { catDay } from "./weekly-report";
import { assignmentsCompletedToday, getPlayState } from "./game-plays";
import { addDays } from "@shared/weekly-report";
import { PLAY_GAMES, playsEarned, type PlayGame } from "@shared/game-plays";
import {
  gameLabel,
  type ParentGameRecord,
  type ParentGameToday,
  type ParentPlayDay,
  type ParentPlays,
} from "@shared/parent-plays";
import { isPrimaryForm, type Student } from "@shared/schema";

/** How many days the week strip covers, today included. */
const WEEK_DAYS = 7;

/**
 * Build the parent's picture of their child's game plays.
 *
 * A secondary child (Forms 1-2) has no games at all, so this returns
 * `available: false` with empty lists rather than a row of zeros — zeros would
 * read as "your child has earned nothing", which is not what is true.
 */
export async function buildParentPlays(student: Student): Promise<ParentPlays> {
  const child = { id: student.id, fullName: student.fullName, form: student.form };

  if (!isPrimaryForm(student.form)) {
    return {
      child,
      available: false,
      today: { assignmentsHandedIn: 0, games: [] },
      week: [],
      records: [],
    };
  }

  const today = streakToday();

  // --- Today -------------------------------------------------------------
  // Straight from the child's own ledger, so the parent's "2 left" and the
  // child's "2 left" are the same number by construction.
  const [assignmentsHandedIn, ...states] = await Promise.all([
    assignmentsCompletedToday(student),
    ...PLAY_GAMES.map((game) => getPlayState(student, game)),
  ]);

  const games: ParentGameToday[] = states.map((state) => ({
    game: state.game,
    label: gameLabel(state.game),
    earned: state.earned,
    used: state.used,
    left: state.left,
  }));

  // --- The last seven days ------------------------------------------------
  //
  // Plays EARNED on a past day are recounted from the assignments handed in
  // that day, exactly as today's are — they are never stored (see
  // server/game-plays.ts). One consequence worth knowing: if a teacher deletes
  // an assignment, the plays it earned stop showing in this history too. That
  // is the honest reading — the work is gone — and it is the same rule the
  // child's own screen follows.
  //
  // Plays USED are the stored figure, which is the only thing the ledger
  // actually writes down.
  const days: string[] = [];
  for (let i = 0; i < WEEK_DAYS; i++) days.push(addDays(today, -i)); // newest first

  const submissions = await storage.getSubmissions({ studentId: student.id });

  // Distinct assignments handed in per day. Counted per ASSIGNMENT, like the
  // ledger itself, so handing the same piece in twice cannot look like two
  // days' worth of work.
  const handedInByDay = new Map<string, Set<number>>();
  for (const s of submissions) {
    const day = catDay(s.submittedAt);
    const set = handedInByDay.get(day) || new Set<number>();
    set.add(s.assignmentId);
    handedInByDay.set(day, set);
  }

  const usedRows = await Promise.all(
    days.map((day) =>
      Promise.all(PLAY_GAMES.map((game) => storage.getGamePlays(student.id, day, game))),
    ),
  );

  const week: ParentPlayDay[] = days.map((day, i) => {
    const handedIn = handedInByDay.get(day)?.size ?? 0;
    return {
      day,
      assignmentsHandedIn: handedIn,
      // Across BOTH games: one assignment earns a play of each. Worked out here
      // rather than on the page, so every figure a parent sees is a total of
      // the same kind and "earned 4, used 3" reads correctly.
      playsEarned: playsEarned(handedIn) * PLAY_GAMES.length,
      playsUsed: usedRows[i].reduce((n, row) => n + (row?.used ?? 0), 0),
    };
  });

  // --- Best scores --------------------------------------------------------
  // Shown as encouragement, not as a report card. A game never finished leaves
  // nothing here rather than a zero.
  const [blasterBest, penaltyBests] = await Promise.all([
    storage.getBlasterBest(student.id),
    storage.getPenaltyBests(student.id),
  ]);

  const records: ParentGameRecord[] = [];

  if (blasterBest && blasterBest.gamesPlayed > 0) {
    records.push({
      game: "blaster" as PlayGame,
      label: gameLabel("blaster"),
      bestScore: blasterBest.bestScore,
      bestOutOf: blasterBest.bestOutOf,
      gamesPlayed: blasterBest.gamesPlayed,
      subject: null,
    });
  }

  // Penalty Shootout keeps a record per subject. A parent wants one line, not
  // a table, so this is their strongest subject — compared as a fraction, the
  // same way the game itself decides whether a record has been beaten.
  const played = penaltyBests.filter((b) => b.gamesPlayed > 0 && b.bestOutOf > 0);
  if (played.length > 0) {
    const best = played.reduce((a, b) =>
      b.bestScore / b.bestOutOf > a.bestScore / a.bestOutOf ? b : a,
    );
    records.push({
      game: "penalty" as PlayGame,
      label: gameLabel("penalty"),
      bestScore: best.bestScore,
      bestOutOf: best.bestOutOf,
      // Every subject's games added up: "played 6 games", not "6 in maths".
      gamesPlayed: played.reduce((n, b) => n + b.gamesPlayed, 0),
      subject: best.subject,
    });
  }

  return {
    child,
    available: true,
    today: { assignmentsHandedIn, games },
    week,
    records,
  };
}
