import { pgTable, text, serial, integer, timestamp, jsonb, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { SlotProgress } from "./game-plays";

// Enums
export const subjectEnum = z.enum(["MATHS", "ENGLISH", "SCIENCE", "PHYSICS", "CHEMISTRY", "BIOLOGY", "ECONOMICS", "BUSINESS_STUDIES", "GEOGRAPHY", "COMPUTER_SCIENCE", "HISTORY", "ACCOUNTING"]);
export type Subject = z.infer<typeof subjectEnum>;

export const formEnum = z.enum(["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"]);
export type Form = z.infer<typeof formEnum>;

// Primary classes are the "Stage" forms; secondary are the "Form" classes.
// Shared by the server (who to award) and the client (who sees the Treasure
// Island map) so "primary" means the same thing everywhere.
export const PRIMARY_FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6"];
export function isPrimaryForm(form: string | null | undefined): boolean {
  return !!form && PRIMARY_FORMS.includes(form);
}

export const submissionStatusEnum = z.enum(["SUBMITTED", "MARKED"]);
export type SubmissionStatus = z.infer<typeof submissionStatusEnum>;

export const resourceTypeEnum = z.enum(["TEXTBOOK", "YOUTUBE", "LESSON_PLAN", "OTHER"]);
export type ResourceType = z.infer<typeof resourceTypeEnum>;

export const lessonTypeEnum = z.enum(["VIDEO", "AUDIO"]);
export type LessonType = z.infer<typeof lessonTypeEnum>;

// Teachers table
export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("teacher"), // Role for access control
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teachersRelations = relations(teachers, ({ many }) => ({
  assignments: many(assignments),
  marks: many(marks),
  resources: many(resources),
  lessons: many(lessons),
}));

export const insertTeacherSchema = createInsertSchema(teachers).omit({ id: true, createdAt: true });
export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;

// Role enum for access control
export const roleEnum = z.enum(["admin", "teacher", "student", "parent"]);
export type Role = z.infer<typeof roleEnum>;

// Students table
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").notNull().unique(), // e.g., F1-001
  // The Master Student Database ID printed on the attendance QR card, e.g.
  // G3-001. Deliberately a SEPARATE column from studentId: the two ids are
  // issued by different systems on different schedules, so sharing one column
  // would break the day either side renumbers. Nullable, so students can be
  // linked to their card gradually rather than all at once.
  qrCode: text("qr_code").unique(),
  fullName: text("full_name").notNull(),
  gender: text("gender").notNull(), // Male/Female
  form: text("form").notNull(), // Form 1, Form 2
  password: text("password"), // Personalized password - set by student on first login
  role: text("role").notNull().default("student"), // Role for access control
  // Whether this pupil may still use the portal. There was no such idea until
  // card login arrived: a pupil who left was simply deleted, which also took
  // their submissions and marks with them. A card is a standing credential, so
  // there has to be a way to stop one working without erasing the child's
  // record. Existing rows default to active.
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  submissions: many(submissions),
}));

export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true });
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

