// The weekly parent report.
//
// This file holds the parts that do not touch the database: the shape of a
// report, the maths for working out which week we mean, and the WhatsApp
// message. The figures themselves are gathered in server/weekly-report.ts.
//
// Keeping the message here means the parent's on-screen report and the
// WhatsApp text the school sends are built from ONE set of numbers, so the two
// can never quietly disagree with each other.
//
// All user-facing wording is grouped in REPORT_TEXT at the bottom, so it can be
// swapped for Portuguese later without hunting through the logic.

/** One subject's average for the week. */
export type SubjectScore = {
  subject: string;
  averagePercent: number;
  marked: number; // how many marked pieces that average is based on
};

export type WeeklyReport = {
  child: { id: number; fullName: string; form: string };
  week: { start: string; end: string; label: string }; // YYYY-MM-DD, YYYY-MM-DD, human label

  // Days in the week the child handed something in. This is NOT school
  // attendance — the portal has no attendance register — so it is always
  // labelled as homework activity, never as days present.
  daysActive: number;

  homework: {
    due: number;        // assignments due this week for this child
    completed: number;  // how many of those they handed in
  };

  // Average across MARKED work only. Null when nothing was marked this week,
  // which is different from an average of zero.
  averagePercent: number | null;

  strongest: SubjectScore | null;
  needsAttention: SubjectScore | null;

  streak: { current: number; longest: number };
};

// --- Week maths -----------------------------------------------------------
// Weeks run Monday to Sunday. Days are plain YYYY-MM-DD strings in CAT
// (Mozambique time), the same way streaks already count them.

const DAY_MS = 86400000;

const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const parseDay = (day: string) => Date.parse(day + "T00:00:00Z");

/** The Monday on or before `day`. */
export function mondayOf(day: string): string {
  const t = parseDay(day);
  const weekday = new Date(t).getUTCDay(); // 0 = Sunday
  const backToMonday = (weekday + 6) % 7;  // Monday = 0
  return toDay(t - backToMonday * DAY_MS);
}

/** Add days to a YYYY-MM-DD day. */
export function addDays(day: string, days: number): string {
  return toDay(parseDay(day) + days * DAY_MS);
}

