// Certificates & Awards — working out what a child has earned.
//
// The rules and the wording are in shared/certificates.ts. This file reads the
// database and writes certificates down.
//
// THE ONE RULE THAT SHAPES ALL OF IT: this only ever READS from marking, XP,
// streaks and the mastery map. Nothing here marks a question, awards XP,
// changes a streak or alters a score. A certificate is a record of something
// that already happened, so earning one must not be able to change what
// happened.
//
// That is why milestones are worked out when certificates are READ rather than
// hooked into the moment they occur: a hook would mean editing the marking and
// streak code, which was the one thing not to touch.
//
// DATES. Every certificate carries the date of the ACHIEVEMENT, never the date
// it was noticed. A child who scored full marks in July must get a certificate
// that says July, not today. Each milestone below names where its date comes
// from, and one of them has to compromise — see Streak Star.

import { storage } from "./storage";
import { buildMastery } from "./mastery";
import {
  CERTIFICATE_TEXT, STREAK_STAR_DAYS, FIRST_LEVEL_AWARDED,
  certificateKey, certificateTitle, newestFirst,
  type Certificate, type CertificateKind,
} from "@shared/certificates";
import { subjectLabel } from "@shared/weekly-report";
import type { CertificateRow, Student } from "@shared/schema";

/** Turn a stored row into the shape the rest of the app uses. */
function toCertificate(row: CertificateRow): Certificate {
  return {
    id: row.id,
    studentId: row.studentId,
    kind: row.kind as CertificateKind,
    key: row.certKey,
    title: row.title,
    detail: row.detail,
    earnedAt: new Date(row.earnedAt).toISOString(),
    issuedById: row.issuedById ?? null,
  };
}

/** One milestone found, ready to be written down if it is new. */
interface Earned {
  kind: CertificateKind;
  key: string;
  detail: string;
  earnedAt: Date;
}

/**
 * Every milestone this child currently satisfies.
 *
 * Reads only. Returns what is TRUE, not what is new — the caller works out
 * which of these have already been written down.
 */
async function milestonesFor(student: Student): Promise<Earned[]> {
  const found: Earned[] = [];

  // --- Perfect Score: 100% on an assignment -----------------------------
  //
  // One per submission, so a child with three perfect papers has three
  // certificates. Dated by the MARK, which is when the achievement is real.
  const submissions = await storage.getSubmissions({ studentId: student.id });
  if (submissions.length > 0) {
    const marks = await storage.getMarksBySubmissionIds(submissions.map((s) => s.id));
    for (const submission of submissions) {
      const mark = marks.get(submission.id);
      if (!mark) continue; // not marked yet — nothing to be perfect at

      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment || assignment.totalMarks <= 0) continue;
      if (mark.totalScore < assignment.totalMarks) continue;

      found.push({
        kind: "perfect_score",
        key: certificateKey.perfectScore(submission.id),
        detail: `${assignment.title} — full marks in ${subjectLabel(assignment.subject)}`,
        earnedAt: new Date(mark.markedAt),
      });
    }
  }

  // --- Streak Star: a run of days without missing one -------------------
  //
  // The streak table keeps the current run, the longest ever, and the last day
  // that counted — but no history of WHEN the longest run happened. So a child
  // who once reached seven days is certainly owed the certificate, and the best
  // date available is the last day their streak counted.
  //
  // Honest rather than exact: if they are mid-streak the date is right, and if
  // the run was months ago it is the closest the stored data allows. Fixing it
  // properly would mean recording streak history, which means changing the
  // streak code — the one thing this feature must not do.
  const streak = await storage.getStudentStreak(student.id);
  if (streak && streak.longestStreak >= STREAK_STAR_DAYS) {
    const day = streak.lastActiveDate && /^\d{4}-\d{2}-\d{2}$/.test(streak.lastActiveDate)
      ? new Date(`${streak.lastActiveDate}T12:00:00.000Z`)
      : new Date(streak.updatedAt);
    found.push({
      kind: "streak_star",
      key: certificateKey.streakStar(STREAK_STAR_DAYS),
      detail: `${STREAK_STAR_DAYS} days in a row of handing work in`,
      earnedAt: day,
    });
  }

  // --- Topic Master: a topic mastered on the skills map -----------------
  //
  // Uses the same buildMastery() the child's own dashboard uses, so a
  // certificate can never disagree with the map that earned it.
  //
  // Dated TODAY, and legitimately so: mastery is a standing state built from
  // many pieces of work rather than a single event, so there is no earlier
  // moment it can honestly claim.
  const mastery = await buildMastery(student);
  for (const subject of mastery.subjects) {
    for (const topic of subject.topics) {
      if (topic.band !== "mastered") continue;
      found.push({
        kind: "topic_master",
        key: certificateKey.topicMaster(topic.subject, topic.topic),
        detail: `${topic.topic} — ${topic.percent}% in ${subjectLabel(topic.subject)}`,
        earnedAt: new Date(),
      });
    }
  }

  // --- Level Up: every level reached ------------------------------------
  //
  // One per level from the first upwards, so a child at level 3 holds three.
  // Level 0 is where everybody starts and is not an achievement.
  //
  // Dated by when the XP row last changed, which is the closest the stored data
  // comes to when the level was reached.
  const xp = await storage.getStudentXp(student.id);
  if (xp && xp.level >= FIRST_LEVEL_AWARDED) {
    for (let level = FIRST_LEVEL_AWARDED; level <= xp.level; level++) {
      found.push({
        kind: "level_up",
        key: certificateKey.levelUp(level),
        detail: `Reached level ${level}`,
        earnedAt: new Date(xp.updatedAt),
      });
    }
  }

  return found;
}