// Parents table
//
// A parent account is a login that can see exactly ONE child and nothing else.
// It stands on its own: it adds no columns to any existing table, and points at
// a student by id only.
export const parents = pgTable("parents", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  // What the parent types to log in. A username rather than an email, because
  // many families here do not use email — the school hands these details out
  // in person when the account is created.
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  // The one child this account may ever see. Every parent request works out the
  // child from THIS column, never from an id in the address bar — that is what
  // stops a parent reaching another family's child. UNIQUE keeps it to one
  // account per child for now.
  studentId: integer("student_id").notNull().unique().references(() => students.id),
  role: text("role").notNull().default("parent"), // Role for access control
  // Lets the school switch an account off without deleting it, the same way a
  // pupil who leaves is deactivated rather than erased.
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const parentsRelations = relations(parents, ({ one }) => ({
  student: one(students, {
    fields: [parents.studentId],
    references: [students.id],
  }),
}));

export const insertParentSchema = createInsertSchema(parents).omit({ id: true, createdAt: true });
export type Parent = typeof parents.$inferSelect;
export type InsertParent = z.infer<typeof insertParentSchema>;

// Assignments table
export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  topic: text("topic"), // Optional topic within subject (e.g., "Algebra" under Maths)
  form: text("form").notNull(), // Form 1, Form 2
  title: text("title").notNull(),
  instructions: text("instructions").notNull(),
  questions: jsonb("questions").$type<Array<{
    id: string;
    questionText: string;
    maxScore: number;
    imageUrls?: string[];
    // --- Auto-marking (all optional) ---
    // When `type` is missing or "written", the question is marked by hand
    // (the original behaviour). The other types are marked automatically in
    // code against the answer key stored below. See shared/auto-marking.ts.
    type?: "written" | "multiple_choice" | "true_false" | "numeric" | "short_text";
    options?: string[];         // multiple_choice: the choices shown to students
    correctOption?: number;     // multiple_choice: index (0-based) of the correct choice
    correctBool?: boolean;      // true_false: the correct answer
    correctNumber?: number;     // numeric: the correct value
    tolerance?: number;         // numeric: how far off is still accepted (e.g. 0.05)
    acceptedAnswers?: string[]; // short_text: any of these count as correct
    explanation?: string;       // one-line note shown to students in their feedback
    // written: what a good answer looks like, in the teacher's own words.
    // Nothing marks against it — a written question is still marked by hand —
    // but it is what a parent is shown next to their child's answer instead of
    // a blank where the correct answer would be. Optional: a question saved
    // before this existed simply has none, and the parent view says so.
    modelAnswer?: string;
    // What this ONE question is about, when it is known more precisely than the
    // assignment's own topic. A question copied out of the Question Bank brings
    // its topic with it; a question typed straight onto the paper has none and
    // falls back to the assignment's.
    //
    // Optional everywhere, so every question saved before this existed simply
    // has none. It is a label, never part of marking. See shared/mastery.ts.
    topic?: string;
  }>>().notNull(),
  attachments: jsonb("attachments").$type<Array<{
    name: string;
    url: string;
    type: string;
  }>>().default([]),
  dueDate: text("due_date").notNull(),
  totalMarks: integer("total_marks").notNull(),
  targetStudentIds: jsonb("target_student_ids").$type<number[]>().default([]), // For tailored homework
  extendedDeadlines: jsonb("extended_deadlines").$type<Array<{
    studentId: number;
    newDueDate: string;
    reason?: string;
  }>>().default([]),
  archived: boolean("archived").default(false).notNull(),
  // Draft & Publish: false means the assignment is still a draft — fully saved,
  // but hidden from students until the teacher taps Publish. Defaults to true so
  // assignments created the normal way go live straight away, exactly as before.
  published: boolean("published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdById: integer("created_by_id").notNull().references(() => teachers.id),
});

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  createdBy: one(teachers, {
    fields: [assignments.createdById],
    references: [teachers.id],
  }),
  submissions: many(submissions),
}));

export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true, createdAt: true });
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;

// Submissions table
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignments.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  status: text("status").notNull().default("SUBMITTED"),
  answers: jsonb("answers").$type<Array<{
    questionId: string;
    answerText: string;
    imageUrls?: string[];
  }>>().notNull(),
  lateDays: integer("late_days").default(0).notNull(),
  aiAnalysis: jsonb("ai_analysis").$type<{
    overallScore: number;
    flags: string[];
    details: string;
  } | null>().default(null),
});

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  student: one(students, {
    fields: [submissions.studentId],
    references: [students.id],
  }),
}));

export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, submittedAt: true, status: true, lateDays: true, aiAnalysis: true });
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

// Marks table
export const marks = pgTable("marks", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id),
  totalScore: integer("total_score").notNull(),
  feedback: text("feedback"),
  markedAt: timestamp("marked_at").defaultNow().notNull(),
  markedById: integer("marked_by_id").notNull().references(() => teachers.id),
  questionMarks: jsonb("question_marks").$type<Array<{
    questionId: string;
    score: number;
    maxScore: number;
    feedback?: string;
    teacherAdjusted?: boolean; // true when a teacher overrode the auto/hand mark
  }>>().notNull(),
});

