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

It also builds its own Stage 3 pupil and Form 1 pupil to check the game-plays
view: that a parent is shown the *same* figures their child is shown (a real
game is played, then the two endpoints are compared against each other), that
the week strip is seven days newest-first, that earned and used both count both
games, that a Form child's parent is told the games do not apply rather than
shown zeros, and that the view cannot be posted to.

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

### An expired session leads back to the right login page

A 401 means the server-side login has ended — in SQLite mode sessions are kept
in memory, so a restart of the server is enough to cause it. The browser may
still be remembering the person, which leaves them on a page where everything
fails silently.

The rescue is in `client/src/lib/queryClient.ts`, and it used to know about the
**teacher only**. A parent hit exactly the same trap and had it worse: their
dashboard loaded, then every section showed "try again in a moment" for ever,
because queries never retry and never go stale (`staleTime: Infinity`). Nothing
sent them back to the login page, so there was no way out of it.

`handleExpiredLogin()` now works out which portal the person is in from the
path, forgets that portal's remembered login, and sends them to that portal's
login page once. `QueryError` takes `role="parent"` so "Log in" leads to the
parent's own login — sending a parent to the teacher login would read as the app
confusing them with a member of staff.

**A failed request must never render as empty.** An empty parent dashboard reads
as "your child has done nothing", which is a different and much worse message
than "this did not load". Every section uses `QueryError`, and
`npm run check:parents` counts the panels so a section added later without one
is caught.

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

The dashboard is a way IN to that work, not a dead end: every recent mark and
every teacher comment is a link to that piece opened question by question
(`RecentMark.submissionId` carries the id). The "still to hand in" rows are
deliberately NOT links — that work has not been handed in, so there are no
answers to open and a tappable row would promise a page that cannot exist.
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

### What a parent sees about the games

`GET /api/parent/plays` — what the games cost in homework, and what has been
earned and used. Shapes and wording in `shared/parent-plays.ts`; the figures are
gathered in `server/parent-plays.ts`. Like every other parent address except the
one below, it carries **no pupil id**.

A parent's real question about the games is not "what did he score?" but
**"is the phone being earned, or just used?"** — so the view is built around the
deal the child is on, and a parent can read homework and screen time as the same
number, because they are.

Three rules it follows:

1. **The parent's figures are the child's figures.** Today's numbers come from
   `getPlayState()` — the same function the child's own game screens use — not
   from counting again. A parent quoted "2 left" while their child's screen says
   3 is worse than no view at all. `npm run check:parents` plays a real game and
   then compares the two endpoints against each other, rather than against
   numbers typed into the test.
2. **Every figure counts BOTH games**, so they read against each other: earned
   4, used 3, left 1. One assignment earns a play of *each* game, so the totals
   are worked out in the builder (`playsEarned`) rather than left for the page to
   multiply out — a page doing its own arithmetic is exactly how one figure ends
   up per-game and the one beside it a total. The per-game split is the lines
   underneath.
3. **Forms 1-2 get told plainly.** The games are Stages 3-6 only, so a secondary
   child's parent gets `available: false` and a sentence saying so, never a row
   of zeros — zeros would read as "your child has earned nothing".

The week strip is seven days, newest first. Plays **earned** on a past day are
recounted from the assignments handed in that day, exactly as today's are, since
earned is never stored: if a teacher deletes an assignment, the plays it earned
stop showing in the history too. That is the honest reading — the work is gone —
and it is the same rule the child's own screen follows. Plays **used** are the
stored figure.

Like the rest of the portal it is a **GET**: a parent can see the plays but
cannot grant them, take them away, or unlock a game.

The card says plainly that it counts plays, **not minutes** — the portal does
not record how long a child plays for, in the same spirit as the attendance
note.

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

### The paper, never the answers — `assignmentForStudent()`

A question carries its answer key in the **same row** as its wording. Sending
that row out whole put the correct option, the accepted spellings, the right
number and the explanation into the page **before the child had written a
word** — invisible on screen, plain in the browser's network tab. That is what
made it easy to miss for so long.

`assignmentForStudent()` in `server/routes.ts` strips all of it for anyone who
is not a teacher: `correctOption`, `correctBool`, `correctNumber`, `tolerance`,
`acceptedAnswers`, `explanation` and `modelAnswer`. It is applied in **three**
places, and all three matter:

1. `GET /api/assignments` — the list
2. `GET /api/assignments/:id` — one assignment
3. the assignment embedded in `GET /api/submissions/:id` — which is where the
   results page reads its questions from

**What survives is as important as what goes.** `type` decides which input the
page draws and `options` are the choices a multiple-choice question is asking
about: strip those and the paper cannot be answered. Add a new answer-key field
to the schema and it must be added to this function too.

**Marking is unaffected, by design.** `autoMarkSubmission()` reads the
assignment from the database, never from anything a browser was sent, so
removing these fields cannot change a mark. `npm run check:answers` proves it
rather than assuming it: it answers a four-question paper 3 right, 1 wrong and
checks the score comes back 3 of 4.

**A child is still told the answers — afterwards.** The per-question feedback
the marker writes says what the right answer was ("Correct answer: 6."), and
`GET /api/marks/:submissionId` carries the model answers. Nothing is hidden from
a pupil; it is just not handed over early.

### Proving it — `npm run check:answers`

`script/check-answer-key.ts` walks the whole journey as a real logged-in pupil
against a live server: fetch the paper, answer it, get it marked, read the
results. It checks the answers are absent on the way out (field by field, and by
searching the raw response text for the answers themselves), that the question
wording, type, options and marks all survive, that auto-marking still scores
exactly right, that the feedback afterwards does tell the child the answer, and
that a teacher still gets everything. 34 checks.

Run it after touching `assignmentForStudent()`, anything that returns an
assignment, or the questions schema.

### A check that is SKIPPED looks exactly like a check that passed

Two bugs of this shape have been found in these scripts, and both reported
themselves as green for weeks.

**The response shape.** Some endpoints answer with a **bare array or object** —
`/api/students`, `/api/students/:id`, `/api/assignments`, `/api/assignments/:id`,
`/api/submissions`, `/api/parents`, `/api/resources`, `/api/announcements`,
`/api/lessons`. Everything else answers `{ success, ... }`. Reading
`body.assignments` off one of the bare ones gives `undefined`, and in
`check:games` that quietly disabled a whole block: the assignment it created was
never cleaned up, and the two checks inside it had never run since being
written.

