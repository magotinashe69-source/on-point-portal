// SQLite versions of the database tables.
//
// These mirror the PostgreSQL tables in `schema.ts` exactly (same table names,
// same column names, same shapes). The app uses these automatically when no
// DATABASE_URL is set, so it can run on any computer with zero setup.
//
// The TypeScript types (Teacher, Student, ...) still come from `schema.ts` —
// this file only provides the table objects that database queries run against.

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Small helper: a "created/updated at" timestamp that defaults to "now".
// In SQLite we store timestamps as numbers, and Drizzle converts them
// to/from JavaScript Date objects for us.
const timestamp = (name: string) => integer(name, { mode: "timestamp" });

// --- Teachers ---
export const teachers = sqliteTable("teachers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("teacher"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
});

// --- Students ---
export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  gender: text("gender").notNull(),
  form: text("form").notNull(),
  password: text("password"), // set by the student on first login
  role: text("role").notNull().default("student"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
});

// --- Assignments ---
export const assignments = sqliteTable("assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subject: text("subject").notNull(),
  topic: text("topic"),
  form: text("form").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull(),
  questions: text("questions", { mode: "json" }).$type<Array<{
    id: string;
    questionText: string;
    maxScore: number;
    imageUrls?: string[];
    // --- Auto-marking (all optional) --- mirrors shared/schema.ts.
    // Missing/"written" = marked by hand; other types are marked in code.
    type?: "written" | "multiple_choice" | "true_false" | "numeric" | "short_text";
    options?: string[];         // multiple_choice: the choices shown to students
    correctOption?: number;     // multiple_choice: index (0-based) of the correct choice
    correctBool?: boolean;      // true_false: the correct answer
    correctNumber?: number;     // numeric: the correct value
    tolerance?: number;         // numeric: how far off is still accepted (e.g. 0.05)
    acceptedAnswers?: string[]; // short_text: any of these count as correct
    explanation?: string;       // one-line note shown to students in their feedback
  }>>().notNull(),
  attachments: text("attachments", { mode: "json" }).$type<Array<{
    name: string;
    url: string;
    type: string;
  }>>().$defaultFn(() => []),
  dueDate: text("due_date").notNull(),
  totalMarks: integer("total_marks").notNull(),
  targetStudentIds: text("target_student_ids", { mode: "json" }).$type<number[]>().$defaultFn(() => []),
  extendedDeadlines: text("extended_deadlines", { mode: "json" }).$type<Array<{
    studentId: number;
    newDueDate: string;
    reason?: string;
  }>>().$defaultFn(() => []),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
  createdById: integer("created_by_id").notNull().references(() => teachers.id),
});

// --- Submissions ---
export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignmentId: integer("assignment_id").notNull().references(() => assignments.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  submittedAt: timestamp("submitted_at").notNull().$defaultFn(() => new Date()),
  status: text("status").notNull().default("SUBMITTED"),
  answers: text("answers", { mode: "json" }).$type<Array<{
    questionId: string;
    answerText: string;
    imageUrls?: string[];
  }>>().notNull(),
  lateDays: integer("late_days").notNull().default(0),
  aiAnalysis: text("ai_analysis", { mode: "json" }).$type<{
    overallScore: number;
    flags: string[];
    details: string;
  } | null>(),
});

// --- Marks ---
export const marks = sqliteTable("marks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: integer("submission_id").notNull().references(() => submissions.id),
  totalScore: integer("total_score").notNull(),
  feedback: text("feedback"),
  markedAt: timestamp("marked_at").notNull().$defaultFn(() => new Date()),
  markedById: integer("marked_by_id").notNull().references(() => teachers.id),
  questionMarks: text("question_marks", { mode: "json" }).$type<Array<{
    questionId: string;
    score: number;
    maxScore: number;
    feedback?: string;
  }>>().notNull(),
});

// --- Resources (textbooks, links, lesson plans) ---
export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  url: text("url"),
  fileUrl: text("file_url"),
  subject: text("subject"),
  form: text("form"),
  isTeacherOnly: integer("is_teacher_only", { mode: "boolean" }).default(false),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
  createdById: integer("created_by_id").notNull().references(() => teachers.id),
});

// --- Announcements ---
export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  form: text("form"),
  priority: text("priority").default("normal"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
  expiresAt: timestamp("expires_at"),
  createdById: integer("created_by_id").notNull().references(() => teachers.id),
});

