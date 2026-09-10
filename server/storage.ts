import { eq, and, inArray, or, isNull, desc, gte, lte } from "drizzle-orm";
// The database connection AND the table objects come from ./db, which picks
// the right database (SQLite or PostgreSQL) at runtime.
import {
  db,
  teachers, students, parents, assignments, submissions, marks, resources, announcements, lessons, exportLogs, studentRewards, studentXp, studentStreaks, dreamWorld, penaltyBest, gamePlays, blasterBest, questionBank,
} from "./db";
// The TypeScript types are the same for both databases, so they come from the shared schema.
import {
  type Teacher, type InsertTeacher,
  type Student, type InsertStudent,
  type Parent, type InsertParent,
  type Assignment, type InsertAssignment,
  type Submission, type InsertSubmission,
  type Mark, type InsertMark,
  type Resource, type InsertResource,
  type Announcement, type InsertAnnouncement,
  type Lesson, type InsertLesson,
  type ExportLog, type InsertExportLog,
  type StudentReward, type InsertStudentReward,
  type StudentXp, type InsertStudentXp,
  type StudentStreak, type InsertStudentStreak,
  type DreamWorld, type InsertDreamWorld,
  type PenaltyBest, type InsertPenaltyBest,
  type GamePlays, type InsertGamePlays,
  type BlasterBest, type InsertBlasterBest,
  type QuestionBankRow,
  MASTER_PASSWORD
} from "@shared/schema";
// The Question Bank's shapes and rules are pure, so they live in shared/.
import {
  validateBankQuestion, DEFAULT_BANK_LIMIT,
  type BankFilters, type BankQuestion, type NewBankQuestion,
} from "@shared/question-bank";

export interface IStorage {
  // Teachers
  getTeacher(id: number): Promise<Teacher | undefined>;
  getTeacherByEmail(email: string): Promise<Teacher | undefined>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  
  // Students
  getStudent(id: number): Promise<Student | undefined>;
  getStudentByStudentId(studentId: string): Promise<Student | undefined>;
  getStudentByQrCode(qrCode: string): Promise<Student | undefined>;
  getStudentByName(name: string): Promise<Student | undefined>;
  getAllStudents(): Promise<Student[]>;
  getStudentsByForm(form: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, data: Partial<InsertStudent>): Promise<Student>;
  updateStudentPassword(id: number, password: string): Promise<void>;
  resetStudentPassword(id: number): Promise<void>;
  deleteStudent(id: number): Promise<void>;

  // Parents
  getParent(id: number): Promise<Parent | undefined>;
  getParentByUsername(username: string): Promise<Parent | undefined>;
  getParentByStudentId(studentId: number): Promise<Parent | undefined>;
  getAllParents(): Promise<Parent[]>;
  createParent(parent: InsertParent): Promise<Parent>;
  updateParent(id: number, changes: { fullName: string; username: string; password?: string }): Promise<Parent | undefined>;
  deleteParent(id: number): Promise<void>;
  