**The unasserted guard.** `if (thing) { ...checks... }` where `thing` came from a
response. When it is undefined the block is skipped, nothing fails, and the run
is green with fewer checks than anyone thinks.

So: **every guard of that shape must be preceded by a `check()` that it exists**,
with a detail line saying the checks below are skipped rather than passing. The
same goes for `array.every(...)`, which is **true for an empty array** — assert
the length first or the check passes by having nothing to look at.

When adding a check script, prefer taking a created object from the **POST's own
reply** rather than fetching it again and guessing the wrapper.

### A check script must tidy up even when it falls over

These scripts run against a LIVE database. Each creates pupils, assignments,
parent accounts and saved questions — and each used to delete them at the
bottom of `main()`, which is exactly the wrong place: a run that reaches the
bottom is the run that least needs saving.

A crash partway through left its fixtures on the register for ever. That is how
a pupil called "Certificate Child 332988" ended up on a real school's roll: the
dev server restarted mid-run (it watches for changes now), a `fetch` failed, the
script threw, and the tidy-up never ran.

So `script/cleanup.ts` holds the pattern every check script uses:

* **`onCleanup(what, fn)`** — call it the moment a fixture EXISTS, not at the
  end. The whole point is to survive never reaching the end.
* **`runCheck(main, summary)`** — runs the body, then the cleanups in a
  `finally`, then the summary. Removals run newest-first, because fixtures are
  built on each other. A cleanup that fails is reported, never thrown: throwing
  from a `finally` would replace the real error with a misleading one.
* **A crash is a FAILED run**, even if every check that managed to execute
  passed. `runCheck` sets the exit code, so a script that dies after twelve
  green checks cannot report success.

The dev clock counts as a fixture too — a run that dies mid-simulation would
otherwise leave the server pretending it is next Tuesday.

### `script/` is typechecked, and was not before

`tsconfig.json` used to include only `client/src`, `shared` and `server`, so
`npx tsc --noEmit` never looked at a single check script. A call to a function
that no longer existed sat in `check-answer-key.ts` and surfaced only when the
script was run. `script/**/*` is now included.

`script/generate-icons.ts` is excluded: it imports `sharp`, a one-off tool
dependency that is not installed, so typechecking it fails on a module nobody
needs to have.

### Never call `process.exit()` in a check script

Both check scripts set `process.exitCode` and let the process end by itself.

`process.exit()` tears the process down while `fetch`'s keep-alive sockets are
still open, and on Node 24 for Windows that trips an assertion inside libuv
(`!(handle->flags & UV_HANDLE_CLOSING)`). Everything has already run and printed
by then — but the process dies with **code 127**, so a completely green run
looks like a failure. That makes the script useless as a CI gate, which is the
one job it has.

Ending naturally costs a few seconds while those sockets time out, and gives an
honest 0 or 1. An early stop uses `abort()` and `return`, never `process.exit`.

The older ad-hoc scripts in `script/test-*.ts` still call `process.exit()` and
would hit the same thing. They are run by hand rather than in CI, so they were
left alone — but the fix is the same three lines if one is ever wired up.

**Attendance:** still none. `attendance.recorded` is hard-coded `false` and the
only figure offered is days active on homework, labelled in plain words as not
being a record of school attendance. See the weekly report section above.

## The three games (Stages 3-6 only)

Treasure Island, Target Blaster and Penalty Shootout. Forms never see any of
them: every endpoint goes through `requirePrimaryStudent`, and each page sends a
Form pupil back to their dashboard.

### Plays are earned by doing homework

Every assignment a child hands in **today** earns them one play of Target
Blaster and one of Penalty Shootout. Three assignments, three plays of each.

Treasure Island is deliberately **not** part of this. It has always rewarded
completing assignments with chests and is left exactly as it was.

The rules are in `shared/game-plays.ts`; the counting is in
`server/game-plays.ts`. One idea holds it together:

> **Plays earned are never stored.** They are counted, every time, from the
> assignments handed in today. Only what has been USED is written down.

That is what makes the daily reset free rather than something to remember. The
CAT day (from `streakToday()`, so games and streaks never disagree about what
day it is) is part of the row's key, so tomorrow finds no row: used starts at 0
and earned is recounted. Unused plays cannot carry over because there is nothing
to carry, and no overnight job can fail to run.

A play is spent when a game **starts**, like a coin in an arcade machine. What
it buys, though, is the whole game — not "the game as long as you stay on the
page".

### Walking out of a game does not cost the play

A child whose battery dies, whose tab is closed by a parent, or who mis-taps
"back" in round two has not had their play. Telling them they have is how a
reward turns into a punishment.

So an unfinished game is **kept, not refunded**. Come back and you are put back
into the *same* game, at the round you had reached, with the rounds you already
played still marked as they were.

Keeping it rather than refunding it is what makes this safe to give away:

* The questions are the ones already issued, so quitting cannot be used to
  **re-roll** until an easy set comes up.
* The rounds already played keep their marks, so a child cannot quit a game they
  are **losing** and start it again for a better score.
* A round is played once and stays played, so answering, being shown the right
  answer, quitting and coming back cannot be used to **learn the answers**.

How it works: `game_plays.active_answers` holds one slot per question issued,
`null` until that round is played. `recordSlot()` fills a slot in as the round
happens and **refuses to overwrite one already filled**. `activeGame()` reads
back the first unplayed slot, which is where the child is put. Starting a game
checks for one in flight *before* it looks at the balance — a game already paid
for can be finished even when no plays are left. In Penalty Shootout a game in
flight also beats the subject just tapped, so quitting a subject that is going
badly cannot be used to start a fresh one.

Nothing has to be cleared up and no timer has to expire: the half-finished game
sits in the same row as the day's plays, and tomorrow's row is a different key.

### Both games are built from work already handed in

Penalty Shootout used to draw its questions from every assignment set for the
child's class, done or not. That was wrong twice over: it put questions from
tonight's unfinished homework into a game, and it made the game depend on what a
teacher happened to have set. Both games now use only assignments the child has
**already handed in** — the game is a reward built out of their own finished
work.

