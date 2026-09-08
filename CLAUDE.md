# CLAUDE.md

Guidance for working in this repository.

## What this project is

The **On Point Education Centre Homework & Learning Portal** — a web app where
**teachers** create homework assignments and **students** submit answers and
receive marks and feedback. It serves a Zimbabwe-based school.

## House style (branding)

- **Primary colour — Navy:** `#1F3864`
- **Accent colour — Gold** (use for highlights, buttons, accents)
- **Font:** clean sans-serif, Calibri-style
- **School tagline:** "Quality Beyond Measure"

Keep the look clean, friendly, and easy to read for a school setting: large clear
buttons, readable text, consistent spacing.

## User roles

There are **three roles**:

- **Student** — views assignments, submits answers (including photos of handwritten
  work), and views marks and feedback.
- **Teacher** — creates/edits assignments, manages students, marks submissions,
  posts announcements, and adds learning resources and lessons. On a written
  (hand-marked) question they can also type an optional **model answer**, which
  is never marked against — it is what the child's parent is shown beside their
  answer. See "What a parent sees".
- **Parent** — signs in to see their own child. A parent account is created by a
  teacher on a student's record, is linked to **exactly one** student, and can
  **only ever** see that child. One account per child for now.

(An admin/master-password override also exists for teacher-level access.)

### The parent safety rule

A parent must never reach another child's data, however they edit the address
bar. Two things enforce this on the **server**, and both live in
`server/routes.ts`:

1. **The parent access gate** — a middleware at the top of `registerRoutes` that
   refuses a parent session anywhere except `/api/parent/...` and
   `/api/auth/...`. Every other endpoint, present and future, is closed to
   parents by default rather than being open until someone remembers to close it.
2. **`requireParent` / `requireParentChild`** — inside the parent routes, the
   child is read from the parent's own database row (`parents.studentId`), never
   from an id in the address. A route that does take an id compares it to that
   row and answers **403** for anything else, whether or not that pupil exists.

A session holds **one role only**: `setSessionRole()` is used by every login, and
setting one of `teacherId` / `studentId` / `parentId` clears the other two. So a
parent can never also hold student or teacher access.

A third rule protects the link itself: **an account cannot be moved to another
child.** `PATCH /api/parents/:id` accepts only the name, the username and the
password, and `storage.updateParent()` has no way to write `studentId`. A
`studentId` sent in the body is ignored. To re-link a parent, remove the account
and add a new one on the right child's record.

### Proving it — `npm run check:parents`

`script/check-parent-security.ts` is the test behind all of this. It runs
against a **live server** (`npm run dev` first), creates a parent account for
two different children, and then, as parent A, tries every route we could think
of for reaching child B — the pupil id in the address, the teacher endpoints,
the register, the reports, and writing. It also checks that child B's name
appears nowhere in what parent A is sent, that a made-up pupil id is refused
with 403 rather than 404 (a 404 would reveal which ids exist), and that a
logged-out caller gets nothing. It tidies up the accounts it made.

It ends with one check that reads the source rather than the server: no login
page may call `logout()`, which would destroy the session it had just created
(see "A login page must never call `logout()`" below).

Run it after touching anything under `/api/parent/`, any guard in
`server/routes.ts`, or the parents table. All checks must pass.

**What this test cannot see.** It is an HTTP test, so it only proves what the
server *sends*. It cannot see what the browser *keeps* — and one family's data
did once appear on another family's screen without the server ever getting it
wrong. See the next section.

### The other half of the wall: the browser cache

The parent addresses deliberately carry no pupil id, which is what stops a
parent asking for another child. The side effect is that **every parent reads
the same cache key** — `/api/parent/overview` is one key for the whole school.

TanStack Query is configured with `staleTime: Infinity` and no refetch on focus
(`client/src/lib/queryClient.ts`), so a cached answer is kept for the life of
the page and never re-fetched. Logging out of one parent and into another on the
same tab therefore used to show the previous family's marks and feedback,
straight from the cache, with nothing to correct it.

The fix lives in `client/src/lib/auth.tsx`: an effect watches an `identityKey`
(`parent:12`, `teacher:3`, `none`, …) and calls `queryClient.clear()` the moment
the signed-in person changes. It is done there, in one place, rather than in
each login page, so a login added later is covered without anyone remembering.