  // Assignments
  getAssignment(id: number): Promise<Assignment | undefined>;
  getAssignments(form?: string, studentId?: number, archived?: boolean, includeDrafts?: boolean): Promise<Assignment[]>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: number, data: Partial<InsertAssignment>): Promise<Assignment>;
  extendDeadline(assignmentId: number, studentId: number, newDueDate: string, reason?: string): Promise<void>;
  deleteAssignment(id: number): Promise<void>;
  
  // Submissions
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissions(filters?: { assignmentId?: number; studentId?: number }): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmission(id: number, data: { answers: Array<{ questionId: string; answerText: string; imageUrls?: string[] }> }): Promise<Submission | undefined>;
  updateSubmissionStatus(id: number, status: string): Promise<void>;
  updateSubmissionAiAnalysis(id: number, analysis: { overallScore: number; flags: string[]; details: string }): Promise<void>;
  
  // Marks
  getMark(submissionId: number): Promise<Mark | undefined>;
  getMarksBySubmissionIds(submissionIds: number[]): Promise<Map<number, Mark>>;
  createMark(mark: InsertMark): Promise<Mark>;
  
  // Resources
  getResource(id: number): Promise<Resource | undefined>;
  getResources(filters?: { form?: string; subject?: string; type?: string; teacherOnly?: boolean }): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;
  deleteResource(id: number): Promise<void>;
  
  // Announcements
  getAnnouncement(id: number): Promise<Announcement | undefined>;
  getAnnouncements(form?: string): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  deleteAnnouncement(id: number): Promise<void>;
  
  // Lessons
  getLesson(id: number): Promise<Lesson | undefined>;
  getLessons(filters?: { form?: string; subject?: string; type?: string }): Promise<Lesson[]>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  deleteLesson(id: number): Promise<void>;

  // Export Logs
  createExportLog(log: InsertExportLog): Promise<ExportLog>;
  getExportLogs(teacherEmail: string, limit?: number): Promise<ExportLog[]>;

  // Student Rewards (gamification)
  createStudentReward(reward: InsertStudentReward): Promise<StudentReward>;
  getStudentRewards(studentId: number): Promise<StudentReward[]>;

  // Student XP + levels (gamification)
  getStudentXp(studentId: number): Promise<StudentXp | undefined>;
  createStudentXp(row: InsertStudentXp): Promise<StudentXp>;
  updateStudentXp(studentId: number, data: Partial<InsertStudentXp>): Promise<StudentXp>;

  getStudentStreak(studentId: number): Promise<StudentStreak | undefined>;
  createStudentStreak(row: InsertStudentStreak): Promise<StudentStreak>;
  updateStudentStreak(studentId: number, data: Partial<InsertStudentStreak>): Promise<StudentStreak>;

  getDreamWorld(studentId: number): Promise<DreamWorld | undefined>;
  createDreamWorld(row: InsertDreamWorld): Promise<DreamWorld>;
  updateDreamWorld(studentId: number, data: Partial<InsertDreamWorld>): Promise<DreamWorld>;

  // Penalty Shootout personal bests — one row per student per subject.
  getPenaltyBest(studentId: number, subject: string): Promise<PenaltyBest | undefined>;
  getPenaltyBests(studentId: number): Promise<PenaltyBest[]>;
  createPenaltyBest(row: InsertPenaltyBest): Promise<PenaltyBest>;
  updatePenaltyBest(studentId: number, subject: string, data: Partial<InsertPenaltyBest>): Promise<PenaltyBest>;
  // Plays earned by doing homework. Keyed by student, CAT day and game, so a
  // new day simply has no row and yesterday's is left behind.
  // --- The Question Bank: a library of reusable questions ---
  /** Save one question to the library. Refuses one that could not be marked. */
  createBankQuestion(question: NewBankQuestion): Promise<BankQuestion>;
  /** Find saved questions by what they are about. */
  getBankQuestions(filters?: BankFilters): Promise<BankQuestion[]>;
  /** One saved question by its id. */
  getBankQuestion(id: number): Promise<BankQuestion | undefined>;
  /** Change a saved question. Only the library copy — never an assignment. */
  updateBankQuestion(id: number, changes: Partial<NewBankQuestion>): Promise<BankQuestion>;
  /** Remove one saved question from the library. */
  deleteBankQuestion(id: number): Promise<void>;

  getGamePlays(studentId: number, day: string, game: string): Promise<GamePlays | undefined>;
  /** Every play row for a group of children across a range of days. */
  getGamePlaysForStudents(studentIds: number[], dayFrom: string, dayTo: string): Promise<GamePlays[]>;
  upsertGamePlays(row: InsertGamePlays): Promise<GamePlays>;
  // Target Blaster's record. One row per child, not per subject.
  getBlasterBest(studentId: number): Promise<BlasterBest | undefined>;
  createBlasterBest(row: InsertBlasterBest): Promise<BlasterBest>;
  updateBlasterBest(studentId: number, data: Partial<InsertBlasterBest>): Promise<BlasterBest>;

  // Seed data
  seedInitialData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Teachers
  async getTeacher(id: number): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
    return teacher || undefined;
  }

  async getTeacherByEmail(email: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.email, email));
    return teacher || undefined;
  }

  async createTeacher(teacher: InsertTeacher): Promise<Teacher> {
    const [newTeacher] = await db.insert(teachers).values(teacher).returning();
    return newTeacher;
  }

  // Students
  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student || undefined;
  }

  async getStudentByStudentId(studentId: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.studentId, studentId));
    return student || undefined;
  }

  // Look a pupil up by the Master Student Database ID on their QR card.
  // Codes are printed in upper case; normalise so a scan that arrives lower
  // case still matches.
  async getStudentByQrCode(qrCode: string): Promise<Student | undefined> {
    const code = qrCode.trim().toUpperCase();
    if (!code) return undefined;
    const [student] = await db.select().from(students).where(eq(students.qrCode, code));
    return student || undefined;
  }

  async getStudentByName(name: string): Promise<Student | undefined> {
    // Case-insensitive search for student by full name
    const allStudents = await db.select().from(students);
    const student = allStudents.find(s => 
      s.fullName.toLowerCase() === name.toLowerCase() ||
      s.fullName.toLowerCase().split(' ')[0] === name.toLowerCase() // Allow first name only
    );
    return student || undefined;
  }

  async getAllStudents(): Promise<Student[]> {
    return db.select().from(students);
  }

  async getStudentsByForm(form: string): Promise<Student[]> {
    return db.select().from(students).where(eq(students.form, form));
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [newStudent] = await db.insert(students).values(student).returning();
    return newStudent;
  }

  async updateStudentPassword(id: number, password: string): Promise<void> {
    await db.update(students).set({ password }).where(eq(students.id, id));
  }

  async resetStudentPassword(id: number): Promise<void> {
    await db.update(students).set({ password: null }).where(eq(students.id, id));
  }

  async updateStudent(id: number, data: Partial<InsertStudent>): Promise<Student> {
    const [updated] = await db.update(students).set(data).where(eq(students.id, id)).returning();
    return updated;
  }

  async deleteStudent(id: number): Promise<void> {
    // Delete related submissions and marks first
    const studentSubmissions = await db.select().from(submissions).where(eq(submissions.studentId, id));
    for (const sub of studentSubmissions) {
      await db.delete(marks).where(eq(marks.submissionId, sub.id));
    }
    await db.delete(submissions).where(eq(submissions.studentId, id));
    // The child's parent account goes with them. Leaving it behind would mean a
    // working login pointing at a pupil who no longer exists.
    await db.delete(parents).where(eq(parents.studentId, id));

    // Everything the gamification side remembers about them. This used to be
    // left behind: removing 74 pupils once left over a thousand dead rows
    // across these seven tables, all keyed to children who no longer existed.
    //
    // It was never dangerous — ids are AUTOINCREMENT in SQLite and serial in
    // PostgreSQL, so a new pupil can never be handed a deleted one's id and
    // inherit their XP — but it is a child's record, and when they are removed
    // it should go with them rather than linger.
    await db.delete(studentXp).where(eq(studentXp.studentId, id));
    await db.delete(studentStreaks).where(eq(studentStreaks.studentId, id));
    await db.delete(studentRewards).where(eq(studentRewards.studentId, id));
    await db.delete(penaltyBest).where(eq(penaltyBest.studentId, id));
    await db.delete(blasterBest).where(eq(blasterBest.studentId, id));
    await db.delete(gamePlays).where(eq(gamePlays.studentId, id));
    await db.delete(dreamWorld).where(eq(dreamWorld.studentId, id));

    await db.delete(students).where(eq(students.id, id));
  }

  // Parents
  async getParent(id: number): Promise<Parent | undefined> {
    const [parent] = await db.select().from(parents).where(eq(parents.id, id));
    return parent || undefined;
  }

  // Usernames are stored and compared in lower case, so a parent typing
  // "Mrs.Moyo" still matches the account created as "mrs.moyo".
  async getParentByUsername(username: string): Promise<Parent | undefined> {
    const name = username.trim().toLowerCase();
    if (!name) return undefined;
    const [parent] = await db.select().from(parents).where(eq(parents.username, name));
    return parent || undefined;
  }

  // Used to check a child does not already have an account before making one.
  async getParentByStudentId(studentId: number): Promise<Parent | undefined> {
    const [parent] = await db.select().from(parents).where(eq(parents.studentId, studentId));
    return parent || undefined;
  }

  async getAllParents(): Promise<Parent[]> {
    return db.select().from(parents);
  }

  async createParent(parent: InsertParent): Promise<Parent> {
    const [newParent] = await db.insert(parents).values(parent).returning();
    return newParent;
  }

  // Correct the details on an account that already exists.
  //
  // Only the three things a teacher can sensibly change are accepted. The
  // child (studentId) is not one of them: an account belongs to the pupil it
  // was created on and stays there, so no edit can point a parent at another
  // family's child.
  async updateParent(
    id: number,
    changes: { fullName: string; username: string; password?: string },
  ): Promise<Parent | undefined> {
    const fields: { fullName: string; username: string; password?: string } = {
      fullName: changes.fullName,
      username: changes.username.toLowerCase(),
    };
    // A blank password means "keep the one they already have", so a teacher
    // fixing a name does not accidentally lock the parent out.
    if (changes.password) fields.password = changes.password;

    const [updated] = await db.update(parents).set(fields).where(eq(parents.id, id)).returning();
    return updated || undefined;
  }

  async deleteParent(id: number): Promise<void> {
    await db.delete(parents).where(eq(parents.id, id));
  }

  // Assignments
  async getAssignment(id: number): Promise<Assignment | undefined> {
    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id));
    return assignment || undefined;
  }

  // Fetch assignments. `includeDrafts` defaults to false, so unpublished drafts
  // are hidden from every caller unless it explicitly asks for them — that is
  // what keeps drafts out of the student dashboard, the games, the gradebook
  // and the reports without each of them needing its own check.
  async getAssignments(form?: string, studentId?: number, archived?: boolean, includeDrafts = false): Promise<Assignment[]> {
    const isArchived = archived === true;

    // A draft is anything explicitly marked published = false. Anything else
    // (including older rows saved before this column existed) counts as live.
    const isDraft = (a: Assignment) => a.published === false;

    if (form) {
      const conditions = [eq(assignments.form, form), eq(assignments.archived, isArchived)];
      let results = await db.select().from(assignments).where(and(...conditions));
      if (!includeDrafts) results = results.filter(a => !isDraft(a));
      if (studentId) {
        return results.filter(a => {
          const targets = a.targetStudentIds || [];
          return targets.length === 0 || targets.includes(studentId);
        });
      }
      return results;
    }

    const all = await db.select().from(assignments).where(eq(assignments.archived, isArchived));
    return includeDrafts ? all : all.filter(a => !isDraft(a));
  }

  async createAssignment(assignment: InsertAssignment): Promise<Assignment> {
    const [newAssignment] = await db.insert(assignments).values({
      ...assignment,
      questions: assignment.questions as any,
      attachments: assignment.attachments as any,
      targetStudentIds: assignment.targetStudentIds as any,
      extendedDeadlines: assignment.extendedDeadlines as any,
    }).returning();
    return newAssignment;
  }

  async updateAssignment(id: number, data: Partial<InsertAssignment>): Promise<Assignment> {
    const updateData: any = { ...data };
    if (data.questions) updateData.questions = data.questions as any;
    if (data.attachments) updateData.attachments = data.attachments as any;
    if (data.targetStudentIds) updateData.targetStudentIds = data.targetStudentIds as any;
    if (data.extendedDeadlines) updateData.extendedDeadlines = data.extendedDeadlines as any;
    
    const [updated] = await db.update(assignments).set(updateData).where(eq(assignments.id, id)).returning();
    return updated;
  }

  async extendDeadline(assignmentId: number, studentId: number, newDueDate: string, reason?: string): Promise<void> {
    const assignment = await this.getAssignment(assignmentId);
    if (!assignment) throw new Error("Assignment not found");
    
    const extendedDeadlines = assignment.extendedDeadlines || [];
    const existingIndex = extendedDeadlines.findIndex(e => e.studentId === studentId);
    
    if (existingIndex >= 0) {
      extendedDeadlines[existingIndex] = { studentId, newDueDate, reason };
    } else {
      extendedDeadlines.push({ studentId, newDueDate, reason });
    }
    
    await db.update(assignments).set({ extendedDeadlines: extendedDeadlines as any }).where(eq(assignments.id, assignmentId));
  }

  async deleteAssignment(id: number): Promise<void> {
    // Delete related submissions and marks first
    const submissionsList = await db.select().from(submissions).where(eq(submissions.assignmentId, id));
    for (const sub of submissionsList) {
      await db.delete(marks).where(eq(marks.submissionId, sub.id));
    }
    await db.delete(submissions).where(eq(submissions.assignmentId, id));
    await db.delete(assignments).where(eq(assignments.id, id));
  }

  // Submissions
  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission || undefined;
  }

  async getSubmissions(filters?: { assignmentId?: number; studentId?: number }): Promise<Submission[]> {
    if (filters?.assignmentId && filters?.studentId) {
      return db.select().from(submissions).where(
        and(eq(submissions.assignmentId, filters.assignmentId), eq(submissions.studentId, filters.studentId))
      );
    }
    if (filters?.assignmentId) {
      return db.select().from(submissions).where(eq(submissions.assignmentId, filters.assignmentId));
    }
    if (filters?.studentId) {
      return db.select().from(submissions).where(eq(submissions.studentId, filters.studentId));
    }
    return db.select().from(submissions);
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const [newSubmission] = await db.insert(submissions).values({
      ...submission,
      answers: submission.answers as any,
      lateDays: 0,
    }).returning();
    return newSubmission;
  }

  async updateSubmission(id: number, data: { answers: Array<{ questionId: string; answerText: string; imageUrls?: string[] }> }): Promise<Submission | undefined> {
    const [updated] = await db.update(submissions)
      .set({ 
        answers: data.answers as any,
        submittedAt: new Date(),
        lateDays: 0,
      })
      .where(eq(submissions.id, id))
      .returning();
    return updated;
  }

  async updateSubmissionStatus(id: number, status: string): Promise<void> {
    await db.update(submissions).set({ status }).where(eq(submissions.id, id));
  }

  async updateSubmissionAiAnalysis(id: number, analysis: { overallScore: number; flags: string[]; details: string }): Promise<void> {
    await db.update(submissions).set({ aiAnalysis: analysis }).where(eq(submissions.id, id));
  }

  // Marks
  async getMark(submissionId: number): Promise<Mark | undefined> {
    const [mark] = await db.select().from(marks).where(eq(marks.submissionId, submissionId));
    return mark || undefined;
  }

  // Look up the marks for many submissions at once, keyed by submission id.
  // Pages like the Grade Book need a mark for every submission in the school;
  // asking for them one at a time meant hundreds of separate database round
  // trips, which is what made the page sit and spin. This asks once.
  async getMarksBySubmissionIds(submissionIds: number[]): Promise<Map<number, Mark>> {
    const found = new Map<number, Mark>();
    if (submissionIds.length === 0) return found;

    // Some databases limit how many values one "IN (...)" can hold, so ask in
    // batches rather than in a single enormous query.
    const BATCH_SIZE = 500;
    for (let i = 0; i < submissionIds.length; i += BATCH_SIZE) {
      const batch = submissionIds.slice(i, i + BATCH_SIZE);
      const rows = await db.select().from(marks).where(inArray(marks.submissionId, batch));
      for (const mark of rows) found.set(mark.submissionId, mark);
    }
    return found;
  }

  async createMark(mark: InsertMark): Promise<Mark> {
    // Check if mark already exists for this submission
    const existing = await this.getMark(mark.submissionId);
    if (existing) {
      // Update existing mark
      const [updated] = await db.update(marks)
        .set({
          totalScore: mark.totalScore,
          feedback: mark.feedback,
          questionMarks: mark.questionMarks as any,
          markedById: mark.markedById,
          markedAt: new Date(),
        })
        .where(eq(marks.submissionId, mark.submissionId))
        .returning();
      await this.updateSubmissionStatus(mark.submissionId, "MARKED");
      return updated;
    }
    
    const [newMark] = await db.insert(marks).values({
      ...mark,
      questionMarks: mark.questionMarks as any,
    }).returning();
    await this.updateSubmissionStatus(mark.submissionId, "MARKED");
    return newMark;
  }

  // Resources
  async getResource(id: number): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource || undefined;
  }

  async getResources(filters?: { form?: string; subject?: string; type?: string; teacherOnly?: boolean }): Promise<Resource[]> {
    let results = await db.select().from(resources);
    
    if (filters?.form) {
      results = results.filter(r => !r.form || r.form === filters.form);
    }
    if (filters?.subject) {
      results = results.filter(r => !r.subject || r.subject === filters.subject);
    }
    if (filters?.type) {
      results = results.filter(r => r.type === filters.type);
    }
    if (filters?.teacherOnly === false) {
      results = results.filter(r => !r.isTeacherOnly);
    }
    
    return results;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [newResource] = await db.insert(resources).values(resource).returning();
    return newResource;
  }

  async deleteResource(id: number): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  }

  // Announcements
  async getAnnouncement(id: number): Promise<Announcement | undefined> {
    const [announcement] = await db.select().from(announcements).where(eq(announcements.id, id));
    return announcement || undefined;
  }

  async getAnnouncements(form?: string): Promise<Announcement[]> {
    let results = await db.select().from(announcements);
    
    // Filter out expired announcements
    const now = new Date();
    results = results.filter(a => !a.expiresAt || new Date(a.expiresAt) > now);
    
    // Filter by form (null form means for all)
    if (form) {
      results = results.filter(a => !a.form || a.form === form);
    }
    
    // Sort by priority and date (urgent first, then important, then normal, newest first)
    results.sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
      const aPriority = priorityOrder[a.priority || 'normal'] ?? 2;
      const bPriority = priorityOrder[b.priority || 'normal'] ?? 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return results;
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [newAnnouncement] = await db.insert(announcements).values(announcement).returning();
    return newAnnouncement;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  // Lessons
  async getLesson(id: number): Promise<Lesson | undefined> {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
    return lesson || undefined;
  }

  async getLessons(filters?: { form?: string; subject?: string; type?: string }): Promise<Lesson[]> {
    const conditions = [];
    if (filters?.form) {
      conditions.push(eq(lessons.form, filters.form));
    }
    if (filters?.subject) {
      conditions.push(eq(lessons.subject, filters.subject));
    }
    if (filters?.type) {
      conditions.push(eq(lessons.type, filters.type));
    }
    
    let results;
    if (conditions.length > 0) {
      results = await db.select().from(lessons).where(and(...conditions));
    } else {
      results = await db.select().from(lessons);
    }
    
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return results;
  }

  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const [newLesson] = await db.insert(lessons).values(lesson).returning();
    return newLesson;
  }

  async deleteLesson(id: number): Promise<void> {
    await db.delete(lessons).where(eq(lessons.id, id));
  }

  // Export Logs
  async createExportLog(log: InsertExportLog): Promise<ExportLog> {
    const [entry] = await db.insert(exportLogs).values(log).returning();
    return entry;
  }

  // Student Rewards
  async createStudentReward(reward: InsertStudentReward): Promise<StudentReward> {
    const [created] = await db.insert(studentRewards).values(reward).returning();
    return created;
  }

  async getStudentRewards(studentId: number): Promise<StudentReward[]> {
    return db.select().from(studentRewards).where(eq(studentRewards.studentId, studentId));
  }

  // Student XP + levels
  async getStudentXp(studentId: number): Promise<StudentXp | undefined> {
    const [row] = await db.select().from(studentXp).where(eq(studentXp.studentId, studentId));
    return row || undefined;
  }

  async createStudentXp(row: InsertStudentXp): Promise<StudentXp> {
    const [created] = await db.insert(studentXp).values(row).returning();
    return created;
  }

  async updateStudentXp(studentId: number, data: Partial<InsertStudentXp>): Promise<StudentXp> {
    const [updated] = await db.update(studentXp)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studentXp.studentId, studentId))
      .returning();
    return updated;
  }

  // Student daily streaks
  async getStudentStreak(studentId: number): Promise<StudentStreak | undefined> {
    const [row] = await db.select().from(studentStreaks).where(eq(studentStreaks.studentId, studentId));
    return row || undefined;
  }

  async createStudentStreak(row: InsertStudentStreak): Promise<StudentStreak> {
    const [created] = await db.insert(studentStreaks).values(row).returning();
    return created;
  }

  async updateStudentStreak(studentId: number, data: Partial<InsertStudentStreak>): Promise<StudentStreak> {
    const [updated] = await db.update(studentStreaks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studentStreaks.studentId, studentId))
      .returning();
    return updated;
  }

  // Dream World (wallet + town layout)
  async getDreamWorld(studentId: number): Promise<DreamWorld | undefined> {
    const [row] = await db.select().from(dreamWorld).where(eq(dreamWorld.studentId, studentId));
    return row || undefined;
  }

  async createDreamWorld(row: InsertDreamWorld): Promise<DreamWorld> {
    const [created] = await db.insert(dreamWorld).values(row).returning();
    return created;
  }

  async updateDreamWorld(studentId: number, data: Partial<InsertDreamWorld>): Promise<DreamWorld> {
    const [updated] = await db.update(dreamWorld)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dreamWorld.studentId, studentId))
      .returning();
    return updated;
  }

  // Penalty Shootout personal bests. Keyed by student AND subject, so a child
  // has a separate record to chase in each subject they play.
  async getPenaltyBest(studentId: number, subject: string): Promise<PenaltyBest | undefined> {
    const [row] = await db.select().from(penaltyBest)
      .where(and(eq(penaltyBest.studentId, studentId), eq(penaltyBest.subject, subject)));
    return row || undefined;
  }

  async getPenaltyBests(studentId: number): Promise<PenaltyBest[]> {
    return db.select().from(penaltyBest).where(eq(penaltyBest.studentId, studentId));
  }

  async createPenaltyBest(row: InsertPenaltyBest): Promise<PenaltyBest> {
    const [created] = await db.insert(penaltyBest).values(row).returning();
    return created;
  }

  async updatePenaltyBest(studentId: number, subject: string, data: Partial<InsertPenaltyBest>): Promise<PenaltyBest> {
    const [updated] = await db.update(penaltyBest)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(penaltyBest.studentId, studentId), eq(penaltyBest.subject, subject)))
      .returning();
    return updated;
  }

  // --- Plays earned by doing homework -------------------------------------
  //
  // Only what has been USED is stored. What a child EARNED is counted from the
  // assignments they handed in today (server/game-plays.ts), so nothing here
  // needs clearing overnight: tomorrow is a different `day` and finds no row.

  // ---------------------------------------------------------------------
  // The Question Bank
  //
  // A library of reusable questions, stored on its own rather than inside an
  // assignment. Nothing reads from it yet — assignments will draw from it in a
  // later stage. See shared/question-bank.ts for the shapes and the rules.
  // ---------------------------------------------------------------------

  /**
   * Turn a database row into the shape the rest of the app uses.
   *
   * The two differ in ways worth smoothing over here rather than at every call
   * site: the table holds nulls where the type says "absent", and SQLite hands
   * back a Date for created_at while the shape wants a plain ISO string.
   */
  private toBankQuestion(row: QuestionBankRow): BankQuestion {
    return {
      id: row.id,
      questionText: row.questionText,
      type: row.type as BankQuestion["type"],
      maxScore: row.maxScore,
      options: (row.options as string[] | null) ?? undefined,
      correctOption: row.correctOption ?? undefined,
      correctBool: row.correctBool ?? undefined,
      correctNumber: row.correctNumber ?? undefined,
      tolerance: row.tolerance ?? undefined,
      acceptedAnswers: (row.acceptedAnswers as string[] | null) ?? undefined,
      explanation: row.explanation ?? undefined,
      subject: row.subject,
      topic: row.topic,
      form: row.form,
      difficulty: row.difficulty as BankQuestion["difficulty"],
      createdById: row.createdById,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  /**
   * Save one question to the library.
   *
   * Validated BEFORE it is written, and refused rather than saved broken. A
   * question with no options, or a correct answer pointing past the end of the
   * list, marks every child wrong — and a bank question is meant to be used
   * many times, so one bad row does that damage over and over, on papers set
   * months apart by teachers who never saw it go in. Better to refuse once.
   */
  async createBankQuestion(question: NewBankQuestion): Promise<BankQuestion> {
    const problems = validateBankQuestion(question);
    if (problems.length > 0) {
      throw new Error(`That question cannot be saved: ${problems.join(" ")}`);
    }

    const [created] = await db.insert(questionBank).values({
      questionText: question.questionText.trim(),
      type: question.type,
      maxScore: question.maxScore,
      options: question.options ?? null,
      correctOption: question.correctOption ?? null,
      correctBool: question.correctBool ?? null,
      correctNumber: question.correctNumber ?? null,
      tolerance: question.tolerance ?? null,
      acceptedAnswers: question.acceptedAnswers ?? null,
      explanation: question.explanation ?? null,
      subject: question.subject,
      topic: question.topic.trim(),
      form: question.form,
      difficulty: question.difficulty,
      createdById: question.createdById,
    }).returning();

    return this.toBankQuestion(created);
  }

  /**
   * Find saved questions by what they are about.
   *
   * The tag filters narrow together — subject AND topic AND class AND
   * difficulty — and are done in the database so the whole library is never
   * pulled into memory. `search` is applied afterwards in code: it is a
   * convenience for a teacher who remembers the wording but not the tags, and
   * doing it here keeps the query the same on SQLite and PostgreSQL, which
   * disagree about case-insensitive matching.
   *
   * Newest first, so a question just saved is at the top where it is looked for.
   */
  async getBankQuestions(filters: BankFilters = {}): Promise<BankQuestion[]> {
    const where = [];
    if (filters.subject) where.push(eq(questionBank.subject, filters.subject));
    if (filters.topic) where.push(eq(questionBank.topic, filters.topic));
    if (filters.form) where.push(eq(questionBank.form, filters.form));
    if (filters.difficulty) where.push(eq(questionBank.difficulty, filters.difficulty));
    if (filters.type) where.push(eq(questionBank.type, filters.type));

    const rows = await (where.length > 0
      ? db.select().from(questionBank).where(and(...where))
      : db.select().from(questionBank));

    let out = rows.map(row => this.toBankQuestion(row));

    if (filters.search && filters.search.trim()) {
      const needle = filters.search.trim().toLowerCase();
      out = out.filter(q => q.questionText.toLowerCase().includes(needle));
    }

    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    return out.slice(0, filters.limit ?? DEFAULT_BANK_LIMIT);
  }

  async getBankQuestion(id: number): Promise<BankQuestion | undefined> {
    const [row] = await db.select().from(questionBank).where(eq(questionBank.id, id));
    return row ? this.toBankQuestion(row) : undefined;
  }

  /**
   * Change a saved question.
   *
   * Only the LIBRARY copy changes. An assignment that already used this
   * question keeps the copy it took, and the children who answered it keep
   * their marks — editing a bank question months later must never quietly
   * re-word a paper somebody has already sat.
   *
   * The MERGED question is validated, not the change on its own. Clearing the
   * options of a multiple-choice question is a perfectly valid-looking patch
   * and leaves behind a question that marks every child wrong, so what matters
   * is whether the row is still markable AFTER the edit.
   *
   * The type may be changed, which can leave the old type's answer key behind
   * on the row (a numeric value on a question that is now true/false). Harmless
   * — markAnswer only reads the fields its own type uses — but the merged
   * question still has to satisfy the new type's rules.
   */
  async updateBankQuestion(id: number, changes: Partial<NewBankQuestion>): Promise<BankQuestion> {
    const existing = await this.getBankQuestion(id);
    if (!existing) throw new Error("That question is not in the bank.");

    const merged: NewBankQuestion = { ...existing, ...changes };
    const problems = validateBankQuestion(merged);
    if (problems.length > 0) {
      throw new Error(`That question cannot be saved: ${problems.join(" ")}`);
    }

    const [updated] = await db.update(questionBank).set({
      questionText: merged.questionText.trim(),
      type: merged.type,
      maxScore: merged.maxScore,
      options: merged.options ?? null,
      correctOption: merged.correctOption ?? null,
      correctBool: merged.correctBool ?? null,
      correctNumber: merged.correctNumber ?? null,
      tolerance: merged.tolerance ?? null,
      acceptedAnswers: merged.acceptedAnswers ?? null,
      explanation: merged.explanation ?? null,
      subject: merged.subject,
      topic: merged.topic.trim(),
      form: merged.form,
      difficulty: merged.difficulty,
      // createdById and createdAt are deliberately NOT touched: who first saved
      // a question, and when, stays true however often it is edited later.
    }).where(eq(questionBank.id, id)).returning();

    return this.toBankQuestion(updated);
  }

  async deleteBankQuestion(id: number): Promise<void> {
    await db.delete(questionBank).where(eq(questionBank.id, id));
  }

  async getGamePlays(studentId: number, day: string, game: string): Promise<GamePlays | undefined> {
    const [row] = await db.select().from(gamePlays).where(
      and(eq(gamePlays.studentId, studentId), eq(gamePlays.day, day), eq(gamePlays.game, game)),
    );
    return row || undefined;
  }

  /**
   * Every play row for a whole class at once.
   *
   * One query rather than one per child per day per game: a class of thirty
   * over a week would otherwise be four hundred round trips for a single page.
   *
   * Days are YYYY-MM-DD strings, which sort the same way they compare, so a
   * plain string range is a real date range here.
   */
  async getGamePlaysForStudents(
    studentIds: number[], dayFrom: string, dayTo: string,
  ): Promise<GamePlays[]> {
    if (studentIds.length === 0) return [];
    return db.select().from(gamePlays).where(
      and(
        inArray(gamePlays.studentId, studentIds),
        gte(gamePlays.day, dayFrom),
        lte(gamePlays.day, dayTo),
      ),
    );
  }

  async upsertGamePlays(row: InsertGamePlays): Promise<GamePlays> {
    const existing = await this.getGamePlays(row.studentId, row.day, row.game);
    if (!existing) {
      const [created] = await db.insert(gamePlays).values(row).returning();
      return created;
    }
    const [updated] = await db.update(gamePlays)
      .set({ ...row, updatedAt: new Date() })
      .where(eq(gamePlays.id, existing.id))
      .returning();
    return updated;
  }

  // Target Blaster's personal best — one row per child.
  async getBlasterBest(studentId: number): Promise<BlasterBest | undefined> {
    const [row] = await db.select().from(blasterBest).where(eq(blasterBest.studentId, studentId));
    return row || undefined;
  }

  async createBlasterBest(row: InsertBlasterBest): Promise<BlasterBest> {
    const [created] = await db.insert(blasterBest).values(row).returning();
    return created;
  }

  async updateBlasterBest(studentId: number, data: Partial<InsertBlasterBest>): Promise<BlasterBest> {
    const [updated] = await db.update(blasterBest)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(blasterBest.studentId, studentId))
      .returning();
    return updated;
  }

  async getExportLogs(teacherEmail: string, limit = 20): Promise<ExportLog[]> {
    return db.select().from(exportLogs)
      .where(eq(exportLogs.teacherEmail, teacherEmail))
      .orderBy(desc(exportLogs.exportedAt))
      .limit(limit);
  }

  // Seed initial data
  async seedInitialData(): Promise<void> {
    // Check if teacher already exists - check both old and new email
    const existingTeacher = await this.getTeacherByEmail("onpointeducationcentremoza@gmail.com");
    const oldTeacher = await this.getTeacherByEmail("onpointeducationcentre@gmail.com");
    
    if (existingTeacher) {
      console.log("Database already seeded with new email");
      return;
    }
    
    // If old email exists, update it to new email
    if (oldTeacher) {
      await db.update(teachers).set({ email: "onpointeducationcentremoza@gmail.com" }).where(eq(teachers.id, oldTeacher.id));
      console.log("Updated teacher email to new address");
      return;
    }

    // Create teacher with new email
    const teacher = await this.createTeacher({
      fullName: "On Point Education Centre",
      email: "onpointeducationcentremoza@gmail.com",
      password: "onpoint123",
    });

    // Example students used to seed a fresh database.
    //
    // These names are INVENTED. Spec S0.2: never ship a real learner's name --
    // it would end up in this repository, in screenshots and in any demo. When
    // the school's real roll is loaded, it goes in through the Students screen
    // or a CSV import at runtime, never into this file.
    const studentsData = [
      { studentId: "F1-001", fullName: "Tendai Moyo", gender: "Male", form: "Form 1" },
      { studentId: "F1-002", fullName: "Rufaro Sibanda", gender: "Female", form: "Form 1" },
      { studentId: "F1-003", fullName: "Nyasha Dube", gender: "Female", form: "Form 1" },
      { studentId: "F1-004", fullName: "Farai Ncube", gender: "Male", form: "Form 1" },
      { studentId: "F2-001", fullName: "Tapiwa Banda", gender: "Female", form: "Form 2" },
      { studentId: "F2-002", fullName: "Chipo Phiri", gender: "Female", form: "Form 2" },
      { studentId: "F2-003", fullName: "Takudzwa Nyoni", gender: "Male", form: "Form 2" },
      { studentId: "F2-004", fullName: "Simba Chirwa", gender: "Male", form: "Form 2" },
    ];

    for (const studentData of studentsData) {
      await this.createStudent(studentData);
    }

    // Create sample assignments
    await this.createAssignment({
      subject: "MATHS",
      form: "Form 1",
      title: "Week 1: Addition and Subtraction",
      instructions: "Complete all questions below. Show your working where possible.",
      questions: [
        { id: "q1", questionText: "What is 5 + 3?", maxScore: 5 },
        { id: "q2", questionText: "What is 10 - 4?", maxScore: 5 },
        { id: "q3", questionText: "Sarah has 7 apples. She gives 2 to her friend. How many apples does Sarah have left?", maxScore: 10 },
      ],
      attachments: [],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalMarks: 20,
      targetStudentIds: [],
      createdById: teacher.id,
    });

    await this.createAssignment({
      subject: "ENGLISH",
      form: "Form 1",
      title: "Reading Comprehension: The Little Red Hen",
      instructions: "Read the story about The Little Red Hen and answer the questions below.",
      questions: [
        { id: "q1", questionText: "Who planted the wheat?", maxScore: 5 },
        { id: "q2", questionText: "Why didn't the other animals want to help?", maxScore: 10 },
        { id: "q3", questionText: "What is the moral of the story?", maxScore: 10 },
      ],
      attachments: [],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalMarks: 25,
      targetStudentIds: [],
      createdById: teacher.id,
    });

    await this.createAssignment({
      subject: "SCIENCE",
      form: "Form 2",
      title: "Plants and Photosynthesis",
      instructions: "Answer the following questions about how plants make their own food.",
      questions: [
        { id: "q1", questionText: "What is photosynthesis?", maxScore: 10 },
        { id: "q2", questionText: "Name three things plants need to make food.", maxScore: 15 },
        { id: "q3", questionText: "Why are leaves green?", maxScore: 10 },
      ],
      attachments: [],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalMarks: 35,
      targetStudentIds: [],
      createdById: teacher.id,
    });

    console.log("Database seeded successfully with teacher and students");
  }
}

export const storage = new DatabaseStorage();
