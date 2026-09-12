/**
 * Everything the server can say to a person, in one place, with a name.
 *
 * The problem this solves: the server used to compose finished English
 * sentences and send them down as `message`. The browser showed them exactly as
 * they arrived — so a Mozambican family using the app in Portuguese got a
 * Portuguese screen that answered them in English the moment anything went
 * wrong, which is precisely the moment wording matters most.
 *
 * The fix is the same shape the parent portal already uses: THE SERVER SENDS
 * DATA, THE CLIENT SUPPLIES THE WORDS. A refusal now carries a `code` naming
 * what happened, and the browser looks that code up in its own dictionary.
 *
 * The English sentence is still sent beside it, and that is deliberate:
 *
 *   * anything that is not our browser — a check script, curl, a future
 *     integration — still gets a readable answer with no lookup table;
 *   * a client that does not know a code yet falls back to it, so adding a
 *     message here can never produce a blank screen.
 *
 * To add one: put it here with a name, use say("thatName") in the route, and
 * `npm run check` will tell you Portuguese is missing it.
 */

export const SERVER_TEXT = {
  // --- Signing in ---
  notOnClassList: "That name is not on the class list. Enter your name exactly as your teacher registered it.",
  wrongPassword: "That password is not correct. Check it and try again.",
  wrongEmailOrPassword: "That email and password do not match. Check both and try again.",
  wrongUsernameOrPassword: "That username and password do not match. Check both and try again.",
  tooManyAttempts: "Too many attempts. Wait a few minutes and try again.",
  signInAgain: "Please sign in again.",
  notLoggedIn: "You are not logged in. Log in and try again.",
  notLoggedInTeacher: "You are not logged in as a teacher. Log in and try again.",
  notLoggedInParent: "You are not logged in as a parent. Log in and try again.",

  // --- Cards ---
  cardNotRecognised: "Card not recognised. Ask your teacher to check it.",
  cardNotLinked: "No pupil is linked to that card yet. Link it on the Students screen.",
  scanOrTypeCode: "Scan a card, or type the code from it.",
  studentIdNotRecognised: "That student ID was not recognised.",
  studentIdExists: "Student ID already exists",

  // --- Who may see what ---
  parentSeesOwnChild: "A parent account can only see its own child. Log in to the parent portal.",
  ownChildInfoOnly: "You can only see your own child's information.",
  ownChildWorkOnly: "You can only see your own child's work.",
  parentPortalReadOnly: "The parent portal is view-only.",
  workBelongsToSomebodyElse: "That work belongs to somebody else.",
  notYourCertificate: "That certificate is not one of yours.",
  notYourClass: "This assignment is not set for your class.",
  notInThisClass: "That pupil is not in this class.",

  // --- Things that are not there ---
  studentNotFound: "Student not found",
  assignmentNotFound: "Assignment not found",
  submissionNotFound: "Submission not found",
  markNotFound: "Mark not found",
  questionNotFound: "Question not found",
  resourceNotFound: "Resource not found",
  lessonNotFound: "Lesson not found",
  parentNotFound: "Parent account not found",
  townNotFound: "Town not found.",
  pupilOffRegister: "That pupil is no longer on the register. Ask the school to check.",
  workNoLongerAvailable: "That piece of work is no longer available.",
  notAValidPupil: "That is not a valid pupil.",
  notAValidParent: "That is not a valid parent account.",

  // --- Handing work in ---
  alreadyHandedIn: "You have already handed this in.",
  answerSomething: "Answer at least one question before you hand in.",
  cannotEditMarked: "Cannot edit a marked submission",
  notMarkedYet: "This submission hasn't been marked yet.",
  handMarkedCannotAutoRemark: "This question is marked by hand, so it can't be auto re-marked.",

  // --- The question bank ---
  questionNotInBank: "That question is not in the bank.",
  notAQuestionId: "That is not a question id.",

  // --- Filling a form in ---
  chooseAClass: "Choose a class first.",
  chooseAStudent: "Choose a student first.",
  chooseClassAndSubject: "Choose a class and a subject.",
  chooseClassAndDate: "Choose a class and a date before running the report.",
  choosePupilAndSubject: "Choose a pupil and a subject.",
  choosePupilAndComment: "Choose a pupil and write a comment.",
  chooseStudentAndDueDate: "Choose a student and a new due date.",
  chooseBothPeriods: "Choose both periods.",
  nameTheTerm: "Name the term.",
  nameTermAndDates: "Name the term and give its dates.",
  giveTermDates: "Give the term's dates.",
  sendGradeBoundaries: "Send the grade boundaries to save.",
  dateFormat: "Enter the date as YYYY-MM-DD.",
  scoreMustBeNumber: "Enter the score as a number.",
  invalidForm: "Invalid form value",
  usernameNoSpaces: "The username cannot contain spaces.",
  usernameTaken: "That username is already taken. Choose another.",

  // --- Dates that do not make sense ---
  termStartsAfterEnd: "The term starts after it ends.",
  periodStartsAfterEnd: "A period starts after it ends.",
  rangeStartsAfterEnd: "That date range starts after it ends.",

  // --- Report cards and awards ---
  alreadyHasCertificate: "That pupil already has this certificate for these dates.",
  noFiguresToCompare: "That pupil has no figures to compare.",

  // --- The games ---
  pickSubjectToPlay: "Pick a subject to play.",
  finishAssignmentFirst: "Finish an assignment in this subject first — the game is built from questions you have already answered.",
  notYourGameQuestion: "That question isn't part of your game.",
  missingQuestion: "Missing question.",
  missingSubject: "Missing subject.",
  missingSubjectOrQuestion: "Missing subject or question.",

  // --- Dream World ---
  dreamWorldRetired: "Dream World has been retired. Saved towns are kept, but the game is no longer available.",
  dreamWorldPrimaryOnly: "Dream World is for primary classes only",
  finishHomeworkBeforeBuilding: "Finish your overdue homework before you build.",
  notEnoughResources: "Not enough resources yet.",
  notEnoughToUpgrade: "Not enough resources to upgrade yet.",
  notEnoughToExpand: "Not enough resources to expand the plot yet.",
  buildingLocked: "That building isn't unlocked yet.",
  unknownBuilding: "Unknown building.",
  invalidTile: "Invalid tile.",
  spaceTaken: "That space is already taken.",
  doesNotFit: "That doesn't fit on the map.",
  nothingToRemove: "Nothing to remove there.",
  nothingToUpgrade: "Nothing to upgrade there.",
  cannotUpgradeThis: "This one can't be upgraded.",
  alreadyHighestLevel: "This is already at the highest level.",
  plotAlreadyLargest: "Your plot is already the largest size.",
  visitOwnClassOnly: "You can only visit towns in your own class.",
  renameOncePerWeek: "You can rename your town once a week. Try again in a few days.",

  // --- Things that went right ---
  deadlineExtended: "Deadline extended successfully",
  passwordReset: "Password reset. Student will set a new password on next login.",
  streakFreezeUsed: "Your streak freeze kept your streak going.",

  // --- When we are at fault ---
  serverError: "Something went wrong at our end. Try again in a moment.",
  serverErrorShort: "Server error",
} as const;