/**
 * A child's certificates, with any newly earned ones written down first.
 *
 * Safe to call as often as you like: a milestone already recorded is skipped,
 * so reading the page ten times earns nothing ten times.
 */
export async function certificatesFor(student: Student): Promise<Certificate[]> {
  const earned = await milestonesFor(student);
  const already = new Set((await storage.getCertificates(student.id)).map((c) => c.certKey));

  for (const e of earned) {
    if (already.has(e.key)) continue;
    await storage.awardCertificate({
      studentId: student.id,
      kind: e.kind,
      certKey: e.key,
      title: certificateTitle(e.kind),
      detail: e.detail,
      earnedAt: e.earnedAt,
    });
  }

  // Read back, so what is returned is what is stored rather than what was
  // just computed — including anything a teacher awarded by hand.
  return newestFirst((await storage.getCertificates(student.id)).map(toCertificate));
}

/** One certificate, having checked it belongs to this child. */
export async function certificateFor(
  student: Student, certificateId: number,
): Promise<Certificate | null> {
  const row = (await storage.getCertificates(student.id)).find((c) => c.id === certificateId);
  return row ? toCertificate(row) : null;
}

/**
 * Award a Most Improved certificate by hand.
 *
 * The one kind a teacher runs. `issuedById` records who ran it, taken from the
 * session by the caller and never from the browser.
 */
export async function awardMostImproved(
  student: Student,
  opts: { subject: string; beforePercent: number; afterPercent: number; from: string; to: string; issuedById: number },
): Promise<Certificate | null> {
  const created = await storage.awardCertificate({
    studentId: student.id,
    kind: "most_improved",
    certKey: certificateKey.mostImproved(opts.subject, opts.from, opts.to),
    title: CERTIFICATE_TEXT.titles.most_improved,
    detail: `${subjectLabel(opts.subject)}: ${opts.beforePercent}% to ${opts.afterPercent}%, a rise of ${opts.afterPercent - opts.beforePercent} points`,
    earnedAt: new Date(),
    issuedById: opts.issuedById,
  });
  return created ? toCertificate(created) : null;
}