// --- Lessons (video and audio) ---
export const lessons = sqliteTable("lessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),
  form: text("form").notNull(),
  type: text("type").notNull(),
  fileUrl: text("file_url").notNull(),
  duration: text("duration"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => new Date()),
  createdById: integer("created_by_id").notNull().references(() => teachers.id),
});

// --- Export logs (teacher CSV export history) ---
export const exportLogs = sqliteTable("export_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exportedAt: timestamp("exported_at").notNull().$defaultFn(() => new Date()),
  teacherEmail: text("teacher_email").notNull(),
  filterType: text("filter_type").notNull(),
  filterValue: text("filter_value").notNull().default(""),
  recordCount: integer("record_count").notNull(),
});

// --- Student Rewards (gamification: Treasure Hunt collectibles etc.) ---
// Stands alone: only points at a student, does not touch any existing table.
export const studentRewards = sqliteTable("student_rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  rewardType: text("reward_type").notNull(), // e.g. "collectible"
  rewardName: text("reward_name").notNull(), // e.g. "Golden Compass"
  assignmentId: integer("assignment_id"),     // which assignment earned it (plain id, optional)
  earnedAt: timestamp("earned_at").notNull().$defaultFn(() => new Date()),
});

// --- Student XP + levels (gamification) ---
// One row per student: lifetime XP, current level, and a small daily counter.
// References a student id only; does not touch any existing table.
export const studentXp = sqliteTable("student_xp", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(0),
  dailyXp: integer("daily_xp").notNull().default(0),
  dailyDate: text("daily_date").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => new Date()),
});

// --- Student daily streaks (gamification) ---
// One row per student: current/longest streak, freezes held, and small
// bookkeeping fields. References a student id only; touches no existing table.
export const studentStreaks = sqliteTable("student_streaks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: text("last_active_date").notNull().default(""),
  freezes: integer("freezes").notNull().default(0),
  reachedMilestones: text("reached_milestones").notNull().default(""),
  pendingNotice: text("pending_notice").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => new Date()),
});

// --- Dream World (gamification: town-building reward game, primary only) ---
// One row per student: their resource wallet plus a JSON town layout.
export const dreamWorld = sqliteTable("dream_world", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  coins: integer("coins").notNull().default(0),
  bricks: integer("bricks").notNull().default(0),
  wood: integer("wood").notNull().default(0),
  gems: integer("gems").notNull().default(0),
  layout: text("layout").notNull().default("[]"),
  seenUnlocks: text("seen_unlocks").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => new Date()),
});

// Plain SQL that creates every table above if it does not exist yet.
// We run this once on startup so a fresh SQLite database is ready to use
// with no manual migration step.
export const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  form TEXT NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  topic TEXT,
  form TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  questions TEXT NOT NULL,
  attachments TEXT,
  due_date TEXT NOT NULL,
  total_marks INTEGER NOT NULL,
  target_student_ids TEXT,
  extended_deadlines TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  submitted_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  answers TEXT NOT NULL,
  late_days INTEGER NOT NULL DEFAULT 0,
  ai_analysis TEXT
);

CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  feedback TEXT,
  marked_at INTEGER NOT NULL,
  marked_by_id INTEGER NOT NULL,
  question_marks TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  url TEXT,
  file_url TEXT,
  subject TEXT,
  form TEXT,
  is_teacher_only INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  form TEXT,
  priority TEXT DEFAULT 'normal',
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  created_by_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  form TEXT NOT NULL,
  type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  duration TEXT,
  created_at INTEGER NOT NULL,
  created_by_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS export_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exported_at INTEGER NOT NULL,
  teacher_email TEXT NOT NULL,
  filter_type TEXT NOT NULL,
  filter_value TEXT NOT NULL DEFAULT '',
  record_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS student_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_name TEXT NOT NULL,
  assignment_id INTEGER,
  earned_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS student_xp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  daily_xp INTEGER NOT NULL DEFAULT 0,
  daily_date TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS student_streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT NOT NULL DEFAULT '',
  freezes INTEGER NOT NULL DEFAULT 0,
  reached_milestones TEXT NOT NULL DEFAULT '',
  pending_notice TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dream_world (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  bricks INTEGER NOT NULL DEFAULT 0,
  wood INTEGER NOT NULL DEFAULT 0,
  gems INTEGER NOT NULL DEFAULT 0,
  layout TEXT NOT NULL DEFAULT '[]',
  seen_unlocks TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
`;
