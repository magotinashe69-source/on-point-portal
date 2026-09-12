// Give marks made BEFORE the feedback was translatable the parts they need.
//
//   npm run backfill:feedback            -- says what it would change
//   npm run backfill:feedback -- --apply -- actually changes it
//
// A question mark now stores what its feedback line is MADE OF, so a screen can
// rebuild it in the reader's language. Marks given before that have only the
// English sentence, and a family reading Portuguese sees English on them for
// ever. This attaches the parts to those rows.
//
// THE RULE IT WILL NOT BREAK: a teacher's own words are never touched. The only
// rows changed are ones where the stored sentence is EXACTLY what the marking
// engine would write today for that question and that answer. Anything else —
// a comment a teacher typed, a line from a question that has been edited since,
// a sentence that differs by so much as a full stop — is left exactly as it is
// and counted as skipped.
//
// It is a dry run unless you pass --apply, and it prints what it would do
// either way. Read that before applying it to a school's real marks.

import { db } from "../server/db";
import { storage } from "../server/storage";
import { marks } from "@shared/schema";
import { buildFeedback, feedbackFor, markAnswer } from "@shared/auto-marking";
import { eq } from "drizzle-orm";
import { ensureSchema } from "../server/db";

const APPLY = process.argv.includes("--apply");

async function main() {
  await ensureSchema();

  const submissions = await storage.getSubmissions();
  console.log(`\n${submissions.length} submissions on file.\n`);

  let marksSeen = 0;
  let marksChanged = 0;
  let linesAttached = 0;
  let linesAlreadyDone = 0;
  let linesLeftAlone = 0;
  const reasons = new Map<string, number>();

  function note(reason: string) {
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    linesLeftAlone++;
  }

  for (const submission of submissions) {
    const mark = await storage.getMark(submission.id);
    if (!mark) continue;
    marksSeen++;

    const assignment = await storage.getAssignment(submission.assignmentId);
    if (!assignment) {
      note("the assignment is gone");
      continue;
    }

    let touched = false;
    const updated = mark.questionMarks.map((qm) => {
      if (qm.feedbackCode) { linesAlreadyDone++; return qm; }

      const question = assignment.questions.find((q) => q.id === qm.questionId);
      if (!question) { note("that question is no longer on the paper"); return qm; }

      const answer = (submission.answers || []).find((a) => a.questionId === qm.questionId);
      const result = markAnswer(question, answer?.answerText ?? "");

      // The whole safety of this script is this one comparison.
      if (!qm.feedback || qm.feedback !== buildFeedback(result)) {
        note("the stored line is not what the engine would write (a teacher's own words, or an edited question)");
        return qm;
      }

      touched = true;
      linesAttached++;
      return { ...qm, ...feedbackFor(result) };
    });

    if (!touched) continue;
    marksChanged++;

    if (APPLY) {
      await db.update(marks).set({ questionMarks: updated }).where(eq(marks.id, mark.id));
    }
  }

  console.log(`Marks looked at:            ${marksSeen}`);
  console.log(`Lines already done:         ${linesAlreadyDone}`);
  console.log(`Lines that can be rebuilt:  ${linesAttached}  (across ${marksChanged} marks)`);
  console.log(`Lines left exactly as they are: ${linesLeftAlone}`);
  const listed: [string, number][] = [];
  reasons.forEach((n, reason) => listed.push([reason, n]));
  for (const [reason, n] of listed.sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(5)}  ${reason}`);
  }

  console.log(
    APPLY
      ? "\nApplied. Those lines will now read in whichever language the family is using."
      : "\nNothing was changed. Run it again with --apply to make these changes.",
  );
}

main()
  .catch((error) => {
    console.error("\nThe backfill did not finish:");
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exitCode = 1;
  });