**So: never cache a per-person answer under a key that does not identify the
person, unless the cache is cleared when the person changes.** If you add
another shared-key endpoint, or relax `staleTime`, check this still holds — and
check it in a real browser by logging out of one account and into another,
because the HTTP test above will pass either way.

### Who can call the API

Every `/api/...` endpoint requires a login. There is no endpoint that answers an
anonymous caller, and these guards in `server/routes.ts` decide who gets in:

| Guard | Who it lets through | Used for |
|---|---|---|
| `requireTeacher` | a logged-in teacher | all writes, reports, exports, the student register |
| `requireTeacherOrStudent` | a teacher **or** any logged-in pupil | homework, announcements, lessons, resources |
| `requireTeacherOrSelf` | a teacher **or** that one pupil | a child's own submissions and marks |
| `requireParent` / `requireParentChild` | a parent, for their own child only | `/api/parent/...` |

Two rules worth keeping in mind when adding an endpoint:

1. **Never trust an id in the request body to say who the caller is.** Several
   endpoints used to "check" the author by looking up the `createdById` (or
   `markedById`) sent by the browser — a row that always exists, so it refused
   nobody. The author is now always taken from the session
   (`req.session.teacherId`), and the value in the body is ignored.
2. **A pupil is pinned to their own data.** `GET /api/submissions` replaces any
   `?studentId=` a pupil sends with their own id, and anything that reads one
   child's work goes through `requireTeacherOrSelf`.
3. **Check the login before looking anything up.** Answering 404 for a missing
   id but 401 for a real one tells a logged-out caller which ids exist, so the
   guard runs first and the lookup second.

The dev-only streak helpers under `/api/dev/...` are teacher-only too, behind a
single gate on that prefix. They are still registered only when
`NODE_ENV !== "production"`; the gate is because a dev server is often reachable
on the office network, and `sim-date` moves the clock for everyone using it.

### The weekly parent report

Each linked child gets a short weekly summary, in two places that must always
agree: the parent reads it in their portal, and the school copies a
WhatsApp-ready version to send. Both are produced by the same builder, so the
figures can never drift apart.

- `shared/weekly-report.ts` — the report's shape, the week maths, the subject
  names, and `buildWhatsAppReport()`. No database access, so it is easy to read
  and to test.
- `server/weekly-report.ts` — `buildWeeklyReport()`, which gathers the figures.
  It also exports `percentage()`, `catDay()` and `dueDateFor()`, which
  `server/parent-overview.ts` reuses so the two never disagree.

Weeks run **Monday to Sunday in CAT**, using `streakToday()` so the report and
the streak never disagree about which day something happened. `?week=last` asks
for the completed week, which is what the school sends out.

Percentages are total marks scored over total marks available — the same
formula as the Reports page and the Grade Book, so a parent and a teacher
quoting a figure see the same number.

**There is no attendance data in this app.** The QR card called an "attendance
card" is only used for login, and nothing records a pupil being present. So the
report says **"Days active on homework"** — the number of days that week the
child actually handed something in — and the parent portal says in plain words
that it is not a record of school attendance. Do not relabel it as attendance
without building a real register first.

Two smaller rules worth keeping:

- An average of `null` means *nothing was marked*, which is not the same as 0%.
  Both the screen and the message say so rather than showing a zero.
- "Needs attention" is only filled in when **two or more** subjects were marked.
  With one subject there is no weakest to name, and telling a parent their
  child's only subject is both their best and their worst would be nonsense.

### What a parent sees

Two requests feed the parent's dashboard, and **neither takes a pupil id** —
the child is read from the parent's own row, so there is nothing in either
address to tamper with.

- `GET /api/parent/weekly-report` — the week just gone (see above).
- `GET /api/parent/completed-work`, `GET /api/parent/support-report` — see
  "Completed work, and the one id a parent can edit" below.
- `GET /api/parent/overview` — the fuller picture: the current average across
  all marked work, marks by subject, recent marks with the teacher's written
  feedback, homework set against handed in with what is still outstanding, days
  active on homework, and the school's announcements for that class.

