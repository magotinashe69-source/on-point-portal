import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
export const roleEnum = z.enum(["admin", "teacher", "student"]);
export type Role = z.infer<typeof roleEnum>;

// Students table
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").notNull().unique(), // e.g., F1-001
  fullName: text("full_name").notNull(),
  gender: text("gender").notNull(), // Male/Female
  form: text("form").notNull(), // Form 1, Form 2
  password: text("password"), // Personalized password - set by student on first login
  role: text("role").notNull().default("student"), // Role for access control
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  submissions: many(submissions),
}));

export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true });
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDreamWorldSchema = createInsertSchema(dreamWorld).omit({ id: true, updatedAt: true });
export type DreamWorld = typeof dreamWorld.$inferSelect;
export type InsertDreamWorld = z.infer<typeof insertDreamWorldSchema>;

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

// Master password for admin access
export const MASTER_PASSWORD = "onpoint_admin_2024";
