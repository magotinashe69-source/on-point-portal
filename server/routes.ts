import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerObjectStorageRoutes } from "./local_object_storage";
import {
  teacherLoginSchema,
  studentLoginSchema,
  MASTER_PASSWORD
} from "@shared/schema";
import type { Assignment, Submission } from "@shared/schema";
import { isFullyAutoMarked, markSubmission, buildFeedback } from "@shared/auto-marking";
import { z } from "zod";

// Mark an auto-markable submission in code and save the result as a Mark.
// Called right after a student submits (or re-submits) an assignment whose
// questions are all auto-marking types. Does nothing for hand-marked
// assignments and returns null so callers can fall back to the manual flow.
async function autoMarkSubmission(
  assignment: Assignment,
  submission: Submission,
) {
  if (!isFullyAutoMarked(assignment.questions)) return null;

  const { results, totalScore } = markSubmission(assignment.questions, submission.answers);

  const questionMarks = results.map((r) => ({
    questionId: r.questionId,
    score: r.score,
    maxScore: r.maxScore,
    feedback: buildFeedback(r),
  }));

  const correctCount = results.filter((r) => r.correct).length;

  return storage.createMark({
    submissionId: submission.id,
    totalScore,
    feedback: `Auto-marked instantly: ${correctCount} of ${results.length} correct.`,
    markedById: assignment.createdById, // credited to the teacher who set the work
    questionMarks,
  });
}

function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => e.message).join(", ");
      return { success: false, error: messages };
    }
    return { success: false, error: "Validation failed" };
  }
}