Its shapes and wording live in `shared/parent-overview.ts`; the figures are
gathered in `server/parent-overview.ts`. That builder imports `percentage()`,
`catDay()` and `dueDateFor()` from `server/weekly-report.ts` rather than copying
them, so the overview, the weekly report, the Reports page and the Grade Book
can never quote a parent different numbers.

The parent portal is **read-only**, and that is now a rule rather than an
observation: a middleware on `/api/parent` refuses anything that is not a GET
with **405**. Without it an unmatched POST does not fail loudly — it falls
through to the catch-all and answers **200 with the React page**, which reads
like it worked.

### Completed work, and the one id a parent can edit

Three more views, all GETs, all read-only:

- `GET /api/parent/completed-work` — everything the child has handed in:
  subject, title, date, and the mark. Handed in is not the same as marked, so a
  piece still with the teacher says so rather than showing 0%.
- `GET /api/parent/submissions/:id` — one piece opened up question by question:
  the question, what the child wrote, the correct answer, right or wrong, and
  the teacher's comment. This is what a teacher shows a parent on consultation
  day.
- `GET /api/parent/support-report` — "areas to practise": the topics the child
  is getting wrong, grouped by subject, plus their strongest subject and the
  one being worked on.

The shapes and wording are in `shared/parent-work.ts`; the figures are gathered
in `server/parent-work.ts`.

**The one id in the whole parent portal.** Every other parent address carries
no id on purpose, which is what makes it impossible to tamper with. The
completed-work view has to carry a submission id — a parent taps a piece of
work to open it — so it is the one place where editing the address bar is worth
trying. `requireParentSubmission` is the answer: the id is never used to decide
whose work comes back, the submission is fetched and its owner compared against
the parent's own row, and anything else is **403** whether it belongs to another
family or does not exist at all. `npm run check:parents` tries all three.

**Three outcomes, not two.** A hand-marked question can score 3 out of 5.
Showing that as a red "wrong" would be untrue and discouraging, so a question is
**correct** (full marks), **partly correct**, or **not yet**, in green, amber
and red — with the word and an icon as well as the colour.

**Two different things can appear as "the answer", and they must not be shown
the same way.** `ReviewedQuestion.correctAnswerKind` says which one it is:

- `"key"` — the exact answer the marking engine used, from an auto-marked
  question (multiple choice, true/false, numeric, short text). Anything else
  was wrong. It comes from `markAnswer()` in `shared/auto-marking.ts` — the same
  function that marked the work, never a second copy that could drift.
- `"model"` — the teacher's own **model answer** to a written question, typed on
  the assignment form (`questions[].modelAnswer`). Nothing is ever marked
  against it: a written question is still marked by hand. It is an *example* of
  a good answer, so the parent's page labels it "What a good answer looks like"
  and says plainly that their child's answer need not match it word for word.
  Calling it "the correct answer" would tell a parent their child was wrong when
  the teacher had given them full marks.
- `null` — a written question whose teacher did not write a model answer. The
  page says the teacher marked it by hand rather than inventing an answer.

The model answer is optional everywhere, so questions saved before it existed
simply have none. It is a field on the questions JSON, so there is no migration.

**The teacher sees it too, on both marking screens.** On `/teacher/mark/:id` it
sits between the child's answer and the score box — read the question, read what
they wrote, remind yourself what you were looking for, award the mark. On
`/teacher/submissions/:id` it sits exactly where the correct answer sits for an
auto-marked question, so the eye finds it in the same place. It is labelled a
reminder rather than a mark scheme in both: nothing is checked against it, and
the teacher is still marking by hand.

**The pupil sees it with their MARK, never with the question.** This is the rule
that makes a model answer safe to store at all — otherwise it would be sitting
in the page for a child to copy before they had written a word.

- `assignmentForStudent()` in `server/routes.ts` strips `modelAnswer` from every
  question on the way out to anyone who is not a teacher. It is applied on the
  assignment list, on one assignment, and on the assignment embedded in
  `GET /api/submissions/:id` — all three, because the results page reads its
  questions from the last of those.