export type ServerMessageCode = keyof typeof SERVER_TEXT;

/**
 * The two fields a refusal carries: the name of what happened, and the English
 * sentence for anything that cannot look the name up.
 *
 * Spread into the reply so the rest of it stays exactly as it was:
 *
 *     res.status(404).json({ success: false, ...say("studentNotFound") });
 */
export function say(code: ServerMessageCode): { code: ServerMessageCode; message: string } {
  return { code, message: SERVER_TEXT[code] };
}

/**
 * What a FORM says when a field is not filled in properly.
 *
 * These live in the zod schemas in shared/schema.ts, which both sides use — the
 * browser to check a form before it is sent, the server to check what arrives.
 * So the schema carries the NAME of the problem rather than a sentence, and
 * each side turns it into words: FormMessage through the dictionary, and
 * validateRequest() through the English below, for a caller that is not our
 * browser.
 */
export const VALIDATION_TEXT = {
  yourNameRequired: "Your name is required",
  yourUsernameRequired: "Your username is required",
  parentNameRequired: "The parent's name is required",
  emailRequired: "Valid email is required",
  passwordRequired: "Password is required",
  passwordTooShort: "Password must be at least 6 characters",
  usernameTooShort: "Username must be at least 3 characters",
} as const;

export type ValidationCode = keyof typeof VALIDATION_TEXT;

/** The English for a code, or the string itself if it is not one of ours. */
export function validationText(code: string): string {
  return (VALIDATION_TEXT as Record<string, string>)[code] ?? code;
}