A thin subject **repeats questions rather than disappearing**. It used to need
ten different questions, which is how a child who had done their homework could
still be told "no games ready". `dealShots()` in `shared/penalty.ts` deals the
whole shuffled pack, then shuffles and deals again.

**That change broke the old anti-cheat, so it had to be replaced.** Finishing
used to refuse to count the same question twice, which stopped ten copies of one
known-correct answer scoring ten. A game may now legitimately repeat a question,
so that rule would have robbed an honest child. Instead **the issued game is
stored** (`game_plays.active_refs`) when the play is spent, and each round is
marked and **written down as it is played** (`game_plays.active_answers`),
identified by its **slot** rather than by its question — the ref alone is
ambiguous once repeats are allowed.

The finish then simply adds up what the server already recorded. **The browser
has no say in the score at all**, and cannot be given one by sending a different
set of answers up. A finish is only accepted once every slot has been played, so
closing the tab at round four neither banks a four-round game nor loses it; and
a finished game has no stored questions left, so a winning result cannot be sent
up twice.

### What a teacher sees about the games

`GET /api/reports/plays?form=Stage%203` — a whole class at once: who is earning
their game plays and who the reward is not reaching. Shapes and wording in
`shared/teacher-plays.ts`, figures in `server/teacher-plays.ts`, page at
`/teacher/game-plays`.

Teacher-only, because it hands out every child's name in a class. It takes the
same parameters as the daily report on purpose (`form`, plus either `date` or
`dateFrom`+`dateTo`) so the two pages behave the same way, and answers for
**today** when no dates are given.

**It is deliberately not the parent's card with more rows in it.** The two are
asking different questions:

| | asks |
|---|---|
| a parent, about one child | "is the phone being earned, or just used?" |
| a teacher, about a class | "is this reward pulling homework in, and who is it not reaching?" |

So the class is split into the four groups a teacher can act on — **earned and
played**, **earned, not played yet**, **played, earned nothing**, and
**neither** — and the last group is listed **first**. That group is the point
of the page; nobody should have to scroll a class of thirty to find it.

Three rules it follows:

1. **Plays earned are recounted, never stored** — the same rule the child and
   the parent see. Earned is derived from the assignments handed in over the
   days being looked at.
2. **"Left" is only shown for today.** Plays do not carry over, so "3 left" on
   last Tuesday would describe something nobody can spend. `playsLeft` is
   `null` for any range that is not today alone.
3. **Forms 1-2 get told plainly** — `available: false` and a sentence, never a
   class of zeros, which would read as "nobody in Form 1 does their homework".

A whole class is read in a fixed number of queries: the register, the
submissions, and one bulk read of the play rows
(`storage.getGamePlaysForStudents`). A loop of "one query per child per day per
game" would be four hundred round trips for a class of thirty over a week.

### The two games are deliberately different

|            | Penalty Shootout      | Target Blaster                  |
|------------|-----------------------|---------------------------------|
| questions  | one subject you pick  | every subject you have done     |
| length     | 10 shots              | 6 rounds                        |
| pressure   | none                  | a timer per round               |
| record     | one per subject       | one overall                     |

Target Blaster's rules are in `shared/blaster.ts`, its server logic in
`server/blaster.ts`, its page at `client/src/pages/student/target-blaster.tsx`.

### Proving it — `npm run check:games`

`script/check-games.ts` runs against a live server as a real Stage 3 pupil:
completes three assignments, checks three plays of each game appear, plays them
down to zero, checks the fourth game is refused *politely* with the "come back
tomorrow" wording, checks a fourth assignment earns another play mid-day, checks
both games build from completed work and never from an assignment left undone,
checks the answer key never reaches the browser, checks a finished game cannot
be replayed to score twice, checks Treasure Island still earns chests, checks
Forms get 403 from all of it, and moves the clock to tomorrow to prove unused
plays do not carry over.

It also walks out of a game half-played and comes back: the play is not spent
twice, the same questions come back, a round already played cannot be played
again or re-marked, the game cannot be finished early, the score covers both
sittings, a game already paid for can be picked up with no plays left, and in
Penalty Shootout picking another subject returns the game in flight. It then
runs the pages' own arithmetic (`readProgress`/`scoreProgress`, imported from
`shared/game-plays.ts`) over the server's real reply, so a change to what a
child is shown on coming back breaks this test rather than their game.

Finally it checks the teacher's class view: it adds a second Stage 3 pupil who
does nothing at all, so there is somebody in the "neither" group to find — a
class where everyone has worked would not test the thing that page exists for.
It then checks the teacher's figures match the ledger, that the groups are
right, that the children the reward is not reaching are listed first, that a
past day never claims plays are left to spend, that a Form class is told the
games do not apply, and that neither a pupil nor a logged-out caller can read
it. 94 checks.

Run it after touching either game, the plays ledger, or anything under
`/api/students/:id/plays`.

## The Question Bank

A library of **reusable questions**, saved once and found again by what they
are about. Stage 1 built the store, Stage 2 the teacher's screens, Stage 3 the
way assignments pull questions out of it.

- `shared/question-bank.ts` — the shapes, the tag vocabulary, and the validator.
  Pure, no database access.
- `server/storage.ts` — `createBankQuestion`, `getBankQuestions`,
  `getBankQuestion`, `deleteBankQuestion`.
- The table is `question_bank`, defined in `shared/schema.ts` (PostgreSQL) and
  `shared/schema.sqlite.ts` (SQLite), with the usual create-if-missing safety
  net in `server/db.ts`.

**It is a NEW table beside the assignments, not a change to them.** A question
inside an assignment lives in that assignment's `questions` JSON column, has no
life of its own, and disappears with the paper. A bank question exists on its
own, is meant to be used many times, and has to be findable by what it is about.
Existing assignments are untouched, and `npm run check:bank` proves saving to
the bank creates no assignment and puts nothing into an existing one.

**The answer-key columns carry the same names as an assignment question's own
fields** — `options`, `correctOption`, `correctBool`, `correctNumber`,
`tolerance`, `acceptedAnswers`, `explanation`, `maxScore`. That is deliberate: a
later stage can copy a bank question into an assignment without renaming
anything, and `markAnswer()` marks it unchanged. New names here would have cost
a translation layer in every stage that follows. The check proves it by marking
a row straight out of the bank.

