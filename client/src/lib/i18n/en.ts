/**
 * The English interface text — every fixed label, button and message.
 *
 * THE RULE THIS FILE EXISTS TO KEEP:
 *
 *   Only INTERFACE text lives here. Nothing a teacher typed ever does.
 *
 * A question's wording, an assignment title, a pupil's name, a teacher's
 * written feedback, a topic, an announcement — all of that is written by a
 * person and is shown exactly as they wrote it, in whatever language they wrote
 * it in. Translating it would put words in a teacher's mouth and change the
 * meaning of a question a child is being marked on.
 *
 * Some wording was already grouped for exactly this purpose, in `shared/`
 * ("so it can be swapped for Portuguese later without hunting through the
 * logic" — the note at the top of weekly-report.ts). Those groups are spread in
 * below rather than copied, so English still has ONE source and those files did
 * not have to move.
 *
 * `pt.ts` must have the same keys, and TypeScript enforces it — see index.tsx.
 */

import { CERTIFICATE_TEXT } from "@shared/certificates";
import { BLASTER_TEXT } from "@shared/blaster";
import { PLAYS_TEXT, RESUME_TEXT } from "@shared/game-plays";
import { CLASS_MASTERY_TEXT, MASTERY_TEXT } from "@shared/mastery";
import { BANK_TEXT } from "@shared/question-bank";
import { TEACHER_PLAYS_TEXT } from "@shared/teacher-plays";
import { OFFLINE_TEXT } from "@shared/offline";
import { OVERVIEW_TEXT } from "@shared/parent-overview";
import { PLAYS_PARENT_TEXT } from "@shared/parent-plays";
import { WORK_TEXT } from "@shared/parent-work";
import { REPORT_TEXT } from "@shared/weekly-report";