export const marksRelations = relations(marks, ({ one }) => ({
  submission: one(submissions, {
    fields: [marks.submissionId],
    references: [submissions.id],
  }),
  markedBy: one(teachers, {
    fields: [marks.markedById],
    references: [teachers.id],
  }),
}));

export const insertMarkSchema = createInsertSchema(marks).omit({ id: true, markedAt: true });
export type Mark = typeof marks.$inferSelect;
export type InsertMark = z.infer<typeof insertMarkSchema>;

// Resources table (textbooks, YouTube links, lesson plans)
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // TEXTBOOK, YOUTUBE, LESSON_PLAN, OTHER
  url: text("url"), // For links
  fileUrl: text("file_url"), // For uploaded files
  subject: text("subject"),
  form: text("form"), // Form 1, Form 2, or null for all
  isTeacherOnly: boolean("is_teacher_only").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdById: integer("created_by_id").notNull().references(() => teachers.id),
});

export const resourcesRelations = relations(resources, ({ one }) => ({
  createdBy: one(teachers, {
    fields: [resources.createdById],
    references: [teachers.id],
  }),
}));

export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

// Announcements table
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  form: text("form"), // Form 1, Form 2, or null for all
  priority: text("priority").default("normal"), // normal, important, urgent
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  createdById: integer("created_by_id").notNull().references(() => teachers.id),
});

export const announcementsRelations = relations(announcements, ({ one }) => ({
  createdBy: one(teachers, {
    fields: [announcements.createdById],
    references: [teachers.id],
  }),
}));

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

// Lessons table (video and audio lessons)
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),
  form: text("form").notNull(),
  type: text("type").notNull(), // VIDEO, AUDIO
  fileUrl: text("file_url").notNull(),
  duration: text("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdById: integer("created_by_id").notNull().references(() => teachers.id),
});

export const lessonsRelations = relations(lessons, ({ one }) => ({
  createdBy: one(teachers, {
    fields: [lessons.createdById],
    references: [teachers.id],
  }),
}));

export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true, createdAt: true });
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;

// Export Logs table — tracks teacher CSV export history
export const exportLogs = pgTable("export_logs", {
  id: serial("id").primaryKey(),
  exportedAt: timestamp("exported_at").defaultNow().notNull(),
  teacherEmail: text("teacher_email").notNull(),
  filterType: text("filter_type").notNull(), // full | term | class | assignment
  filterValue: text("filter_value").notNull().default(""), // e.g. "Term 2", "Form 1/MATHS", "Assignment #5"
  recordCount: integer("record_count").notNull(),
});

export const insertExportLogSchema = createInsertSchema(exportLogs).omit({ id: true, exportedAt: true });
export type ExportLog = typeof exportLogs.$inferSelect;
export type InsertExportLog = z.infer<typeof insertExportLogSchema>;

// Student Rewards table — gamification (e.g. the "Treasure Hunt" collectibles).
// This table stands on its own: it only points at a student and does NOT modify
// or add columns to any existing table. The assignment that earned the reward is
// kept as a plain id (not a foreign key), so rewards can also come from other
// sources later (streaks, badges) without a hard link to assignments.
export const studentRewards = pgTable("student_rewards", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id), // who earned it
  rewardType: text("reward_type").notNull(), // e.g. "collectible"
  rewardName: text("reward_name").notNull(), // e.g. "Golden Compass"
  assignmentId: integer("assignment_id"),     // which assignment earned it (plain id, optional)
  earnedAt: timestamp("earned_at").defaultNow().notNull(), // when it was earned
});

export const insertStudentRewardSchema = createInsertSchema(studentRewards).omit({ id: true, earnedAt: true });
export type StudentReward = typeof studentRewards.$inferSelect;
export type InsertStudentReward = z.infer<typeof insertStudentRewardSchema>;