**Tags are how a question is found:** `subject`, `topic`, `form` (the class
level — called `form` because that is the word the rest of the app uses, so this
is not the one place that says `grade`), and `difficulty` (easy / medium /
hard). Plus `createdById` and `createdAt`, so it is always known who saved a
question and when.

**Only the four auto-markable types**, never `written`. A written question has
no answer key, so it is not a reusable question-with-an-answer — it is a prompt
marked by hand. Letting one in would mean the bank held rows that cannot be
marked, which is the one thing a question bank must not do.

**A question is validated before it is saved, not when it is used.** A
multiple-choice question with no options, or a correct answer pointing past the
end of the list, marks every child wrong — and a bank question is reused many
times, so one bad row does that damage over and over, on papers set months apart
by teachers who never saw it go in. `validateBankQuestion()` returns the
problems in plain words so a screen can show a teacher what to fix, and
`createBankQuestion()` refuses rather than writing a broken row.

### The teacher's screens (Stage 2)

Four teacher-only endpoints — `GET`, `POST`, `PATCH` and `DELETE` on
`/api/question-bank` — and two places in the UI.

**Teacher-only, all four.** These are the school's answer keys. A pupil who
could read this endpoint could read the answer to a question before it was ever
set as homework.

**Saving: the "Save to bank" button on each question** in the assignment form
(`client/src/components/SaveToBankDialog.tsx`). It copies the question into the
library **in one direction only** — the assignment is not changed, not re-saved,
and not linked to the library row, so a teacher can bank a question and carry on
writing the paper. The tags an assignment already knows (subject, class, topic)
are filled in; the teacher only adds the difficulty, and every field stays
editable because a paper's topic is often broader than one question.

A **written** question cannot be banked, and the dialog says so rather than
letting the save fail with a message that would read like a bug.

**Browsing: `/teacher/question-bank`** — filter by subject, topic, class and
difficulty, or search the wording when the tags are forgotten. Each question
shows its type, its answer, its marks and its tags.

**Editing and deleting change ONLY the library copy.** An assignment that
already used a question keeps the copy it took, and marks already given stand —
rewording a bank question months later must never quietly change a paper
somebody has already sat. Both screens say so in plain words, because a teacher
cannot be expected to assume it.

Two rules worth keeping when adding to this:

1. **The author comes from the session, never the body.** `createdById` sent by
   a browser is ignored, like everywhere else that records who did something.
2. **An edit is validated as MERGED with what is already saved.** Clearing the
   options of a multiple-choice question is a perfectly valid-looking patch that
   leaves behind a question marking every child wrong. What matters is whether
   the row is still markable *after* the edit.

**A refusal is not a broken connection.** `apiRequest()` throws on any non-2xx,
so a 400 reaches the screen as an exception. Caught carelessly that shows "check
your connection" to a teacher whose connection is fine and whose question is
merely incomplete. `client/src/lib/api-error.ts` digs the server's own words
back out; use it wherever a request can be legitimately refused.

### Assignments pull from the bank (Stage 3)

"Add from bank" beside "Add question" in the assignment form opens a picker
(`client/src/components/AddFromBankDialog.tsx`): filter and search the library,
tick several questions, add them all at once. The filters start on the
assignment's own subject and class, because that is what a teacher writing that
paper is looking for.

**What lands on the paper is a COPY, never a link.** This is the design, not a
shortcut, and it is what keeps the promise the other two stages make:

> bank → paper is a snapshot, and paper → bank is a snapshot. The two never
> move together after the moment of copying.

If pulling a question created a reference, then editing the library would change
a paper a class had **already answered**, and their marks would stop matching
the questions they were actually asked. So `bankQuestionToAssignmentQuestion()`
in `shared/question-bank.ts` takes a full copy, gives it a **fresh question id**
(marks link by question id, so a reused id would attach old marks to a new
question), and the assignment is on its own from then on.

`npm run check:bank` proves it the hard way: it pulls a question onto a paper,
then **rewords the saved question, changes its answer and deletes it outright**,
and checks the paper still asks what it asked — then has a child answer it and
confirms the mark comes from the paper, not from the library.

**Most tags do not come across.** `subject`, `form` and `difficulty` describe
where a question sits in the **library**, and the paper already knows its own
subject and class — a second copy on every question would be one more thing to
disagree with it.

**The `topic` is the exception**, and deliberately so: it is the one tag that
says something the paper does not already know. An assignment has a single
topic, but a "Revision" paper can hold one question about fractions and another
about angles — and the Learner Mastery Map is built **per question**, so that
finer topic is exactly what it needs.

**Unused answer-key fields arrive with the same empty defaults a brand-new
question has**, rather than as `undefined`. A teacher who pulls in a numeric
question and then changes its type to multiple choice must find an options
editor ready to type into, not a broken one.

A repeat is **pointed out, not blocked** — the picker marks a question already
on the paper, because a teacher may well want the same question twice and only
they can say.

### Proving it — `npm run check:bank`

`script/check-question-bank.ts`, in two halves.

The **in-process half** runs against storage directly and calls `ensureSchema()`
itself, which is what makes "was the table created?" answerable without a
server. It saves one question of each of the four types and reads them back from
the table, checks every part of the answer key and every tag survives, marks a
row straight out of the bank with the real auto-marker, filters by subject,
topic, class, difficulty and type (singly and combined), searches the wording,
checks twelve kinds of broken question are refused, and checks the bank is
separate from assignments.

The **HTTP half** needs a running server (`npm run dev`) and walks the teacher's
journey in order: save a question with tags, open the bank and see it, narrow by
subject and then by difficulty, search a word in the wording, edit it and see
the change stick. It also checks the author cannot be forged through the body,
that an edit leaving an unmarkable question is refused and the saved row is left
alone, that a logged-out caller gets nothing, that deleting changes no
assignment, and that a refusal reaches the screen as readable words rather than
as "check your connection". If no server is reachable it says so plainly instead
of failing in a way that looks like broken code.

Stage 3 adds both a pure half and an end-to-end one: the converter is checked
field by field (including that the tags and the bank id do NOT come across, and
that a converted question marks correctly), and then a real paper is built from
a saved question, the saved question is reworded and deleted, and the paper is
checked to have not moved — with a child's submission marked against it to
prove the point.

