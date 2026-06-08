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
`;
