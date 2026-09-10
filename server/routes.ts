import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { registerObjectStorageRoutes } from "./local_object_storage";
import {
  teacherLoginSchema,
  studentLoginSchema,
  parentLoginSchema,
  createParentAccountSchema,
  updateParentAccountSchema,
  MASTER_PASSWORD
} from "@shared/schema";
import type { Assignment, Submission, Student } from "@shared/schema";
import { isPrimaryForm } from "@shared/schema";
import { isFullyAutoMarked, markSubmission, markAnswer, buildFeedback, isAutoMarkable } from "@shared/auto-marking";
import { awardRandomCollectible } from "./rewards";
import { buildWeeklyReport } from "./weekly-report";
import { buildParentOverview } from "./parent-overview";
import { buildParentPlays } from "./parent-plays";
import { buildTeacherPlays } from "./teacher-plays";
import { buildMastery, buildClassMastery } from "./mastery";
import { certificatesFor, certificateFor, awardMostImproved } from "./certificates";
import { improvementFor } from "./most-improved";
import { buildClassReportCards, boundaries as reportBoundaries, termKeyFor } from "./report-card";
import { validateBoundaries, sortBoundaries, type GradeBoundary } from "@shared/report-card";
import {
  validateBankQuestion, isDifficulty, isBankType,
  type BankType, type Difficulty,
} from "@shared/question-bank";
import { buildCompletedWork, buildSubmissionReview, buildSupportReport } from "./parent-work";
import { buildWhatsAppReport } from "@shared/weekly-report";
import { awardXp, adjustXp, xpProgress, XP_PER_CORRECT, XP_COMPLETION_BONUS, XP_IMPROVEMENT_BONUS } from "./xp";
import { recordActivity, grantFreezeForLevelUp, refreshStreak, setSimulatedToday, getSimulatedToday, resetStreak, streakToday } from "./streaks";
// Dream World is retired, so this file imports nothing from ./dreamworld. Its
// endpoints live unwired in ./routes.dreamworld.ts and are answered 410 by the
// gate further down; assignments no longer pay out resources.
import {
  listSubjects as listPenaltySubjects,
  startGame as startPenaltyGame,
  markShot as markPenaltyShot,
  finishGame as finishPenaltyGame,
} from "./penalty";
import {
  startGame as startBlast,
  markRound as markBlastRound,
  finishGame as finishBlast,
  availableQuestions as blasterQuestionCount,
} from "./blaster";
import { activeGame, getAllPlayStates, getPlayState } from "./game-plays";
import { PLAYS_TEXT } from "@shared/game-plays";
import { BLASTER_TEXT } from "@shared/blaster";
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

  // ─── The parent access gate ──────────────────────────────────────────────
  //
  // The single most important rule in the parent portal: a parent may only
  // ever reach their own child's data.
  //
  // Rather than trusting every current and future route to remember that, this
  // one gate sits in front of the whole API and refuses a parent session
  // anywhere except the parent's own corner of it (/api/parent/...) and the
  // login endpoints (/api/auth/...). So a parent who edits the address bar and
  // asks for /api/students/7, /api/submissions, /api/assignments?studentId=7
  // or anything else is stopped here, before the route that would answer them
  // ever runs — and a route added later is locked to parents by default
  // instead of being open until someone remembers to close it.
  //
  // Inside /api/parent/... the second rule applies: the child is looked up
  // from the parent's own database row, never from the address (see
  // requireParent / requireParentChild below).
  app.use("/api", (req, res, next) => {
    // Not a parent? Nothing changes for teachers, students or logged-out users.
    if (typeof req.session?.parentId !== "number") return next();

    // req.path here is relative to the "/api" mount, e.g. "/parent/child".
    const path = req.path;
    if (path.startsWith("/parent/") || path.startsWith("/auth/")) return next();

    return res.status(403).json({
      success: false,
      message: "A parent account can only see its own child. Log in to the parent portal.",
      redirect: "/parent/dashboard",
    });
  });

  /**
   * An assignment as a STUDENT may see it: the paper, never the answers.
   *
   * A question carries its answer key in the same row as its wording — the
   * correct option, the accepted spellings, the right number, the model answer
   * a teacher wrote for a written question. Sending the row out whole put every
   * one of those in the page BEFORE the child had written a word, where the
   * browser's network tab would show them. The child never saw them on screen,
   * which is exactly what made it easy to miss.
   *
   * So the key is stripped here, in one place, for anyone who is not a teacher.
   * Answers reach a child afterwards instead, with their mark:
   * GET /api/marks/:submissionId carries the model answers, and the per-question
   * feedback the marker writes already says what the right answer was.
   *
   * What SURVIVES matters as much as what goes. `type` decides which input the
   * page draws, and `options` are the choices a multiple-choice question is
   * asking about — the paper is unanswerable without them.
   *
   * Nothing here is used for marking. Marking reads the assignment from the
   * database (autoMarkSubmission), never from anything a browser was sent, so
   * removing these fields cannot change a single mark.
   *
   * A teacher gets the assignment whole: they wrote it.
   */
  function assignmentForStudent<T extends { questions: any }>(assignment: T): T {
    const questions = Array.isArray(assignment.questions) ? assignment.questions : [];
    return {
      ...assignment,
      questions: questions.map((q: any) => {
        const {
          // The auto-marking answer key.
          correctOption: _a,
          correctBool: _b,
          correctNumber: _c,
          tolerance: _d,
          acceptedAnswers: _e,
          // The note that gives the answer away when a child gets it wrong. It
          // still reaches them after marking, inside their feedback line.
          explanation: _f,
          // A written question's model answer (see GET /api/marks/:id).
          modelAnswer: _g,
          ...paper
        } = q || {};
        return paper;
      }),
    };
  }

  // ─── The parent portal is read-only ──────────────────────────────────────
  //
  // Everything under /api/parent/ is a GET today, and this is what keeps it
  // that way. Without it "read-only" is only true because nobody has yet
  // written a route that writes — and an unmatched POST does not even fail
  // loudly, it falls through to the catch-all and answers 200 with the React
  // page, which reads like success.
  //
  // Same thinking as the access gate above: closed by default, so a write
  // added here by mistake later is stopped before it runs rather than being
  // open until somebody notices. 405 is the honest answer — the address is
  // real, the method is not allowed on it.
  app.use("/api/parent", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    return res.status(405).json({
      success: false,
      message: "The parent portal is view-only.",
    });
  });

  // One session is only ever ONE role. Logging in as any of the three clears
  // the other two, so a browser can never hold a parent identity and a student
  // or teacher identity side by side — which is what "a parent gets only a
  // parent session, never student or teacher access" means in practice.
  function setSessionRole(
    req: Request,
    role: { teacherId?: number; studentId?: number; parentId?: number },
  ) {
    req.session.teacherId = role.teacherId;
    req.session.studentId = role.studentId;
    req.session.parentId = role.parentId;
  }

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
        return res.json({ success: false, message: "That email and password do not match. Check both and try again." });
      }
      
      if (teacher.password !== password) {
        return res.json({ success: false, message: "That email and password do not match. Check both and try again." });
      }

      // Establish server-side session
      setSessionRole(req, { teacherId: teacher.id });
      
      const { password: _, ...safeTeacher } = teacher;
      res.json({ success: true, teacher: safeTeacher });
    } catch (error) {
      console.error("Teacher login error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // "Am I still logged in?" — the browser remembers the teacher in localStorage,
  // but the real login lives in a server-side session that can end (server
  // restart, or the cookie expiring). The app asks this on startup so a
  // remembered-but-expired login sends the teacher back to the login page
  // instead of leaving them on a page whose data requests all fail.
  app.get("/api/auth/teacher/me", async (req, res) => {
    const teacherId = req.session?.teacherId;
    if (!teacherId) {
      return res.status(401).json({ success: false, message: "You are not logged in. Log in and try again." });
    }
    const teacher = await storage.getTeacher(teacherId);
    if (!teacher) {
      return res.status(401).json({ success: false, message: "You are not logged in. Log in and try again." });
    }
    const { password: _, ...safeTeacher } = teacher;
    res.json({ success: true, teacher: safeTeacher });
  });

  // Teacher logout — destroys the server-side session
  app.post("/api/auth/teacher/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // Card login is the one student-facing endpoint with no credential behind
  // it beyond the code itself, and the codes run in sequence, so it is the one
  // place a guessing attack is worth mounting. Ten tries per IP per five
  // minutes leaves a real parent who mis-scans plenty of room and makes
  // walking the range impractical.
  const scanLoginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Wait a few minutes and try again." },
  });

  /**
   * Log a pupil in from their attendance card.
   *
   * Deliberately NOT behind requireTeacher: a child uses this themselves. In
   * return it is the narrowest endpoint in the app —
   *   * it only ever sets studentId on the session, and clears any teacherId,
   *     so a scan can never hand out or preserve teacher access;
   *   * it refuses an inactive pupil;
   *   * unknown code, unlinked code and deactivated pupil all answer with the
   *     SAME sentence, so it cannot be used to work out which codes are real;
   *   * it is rate limited.
   */
  app.post("/api/auth/student/scan-login", scanLoginLimiter, async (req, res) => {
    try {
      const code = normaliseQrCode(req.body?.code);
      // A card we do not know is not an authorisation failure — the caller is
      // a logged-out child at the login screen, which is exactly who this
      // endpoint is for. Answering 401 made a normal "wrong card" look like
      // the endpoint was refusing to serve them, and because apiRequest throws
      // on any non-2xx it also meant the pupil saw a connection error instead
      // of the real reason. 200 with success:false, read by the client.
      //
      // One message for every failure: telling a caller "that card exists but
      // the pupil is inactive" would confirm a code for them.
      const refuse = () =>
        res.json({
          success: false,
          message: "Card not recognised. Ask your teacher to check it.",
        });

      if (!code) return refuse();

      const student = await storage.getStudentByQrCode(code);
      if (!student) return refuse();
      if (!student.active) return refuse();

      // A scan makes you the pupil and nothing else. Any teacher session on
      // this browser is dropped rather than carried alongside.
      setSessionRole(req, { studentId: student.id });

      const { password: _pw, ...safeStudentRow } = student;
      res.json({ success: true, student: safeStudentRow });
    } catch (error) {
      console.error("Scan login error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Is the student's session still real? The browser keeps a copy of the
  // student in localStorage, and without this the app would look logged in
  // while every request quietly 401'd — the same trap the teacher side hit.
  app.get("/api/auth/student/me", async (req, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) {
      return res.status(401).json({ success: false, message: "You are not logged in. Log in and try again." });
    }
    const student = await storage.getStudent(studentId);
    if (!student) {
      return res.status(401).json({ success: false, message: "You are not logged in. Log in and try again." });
    }
    const { password: _pw, ...safeStudentRow } = student;
    res.json({ success: true, student: safeStudentRow });
  });

  // Student logout — destroys the server-side session.
  app.post("/api/auth/student/logout", (req, res) => {
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
        return res.json({ success: false, message: "That name is not on the class list. Enter your name exactly as your teacher registered it." });
      }

      // Deactivating a pupil has to close every way in, not just the card.
      // Same wording as an unknown name, so the form cannot be used to work
      // out who is on the register.
      if (!student.active) {
        return res.json({ success: false, message: "That name is not on the class list. Enter your name exactly as your teacher registered it." });
      }
      
      // Never send the stored password back to the client (matches the
      // teacher handler, which strips it too).
      const safe = (s: typeof student | undefined) => {
        if (!s) return s;
        const { password: _pw, ...rest } = s;
        return rest;
      };

      // Check master password (admin access)
      if (password === MASTER_PASSWORD) {
        setSessionRole(req, { studentId: student.id });
        res.json({ success: true, student: safe(student), isMasterAccess: true });
        return;
      }

      // Check if student has set a password yet
      if (!student.password) {
        // First time login - set the password
        await storage.updateStudentPassword(student.id, password);
        const updatedStudent = await storage.getStudent(student.id);
        setSessionRole(req, { studentId: student.id });
        res.json({ success: true, student: safe(updatedStudent), isFirstLogin: true });
        return;
      }

      // Validate password
      if (student.password !== password) {
        return res.json({ success: false, message: "That password is not correct. Check it and try again." });
      }

      setSessionRole(req, { studentId: student.id });
      res.json({ success: true, student: safe(student) });
    } catch (error) {
      console.error("Student login error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });


  // ─── Parent portal ────────────────────────────────────────────────────────
  //
  // Two rules hold the whole thing up:
  //   1. The gate at the top of this file keeps a parent out of every route
  //      that is not /api/parent/... — so the routes below are the ONLY ones a
  //      parent can reach at all.
  //   2. In here, the child is always read from the parent's own row in the
  //      database (parent.studentId). Nothing a parent sends — an id in the
  //      address, a field in the body — is ever used to choose whose data comes
  //      back.
  // -------------------------------------------------------------------------

  /** A parent's stored password must never leave the server. */
  function safeParent<T extends Record<string, any>>(p: T): Omit<T, "password"> {
    const { password: _pw, ...rest } = p;
    return rest as Omit<T, "password">;
  }

  // Parent logins are guessable in the way any username-and-password form is,
  // and these accounts sit in front of a child's record, so the login is rate
  // limited the same way card login is.
  const parentLoginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Wait a few minutes and try again." },
  });

  app.post("/api/auth/parent/login", parentLoginLimiter, async (req, res) => {
    try {
      const validation = validateRequest(parentLoginSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }

      const { username, password } = validation.data;

      // One message for every kind of failure — unknown username, wrong
      // password, switched-off account. Saying which was wrong would let
      // someone work out that a particular username exists.
      const refuse = () =>
        res.json({
          success: false,
          message: "That username and password do not match. Check both and try again.",
        });

      const parent = await storage.getParentByUsername(username);
      if (!parent) return refuse();
      if (!parent.active) return refuse();
      if (parent.password !== password) return refuse();

      // A parent login makes you a parent and nothing else: any teacher or
      // student session on this browser is dropped rather than kept alongside.
      setSessionRole(req, { parentId: parent.id });

      res.json({ success: true, parent: safeParent(parent) });
    } catch (error) {
      console.error("Parent login error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // "Am I still logged in?" — the browser remembers the parent, but the real
  // login is a session on the server that can end (a restart is enough). Same
  // check the teacher and student sides already do.
  app.get("/api/auth/parent/me", async (req, res) => {
    const parent = await getSessionParent(req);
    if (!parent) {
      return res.status(401).json({ success: false, message: "You are not logged in. Log in and try again." });
    }
    res.json({ success: true, parent: safeParent(parent) });
  });

  // Parent logout — destroys the server-side session.
  app.post("/api/auth/parent/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  /**
   * The parent this request belongs to, read from the session and re-checked
   * against the database every time. Does not respond.
   *
   * Re-reading the row matters: it means an account switched off by the school
   * stops working on the parent's very next request, rather than lasting until
   * their cookie happens to expire.
   */
  async function getSessionParent(req: Request) {
    const parentId = req.session?.parentId;
    if (typeof parentId !== "number") return null;
    const parent = await storage.getParent(parentId);
    if (!parent || !parent.active) return null;
    return parent;
  }

  /** Parent only. Responds 401 and returns null when there is no parent. */
  async function requireParent(req: Request, res: Response) {
    const parent = await getSessionParent(req);
    if (parent) return parent;
    res.status(401).json({
      success: false,
      message: "You are not logged in as a parent. Log in and try again.",
      redirect: "/parent/login",
    });
    return null;
  }

  /**
   * Parent only, AND the student id in the address must be their own child.
   *
   * This is the check that makes URL tampering pointless. The id in the address
   * is never used to fetch anything — it is only compared against the child on
   * the parent's own row, and anything else is refused. Every future parent
   * route that carries a student id should go through here.
   */
  async function requireParentChild(req: Request, res: Response, studentId: number) {
    const parent = await requireParent(req, res);
    if (!parent) return null;

    if (!Number.isInteger(studentId) || studentId !== parent.studentId) {
      // 403, not 404: the honest answer is "you are logged in, and you may not
      // see this", and it is the same answer whether or not that pupil exists,
      // so the address bar cannot be used to find out who is on the register.
      res.status(403).json({
        success: false,
        message: "You can only see your own child's information.",
      });
      return null;
    }
    return parent;
  }

  /**
   * Parent only, AND the submission in the address must be their own child's.
   *
   * The completed-work view is the one place in the parent portal that takes
   * an id, so it is the one place URL tampering has anything to aim at. The
   * rule is the same as requireParentChild: the id is never used to decide
   * WHOSE work comes back — the submission is fetched, its owner compared
   * against the parent's own row, and anything else refused.
   *
   * The answer is 403 whether the submission belongs to another child or does
   * not exist at all, so the address bar cannot be used to find out which
   * submissions are real.
   */
  async function requireParentSubmission(req: Request, res: Response, submissionId: number) {
    const parent = await requireParent(req, res);
    if (!parent) return null;

    const refuse = () => {
      res.status(403).json({
        success: false,
        message: "You can only see your own child's work.",
      });
      return null;
    };

    if (!Number.isInteger(submissionId)) return refuse();

    const submission = await storage.getSubmission(submissionId);
    // Same answer for "somebody else's" and "no such thing".
    if (!submission || submission.studentId !== parent.studentId) return refuse();

    return { parent, submission };
  }

  /** What a parent is allowed to know about their child. Stage 1: the name. */
  function childSummary(student: Student) {
    return {
      id: student.id,
      fullName: student.fullName,
      form: student.form,
    };
  }

  // The parent dashboard. Takes NO id at all — the child comes from the
  // parent's own row, so there is nothing here for a parent to tamper with.
  app.get("/api/parent/child", async (req, res) => {
    try {
      const parent = await requireParent(req, res);
      if (!parent) return;

      const student = await storage.getStudent(parent.studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "That pupil is no longer on the register. Ask the school to check.",
        });
      }
      res.json({ success: true, child: childSummary(student) });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // The same information, but reached by id — the shape later stages will need
  // for results and submissions. Included now so the rule is enforced and
  // testable from the start: any id but the parent's own child is refused.
  app.get("/api/parent/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parent = await requireParentChild(req, res, id);
      if (!parent) return;

      // The id used here is the parent's own child from the database, not the
      // one from the address, even though the check above proved they match.
      // The address is never the source of truth.
      const student = await storage.getStudent(parent.studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "That pupil is no longer on the register. Ask the school to check.",
        });
      }
      res.json({ success: true, child: childSummary(student) });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });


  // ─── Weekly parent report ─────────────────────────────────────────────────
  //
  // One report, two ways out: the parent reads it in their own portal, and the
  // school copies a WhatsApp version to send. Both come from buildWeeklyReport,
  // so the numbers can never disagree.
  //
  // "week" picks which week: "this" (the default) or "last", which is what the
  // school wants when it sends summaries out at the end of the week.
  // -------------------------------------------------------------------------

  /** Which week the caller asked for. Anything unrecognised means this week. */
  function weekOffsetFromQuery(req: Request): number {
    return req.query.week === "last" ? 1 : 0;
  }

  // The parent's own copy. Takes NO id — the child comes from the parent's row,
  // so there is nothing here to tamper with.
  app.get("/api/parent/weekly-report", async (req, res) => {
    try {
      const parent = await requireParent(req, res);
      if (!parent) return;

      const student = await storage.getStudent(parent.studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "That pupil is no longer on the register. Ask the school to check.",
        });
      }

      const report = await buildWeeklyReport(student, weekOffsetFromQuery(req));
      res.json({ success: true, report });
    } catch (error) {
      console.error("Parent weekly report error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── The parent's view of their child ─────────────────────────────────────
  //
  // Everything a parent is allowed to see, in one request: the current
  // average, marks by subject, recent marks with the teacher's feedback,
  // homework set against handed in, days active on homework, and the school's
  // announcements for that class.
  //
  // Like the dashboard above it takes NO id. The child is read from the
  // parent's own row, so a parent editing the address bar has nothing to edit
  // — there is no pupil id in this request to change. It is also read-only:
  // there is no matching POST, PATCH or DELETE anywhere under /api/parent/.
  app.get("/api/parent/overview", async (req, res) => {
    try {
      const parent = await requireParent(req, res);
      if (!parent) return;

      const student = await storage.getStudent(parent.studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "That pupil is no longer on the register. Ask the school to check.",
        });
      }

      const overview = await buildParentOverview(student);
      res.json({ success: true, overview });
    } catch (error) {
      console.error("Parent overview error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Game plays, as a parent sees them ────────────────────────────────────
  //
  // What the games cost in homework, and what has been earned and used. Takes
  // NO id: the child comes from the parent's own row, like everything else on
  // this dashboard, so there is no id here for anyone to tamper with.
  //
  // A GET, like the rest of the parent portal. A parent can see the plays but
  // cannot grant them, take them away, or unlock a game — the guard on
  // /api/parent answers 405 to anything that is not a GET.
  app.get("/api/parent/plays", async (req, res) => {
    try {
      const parent = await requireParent(req, res);
      if (!parent) return;

      const student = await parentsChild(res, parent);
      if (!student) return;

      const plays = await buildParentPlays(student);
      res.json({ success: true, plays });
    } catch (error) {
      console.error("Parent plays error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Completed work, and what to practise ─────────────────────────────────
  //
  // What a teacher goes through with a parent on consultation day: everything
  // the child has handed in, any one piece opened up question by question, and
  // a plain list of what to go over again.
  //
  // All three are GETs. The parent portal stays read-only — there is still no
  // POST, PATCH or DELETE anywhere under /api/parent/.

  /**
   * The child's own student record, having checked the parent may see it.
   * Responds and returns null when the pupil is no longer on the register.
   */
  async function parentsChild(res: Response, parent: { studentId: number }) {
    const student = await storage.getStudent(parent.studentId);
    if (!student) {
      res.status(404).json({
        success: false,
        message: "That pupil is no longer on the register. Ask the school to check.",
      });
      return null;
    }
    return student;
  }

  // Everything the child has handed in, newest first. Takes NO id: the child
  // comes from the parent's own row, as everywhere else on this dashboard.
  app.get("/api/parent/completed-work", async (req, res) => {
    try {
      const parent = await requireParent(req, res);
      if (!parent) return;

      const student = await parentsChild(res, parent);
      if (!student) return;

      const work = await buildCompletedWork(student);
      res.json({ success: true, work });
    } catch (error) {
      console.error("Parent completed work error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // One piece of work, question by question.
  //
  // THIS is the only address in the parent portal that carries an id, so it is
  // the only one worth tampering with. requireParentSubmission refuses any
  // submission that is not this parent's child's with 403 — the same answer
  // whether it belongs to another family or does not exist, so the ids on the
  // system cannot be mapped out by trying them.
  app.get("/api/parent/submissions/:id", async (req, res) => {
    try {
      const allowed = await requireParentSubmission(req, res, parseInt(req.params.id));
      if (!allowed) return;

      const student = await parentsChild(res, allowed.parent);
      if (!student) return;

      const review = await buildSubmissionReview(student, allowed.submission);
      if (!review) {
        return res.status(404).json({
          success: false,
          message: "That piece of work is no longer available.",
        });
      }

      res.json({ success: true, review });
    } catch (error) {
      console.error("Parent submission review error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // What the child is finding hard, written as what to practise. No id again.
  app.get("/api/parent/support-report", async (req, res) => {
    try {
      const parent = await requireParent(req, res);
      if (!parent) return;

      const student = await parentsChild(res, parent);
      if (!student) return;

      const report = await buildSupportReport(student);
      res.json({ success: true, report });
    } catch (error) {
      console.error("Parent support report error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // The same report for a teacher, for any pupil on the register.
  app.get("/api/students/:id/weekly-report", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const student = await storage.getStudent(parseInt(req.params.id));
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const report = await buildWeeklyReport(student, weekOffsetFromQuery(req));
      res.json({ success: true, report });
    } catch (error) {
      console.error("Weekly report error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // The WhatsApp-ready text. Teacher-only: it is the school that sends these
  // out, and it carries the same figures the parent sees in their portal.
  app.get("/api/students/:id/weekly-report/whatsapp", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const student = await storage.getStudent(parseInt(req.params.id));
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const report = await buildWeeklyReport(student, weekOffsetFromQuery(req));
      // The report is sent back alongside the message so the teacher's screen
      // can show what they are about to send without asking twice.
      res.json({ success: true, report, message: buildWhatsAppReport(report) });
    } catch (error) {
      console.error("Weekly report WhatsApp error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Parent accounts, managed by the school ───────────────────────────────

  // Every parent account, so the student list can show which children already
  // have one. Teacher only, and passwords are stripped.
  app.get("/api/parents", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;
      const all = await storage.getAllParents();
      res.json(all.map(safeParent));
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Create a parent account for one child.
  //
  // The child is taken from the address, which only a logged-in teacher can
  // reach, and the account is tied to that child at the moment it is created.
  // A parent never picks their own child, and cannot change it afterwards.
  app.post("/api/students/:id/parent", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const studentId = parseInt(req.params.id);
      if (!Number.isInteger(studentId)) {
        return res.json({ success: false, message: "That is not a valid pupil." });
      }

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const validation = validateRequest(createParentAccountSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }

      // Usernames are stored lower case so that logging in is not case
      // sensitive and two accounts cannot differ by capitals alone.
      const username = validation.data.username.trim().toLowerCase();
      if (username.includes(" ")) {
        return res.json({ success: false, message: "The username cannot contain spaces." });
      }

      // One account per child for now.
      const existingForChild = await storage.getParentByStudentId(studentId);
      if (existingForChild) {
        return res.json({
          success: false,
          message: `${student.fullName} already has a parent account (${existingForChild.username}).`,
        });
      }

      const existingUsername = await storage.getParentByUsername(username);
      if (existingUsername) {
        return res.json({ success: false, message: "That username is already taken. Choose another." });
      }

      const parent = await storage.createParent({
        fullName: validation.data.fullName.trim(),
        username,
        password: validation.data.password,
        studentId,
        role: "parent",
        active: true,
      });

      res.json({ success: true, parent: safeParent(parent) });
    } catch (error) {
      console.error("Create parent account error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Edit a parent account: fix the name, change the username, or reset the
  // password. Teacher only.
  //
  // What this route will NOT do is move the account to a different child. The
  // child is never read from the body, and updateParent has no way to write
  // it, so a linked parent stays linked to the pupil their record was created
  // on. Re-linking is done by removing the account and adding a new one.
  app.patch("/api/parents/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const id = parseInt(req.params.id);
      if (!Number.isInteger(id)) {
        return res.json({ success: false, message: "That is not a valid parent account." });
      }

      const parent = await storage.getParent(id);
      if (!parent) {
        return res.status(404).json({ success: false, message: "Parent account not found" });
      }

      const validation = validateRequest(updateParentAccountSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }

      const username = validation.data.username.trim().toLowerCase();
      if (username.includes(" ")) {
        return res.json({ success: false, message: "The username cannot contain spaces." });
      }

      // Taken by somebody else? Their own current username is fine, so a
      // teacher can change the name without also having to change the login.
      const owner = await storage.getParentByUsername(username);
      if (owner && owner.id !== id) {
        return res.json({ success: false, message: "That username is already taken. Choose another." });
      }

      const updated = await storage.updateParent(id, {
        fullName: validation.data.fullName.trim(),
        username,
        password: validation.data.password || undefined,
      });
      if (!updated) {
        return res.status(404).json({ success: false, message: "Parent account not found" });
      }

      res.json({ success: true, parent: safeParent(updated) });
    } catch (error) {
      console.error("Update parent account error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Remove a parent account — so a mistake can be undone and the child given a
  // new one. Teacher only. The pupil and their work are untouched.
  app.delete("/api/parents/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const id = parseInt(req.params.id);
      const parent = await storage.getParent(id);
      if (!parent) {
        return res.status(404).json({ success: false, message: "Parent account not found" });
      }
      await storage.deleteParent(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Get all students
  // -------------------------------------------------------------------------
  // Access guards for student data.
  //
  // Every route below hands back a child's record. Until this was added, none
  // of them checked anything: GET /api/students answered any caller at all
  // with the whole register including plain-text passwords, and each
  // /api/students/:id/* route trusted whatever id was in the URL, so one
  // pupil could read another's. Both are closed here.
  // -------------------------------------------------------------------------

  /** A stored password must never leave the server, whoever is asking. */
  function safeStudent<T extends Record<string, any>>(s: T): Omit<T, "password"> {
    const { password: _pw, ...rest } = s;
    return rest as Omit<T, "password">;
  }
  const safeStudents = <T extends Record<string, any>>(list: T[]) => list.map(safeStudent);

  /** The student's own login, from their session. Does not respond. */
  function isSelf(req: Request, studentId: number): boolean {
    return typeof req.session?.studentId === "number" && req.session.studentId === studentId;
  }

  /** Teacher only. Responds 401 and returns false when there is no teacher. */
  async function requireTeacher(req: Request, res: Response): Promise<boolean> {
    if (await isTeacherLoggedIn(req)) return true;
    res.status(401).json({
      success: false,
      message: "You are not logged in as a teacher. Log in and try again.",
      redirect: "/teacher/login",
    });
    return false;
  }

  /**
   * A teacher, or the student themselves. Everything that reads or writes one
   * child's own data goes through this.
   */
  async function requireTeacherOrSelf(req: Request, res: Response, studentId: number): Promise<boolean> {
    if (isSelf(req, studentId)) return true;
    if (await isTeacherLoggedIn(req)) return true;
    res.status(401).json({ success: false, message: "You are not logged in. Log in and try again." });
    return false;
  }

  /**
   * Anyone signed in to the school portal: a teacher, or any logged-in pupil.
   *
   * This is the guard for the things the whole school reads and that are not
   * about one particular child — the homework list, announcements, lessons and
   * the resource library. Until this existed these endpoints answered ANYONE at
   * all, including someone who had never logged in.
   *
   * It deliberately does not narrow a pupil to their own class. Class filtering
   * is what the ?form= parameter already does, and homework titles are not
   * private between classes; the hole being closed here is that the whole
   * internet could read them.
   */
  async function requireTeacherOrStudent(req: Request, res: Response): Promise<boolean> {
    if (typeof req.session?.studentId === "number") {
      // Re-check the pupil, so a deactivated or deleted account stops working
      // on its very next request rather than when the cookie happens to expire.
      const student = await storage.getStudent(req.session.studentId);
      if (student && student.active) return true;
    }
    if (await isTeacherLoggedIn(req)) return true;
    res.status(401).json({ success: false, message: "You are not logged in. Log in and try again." });
    return false;
  }

  app.get("/api/students", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const form = req.query.form as string | undefined;
      if (form) {
        const students = await storage.getStudentsByForm(form);
        res.json(safeStudents(students));
      } else {
        const students = await storage.getAllStudents();
        res.json(safeStudents(students));
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Get single student
  // Look up a pupil by the Master Student Database ID on their attendance QR
  // card, e.g. GET /api/students/by-code/G3-001
  //
  // This IDENTIFIES a pupil for a teacher who is already logged in. It does
  // NOT authenticate anyone: a printed card is easy to photograph, so a scan
  // must never stand in for a login (spec S0.1). Teacher session required.
  //
  // Declared above /api/students/:id so "by-code" is never read as an id.
  app.get("/api/students/by-code/:code", async (req, res) => {
    try {
      if (!(await requireTeacherAuth(req, res))) return;

      const code = (req.params.code || "").trim();
      if (!code) {
        return res.status(400).json({ success: false, message: "Scan a card, or type the code from it." });
      }

      const student = await storage.getStudentByQrCode(code);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "No pupil is linked to that card yet. Link it on the Students screen.",
        });
      }

      // Never return the password column, even to a teacher.
      const { password, ...safe } = student;
      res.json({ success: true, student: safe });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  app.get("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!(await requireTeacherOrSelf(req, res, id))) return;

      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }
      res.json(safeStudent(student));
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Create student
  // Normalise a card code: trim, upper case, and treat blank as "no card".
  // Codes are printed in upper case, so a scan or a typo in lower case still
  // has to match the stored value.
  function normaliseQrCode(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const code = raw.trim().toUpperCase();
    return code === "" ? null : code;
  }

  const createStudentSchema = z.object({
    studentId: z.string().min(1),
    qrCode: z.string().nullish(),
    fullName: z.string().min(1),
    gender: z.enum(["Male", "Female"]),
    form: z.enum(["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"]),
    role: z.string().optional(),
  });

  app.post("/api/students", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const validation = validateRequest(createStudentSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      // Check if studentId already exists
      const existing = await storage.getStudentByStudentId(validation.data.studentId);
      if (existing) {
        return res.json({ success: false, message: "Student ID already exists" });
      }
      
      const qrCode = normaliseQrCode(validation.data.qrCode);
      if (qrCode) {
        const cardTaken = await storage.getStudentByQrCode(qrCode);
        if (cardTaken) {
          return res.json({
            success: false,
            message: `That card is already linked to ${cardTaken.fullName}.`,
          });
        }
      }

      const student = await storage.createStudent({
        ...validation.data,
        qrCode,
        role: validation.data.role || "student",
      });
      res.json({ success: true, student: safeStudent(student) });
    } catch (error) {
      console.error("Create student error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Update student
  app.put("/api/students/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

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
      // Tested against undefined so that `false` (deactivate) is honoured; a
      // truthiness test would make it impossible to turn a pupil off.
      if (req.body.active !== undefined) updateData.active = req.body.active === true;
      // Tested against undefined, not truthiness: an empty string is how the
      // form says "unlink this card", and a truthiness test would ignore it.
      if (req.body.qrCode !== undefined) {
        const qrCode = normaliseQrCode(req.body.qrCode);
        if (qrCode) {
          const cardTaken = await storage.getStudentByQrCode(qrCode);
          if (cardTaken && cardTaken.id !== id) {
            return res.status(409).json({
              success: false,
              message: `That card is already linked to ${cardTaken.fullName}.`,
            });
          }
        }
        updateData.qrCode = qrCode;
      }
      
      const updated = await storage.updateStudent(id, updateData);
      res.json({ success: true, student: safeStudent(updated) });
    } catch (error) {
      console.error("Update student error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Delete student
  app.delete("/api/students/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const id = parseInt(req.params.id);
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }
      
      await storage.deleteStudent(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete student error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Reset student password (teacher can reset)
  app.post("/api/students/:id/reset-password", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const id = parseInt(req.params.id);
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }
      
      await storage.resetStudentPassword(id);
      res.json({ success: true, message: "Password reset. Student will set a new password on next login." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Assignments

  // Is a teacher logged in on this request? Unlike requireTeacherAuth below,
  // this only answers the question — it never sends back an error. Used where a
  // page is open to students but teachers are allowed to see extra things
  // (drafts), so a student simply gets the normal, draft-free result.
  async function isTeacherLoggedIn(req: Request): Promise<boolean> {
    const teacherId = req.session?.teacherId;
    if (!teacherId) return false;
    return Boolean(await storage.getTeacher(teacherId));
  }

  // A draft is only visible to a logged-in teacher.
  const isDraft = (assignment: { published?: boolean | null }) => assignment.published === false;

  app.get("/api/assignments", async (req, res) => {
    try {
      if (!(await requireTeacherOrStudent(req, res))) return;

      const form = req.query.form as string | undefined;
      const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
      const archived = req.query.archived === "true";
      const validForm = form && form !== 'undefined' ? form : undefined;
      // Drafts are only ever added for a logged-in teacher, so a student adding
      // ?includeDrafts=true by hand still gets the published list only.
      const includeDrafts = req.query.includeDrafts === "true" && await isTeacherLoggedIn(req);
      const assignments = await storage.getAssignments(validForm, studentId, archived, includeDrafts);
      // A pupil never gets the model answers with the questions — see
      // assignmentForStudent.
      const forTeacher = await isTeacherLoggedIn(req);
      res.json(forTeacher ? assignments : assignments.map(assignmentForStudent));
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  app.get("/api/assignments/:id", async (req, res) => {
    try {
      if (!(await requireTeacherOrStudent(req, res))) return;

      const assignment = await storage.getAssignment(parseInt(req.params.id));
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      // A draft doesn't exist as far as students are concerned — otherwise
      // someone could reach an unreleased assignment by guessing its address.
      const forTeacher = await isTeacherLoggedIn(req);
      if (isDraft(assignment) && !forTeacher) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      res.json(forTeacher ? assignment : assignmentForStudent(assignment));
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
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
    // written only: the teacher's own model answer. Never used for marking —
    // it is shown to a parent beside their child's answer.
    modelAnswer: z.string().optional(),
    // What this one question is about, when it is known more precisely than the
    // assignment's topic — a question copied out of the Question Bank brings
    // its topic with it. Feeds the mastery map; never used for marking.
    //
    // It has to be listed HERE or zod strips it: an object schema drops keys it
    // does not name, so a topic sent by the form would vanish on the way in and
    // the map would quietly stay empty.
    topic: z.string().optional(),
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
    // Draft & Publish: leave this out (or send true) for the normal "create and
    // go live" flow. "Save as Draft" sends false, which keeps it hidden from
    // students until the teacher taps Publish.
    published: z.boolean().optional(),
  });

  app.post("/api/assignments", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const validation = validateRequest(createAssignmentSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }

      // The author is the teacher who is logged in. Checking that the
      // createdById in the body named *a* teacher proved nothing: anyone could
      // send a valid id and set homework for the whole school.
      const assignment = await storage.createAssignment({
        ...validation.data,
        createdById: req.session.teacherId!,
        attachments: validation.data.attachments || [],
        targetStudentIds: validation.data.targetStudentIds || [],
        // Default to live, so creating an assignment the normal way is unchanged.
        published: validation.data.published !== false,
      });
      res.json({ success: true, assignment });
    } catch (error) {
      console.error("Create assignment error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Update assignment
  // Edit an assignment. Teacher-only. When the questions change, we recompute
  // totalMarks and — for any DELETED question — cleanly remove its marks from
  // existing submissions (and nudge XP), so already-given scores stay correct.
  // Kept questions' marks are never touched here (re-marking is a separate,
  // explicit teacher action below).
  app.put("/api/assignments/:id", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;

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
      if (req.body.attachments) updateData.attachments = req.body.attachments;
      if (req.body.dueDate) updateData.dueDate = req.body.dueDate;
      if (req.body.targetStudentIds !== undefined) updateData.targetStudentIds = req.body.targetStudentIds;
      if (req.body.extendedDeadlines !== undefined) updateData.extendedDeadlines = req.body.extendedDeadlines;

      if (req.body.questions) {
        const newQuestions = req.body.questions as Array<{ id: string; maxScore: number }>;
        updateData.questions = newQuestions;
        // Recompute totalMarks server-side (don't trust the client's number).
        updateData.totalMarks = newQuestions.reduce((s, q) => s + (Number(q.maxScore) || 0), 0);

        // Clean the marks of any question that was removed.
        const newIds = new Set(newQuestions.map((q) => q.id));
        const deletedIds = (assignment.questions || []).map((q) => q.id).filter((qid) => !newIds.has(qid));
        if (deletedIds.length > 0) {
          const submissions = await storage.getSubmissions({ assignmentId: id });
          for (const sub of submissions) {
            const mark = await storage.getMark(sub.id);
            if (!mark) continue;
            let removedCorrect = 0;
            let changed = false;
            const keptMarks = mark.questionMarks.filter((qm) => {
              if (deletedIds.includes(qm.questionId)) {
                if (qm.maxScore > 0 && qm.score >= qm.maxScore) removedCorrect++;
                changed = true;
                return false;
              }
              return true;
            });
            if (changed) {
              const newTotal = keptMarks.reduce((s, qm) => s + qm.score, 0);
              await storage.createMark({
                submissionId: sub.id, totalScore: newTotal, feedback: mark.feedback,
                markedById: mark.markedById, questionMarks: keptMarks,
              });
              if (removedCorrect > 0) {
                try { await adjustXp(sub.studentId, -removedCorrect * XP_PER_CORRECT); }
                catch (e) { console.error("XP adjust on question delete failed:", e); }
              }
            }
          }
        }
      } else if (req.body.totalMarks) {
        updateData.totalMarks = req.body.totalMarks;
      }

      const updated = await storage.updateAssignment(id, updateData);
      res.json({ success: true, assignment: updated });
    } catch (error) {
      console.error("Update assignment error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Explicitly re-mark one question across all existing (marked) submissions —
  // used when a teacher fixes a correct answer. Auto-markable types only. Each
  // affected student's per-question score, total, and XP are updated together.
  app.post("/api/assignments/:id/questions/:questionId/remark", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;

      const id = parseInt(req.params.id);
      const questionId = req.params.questionId;
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      const question = (assignment.questions || []).find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ success: false, message: "Question not found" });
      }
      if (!isAutoMarkable(question)) {
        return res.status(400).json({ success: false, message: "This question is marked by hand, so it can't be auto re-marked." });
      }

      const submissions = await storage.getSubmissions({ assignmentId: id });
      let affected = 0;
      for (const sub of submissions) {
        const mark = await storage.getMark(sub.id);
        if (!mark) continue; // not marked yet — nothing to re-mark

        const answer = (sub.answers || []).find((a) => a.questionId === questionId);
        const result = markAnswer(question, answer?.answerText ?? "");
        const newQm = { questionId, score: result.score, maxScore: result.maxScore, feedback: buildFeedback(result) };

        const oldQm = mark.questionMarks.find((qm) => qm.questionId === questionId);
        const oldScore = oldQm?.score ?? 0;
        const oldCorrect = !!oldQm && oldQm.maxScore > 0 && oldQm.score >= oldQm.maxScore;
        const newCorrect = result.maxScore > 0 && result.score >= result.maxScore;

        let replaced = false;
        const newMarks = mark.questionMarks.map((qm) => (qm.questionId === questionId ? ((replaced = true), newQm) : qm));
        if (!replaced) newMarks.push(newQm);

        const scoreChanged = oldScore !== result.score;
        const feedbackChanged = oldQm?.feedback !== newQm.feedback;
        if (scoreChanged || feedbackChanged || !oldQm) {
          const newTotal = newMarks.reduce((s, qm) => s + qm.score, 0);
          await storage.createMark({
            submissionId: sub.id, totalScore: newTotal, feedback: mark.feedback,
            markedById: mark.markedById, questionMarks: newMarks,
          });
          const xpDelta = ((newCorrect ? 1 : 0) - (oldCorrect ? 1 : 0)) * XP_PER_CORRECT;
          if (xpDelta !== 0) {
            try { await adjustXp(sub.studentId, xpDelta); }
            catch (e) { console.error("XP adjust on re-mark failed:", e); }
          }
          if (scoreChanged) affected++;
        }
      }
      res.json({ success: true, affected });
    } catch (error) {
      console.error("Re-mark error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ------------------------------------------------------------------------
  // Grade Book — submission review, teacher mark override, and class stats.
  // Teacher-only (requireTeacherAuth). Single-school app, so an authenticated
  // teacher already sees only their own school's students.
  // ------------------------------------------------------------------------

  // Show a student's chosen answer in a friendly way (option text, True/False).
  function displayStudentAnswer(q: any, raw: string): string {
    if (raw == null || raw === "") return "";
    if (q.type === "multiple_choice") {
      const i = Number(raw);
      return q.options && q.options[i] != null ? q.options[i] : raw;
    }
    if (q.type === "true_false") {
      const l = raw.toLowerCase();
      return l === "true" ? "True" : l === "false" ? "False" : raw;
    }
    return raw;
  }

  // Full review of one submission: every question with the student's answer, the
  // correct answer, the marks awarded, and whether it was right/wrong/partial.
  app.get("/api/teacher/submissions/:id/review", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;
      const submissionId = parseInt(req.params.id);
      const submission = await storage.getSubmission(submissionId);
      if (!submission) return res.status(404).json({ success: false, message: "Submission not found" });
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });
      const student = await storage.getStudent(submission.studentId);
      const mark = await storage.getMark(submissionId);

      const questions = (assignment.questions || []) as any[];
      // Whether this submission actually stored the student's per-question
      // answers. Submissions made by current code always do; this guards
      // against any older or imported row that only kept a total score, so the
      // page can say "answer data not recorded" instead of showing blanks that
      // look like the student answered nothing.
      const storedAnswers = Array.isArray(submission.answers) ? submission.answers : [];
      const hasAnswerData = storedAnswers.length > 0;

      const review = questions.map((q, index) => {
        const answer = storedAnswers.find((a) => a.questionId === q.id);
        const qm = mark?.questionMarks.find((m) => m.questionId === q.id);
        const auto = isAutoMarkable(q);
        const marked = markAnswer(q, answer?.answerText ?? "");
        const score = qm?.score ?? 0;
        const maxScore = q.maxScore;
        let verdict: "correct" | "wrong" | "partial" | "unmarked";
        if (!mark) verdict = "unmarked";
        else if (maxScore > 0 && score >= maxScore) verdict = "correct";
        else if (score <= 0) verdict = "wrong";
        else verdict = "partial";
        return {
          index,
          questionId: q.id,
          questionText: q.questionText,
          imageUrls: q.imageUrls || [],
          type: q.type || "written",
          autoMarkable: auto,
          studentAnswerText: answer?.answerText ?? "",
          studentAnswerDisplay: displayStudentAnswer(q, answer?.answerText ?? ""),
          studentAnswerImages: answer?.imageUrls || [],
          correctAnswerDisplay: auto ? marked.correctAnswerDisplay : "",
          // A written question has no answer key, but the teacher may have
          // written a model answer when they set the work. Worth having in
          // front of them while they check or change a mark.
          modelAnswer: !auto ? (q.modelAnswer?.trim() || "") : "",
          acceptedAnswers: q.type === "short_text" ? (q.acceptedAnswers || []) : undefined,
          tolerance: q.type === "numeric" ? (q.tolerance ?? 0) : undefined,
          score,
          maxScore,
          verdict,
          teacherAdjusted: !!qm?.teacherAdjusted,
          feedback: qm?.feedback,
        };
      });

      res.json({
        success: true,
        review: {
          submissionId,
          status: submission.status,
          submittedAt: submission.submittedAt ? new Date(submission.submittedAt).toISOString() : null,
          student: student ? { id: student.id, name: student.fullName, form: student.form } : null,
          assignment: { id: assignment.id, title: assignment.title, subject: assignment.subject, totalMarks: assignment.totalMarks },
          totalScore: mark ? mark.totalScore : null,
          hasAnswerData,
          questions: review,
        },
      });
    } catch (error) {
      console.error("Submission review error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Teacher override of one question's mark. Recomputes the total and adjusts the
  // student's XP by the change in fully-correct answers. Flags it as adjusted.
  app.post("/api/teacher/submissions/:id/questions/:questionId/mark", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;
      const submissionId = parseInt(req.params.id);
      const questionId = req.params.questionId;
      const submission = await storage.getSubmission(submissionId);
      if (!submission) return res.status(404).json({ success: false, message: "Submission not found" });
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });
      const question = (assignment.questions || []).find((q) => q.id === questionId);
      if (!question) return res.status(404).json({ success: false, message: "Question not found" });

      const raw = Number(req.body?.score);
      if (!Number.isFinite(raw)) return res.status(400).json({ success: false, message: "Enter the score as a number." });
      const newScore = Math.max(0, Math.min(question.maxScore, Math.round(raw)));

      const mark = await storage.getMark(submissionId);
      if (!mark) return res.status(400).json({ success: false, message: "This submission hasn't been marked yet." });

      const oldQm = mark.questionMarks.find((m) => m.questionId === questionId);
      const oldScore = oldQm?.score ?? 0;
      const oldCorrect = !!oldQm && oldQm.maxScore > 0 && oldQm.score >= oldQm.maxScore;
      const newCorrect = question.maxScore > 0 && newScore >= question.maxScore;

      const newQm = {
        questionId,
        score: newScore,
        maxScore: question.maxScore,
        feedback: oldQm?.feedback,
        teacherAdjusted: true,
      };
      let replaced = false;
      const newMarks = mark.questionMarks.map((m) => (m.questionId === questionId ? ((replaced = true), newQm) : m));
      if (!replaced) newMarks.push(newQm);
      const newTotal = newMarks.reduce((s, m) => s + m.score, 0);

      await storage.createMark({
        submissionId, totalScore: newTotal, feedback: mark.feedback,
        markedById: mark.markedById, questionMarks: newMarks,
      });
      const xpDelta = ((newCorrect ? 1 : 0) - (oldCorrect ? 1 : 0)) * XP_PER_CORRECT;
      if (xpDelta !== 0) {
        try { await adjustXp(submission.studentId, xpDelta); }
        catch (e) { console.error("XP adjust on override failed:", e); }
      }
      res.json({ success: true, score: newScore, totalScore: newTotal });
    } catch (error) {
      console.error("Override mark error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Class-wide per-question breakdown: how many students got each question wrong.
  app.get("/api/teacher/assignments/:id/question-stats", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;
      const id = parseInt(req.params.id);
      const assignment = await storage.getAssignment(id);
      if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });

      const submissions = await storage.getSubmissions({ assignmentId: id });
      const marks: NonNullable<Awaited<ReturnType<typeof storage.getMark>>>[] = [];
      for (const sub of submissions) {
        const mark = await storage.getMark(sub.id);
        if (mark) marks.push(mark);
      }
      const totalMarked = marks.length;

      const questions = Array.isArray(assignment.questions) ? assignment.questions.filter(Boolean) : [];
      const stats = questions.map((q, index) => {
        let wrong = 0, correct = 0, partial = 0;
        for (const mark of marks) {
          // A mark can exist without any per-question detail (marked by hand,
          // or saved before per-question marks existed). Treat that as "no
          // score recorded" rather than letting it throw.
          const questionMarks = Array.isArray(mark.questionMarks) ? mark.questionMarks : [];
          const qm = questionMarks.find((m) => m && m.questionId === q.id);
          const score = qm?.score ?? 0;
          const maxScore = typeof q.maxScore === "number" ? q.maxScore : 0;
          if (maxScore > 0 && score >= maxScore) correct++;
          else if (score <= 0) wrong++;
          else { partial++; wrong++; } // partial counts as "not fully correct"
        }
        return { index, questionId: q.id ?? `q${index}`, questionText: q.questionText ?? "", type: q.type || "written", maxScore: typeof q.maxScore === "number" ? q.maxScore : 0, wrong, correct, partial, total: totalMarked };
      });

      res.json({ success: true, totalMarked, stats });
    } catch (error) {
      console.error("Question stats error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Extend deadline for specific student
  app.post("/api/assignments/:id/extend-deadline", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const id = parseInt(req.params.id);
      const { studentId, newDueDate, reason } = req.body;
      
      if (!studentId || !newDueDate) {
        return res.json({ success: false, message: "Choose a student and a new due date." });
      }
      
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      
      await storage.extendDeadline(id, studentId, newDueDate, reason);
      res.json({ success: true, message: "Deadline extended successfully" });
    } catch (error) {
      console.error("Extend deadline error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Publish a draft — the one-tap action. From this moment the assignment is a
  // completely ordinary assignment: the assigned students see it, can submit,
  // and auto-marking works exactly as it does for one created the normal way.
  // Teacher-only, and publishing something already live is harmless (no-op).
  app.post("/api/assignments/:id/publish", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;

      const id = parseInt(req.params.id);
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }

      const updated = await storage.updateAssignment(id, { published: true } as any);
      res.json({ success: true, assignment: updated });
    } catch (error) {
      console.error("Publish assignment error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  app.patch("/api/assignments/:id/archive", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Delete assignment
  app.delete("/api/assignments/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const id = parseInt(req.params.id);
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      
      await storage.deleteAssignment(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete assignment error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Submissions
  app.get("/api/submissions", async (req, res) => {
    try {
      if (!(await requireTeacherOrStudent(req, res))) return;

      const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId as string) : undefined;
      const askedForStudentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;

      // A teacher may ask about any pupil, or about none and get everybody. A
      // pupil is pinned to their own work: whatever ?studentId= they put in the
      // address is replaced by their own id. This endpoint used to answer any
      // caller at all with every child's name and answers.
      const isTeacher = await isTeacherLoggedIn(req);
      const studentId = isTeacher ? askedForStudentId : req.session.studentId;

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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  app.get("/api/submissions/:id", async (req, res) => {
    try {
      // Refuse a logged-out caller before the lookup. Answering 404 for a
      // missing id but 401 for a real one would let someone count the
      // submissions in the school without logging in.
      if (!(await requireTeacherOrStudent(req, res))) return;

      const submission = await storage.getSubmission(parseInt(req.params.id));
      if (!submission) {
        return res.status(404).json({ success: false, message: "Submission not found" });
      }

      // Only a teacher, or the pupil who handed this in, may read it.
      if (!(await requireTeacherOrSelf(req, res, submission.studentId))) return;

      const student = await storage.getStudent(submission.studentId);
      const assignment = await storage.getAssignment(submission.assignmentId);

      // The results page reads its questions from here, so the same rule
      // applies: a pupil gets the model answers with their MARK, not with the
      // paper. See assignmentForStudent and GET /api/marks/:submissionId.
      const forTeacher = await isTeacherLoggedIn(req);

      res.json({
        ...submission,
        studentName: student?.fullName,
        assignment: assignment && !forTeacher ? assignmentForStudent(assignment) : assignment,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
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
      if (!(await requireTeacherOrStudent(req, res))) return;

      const validation = validateRequest(createSubmissionSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }
      
      const { assignmentId, studentId, answers } = validation.data;

      // Work can only be handed in for yourself. The studentId arrives in the
      // request body, so without this check anyone could submit answers in any
      // child's name.
      if (!(await requireTeacherOrSelf(req, res, studentId))) return;

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(403).json({ success: false, message: "That student ID was not recognised." });
      }
      
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) {
        return res.json({ success: false, message: "Assignment not found" });
      }

      // Belt and braces: a draft isn't released yet, so it can't be answered.
      if (isDraft(assignment)) {
        return res.json({ success: false, message: "Assignment not found" });
      }

      if (assignment.form !== student.form) {
        return res.status(403).json({ success: false, message: "This assignment is not set for your class." });
      }
      
      const existingSubmissions = await storage.getSubmissions({ assignmentId, studentId });
      if (existingSubmissions.length > 0) {
        return res.json({ success: false, message: "You have already handed this in." });
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

      // Primary students (Stages 3-6) earn a Treasure Hunt collectible for
      // completing an assignment. This runs once per assignment because a
      // duplicate submission is blocked above. Secondary students are not
      // affected at all. A reward failure must never break the submission,
      // so it is best-effort.
      let reward;
      if (isPrimaryForm(student.form)) {
        try {
          reward = await awardRandomCollectible(studentId, assignmentId);
        } catch (rewardError) {
          console.error("Award collectible failed (submission still saved):", rewardError);
        }
      }

      // XP + levels. Only auto-marked submissions earn XP here (that is when we
      // have an instant score). This runs after marking and is best-effort, so
      // it can never break or slow the marking response. First completion earns
      // 10 XP per correct answer plus a 25 completion bonus (subject to the
      // daily cap). A "correct answer" is a question awarded full marks.
      let xp;
      if (mark) {
        try {
          const correct = mark.questionMarks.filter((q) => q.score >= q.maxScore).length;
          const requested = correct * XP_PER_CORRECT + XP_COMPLETION_BONUS;
          xp = await awardXp(studentId, requested, {
            correct,
            perCorrect: XP_PER_CORRECT,
            completionBonus: XP_COMPLETION_BONUS,
          });
        } catch (xpError) {
          console.error("XP award failed (submission still saved):", xpError);
        }
      }

      // Dream World is retired, so completing an assignment no longer pays out
      // coins/bricks/wood/gems and the response carries no "resources" any
      // more. The awardResources() helper and every child's saved wallet are
      // left alone — we simply stop adding to them. XP, streaks and Treasure
      // Island rewards are unaffected.

      // Daily streak: completing a submission counts as activity for today, for
      // every student (primary and Forms). A level-up (reported by the XP award
      // above) also earns a streak freeze. Best-effort so it can never break or
      // slow the submission response.
      try {
        if (xp?.leveledUp) await grantFreezeForLevelUp(studentId);
        await recordActivity(studentId);
      } catch (streakError) {
        console.error("Streak update failed (submission still saved):", streakError);
      }

      res.json({ success: true, submission, mark: mark ?? undefined, reward, xp });
    } catch (error) {
      console.error("Create submission error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Update submission (allow students to edit before deadline or before marking)
  app.put("/api/submissions/:id", async (req, res) => {
    try {
      // Refuse a logged-out caller before the lookup, so the address bar cannot
      // be used to find out which submission ids exist. The owner check just
      // below then decides WHOSE work may be changed.
      if (!(await requireTeacherOrStudent(req, res))) return;

      const submissionId = parseInt(req.params.id);
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        return res.status(404).json({ success: false, message: "Submission not found" });
      }

      // Only a teacher, or the pupil who handed this in, may change it. There
      // was no owner check here at all, so one pupil could edit another's
      // answers by putting their submission id in the address.
      if (!(await requireTeacherOrSelf(req, res, submission.studentId))) return;

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

      // The score from the previous attempt — read BEFORE re-marking overwrites
      // it — so we can award an XP bonus when a retry beats it.
      const previousMark = await storage.getMark(submissionId);

      // Validate answers
      const { answers } = req.body;
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ success: false, message: "Answer at least one question before you hand in." });
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

      // XP for a retry: a flat 50 bonus only when this attempt beats the
      // student's previous score (subject to the daily cap). Best-effort, and
      // only for auto-marked assignments (where we have an instant score). When
      // the score isn't beaten we still return the current totals with awarded
      // 0 so the results screen can show a friendly "no new XP" message.
      let xp;
      if (mark) {
        try {
          const improved = mark.totalScore > (previousMark?.totalScore ?? -1);
          const requested = improved ? XP_IMPROVEMENT_BONUS : 0;
          xp = await awardXp(submission.studentId, requested, {
            improvementBonus: improved ? XP_IMPROVEMENT_BONUS : 0,
          });
        } catch (xpError) {
          console.error("XP award failed (submission still saved):", xpError);
        }
      }

      // Daily streak: a retry counts as activity today too (idempotent per day).
      // A level-up from the retry bonus also earns a freeze. Best-effort.
      try {
        if (xp?.leveledUp) await grantFreezeForLevelUp(submission.studentId);
        await recordActivity(submission.studentId);
      } catch (streakError) {
        console.error("Streak update failed (submission still saved):", streakError);
      }

      res.json({ success: true, submission: updatedSubmission, mark: mark ?? undefined, xp });
    } catch (error) {
      console.error("Update submission error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Marks
  app.get("/api/marks/:submissionId", async (req, res) => {
    try {
      // Same reasoning as above: log in first, then we look anything up.
      if (!(await requireTeacherOrStudent(req, res))) return;

      const submissionId = parseInt(req.params.submissionId);

      // A mark belongs to whoever handed the work in, so the submission decides
      // who may read it. Previously any caller could read any child's marks and
      // teacher feedback just by counting through the ids.
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ success: false, message: "Mark not found" });
      }
      if (!(await requireTeacherOrSelf(req, res, submission.studentId))) return;

      const mark = await storage.getMark(submissionId);
      if (!mark) {
        return res.status(404).json({ success: false, message: "Mark not found" });
      }

      // The model answers travel WITH the mark, and only with it.
      //
      // A mark exists only once the work has been marked, and this route
      // already refuses everybody except the teacher and the pupil who handed
      // the work in — so this is the one place a child can be shown what a good
      // answer looks like without it being available to copy beforehand.
      const assignment = await storage.getAssignment(submission.assignmentId);
      const modelAnswers: Record<string, string> = {};
      for (const q of assignment?.questions || []) {
        const model = (q as any).modelAnswer?.trim();
        if (model) modelAnswers[q.id] = model;
      }

      res.json({ ...mark, modelAnswers });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
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
      // Marking is staff work. Checking that the markedById in the body named
      // *a* teacher proved nothing — anyone could send a teacher's id and set
      // any child's marks.
      if (!(await requireTeacher(req, res))) return;

      const validation = validateRequest(createMarkSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }

      const { submissionId, totalScore, feedback, questionMarks } = validation.data;
      // The marker is whoever is logged in, not an id supplied by the caller.
      const markedById = req.session.teacherId!;
      
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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // "This student must be in a primary class (Stages 3-6)" — used by the
  // rewards endpoint below, and handed to the Dream World routes if that game
  // is ever brought back (see server/routes.dreamworld.ts).
  //
  // The 403 wording mentions Dream World even though the live caller is the
  // rewards endpoint. That is deliberate and unchanged from before — please
  // leave it as it is rather than "correcting" it.
  async function requirePrimaryStudent(studentId: number, req: Request, res: Response): Promise<Student | null> {
    // Whose data is this? A pupil may only reach their own; a teacher may
    // reach any. Checked before the record is fetched, so a wrong id cannot
    // even be probed for existence.
    if (!(await requireTeacherOrSelf(req, res, studentId))) return null;

    const student = await storage.getStudent(studentId);
    if (!student) {
      res.status(404).json({ success: false, message: "Student not found" });
      return null;
    }
    if (!isPrimaryForm(student.form)) {
      res.status(403).json({ success: false, message: "Dream World is for primary classes only" });
      return null;
    }
    return student;
  }

  // Student rewards endpoint — the collectibles a student has earned.
  // Primary-only (Stages 3-6), like the rest of the rewards/games features.
  app.get("/api/students/:id/rewards", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const rewards = await storage.getStudentRewards(student.id);
      res.json({ success: true, rewards });
    } catch (error) {
      console.error("Get student rewards error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // -------------------------------------------------------------------------
  // ─── Plays earned by doing homework (Stages 3-6) ─────────────────────────
  //
  // How many plays of each game this child has left today, and how they got
  // them. Behind requirePrimaryStudent like the games themselves, so Forms
  // never see it.
  app.get("/api/students/:id/plays", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const plays = await getAllPlayStates(student);
      res.json({ success: true, plays });
    } catch (error) {
      console.error("Plays error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Target Blaster (Stages 3-6) ─────────────────────────────────────────
  //
  // Six rounds of tap-the-right-target, built from questions the child has
  // already answered. Every endpoint goes through requirePrimaryStudent, so
  // Forms get a 403 and never see the game, and the answer key is never sent
  // to the browser — the server marks every round.

  // What the child needs before starting: how many plays they have, their
  // record, and whether there is anything to ask them at all.
  app.get("/api/students/:id/blaster", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const [plays, questionCount, best, active] = await Promise.all([
        getPlayState(student, "blaster"),
        blasterQuestionCount(student),
        storage.getBlasterBest(student.id),
        activeGame(student, "blaster"),
      ]);
      res.json({
        success: true,
        plays,
        questionCount,
        bestScore: best?.bestScore ?? 0,
        bestOutOf: best?.bestOutOf ?? 0,
        gamesPlayed: best?.gamesPlayed ?? 0,
        // A game they walked out of, waiting to be picked up. The start screen
        // offers to carry on with it instead of starting a new one.
        resumable: active.resumable,
        resumeSlot: active.resumeSlot,
      });
    } catch (error) {
      console.error("Blaster status error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Start a blast: six rounds of targets, with no answers attached. Spends one
  // play, and remembers the questions so the finish can be marked against them.
  //
  // Or, if they walked out of a game earlier, hands that one back at the round
  // it had reached and spends nothing — leaving a game does not use up the play.
  app.post("/api/students/:id/blaster/start", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;

      const started = await startBlast(student);

      // Nothing to ask yet: they have completed no playable work at all.
      if (!started) {
        return res.status(400).json({
          success: false,
          message: BLASTER_TEXT.nothingYet,
        });
      }

      // Out of plays is a refusal, not a failure — the page turns it into
      // "come back tomorrow" rather than something that looks broken.
      if ("outOfPlays" in started) {
        return res.status(200).json({
          success: false,
          outOfPlays: true,
          plays: started.plays,
          message: started.plays.earned === 0 ? PLAYS_TEXT.noneEarnedYet : PLAYS_TEXT.none,
        });
      }

      res.json({
        success: true,
        ...started.game,
        plays: started.plays,
        resumed: started.resumed,
        progress: started.progress,
        resumeSlot: started.resumeSlot,
      });
    } catch (error) {
      console.error("Blaster start error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Mark one round, so a target can burst right away.
  app.post("/api/students/:id/blaster/answer", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const { slot, ref, answerText, timedOut } = req.body ?? {};
      if (typeof ref !== "string" || typeof slot !== "number") {
        return res.status(400).json({ success: false, message: "Missing question." });
      }
      // Marked and written down by slot, so the round survives the tab closing
      // and cannot be played a second time.
      const result = await markBlastRound(student, slot, ref, String(answerText ?? ""), !!timedOut);
      if (!result) return res.status(404).json({ success: false, message: "That question isn't part of your game." });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Blaster answer error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Finish a blast: the server re-marks everything against the game it issued,
  // saves a new record, awards XP through the existing capped system, and
  // counts the game towards streaks.
  app.post("/api/students/:id/blaster/finish", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const result = await finishBlast(student, answers);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Blaster finish error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Penalty Shootout — a football quiz for primary classes (Stages 3-6).
  // Every endpoint goes through requirePrimaryStudent, so Forms get a 403 and
  // never see the game. The answer key is never sent to the browser: the
  // server marks each shot, using the existing auto-marker unchanged.
  // -------------------------------------------------------------------------

  // Which subjects this child can play, with their personal best in each.
  app.get("/api/students/:id/penalty/subjects", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const [subjects, active] = await Promise.all([
        listPenaltySubjects(student),
        activeGame(student, "penalty"),
      ]);
      // A game they walked out of, waiting to be picked up. The subject picker
      // offers to carry on with it instead of choosing a new subject.
      res.json({
        success: true,
        subjects,
        resumable: active.resumable,
        resumeSubject: active.resumable ? active.subject : null,
        resumeSlot: active.resumeSlot,
      });
    } catch (error) {
      console.error("Penalty subjects error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Start a game: 10 shots of questions-as-buttons, with no answers attached.
  //
  // Or, if they walked out of a game earlier, hands that one back at the shot it
  // had reached and spends nothing — leaving a game does not use up the play.
  // A game in flight wins over the subject just picked, so quitting a subject
  // that is going badly cannot be used to start a fresh one.
  app.post("/api/students/:id/penalty/start", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const subject = typeof req.body?.subject === "string" ? req.body.subject : "";
      if (!subject) return res.status(400).json({ success: false, message: "Pick a subject to play." });

      const started = await startPenaltyGame(student, subject);

      // Nothing to ask at all: this child has completed no playable work in
      // this subject. Not an error — just nothing to play yet.
      if (!started) {
        return res.status(400).json({
          success: false,
          message: "Finish an assignment in this subject first — the game is built from questions you have already answered.",
        });
      }

      // Out of plays. A refusal, not a failure: the page shows the "come back
      // tomorrow" line rather than something that looks broken.
      if ("outOfPlays" in started) {
        return res.status(200).json({
          success: false,
          outOfPlays: true,
          plays: started.plays,
          message: started.plays.earned === 0 ? PLAYS_TEXT.noneEarnedYet : PLAYS_TEXT.none,
        });
      }

      res.json({
        success: true,
        ...started.game,
        plays: started.plays,
        resumed: started.resumed,
        progress: started.progress,
        resumeSlot: started.resumeSlot,
      });
    } catch (error) {
      console.error("Penalty start error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Mark one shot, so the ball can fly in or the keeper can save it right away.
  app.post("/api/students/:id/penalty/answer", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const { subject, slot, ref, answerText } = req.body ?? {};
      if (typeof subject !== "string" || typeof ref !== "string" || typeof slot !== "number") {
        return res.status(400).json({ success: false, message: "Missing subject or question." });
      }
      // Marked and written down by slot, so the shot survives the tab closing
      // and cannot be taken a second time.
      const result = await markPenaltyShot(student, subject, slot, ref, String(answerText ?? ""));
      if (!result) return res.status(404).json({ success: false, message: "That question isn't part of your game." });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Penalty answer error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Finish a game: the server re-marks everything, saves a new best, awards XP
  // through the existing capped system, and counts the game towards streaks.
  app.post("/api/students/:id/penalty/finish", async (req, res) => {
    try {
      const student = await requirePrimaryStudent(parseInt(req.params.id), req, res);
      if (!student) return;
      const subject = typeof req.body?.subject === "string" ? req.body.subject : "";
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      if (!subject) return res.status(400).json({ success: false, message: "Missing subject." });

      const result = await finishPenaltyGame(student, subject, answers);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Penalty finish error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── The mastery map ──────────────────────────────────────────────────────
  //
  // What a child has shown they can do, skill by skill, worked out from marks
  // already stored. Nothing here marks anything or changes a score.
  //
  // requireTeacherOrSelf: a child may see their own map, and their teacher may
  // see it. Nobody else — it is a list of what one named child is weakest at,
  // which is not something another pupil should be able to read.
  app.get("/api/students/:id/mastery", async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      if (!(await requireTeacherOrSelf(req, res, studentId))) return;

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const mastery = await buildMastery(student);
      res.json({ success: true, mastery });
    } catch (error) {
      console.error("Mastery error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Report cards ─────────────────────────────────────────────────────────
  //
  // A term's marks assembled into a printable card. Everything here READS —
  // no mark is recalculated and no score altered.
  //
  // Teacher-only, all of it: a card names a child, their grades and how they
  // compare with the class, which is not something another pupil should read.
  // (A parent sees their own child through the parent portal, which has its own
  // wall; nothing here is reachable from a parent session.)

  /** The school's grade boundaries, or the Cambridge defaults. */
  app.get("/api/report-cards/boundaries", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;
      const stored = await storage.getReportSettings();
      res.json({
        success: true,
        boundaries: await reportBoundaries(),
        // So the screen can say whether the school has set its own yet.
        isDefault: !stored,
      });
    } catch (error) {
      console.error("Boundaries read error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  /** Set the school's grade boundaries. */
  app.put("/api/report-cards/boundaries", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;
      const teacherId = req.session.teacherId ?? null;

      const incoming = Array.isArray(req.body?.boundaries) ? req.body.boundaries : null;
      if (!incoming) {
        return res.status(400).json({ success: false, message: "Send the grade boundaries to save." });
      }

      // Refused rather than stored when they do not hold together. A gap or an
      // overlap mis-grades a child quietly, and nobody checks a grade that
      // looks plausible.
      const problems = validateBoundaries(incoming as GradeBoundary[]);
      if (problems.length > 0) {
        return res.status(400).json({ success: false, message: problems.join(" "), problems });
      }

      const saved = await storage.saveReportSettings(sortBoundaries(incoming as GradeBoundary[]), teacherId);
      res.json({ success: true, boundaries: saved.boundaries });
    } catch (error) {
      console.error("Boundaries save error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  /** Save a pupil's comment for one term. */
  app.put("/api/report-cards/comment", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;
      const teacherId = req.session.teacherId ?? null;

      const { studentId, termLabel, from, to, comment } = req.body ?? {};
      if (typeof studentId !== "number" || typeof comment !== "string") {
        return res.status(400).json({ success: false, message: "Choose a pupil and write a comment." });
      }
      if (typeof termLabel !== "string" || !termLabel.trim() || !from || !to) {
        return res.status(400).json({ success: false, message: "Name the term and give its dates." });
      }

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const saved = await storage.saveReportComment({
        studentId,
        termKey: termKeyFor(termLabel, String(from), String(to)),
        comment: comment.trim(),
        updatedById: teacherId,
      });
      res.json({ success: true, comment: saved.comment });
    } catch (error) {
      console.error("Report comment error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  /**
   * Report cards for a whole class, for a term.
   *
   * Built as a class even when only one card is wanted: a card carries the
   * class average beside the child's own, so every child's marks are read
   * anyway. `studentId` picks one out of the set rather than building it alone.
   */
  app.get("/api/report-cards", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const { form, termLabel, from, to, studentId } = req.query as Record<string, string | undefined>;
      if (!form) return res.status(400).json({ success: false, message: "Choose a class first." });
      if (!termLabel || !termLabel.trim()) {
        return res.status(400).json({ success: false, message: "Name the term." });
      }
      if (!from || !to) return res.status(400).json({ success: false, message: "Give the term's dates." });
      if (from > to) {
        return res.status(400).json({ success: false, message: "The term starts after it ends." });
      }

      const term = { label: termLabel.trim(), from, to };
      const cards = await buildClassReportCards(form, term);

      if (studentId) {
        const one = cards.find((c) => c.student.id === parseInt(studentId));
        if (!one) {
          return res.status(404).json({ success: false, message: "That pupil is not in this class." });
        }
        return res.json({ success: true, cards: [one] });
      }

      res.json({ success: true, cards });
    } catch (error) {
      console.error("Report cards error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Certificates & Awards ────────────────────────────────────────────────
  //
  // A child's certificates, with any newly earned milestones written down as a
  // side effect of asking. Nothing here marks anything, awards XP or changes a
  // streak — a certificate is a record of what already happened.
  //
  // requireTeacherOrSelf: a child sees their own, and their teacher can see
  // them. Nobody else.
  app.get("/api/students/:id/certificates", async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      if (!(await requireTeacherOrSelf(req, res, studentId))) return;

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const list = await certificatesFor(student);
      res.json({ success: true, certificates: list, student: { fullName: student.fullName, form: student.form } });
    } catch (error) {
      console.error("Certificates error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // One certificate, for the printable page.
  app.get("/api/students/:id/certificates/:certificateId", async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      if (!(await requireTeacherOrSelf(req, res, studentId))) return;

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const certificate = await certificateFor(student, parseInt(req.params.certificateId));
      if (!certificate) {
        return res.status(404).json({ success: false, message: "That certificate is not one of yours." });
      }

      res.json({
        success: true,
        certificate,
        student: { fullName: student.fullName, form: student.form },
      });
    } catch (error) {
      console.error("Certificate error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Most Improved, run by a teacher ──────────────────────────────────────
  //
  // Compare two periods in a subject and see who climbed furthest. Reading it
  // awards nothing; the award is the POST below, so a teacher can look without
  // committing.
  app.get("/api/reports/most-improved", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const { form, subject, beforeFrom, beforeTo, afterFrom, afterTo } = req.query as Record<string, string | undefined>;
      if (!form || !subject) {
        return res.status(400).json({ success: false, message: "Choose a class and a subject." });
      }
      if (!beforeFrom || !beforeTo || !afterFrom || !afterTo) {
        return res.status(400).json({ success: false, message: "Choose both periods." });
      }
      if (beforeFrom > beforeTo || afterFrom > afterTo) {
        return res.status(400).json({ success: false, message: "A period starts after it ends." });
      }

      const rows = await improvementFor(form, subject,
        { from: beforeFrom, to: beforeTo }, { from: afterFrom, to: afterTo });
      res.json({ success: true, rows });
    } catch (error) {
      console.error("Most improved error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  /** Award the Most Improved certificate to one child. */
  app.post("/api/reports/most-improved/award", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const teacherId = req.session.teacherId;
      if (!teacherId) {
        return res.status(401).json({ success: false, message: "Please sign in again." });
      }

      const { studentId, subject, beforePercent, afterPercent, from, to } = req.body ?? {};
      if (typeof studentId !== "number" || typeof subject !== "string") {
        return res.status(400).json({ success: false, message: "Choose a pupil and a subject." });
      }
      if (typeof beforePercent !== "number" || typeof afterPercent !== "number") {
        return res.status(400).json({ success: false, message: "That pupil has no figures to compare." });
      }

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      // The teacher who ran it is taken from the SESSION, never the body — the
      // same rule as everywhere else that records who did something.
      const certificate = await awardMostImproved(student, {
        subject, beforePercent, afterPercent,
        from: String(from ?? ""), to: String(to ?? ""),
        issuedById: teacherId,
      });

      if (!certificate) {
        return res.json({
          success: true, alreadyAwarded: true,
          message: "That pupil already has this certificate for these dates.",
        });
      }
      res.json({ success: true, certificate });
    } catch (error) {
      console.error("Most improved award error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Student stats endpoint
  app.get("/api/students/:id/stats", async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      if (!(await requireTeacherOrSelf(req, res, studentId))) return;

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

      // XP + streak for the dashboard bar. Included here (rather than separate
      // endpoints) so they load in the same request the dashboard already makes.
      // Both are best-effort AND always return a COMPLETE object — a brand-new
      // student with no XP/streak row, or a read that fails, still gets a fully
      // shaped default (never null/undefined), so the widgets can't crash.
      let xp = xpProgress(0, 0); // { totalXp:0, level:0, xpIntoLevel:0, xpForNextLevel:500, progressPercent:0 }
      try {
        const xpRow = await storage.getStudentXp(studentId);
        xp = xpProgress(xpRow?.totalXp ?? 0, xpRow?.level ?? 0);
      } catch (xpError) {
        console.error("XP read failed (returned defaults):", xpError);
      }

      // Reading the streak also settles it (a missed day is noticed even if the
      // student only opens the dashboard).
      let streak: Awaited<ReturnType<typeof refreshStreak>> = { current: 0, longest: 0, freezes: 0, maxFreezes: 2, notice: null };
      try {
        streak = await refreshStreak(studentId);
      } catch (streakError) {
        console.error("Streak read failed (returned defaults):", streakError);
      }

      res.json({
        success: true,
        stats: {
          completed: markedSubmissions.length,
          pending: submissions.filter(s => s.status === "SUBMITTED").length,
          averageScore,
          totalSubmissions: submissions.length,
          xp,
          streak,
        }
      });
    } catch (error) {
      console.error("Get student stats error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // -------------------------------------------------------------------------
  // Dev-only streak testing helpers.
  //
  // These let you simulate day changes and activity so streaks (freezes, resets,
  // milestones) can be tested without waiting real days. They are registered
  // ONLY when NOT running in production, so they can never affect real users.
  //
  // They are also teacher-only. Not being in production is not the same as
  // being private: a dev server is often reachable on the office network, and
  // these are not read-only toys — sim-date moves the clock for EVERYONE using
  // that server, and the other three rewrite any pupil's streak from an id in
  // the request body. One gate covers the whole /api/dev prefix, so a helper
  // added here later is locked down without anyone having to remember.
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/dev", async (req, res, next) => {
      try {
        // requireTeacher sends its own 401, so on failure there is nothing to
        // do but stop: not calling next() ends the request here.
        if (await requireTeacher(req, res)) next();
      } catch (error) {
        next(error);
      }
    });

    // Set (or clear) the simulated "today". Pass { "date": "YYYY-MM-DD" } to
    // pretend it is that day, or { "date": null } to go back to the real clock.
    app.post("/api/dev/streak/sim-date", (req, res) => {
      const { date } = req.body ?? {};
      if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, message: "Enter the date as YYYY-MM-DD." });
      }
      setSimulatedToday(date ?? null);
      res.json({ success: true, simulatedDate: getSimulatedToday(), today: streakToday() });
    });

    // See what "today" the streak system is currently using.
    app.get("/api/dev/streak/sim-date", (_req, res) => {
      res.json({ success: true, simulatedDate: getSimulatedToday(), today: streakToday() });
    });

    // Record activity for a student (same as completing a submission), then
    // return their fresh streak summary.
    app.post("/api/dev/streak/activity", async (req, res) => {
      const studentId = parseInt(req.body?.studentId);
      if (Number.isNaN(studentId)) {
        return res.status(400).json({ success: false, message: "Choose a student first." });
      }
      await recordActivity(studentId);
      const streak = await refreshStreak(studentId);
      res.json({ success: true, today: streakToday(), streak });
    });

    // Give a student a freeze (simulates the level-up reward), capped at 2.
    app.post("/api/dev/streak/freeze", async (req, res) => {
      const studentId = parseInt(req.body?.studentId);
      if (Number.isNaN(studentId)) {
        return res.status(400).json({ success: false, message: "Choose a student first." });
      }
      await grantFreezeForLevelUp(studentId);
      const streak = await refreshStreak(studentId);
      res.json({ success: true, streak });
    });

    // Wipe a student's streak back to nothing.
    app.post("/api/dev/streak/reset", async (req, res) => {
      const studentId = parseInt(req.body?.studentId);
      if (Number.isNaN(studentId)) {
        return res.status(400).json({ success: false, message: "Choose a student first." });
      }
      await resetStreak(studentId);
      res.json({ success: true });
    });
  }

  // -------------------------------------------------------------------------
  // Dream World — RETIRED.
  //
  // The game is no longer offered: its entry points are gone from the app and
  // assignments no longer pay out resources. This gate closes the back door,
  // so a saved bookmark or a hand-written request can't still play it. Every
  // Dream World endpoint answers 410 Gone ("this used to exist, and won't
  // again") rather than 404, which would wrongly suggest a broken link.
  //
  // Nothing is deleted: the dream_world table, every child's saved town, and
  // the whole route layer are kept. The endpoints themselves now live,
  // unwired, in server/routes.dreamworld.ts — that file explains how to bring
  // the game back.
  // -------------------------------------------------------------------------
  const DREAM_WORLD_PATH = /^\/api\/students\/\d+\/dreamworld(\/|$)/;
  const TEACHER_AWARDS_PATH = "/api/teacher/dream-world/awards";

  app.use((req, res, next) => {
    if (DREAM_WORLD_PATH.test(req.path) || req.path === TEACHER_AWARDS_PATH) {
      return res.status(410).json({
        success: false,
        retired: true,
        message: "Dream World has been retired. Saved towns are kept, but the game is no longer available.",
      });
    }
    next();
  });

  // Resources (textbooks, YouTube links, lesson plans)
  app.get("/api/resources", async (req, res) => {
    try {
      if (!(await requireTeacherOrStudent(req, res))) return;

      const form = req.query.form as string | undefined;
      const subject = req.query.subject as string | undefined;
      const type = req.query.type as string | undefined;
      // Teacher-only material is only ever included for an actual teacher.
      // Until this check existed a pupil could simply add ?teacherOnly=true.
      const teacherOnly = req.query.teacherOnly === 'true' && await isTeacherLoggedIn(req);

      const resources = await storage.getResources({ 
        form: form !== 'undefined' ? form : undefined, 
        subject: subject !== 'undefined' ? subject : undefined, 
        type: type !== 'undefined' ? type : undefined,
        teacherOnly: teacherOnly ? undefined : false, // If not teacher, filter out teacher-only
      });
      res.json(resources);
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  app.get("/api/resources/:id", async (req, res) => {
    try {
      if (!(await requireTeacherOrStudent(req, res))) return;

      const resource = await storage.getResource(parseInt(req.params.id));
      if (!resource) {
        return res.status(404).json({ success: false, message: "Resource not found" });
      }
      res.json(resource);
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
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
      if (!(await requireTeacher(req, res))) return;

      const validation = validateRequest(createResourceSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }

      // The author is the teacher who is logged in. The createdById the browser
      // sends is ignored: trusting it meant anyone could add a resource just by
      // naming a teacher's id.
      const resource = await storage.createResource({
        ...validation.data,
        createdById: req.session.teacherId!,
      });
      res.json({ success: true, resource });
    } catch (error) {
      console.error("Create resource error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      await storage.deleteResource(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Announcements
  app.get("/api/announcements", async (req, res) => {
    try {
      if (!(await requireTeacherOrStudent(req, res))) return;

      const form = req.query.form as string | undefined;
      const announcements = await storage.getAnnouncements(form !== 'undefined' ? form : undefined);
      res.json(announcements);
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
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
      if (!(await requireTeacher(req, res))) return;

      const validation = validateRequest(createAnnouncementSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }

      // The author is the logged-in teacher, not an id from the request body.
      const announcement = await storage.createAnnouncement({
        ...validation.data,
        createdById: req.session.teacherId!,
        expiresAt: validation.data.expiresAt ? new Date(validation.data.expiresAt) : null,
      });
      res.json({ success: true, announcement });
    } catch (error) {
      console.error("Create announcement error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  app.delete("/api/announcements/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      await storage.deleteAnnouncement(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Lessons (video and audio)
  app.get("/api/lessons", async (req, res) => {
    try {
      if (!(await requireTeacherOrStudent(req, res))) return;

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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
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
      if (!(await requireTeacher(req, res))) return;

      const validation = validateRequest(createLessonSchema, req.body);
      if (!validation.success) {
        return res.json({ success: false, message: validation.error });
      }

      // The author is the logged-in teacher, not an id from the request body.
      const lesson = await storage.createLesson({
        ...validation.data,
        createdById: req.session.teacherId!,
      });
      res.json({ success: true, lesson });
    } catch (error) {
      console.error("Create lesson error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  app.delete("/api/lessons/:id", async (req, res) => {
    try {
      // This used to look up the teacher who CREATED the lesson, which is a
      // row that always exists — so it refused nobody. It now checks who is
      // actually logged in.
      if (!(await requireTeacher(req, res))) return;

      const lesson = await storage.getLesson(parseInt(req.params.id));
      if (!lesson) {
        return res.status(404).json({ success: false, message: "Lesson not found" });
      }
      await storage.deleteLesson(lesson.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Reports API - Get performance data for charts
  app.get("/api/reports", async (req, res) => {
    try {
      // Whole-school performance figures for every named pupil: staff only.
      if (!(await requireTeacher(req, res))) return;

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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Daily Homework Submission Report
  app.get("/api/reports/daily", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

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
        return res.status(400).json({ success: false, message: "Choose a class and a date before running the report." });
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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Class skills, for a whole class ──────────────────────────────────────
  //
  // The teacher's side of the mastery map: which topics the class is weakest at
  // and which children need a hand. Worked out from marks already stored —
  // nothing here marks anything.
  //
  // Teacher-only. It names children and says what each is weakest at, which is
  // not something another pupil should be able to read.
  //
  // Takes `form` like the other class reports, so the pages behave alike.
  app.get("/api/reports/mastery", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const form = (req.query.form as string | undefined) || "";
      if (!form) {
        return res.status(400).json({ success: false, message: "Choose a class first." });
      }

      const mastery = await buildClassMastery(form);
      res.json({ success: true, mastery });
    } catch (error) {
      console.error("Class mastery error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── Games and homework, for a whole class ────────────────────────────────
  //
  // The teacher's side of the plays ledger: who is earning their game plays and
  // who the reward is not reaching. Teacher-only — it returns every child's
  // name in the class, so it must not be readable without a login.
  //
  // Takes the same parameters as the daily report on purpose (`form` plus
  // either `date` or `dateFrom`+`dateTo`), so the two pages behave the same
  // way. With no dates it answers for today.
  app.get("/api/reports/plays", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const { form, date, dateFrom: qFrom, dateTo: qTo } = req.query as {
        form?: string;
        date?: string;
        dateFrom?: string;
        dateTo?: string;
      };

      if (!form) {
        return res.status(400).json({ success: false, message: "Choose a class first." });
      }

      // Default to today, which is what a teacher opening this page wants.
      // streakToday() is the same CAT day the games and the streak use, so this
      // page can never disagree with them about which day it is.
      const today = streakToday();
      const dateFrom = date || qFrom || today;
      const dateTo = date || qTo || today;

      if (dateFrom > dateTo) {
        return res.status(400).json({ success: false, message: "That date range starts after it ends." });
      }

      const plays = await buildTeacherPlays(form, dateFrom, dateTo);
      res.json({ success: true, plays });
    } catch (error) {
      console.error("Teacher plays report error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // ─── The Question Bank ────────────────────────────────────────────────────
  //
  // A library of reusable questions (Stage 1 built the store; see
  // shared/question-bank.ts). Teacher-only, all four of them: these are the
  // school's answer keys, and a pupil who could read this endpoint could read
  // the answer to a question before it was ever set as homework.
  //
  // NOTHING here touches an assignment. Saving to the bank copies a question
  // into the library and leaves the paper alone; editing a bank question
  // changes only the library copy, so an assignment that already used it keeps
  // what it took and the children who answered it keep their marks.

  /** Browse and filter the library. */
  app.get("/api/question-bank", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const { subject, topic, form, difficulty, type, search, limit } = req.query as Record<string, string | undefined>;

      const questions = await storage.getBankQuestions({
        // Blank strings arrive from an untouched dropdown and mean "no filter",
        // not "match the empty string".
        subject: subject || undefined,
        topic: topic || undefined,
        form: form || undefined,
        difficulty: isDifficulty(difficulty || "") ? (difficulty as Difficulty) : undefined,
        type: isBankType(type || "") ? (type as BankType) : undefined,
        search: search || undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({ success: true, questions });
    } catch (error) {
      console.error("Question bank list error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  /** Save one question into the library. */
  app.post("/api/question-bank", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const body = req.body ?? {};

      // The author comes from the SESSION, never from the body. The same rule
      // as everywhere else that records who did something: an id in the body is
      // a value the browser chose, so believing it would let one teacher's name
      // be put on another's work.
      const teacherId = req.session.teacherId;
      if (!teacherId) {
        return res.status(401).json({ success: false, message: "Please sign in again." });
      }

      const question = { ...body, createdById: teacherId };

      // Checked here as well as in storage so the teacher gets the problems
      // back in plain words to fix, rather than a 500 from a thrown error.
      const problems = validateBankQuestion(question);
      if (problems.length > 0) {
        return res.status(400).json({ success: false, message: problems.join(" "), problems });
      }

      const saved = await storage.createBankQuestion(question);
      res.json({ success: true, question: saved });
    } catch (error) {
      console.error("Question bank save error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  /** Change a saved question — the library copy only. */
  app.patch("/api/question-bank/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const id = parseInt(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "That is not a question id." });
      }

      const existing = await storage.getBankQuestion(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "That question is not in the bank." });
      }

      // createdById and createdAt are not editable: who saved a question, and
      // when, stays true however often it is reworded afterwards.
      const { createdById, createdAt, id: _ignored, ...changes } = req.body ?? {};

      // Validated as MERGED with what is already saved, because a patch that
      // looks fine on its own can still leave an unmarkable question behind.
      const problems = validateBankQuestion({ ...existing, ...changes });
      if (problems.length > 0) {
        return res.status(400).json({ success: false, message: problems.join(" "), problems });
      }

      const updated = await storage.updateBankQuestion(id, changes);
      res.json({ success: true, question: updated });
    } catch (error) {
      console.error("Question bank edit error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  /** Remove a saved question from the library. */
  app.delete("/api/question-bank/:id", async (req, res) => {
    try {
      if (!(await requireTeacher(req, res))) return;

      const id = parseInt(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "That is not a question id." });
      }

      const existing = await storage.getBankQuestion(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "That question is not in the bank." });
      }

      // Only the library copy goes. Any assignment that already used this
      // question keeps its own copy, and the marks against it stand.
      await storage.deleteBankQuestion(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Question bank delete error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Grade Book API - joins assignments, students, submissions, marks.
  // Teacher-only: this returns every student's name and score, so it must not be
  // readable without a login (the submission review beside it is already
  // teacher-only, and the mismatch made a dead session look like missing data).
  app.get("/api/gradebook", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;

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

      // Get all marks in one go, keyed by submissionId. This used to ask the
      // database for one mark at a time — hundreds of round trips for a whole
      // school, which is what left the Grade Book spinning instead of loading.
      const markMap = await storage.getMarksBySubmissionIds(allSubmissions.map(s => s.id));

      const rows: Array<{
        studentId: number;
        studentName: string;
        form: string;
        assignmentId: number;
        assignmentTitle: string;
        subject: string;
        totalMarks: number;
        submissionId: number | null;
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

          // Every field is filled in even when the student has not submitted and
          // has no mark yet, so the page never has to guess at a missing value.
          rows.push({
            studentId: student.id,
            studentName: student.fullName ?? "Unknown student",
            form: student.form ?? "—",
            assignmentId: assignment.id,
            assignmentTitle: assignment.title ?? "Untitled assignment",
            subject: assignment.subject ?? "—",
            totalMarks: typeof assignment.totalMarks === "number" ? assignment.totalMarks : 0,
            submissionId: submission ? submission.id : null,
            submittedAt: submission?.submittedAt ? new Date(submission.submittedAt).toISOString() : null,
            score: typeof mark?.totalScore === "number" ? mark.totalScore : null,
            status,
          });
        }
      }

      res.json({ success: true, rows });
    } catch (error) {
      console.error("Gradebook API error:", error);
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Export grades as CSV. Teacher-only for the same reason as the Grade Book:
  // it is the whole school's marks in one file.
  app.get("/api/export/grades", async (req, res) => {
    try {
      const validatedEmail = await requireTeacherAuth(req, res);
      if (!validatedEmail) return;

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
      // All the marks in one request, for the same reason as the Grade Book:
      // asking per submission meant one round trip each, and the export timed
      // out on a full school.
      const exportMarkMap = await storage.getMarksBySubmissionIds(allSubmissions.map(s => s.id));
      
      // Build CSV data
      const rows: string[] = [];
      const headers = ['Student ID', 'Student Name', 'Form', 'Assignment', 'Subject', 'Topic', 'Score', 'Max Score', 'Percentage', 'Submitted At', 'Status'];
      rows.push(headers.join(','));
      
      for (const student of studentList) {
        for (const assignment of assignmentList) {
          const targetIds = assignment.targetStudentIds as number[] | null;
          if (targetIds && targetIds.length > 0 && !targetIds.includes(student.id)) continue;
          
          const submission = allSubmissions.find(s => s.studentId === student.id && s.assignmentId === assignment.id);
          const mark = submission ? exportMarkMap.get(submission.id) ?? null : null;
          
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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  // Data Science export — full student × assignment matrix with 25 columns
  app.get("/api/export/homework-datasci", async (req, res) => {
    try {
      // A full dump of every pupil's name, class, gender, marks and feedback.
      // Staff only — this answered anyone at all before.
      if (!(await requireTeacher(req, res))) return;

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
        res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
      }
    }
  });

  // ─── Comprehensive Export — Preview, Master CSV, and Logs ────────────────────

  // Auth guard: validates teacher via server-side session (teacherId set at login)
  async function requireTeacherAuth(req: Request, res: Response): Promise<string | null> {
    const teacherId = req.session?.teacherId;
    if (!teacherId) {
      res.status(401).json({ success: false, message: "You are not logged in as a teacher. Log in and try again.", redirect: "/teacher/login" });
      return null;
    }
    const teacher = await storage.getTeacher(teacherId);
    if (!teacher) {
      res.status(401).json({ success: false, message: "You are not logged in. Log in and try again.", redirect: "/teacher/login" });
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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
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
        res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
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
      res.status(500).json({ success: false, message: "Something went wrong at our end. Try again in a moment." });
    }
  });

  return httpServer;
}