111 checks. It removes everything it creates.

## The Learner Mastery Map

What a child has shown they can do, skill by skill, on their own dashboard.
Worked out **entirely from marks already stored** — no AI, no new marking, and
nothing in it changes how anything is marked. It reads what has already happened
and groups it by what the work was about.

- `shared/mastery.ts` — the bands, the calculation and the wording. Pure.
- `server/mastery.ts` — gathers a child's marked questions and resolves each
  one's topic.
- `client/src/components/MasteryMap.tsx` — the map as a child sees it.
- `GET /api/students/:id/mastery`, behind `requireTeacherOrSelf`.

### Where a skill comes from

A skill is a **topic**, and a topic is found in this order:

1. **The question's own topic**, when it has one. This is the finer of the two —
   a "Revision" paper can hold one question about fractions and another about
   angles. A question copied out of the Question Bank brings its topic with it.
2. **The assignment's topic**. Every assignment has one (optional, usually
   filled in), and it covers homework set long before the bank existed.
3. **Neither → not a skill.** The question is counted as `untagged` and left out
   of the map. It is never shown as an empty band and never counted as a
   failure: a child must not be shown red for something nobody ever labelled.

That is why `assignments.questions[].topic` exists. It is optional, is never
used for marking, and had to be added to **three** places or it would have been
silently stripped: the schema, the server's `createAssignmentSchema`, and the
form's own `questionSchema`. A zod object drops keys it does not name, so a
topic sent by the form would have vanished on the way in and the map would have
quietly stayed empty.

### Why the rate is marks, not a count of right answers

A hand-marked written answer can score 3 out of 5. Counting that as "wrong"
would be untrue, and this map exists to encourage. Marks scored over marks
available handles partial credit honestly — and it is the **same formula** the
weekly report, the Reports page, the Grade Book and the parent overview use, so
a child's mastery can never disagree with their own subject average. For
auto-marked questions the two are identical anyway: those score full marks or
none.

### The bands, and the words

80%+ **Got it**, 50–79% **Getting there**, below 50% **Keep practising**. Two
rules run through the wording and the styling:

1. **Never say "failed".** A child reading this is being shown their weakest
   work, which is a vulnerable thing. Every band names what to do next, and the
   weakest one reads "Keep practising — everyone has some of these".
2. **Colour is never the only signal.** Each band carries its own words and its
   own icon, so a colour-blind child reads exactly the same information.

Two thresholds stop the map lying about thin data. A topic needs
`MIN_MARKS_FOR_A_TOPIC` marks behind it before it is shown at all — one question
answered badly is not a weak skill, it is one question — and a child with
nothing yet sees "Do more homework to build your mastery map" rather than a
screen of 0%.

### What a teacher sees — class skills

`GET /api/reports/mastery?form=Stage%205`, page at `/teacher/class-mastery`.
Teacher-only: it names children and says what each is weakest at.

**Deliberately not the child's map with more names in it.** The two ask opposite
questions, and it shows in the ordering:

| | asks | ordered |
|---|---|---|
| a child | "what am I good at?" | strongest first, to encourage |
| a teacher | "what must I reteach?" | **weakest first**, to act on |

**The one thing this page must not do is hide a split class.** A topic sitting
at 65% could be every child at 65%, or half the class at 100% and half at 30% —
and those need completely different lessons. So every topic carries the
**spread** as well as the figure: how many children are in each band. A
genuinely split topic (some mastered, some needing practice) says so in words.
`npm run check:mastery` builds two topics that BOTH read 50% for the class, one
even and one split, and checks the spread tells them apart.

**A teacher's figure is the child's figure.** The class view is built from each
child's own `buildMasteryMap()`, from the same `answeredFrom()` reduction their
dashboard uses — so a teacher and a child can never be looking at different
numbers for the same topic. The check compares the two endpoints against each
other rather than against numbers typed into the test.

Read in **bulk** — the register, every submission, their marks and the
assignments behind them — then worked out per child in memory. Calling
`buildMastery()` thirty times would be ninety round trips for one page.

### Proving it — `npm run check:mastery`

`script/check-mastery.ts`, in two halves. The first checks the calculation on
its own, **exactly on the band boundaries**, because an off-by-one there quietly
tells a child they are failing something they have nearly mastered. The second
builds a real Stage 4 pupil with five marked papers — one landing in each band,
one whose questions carry their own topics, and one with no topic at all — and
reads the map back over HTTP.

It checks the colours are right, that subjects group correctly and do not bleed
into each other, that a question's own topic beats the paper's, that untagged
work is counted but never shown and never breaks the map, that a child with
nothing gets an invitation rather than zeros, and that one pupil cannot read
another pupil's map.

It then builds a two-pupil class for the teacher's view, with two topics that
both read 50% — one where both pupils sit at 50%, one where one has it perfectly
and the other has none of it — and checks the spread tells them apart, that the
list is weakest-first, that the struggling pupil is flagged and the strong one
is not, and that a pupil cannot read the class view. 61 checks.

## Offline mode

A child can save a paper to their phone while they have signal, answer it and
hand it in with none, and have it sent on its own the moment they reconnect.

- `shared/offline.ts` — the queue item, the rules, the wording. Pure.
- `client/src/lib/offline-db.ts` — the store on the device (IndexedDB, by hand).
- `client/src/lib/outbox.ts` — the sync runner.
- `client/src/components/SyncStatus.tsx` — "2 items waiting to sync".
- `client/public/sw.js` — serves the app itself when the network is gone.

### The one rule everything rests on

> **The DEVICE names the submission, not the server.**

When a child taps "Hand in", the app makes a random `clientId` and saves it with
the answers. Every later attempt to send that work carries the same id, for
ever. That is what gives both halves of the promise:

* **never duplicated** — `submissions.client_submission_id` carries a UNIQUE
  index, so the same work can arrive any number of times and be stored once;
* **never lost** — the device deletes a queued item only AFTER the server has
  said in words that it has it. A crash mid-send leaves it exactly where it was.

The id is sent on an **ordinary online hand-in too**, not only an offline one.
That is what makes the fallback safe: if a normal hand-in leaves the phone and
the reply is lost, the queued retry is recognised rather than stored again.

