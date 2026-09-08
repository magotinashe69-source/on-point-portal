// The parent's view of their child, beyond the weekly report.
//
// The weekly report (shared/weekly-report.ts) answers "how was this week?".
// This file is the fuller picture a parent asks for: the average so far,
// recent marks subject by subject, how much homework has been set and handed
// in, the teacher's written feedback, and the school's announcements.
//
// Like the weekly report, this file holds only the SHAPES and the wording —
// no database access — so it stays easy to read and the figures are gathered
// in one place (server/parent-overview.ts).
//
// Everything here is read-only by design. There is nothing in these shapes a
// parent could send back to change anything.
//
// All user-facing wording is grouped in OVERVIEW_TEXT at the bottom so it can
// be swapped for Portuguese later.

/** One subject's average across all the child's marked work. */
export type SubjectAverage = {
  subject: string;
  averagePercent: number;
  marked: number; // how many marked pieces that average is based on
};

/** One piece of marked work, as a parent sees it. */
export type RecentMark = {
  // Which piece of work this mark is for, so the row can be tapped to open it
  // question by question (/parent/work/:submissionId). The server still checks
  // the id belongs to this parent's child before answering — see
  // requireParentSubmission — so this is a convenience, never a permission.
  submissionId: number;
  subject: string;
  title: string;          // the assignment's title
  score: number;          // marks scored
  outOf: number;          // marks available
  percent: number;
  markedAt: string;       // ISO date-time
  feedback: string | null; // the teacher's written comment, when there is one
};

/** One assignment the child has not handed in yet. */
export type OutstandingItem = {
  subject: string;
  title: string;
  dueDate: string; // YYYY-MM-DD, this child's own deadline
};

export type ParentOverview = {
  child: { id: number; fullName: string; form: string };

  // The average across every piece of marked work, not just this week — this
  // is the "current average" a parent means when they ask how their child is
  // doing. Null when nothing has been marked at all, which is NOT zero.
  averagePercent: number | null;

  // Best-first, so the strongest subject reads at the top.
  subjects: SubjectAverage[];

  // Newest first. Capped in the builder so the page stays quick to read.
  recentMarks: RecentMark[];

  homework: {
    assigned: number;    // everything set for this child so far
    completed: number;   // how many of those they have handed in
    outstanding: OutstandingItem[]; // the ones still to do, soonest first
  };

  // The portal has NO attendance register — the QR "attendance card" is only
  // used for logging in, and nothing records a child being present in class.
  // So `recorded` is false and the honest figure we can give is the number of
  // days in the last four weeks the child handed work in. The page must label
  // it as homework activity and say plainly that it is not school attendance.
  attendance: {
    recorded: false;
    daysActiveLast4Weeks: number;
  };

  // School notices for this child's class (and notices for everyone).
  announcements: Array<{
    id: number;
    title: string;
    content: string;
    priority: string;
    createdAt: string;
  }>;
};

// --- Wording --------------------------------------------------------------
// Grouped here so the whole parent view can be translated in one place.

export const OVERVIEW_TEXT = {
  average: "Current average",
  averageNote: "Across all marked work so far",
  nothingMarked: "No work has been marked yet",

  subjects: "Marks by subject",
  subjectsEmpty: "Once work has been marked, each subject's average appears here.",

  recentMarks: "Recent marks",
  recentMarksEmpty: "No marked work yet.",

  homework: "Homework",
  homeworkSet: "Set",
  homeworkDone: "Handed in",
  outstanding: "Still to hand in",
  outstandingEmpty: "Nothing outstanding — everything set has been handed in.",

  activity: "Days active on homework",
  activityNote:
    "Days in the last four weeks your child handed work in. This is not a record of school attendance — the portal does not keep an attendance register.",

  feedback: "Teacher feedback",
  feedbackEmpty: "No written feedback yet.",

  announcements: "School announcements",
  announcementsEmpty: "No announcements at the moment.",

  readOnly: "This is a view-only account. You can see your child's work but not change it.",
} as const;