- `GET /api/marks/:submissionId` carries them instead, as a `modelAnswers` map
  keyed by question id. A mark exists only once the work has been marked, and
  that route already refuses everybody except the teacher and the pupil who
  handed the work in, so it is the one place a child can be shown a good answer
  without it being available beforehand.

The pupil's results page calls it "What a good answer looks like" and says
theirs need not match word for word — the same honest wording as the parent's
page, and for the same reason.

**Still open: the auto-marking answer key is NOT stripped.** `correctOption`,
`acceptedAnswers`, `correctNumber`, `correctBool` and `tolerance` still go out
with the questions, so a pupil who opens the browser's network tab can read the
answers to an auto-marked assignment before answering it. That predates the
model answer and is a bigger change (the submit page and the marking engine both
read those fields), so it was left alone — but `assignmentForStudent()` is the
place to fix it when someone does.

**Attendance:** still none. `attendance.recorded` is hard-coded `false` and the
only figure offered is days active on homework, labelled in plain words as not
being a record of school attendance. See the weekly report section above.

## Classes (forms)

Assignments and students are grouped by class:

- **Primary:** Stage 3, Stage 4, Stage 5, Stage 6
- **Secondary:** Form 1, Form 2

## Language

- The app is **English** for now.
- It should be built **ready to add Portuguese later** — prefer keeping
  user-facing text easy to translate (avoid hard-coding strings in awkward places;
  group display text so it can be swapped out for another language later).

## How to work in this codebase (important)

1. **Always explain what you're about to change before you change it** — in plain
   language, so a non-expert can follow.
2. **Write clean, beginner-readable code** — simple names, small functions, and
   **simple comments** that explain the "why" in everyday language.
3. Match the style of the surrounding code.

## Tech stack

- **Language:** TypeScript (frontend and backend).
- **Frontend:** React 18 + Vite, Tailwind CSS + Shadcn/UI. Routing with Wouter,
  data fetching with TanStack Query. Lives in `client/`.
- **Backend:** Express 5 (Node.js) in `server/`. One server serves both the API
  (`/api/...`) and the React app on a single port (**5000**).
- **Database:** Works on **SQLite by default** (zero setup, stored at
  `data/local.db`) and can switch to **PostgreSQL** by setting `DATABASE_URL`.
  Drizzle ORM. Shared types live in `shared/schema.ts`; the SQLite table
  definitions live in `shared/schema.sqlite.ts`.
- **File storage:** Uploaded files are saved to a local `uploads/` folder
  (`server/local_object_storage.ts`) — works anywhere, no cloud needed.

## Project structure

```
client/
  src/
    components/   # Reusable UI components
    pages/
      teacher/    # Teacher pages (login, dashboard, create, mark, resources, lessons)
      student/    # Student pages (login, dashboard, submit, results, resources, lessons)
      parent/     # Parent pages (login, dashboard + weekly report)
    lib/          # Query client and auth helpers
    hooks/        # Custom hooks
server/
  index.ts        # Server entry point + session setup
  routes.ts       # All API endpoints (incl. login)
  storage.ts      # Database reads/writes + startup seeding
  db.ts           # Database connection
  replit_integrations/object_storage/   # File-upload integration (see caveat below)
shared/
  schema.ts       # Drizzle tables, TypeScript types, login schemas
  weekly-report.ts # Weekly parent report: shape, week maths, WhatsApp message
  parent-overview.ts # The parent's fuller view of their child: shapes + wording
  parent-work.ts   # Completed work, question by question, areas to practise
script/
  check-parent-security.ts  # npm run check:parents — the parent security test
```

## How login works

- **Teacher login** (`POST /api/auth/teacher/login`): checks email + password, then
  creates a real server-side session (cookie-based). Protected teacher routes
  require this session.
- **Student login** (`POST /api/auth/student/login`): student enters their **name**
  (full name or first name, case-insensitive) plus a password. On first login the
  password they type becomes their saved password. A master password also grants
  admin access.
- **Parent login** (`POST /api/auth/parent/login`): username + password, both set
  by the teacher when the account is created. Usernames are stored and compared
  in lower case. Rate limited, and every failure gives the same message so the
  form cannot be used to discover which usernames exist.