### The order of the checks in POST /api/submissions matters

The `clientSubmissionId` lookup runs **before** the "you have already handed
this in" check. The other way round, an ordinary re-send would be refused as a
second attempt, the phone would mark it blocked, and a child would be told their
own handed-in work had been rejected.

Nothing is awarded twice because the early return sits above the XP, the
treasure chest and the streak.

### The race a "look first" check cannot win

Two sends of the same work arriving together both look, both find nothing, and
both insert. The unique index refuses the loser; `isUniqueViolation()` catches
that, re-reads the winner and answers with it. `npm run check:offline` fires
five at once and checks the database holds one.

### The device clock is USED but not TRUSTED

`submittedAt` is the time the CHILD finished — so streaks, game plays and
report-card terms all read the honest moment, not whenever a signal turned up.
`receivedAt` records when it actually arrived, so the gap is visible.

`resolveCompletedAt()` refuses a claimed time that is **in the future** (which
would land the work in tomorrow's CAT day and break the game-plays count) or
**before the paper was set** (impossible, so the clock is wrong). Either falls
back to server time. A phone that was genuinely offline for a fortnight is still
believed — the point is to catch a broken clock, not to punish a child.

**A deliberately altered clock can still make late work look on time**, within
the window between the paper being set and now. `received_at` and
`client_submission_id` are the audit trail beside it. Closing that properly
needs a signed timestamp, which is not worth it here.

### What is deliberately NOT offline

* **Editing work already handed in.** Two phones could each save a different
  version and one would quietly win. Offline hand-in is a FIRST submission only,
  and the button is disabled with a sentence saying so.
* **Photo attachments.** An upload needs the server. Typed answers still work
  and the camera button says why.
* **Marks and results.** Nothing on the device may hold a score: a saved mark
  goes stale, and a stale mark shows a child a score their teacher has already
  changed. The queued item has no score field, the "just sent" list lives in
  memory only, and `/api/` is still never cached by the service worker.
* **Backdating the STREAK.** The submission is dated by completion, but the
  streak counts on the day it syncs. Backdating means replaying a chain that
  spends freezes — a rewrite of the streak state machine. Known limitation.

### The service worker now serves the app, not a dead end

An offline page request used to fall back to `offline.html`, which said "you are
offline" and nothing else — so a child who had saved their homework could not
reach it, because the app never started. Navigation now falls back to the saved
app shell (`/`), which boots and reads the device. `offline.html` remains the
last resort for a browser that has never loaded the app.

`/api/` is untouched by this: still never cached, so no mark, score or homework
list is ever served from a cache. The shell is an empty frame.

### navigator.onLine is not enough

A real test caught this: after reopening the app with the network pulled, the
phone still reported `navigator.onLine === true`. It only knows whether the
device is attached to something, not whether that something can reach the
school.

So the submit page uses `cannotReachSchool` — `!online` OR "this page is reading
the paper off the device because the server could not be reached". `useOnline()`
is used to decide what to OFFER a child, never to decide whether their work
arrived. Only the server's own reply decides that.

The work was queued correctly even before this was fixed, because a failed
online hand-in falls into the outbox anyway. What was missing was the sentence
telling the child why.

### Reading the reply is the dangerous part

`interpretReply()` treats everything that is not a clear, understood YES as "did
not arrive". The trap it exists to survive is school WiFi: a hotspot that wants
you to sign in answers every request with its own web page and a cheerful 200.
Treating that as success would delete a child's work and send it nowhere. Only a
reply that parses, says `success: true` AND names a numeric submission id counts.

### Proving it — `npm run check:offline`

`script/check-offline.ts`, in three parts. The rules on their own (every shape
of reply, the stale-send recovery, the clock verdicts, two thousand ids with no
collision). The source itself, for two promises no server can be asked about:
that nothing which writes to a device mentions a mark, and that the service
worker still refuses `/api/`. Then a live server: the same work sent twice, four
more times, and five at once; XP that does not move on a repeat; the mark coming
back so a result appears after syncing; a new id for a paper already handed in
refused rather than stored twice; another pupil's device id refused with 403;
and an ordinary hand-in proved unchanged. 88 checks.

### Proving the other half — in a real browser

The rest of the promise happens on a PHONE, and cannot be tested by sending
requests to anything: a paper saved to the device, answered with no signal, and
sent on its own later. That needs a real browser with Chrome's own network emulation,
so `navigator.onLine` really is false and `fetch` really does reject.

`script/chrome.ts` is the driver — a small DevTools Protocol client built on the
`ws` this project already depends on, rather than adding a browser driver as a
dependency. Launch Chrome on a throwaway profile, open a tab, run JavaScript in
it, pull the network out.

* **`npm run check:offline:browser`** (needs `npm run dev` running) — sign in,
  save a paper, pull the network, answer it, hand it in. The school has nothing;
  the work is waiting on the device with the child's own completion time and no
  mark beside it. Restore the network and it syncs on its own, with no tap.
  Then the case nothing else can produce: a hand-in held at the moment the
  SERVER HAS ALREADY STORED IT and the reply is still in the air, with the app
  reloaded underneath it. The work must still be on the device — nothing is
  thrown away before the school confirms it — and must not be stored twice when
  it goes again. 34 checks.
* **`npm run check:offline:pwa`** — builds the app and serves it on port 5050
  with `NODE_ENV=production`, which is the only way to exercise the service
  worker: it is deliberately never registered in development, so `npm run dev`
  cannot reach a single line of `sw.js`. Pull the network, reload the WHOLE app,
  and check it starts from the saved shell rather than a dead end, shows the
  saved questions, takes a hand-in, and syncs when the signal returns — and that
  nothing under `/api/` or `/uploads/` is in any cache. 15 checks. It really does
  build, so it is slow; `SKIP_BUILD=1` reuses `dist/` while working on the checks
  themselves. Its own port and its own build, so a dev server can be left running.

Two things to know before changing either:

* Chrome's network emulation is **per debugging session**, and a service worker
  is a target of its own. `Browser.setOffline()` attaches to every target and
  pulls the network on all of them; pulling it on the page alone leaves the
  service worker happily online, and the offline fallback is never exercised at
  all.
* Emulation does **not** replay the online/offline transition into a document
  that was LOADED while the network was already off, so no `online` event
  arrives in a page opened with no signal. A real phone fires one. The dev
  script covers that path with a page that was open throughout; the PWA script
  reopens the app instead, which is the more realistic story there anyway.

## Report cards

A term's marks assembled into a printable card, in the school's navy and gold.
No AI. Nothing here marks anything or changes a score — it reads, averages,
grades and lays out.

- `shared/report-card.ts` — grade boundaries, grading, shapes, wording. Pure.
- `server/report-card.ts` — assembles a class's cards for a term.
- `client/src/components/ReportCardSheet.tsx` — the printable card.
- `/teacher/report-cards`, teacher-only.

**THE CARD MUST NOT CLAIM AN ATTENDANCE FIGURE.** The portal keeps no
attendance register — the QR "attendance card" is only used to log in, and
nothing records a child being present. A report card goes home to a family, so
printing "Attendance: 92%" derived from homework would be inventing a fact a
parent then acts on. The card carries **days the pupil handed work in**,
labelled as exactly that, with the disclaimer printed ON the card rather than
in a footnote. `attendance.recorded` stays `false` and `schoolDays` stays
`null` until somebody builds a real register; that is where it would go.

**A whole class is built even for one card.** A card shows the class average
beside the child's own, so every child's marks are read anyway — building per
child would read the same marks once per child. `studentId` picks one out of
the set.

**The term is decided by when work was HANDED IN**, not when it was marked.
Marking date depends on when a teacher got to it, which is not something a
child's term should hinge on.

**A pupil with nothing marked in a subject still gets the row**, showing a dash
and the class figure. A missing row reads as "not taught" rather than "nothing
marked", and the comparison is the useful part either way.

### Grade boundaries

Cambridge defaults (A* 90, A 80, B 70, C 60, D 50, E 40, U 0), but **stored and
editable** — a school sets its own once, in `report_settings`. Every card prints
the boundaries it was graded against, so a family can read the grade without
asking what a B means here.

`validateBoundaries()` refuses a set that does not hold together — duplicate
names, two grades starting at the same mark, or nothing starting at 0. A gap
mis-grades quietly, and nobody checks a grade that looks plausible.
`gradeFor()` sorts before comparing, so a set stored in the wrong order still
grades correctly rather than handing everybody a U.

### Teacher comments

One comment per pupil per term, in `report_comments`, keyed by pupil AND term.
The term key is its name plus its dates: two terms sharing a name in different
years stay apart, and editing this term's comment can never overwrite what went
home last term. A unique index enforces the one-per-term rule in the database,
not only in the code that looks first.

### Proving it — `npm run check:reports`

`script/check-report-cards.ts` builds a class whose marks are chosen so every
figure can be worked out by hand — if the check and the code disagree, the
arithmetic in the header says which is wrong. It checks the subject averages
and grades, that every card in the class quotes the same class average, the
overall figure, that work outside the term does not count, that a comment
belongs to its own term and pupil, that changing the boundaries moves the grade
but not the average, and that a pupil cannot read the class's cards. 57 checks.

## Certificates & Awards

Printable certificates in the school's navy and gold, generated from data that
is ALREADY STORED. No AI, and nothing that marks, awards XP or changes a streak.

- `shared/certificates.ts` — the kinds, the keys and the wording. Pure.
- `server/certificates.ts` — works out what a child has earned and writes it
  down. `server/most-improved.ts` ranks a class for the teacher-run one.
- `client/src/components/CertificateSheet.tsx` — the printable sheet.
- Pages: `/student/certificates`, `/student/certificate/:id`,
  `/teacher/most-improved`.

**Earned on READ, not by a hook.** Marking, XP and streaks were not to be
touched, so nothing hooks into them. When a child's certificates are fetched the
server works out which milestones are now true and inserts the new ones. Asking
twice earns nothing twice — `certificates.cert_key` names the ACHIEVEMENT (a
submission id, a topic, a level) and carries a unique index per student, so the
database refuses a duplicate even if two requests arrive together.

**A certificate carries the date of the achievement, not of the day it was
noticed.** Perfect Score is dated by the mark, Level Up by the XP row. Otherwise
a child who scored full marks in July gets a certificate dated today, which is a
small lie on a document somebody keeps. One compromise, written down where it
happens: the streak table keeps no history of WHEN a seven-day run occurred, so
Streak Star uses the last day the streak counted. Fixing that properly means
recording streak history, which means changing the streak code.

**"PDF" means the browser's own print dialog with "Save as PDF" chosen** — the
approach the Grade Book already uses. No library, no embedded fonts, and on a
phone it is the native Share → Print → Save as PDF. A one-tap `.pdf` download
would need a real generator; this is the trade-off that keeps it lightweight.

The sheet's design came from the old Town Award page, which Dream World's
retirement had left pointing at a dead endpoint. Rather than a second
certificate look drifting alongside it, that page is now the printable view for
any certificate, and `/student/certificate` leads to the list instead of
redirecting to the dashboard.

**Most Improved is the one a teacher runs.** Looking is separate from awarding,
so periods can be compared as often as you like without issuing anything, and
the teacher who issues it is taken from the session. Its percentages are marks
scored over marks available — the same formula as everywhere else, so a
certificate never quotes a figure a teacher cannot find elsewhere in the app.

### Proving it — `npm run check:certs`

`script/check-certificates.ts` makes a pupil score full marks and walks the dev
clock forward a day at a time until they hold a real seven-day streak, then
checks the certificates they are owed appear with the right words and the right
dates, that reading the page repeatedly earns nothing more, that one pupil
cannot read another's, that a pupil cannot award themselves Most Improved, and
that the mark is untouched by any of it. 39 checks.

## Classes (forms)

Assignments and students are grouped by class:

- **Primary:** Stage 3, Stage 4, Stage 5, Stage 6
- **Secondary:** Form 1, Form 2

## Language — English and Portuguese

The interface is in both, switched by a toggle in the header, and the choice is
remembered on the device.

Portuguese here is **European / Mozambican**, not Brazilian: the school and its
families are in Mozambique. So "palavra-passe" rather than "senha", "a carregar"
rather than "carregando". A child is **"o seu educando"** throughout — the
register a Mozambican school uses for the pupil an encarregado de educação is
responsible for, and it does not guess whether the child is a boy or a girl.

- `client/src/lib/i18n/en.ts` — the English text.
- `client/src/lib/i18n/pt.ts` — the Portuguese text.
- `client/src/lib/i18n/index.tsx` — the provider, `useT()`, and the type below.
- `client/src/components/language-toggle.tsx` — the toggle.

### The one rule

> **Only INTERFACE text is translated. Nothing a person typed ever is.**

A question's wording, an assignment title, a pupil's name, a teacher's written
feedback, a topic, an announcement — shown exactly as written, in whatever
language they were written in. Translating a question would change the meaning of
the thing a child is being marked on, and translating a teacher's feedback would
put words in their mouth. `npm run check:language` opens a real paper in
Portuguese and checks the teacher's question is still character for character
what they typed.

Class names ("Stage 4", "Form 1") are the school's own and are never translated
either. Where a label wraps one — "Stage 4 Only" — only the wrapper is ours:
`t.teacherDash.onlyClass("Stage 4")`.

### Portuguese cannot silently fall behind

`pt.ts` is typed as `Translation`, which is `typeof en` with every string
widened back to `string` (see `Widen` in index.tsx — the wording groups in
`shared/` are `as const`, so without widening Portuguese would be required to
say the English words). The effect:

* a key in `en.ts` with nothing in `pt.ts` is a **build error** from
  `npm run check`, not a blank label a family finds first;
* a misspelled key is a build error too, and tsc suggests the right name.

What a type CANNOT see is English **pasted** into `pt.ts` — that typechecks
perfectly. `npm run check:language` compares every string against its English
twin and fails if any is identical, with a short, argued list of the ones that
are the same in both languages on purpose ("Normal", the school's name, a bare
dash).

### Adding a string

Put it in `en.ts`, run `npm run check`, and TypeScript will tell you what is
missing from `pt.ts`. Use a function when a value goes inside a sentence —
`handedInOn: (date) => ...` — rather than gluing fragments together at the call
site, because word order differs between the two languages.

### Where the wording already lived

The parent portal's text was already grouped in `shared/` — `REPORT_TEXT`,
`OVERVIEW_TEXT`, `WORK_TEXT`, `PLAYS_PARENT_TEXT`, `OFFLINE_TEXT` — exactly as
the note at the top of `weekly-report.ts` intended ("so it can be swapped for
Portuguese later without hunting through the logic"). Those files are **spread
into `en.ts`** rather than copied, so English still has one source and nothing
had to move. The server never used them: it sends data, the client supplies the
words, which is what made this cheap.

`summarise()` in `shared/offline.ts` is the exception — it works out the offline
queue's counts AND an English sentence. The counts are what `SyncStatus` uses;
its sentence is left alone because `npm run check:offline` reads it.

### The toggle

Both languages are shown side by side with the current one filled in, rather
than one button reading "PT". A single button is ambiguous in the worst possible
place: a parent unsure whether it means "you are reading Portuguese" or "tap for
Portuguese" has to tap to find out, and that is the tap they are afraid of.

Each name is written in its own language — "English", "Português" — because
somebody looking for Portuguese is looking for that word.

It is on the **login pages** too. A family that reads Portuguese needs the login
page in Portuguese to get as far as logging in.

### Where the choice is kept

`localStorage["onpoint-language"]`, on the device, read in the `useState`
initialiser rather than in an effect — an effect runs after the first paint, so
the page would flash up in English and change under them. It also sets
`<html lang>`, which is how a screen reader picks a voice.

Deliberately not on the account: it has to work on the login page, where nobody
is signed in yet. On a shared family phone this means siblings share the
setting. Moving it to the account later would still need this as the fallback.

### Covered so far, and what is not

Done: the three login pages, the student dashboard, the teacher dashboard, the
assignment screen, the parent portal, and `SyncStatus`.

**Still English, and worth knowing:**

* **Messages the SERVER writes.** "That name is not on the class list", and
  every other `data.message`, is composed in `server/routes.ts` and shown as it
  arrives. Translating those means sending a code the client can look up, or
  telling the server which language to answer in — neither is a small change.
* **`QueryError`.** Its sentences are built from a `what` phrase passed at
  around thirty call sites across every screen. Doing it properly means
  translating the component AND every one of those phrases, which is a pass of
  its own rather than part of this one.
* **The other screens** — results, resources, lessons, the games, the report
  cards, the question bank, mark-submission.
* **Dates** still use the browser's own locale rather than the chosen language.

### Proving it — `npm run check:language`

`script/check-language.ts`, in two halves. The dictionaries on their own (nothing
missing, nothing blank, nothing left in English). Then a real browser, driven
with `script/chrome.ts`: switch to Portuguese on the login page, reload to prove
it stuck, walk a child's dashboard and a real paper, switch back to English,
then a teacher's dashboard and a parent's portal — checking at each step that
the interface changed and the teacher's own words did not. 41 checks.

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
      teacher/    # Teacher pages (login, dashboard, create, mark, resources, lessons, question bank)
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
  mastery.ts       # The learner mastery map: bands, calculation, wording
  parent-plays.ts  # The parent's view of game plays: shapes + wording
  teacher-plays.ts # The teacher's class view of game plays: shapes + wording
  parent-work.ts   # Completed work, question by question, areas to practise
  question-bank.ts # The reusable question library: shapes, tags, validation
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
  needed (uses the local SQLite database). It **watches and reloads** on a
  change to any server or shared file.

  It did not always. Without watching, a route added to `server/routes.ts` did
  not exist until somebody restarted by hand — and the symptom is misleading: a
  brand-new endpoint answers **200 with the React page** (the catch-all), which
  reads like the route is registered but broken. That cost time three separate
  times before it was fixed. If a check suite reports a field as `undefined` or
  an endpoint as missing, confirm the server is running the code you just wrote
  before debugging the code.

  `data/`, `uploads/` and `dist/` are excluded from the watch: the SQLite
  database lives in `data/`, and watching it would restart the server on every
  write. A restart also empties the in-memory session store, so everyone signed
  in is logged out — expected in development, and the reason
  `handleExpiredLogin()` exists (see the parent section).
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