// Student XP + levels (gamification). Like studentRewards, this table stands on
// its own and references a student id ONLY — it does not add columns to, or
// depend on, any existing table. One row per student holds their lifetime XP,
// current level, and a small daily counter used to cap how much XP can be
// earned in a single day.
export const studentXp = pgTable("student_xp", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id), // who this belongs to
  totalXp: integer("total_xp").notNull().default(0),   // lifetime XP
  level: integer("level").notNull().default(0),        // derived from totalXp (every 500 XP = 1 level)
  dailyXp: integer("daily_xp").notNull().default(0),   // XP earned during the day named in dailyDate
  dailyDate: text("daily_date").notNull().default(""), // the day dailyXp counts for (YYYY-MM-DD, UTC)
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStudentXpSchema = createInsertSchema(studentXp).omit({ id: true, updatedAt: true });
export type StudentXp = typeof studentXp.$inferSelect;
export type InsertStudentXp = z.infer<typeof insertStudentXpSchema>;

// Student daily streaks (gamification). Like studentXp and studentRewards this
// table stands on its own — one row per student, referencing a student id only.
// A streak counts consecutive days (in Mozambique time, CAT / UTC+2) on which
// the student completed at least one submission. Freezes auto-save a streak
// when a day is missed. All day fields are plain YYYY-MM-DD strings in CAT.
export const studentStreaks = pgTable("student_streaks", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id), // who this belongs to
  currentStreak: integer("current_streak").notNull().default(0),  // consecutive active days right now
  longestStreak: integer("longest_streak").notNull().default(0),  // best streak ever reached
  lastActiveDate: text("last_active_date").notNull().default(""), // last day that counted (CAT, YYYY-MM-DD)
  freezes: integer("freezes").notNull().default(0),               // freezes held (0..2)
  reachedMilestones: text("reached_milestones").notNull().default(""), // CSV of milestone days already celebrated
  pendingNotice: text("pending_notice").notNull().default(""),    // JSON of a one-time note to show on the dashboard
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStudentStreakSchema = createInsertSchema(studentStreaks).omit({ id: true, updatedAt: true });
export type StudentStreak = typeof studentStreaks.$inferSelect;
export type InsertStudentStreak = z.infer<typeof insertStudentStreakSchema>;

// Dream World (gamification: a town-building reward game for primary students).
// Like the other gamification tables it stands on its own — one row per student,
// referencing a student id only. It holds the student's resource wallet (coins,
// bricks, wood, gems) and their saved town layout (a JSON array of placed
// buildings). Secondary students (Forms) never get a row.
export const dreamWorld = pgTable("dream_world", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id), // who this belongs to
  coins: integer("coins").notNull().default(0),
  bricks: integer("bricks").notNull().default(0),
  wood: integer("wood").notNull().default(0),
  gems: integer("gems").notNull().default(0),
  layout: text("layout").notNull().default("[]"),       // JSON: [{ id, x, y, placedAt }, ...]
  seenUnlocks: text("seen_unlocks").notNull().default(""), // CSV of building ids whose unlock was celebrated
  townName: text("town_name").notNull().default(""),      // the student's chosen town name
  townNamedAt: text("town_named_at").notNull().default(""), // ISO time of the last rename (once-per-week limit)
  foundedAt: text("founded_at").notNull().default(""),    // ISO time the town was founded
  award: text("award").notNull().default(""),             // current Town Award id (set by the teacher run)
  awardTerm: text("award_term").notNull().default(""),    // the term the award is for
  gridSize: integer("grid_size").notNull().default(8),    // plot size (8, or 10 once expanded)
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDreamWorldSchema = createInsertSchema(dreamWorld).omit({ id: true, updatedAt: true });
export type DreamWorld = typeof dreamWorld.$inferSelect;
export type InsertDreamWorld = z.infer<typeof insertDreamWorldSchema>;

// Penalty Shootout best scores (gamification: a football quiz for primary
// students). Like the other gamification tables it stands on its own,
// referencing a student id only. One row PER STUDENT PER SUBJECT holds their
// personal best out of 10 and how many games they have played, so a child can
// chase their own record in each subject. Forms never get a row.
export const penaltyBest = pgTable("penalty_best", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id), // who this belongs to
  subject: text("subject").notNull(),                    // the subject played (as written on the assignment)
  bestScore: integer("best_score").notNull().default(0), // personal best score
  bestOutOf: integer("best_out_of").notNull().default(0),// how many shots that game was, so records compare fairly
  gamesPlayed: integer("games_played").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPenaltyBestSchema = createInsertSchema(penaltyBest).omit({ id: true, updatedAt: true });