// AI Detection Analysis - Simple built-in analysis
function analyzeForAI(text: string): { overallScore: number; flags: string[]; details: string } {
  const flags: string[] = [];
  let score = 0;
  
  // Check for overly formal language patterns
  const formalPatterns = [
    /furthermore/gi,
    /moreover/gi,
    /consequently/gi,
    /in conclusion/gi,
    /it is important to note/gi,
    /in summary/gi,
    /thus/gi,
    /hence/gi,
    /therefore/gi,
    /nevertheless/gi,
  ];
  
  let formalCount = 0;
  formalPatterns.forEach(pattern => {
    if (pattern.test(text)) formalCount++;
  });
  
  if (formalCount >= 3) {
    flags.push("Uses overly formal academic language");
    score += 25;
  }
  
  // Check for perfect punctuation and structure
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((acc, s) => acc + s.split(' ').length, 0) / Math.max(sentences.length, 1);
  
  if (avgSentenceLength > 20 && avgSentenceLength < 25) {
    flags.push("Unusually consistent sentence structure");
    score += 15;
  }
  
  // Check for repetitive patterns (AI tends to repeat structures)
  const lowerText = text.toLowerCase();
  const repeatedPhrases = [
    /firstly.*secondly.*thirdly/gi,
    /on one hand.*on the other hand/gi,
    /in other words/gi,
    /as mentioned earlier/gi,
  ];
  
  repeatedPhrases.forEach(pattern => {
    if (pattern.test(text)) {
      flags.push("Uses structured transitional phrases");
      score += 10;
    }
  });
  
  // Check for lack of personal voice/casual language
  const personalIndicators = [
    /\bi\s+think/gi,
    /\bi\s+believe/gi,
    /\bi\s+feel/gi,
    /in my opinion/gi,
    /personally/gi,
    /maybe/gi,
    /probably/gi,
    /i'm not sure/gi,
    /i guess/gi,
  ];
  
  let personalCount = 0;
  personalIndicators.forEach(pattern => {
    if (pattern.test(text)) personalCount++;
  });
  
  if (personalCount === 0 && text.length > 200) {
    flags.push("Lacks personal voice or opinion markers");
    score += 20;
  }
  
  // Check for advanced vocabulary unusual for student level
  const advancedWords = [
    /paradigm/gi,
    /multifaceted/gi,
    /encompasses/gi,
    /facilitate/gi,
    /implement/gi,
    /subsequently/gi,
    /aforementioned/gi,
    /comprehensive/gi,
    /methodology/gi,
  ];
  
  let advancedCount = 0;
  advancedWords.forEach(pattern => {
    if (pattern.test(text)) advancedCount++;
  });
  
  if (advancedCount >= 2) {
    flags.push("Uses unusually advanced vocabulary");
    score += 20;
  }
  
  // Perfect grammar indicator - no common student errors
  const studentErrors = [
    /\bi\s+am\b/gi, // not an error, but casual
    /gonna/gi,
    /wanna/gi,
    /kinda/gi,
    /sorta/gi,
  ];
  
  // If text is long but has no casual markers, might be AI
  if (text.length > 300 && studentErrors.every(pattern => !pattern.test(text))) {
    // Could be cautious here
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  let details = "";
  if (score < 20) {
    details = "Low likelihood of AI use. Answer appears natural.";
  } else if (score < 40) {
    details = "Some patterns detected but likely student-written.";
  } else if (score < 60) {
    details = "Moderate indicators of possible AI assistance. Review recommended.";
  } else if (score < 80) {
    details = "High likelihood of AI use. Several patterns detected.";
  } else {
    details = "Very high likelihood of AI use. Multiple strong indicators present.";
  }
  
  return { overallScore: score, flags, details };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Seed database on startup
  await storage.seedInitialData();
  
  // Teacher login
  app.post("/api/auth/teacher/login", async (req, res) => {
    try {
      const validation = validateRequest(teacherLoginSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const { email, password } = validation.data;
      const teacher = await storage.getTeacherByEmail(email);
      
      if (!teacher) {
        return res.json({ success: false, message: "Invalid email or password" });
      }
      
      if (teacher.password !== password) {
        return res.json({ success: false, message: "Invalid email or password" });
      }

      // Establish server-side session
      req.session.teacherId = teacher.id;
      
      const { password: _, ...safeTeacher } = teacher;
      res.json({ success: true, teacher: safeTeacher });
    } catch (error) {
      console.error("Teacher login error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Teacher logout — destroys the server-side session
  app.post("/api/auth/teacher/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // Student login (with master password support)
  app.post("/api/auth/student/login", async (req, res) => {
    try {
      const validation = validateRequest(studentLoginSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const { fullName, password } = validation.data;
      
      const student = await storage.getStudentByName(fullName);
      
      if (!student) {
        return res.json({ success: false, message: "Name not found. Only registered students can log in. Please enter your name exactly as registered." });
      }
      
      // Check master password (admin access)
      if (password === MASTER_PASSWORD) {
        res.json({ success: true, student, isMasterAccess: true });
        return;
      }
      
      // Check if student has set a password yet
      if (!student.password) {
        // First time login - set the password
        await storage.updateStudentPassword(student.id, password);
        const updatedStudent = await storage.getStudent(student.id);
        res.json({ success: true, student: updatedStudent, isFirstLogin: true });
        return;
      }
      
      // Validate password
      if (student.password !== password) {
        return res.json({ success: false, message: "Invalid password. Please try again." });
      }
      
      res.json({ success: true, student });
    } catch (error) {
      console.error("Student login error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Get all students
  app.get("/api/students", async (req, res) => {
    try {
      const form = req.query.form as string | undefined;
      if (form) {
        const students = await storage.getStudentsByForm(form);
        res.json(students);
      } else {
        const students = await storage.getAllStudents();
        res.json(students);
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Get single student
  app.get("/api/students/:id", async (req, res) => {
    try {
      const student = await storage.getStudent(parseInt(req.params.id));
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }
      res.json(student);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Create student
  const createStudentSchema = z.object({
    studentId: z.string().min(1),
    fullName: z.string().min(1),
    gender: z.enum(["Male", "Female"]),
    form: z.enum(["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"]),
    role: z.string().optional(),
  });

  app.post("/api/students", async (req, res) => {
    try {
      const validation = validateRequest(createStudentSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      // Check if studentId already exists
      const existing = await storage.getStudentByStudentId(validation.data.studentId);
      if (existing) {
        return res.json({ success: false, message: "Student ID already exists" });
      }
      
      const student = await storage.createStudent({
        ...validation.data,
        role: validation.data.role || "student",
      });
      res.json({ success: true, student });
    } catch (error) {
      console.error("Create student error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Update student
  app.put("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }
      
      const validForms = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];
      const updateData: any = {};
      if (req.body.fullName) updateData.fullName = req.body.fullName;
      if (req.body.gender) updateData.gender = req.body.gender;
      if (req.body.form) {
        if (!validForms.includes(req.body.form)) {
          return res.status(400).json({ success: false, message: "Invalid form value" });
        }
        updateData.form = req.body.form;
      }
      if (req.body.studentId) updateData.studentId = req.body.studentId;
      
      const updated = await storage.updateStudent(id, updateData);
      res.json({ success: true, student: updated });
    } catch (error) {
      console.error("Update student error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Delete student
  app.delete("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }
      
      await storage.deleteStudent(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete student error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Reset student password (teacher can reset)
  app.post("/api/students/:id/reset-password", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }
      
      await storage.resetStudentPassword(id);
      res.json({ success: true, message: "Password reset. Student will set a new password on next login." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Assignments
  app.get("/api/assignments", async (req, res) => {
    try {
      const form = req.query.form as string | undefined;
      const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
      const archived = req.query.archived === "true";
      const validForm = form && form !== 'undefined' ? form : undefined;
      const assignments = await storage.getAssignments(validForm, studentId, archived);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/assignments/:id", async (req, res) => {
    try {
      const assignment = await storage.getAssignment(parseInt(req.params.id));
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // One question, including the optional auto-marking answer key. Zod drops any
  // keys not listed here, so every auto-marking field must be named or it will
  // be silently thrown away when an assignment is saved.
  const questionSchema = z.object({
    id: z.string(),
    questionText: z.string().min(1),
    maxScore: z.number().min(1),
    imageUrls: z.array(z.string()).optional(),
    // Auto-marking fields (all optional; see shared/auto-marking.ts).
    type: z.enum(["written", "multiple_choice", "true_false", "numeric", "short_text"]).optional(),
    options: z.array(z.string()).optional(),
    correctOption: z.number().optional(),
    correctBool: z.boolean().optional(),
    correctNumber: z.number().optional(),
    tolerance: z.number().optional(),
    acceptedAnswers: z.array(z.string()).optional(),
    explanation: z.string().optional(),
  });

  const createAssignmentSchema = z.object({
    subject: z.enum(["MATHS", "ENGLISH", "SCIENCE", "PHYSICS", "CHEMISTRY", "BIOLOGY", "ECONOMICS", "BUSINESS_STUDIES", "GEOGRAPHY", "COMPUTER_SCIENCE", "HISTORY", "ACCOUNTING"]),
    topic: z.string().optional(),
    form: z.enum(["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"]),
    title: z.string().min(1),
    instructions: z.string().min(1),
    questions: z.array(questionSchema).min(1),
    attachments: z.array(z.object({
      name: z.string(),
      url: z.string(),
      type: z.string(),
    })).optional(),
    dueDate: z.string().min(1),
    totalMarks: z.number().min(1),
    targetStudentIds: z.array(z.number()).optional(),
    createdById: z.number(),
  });

  app.post("/api/assignments", async (req, res) => {
    try {
      const validation = validateRequest(createAssignmentSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const teacher = await storage.getTeacher(validation.data.createdById);
      if (!teacher) {
        return res.status(403).json({ success: false, message: "Unauthorized: Invalid teacher ID" });
      }
      
      const assignment = await storage.createAssignment({
        ...validation.data,
        attachments: validation.data.attachments || [],
        targetStudentIds: validation.data.targetStudentIds || [],
      });
      res.json({ success: true, assignment });
    } catch (error) {
      console.error("Create assignment error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Update assignment
  app.put("/api/assignments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      
      const validForms = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];
      const updateData: any = {};
      if (req.body.subject) updateData.subject = req.body.subject;
      if (req.body.topic !== undefined) updateData.topic = req.body.topic;
      if (req.body.form) {
        if (!validForms.includes(req.body.form)) {
          return res.status(400).json({ success: false, message: "Invalid form value" });
        }
        updateData.form = req.body.form;
      }
      if (req.body.title) updateData.title = req.body.title;
      if (req.body.instructions) updateData.instructions = req.body.instructions;
      if (req.body.questions) updateData.questions = req.body.questions;
      if (req.body.attachments) updateData.attachments = req.body.attachments;
      if (req.body.dueDate) updateData.dueDate = req.body.dueDate;
      if (req.body.totalMarks) updateData.totalMarks = req.body.totalMarks;
      if (req.body.targetStudentIds !== undefined) updateData.targetStudentIds = req.body.targetStudentIds;
      
      const updated = await storage.updateAssignment(id, updateData);
      res.json({ success: true, assignment: updated });
    } catch (error) {
      console.error("Update assignment error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Extend deadline for specific student
  app.post("/api/assignments/:id/extend-deadline", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { studentId, newDueDate, reason } = req.body;
      
      if (!studentId || !newDueDate) {
        return res.json({ success: false, message: "Student ID and new due date are required" });
      }
      
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      
      await storage.extendDeadline(id, studentId, newDueDate, reason);
      res.json({ success: true, message: "Deadline extended successfully" });
    } catch (error) {
      console.error("Extend deadline error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.patch("/api/assignments/:id/archive", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      
      const archived = req.body.archived === true;
      const updated = await storage.updateAssignment(id, { archived } as any);
      res.json({ success: true, assignment: updated });
    } catch (error) {
      console.error("Archive assignment error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Delete assignment
  app.delete("/api/assignments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      
      await storage.deleteAssignment(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete assignment error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Submissions
  app.get("/api/submissions", async (req, res) => {
    try {
      const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId as string) : undefined;
      const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
      
      const submissions = await storage.getSubmissions({ assignmentId, studentId });
      
      // Enrich with student, assignment, and mark data
      const enrichedSubmissions = await Promise.all(submissions.map(async (sub) => {
        const student = await storage.getStudent(sub.studentId);
        const assignment = await storage.getAssignment(sub.assignmentId);
        const mark = sub.status === "MARKED" ? await storage.getMark(sub.id) : undefined;
        return {
          ...sub,
          studentName: student?.fullName,
          assignmentTitle: assignment?.title,
          totalMarks: assignment?.totalMarks,
          score: mark?.totalScore ?? null,
        };
      }));
      
      res.json(enrichedSubmissions);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/submissions/:id", async (req, res) => {
    try {
      const submission = await storage.getSubmission(parseInt(req.params.id));
      if (!submission) {
        return res.status(404).json({ success: false, message: "Submission not found" });
      }
      
      const student = await storage.getStudent(submission.studentId);
      const assignment = await storage.getAssignment(submission.assignmentId);
      
      res.json({
        ...submission,
        studentName: student?.fullName,
        assignment,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  const createSubmissionSchema = z.object({
    assignmentId: z.number(),
    studentId: z.number(),
    answers: z.array(z.object({
      questionId: z.string(),
      answerText: z.string(),
      imageUrls: z.array(z.string()).optional(),
    })),
  });

  app.post("/api/submissions", async (req, res) => {
    try {
      const validation = validateRequest(createSubmissionSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const { assignmentId, studentId, answers } = validation.data;
      
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(403).json({ success: false, message: "Unauthorized: Invalid student ID" });
      }
      
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) {
        return res.json({ success: false, message: "Assignment not found" });
      }
      
      if (assignment.form !== student.form) {
        return res.status(403).json({ success: false, message: "Unauthorized: Assignment is not for your form" });
      }
      
      const existingSubmissions = await storage.getSubmissions({ assignmentId, studentId });
      if (existingSubmissions.length > 0) {
        return res.json({ success: false, message: "You have already submitted this assignment" });
      }
      
      const submission = await storage.createSubmission({
        assignmentId,
        studentId,
        answers,
      });

      // If every question is an auto-marking type, mark it instantly in code
      // and save the score. Otherwise fall back to the teacher's AI text check.
      const mark = await autoMarkSubmission(assignment, submission);
      if (!mark) {
        const allText = answers.map(a => a.answerText).join(' ');
        if (allText.length > 50) {
          const analysis = analyzeForAI(allText);
          await storage.updateSubmissionAiAnalysis(submission.id, analysis);
        }
      }

      res.json({ success: true, submission, mark: mark ?? undefined });
    } catch (error) {
      console.error("Create submission error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Update submission (allow students to edit before deadline or before marking)
  app.put("/api/submissions/:id", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.id);
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        return res.status(404).json({ success: false, message: "Submission not found" });
      }

      // Get assignment first — we need it to know whether this is an
      // auto-marked assignment (which students may retry) or a hand-marked one.
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }

      const autoMarked = isFullyAutoMarked(assignment.questions);

      // A hand-marked submission is locked once the teacher has marked it.
      // Auto-marked assignments stay open so students can use "Try Again".
      if (submission.status === "MARKED" && !autoMarked) {
        return res.status(403).json({ success: false, message: "Cannot edit a marked submission" });
      }

      // Validate answers
      const { answers } = req.body;
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ success: false, message: "Answers are required" });
      }

      // Update the submission
      const updatedSubmission = await storage.updateSubmission(submissionId, { answers });

      // Re-mark instantly for auto-marked assignments; otherwise re-run the AI
      // text check for the teacher.
      let mark = null;
      if (updatedSubmission) {
        mark = await autoMarkSubmission(assignment, updatedSubmission);
      }
      if (!mark) {
        const allText = answers.map((a: { answerText: string }) => a.answerText).join(' ');
        if (allText.length > 50) {
          const analysis = analyzeForAI(allText);
          await storage.updateSubmissionAiAnalysis(submissionId, analysis);
        }
      }

      res.json({ success: true, submission: updatedSubmission, mark: mark ?? undefined });
    } catch (error) {
      console.error("Update submission error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Marks
  app.get("/api/marks/:submissionId", async (req, res) => {
    try {
      const mark = await storage.getMark(parseInt(req.params.submissionId));
      if (!mark) {
        return res.status(404).json({ success: false, message: "Mark not found" });
      }
      res.json(mark);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  const createMarkSchema = z.object({
    submissionId: z.number(),
    totalScore: z.number().min(0),
    feedback: z.string().optional(),
    markedById: z.number(),
    questionMarks: z.array(z.object({
      questionId: z.string(),
      score: z.number().min(0),
      maxScore: z.number().min(1),
      feedback: z.string().optional(),
    })),
  });

  app.post("/api/marks", async (req, res) => {
    try {
      const validation = validateRequest(createMarkSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const { submissionId, totalScore, feedback, markedById, questionMarks } = validation.data;
      
      const teacher = await storage.getTeacher(markedById);
      if (!teacher) {
        return res.status(403).json({ success: false, message: "Unauthorized: Only teachers can mark submissions" });
      }
      
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.json({ success: false, message: "Submission not found" });
      }
      
      for (const qm of questionMarks) {
        if (qm.score > qm.maxScore) {
          return res.json({ success: false, message: `Score cannot exceed max score for question` });
        }
      }
      
      const mark = await storage.createMark({
        submissionId,
        totalScore,
        feedback,
        markedById,
        questionMarks,
      });
      
      res.json({ success: true, mark });
    } catch (error) {
      console.error("Create mark error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Student stats endpoint
  app.get("/api/students/:id/stats", async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const submissions = await storage.getSubmissions({ studentId });
      const marks = await Promise.all(
        submissions.map(s => storage.getMark(s.id))
      );

      const markedSubmissions = submissions.filter(s => s.status === "MARKED");
      const validMarks = marks.filter(m => m !== null);
      
      let totalScore = 0;
      let totalMaxScore = 0;
      
      for (const mark of validMarks) {
        if (mark) {
          totalScore += mark.totalScore;
          const submission = submissions.find(s => s.id === mark.submissionId);
          if (submission) {
            const assignment = await storage.getAssignment(submission.assignmentId);
            if (assignment) {
              totalMaxScore += assignment.totalMarks;
            }
          }
        }
      }

      const averageScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

      res.json({
        success: true,
        stats: {
          completed: markedSubmissions.length,
          pending: submissions.filter(s => s.status === "SUBMITTED").length,
          averageScore,
          totalSubmissions: submissions.length,
        }
      });
    } catch (error) {
      console.error("Get student stats error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Resources (textbooks, YouTube links, lesson plans)
  app.get("/api/resources", async (req, res) => {
    try {
      const form = req.query.form as string | undefined;
      const subject = req.query.subject as string | undefined;
      const type = req.query.type as string | undefined;
      const teacherOnly = req.query.teacherOnly === 'true';
      
      const resources = await storage.getResources({ 
        form: form !== 'undefined' ? form : undefined, 
        subject: subject !== 'undefined' ? subject : undefined, 
        type: type !== 'undefined' ? type : undefined,
        teacherOnly: teacherOnly ? undefined : false, // If not teacher, filter out teacher-only
      });
      res.json(resources);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/resources/:id", async (req, res) => {
    try {
      const resource = await storage.getResource(parseInt(req.params.id));
      if (!resource) {
        return res.status(404).json({ success: false, message: "Resource not found" });
      }
      res.json(resource);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  const createResourceSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["TEXTBOOK", "YOUTUBE", "LESSON_PLAN", "OTHER"]),
    url: z.string().optional(),
    fileUrl: z.string().optional(),
    subject: z.string().optional().transform(v => (v === "" ? undefined : v)),
    form: z.enum(["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"]).or(z.literal("")).optional().transform(v => (v === "" ? undefined : v)),
    isTeacherOnly: z.boolean().optional(),
    createdById: z.number(),
  });

  app.post("/api/resources", async (req, res) => {
    try {
      const validation = validateRequest(createResourceSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const teacher = await storage.getTeacher(validation.data.createdById);
      if (!teacher) {
        return res.status(403).json({ success: false, message: "Unauthorized: Only teachers can add resources" });
      }
      
      const resource = await storage.createResource(validation.data);
      res.json({ success: true, resource });
    } catch (error) {
      console.error("Create resource error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    try {
      await storage.deleteResource(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Announcements
  app.get("/api/announcements", async (req, res) => {
    try {
      const form = req.query.form as string | undefined;
      const announcements = await storage.getAnnouncements(form !== 'undefined' ? form : undefined);
      res.json(announcements);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  const createAnnouncementSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    form: z.enum(["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"]).optional().nullable(),
    priority: z.enum(["normal", "important", "urgent"]).optional(),
    expiresAt: z.string().optional().nullable(),
    createdById: z.number(),
  });

  app.post("/api/announcements", async (req, res) => {
    try {
      const validation = validateRequest(createAnnouncementSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const teacher = await storage.getTeacher(validation.data.createdById);
      if (!teacher) {
        return res.status(403).json({ success: false, message: "Unauthorized: Only teachers can post announcements" });
      }
      
      const announcement = await storage.createAnnouncement({
        ...validation.data,
        expiresAt: validation.data.expiresAt ? new Date(validation.data.expiresAt) : null,
      });
      res.json({ success: true, announcement });
    } catch (error) {
      console.error("Create announcement error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/api/announcements/:id", async (req, res) => {
    try {
      await storage.deleteAnnouncement(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Lessons (video and audio)
  app.get("/api/lessons", async (req, res) => {
    try {
      const form = req.query.form as string | undefined;
      const subject = req.query.subject as string | undefined;
      const type = req.query.type as string | undefined;
      
      const lessons = await storage.getLessons({ 
        form: form !== 'undefined' ? form : undefined,
        subject: subject !== 'undefined' ? subject : undefined,
        type: type !== 'undefined' ? type : undefined,
      });
      res.json(lessons);
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  const createLessonSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    subject: z.string().min(1),
    form: z.enum(["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"]),
    type: z.enum(["VIDEO", "AUDIO"]),
    fileUrl: z.string().min(1),
    duration: z.string().optional(),
    createdById: z.number(),
  });

  app.post("/api/lessons", async (req, res) => {
    try {
      const validation = validateRequest(createLessonSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const teacher = await storage.getTeacher(validation.data.createdById);
      if (!teacher) {
        return res.status(403).json({ success: false, message: "Unauthorized: Only teachers can add lessons" });
      }
      
      const lesson = await storage.createLesson(validation.data);
      res.json({ success: true, lesson });
    } catch (error) {
      console.error("Create lesson error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/api/lessons/:id", async (req, res) => {
    try {
      const lesson = await storage.getLesson(parseInt(req.params.id));
      if (!lesson) {
        return res.status(404).json({ success: false, message: "Lesson not found" });
      }
      const teacher = await storage.getTeacher(lesson.createdById);
      if (!teacher) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
      }
      await storage.deleteLesson(lesson.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Reports API - Get performance data for charts
  app.get("/api/reports", async (req, res) => {
    try {
      const students = await storage.getAllStudents();
      const assignments = await storage.getAssignments();
      const allSubmissions = await storage.getSubmissions();
      
      // Calculate student performance data
      const studentPerformance: Array<{
        studentId: number;
        studentName: string;
        form: string;
        totalAssignments: number;
        submittedCount: number;
        markedCount: number;
        totalScore: number;
        maxPossibleScore: number;
        averagePercentage: number;
      }> = [];

      for (const student of students) {
        const studentAssignments = assignments.filter(a => 
          a.form === student.form && 
          (a.targetStudentIds?.length === 0 || a.targetStudentIds?.includes(student.id))
        );
        
        let totalScore = 0;
        let maxPossibleScore = 0;
        let markedCount = 0;
        let submittedCount = 0;

        for (const assignment of studentAssignments) {
          const submission = allSubmissions.find(s => s.studentId === student.id && s.assignmentId === assignment.id);
          if (submission) {
            submittedCount++;
            if (submission.status === "MARKED") {
              markedCount++;
              const mark = await storage.getMark(submission.id);
              if (mark) {
                totalScore += mark.totalScore;
                maxPossibleScore += assignment.totalMarks;
              }
            }
          }
        }

        studentPerformance.push({
          studentId: student.id,
          studentName: student.fullName,
          form: student.form,
          totalAssignments: studentAssignments.length,
          submittedCount,
          markedCount,
          totalScore,
          maxPossibleScore,
          averagePercentage: maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0
        });
      }

      // Subject performance data
      const subjectPerformance: Array<{
        subject: string;
        averageScore: number;
        totalSubmissions: number;
        totalMarked: number;
      }> = [];

      const subjects = Array.from(new Set(assignments.map(a => a.subject)));
      for (const subject of subjects) {
        const subjectAssignments = assignments.filter(a => a.subject === subject);
        let totalScore = 0;
        let maxScore = 0;
        let totalSubmissions = 0;
        let totalMarked = 0;

        for (const assignment of subjectAssignments) {
          const subs = allSubmissions.filter(s => s.assignmentId === assignment.id);
          totalSubmissions += subs.length;
          
          for (const sub of subs) {
            if (sub.status === "MARKED") {
              totalMarked++;
              const mark = await storage.getMark(sub.id);
              if (mark) {
                totalScore += mark.totalScore;
                maxScore += assignment.totalMarks;
              }
            }
          }
        }

        subjectPerformance.push({
          subject,
          averageScore: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
          totalSubmissions,
          totalMarked
        });
      }

      // Form performance comparison
      const formPerformance: Array<{
        form: string;
        averageScore: number;
        studentCount: number;
      }> = [];

      const forms = Array.from(new Set(students.map(s => s.form)));
      for (const form of forms) {
        const formStudents = studentPerformance.filter(s => s.form === form);
        const avgScore = formStudents.length > 0 
          ? Math.round(formStudents.reduce((sum, s) => sum + s.averagePercentage, 0) / formStudents.length)
          : 0;
        
        formPerformance.push({
          form,
          averageScore: avgScore,
          studentCount: formStudents.length
        });
      }

      res.json({
        success: true,
        data: {
          studentPerformance,
          subjectPerformance,
          formPerformance
        }
      });
    } catch (error) {
      console.error("Reports API error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Daily Homework Submission Report
  app.get("/api/reports/daily", async (req, res) => {
    try {
      const { form, subject, date, dateFrom: qDateFrom, dateTo: qDateTo } = req.query as {
        form?: string;
        subject?: string;
        date?: string;       // single-day shorthand
        dateFrom?: string;   // range start (used for This Week)
        dateTo?: string;     // range end
      };

      // Accept either `date` (single day) or `dateFrom`+`dateTo` (range)
      const dateFrom = date || qDateFrom;
      const dateTo = date || qDateTo;

      if (!form || !dateFrom || !dateTo) {
        return res.status(400).json({ success: false, message: "form and date (or dateFrom+dateTo) are required" });
      }

      // Get all students in this form
      const formStudents = await storage.getStudentsByForm(form);

      // Fetch ALL assignments for this form (active + archived) so historical date
      // reports remain accurate even after individual assignments are archived
      const [activeAssignmentsForForm, archivedAssignmentsForForm] = await Promise.all([
        storage.getAssignments(form, undefined, false),
        storage.getAssignments(form, undefined, true),
      ]);
      const allFormAssignments = [...activeAssignmentsForForm, ...archivedAssignmentsForForm];

      // Apply subject filter on top of the full set
      let formAssignments = allFormAssignments;
      if (subject && subject !== "all") {
        formAssignments = formAssignments.filter(a => a.subject === subject);
      }

      // Get all submissions
      const allSubmissions = await storage.getSubmissions();

      // Filter submissions that fall within the date range across all matching assignments
      const submissionsInRange = allSubmissions.filter(sub => {
        if (!formAssignments.some(a => a.id === sub.assignmentId)) return false;
        const submittedDate = new Date(sub.submittedAt).toISOString().split("T")[0];
        return submittedDate >= dateFrom && submittedDate <= dateTo;
      });

      const submittedStudentIds = new Set(submissionsInRange.map(s => s.studentId));

      // Eligible students = students assigned at least one matching assignment
      const eligibleStudents = formStudents.filter(student =>
        formAssignments.some(a => {
          const targets = (a.targetStudentIds as number[] | null) || [];
          return targets.length === 0 || targets.includes(student.id);
        })
      );

      // submitted/notSubmitted only include { fullName }
      const submitted = eligibleStudents
        .filter(s => submittedStudentIds.has(s.id))
        .map(s => ({ fullName: s.fullName }));

      const notSubmitted = eligibleStudents
        .filter(s => !submittedStudentIds.has(s.id))
        .map(s => ({ fullName: s.fullName }));

      // Low attendance uses the same full set (active + archived) for all-time accuracy

      // lowAttendance includes { fullName, completionRate } so the report can display "XX% completion"
      const lowAttendance = formStudents
        .map(student => {
          const studentAssignments = allFormAssignments.filter(a => {
            const targets = (a.targetStudentIds as number[] | null) || [];
            return targets.length === 0 || targets.includes(student.id);
          });
          const studentSubmissions = allSubmissions.filter(s =>
            s.studentId === student.id && studentAssignments.some(a => a.id === s.assignmentId)
          );
          const rate = studentAssignments.length > 0
            ? Math.round((studentSubmissions.length / studentAssignments.length) * 100)
            : 100;
          return { fullName: student.fullName, completionRate: rate };
        })
        .filter(s => s.completionRate < 60)
        .sort((a, b) => a.completionRate - b.completionRate);

      res.json({
        success: true,
        data: { submitted, notSubmitted, lowAttendance }
      });
    } catch (error) {
      console.error("Daily report error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Grade Book API - joins assignments, students, submissions, marks
  app.get("/api/gradebook", async (req, res) => {
    try {
      const formFilter = req.query.form as string | undefined;
      const assignmentIdFilter = req.query.assignmentId ? parseInt(req.query.assignmentId as string) : undefined;
      const statusFilter = req.query.status as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      // Get all active (non-archived) assignments
      let assignmentList = await storage.getAssignments(formFilter, undefined, false);
      if (assignmentIdFilter) {
        assignmentList = assignmentList.filter(a => a.id === assignmentIdFilter);
      }

      // Get all students
      const allStudents = await storage.getAllStudents();

      // Get all submissions
      const allSubmissions = await storage.getSubmissions();

      // Get all marks (keyed by submissionId)
      const markMap = new Map<number, Awaited<ReturnType<typeof storage.getMark>>>();
      for (const sub of allSubmissions) {
        const mark = await storage.getMark(sub.id);
        if (mark) markMap.set(sub.id, mark);
      }

      const rows: Array<{
        studentId: number;
        studentName: string;
        form: string;
        assignmentId: number;
        assignmentTitle: string;
        subject: string;
        totalMarks: number;
        submittedAt: string | null;
        score: number | null;
        status: string;
      }> = [];

      for (const assignment of assignmentList) {
        // Determine eligible students
        const targetIds = assignment.targetStudentIds as number[] | null;
        const eligibleStudents = targetIds && targetIds.length > 0
          ? allStudents.filter(s => targetIds.includes(s.id) && (!formFilter || s.form === formFilter))
          : allStudents.filter(s => s.form === assignment.form && (!formFilter || s.form === formFilter));

        for (const student of eligibleStudents) {
          const submission = allSubmissions.find(s => s.studentId === student.id && s.assignmentId === assignment.id);
          const mark = submission ? markMap.get(submission.id) : null;

          let status = "NOT_SUBMITTED";
          if (submission) {
            status = submission.status === "MARKED" ? "MARKED" : "SUBMITTED";
          }

          // Date filter on submittedAt — exclude unsubmitted rows when date filter is active
          if (dateFrom || dateTo) {
            if (!submission || !submission.submittedAt) continue;
            if (dateFrom && new Date(submission.submittedAt) < new Date(dateFrom)) continue;
            if (dateTo && new Date(submission.submittedAt) > new Date(dateTo + "T23:59:59")) continue;
          }

          // Status filter — supports ALL, SUBMITTED, MARKED, NOT_SUBMITTED
          if (statusFilter && statusFilter !== "ALL") {
            if (statusFilter === "SUBMITTED" && status !== "SUBMITTED") continue;
            if (statusFilter === "MARKED" && status !== "MARKED") continue;
            if (statusFilter === "NOT_SUBMITTED" && status !== "NOT_SUBMITTED") continue;
          }

          rows.push({
            studentId: student.id,
            studentName: student.fullName,
            form: student.form,
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            subject: assignment.subject,
            totalMarks: assignment.totalMarks,
            submittedAt: submission?.submittedAt ? new Date(submission.submittedAt).toISOString() : null,
            score: mark ? mark.totalScore : null,
            status,
          });
        }
      }

      res.json({ success: true, rows });
    } catch (error) {
      console.error("Gradebook API error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Export grades as CSV
  app.get("/api/export/grades", async (req, res) => {
    try {
      const form = req.query.form as string | undefined;
      const subject = req.query.subject as string | undefined;
      
      const assignmentIdParam = req.query.assignmentId ? parseInt(req.query.assignmentId as string) : undefined;
      const statusParam = req.query.status as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      // Get all students
      let studentList = await storage.getAllStudents();
      if (form) {
        studentList = studentList.filter(s => s.form === form);
      }
      
      // Get all assignments
      let assignmentList = await storage.getAssignments(form);
      if (subject) {
        assignmentList = assignmentList.filter(a => a.subject === subject);
      }
      if (assignmentIdParam) {
        assignmentList = assignmentList.filter(a => a.id === assignmentIdParam);
      }
      
      // Get all submissions and marks
      const allSubmissions = await storage.getSubmissions();
      
      // Build CSV data
      const rows: string[] = [];
      const headers = ['Student ID', 'Student Name', 'Form', 'Assignment', 'Subject', 'Topic', 'Score', 'Max Score', 'Percentage', 'Submitted At', 'Status'];
      rows.push(headers.join(','));
      
      for (const student of studentList) {
        for (const assignment of assignmentList) {
          const targetIds = assignment.targetStudentIds as number[] | null;
          if (targetIds && targetIds.length > 0 && !targetIds.includes(student.id)) continue;
          
          const submission = allSubmissions.find(s => s.studentId === student.id && s.assignmentId === assignment.id);
          const mark = submission ? await storage.getMark(submission.id) : null;
          
          // Date filter — exclude unsubmitted rows when date filter is active
          if (dateFrom || dateTo) {
            if (!submission || !submission.submittedAt) continue;
            if (dateFrom && new Date(submission.submittedAt) < new Date(dateFrom)) continue;
            if (dateTo && new Date(submission.submittedAt) > new Date(dateTo + "T23:59:59")) continue;
          }
          
          // Status filter — supports ALL, SUBMITTED, MARKED, NOT_SUBMITTED
          const rawStatus = !submission ? 'NOT_SUBMITTED' : submission.status === 'MARKED' ? 'MARKED' : 'SUBMITTED';
          if (statusParam && statusParam !== 'ALL') {
            if (statusParam === 'SUBMITTED' && rawStatus !== 'SUBMITTED') continue;
            if (statusParam === 'MARKED' && rawStatus !== 'MARKED') continue;
            if (statusParam === 'NOT_SUBMITTED' && rawStatus !== 'NOT_SUBMITTED') continue;
          }
          
          const score = mark ? mark.totalScore : 0;
          const maxScore = assignment.totalMarks;
          const percentage = maxScore > 0 ? ((score / maxScore) * 100).toFixed(1) : '0.0';
          const displayStatus = rawStatus === 'NOT_SUBMITTED' ? 'Not Submitted' : rawStatus === 'MARKED' ? 'Marked' : 'Submitted';
          const submittedAt = submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString('en-GB') : '';
          
          rows.push([
            `"${student.studentId}"`,
            `"${student.fullName}"`,
            `"${student.form}"`,
            `"${assignment.title}"`,
            `"${assignment.subject}"`,
            `"${assignment.topic || ''}"`,
            score.toString(),
            maxScore.toString(),
            percentage + '%',
            `"${submittedAt}"`,
            displayStatus
          ].join(','));
        }
      }
      
      const csvContent = rows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=grades-export.csv');
      res.send(csvContent);
    } catch (error) {
      console.error("Export grades error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Data Science export — full student × assignment matrix with 25 columns
  app.get("/api/export/homework-datasci", async (req, res) => {
    try {
      const csvEscape = (val: string | number) => {
        const s = String(val).replace(/"/g, '""');
        return `"${s}"`;
      };

      const wordCount = (text: string): number =>
        text && text.trim() ? text.trim().split(/\s+/).length : 0;

      // Fetch all base data in parallel
      const [studentList, activeAssignments, archivedAssignments, allSubmissions] = await Promise.all([
        storage.getAllStudents(),
        storage.getAssignments(undefined, undefined, false),
        storage.getAssignments(undefined, undefined, true),
        storage.getSubmissions(),
      ]);

      // Pre-fetch all marks in parallel — eliminates N+1 per row
      const allMarks = await Promise.all(allSubmissions.map(s => storage.getMark(s.id)));
      const markBySubmissionId = new Map<number, typeof allMarks[0]>();
      allSubmissions.forEach((s, i) => { if (allMarks[i]) markBySubmissionId.set(s.id, allMarks[i]); });

      // O(1) submission lookup by studentId+assignmentId key
      const submissionKey = (studentId: number, assignmentId: number) => `${studentId}:${assignmentId}`;
      const submissionMap = new Map<string, typeof allSubmissions[0]>();
      for (const sub of allSubmissions) {
        submissionMap.set(submissionKey(sub.studentId, sub.assignmentId), sub);
      }

      const allAssignments = [...activeAssignments, ...archivedAssignments];

      const headers = [
        'student_id', 'student_name', 'form', 'gender',
        'assignment_id', 'assignment_title', 'subject', 'topic',
        'due_date', 'assigned_to_all', 'assignment_archived',
        'status', 'submitted', 'submitted_at',
        'num_questions', 'questions_answered', 'total_answer_words',
        'score', 'max_score', 'score_pct',
        'teacher_feedback',
      ];

      const today = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=homework-datasci-${today}.csv`);

      // Stream rows as they are computed
      res.write(headers.join(',') + '\n');

      for (const student of studentList) {
        for (const assignment of allAssignments) {
          const targetIds = (assignment.targetStudentIds || []) as number[];
          if (targetIds.length > 0 && !targetIds.includes(student.id)) continue;
          if (student.form !== assignment.form) continue;

          const submission = submissionMap.get(submissionKey(student.id, assignment.id));
          const mark = submission ? markBySubmissionId.get(submission.id) ?? null : null;

          const status = !submission ? 'NOT_SUBMITTED'
            : submission.status === 'MARKED' ? 'MARKED'
            : 'SUBMITTED';
          const submitted = submission ? 1 : 0;
          const submittedAt = submission?.submittedAt
            ? new Date(submission.submittedAt).toISOString()
            : '';
          const questions = (assignment.questions || []) as Array<{ id: string; questionText: string; maxScore: number }>;
          const answers = (submission?.answers || []) as Array<{ questionId: string; answerText: string }>;
          const questionsAnswered = answers.filter(a => a.answerText && a.answerText.trim()).length;
          const totalAnswerWords = answers.reduce((sum, a) => sum + wordCount(a.answerText || ''), 0);

          const maxScore = assignment.totalMarks;
          const rawScore = mark !== null && mark !== undefined ? mark.totalScore : '';
          const scorePct = mark && maxScore > 0
            ? ((mark.totalScore / maxScore) * 100).toFixed(2)
            : '';
          const feedback = mark ? (mark.feedback || '') : '';

          res.write([
            csvEscape(student.studentId),
            csvEscape(student.fullName),
            csvEscape(student.form),
            csvEscape(student.gender),
            assignment.id,
            csvEscape(assignment.title),
            csvEscape(assignment.subject),
            csvEscape(assignment.topic || ''),
            csvEscape(assignment.dueDate),
            targetIds.length === 0 ? 1 : 0,
            assignment.archived ? 1 : 0,
            csvEscape(status),
            submitted,
            csvEscape(submittedAt),
            questions.length,
            questionsAnswered,
            totalAnswerWords,
            rawScore,
            maxScore,
            scorePct,
            csvEscape(feedback),
          ].join(',') + '\n');
        }
      }

      res.end();
    } catch (error) {
      console.error("Data science export error:", error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Server error" });
      }
    }
  });

  // ─── Comprehensive Export — Preview, Master CSV, and Logs ────────────────────

  // Auth guard: validates teacher via server-side session (teacherId set at login)
  async function requireTeacherAuth(req: Request, res: Response): Promise<string | null> {
    const teacherId = req.session?.teacherId;
    if (!teacherId) {
      res.status(401).json({ success: false, message: "Unauthorized. Teacher login required.", redirect: "/teacher/login" });
      return null;
    }
    const teacher = await storage.getTeacher(teacherId);
    if (!teacher) {
      res.status(401).json({ success: false, message: "Unauthorized. Session invalid.", redirect: "/teacher/login" });
      return null;
    }
    return teacher.email; // return verified email for audit log
  }

  // Helpers shared by preview and master export
  function getDueDateTerm(dueDate: string): number {
    const m = new Date(dueDate + "T00:00:00").getMonth() + 1;
    if (m <= 3) return 1;
    if (m <= 6) return 2;
    if (m <= 9) return 3;
    return 4;
  }

  function getGradeSymbol(pct: number): string {
    if (pct >= 80) return "A";
    if (pct >= 65) return "B";
    if (pct >= 50) return "C";
    if (pct >= 35) return "D";
    if (pct >= 20) return "E";
    return "F";
  }

  function getPerformanceBand(pct: number): string {
    if (pct >= 80) return "Outstanding";
    if (pct >= 65) return "Good";
    if (pct >= 50) return "Satisfactory";
    return "Needs Support";
  }

  function csvQ(val: string): string {
    return `"${String(val).replace(/"/g, '""')}"`;
  }

  async function buildExportData(query: Record<string, string | undefined>) {
    const { type = "full", term, form, subject, assignmentId: assignmentIdRaw } = query;
    const assignmentId = assignmentIdRaw ? parseInt(assignmentIdRaw) : undefined;

    const [studentList, activeAssignments, archivedAssignments, allSubmissions] = await Promise.all([
      storage.getAllStudents(),
      storage.getAssignments(undefined, undefined, false),
      storage.getAssignments(undefined, undefined, true),
      storage.getSubmissions(),
    ]);

    const allAssignments = [...activeAssignments, ...archivedAssignments];

    // Pre-index marks — eliminates N+1 queries
    const allMarks = await Promise.all(allSubmissions.map(s => storage.getMark(s.id)));
    const markBySubId = new Map<number, (typeof allMarks)[0]>();
    allSubmissions.forEach((s, i) => { if (allMarks[i]) markBySubId.set(s.id, allMarks[i]); });

    const subKey = (sid: number, aid: number) => `${sid}:${aid}`;
    const submissionMap = new Map<string, (typeof allSubmissions)[0]>();
    for (const sub of allSubmissions) submissionMap.set(subKey(sub.studentId, sub.assignmentId), sub);

    // Apply filters
    let filteredAssignments = allAssignments;
    if (type === "term" && term) {
      filteredAssignments = filteredAssignments.filter(a => getDueDateTerm(a.dueDate) === parseInt(term));
    }
    if ((type === "class" || type === "term") && form) {
      filteredAssignments = filteredAssignments.filter(a => a.form === form);
    }
    if (type === "class" && subject) {
      filteredAssignments = filteredAssignments.filter(a => a.subject === subject);
    }
    if (type === "assignment" && assignmentId) {
      filteredAssignments = filteredAssignments.filter(a => a.id === assignmentId);
    }

    // Build sorted rows: form → subject → student surname → dueDate
    type RowTuple = {
      student: (typeof studentList)[0];
      assignment: (typeof allAssignments)[0];
      submission: (typeof allSubmissions)[0] | undefined;
      mark: (typeof allMarks)[0] | undefined;
    };

    const rows: RowTuple[] = [];
    for (const assignment of filteredAssignments) {
      const targetIds = (assignment.targetStudentIds || []) as number[];
      for (const student of studentList) {
        if (targetIds.length > 0 && !targetIds.includes(student.id)) continue;
        if (student.form !== assignment.form) continue;
        const submission = submissionMap.get(subKey(student.id, assignment.id));
        const mark = submission ? markBySubId.get(submission.id) : undefined;
        rows.push({ student, assignment, submission, mark });
      }
    }

    // Sort: form → subject → student surname → dueDate asc
    rows.sort((a, b) => {
      const formCmp = a.student.form.localeCompare(b.student.form);
      if (formCmp !== 0) return formCmp;
      const subCmp = a.assignment.subject.localeCompare(b.assignment.subject);
      if (subCmp !== 0) return subCmp;
      const nameParts = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? p.slice(1).join(" ") : p[0]; };
      const surnCmp = nameParts(a.student.fullName).localeCompare(nameParts(b.student.fullName));
      if (surnCmp !== 0) return surnCmp;
      return a.assignment.dueDate.localeCompare(b.assignment.dueDate);
    });

    return rows;
  }

  // GET /api/export/preview — counts only (no CSV)
  app.get("/api/export/preview", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;

      const query: Record<string, string | undefined> = {
        type: req.query.type as string | undefined,
        term: req.query.term as string | undefined,
        form: req.query.form as string | undefined,
        subject: req.query.subject as string | undefined,
        assignmentId: req.query.assignmentId as string | undefined,
      };

      const rows = await buildExportData(query);

      const studentSet = new Set(rows.map(r => r.student.id));
      const assignmentSet = new Set(rows.map(r => r.assignment.id));
      let submitted = 0, late = 0, notSubmitted = 0;

      for (const r of rows) {
        if (!r.submission) { notSubmitted++; continue; }
        submitted++;
      }

      const dueDates = rows.map(r => r.assignment.dueDate).filter(Boolean);
      const dateRange = dueDates.length > 0
        ? { from: dueDates.reduce((a, b) => a < b ? a : b), to: dueDates.reduce((a, b) => a > b ? a : b) }
        : null;

      res.json({
        totalStudents: studentSet.size,
        totalAssignments: assignmentSet.size,
        totalRows: rows.length,
        submitted,
        late,
        notSubmitted,
        dateRange,
      });
    } catch (error) {
      console.error("Export preview error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // GET /api/export/master — full streaming CSV
  app.get("/api/export/master", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;

      const query: Record<string, string | undefined> = {
        type: req.query.type as string | undefined,
        term: req.query.term as string | undefined,
        form: req.query.form as string | undefined,
        subject: req.query.subject as string | undefined,
        assignmentId: req.query.assignmentId as string | undefined,
      };
      const teacherEmail = validatedEmail;

      const rows = await buildExportData(query);

      // Derive filename from filter type
      const today = new Date().toISOString().split("T")[0];
      let filenamePart = "Master";
      if (query.type === "term" && query.term) filenamePart = `Term${query.term}_${new Date().getFullYear()}`;
      else if (query.type === "class") filenamePart = [query.form, query.subject].filter(Boolean).join("_").replace(/\s+/g, "") || "Class";
      else if (query.type === "assignment" && query.assignmentId) filenamePart = `Assignment${query.assignmentId}`;

      const filename = `HomeworkData_${filenamePart}_${today}.csv`;

      const HEADERS = [
        // Group 1 — School & Period
        "school_name", "academic_year", "term", "week_number",
        // Group 2 — Class & Teacher
        "grade_level", "class_name", "teacher_first_name", "teacher_surname", "teacher_full_name", "subject_name",
        // Group 3 — Student
        "student_id", "student_first_name", "student_surname", "student_full_name", "student_gender", "student_date_of_birth",
        // Group 4 — Assignment
        "assignment_id", "assignment_title", "assignment_type", "assignment_number",
        "date_assigned", "date_due", "total_marks_possible", "assignment_instructions_attached", "attachment_count",
        // Group 5 — Submission Status
        "submission_status", "date_submitted", "time_submitted", "submitted_on_time",
        "days_late", "attachment_submitted", "number_of_files_submitted",
        // Group 6 — Marks
        "mark_achieved", "total_marks_possible_2", "percentage", "grade_symbol", "performance_band", "marked_status",
        // Group 7 — Teacher Record
        "marked_by_teacher", "date_mark_recorded", "teacher_comments", "date_record_last_updated",
      ];

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.write(HEADERS.join(",") + "\n");

      let recordCount = 0;
      for (const { student, assignment, submission, mark } of rows) {
        recordCount++;

        // Group 1
        const dueYear = new Date(assignment.dueDate + "T00:00:00").getFullYear();
        const term = getDueDateTerm(assignment.dueDate);
        const academicYear = `${dueYear}/${dueYear + 1}`;

        // Group 3 — student name parts
        const nameParts = student.fullName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const surname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        // Group 4 — assignment meta
        const attachments = (assignment.attachments || []) as unknown[];
        const instructionsAttached = assignment.instructions && assignment.instructions.trim().length > 10 ? "Yes" : "No";
        const dateAssigned = new Date(assignment.createdAt).toISOString().split("T")[0];

        // Group 5 — submission
        let submissionStatus: string;
        let dateSubmitted = "";
        let timeSubmitted = "";
        let submittedOnTime = "Not Submitted";
        let daysLate: number | "" = "";
        let attachmentSubmitted = "Not Submitted";
        let numFilesSubmitted: number | "" = "";

        if (submission) {
          const subDt = new Date(submission.submittedAt);
          dateSubmitted = subDt.toISOString().split("T")[0];
          timeSubmitted = subDt.toISOString().split("T")[1].substring(0, 5);
          daysLate = 0;
          const answerFiles = (submission.answers || []).flatMap(
            (a: { questionId: string; answerText: string; imageUrls?: string[] }) => a.imageUrls ?? []
          );
          const totalFiles = answerFiles.length;
          numFilesSubmitted = totalFiles;
          attachmentSubmitted = totalFiles > 0 ? "Yes" : "No";
          submissionStatus = "Submitted";
          submittedOnTime = "Yes";
        } else {
          submissionStatus = "Not Submitted";
        }

        // Group 6 — marks
        let markAchieved: number | "" = "";
        let percentage: string = "";
        let gradeSymbol = "";
        let performanceBand = "";
        let markedStatus: string;

        if (!submission) {
          markedStatus = "Not Submitted";
        } else if (mark) {
          markAchieved = mark.totalScore;
          const pct = (mark.totalScore / assignment.totalMarks) * 100;
          percentage = pct.toFixed(2);
          gradeSymbol = getGradeSymbol(pct);
          performanceBand = getPerformanceBand(pct);
          markedStatus = "Marked";
        } else {
          markedStatus = "Ungraded";
        }

        // Group 7 — teacher record
        const markedByTeacher = mark ? "On Point Education Centre" : "";
        const dateMarkRecorded = mark ? new Date(mark.markedAt).toISOString().split("T")[0] : "";
        const teacherComments = mark ? (mark.feedback || "") : "";
        const dateLastUpdated = mark ? new Date(mark.markedAt).toISOString().split("T")[0] : "";

        const row = [
          // Group 1
          csvQ("On Point Education Centre"),
          csvQ(academicYear),
          term,                    // number — unquoted
          "",                      // week_number — not stored
          // Group 2
          csvQ(student.form),
          csvQ(student.form),
          csvQ("On Point"),
          csvQ("Education Centre"),
          csvQ("On Point Education Centre"),
          csvQ(assignment.subject),
          // Group 3
          csvQ(student.studentId),
          csvQ(firstName),
          csvQ(surname),
          csvQ(student.fullName),
          csvQ(student.gender),
          "",                      // student_date_of_birth — not stored
          // Group 4
          assignment.id,           // number — unquoted
          csvQ(assignment.title),
          "",                      // assignment_type — not stored
          assignment.id,           // assignment_number — use id
          csvQ(dateAssigned),
          csvQ(assignment.dueDate),
          assignment.totalMarks,   // number — unquoted
          csvQ(instructionsAttached),
          attachments.length,      // number — unquoted
          // Group 5
          csvQ(submissionStatus),
          csvQ(dateSubmitted),
          csvQ(timeSubmitted),
          csvQ(submittedOnTime),
          daysLate,                // number or "" — unquoted
          csvQ(attachmentSubmitted),
          numFilesSubmitted,       // number or "" — unquoted
          // Group 6
          markAchieved,            // number or "" — unquoted
          assignment.totalMarks,   // number — unquoted
          percentage,              // number string or "" — unquoted
          csvQ(gradeSymbol),
          csvQ(performanceBand),
          csvQ(markedStatus),
          // Group 7
          csvQ(markedByTeacher),
          csvQ(dateMarkRecorded),
          csvQ(teacherComments),
          csvQ(dateLastUpdated),
        ].join(",");

        res.write(row + "\n");
      }

      res.end();

      // Log the export asynchronously (don't block the response)
      const filterValue = (() => {
        if (query.type === "term") return `Term ${query.term}`;
        if (query.type === "class") return [query.form, query.subject].filter(Boolean).join(" / ");
        if (query.type === "assignment") return `Assignment #${query.assignmentId}`;
        return "All";
      })();

      storage.createExportLog({
        teacherEmail,
        filterType: query.type || "full",
        filterValue,
        recordCount,
      }).catch(err => console.error("Failed to log export:", err));

    } catch (error) {
      console.error("Master export error:", error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Server error" });
      }
    }
  });

  // GET /api/export/logs — last 20 export log entries for the authenticated teacher
  app.get("/api/export/logs", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;

      const logs = await storage.getExportLogs(validatedEmail, 20);
      res.json(logs);
    } catch (error) {
      console.error("Export logs error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  return httpServer;
}
