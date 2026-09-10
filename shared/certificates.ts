// Certificates & Awards — the pure rules.
//
// A certificate is a printable record of something a child has already done.
// Every one is worked out from data that is ALREADY STORED: marks, streaks,
// XP and the mastery map. Nothing here marks anything, awards XP, or touches a
// streak — it reads what happened and writes down that it happened.
//
// WHY THEY ARE DERIVED, THEN STORED.
//
// Nothing hooks into marking or the streak update, because those must not
// change. So the milestones are worked out when a child's certificates are
// READ, and any that are newly true are written down. That makes the read
// idempotent — asking twice earns nothing twice — and keeps the whole feature
// on the reading side of the app.
//
// The consequence to be careful about: "when it was noticed" is not "when it
// happened". A certificate must carry the date of the ACHIEVEMENT, not the date
// somebody opened the page, or a child who scored full marks in July gets a
// certificate dated today. Every kind below names where its date comes from.

/** The kinds of certificate. */
export const CERTIFICATE_KINDS = [
  "perfect_score",
  "streak_star",
  "topic_master",
  "level_up",
  "most_improved",
] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export function isCertificateKind(v: string): v is CertificateKind {
  return (CERTIFICATE_KINDS as readonly string[]).includes(v);
}

/** How many days in a row earn a Streak Star. */
export const STREAK_STAR_DAYS = 7;

/** The lowest level worth a certificate. Level 0 is where everybody starts. */
export const FIRST_LEVEL_AWARDED = 1;

/**
 * One earned certificate.
 *
 * `key` is what makes earning idempotent: it identifies the ACHIEVEMENT, not
 * the certificate, so the same milestone can only ever be written down once.
 * A child with two perfect papers gets two certificates because the submission
 * id differs; opening the page ten times adds nothing.
 */
export interface Certificate {
  id: number;
  studentId: number;
  kind: CertificateKind;
  /** Unique per student. See above. */
  key: string;
  /** The headline, e.g. "Perfect Score". */
  title: string;
  /** The line under it, e.g. "100% in Fractions (Maths)". */
  detail: string;
  /** ISO date-time of the ACHIEVEMENT, not of when it was noticed. */
  earnedAt: string;
  /** The teacher who issued it, for certificates a teacher runs. Null otherwise. */
  issuedById: number | null;
}

/** A certificate about to be written down. */
export type NewCertificate = Omit<Certificate, "id">;

// --- Keys -----------------------------------------------------------------
// Built here so the server and any later caller cannot disagree about what
// counts as "the same achievement".

export const certificateKey = {
  perfectScore: (submissionId: number) => `perfect:${submissionId}`,
  streakStar: (days: number) => `streak:${days}`,
  topicMaster: (subject: string, topic: string) => `topic:${subject}:${topic}`,
  levelUp: (level: number) => `level:${level}`,
  mostImproved: (subject: string, from: string, to: string) => `improved:${subject}:${from}:${to}`,
};

// --- Wording --------------------------------------------------------------
//
// Written to be READ ON A WALL. A certificate is kept, shown to a parent, and
// sometimes framed, so the words are warm and complete rather than clipped —
// and never mention a percentage a child fell short of.

export const CERTIFICATE_TEXT = {
  school: "On Point Education Centre",
  tagline: "Quality Beyond Measure",
  heading: "Certificate of Achievement",
  awardedTo: "This certificate is proudly awarded to",

  titles: {
    perfect_score: "Perfect Score",
    streak_star: "Streak Star",
    topic_master: "Topic Master",
    level_up: "Level Up",
    most_improved: "Most Improved",
  } as Record<CertificateKind, string>,

  /** The one-line reason, as it reads on the certificate. */
  reasons: {
    perfect_score: "for full marks, with every question correct",
    streak_star: "for handing in work every day, without missing one",
    topic_master: "for showing real mastery of a topic",
    level_up: "for steady effort, level after level",
    most_improved: "for the greatest improvement of anyone in the class",
  } as Record<CertificateKind, string>,

  // --- The area on the dashboard ---
  areaTitle: "My certificates",
  areaSubtitle: "Awards you have earned. Tap one to open and print it.",
  empty: "No certificates yet.",
  emptyNote:
    "Hand in your work, keep your streak going, and they will start to appear here.",

  print: "Print certificate",
  printNote: "Choose “Save as PDF” in the print box to keep a copy.",
  back: "Back",

  /** "3 certificates" */
  count(n: number): string {
    return n === 1 ? "1 certificate" : `${n} certificates`;
  },
} as const;

/** The title for one certificate kind. */
export function certificateTitle(kind: CertificateKind): string {
  return CERTIFICATE_TEXT.titles[kind] ?? kind;
}

/** The reason line for one certificate kind. */
export function certificateReason(kind: CertificateKind): string {
  return CERTIFICATE_TEXT.reasons[kind] ?? "";
}

/**
 * A date as it should read on a certificate: "9 September 2026".
 *
 * Spelled out rather than 09/09/2026, because a certificate is a document
 * somebody keeps and a numeric date is ambiguous between conventions.
 */
export function certificateDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${[
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][d.getMonth()]} ${d.getFullYear()}`;
}

/** Newest first — a child wants to see what they just earned. */
export function newestFirst(list: Certificate[]): Certificate[] {
  return [...list].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt) || b.id - a.id);
}

// --- Most Improved --------------------------------------------------------
//
// The one certificate a teacher runs by hand. It compares a subject's average
// across two periods and finds who moved furthest.

/** One child's movement in a subject between two periods. */
export interface ImprovementRow {
  studentId: number;
  fullName: string;
  /** The school's own id, so two children sharing a name can be told apart. */
  pupilId: string;
  beforePercent: number | null;
  afterPercent: number | null;
  /** after - before. Null when either period has no marked work. */
  changePercent: number | null;
  beforeMarked: number;
  afterMarked: number;
}

/**
 * Rank a class by improvement, biggest gain first.
 *
 * A child with no marked work in one of the two periods has no improvement to
 * measure — they are kept in the list, so a teacher can see WHY they are not a
 * candidate, but they never rank above somebody who actually improved.
 */
export function rankByImprovement(rows: ImprovementRow[]): ImprovementRow[] {
  return [...rows].sort((a, b) => {
    if (a.changePercent === null && b.changePercent === null) {
      return a.fullName.localeCompare(b.fullName);
    }
    if (a.changePercent === null) return 1;
    if (b.changePercent === null) return -1;
    return b.changePercent - a.changePercent ||
      a.fullName.localeCompare(b.fullName) ||
      a.pupilId.localeCompare(b.pupilId);
  });
}

export const IMPROVED_TEXT = {
  title: "Most Improved",
  subtitle: "Compare two periods in a subject and award the biggest climb.",

  pickClass: "Choose a class",
  pickSubject: "Choose a subject",
  before: "Earlier period",
  after: "Later period",

  run: "Compare",
  award: "Award certificate",
  awarded: "Certificate awarded.",

  noCandidates:
    "Nobody in this class has marked work in both periods, so there is no improvement to measure yet.",

  /** Said where a child cannot be ranked, so the absence is explained. */
  cannotRank: "No marked work in one of the periods",

  /** "+18 points, 54% to 72%" */
  movement(before: number, after: number): string {
    const change = after - before;
    const sign = change > 0 ? "+" : "";
    return `${sign}${change} points, ${before}% to ${after}%`;
  },

  /** The detail line printed on the certificate itself. */
  certificateDetail(subject: string, before: number, after: number): string {
    return `${subject}: ${before}% to ${after}%, a rise of ${after - before} points`;
  },
} as const;
