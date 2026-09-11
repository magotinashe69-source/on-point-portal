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

import { CERTIFICATE_TEXT, IMPROVED_TEXT } from "@shared/certificates";
import { REPORT_TEXT as REPORT_CARD_TEXT } from "@shared/report-card";
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

  /** The register: pupils, their cards, and their parent accounts. */
  register: {
    addStudent: "Add New Student",
    editStudent: "Edit Student",
    form: "Form",
    studentId: "Student ID",
    studentIdPlaceholder: "e.g., F1-005",
    qrCode: "QR card code",
    qrCodePlaceholder: "e.g., G3-001",
    qrCodeNote: "The ID on the attendance card, from the Master Student Database. Leave blank if the pupil has no card yet.",
    fullName: "Full Name",
    fullNamePlaceholder: "Enter full name",
    gender: "Gender",
    male: "Male",
    female: "Female",
    active: "Active",
    filterByForm: "Filter by form",
    allStudents: "All Students",
    noStudents: "No students found",
    passwordSet: "Password Set",
    noPassword: "No Password",

    studentAdded: "Student added",
    studentNotAdded: "Student not added",
    studentUpdated: "Student updated",
    studentNotUpdated: "Student not updated",
    studentRemoved: "Student removed",
    passwordReset: "Password reset",
    passwordResetNote: "The student sets a new password next time they log in.",
    passwordNotReset: "Password not reset",

    weeklyReport: "Weekly report",
    weekOf: (week: string) => `Week of ${week}. Copy this and send it to the parent.`,
    copyAndSend: "Copy this and send it to the parent.",
    copyWhatsApp: "Copy WhatsApp Message",
    copied: "Copied",
    copiedNote: "Report copied to clipboard. Paste it into WhatsApp.",
    copyFailed: "Copy failed",
    copyFailedNote: "Please select and copy the text manually.",

    parentAccount: "Parent account",
    addParentAccount: "Add parent account",
    parent: "Parent",
    username: "Username",
    linkedTo: "Linked to",
    parentName: "Parent's name",
    parentNamePlaceholder: "e.g., Mrs Rudo Moyo",
    usernamePlaceholder: "e.g., rmoyo",
    password: "Password",
    passwordPlaceholder: "At least 6 characters",
    newPassword: "New password",
    newPasswordPlaceholder: "Leave blank to keep the current password",
    parentCreated: "Parent account created",
    parentCreatedNote: "Give the parent their username and password. They log in at /parent/login.",
    parentNotCreated: "Parent account not created",
    parentRemoved: "Parent account removed",
    parentRemovedNote: "The pupil and their work are untouched.",
    parentUpdated: "Parent account updated",
    parentUpdatedNote: "The new details take effect the next time they log in.",
    parentNotUpdated: "Parent account not updated",

    pasteStudents: "Paste students",
    pasteNote: "One pupil per line. They all join the class you pick here. Anyone already on the register is skipped.",
    pasteHint: "Add \u201c| Female\u201d or \u201c| Male\u201d after a name to set that pupil's gender. Student IDs are given out automatically.",
    pasteEmpty: "Nobody new to add — every name here is already on the register.",
    pasteClass: "Class",
    pasteGender: "Gender if not given",
    pasteNounOne: "student",
    pasteNounMany: "students",
    alreadyOnRegister: "Already on the register",
    noName: "No name",
    badGender: "Gender should be \"Male\" or \"Female\"",
  },

  /** The teacher's shelves: textbooks, videos and lesson plans. */
  teacherLibrary: {
    resources: "Learning Resources",
    resourcesNote: "Manage textbooks, videos, and lesson plans",
    addResource: "Add New Resource",
    addResourceNote: "Add a textbook, video, or lesson plan for your students",
    title: "Title",
    titlePlaceholder: "e.g., Grade 7 Mathematics Textbook",
    type: "Type",
    selectType: "Select type",
    subject: "Subject",
    selectSubject: "Select subject",
    noSubject: "No subject",
    form: "Form",
    allForms: "All Forms",
    allFormsOption: "All forms",
    classLabel: "Class",
    allClasses: "All classes",
    description: "Description (optional)",
    descriptionPlaceholder: "Brief description...",
    youtubeUrl: "YouTube URL",
    uploadFile: "Upload File",
    uploadDocument: "Upload Document",
    teacherOnly: "Teacher Only",
    teacherOnlyNote: "Hide this resource from students",
    noResources: "No resources found",
    noResourcesNote: "Add your first learning resource to get started",

    types: {
      TEXTBOOK: "Textbook",
      YOUTUBE: "YouTube Video",
      LESSON_PLAN: "Lesson Plan",
      OTHER: "Other",
    },

    resourceAdded: "Resource added",
    resourceNotAdded: "Resource not added",
    resourceDeleted: "Resource deleted",
    resourceNotDeleted: "Resource not deleted",

    pasteResources: "Paste resources",
    pasteNote: "One resource per line, with the link after a bar. They all share the type, subject and class you pick here. Links already saved are skipped.",
    alreadySaved: "This link is already saved",
    noTitle: "No title",
    noLink: "No link — put it after a \"|\"",
  },

  /** Video and audio lessons, and the in-page recorder. */
  teacherLessons: {
    title: "Video & Audio Lessons",
    subtitle: "Upload or record lessons for your students",
    addLesson: "Add New Lesson",
    addLessonNote: "Upload a video/audio file or record one directly",
    lessonTitle: "Title",
    titlePlaceholder: "e.g., Introduction to Algebra",
    description: "Description (optional)",
    descriptionPlaceholder: "Brief description of the lesson...",
    type: "Type",
    selectType: "Select type",
    selectSubject: "Select subject",
    form: "Form",
    selectForm: "Select form",
    lessonFile: "Lesson File",
    fileUploaded: "File uploaded successfully",
    duration: "Duration (optional)",
    noLessons: "No lessons yet",
    noLessonsNote: "Upload or record your first video or audio lesson",

    videoLesson: "Video Lesson",
    audioLesson: "Audio Lesson",

    lessonAdded: "Lesson added",
    lessonNotAdded: "Lesson not added",
    lessonDeleted: "Lesson deleted",
    recordingUploaded: "Recording uploaded",
    recordingNotUploaded: "Recording not uploaded",

    startRecording: "Start recording",
    stopRecording: (time: string) => `Stop recording (${time})`,
    cameraPreview: "Camera preview will appear here",
    permissionDenied: (what: string) =>
      `Permission denied. Please allow ${what} access in your browser settings.`,
    cameraAndMic: "camera and microphone",
    microphone: "microphone",

    pasteLessons: "Paste lessons",
    pasteNote: "One lesson per line, with a YouTube link or a link to the video or audio file after a bar. They all share the subject and class you pick here.",
    typeIfUnclear: "Type if unclear",
    alreadyALesson: "This file is already a lesson",
    unplayableLink: "Vimeo and Dailymotion links cannot be played here — upload the file, use a YouTube link, or link straight to the .mp4 or .mp3",
  },

  /** The Grade Book: every mark, filterable and printable. */
  gradeBook: {
    columns: {
      learner: "Learner",
      class: "Class",
      assignment: "Assignment",
      handedIn: "Handed in",
      mark: "Mark",
      date: "Date",
    },
    title: "Grade Book",
    subtitle: "Every mark across every assignment.",
    printTitle: "On Point Education Centre — Grade Book",
    generated: (date: string) => `Generated ${date}`,
    learner: "Learner",
    classLabel: "Class",
    assignment: "Assignment",
    handedIn: "Handed in",
    notHandedIn: "Not handed in",
    mark: "Mark",
    date: "Date",
    filters: "Filters",
    allAssignments: "All assignments",
    status: "Status",
    allStatuses: "All statuses",
    handedNotMarked: "Handed in, not yet marked",
    marked: "Marked",
    handedInFrom: "Handed in from",
    handedInTo: "Handed in to",
    perQuestion: "Per-question breakdown",
    noMarkedYet: "No marked submissions yet.",
    loading: "Loading the Grade Book",
    nothingMatches: "Nothing matches those filters",
    noMarks: "No marks yet",
    openSubmission: "Open this submission",
    backToDashboard: "Back to dashboard",
  },

  /** Reports and charts. */
  reports: {
    filterByForm: "Filter by Form",
    allForms: "All Forms",
    allFormsNote: "All forms",
    totalStudents: "Total Students",
    classAverage: "Class average",
    subjects: "Subjects",
    activeSubjects: "Active subjects",
    averagePercent: "Average %",
    averageScore: "Average Score",
    averageScoreLower: "Average score",
    studentPerformance: "Student Performance",
    studentPerformanceNote: "Average percentage by student",
    noStudentData: "No student data available",
    subjectPerformance: "Subject Performance",
    subjectPerformanceNote: "Average score by subject",
    noSubjectData: "No subject data available",
    formComparison: "Form Comparison",
    formComparisonNote: "Performance comparison between forms",
    noFormData: "No form data available",
    studentDetails: "Student Details",
    studentDetailsNote: "Individual student performance breakdown",
    student: "Student",
    form: "Form",
    handedIn: "Handed in",
    marked: "Marked",
    score: "Score",
    status: "Status",
    noReportData: "No report data available yet.",

    bandTop: "80% and above",
    bandGood: "Good",
    bandAverage: "Average",
    bandNeedsHelp: "Needs Help",
  },

  /** The Grade Book: every mark, filterable and printable. */

  /** Reports and charts. */

  /** The daily WhatsApp snapshot. */
  dailyReport: {
    subtitle: "Generate a WhatsApp-ready submission snapshot for any class and date.",
    filters: "Report Filters",
    date: "Date",
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    customDate: "Custom Date",
    classLabel: "Class",
    selectClass: "Select a class",
    selectClassPlaceholder: "Select a class…",
    subject: "Subject",
    allSubjects: "All Subjects",
    copyWhatsApp: "Copy WhatsApp Message",
    copiedToClipboard: "Copied to clipboard",
    noneSubmitted: "None submitted for this period.",
    messageForParents: "Message for Parents",
    parentThanks: "Dear Parents, thank you to all learners who completed today's homework. Your effort is noticed and appreciated.",
    parentChase: "Learners who did not submit must please complete the work as soon as possible. Homework is part of academic discipline and helps us track progress. We strongly encourage parents to support their children daily so they do not fall behind.",
    parentLowAttendance: "Those with low homework attendance are kindly reminded to improve and catch up. Consistent homework completion will help learners perform better and avoid being left behind.",

    whatsHeading: "*Homework submission report*",
    whatsDate: (date: string) => `Date: ${date}`,
    whatsClass: (form: string) => `Class: ${form}`,
    whatsSubject: (subject: string) => `Subject: ${subject}`,
    whatsHandedIn: "*Handed in:*",
    whatsNobody: "No one handed in during this period.",
    whatsDidNot: "*Did not hand in:*",
    whatsEveryone: "Everyone handed in.",
    whatsNeedsToImprove: "*Needs to improve homework attendance:*",
    whatsMessageForParents: "*Message for parents:*",
    whatsSignOff: "— On Point Education Centre",
  },

  /** One assignment, with who has handed in and who has not. */
  assignmentDetail: {
    updated: "Assignment updated successfully",
    notUpdated: "Failed to update assignment",
    archived: "Assignment archived",
    restored: "Assignment restored",
    archive: "Archive",
    unarchive: "Unarchive",
    deadlineExtended: "Deadline extended successfully",
    deadlineNotExtended: "Failed to extend deadline",
    theDueDate: "the due date",
    messageCopied: "Message copied to clipboard",
    extendDeadline: "Extend deadline for a student",
    extendDeadlineNote: "Give a specific student more time",
    student: "Student",
    selectStudent: "Select a student",
    newDueDate: "New Due Date",
    reason: "Reason (optional)",
    reasonPlaceholder: "e.g., Medical leave, family emergency",
    currentExtensions: "Current Extensions",
    instructions: "Instructions",
    questions: "Questions",
    allForms: "All Forms",
    allFormsLower: "All forms",
    submitted: "Students who have submitted their work",
    noSubmissions: "No submissions yet",
    needsReview: "Needs Review",
    notSubmitted: "Students who haven't submitted yet",
    everyoneHandedIn: "Everyone has handed in.",
    notFound: "Assignment not found",
    /** The note a teacher copies to send a parent. Their child's name, the
     *  paper's title and its subject are the teacher's own and are not touched. */
    notifyParent: (childName: string, title: string, subject: string, form: string, dueDate: string) =>
      `Dear Parent of ${childName},\n\nYour child has not yet submitted the assignment "${title}" (Subject: ${subject}, Form: ${form}) which was due on ${dueDate}.\n\nPlease follow up with your child and ensure the work is submitted as soon as possible.\n\nThank you,\nOn Point Education Centre`,
  },

  /** The CSV export. */
  exportData: {
    title: "Export Data",
    complete: "Export complete",
    didNotFinish: "Export did not finish",
    sessionExpired: "Your session has expired.",
    step1: "Step 1 — Choose what to export",
    step2: "Step 2 — Set filters",
    step3Note: "Live count of what will be included in the export",
    fullMaster: "Full Master Export",
    fullMasterNote: "Every student, every assignment, every subject.",
    byTerm: "By Term",
    byTermNote: "Filter by school term (Jan–Mar = Term 1, Apr–Jun = 2, Jul–Sep = 3, Oct–Dec = 4)",
    byClassSubject: "By Class & Subject",
    byClassSubjectNote: "Filter by a specific class level and/or subject",
    byAssignment: "By Assignment",
    byAssignmentNote: "Every student's result for one specific assignment — ideal for parent reporting",
    term: "Term",
    selectTerm: "Select term...",
    classOptional: "Class (optional)",
    allClasses: "All classes",
    classLevel: "Class level",
    subject: "Subject",
    allSubjects: "All subjects",
    assignment: "Assignment",
    selectAssignment: "Select an assignment...",
    archivedSuffix: "(archived)",
    calculating: "Calculating...",
    students: "Students",
    assignments: "Assignments",
    totalRows: "Total CSV rows",
    onTime: "On time:",
    late: "Late:",
    notSubmitted: "Not submitted:",
    selectFilters: "Select filters above to see a preview.",
    noMatch: "No data matches the current filters.",
    generating: "Generating CSV...",
    download: "Download Master CSV",
    history: "Export History",
    historyNote: "Last 20 exports from this account",
    noExports: "No exports yet. Download your first CSV above.",
    dateExported: "Date exported",
    filter: "Filter",
    filterValue: "Filter value",
    records: "Records",
  },

  /** One submission, opened question by question for the teacher. */
  review: {
    types: {
      multiple_choice: "Multiple choice",
      true_false: "True / False",
      numeric: "Number",
      short_text: "Short text",
      written: "Written (hand-marked)",
    },
    enterNumber: "Enter a number",
    markUpdated: "Mark updated",
    couldNotUpdate: "Couldn't update",
    tryAgainPlease: "Please try again.",
    expired: "Your teacher login has expired. Please sign in again to view this submission.",
    gone: "This submission no longer exists. It may have been deleted.",
    serverProblem: "The server had a problem loading this submission.",
    couldNotLoad: "Couldn't load this submission. Please check your connection and try again.",
    goToLogin: "Go to login",
    tryAgain: "Try again",
    backToGradeBook: "Back to Grade Book",
    allCorrect: "All answers correct",
    missed: (questions: string) => `Missed ${questions}`,
    partialSuffix: " (partial)",
    total: "total",
    awaitingMark: "awaiting mark",
    teacherAdjusted: "Teacher-adjusted",
    partial: "Partial",
    studentsAnswer: "Student's answer",
    noAnswerGiven: "No answer given",
    noAnswerData: "Answer data not recorded",
    modelAnswer: "Model answer",
    correctAnswer: "Correct answer:",
    override: "Override:",
  },

  /** Marking a submission by hand. */
  marking: {
    title: "Mark Submission",
    alreadyMarked: "Already Marked",
    needsReview: "Needs Review",
    marked: "Submission marked",
    markedNote: "The student can now see the mark.",
    notSaved: "Mark not saved",
    aiAlert: "AI Detection Alert",
    aiScore: "AI Score:",
    aiScoreNote: (percent: number) => `${percent}% likelihood of AI-generated content`,
    quickMark: "Quick Mark:",
    full: "Full",
    half: "Half",
    zero: "Zero",
    highlight: "Highlight:",
    studentsAnswer: "Student's Answer:",
    noTextAnswer: "No text answer provided",
    feedback: "Feedback (optional)",
    feedbackPlaceholder: "Feedback for this question...",
    overallFeedback: "Overall Feedback",
    generalComments: "General Comments",
    generalCommentsPlaceholder: "Provide overall feedback for the student...",
    updateMark: "Update Mark",
    saveMark: "Save mark",
    notFound: "Submission not found",
  },

  /** Writing a paper: the questions, their answer keys, and the marks. */
  createAssignment: {
    editTitle: "Edit Assignment",
    createTitle: "Create New Assignment",
    editNote: "Change any field or question. Total Marks updates as you go.",
    createNote: "Create an assignment with questions for your students. You can add images to questions.",

    subject: "Subject",
    selectSubject: "Select subject",
    form: "Form",
    selectForm: "Select form",
    topic: "Topic (Optional)",
    topicPlaceholder: "e.g., Algebra, Photosynthesis, World War II",
    title: "Title",
    titlePlaceholder: "e.g., Week 1 Maths Homework",
    instructions: "Instructions",
    instructionsPlaceholder: "Provide instructions for students...",
    dueDate: "Due Date",
    assignTo: "Assign To",
    questions: "Questions",

    moveUp: "Move up",
    moveDown: "Move down",
    remark: "Re-mark",
    remarkNote: "Save changes and re-mark this question for students who have already handed in",
    duplicate: "Duplicate",
    duplicateNote: "Make another question with these same settings",
    saveToBank: "Save to bank",
    saveToBankNote: "Save a copy of this question to the Question Bank for reuse",
    addImage: "Add Image",

    questionText: "Question Text",
    questionTextPlaceholder: "Enter your question...",
    answerType: "Answer Type",
    maxScore: "Max Score",
    optional: "(optional)",
    modelAnswerNote: "What a good answer looks like, in your own words.",
    answerKey: "Answer Key (used for instant marking)",
    optionsNote: "Add the options and tap the circle to mark the correct one.",
    markAsCorrect: "Mark as correct",
    correctAnswer: "Correct answer:",
    trueLabel: "True",
    falseLabel: "False",
    correctNumber: "Correct number",
    tolerance: "Tolerance (±)",
    tolerancePlaceholder: "e.g. 0.05 (0 = exact)",
    acceptedNote: "Any of these count as correct. Matching ignores capital letters and extra spaces.",
    explanation: "Explanation (optional)",
    explanationPlaceholder: "A one-line note shown with the correct answer",

    types: {
      multiple_choice: "Multiple choice",
      true_false: "True / False",
      numeric: "Number",
      short_text: "Short text",
      written: "Written (marked by hand)",
    },

    pasteQuestions: "Paste questions",
    pasteNote: "One question per line, with the answer after a bar. Each line becomes a Short text question worth 1 mark, marked automatically.",
    pastedAdded: (n: number) => `Added ${n} question${n === 1 ? "" : "s"}`,
    pastedAddedNote: "Each one is Short text, 1 mark, with its answer key filled in.",
    noQuestionText: "No question text",
    noAnswer: "No answer — put it after a \"|\"",

    fromBank: (n: number) => (n === 1 ? "1 question added from the bank" : `${n} questions added from the bank`),
    fromBankNote: "They are copies — editing the saved question later will not change this paper.",

    attachments: "Attachments (optional)",
    attachmentsNote: "Upload reference materials for students — images, PDFs, Word documents",
    uploadReference: "Upload Reference Files",

    noStudentsSelected: "No students selected",
    noStudentsSelectedNote: "Select at least one student, or choose all students.",
    updated: "Assignment updated",
    draftSaved: "Draft saved",
    created: "Assignment created",
    updatedNote: "Your changes have been saved.",
    draftSavedNote: "It is hidden from students until you tap Publish.",
    createdNote: "Your assignment has been created successfully.",
    notUpdated: "Assignment not updated",
    notCreated: "Assignment not created",
    checkForm: "Check the form and try again.",
    remarked: "Re-marked",
    couldNotRemark: "Couldn't re-mark",
    tryAgainPlease: "Please try again.",

    saveDraft: "Save Draft",
    saveChanges: "Save Changes",
    createButton: "Create Assignment",

    /** The warning above a paper people have already sat. */
    alreadyHandedIn: (n: number) =>
      `${n} student${n === 1 ? " has" : "s have"} already handed in.`,
    marksUnchangedNote: "Changes to questions will not alter marks already given. To update a fixed answer, use the Re-mark button on that question.",
    questionNumber: (n: number) => `Question ${n}`,
    questionImageAlt: (question: number, image: number) => `Question ${question} image ${image}`,
    optionPlaceholder: (n: number) => `Option ${n}`,
    acceptedPlaceholder: (n: number) => `Accepted answer ${n}`,
    pasteExample: "What is the capital of Zimbabwe? | Harare\nHow many sides does a triangle have? | 3 | three\nWho wrote Nervous Conditions? | Tsitsi Dangarembga",
  },

  /** Writing a paper: the questions, their answer keys, and the marks. */

  /** The public front page, before anyone signs in. */
  landing: {
    home: "Home",
    subjects: "Subjects",
    games: "Games",
    rewards: "Rewards",
    logIn: "Log In",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    yearGroups: "Year groups",
    backpack: "Backpack",
    screenshotAlt: "The assignment screen on a phone: a list of maths questions, each in its own card with the marks available beside it — place value, number sequences, the faces of a cube, multiplication and addition.",

    subjectTiles: {
      maths: "Maths",
      english: "English",
      science: "Science",
      business: "Business",
      computing: "Computer Science",
      more: "More subjects",
    },

    features: {
      homework: "Homework",
      homeworkNote: "See your assignments and hand in your work.",
      quizzes: "Practice Quizzes",
      quizzesNote: "Get an instant score the moment you finish.",
      rewards: "Earn Rewards",
      rewardsNote: "Earn XP and awards for work you hand in.",
      games: "Games",
      gamesNote: "Practise by playing — penalty shootout, treasure island and dream world.",
    },
  },

  /** Treasure Island. */
  treasure: {
    title: "Treasure Island",
    chest: "Your Treasure Chest",
    log: "Your Treasure Log",
    next: "Your next treasure. Finish an assignment to open it.",
    locked: "Locked. Finish more assignments to reach this one.",
    unlockNext: "Finish another assignment to unlock this treasure.",
    mapAlt: "Treasure island map showing which treasures you have collected",
  },

  /** Small shared controls. */
  controls: {
    close: "Close",
    cancel: "Cancel",
    previous: "Previous",
    next: "Next",
  },

  /** Dream World: the town a child builds from finished homework. */
  dreamWorld: {
    nameYourTown: "Name your town",
    save: "Save",
    rename: "Rename",
    nameIt: "Name it",
    viewCertificate: "View and print your certificate",
    homeworkFirst: "Homework first",
    buildShop: "Build shop",
    paused: "Building is paused until your homework is done.",
    tapEmptyTile: "Now tap an empty tile to build. Tap a building to remove it.",
    tapBuilding: "Tap an unlocked building, then tap a tile.",
    decoration: "Decoration",
    highestLevel: "Highest level reached",
    newBuilding: "New building unlocked!",
    startBuilding: "Start building",
    locked: "Locked",
  },

  /** Attaching files, and publishing a draft. */
  attachments: {
    hint: "Images, PDFs, Word documents, text files",
    attachFiles: "Attach Files",
    attachments: "Attachments",
    uploading: "Uploading...",
    dropFilesHere: "Drop files here",
  },

  publish: {
    published: "Published",
    publishedNote: (title: string, form: string) => `"${title}" is now visible to ${form}.`,
    notPublished: "Assignment not published",
  },

  /** Visiting a classmate's town, and the last few small pieces. */
  visiting: {
    backToMyTown: "Back to My Town",
    backToTowns: "Back to Towns",
    visitTowns: "Visit towns",
    nobodyYet: "No one in your class has started a town yet. Build yours and classmates will be able to visit it.",
    visitingNote: "You are visiting. You cannot change this town.",
    youEarned: "You earned",
    treasureFound: "Treasure found!",
    addedToCollection: "Added to your Treasure Island collection.",
    scanYourCard: "Scan your card",
    toggleTheme: "Toggle theme",
    notFound: "404 Page Not Found",
    comingSoon: "Coming soon",
  },

  /** Penalty Shootout, and the question bank's own screen. */
  penalty: {
    title: "Penalty Shootout",
    nothingToPlay: "Nothing to play yet",
    orPickSubject: "Or pick a subject:",
    pickSubject: "Pick a subject:",
    newBadge: "New",
    keeperRound: "Keeper round",
    strikerRound: "Striker round",
    saveWord: "Save",
    shotWord: "Shot",
    correct: "Correct!",
    pickYourCorner: "Now pick your corner:",
    goalConceded: "Goal conceded",
    savedByKeeper: "Saved by the keeper",
    correctAnswerWas: "The correct answer was",
    greatSave: "Great save!",
    goodStrike: "Good strike!",
    newBest: "New personal best!",
    beatOldRecord: (best: number, outOf: number, subject: string) =>
      `You beat your old record of ${best}/${outOf} in ${subject}.`,
    firstRecord: (subject: string) => `Your first record in ${subject}. Try to beat it next time.`,
    howYouDid: "How you did",
    penaltiesScored: "Penalties scored",
    savesMade: "Saves made",
    playAgain: "Play again",
    pitchAlt: "Football pitch with a goal",
    goalAgainst: "Goal against",
    corners: {
      left: "Left",
      middle: "Middle",
      right: "Right",
    },
  },

  bankScreen: {
    removed: "Removed from the question bank",
    updated: "Question updated",
    anySubject: "Any subject",
    anyClass: "Any class",
    anyDifficulty: "Any difficulty",
    anyTopic: "Any topic",
    confirmRemove: "Remove this question from the bank?",
    keepIt: "Keep it",
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
  reportCard: REPORT_CARD_TEXT,
  mostImproved: IMPROVED_TEXT,
  blaster: BLASTER_TEXT,
  gamePlays: PLAYS_TEXT,
  resume: RESUME_TEXT,
  teacherPlays: TEACHER_PLAYS_TEXT,
  classMastery: CLASS_MASTERY_TEXT,
  certificates: CERTIFICATE_TEXT,
};