/** Is `day` inside [start, end]? All three are YYYY-MM-DD. */
export function isWithin(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

/**
 * The week to report on.
 *
 * `offset` 0 is the week we are in now, 1 is the week just gone — which is the
 * one the school wants when it sends a summary out on a Friday.
 */
export function weekWindow(today: string, offset = 0): { start: string; end: string; label: string } {
  const start = addDays(mondayOf(today), -7 * offset);
  const end = addDays(start, 6);
  return { start, end, label: formatWeekLabel(start, end) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Sep – 7 Sep 2026", or "29 Sep – 5 Oct 2026" across a month boundary. */
export function formatWeekLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const left = `${sd} ${MONTHS[sm - 1]}${sy !== ey ? ` ${sy}` : ""}`;
  const right = `${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${left} – ${right}`;
}

// --- Subject names --------------------------------------------------------

/**
 * How a subject is written for a person to read. Subjects are stored as codes
 * (MATHS, BUSINESS_STUDIES), which must never reach a parent — on screen or in
 * a message. Kept here so both say exactly the same thing.
 *
 * Same wording as the daily homework report's SUBJECT_LABELS.
 */
export const SUBJECT_LABELS: Record<string, string> = {
  MATHS: "Maths",
  ENGLISH: "English",
  SCIENCE: "Science",
  PHYSICS: "Physics",
  CHEMISTRY: "Chemistry",
  BIOLOGY: "Biology",
  ECONOMICS: "Economics",
  BUSINESS_STUDIES: "Business Studies",
  GEOGRAPHY: "Geography",
  COMPUTER_SCIENCE: "Computer Science",
  HISTORY: "History",
  ACCOUNTING: "Accounting",
};

/**
 * A subject as a parent should read it. Falls back to tidying the code itself
 * (BUSINESS_STUDIES -> "Business Studies") so a subject added to the database
 * later still reads properly before anyone updates the list above.
 */
export function subjectLabel(subject: string): string {
  if (SUBJECT_LABELS[subject]) return SUBJECT_LABELS[subject];
  return subject
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// --- The WhatsApp message -------------------------------------------------

/**
 * The report as a message the school can paste into WhatsApp.
 *
 * Follows the style already used by the daily homework report
 * (client/src/pages/teacher/daily-report.tsx): *asterisks* for bold, short
 * lines, a blank line between sections, and the school's sign-off at the end.
 */
export function buildWhatsAppReport(report: WeeklyReport): string {
  const t = REPORT_TEXT;
  const lines: string[] = [];

  lines.push(`*${t.title}*`);
  lines.push(`${t.child}: ${report.child.fullName}`);
  lines.push(`${t.classLabel}: ${report.child.form}`);
  lines.push(`${t.week}: ${report.week.label}`);
  lines.push("");

  lines.push(`*${t.thisWeek}*`);
  lines.push(`${t.daysActive}: ${report.daysActive}`);
  lines.push(`${t.homework}: ${report.homework.completed} ${t.of} ${report.homework.due}`);
  lines.push(
    `${t.average}: ${report.averagePercent === null ? t.nothingMarked : `${report.averagePercent}%`}`
  );
  lines.push(`${t.streak}: ${report.streak.current} ${dayWord(report.streak.current)}`);
  lines.push("");

  if (report.strongest) {
    lines.push(`*${t.strongest}*`);
    lines.push(`${subjectLabel(report.strongest.subject)} — ${report.strongest.averagePercent}%`);
    lines.push("");
  }

  if (report.needsAttention) {
    lines.push(`*${t.needsAttention}*`);
    lines.push(`${subjectLabel(report.needsAttention.subject)} — ${report.needsAttention.averagePercent}%`);
    lines.push("");
  }

  lines.push(`*${t.messageForParents}*`);
  lines.push(closingMessage(report));
  lines.push("");
  lines.push(t.signOff);

  return lines.join("\n");
}

/** "day" or "days" — kept as a function so other languages can change it. */
function dayWord(n: number): string {
  return n === 1 ? REPORT_TEXT.day : REPORT_TEXT.days;
}

/**
 * The closing paragraph, chosen from what the week actually looked like.
 *
 * A parent should be told the truth plainly: praise when the work is done,
 * a clear nudge when it is not, and no pretending there is progress to report
 * when nothing was handed in at all.
 */
function closingMessage(report: WeeklyReport): string {
  const t = REPORT_TEXT;
  const { due, completed } = report.homework;

  if (due === 0) return t.closingNoHomeworkSet;
  if (completed === 0) return t.closingNoneDone;
  if (completed < due) return t.closingSomeMissing(due - completed);
  return t.closingAllDone;
}

// --- Wording --------------------------------------------------------------
// Everything a parent reads lives here, so the report can be translated by
// changing this one block.

export const REPORT_TEXT = {
  title: "Weekly report",
  child: "Learner",
  classLabel: "Class",
  week: "Week",

  thisWeek: "This week",
  // Deliberately not "days attended": the portal has no attendance register,
  // and this counts days the child worked on homework.
  daysActive: "Days active on homework",
  homework: "Homework completed",
  of: "of",
  average: "Average",
  nothingMarked: "nothing marked yet",
  streak: "Current streak",
  day: "day",
  days: "days",

  strongest: "Strongest subject",
  needsAttention: "Needs attention",

  messageForParents: "Message for parents",
  closingAllDone:
    "All homework set this week was handed in. Thank you for supporting your child at home — it shows.",
  closingSomeMissing: (n: number) =>
    `${n} ${n === 1 ? "piece" : "pieces"} of homework set this week ${n === 1 ? "was" : "were"} not handed in. Please help your child catch up so they do not fall behind.`,
  closingNoneDone:
    "No homework was handed in this week. Please talk to your child and contact us if anything is making it difficult — we would rather help early.",
  closingNoHomeworkSet:
    "No homework was set for your child this week, so there is nothing outstanding.",

  signOff: "— On Point Education Centre",
};