export type PenaltyBest = typeof penaltyBest.$inferSelect;
export type InsertPenaltyBest = z.infer<typeof insertPenaltyBestSchema>;

// Plays earned by doing homework (Stages 3-6 only).
//
// A child earns one play of Target Blaster and one of Penalty Shootout for
// every assignment they hand in that day. This table holds only what they have
// USED: how many they EARNED is counted from the assignments they handed in
// today, never stored.
//
// That is what makes the daily reset free. A "day" is the CAT date in the `day`
// column, so tomorrow simply has no row — used starts at 0 and earned is
// recounted from tomorrow's homework. Unused plays cannot carry over because
// there is nothing to carry: yesterday's row is just left behind.
//
// The game in flight is kept here too. Its questions are fixed the moment a
// game starts, so the finish can be marked slot by slot against the questions
// actually asked rather than trusting whatever the browser sends back.
export const gamePlays = pgTable("game_plays", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  day: text("day").notNull(),   // YYYY-MM-DD in CAT, from streakToday()
  game: text("game").notNull(), // "penalty" | "blaster"
  used: integer("used").notNull().default(0),
  // The questions of the game currently being played, in order, as
  // "assignmentId:questionId" refs. Empty when no game is in flight.
  activeRefs: jsonb("active_refs").$type<string[]>().default([]),
  // What has happened in that game so far, one entry per question above and in
  // the same order: null until a round is played, then how it went. This is
  // what lets a child who walked away be put back into the SAME game at the
  // round they reached, instead of losing the play. See shared/game-plays.ts.
  activeAnswers: jsonb("active_answers").$type<SlotProgress>().default([]),
  activeSubject: text("active_subject"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GamePlays = typeof gamePlays.$inferSelect;

// Written out by hand rather than derived from the table. createInsertSchema
// turns the JSON array column into a shape TypeScript will not accept back as
// a plain string[], and this row is only ever written by our own code, so a
// short honest type is clearer than fighting the generated one.
export type InsertGamePlays = {
  studentId: number;
  day: string;
  game: string;
  used?: number;
  activeRefs?: string[];
  activeAnswers?: SlotProgress;
  activeSubject?: string | null;
};

// Target Blaster's personal best. One row per child, not per subject: a blast
// mixes every subject they have done, so there is a single record to chase.
export const blasterBest = pgTable("blaster_best", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  bestScore: integer("best_score").notNull().default(0),
  bestOutOf: integer("best_out_of").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBlasterBestSchema = createInsertSchema(blasterBest).omit({ id: true, updatedAt: true });
export type BlasterBest = typeof blasterBest.$inferSelect;
export type InsertBlasterBest = z.infer<typeof insertBlasterBestSchema>;

// The Question Bank — a library of reusable questions (see shared/question-bank.ts).
//
// A NEW table beside the assignments, not a change to them. A question inside
// an assignment lives in that assignment's `questions` JSON column and vanishes
// with the paper; a bank question exists on its own and is meant to be used
// many times, so it needs its own row and its own tags to be found by.
//
// The answer-key columns carry the SAME names as the fields inside an
// assignment's question, so a later stage can copy one into the other without
// renaming anything and markAnswer() can mark it unchanged.
export const questionBank = pgTable("question_bank", {
  id: serial("id").primaryKey(),

  questionText: text("question_text").notNull(),
  // One of the four auto-markable types. Never "written": a written question
  // has no answer key, so it is not a reusable question-with-an-answer.
  type: text("type").notNull(),
  maxScore: integer("max_score").notNull().default(1),

  // --- The answer key. Which columns matter depends on `type`. ---
  options: jsonb("options").$type<string[]>(),        // multiple_choice: the choices
  correctOption: integer("correct_option"),           // multiple_choice: 0-based index
  correctBool: boolean("correct_bool"),               // true_false
  correctNumber: doublePrecision("correct_number"),   // numeric: the right value
  tolerance: doublePrecision("tolerance"),            // numeric: how far off still counts
  acceptedAnswers: jsonb("accepted_answers").$type<string[]>(), // short_text
  explanation: text("explanation"),                   // the one-line note shown afterwards

  // --- Tags: what the question is ABOUT, which is how it is found again. ---
  subject: text("subject").notNull(),
  topic: text("topic").notNull(),
  // The class level. Called `form` because that is the word the whole app
  // already uses for "Stage 3" … "Form 2"; naming it `grade` here would make
  // this the one place that says it differently.
  form: text("form").notNull(),
  difficulty: text("difficulty").notNull(), // easy | medium | hard

  // Who saved it, and when. Taken from the teacher's session, never from the
  // browser — the same rule as everything else that records an author.
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QuestionBankRow = typeof questionBank.$inferSelect;

// Certificates & Awards — what a child has been awarded, and when.
//
// Written down rather than worked out afresh every time, for two reasons: a
// certificate is a record (it should not vanish because a mark was later
// edited), and it has to carry the date it was EARNED rather than the date
// somebody looked.
//
// `cert_key` is what makes earning idempotent. It names the ACHIEVEMENT — a
// submission id, a topic, a level — so the same milestone can only be written
// down once however many times the page is opened. Unique per student.
export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  kind: text("kind").notNull(),
  // Named cert_key, not key: "key" is reserved in some SQL dialects and this
  // table is created by hand-written DDL as well as by drizzle.
  certKey: text("cert_key").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  // The date of the ACHIEVEMENT. Not defaulted to now(): a certificate for a
  // paper marked in July must say July.
  earnedAt: timestamp("earned_at").notNull(),
  // The teacher who ran it, for certificates a teacher issues by hand. Null for
  // the ones the milestones award on their own.
  issuedById: integer("issued_by_id"),
});

export type CertificateRow = typeof certificates.$inferSelect;

export type InsertCertificateRow = {
  studentId: number;
  kind: string;
  certKey: string;
  title: string;
  detail: string;
  earnedAt: Date;
  issuedById?: number | null;
};

// Written out by hand rather than derived. createInsertSchema turns the JSON
// array columns into a shape TypeScript will not accept back as plain
// string[], and these rows are only ever written by our own code.
export type InsertQuestionBankRow = {
  questionText: string;
  type: string;
  maxScore: number;
  options?: string[] | null;
  correctOption?: number | null;
  correctBool?: boolean | null;
  correctNumber?: number | null;
  tolerance?: number | null;
  acceptedAnswers?: string[] | null;
  explanation?: string | null;
  subject: string;
  topic: string;
  form: string;
  difficulty: string;
  createdById: number;
};

// Login schemas
export const teacherLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});
export type TeacherLogin = z.infer<typeof teacherLoginSchema>;

export const studentLoginSchema = z.object({
  fullName: z.string().min(1, "Your name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type StudentLogin = z.infer<typeof studentLoginSchema>;

// Parent login. A username and password the school gave them — no first-login
// password-setting like the student form, because a parent account always has
// a password from the moment the teacher creates it.
export const parentLoginSchema = z.object({
  username: z.string().min(1, "Your username is required"),
  password: z.string().min(1, "Password is required"),
});
export type ParentLogin = z.infer<typeof parentLoginSchema>;

// What a teacher fills in on a student's record to create that child's parent
// account. The child is taken from the address of the request, not from here,
// so a teacher cannot aim the new account at a different pupil by editing the
// form they submit.
export const createParentAccountSchema = z.object({
  fullName: z.string().min(1, "The parent's name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type CreateParentAccount = z.infer<typeof createParentAccountSchema>;

// What a teacher may change on an existing parent account: the parent's name,
// the username they log in with, and their password.
//
// The child is deliberately absent. An account is tied to one pupil at the
// moment it is created and stays there for life, so an edit can never quietly
// point a parent at somebody else's child. To move a parent, remove the
// account and add a new one on the right record.
//
// A blank password means "leave the current one alone" — a teacher fixing a
// spelling mistake in the name should not have to reissue the password.
export const updateParentAccountSchema = z.object({
  fullName: z.string().min(1, "The parent's name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.union([
    z.string().min(6, "Password must be at least 6 characters"),
    z.literal(""),
  ]).optional(),
});
export type UpdateParentAccount = z.infer<typeof updateParentAccountSchema>;

// Master password for admin access
export const MASTER_PASSWORD = "onpoint_admin_2024";
