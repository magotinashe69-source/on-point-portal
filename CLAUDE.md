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
  parent-plays.ts  # The parent's view of game plays: shapes + wording
  teacher-plays.ts # The teacher's class view of game plays: shapes + wording
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