export const en = {
  /** The name of the language, in that language. Read on the toggle itself. */
  languageName: "English",

  /**
   * What to say when something fails to load.
   *
   * `thing` names what failed, and each phrase carries its own article. That
   * matters in Portuguese, where the article agrees with the noun — "a pauta"
   * but "os seus resultados" — so it cannot be glued on by the sentence.
   */
  /**
   * Subjects, by the code they are stored under.
   *
   * The codes are the data; these are only how they are READ. A subject the
   * school adds later that is not on this list falls back to tidying its own
   * code, so it still reads properly before anyone updates this — see
   * subjectName() in index.tsx.
   */
  /**
   * A date spelled out, the way it reads on a certificate somebody keeps.
   *
   * Not 09/09/2026: that is ambiguous between conventions. The two languages
   * order it differently too — "9 September 2026" against "9 de setembro de
   * 2026" — so the joining is part of the translation, not glued on outside.
   */
  dates: {
    months: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
    long: (day: number, month: string, year: number) => `${day} ${month} ${year}`,
  },

  subjects: {
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
  },

  /** The shelves a teacher files things under. */
  library: {
    filterBySubject: "Filter by subject",
    allSubjects: "All Subjects",
    filterByType: "Filter by type",
    allTypes: "All Types",
    textbooks: "Textbooks",
    videos: "Videos",
    lessonPlans: "Lesson Plans",
    other: "Other",
    video: "Video",
    audio: "Audio",
    noResources: "No resources available",
    noResourcesNote: "Your teacher hasn't added any resources for your form yet.",
    noLessons: "No lessons available",
  },

  errors: {
    couldNotLoad: (what: string) => `Could not load ${what}`,
    expired: "Your login has expired. Log in again to carry on.",
    noPermission: "You do not have permission to do that.",
    notFound: (what: string) => `${what} could not be found. It may have been deleted.`,
    conflict: "Someone else changed this first. Reload the page and try again.",
    serverProblem: "Something went wrong at our end. Try again in a moment.",
    connection: "Check your connection and try again.",
    logIn: "Log in",
    tryAgain: "Try again",

    thing: {
      generic: "this",
      yourResources: "your resources",
      yourLessons: "your lessons",
      yourResults: "your results",
      yourResult: "your result",
      yourHomework: "your homework",
      yourAssignments: "your assignments",
      thisHomework: "this homework",
      thisAssignment: "this assignment",
      pendingSubmissions: "pending submissions",
      gradeBook: "the Grade Book",
      theRegister: "the register",
      theReport: "the report",
      weeklyReport: "the weekly report",
      childDetails: "your child's details",
      childGamePlays: "your child's game plays",
      restOfChildInfo: "the rest of your child's information",
    },
  },

  common: {
    backToHome: "Back to Home",
    logout: "Logout",
    logOut: "Log out",
    loading: "Loading…",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    checkConnection: "Check your connection and try again.",
    tagline: "Quality Beyond Measure",
    language: "Language",
    dashboard: "Dashboard",
  },

  /** A child's own marked work, question by question. */
  results: {
    questionResults: "Question Results",
    question: (n: number) => `Question ${n}`,
    yourAnswer: "Your Answer:",
    noAnswerProvided: "No answer provided",
    modelAnswer: "What a good answer looks like:",
    modelAnswerNote:
      "Your teacher's example. Yours does not have to match it word for word — compare the two and see what you could add next time.",
    feedback: "Feedback:",
    awaitingReview: "Awaiting Review",
    beingReviewed: "Your submission is being reviewed by your teacher.",
    notFound: "Results not found",
    questionImageAlt: (question: number, image: number) => `Question ${question} image ${image}`,
    attachmentAlt: (n: number) => `Your attachment ${n}`,
  },

  /** The parent's own screens, beyond the dashboard. */
  parentWork: {
    mark: "Mark",
    questionsToGoOver: (n: number) => `${n} question${n !== 1 ? "s" : ""} to go over`,
  },

  login: {
    loggedIn: "Logged in",
    loginFailed: "Login failed",
    signIn: "Login",

    student: {
      title: "Student Login",
      description: "Enter your name and password to access your assignments",
      nameLabel: "Your Name",
      namePlaceholder: "Enter your name",
      passwordPlaceholder: "Enter your password",
      scanCard: "Scan QR card to log in",
      cardNotRecognised: "Card not recognised. Ask your teacher to check it.",
      firstTime: "First time logging in? Enter your name exactly as registered and create a password.",
      passwordSet: "Your password is set. Use it next time you log in.",
      welcome: (firstName: string) => `Welcome, ${firstName}`,
      welcomeBack: (fullName: string) => `Welcome back, ${fullName}!`,
      invalidCredentials: "Invalid credentials",
      tryAgain: "Check your name and password, then try again.",
    },

    teacher: {
      title: "Teacher Login",
      description: "Enter your credentials to access the teacher portal",
      expired: "Your login had expired, so please sign in again to carry on.",
      emailLabel: "Email",
      emailPlaceholder: "Enter your email",
      passwordPlaceholder: "Enter your password",
      tryAgain: "Check your email and password, then try again.",
      loggedInAs: (fullName: string) => `Logged in as ${fullName}`,
    },

    parent: {
      title: "Parent Login",
      description: "Enter the username and password the school gave you",
      expired: "Your login had expired. Log in again to carry on.",
      usernameLabel: "Username",
      usernamePlaceholder: "Enter your username",
      passwordPlaceholder: "Enter your password",
      welcome: (fullName: string) => `Welcome, ${fullName}.`,
      tryAgain: "Check your username and password, then try again.",
    },
  },

  studentDash: {
    portal: "Student Portal",
    available: "Available",
    handedIn: "Handed in",
    marked: "Marked",
    averageScore: "Average Score",
    announcements: "Announcements",
    urgent: "Urgent",
    important: "Important",

    treasureIsland: "Treasure Island",
    treasureIslandNote: "Collect all 12 treasures by finishing your homework.",
    penaltyShootout: "Penalty Shootout",
    penaltyShootoutNote: "Answer correctly to score a penalty and to save one.",
    targetBlaster: "Target Blaster",
    targetBlasterNote: "Tap the right target before it drifts away. Earn plays by finishing homework.",

    resources: "Learning Resources",
    resourcesNote: "Access textbooks and study materials",
    lessons: "Video & Audio Lessons",
    lessonsNote: "Watch and listen to recorded lessons",

    assignments: "Available Assignments",
    assignmentsNote: "Assignments waiting for your submission",
    late: "Late",
    dueSoon: "Due Soon",
    noHomework: "No homework due right now.",

    results: "Your Results",
    resultsNote: "Marked assignments with feedback",
    viewResults: "View Results",
    editSubmission: "Edit Submission",
    awaitingReview: "Awaiting Review",
    noResults: "No results yet. Hand in a piece of homework to see your first mark.",
    handedInOn: (date: string) => `Handed in: ${date}`,
    assignmentFallback: "Assignment",
    toComplete: "assignments to complete",
    awaitingReviewNote: "awaiting review",
    withFeedback: "with feedback",
    acrossAllMarked: "across all marked work",
    overdue: "OVERDUE",
    dueOn: (date: string) => `Due: ${date}`,
    marks: (n: number) => `${n} ${n === 1 ? "mark" : "marks"}`,
  },

  teacherDash: {
    portal: "Teacher Portal",
    title: "Dashboard",
    subtitle: "Manage your assignments and student submissions",

    totalStudents: "Total Students",
    totalAssignments: "Total Assignments",
    pendingReview: "Pending Review",
    marked: "Marked",
    totalSubmissions: "Total Submissions",
    missingToday: "Missing Submissions Today",
    missingTodayNote: "Due today or yesterday — students who haven't submitted yet",

    resources: "Learning Resources",
    resourcesNote: "Manage textbooks, videos, lesson plans",
    lessons: "Video & Audio Lessons",
    lessonsNote: "Upload or record lessons for students",
    students: "Manage Students",
    studentsNote: "Add, edit, or remove students",
    reports: "Reports & Analytics",
    reportsNote: "View charts and track progress",
    gradeBook: "Grade Book",
    gradeBookNote: "Track submissions and scores",
    exportData: "Export Data",
    exportDataNote: "Download filtered CSV reports",
    dailyReport: "Daily Report",
    dailyReportNote: "WhatsApp-ready submission snapshot",
    reportCards: "Report Cards",
    reportCardsNote: "Build a term's cards for a class",
    mostImproved: "Most Improved",
    mostImprovedNote: "Award the biggest climb in a subject",
    classSkills: "Class skills",
    classSkillsNote: "What to reteach, and who needs help",
    questionBank: "Question Bank",
    questionBankNote: "Saved questions, ready to reuse",
    gamePlays: "Games and homework",
    gamePlaysNote: "Who is earning their game plays",
    postAnnouncement: "Post announcement",
    postAnnouncementNote: "Send notices to students",

    announcementFormNote: "Send a notice to all students or a specific form",
    announcementTitle: "Title",
    announcementTitlePlaceholder: "Announcement title",
    announcementContent: "Content",
    announcementContentPlaceholder: "Write your announcement...",
    targetAudience: "Target Audience",
    allStudents: "All Students",
    /** "Stage 4" -> "Stage 4 Only". Built from the class name so the list of
     *  classes stays in one place. */
    onlyClass: (className: string) => `${className} Only`,
    priority: "Priority",
    priorityUrgent: "Urgent",
    priorityImportant: "Important",
    priorityNormal: "Normal",
    activeAnnouncements: "Active Announcements",

    filterByClass: "Filter by Class",
    allClasses: "All Classes",
    createAssignment: "Create assignment",
    createAnAssignment: "Create an assignment",
    draft: "Draft",
    draftNote: "Ready to publish — students can't see these yet",
    needsReview: "Needs Review",
    archived: "Archived Assignments",
    archivedNote: "These assignments are hidden from your active list",

    assignmentDeleted: "Assignment deleted",
    assignmentDeletedNote: "The assignment has been removed successfully.",
    assignmentNotDeleted: "Assignment not deleted",
    assignmentNotUpdated: "Assignment not updated",
    announcementPosted: "Announcement posted",
    announcementPostedNote: "Students can now see it.",
    announcementNotPosted: "Announcement not posted",
    announcementDeleted: "Announcement deleted",
    announcementNeedsBoth: "Add a title and content before posting.",
    assignmentArchived: "Assignment Archived",
    assignmentRestored: "Assignment Restored",

    assignments: "Assignments",
    assignmentsAll: "Your created assignments",
    assignmentsFor: (className: string) => `Assignments for ${className}`,
    pendingSubmissions: "Pending Submissions",
    pendingAll: "Submissions awaiting your review",
    pendingFor: (className: string) => `Submissions for ${className} awaiting review`,
    /** The class name is appended to a heading, e.g. "Assignments — Stage 4". */
    forClass: (className: string) => `— ${className}`,
    assignmentCount: (n: number) => `${n} assignment${n !== 1 ? "s" : ""}`,
    drafts: (n: number) => `Drafts (${n})`,
    archivedCount: (n: number) => `Archived Assignments (${n})`,

    marks: (n: number) => `${n} ${n === 1 ? "mark" : "marks"}`,
    editDraft: "Edit draft",
    editAssignment: "Edit assignment",
    deleteDraft: "Delete draft",
    deleteAssignment: "Delete assignment",
    archiveAssignment: "Archive assignment",
    movedToArchive: "The assignment has been moved to the archive.",
    restoredToActive: "The assignment has been restored to active assignments.",
    noAssignments: "No assignments yet",
    noAssignmentsFor: (className: string) => `No assignments for ${className}`,
    nothingToMark: "Nothing waiting to be marked.",
    nothingToMarkFor: (className: string) => `Nothing waiting to be marked for ${className}.`,
    /** Who an assignment was set for. Pupils' own names are never touched. */
    allOfClass: (className: string) => `All ${className}`,
    studentCount: (n: number) => `${n} ${n === 1 ? "student" : "students"}`,
  },

  submit: {
    backToDashboard: "Back to Dashboard",
    instructions: "Instructions",
    chooseOne: "Choose one",
    yourAnswer: "Your Answer",
    yourAnswerNumber: "Your Answer (number)",
    typeNumber: "Type a number",
    typeShortAnswer: "Type a short answer",
    typeAnswerHere: "Type your answer here...",
    attachFiles: "Attach Files (photos of handwritten work, PDFs, documents)",
    deadlinePassed: "Deadline passed:",
    deadlinePassedNote: "The deadline has passed but you can still submit.",
    notFound: "Assignment not found",

    thinAnswersTitle: "Some answers look incomplete",
    goBackImprove: "Go Back & Improve",
    submitAnyway: "Submit Anyway",

    notSaved: "Not saved",
    notHandedIn: "Not handed in",
    checkForm: "Check the form and try again.",

    handIn: "Hand in",
    handInAgain: "Hand in again",
    updateAnswers: "Update answers",
    handedIn: "Handed in",
    answersUpdated: "Answers updated",
    changesSaved: "Your changes have been saved.",
    teacherCanSee: "Your teacher can now see your work.",

    thinAnswersIntro: (count: number) =>
      count === 1
        ? "The following question has a very short answer. Teachers may not be able to give full marks for very brief responses."
        : "The following questions have a very short answer. Teachers may not be able to give full marks for very brief responses.",
    thinQuestionNumber: (n: number) => `Question ${n}`,
    thinCharacters: (chars: number) => `${chars} character${chars !== 1 ? "s" : ""} written`,
    thinMinimum: (minimum: number) => `(minimum ${minimum} recommended)`,
    thinFooter: "You can go back and add more detail, or submit as-is if you have uploaded a photo of your work.",

    true: "True",
    false: "False",
    uploading: "Uploading...",
    dropFilesHere: "Drop files here",
    dragAndDrop: "Drag & drop or click — images, PDFs, documents",
    canRetryQuiz: "You have already had a go at this quiz. Change your answers and hand in again for a fresh instant score.",
    alreadyMarked: "This assignment has been marked. You can no longer make changes.",
    canStillChange: "You have handed this in. You can change your answers until your teacher marks it.",
  },

  /**
   * The offline queue's one-line summary.
   *
   * summarise() in shared/offline.ts already works out the counts AND an English
   * sentence. The counts are what is used here; its sentence is left alone,
   * because it is what npm run check:offline reads.
   */
  sync: {
    summary: (waiting: number, blocked: number, sending: boolean): string => {
      if (sending) return waiting === 1 ? "Sending your work..." : `Sending ${waiting} pieces of work...`;
      if (waiting > 0) return waiting === 1 ? "1 item waiting to sync" : `${waiting} items waiting to sync`;
      if (blocked > 0) return blocked === 1 ? "1 item needs your attention" : `${blocked} items need your attention`;
      return "Everything is synced";
    },
  },

  parentDash: {
    portal: "Parent Portal",
    yourChild: "Your child",
    linkedNote: "This account is linked to one pupil, and shows only their information.",
    thisWeek: "This week",
    lastWeek: "Last week",
    nothingMarkedThisWeek: "No work has been marked for this week yet.",
    tapAnyPiece: "Tap any piece to see each question, your child's answer and the right answer.",
  },

  // --- Wording that was already grouped for this, in shared/ ---
  //
  // Spread in rather than copied: these files are the English source, are
  // imported by pages that are not translated yet, and one of them
  // (weekly-report) is also used to build the WhatsApp message.
  report: REPORT_TEXT,
  overview: OVERVIEW_TEXT,
  work: WORK_TEXT,
  plays: PLAYS_PARENT_TEXT,
  offline: OFFLINE_TEXT,
  mastery: MASTERY_TEXT,
  bank: BANK_TEXT,
  blaster: BLASTER_TEXT,
  gamePlays: PLAYS_TEXT,
  resume: RESUME_TEXT,
  teacherPlays: TEACHER_PLAYS_TEXT,
  classMastery: CLASS_MASTERY_TEXT,
  certificates: CERTIFICATE_TEXT,
};
