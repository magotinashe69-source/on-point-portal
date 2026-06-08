import { eq, and, inArray, or, isNull, desc } from "drizzle-orm";
// The database connection AND the table objects come from ./db, which picks
// the right database (SQLite or PostgreSQL) at runtime.
import {
  db,
  teachers, students, assignments, submissions, marks, resources, announcements, lessons, exportLogs,
} from "./db";
// The TypeScript types are the same for both databases, so they come from the shared schema.
import {
  type Teacher, type InsertTeacher,
  type Student, type InsertStudent,
  type Assignment, type InsertAssignment,
  type Submission, type InsertSubmission,
  type Mark, type InsertMark,
  type Resource, type InsertResource,
  type Announcement, type InsertAnnouncement,
  type Lesson, type InsertLesson,
  type ExportLog, type InsertExportLog,
  MASTER_PASSWORD
} from "@shared/schema";

export interface IStorage {
  // Teachers
  getTeacher(id: number): Promise<Teacher | undefined>;
  getTeacherByEmail(email: string): Promise<Teacher | undefined>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  
  // Students
  getStudent(id: number): Promise<Student | undefined>;
  getStudentByStudentId(studentId: string): Promise<Student | undefined>;
  getStudentByName(name: string): Promise<Student | undefined>;
  getAllStudents(): Promise<Student[]>;
  getStudentsByForm(form: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, data: Partial<InsertStudent>): Promise<Student>;
  updateStudentPassword(id: number, password: string): Promise<void>;
  resetStudentPassword(id: number): Promise<void>;
  deleteStudent(id: number): Promise<void>;
  
  // Assignments
  getAssignment(id: number): Promise<Assignment | undefined>;
  getAssignments(form?: string, studentId?: number, archived?: boolean): Promise<Assignment[]>;
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
    await db.delete(students).where(eq(students.id, id));
  }

  // Assignments
  async getAssignment(id: number): Promise<Assignment | undefined> {
    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id));
    return assignment || undefined;
  }

  async getAssignments(form?: string, studentId?: number, archived?: boolean): Promise<Assignment[]> {
    const isArchived = archived === true;
    
    if (form) {
      const conditions = [eq(assignments.form, form), eq(assignments.archived, isArchived)];
      const results = await db.select().from(assignments).where(and(...conditions));
      if (studentId) {
        return results.filter(a => {
          const targets = a.targetStudentIds || [];
          return targets.length === 0 || targets.includes(studentId);
        });
      }
      return results;
    }
    
    return db.select().from(assignments).where(eq(assignments.archived, isArchived));
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

    // Import students from CSV data
    const studentsData = [
      { studentId: "F1-001", fullName: "Nathaniel", gender: "Male", form: "Form 1" },
      { studentId: "F1-002", fullName: "Ruvarashe", gender: "Female", form: "Form 1" },
      { studentId: "F1-003", fullName: "Chiedza Mago", gender: "Female", form: "Form 1" },
      { studentId: "F1-004", fullName: "Anesu Ndlovu", gender: "Male", form: "Form 1" },
      { studentId: "F2-001", fullName: "Blessing Mago", gender: "Female", form: "Form 2" },
      { studentId: "F2-002", fullName: "Trish Dzvambo", gender: "Female", form: "Form 2" },
      { studentId: "F2-003", fullName: "Blessed Chidavaenzi", gender: "Male", form: "Form 2" },
      { studentId: "F2-004", fullName: "Brilliant Malungissa", gender: "Male", form: "Form 2" },
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
