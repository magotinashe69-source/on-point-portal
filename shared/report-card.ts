// Report cards — the pure rules.
//
// A report card assembles marks that are ALREADY STORED into one printable
// page. Nothing here marks anything or changes a score: it reads, averages,
// grades against the school's boundaries, and lays the result out.
//
// Percentages are marks scored over marks available — the SAME formula the
// weekly report, the Reports page, the Grade Book, the parent overview and the
// mastery map all use. A report card is the most formal thing the app prints,
// so a figure on it that a teacher cannot reproduce elsewhere would be worse
// here than anywhere.

// --- Grade boundaries -----------------------------------------------------
//
// Cambridge-style out of the box, but STORED, because a school sets its own.
// A boundary is the lowest percentage that earns the grade.

export interface GradeBoundary {
  grade: string;
  /** The lowest percentage that earns this grade. */
  min: number;
}

/** What a school starts with until it sets its own. */
export const DEFAULT_BOUNDARIES: GradeBoundary[] = [
  { grade: "A*", min: 90 },
  { grade: "A", min: 80 },
  { grade: "B", min: 70 },
  { grade: "C", min: 60 },
  { grade: "D", min: 50 },
  { grade: "E", min: 40 },
  { grade: "U", min: 0 },
];

/**
 * The grade for a percentage.
 *
 * Boundaries are sorted highest-first here rather than trusting the order they
 * were stored in — a set saved in the wrong order would otherwise hand every
 * child a U.
 */
export function gradeFor(percent: number, boundaries: GradeBoundary[]): string {
  const sorted = [...boundaries].sort((a, b) => b.min - a.min);
  for (const b of sorted) {
    if (percent >= b.min) return b.grade;
  }
  // Nothing matched, which means the lowest boundary is above 0. Said plainly
  // rather than guessed at.
  return "—";
}

/**
 * Check a set of boundaries before it is saved.
 *
 * Worth refusing a bad set rather than storing it: these decide what goes on a
 * child's report card, and a gap or an overlap mis-grades quietly. Nobody
 * checks a grade that looks plausible.
 */
export function validateBoundaries(boundaries: GradeBoundary[]): string[] {
  const problems: string[] = [];

  if (boundaries.length === 0) {
    problems.push("There must be at least one grade.");
    return problems;
  }

  for (const b of boundaries) {
    if (!b.grade || !b.grade.trim()) problems.push("Every grade needs a name.");
    if (typeof b.min !== "number" || !Number.isFinite(b.min)) {
      problems.push(`"${b.grade}" needs a number for its lowest mark.`);
    } else if (b.min < 0 || b.min > 100) {
      problems.push(`"${b.grade}" must sit between 0 and 100.`);
    }
  }

  const names = boundaries.map((b) => b.grade.trim().toUpperCase());
  if (new Set(names).size !== names.length) {
    problems.push("Two grades share a name.");
  }

  const mins = boundaries.map((b) => b.min);
  if (new Set(mins).size !== mins.length) {
    problems.push("Two grades start at the same mark.");
  }

  // Something has to catch a score of zero, or a child who scored nothing gets
  // no grade at all.
  if (!mins.some((m) => m === 0)) {
    problems.push("The lowest grade must start at 0, so every mark has a grade.");
  }

  return problems;
}

export function boundariesAreValid(boundaries: GradeBoundary[]): boolean {
  return validateBoundaries(boundaries).length === 0;
}

/** Highest first, which is how a boundary table is read. */
export function sortBoundaries(boundaries: GradeBoundary[]): GradeBoundary[] {
  return [...boundaries].sort((a, b) => b.min - a.min);
}

// --- The card -------------------------------------------------------------

/** One subject's line on the report. */
export interface SubjectReport {
  subject: string;
  /** This child's average. Null when nothing was marked in the term. */
  percent: number | null;
  grade: string | null;
  /** How many marked pieces the average rests on. */
  marked: number;
  /** The class's average in the same subject and term, for comparison. */
  classPercent: number | null;
  /** How many children in the class had marked work in it. */
  classChildren: number;
}

/**
 * What the app can honestly say about attendance.
 *
 * The portal keeps NO attendance register — the QR "attendance card" is only
 * used to log in, and nothing records a child being present in a classroom.
 *
 * So a report card must not carry an attendance percentage. It carries the
 * figure that is real — the number of days the child handed work in — labelled
 * as exactly that. Putting "Attendance: 92%" on a document that goes home,
 * derived from homework, would be inventing a fact a parent then acts on.
 *
 * `recorded` stays false until somebody builds a real register. When one
 * exists, this is where it goes.
 */
export interface ReportAttendance {
  recorded: false;
  daysActive: number;
  schoolDays: null;
}

export interface ReportCard {
  student: { id: number; fullName: string; pupilId: string; form: string };
  term: { label: string; from: string; to: string };

  subjects: SubjectReport[];

  /** Across every subject in the term. Null when nothing was marked. */
  overallPercent: number | null;
  overallGrade: string | null;
  /** The class's overall average, for comparison. */
  classOverallPercent: number | null;

  attendance: ReportAttendance;

  /** The teacher's written comment, when one has been saved. */
  comment: string | null;

  /** The boundaries this card was graded against, printed on it. */
  boundaries: GradeBoundary[];

  /** When the card was produced. */
  issuedAt: string;
}

/** Did this child do enough in the term for a card to say anything? */
export function hasMarkedWork(card: ReportCard): boolean {
  return card.subjects.some((s) => s.marked > 0);
}

/** "3 points above the class" / "level with the class" / "2 below". */
export function versusClass(percent: number | null, classPercent: number | null): string {
  if (percent === null || classPercent === null) return "";
  const diff = percent - classPercent;
  if (diff === 0) return "level with the class";
  return `${Math.abs(diff)} ${Math.abs(diff) === 1 ? "point" : "points"} ${diff > 0 ? "above" : "below"} the class`;
}

// --- Wording --------------------------------------------------------------

export const REPORT_TEXT = {
  school: "On Point Education Centre",
  tagline: "Quality Beyond Measure",
  heading: "Report Card",

  student: "Pupil",
  pupilId: "Pupil ID",
  form: "Class",
  term: "Term",
  issued: "Issued",

  subject: "Subject",
  average: "Average",
  grade: "Grade",
  classAverage: "Class average",
  marked: "Pieces marked",

  overall: "Overall average",
  overallGrade: "Overall grade",

  comment: "Teacher's comment",
  noComment: "No comment has been added.",

  attendance: "Days active on homework",
  /**
   * Printed on the card itself, not buried in a note. A parent reading a report
   * card must not mistake this for an attendance record.
   */
  attendanceNote:
    "Days this pupil handed work in during the term. The portal does not keep an attendance register, so this is not a record of school attendance.",

  boundariesHeading: "Grade boundaries",

  nothingMarked:
    "No work was marked for this pupil in this term, so there is nothing to report yet.",

  print: "Print report card",
  printNote: "Choose “Save as PDF” in the print box to keep a copy.",

  // --- The teacher's screen ---
  title: "Report cards",
  subtitle: "Assemble a term's marks into a printable card. Nothing here changes a mark.",
  pickClass: "Choose a class",
  termLabel: "Term name",
  termFrom: "From",
  termTo: "To",
  build: "Build report cards",
  printAll: "Print all",
  editComment: "Comment",
  saveComment: "Save comment",
  commentSaved: "Comment saved.",
  commentPlaceholder: "A sentence or two for the family to read.",

  editBoundaries: "Grade boundaries",
  boundariesSaved: "Grade boundaries saved.",
  resetBoundaries: "Back to Cambridge defaults",
} as const;