- **Note:** passwords are currently stored as plain text for **all three roles** —
  this should be improved (hashing) before any real production use.

### A login page must never call `logout()`

This one cost a whole working portal. The parent dashboard loaded but every
section failed, with `/api/parent/child`, `/api/parent/overview` and both
weekly reports answering **401** to a parent who had just logged in
successfully.

The server was never at fault. The login page, wanting to clear any teacher or
student the browser was remembering, called `logout()` — and `logout()` posts to
`/api/auth/teacher/logout`, `/api/auth/student/logout` **and**
`/api/auth/parent/logout`, each of which calls `req.session.destroy()`. So the
page destroyed the parent session it had created a moment earlier. The browser
still remembered the parent, so the dashboard rendered and looked logged in
while nothing on it could load.

`client/src/lib/auth.tsx` now offers two separate things, and the names say
which is which:

- **`forgetRememberedLogins()`** — clears the browser's copy only (state and
  `localStorage`). This is what a **login page** uses. It is all a login page
  needs, because `setSessionRole()` on the server already clears the other two
  roles as part of logging in.
- **`logout()`** — forgets the browser's copy *and* ends the session on the
  server. Only a **logout button** should use this.

All four login paths (teacher, student form, student card scan, parent) now use
`forgetRememberedLogins()`. `npm run check:parents` reads the three login pages
and fails if any of them calls `logout()` again.

## Database notes

- `server/db.ts` chooses the database at startup:
  - **No `DATABASE_URL`** → local **SQLite** file at `data/local.db`. Tables are
    created automatically on first run (no migration step). This is the default.
  - **`DATABASE_URL` set** → **PostgreSQL**. Run `npm run db:push` once to create
    the tables (Drizzle Kit).
- Sessions: stored in memory in SQLite mode; stored in PostgreSQL
  (`connect-pg-simple`) when `DATABASE_URL` is set.
- On startup, `storage.seedInitialData()` creates the teacher account, the
  registered students, and sample assignments if they don't already exist.
- The same TypeScript types are used for both databases (from `shared/schema.ts`);
  `shared/schema.sqlite.ts` holds the matching SQLite table definitions.

## Installable app / Android packaging

The app is a **PWA** (installable web app) and is set up to be wrapped as an
Android app for the Play Store without rewriting anything:

- `client/public/manifest.webmanifest` — app name ("On Point Homework"), colours,
  icons, portrait orientation.
- `client/public/icons/` — launcher icons, generated from `logo.png.jpeg` by
  `script/generate-icons.ts`.
- `client/public/sw.js` — service worker: opens offline, never caches `/api/` or
  `/uploads/`. Bump `CACHE_VERSION` inside it when its rules change.
- `client/src/lib/pwa.ts` — registers the service worker **in production only**.
- `server/well_known.ts` — serves `/.well-known/assetlinks.json` from the
  `ANDROID_PACKAGE_NAME` / `ANDROID_CERT_FINGERPRINTS` env vars.

Full walkthrough: **`docs/ANDROID_PACKAGING.md`**.

## Running the app

- Start dev server: `npm run dev` — runs on **http://localhost:5000**, no setup
  needed (uses the local SQLite database).
- The `dev`/`start` scripts use `cross-env`, so they work on Windows, macOS, and Linux.
- Environment variables can go in a `.env` file (see `.env.example`). None are
  required for local development.

## Switching to PostgreSQL later

1. Put `DATABASE_URL=postgres://...` in a `.env` file.
2. Run `npm run db:push` once to create the tables.
3. Start the app as usual — it will use PostgreSQL automatically.

## Environment / portability notes

This app was originally built on Replit, but the Replit-specific parts have been
replaced with standard equivalents that run anywhere:

- **File uploads** are saved to a local `uploads/` folder
  (`server/local_object_storage.ts`). No cloud account needed.
- **Database** defaults to local SQLite; PostgreSQL is opt-in via `DATABASE_URL`.
- **`SESSION_SECRET`** is required only in production (`NODE_ENV=production`).
- The build (`vite.config.ts`) no longer uses any `@replit/*` plugins.
- The `.replit` file remains in the repo but is ignored outside Replit; the
  standard equivalents are the npm scripts and the `.env` file.
