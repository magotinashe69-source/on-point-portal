# UI Audit — `client/src/pages`

Scope: every file in `client/src/pages/teacher/` (13), every file in `client/src/pages/student/` (11), plus the main page `client/src/pages/landing.tsx` (the `/` route).

Method: shadcn usage is taken from `@/components/ui/*` imports; arbitrary Tailwind values from a regex sweep for `*-[…]`; hex colours from a sweep for `#rgb` / `#rrggbb`; state coverage from reading each render branch; information density counted as *distinct fields drawn from a record*, excluding static labels, icons and chrome.

## Revisions

**Rev 1** — original read-only survey. No code changed.

**Rev 2** — corrections after verifying the build pipeline, plus the design token
layer. Two findings in Rev 1 were wrong and are corrected below:

- **F1's remedy was wrong.** It said to map landing's navy and gold "onto tokens".
  There were no brand tokens to map onto, and `--primary` was a *different* navy
  from the brand one. Corrected, and the tokens now exist.
- **F7 was understated.** It called the hardcoded chart colours a style problem.
  They were a live dark-mode bug. Corrected, and fixed in code.

Code changed in Rev 2: `tailwind.config.ts`, `client/src/index.css`,
`client/src/pages/teacher/reports.tsx`.

**Rev 3** — **F2 and F3 fixed.** Every live screen that loads data now tells the
truth when a request fails, and every mutation reports failure. New shared
component `client/src/components/QueryError.tsx`; 15 screens edited. Details
under F2/F3 below.

**Rev 4** — **F4 fixed**, on five screens rather than the two F4 named. An empty
list and a list emptied by filters are now different states with different words
and a way out.

**Rev 5** — **F6 fixed.** Dead code removed, found by compiler sweep rather than
by eye: **26** unused symbols, against the 7 Rev 1 spotted. Four items Rev 1
listed as dead were kept on purpose — reasoning under F6.

**Rev 6** — **F8 fixed** where the data existed. Two of the three thin rows now
carry the information they were missing; the third turned out to be a deliberate
design choice. One kept-field decision from Rev 5 was re-verified against the
server and revised — details under F8.

**Rev 7** — **F1 closed.** The landing page's brand and surface colours are now
design tokens; its opt-out from dark mode is explicit and scoped rather than
accidental. Two WCAG failures fixed, one of which Rev 1 had not spotted.

Everything else in this document still describes the code as it stands.

---

## Build & theme configuration

Established by inspection, because it determines whether any of the fixes below
are even expressible. Four independent checks agree:

| Check | Result |
|---|---|
| `node_modules/tailwindcss/package.json` | `3.4.17` |
| `postcss.config.js` | `plugins: { tailwindcss: {} }` — the **v3** signature |
| `client/src/index.css:1-3` | `@tailwind base/components/utilities` — **v3** directives |
| Built CSS | v3 preflight `--tw-border-spacing-x` block; **0** `oklch`, **0** `@layer theme` |

**Tailwind 3.4.17 builds the CSS.** `@tailwindcss/vite` 4.1.18 is in
`devDependencies` but `vite.config.ts` registers only `react()`, so it is never
invoked; `@tailwindcss/postcss` (the v4 PostCSS adapter) is not installed either,
so the bare `tailwindcss: {}` resolves to v3. It reads as an abandoned v4
migration. **Recommend deleting `@tailwindcss/vite`** — it is a trap for anyone
who reads the manifest and assumes v4 semantics, and it drags in the
`@tailwindcss/oxide` native binary for nothing.

Theme configuration is split:

- **`tailwind.config.ts`** — the *shape*. Utility names, and colours as
  indirection (`hsl(var(--primary) / <alpha-value>)`). Since Rev 2 it also holds
  the spacing scale, Carbon type scale, radius scale and Carbon grey ramp.
- **`client/src/index.css`** — the *values*. `:root` (light) and `.dark` (dark),
  as HSL channel triplets.
- **`components.json`** pins both paths for shadcn. `darkMode: ["class"]`.

The `content` glob is repo-root-relative while Vite's `root` is `client/`. That
works because the build runs from the repo root, but it is a coupling to know about.

---

## Routing note, read this first

`client/src/App.tsx` shows that **four student pages are retired and unreachable**. `/student/dream-world`, `/student/visit`, `/student/town/:id` and `/student/certificate` are all `<Redirect to="/student/dashboard" />`, and none of the four modules is imported. They are audited below for completeness and flagged **RETIRED**; ~777 lines of the student folder is dead UI.

---

## Summary tables

### Screens at a glance

| Screen | Route | shadcn comps | Arb. values | Hex | Loading | Empty | Error |
|---|---|---|---|---|---|---|---|
| landing | `/` | **0** | 2 | ~~45~~ **17** | n/a | n/a | n/a |
| teacher/login | `/teacher/login` | 4 | 0 | 0 | ✅ | n/a | ✅ toast |
| teacher/dashboard | `/teacher/dashboard` | 7 | 5 | 0 | ✅ | ✅ | ✅ |
| teacher/create-assignment | `/teacher/assignments/new`, `…/:id/edit` | 7 | 1 | 1 | ✅ | n/a | ✅ |
| teacher/assignment-detail | `/teacher/assignments/:id` | 8 | 0 | 0 | ✅ | ✅ | ✅ |
| teacher/mark-submission | `/teacher/mark/:id` | 6 | 1 | 0 | ✅ | n/a | ✅ |
| teacher/submission-review | `/teacher/submissions/:id` | 4 | 2 | 0 | ✅ | ✅ | ✅✅ best-in-repo |
| teacher/gradebook | `/teacher/gradebook` | 6 | 0 | 0 | ✅ | ✅ | ✅✅ + boundary |
| teacher/reports | `/teacher/reports` | 4 | 2 | 0 | ✅ | ✅ partial | ✅ |
| teacher/daily-report | `/teacher/daily-report` | 5 | 0 | 0 | ✅ | ✅ | ✅ |
| teacher/export | `/teacher/export` | 5 | 0 | 0 | ✅ | ✅ | ✅ |
| teacher/students | `/teacher/students` | 7 | 1 | 0 | ✅ | ✅ | ✅ |
| teacher/lessons | `/teacher/lessons` | 10 | 4 | 0 | ✅ | ✅ | ✅ |
| teacher/resources | `/teacher/resources` | 11 | 4 | 0 | ✅ | ✅ | ✅ |
| student/login | `/student/login` | 4 | 0 | 0 | ✅ | n/a | ✅ toast |
| student/dashboard | `/student/dashboard` | 3 | 3 | 0 | ✅ | ✅ | ✅ |
| student/submit-assignment | `/student/submit/:id` | 8 | 1 | 0 | ✅ | n/a | ✅ |
| student/view-results | `/student/results/:id` | 4 | 0 | 0 | ✅ | ✅ | ✅ |
| student/resources | `/student/resources` | 4 | 2 | 0 | ✅ | ✅ | ✅ |
| student/lessons | `/student/lessons` | 4 | 2 | 0 | ✅ | ✅ | ✅ |
| student/treasure-island | `/student/treasure` | 2 | 0 | **23** | ✅ | ✅ per-tile | ✅ |
| student/penalty-shootout | `/student/penalty` | 3 | 6 | **28** | ✅ | ✅ | ✅ + boundary |
| student/dream-world | **RETIRED** | **0** | 10 | 8 | ✅ | ✅ nudge | ❌ |
| student/visit | **RETIRED** | **0** | 0 | 0 | ✅ | ✅ | ❌ |
| student/town-view | **RETIRED** | **0** | 0 | 0 | ✅ | ✅ | ✅ |
| student/certificate | **RETIRED** | **0** | 0 | 9 | ❌ | ✅ | ❌ |

Legend: ✅ present · ⚠️ present but flawed · ❌ absent · "conflated" = an error renders as "not found"/empty rather than as a failure.

### Totals

- **Arbitrary Tailwind values:** 48 occurrences across 18 files.
- **Inline hex colours:** ~~114~~ **86** occurrences across 6 files. ~~**Landing alone holds 45**~~ — **fixed in Rev 7: 45 → 17**, and the 17 left are a categorical palette and mascot artwork, kept on purpose. Treasure Island + Penalty Shootout still hold 51 between them (SVG artwork).
- **Loading state:** 25/26 screens (only `certificate` has none).
- **Empty state:** present wherever a list exists. ~~2 are miswritten~~ — **fixed in Rev 4**; 5 screens now separate "nothing here" from "your filters hid it".
- **Error state:** ~~only **4 of 26** screens distinguish a failed load from an empty one~~ — **fixed in Rev 3: 19 of 19** live query-bearing screens now do, and **15 of 15** mutations report failure. Only **4** are wrapped in an error boundary (unchanged).

---

## Cross-cutting findings

**F1 — Landing bypasses the design system entirely.** `landing.tsx` imports **zero** shadcn components and hardcodes **45 hex values** including the brand navy `#1F3864` and gold `#BF9000` (which are at least hoisted to `NAVY`/`GOLD` consts at lines 19–20 — the other 43 are not). Every colour on the app's front door is disconnected from `tailwind.config.ts` and from the theme. The file also forces `backgroundColor: "#F5F8FF"` on the root and `bg-white/85` on the header, so **the landing page ignores dark mode by design** while every other screen honours it.

> **CORRECTED (Rev 2).** Rev 1 said the remedy was to "pull landing's hex values
> into tokens", implying the tokens existed. They did not, and the mismatch was
> worse than a missing alias:
>
> | | Brand (CLAUDE.md house style, `landing.tsx`) | Theme token, Rev 1 |
> |---|---|---|
> | Navy | `#1F3864` | `--primary` = `#1F3E93` |
> | Gold | `#BF9000` | *no token existed* |
> | | | `--secondary` = `#DF2020` (red) |
>
> `index.css:6` commented `--primary` as *"Navy Blue from logo"*, but the value
> was a brighter, more saturated blue. **Two different navies disagreed with each
> other**, and gold had no token at all — so "map onto existing tokens" was not a
> thing anyone could have done.
>
> **Fixed in Rev 2.** `--brand-navy` and `--brand-gold` now exist and drive
> `--primary` and the `gold` utility. They are stored as `218.3 52.7% 25.7%` and
> `45.2 100% 37.5%` — one decimal place, because those round-trip *exactly* to the
> brand hex, whereas rounding to whole numbers drifts navy to `#1F3965` and gold
> to `#C29100`.
>
> **CLOSED (Rev 7).** `landing.tsx` is down from **45 hex literals to 17**, and
> every brand, surface and gradient colour now reads a token.
>
> The move that did most of the work was three lines: `NAVY` and `GOLD` were
> already hoisted to consts, so redefining them as `hsl(var(--brand-navy))` and
> `hsl(var(--brand-gold))` converted ~20 call sites at once. The rest were
> gradients, the page background, the header surface and the decorative ramp.
>
> **The dark-mode decision, made explicitly.** The page stays light — that was the
> original author's intent ("Explicit light background so the page stays bright
> even in dark theme") and it is a marketing front door, not an app screen. But it
> could not simply use `bg-navy` and stay light: `--brand-navy` *lightens* to
> `#6B90D1` in dark mode so it can sit on a dark ground, which on a forced-light
> page would be unreadable. So the page root now carries an **`.op-landing`**
> class, declared in `index.css`, which re-declares the brand and surface tokens
> at their light values for that subtree only. The page gets real tokens; the
> tokens cannot shift underneath it. To make the page follow the theme instead,
> delete that block and the class — the comment says so, and warns that the pastel
> feature cards and hero gradient need dark values designed first.
>
> **Two contrast failures fixed, not one.**
>
> | Pair | Before | After |
> |---|---|---|
> | White on gold — 4 CTAs (Sign Up, hero, ribbon, final) | **2.91:1 FAIL** | `text-gold-foreground` → **6.21:1 AA** |
> | Gold text on the cream stats bar | **2.73:1 FAIL** | `text-gold-ink` → **4.57:1 AA** |
>
> The second was **not in Rev 1** — it turned up only from checking every
> remaining pair rather than the one already known. It was the worse of the two,
> and it failed even the lenient 3:1 large-text floor despite the numbers being
> 32–42px extrabold.
>
> That produced a new token, **`--brand-gold-ink`** (`#8F6C00`, exposed as
> `text-gold-ink`). The distinction is worth keeping: **gold is a fill colour, not
> a text colour.** `#BF9000` is fine behind dark text and fails as text on
> anything light. All three themes (`:root`, `.dark`, `.op-landing`) declare it.
>
> **17 hex left, deliberately.** Six subject-tile colours and four feature-card
> pastels are a *categorical* palette — one arbitrary colour per subject, used as
> a tinted chip behind an emoji. Making them tokens would imply they mean
> something reusable. The other seven are mascot artwork (`#fff` eye glints and
> outlines, two `#EF6F6C` cheeks); a drawing is not themed. Both groups now carry
> a comment saying why they stay literal.
>
> **Still open elsewhere:** `create-assignment.tsx:1154` has the same
> white-on-gold button (`backgroundColor: "#BF9000"` + `text-white`). One line —
> `bg-gold text-gold-foreground` — but it is outside this finding's file.

**F2 — Error states are the systematic gap.** ✅ **FIXED in Rev 3** — see the box after this paragraph.

 22 of 26 screens have no `isError` branch. The dominant pattern is `isLoading ? <spinner> : data ? <content> : <"not found">` — so a dropped connection, a 500, or an expired session all render as *"Assignment not found"* / *"Results not found"* / *"Submission not found"*. `gradebook.tsx:340` and `submission-review.tsx:105` show the intended pattern (the latter branches on 401/404/500 with distinct copy and a "Go to login" action); nothing else follows it.

> **FIXED (Rev 3).** The `submission-review` pattern was extracted into
> **`client/src/components/QueryError.tsx`** rather than pasted into 15 files.
> It exports `statusOf`, `describeError(error, what)` and `<QueryError />`, and
> branches on 401 / 403 / 404 / 409 / 5xx / network with its own copy, offering
> "Sign in again" on an expired login and "Try again" otherwise. Errors arrive as
> `` `${status}: ${text}` `` from `lib/queryClient.ts`, so the status parse works
> app-wide.
>
> Every live screen that loads data now has an error branch — **19 of 19**.
> Three were worse than "unhelpful":
>
> - **`student/dashboard.tsx`** — a failed stats fetch rendered level 0, 0 XP and
>   0% average through `?? 0` fallbacks. Those are *real, meaningful values* for a
>   new student, so the page was telling a child something untrue about their own
>   progress. It now says it could not load, and the Average Score card shows an
>   em-dash rather than a confident `0%`.
> - **`student/treasure-island.tsx`** — a failed rewards fetch drew all twelve
>   chests locked, indistinguishable from a child who has collected nothing.
> - **`student/penalty-shootout.tsx`** — a failed subjects fetch read as "No games
>   ready yet — ask your teacher to set a few more", blaming the teacher for a
>   network problem.
>
> The four "conflated" screens (`assignment-detail`, `mark-submission`,
> `submit-assignment`, `view-results`) keep their *genuine* not-found branch — the
> query succeeded and returned nothing — but no longer route failures into it.
> `view-results` additionally distinguishes "your mark didn't load" from "your
> submission didn't load", which previously both read as "Results not found".
>
> Two extras that fell out of the same pass: `teacher/export.tsx` no longer reports
> a 500 as "No data matches the current filters", and `teacher/dashboard.tsx`'s
> archived-assignments `queryFn` now checks `res.ok` instead of letting a 500's
> error body flow through as data.
>
> **Also fixed:** `teacher/create-assignment.tsx` had *no* loading branch in edit
> mode (flagged separately in its own screen entry). It now gates the form behind
> a spinner and an error state, so a teacher can no longer start typing into
> create-mode defaults while the real assignment is still in flight.

**F3 — Mutation errors are silent on four screens.** ✅ **FIXED in Rev 3.** `teacher/students.tsx` (4 mutations), `teacher/lessons.tsx` (2) and `teacher/resources.tsx` (delete) have no `onError`. `deleteMutation` in `students.tsx:139` handles neither a thrown error nor `data.success === false` — deleting a student over a flaky connection fails with no feedback at all.

> **FIXED (Rev 3).** All **15** mutations across the live screens now have an
> `onError` that raises a destructive toast built from `describeError`, so a
> failed save names what failed and why. `students.tsx`'s delete additionally
> gained the missing `data.success === false` check — it previously reported
> "Student removed successfully!" whatever the server said.
>
> Coverage by file: `teacher/students.tsx` 4/4, `teacher/dashboard.tsx` 4/4,
> `teacher/assignment-detail.tsx` 3/3, `teacher/lessons.tsx` 2/2,
> `teacher/resources.tsx` 2/2.

**F4 — Two empty states say the wrong thing.** ✅ **FIXED in Rev 4 — on five screens, not two.** `teacher/lessons.tsx:830` renders *"No lessons yet — upload or record your first"* and `teacher/resources.tsx:698` renders *"Add your first learning resource"*, but both are reached when **filters** exclude everything, not only when the collection is genuinely empty. A teacher with 40 lessons who filters to Stage 3 + Accounting is told they have none. `gradebook.tsx:355` does this correctly (*"No records found — try adjusting your filters"*).

> **FIXED (Rev 4).** Rev 1 named two screens. Re-reading the filter code found the
> same defect on **five**, because three more were described as having "correct"
> empty states that happened to share the same flaw:
>
> | Screen | Was shown when filters hid everything | Named in F4? |
> |---|---|---|
> | `teacher/lessons.tsx` | "No lessons yet — upload or record your first" | yes |
> | `teacher/resources.tsx` | "Add your first learning resource to get started" | yes |
> | `student/lessons.tsx` | "Your teacher hasn't added any lessons for {form} yet" | no |
> | `student/resources.tsx` | "Your teacher hasn't added any resources for your form yet" | no |
> | `teacher/students.tsx` | "No students found" | no (flagged in its own entry) |
>
> The student pages are the worse two: they told a child *their teacher had not
> done something* when the real cause was the child's own dropdown.
>
> Each screen now has a distinct branch. Teacher copy names the count it does
> have ("You have 40 lessons — none of them match this class, subject and type")
> with a **Clear filters** button; student copy is gentler ("You have 6 lessons —
> just not in this subject and type") with **Show all my lessons**. The genuine
> first-run empty state is unchanged and still carries its add CTA.
>
> The two student screens needed a small refactor first: *scoping* (which
> resources this student may see, `isTeacherOnly` and form) and *user filters*
> (subject, type) were being decided in a single `.filter()` pass, so the code had
> no way to know which of the two had emptied the list. They are now separate
> passes — `availableResources` then `filteredResources`.
>
> `teacher/students.tsx` also picked up the icon and CTA its entry noted were
> missing. `teacher/dashboard.tsx` was already filter-aware and needed nothing.

**F5 — Native browser dialogs in three flows.** `window.confirm` at `teacher/dashboard.tsx:167`, `teacher/students.tsx:497` and `create-assignment.tsx:544`, in a codebase that already imports `AlertDialog` (used properly in `student/submit-assignment.tsx:271`).

**F6 — Dead code.** ✅ **FIXED in Rev 5.** Verified by occurrence count:

- `teacher/reports.tsx` — imports `PieChart`, `Pie`, `Cell`, `LineChart`, `Line`, `ResponsiveContainer` and declares `CHART_COLORS` (6 colours); **all seven are unused**. *(Rev 2: `CHART_COLORS` deleted as part of the F7 fix. The six unused recharts imports remain.)*
- `teacher/assignment-detail.tsx` — `isEditDialogOpen`, `handleOpenEditDialog`, `handleSaveEdit` declared and never referenced (the inline edit dialog was superseded by the `/edit` route); `lateDays` on `EnrichedSubmission` never rendered.
- `landing.tsx` — all four `FEATURES` carry `soon: false`, so the "Coming soon" ribbon at line 275 is unreachable.
- `student/submit-assignment.tsx:101` — `canEdit` computed, never used.
- `teacher/export.tsx:31` — `ExportLog.teacherEmail` never rendered.
- `student/penalty-shootout.tsx:39` — `SubjectChoice.questionCount` never rendered.
- `teacher/lessons.tsx` — `isPaused` state written but never read; `BookOpen` and `Play` imported unused.

> **FIXED (Rev 5).** Rev 1 found these by reading. Running the compiler as an
> oracle instead — `tsc --noEmit --noUnusedLocals --noUnusedParameters` — found
> **26** unused symbols across 13 files, and it is now **0**. The extra 19 were
> invisible to a manual read:
>
> | Kind | Count | Examples |
> |---|---|---|
> | Unused imports | 16 | 6 recharts in `reports.tsx`; `Play`/`BookOpen`/`CardDescription` in `lessons.tsx`; `Save` in `mark-submission.tsx`; `Image` in `create-assignment.tsx`; `XCircle` in `dashboard.tsx`; `FileArchive`, `X` in two shared components |
> | Unused destructured values | 5 | `announcementsLoading`, `archivedLoading` (`teacher/dashboard`); `location` in both login pages; a `map` index in `reports.tsx` |
> | Unused locals | 5 | `canEdit`; `isPaused`; the `assignment-detail` edit cluster |
>
> The `assignment-detail.tsx` cluster was larger than Rev 1 recorded. Removing the
> two handlers orphaned `updateAssignmentMutation` and four `useState` pairs —
> **nine declarations in total** for an inline edit dialog that the `/edit` route
> replaced. Its archive and extend-deadline mutations, and both dialogs that are
> genuinely in use, are untouched. `teacher/lessons.tsx`'s `isPaused` was a pause
> button that was never built: set in two places, read in none, with only Start
> and Stop in the UI.
>
> **Four things Rev 1 called dead were deliberately kept.** The rule applied:
> *unused imports and unreachable logic get deleted; a type field that describes a
> real API response is documentation, not dead code.* Deleting one makes the type
> less accurate without removing anything from the wire.
>
> | Kept | Why |
> |---|---|
> | `EnrichedSubmission.lateDays` | Describes a real field on `/api/submissions`. The fix is to *render* it (a late submission still looks identical to an on-time one) — that is a feature, not a cleanup. |
> | `ExportLog.teacherEmail` | Real field on `/api/export/logs`. |
> | `SubjectChoice.questionCount` | Real field on the penalty subjects endpoint. |
> | `landing.tsx` "Coming soon" ribbon | Not unreachable code — a **feature flag currently switched off**. All four `FEATURES` carry `soon: false`; setting one `true` renders it, and a comment documents the affordance. `tsc` does not flag it, which agrees with that reading. |
>
> Note this is a **maintenance win, not a bundle win** — rollup was already
> tree-shaking the unused recharts imports, so the shipped size is essentially
> unchanged.
>
> `noUnusedLocals` / `noUnusedParameters` are **not** enabled in `tsconfig.json`,
> so this will drift again. Turning them on now that the count is 0 would keep it
> there — worth doing, and it is the reason the count reached 26 in the first place.

**F7 — Hardcoded `hsl()` alongside the hex.** ~~`teacher/reports.tsx:55–71` hardcodes six `hsl(...)` chart colours plus two more inline at lines 232 and 254. Not hex, so outside the literal brief, but the same problem: chart colour lives outside the token system.~~

> **CORRECTED (Rev 2) — this was a live rendering bug, not a tidiness issue.**
>
> The two hardcoded values were not arbitrary. `hsl(224, 65%, 35%)` and
> `hsl(0, 75%, 50%)` were **character-for-character the light-mode values of
> `--chart-1` and `--chart-2`** at `index.css:59-60`. Someone read the tokens and
> inlined them.
>
> The dark-mode variants differ — `224 55% 55%` and `0 70% 55%` at
> `index.css:154-155` — so **the report charts kept their light-mode colours in
> dark mode**, on a page whose surrounding surfaces did switch. Rev 1 filed this
> under styling hygiene and missed that it rendered incorrectly.
>
> `--chart-1` … `--chart-5` were already declared in both themes *and* already
> exposed as Tailwind colour utilities in `tailwind.config.ts`. Five theme-aware
> tokens sat unused while the page hardcoded two of their light values.
>
> **Fixed in Rev 2** (`reports.tsx`):
> - `chartConfig` colours → `hsl(var(--chart-1))` / `hsl(var(--chart-2))`
> - both inline `<Bar fill="hsl(…)">` → the same vars (lines 230, 252)
> - the dead `CHART_COLORS` array (six more hardcoded `hsl()` literals, never
>   referenced) deleted
>
> `grep 'hsl(' reports.tsx` now returns only `var(--chart-N)` reads. The charts
> follow the theme, and since Rev 2 also repointed `--chart-1`/`--chart-2` at navy
> and gold, they are on-brand in both themes.
>
> **Still open:** the six unused recharts imports (`PieChart`, `Pie`, `Cell`,
> `LineChart`, `Line`, `ResponsiveContainer`) remain — that is F6, a different
> class of dead code.

**F8 — Card/row density is bimodal.** ✅ **FIXED in Rev 6** (where the data existed). Teacher list rows carry 4–7 fields; student list rows carry 2. The student dashboard's "Your Results" row (`dashboard.tsx:404`) shows only `assignmentTitle` + `submittedAt` — **not the score**, even though the row's entire purpose is a marked result and `totalMarks` is already on the object. The Penalty Shootout subject button and the Treasure Log locked card are the thinnest cards in the app (3 and 0 real fields).

> **FIXED (Rev 6).** Before changing anything, the three thin rows were checked
> against what the server actually sends — the useful question is not "is this row
> thin" but "is it thin while the data sits unused".
>
> **`student/dashboard.tsx` marked-result row — fixed, 2 fields → 4.**
> `routes.ts:999` already enriches every submission with
> `score: mark?.totalScore ?? null` alongside `totalMarks`. The page's *local*
> `EnrichedSubmission` interface simply omitted `score`, so the data arrived and
> was discarded. The row now shows `score/totalMarks` in place of the generic
> "View Results" badge — a label, replaced by the number the row exists for —
> colour-graded on the same 80/60/40 bands the results page uses, so a score looks
> the same wherever this student meets it. The "View Results" badge survives as
> the fallback for a marked submission with no recorded score.
>
> **Penalty Shootout subject button — fixed, 3 fields → 4.** `questionCount` is a
> real field on the subjects endpoint (`server/penalty.ts:114`) that was fetched
> and thrown away; it was kept in Rev 5 specifically so it could be rendered. The
> button now reads "5 penalties + 5 saves · 24 questions · played 3 times", which
> tells a child how much variety a subject holds before they commit to it.
>
> **Treasure Log locked card — left alone, deliberately.** Its 0 fields are the
> point: the file's own comment says treasures you have not found "stay a faded,
> dashed mystery". Naming a locked treasure would spoil the mechanic. Thin here is
> a design decision, not an oversight — the same reasoning that kept the landing
> "Coming soon" flag in Rev 5.
>
> **Revision to a Rev 5 decision.** Rev 5 kept `EnrichedSubmission.lateDays` on the
> grounds that it "describes a real field" and that the fix was to render it. The
> first half is right — it is a real column (`shared/schema.ts:147`) and reaches
> the client through the `...sub` spread. The second half was wrong: `lateDays` is
> **hardcoded to `0`** on both create and update (`storage.ts:296`, `:306`) and is
> never computed anywhere. Rendering it would print "0 days late" on every
> submission and quietly assert that nothing is ever late — while the student
> dashboard's own `isOverdue()` marks assignments OVERDUE. It stays unrendered.
> **The real fix is server-side: compute `lateDays` on submit.** Until then it is a
> stub column, not a display gap.

---

# Screen-by-screen

## `landing.tsx` — main page, route `/`

**shadcn components:** **none.** The only import is `wouter`'s `Link` plus the logo. Nav, buttons, cards, badges and the mobile menu are all hand-rolled `<div>`/`<a>`/`<button>`.

**Arbitrary Tailwind values (2)**

| Line | Value |
|---|---|
| 277 | `text-[10px]` (the unreachable "Coming soon" ribbon) |
| 362 | `rounded-[2rem]` |

**Inline hex colours (45 at Rev 1 → 17 after Rev 7)** — was the single largest concentration in the codebase. The table below is the Rev 1 state; everything in it except the subject colours, the feature pastels and the mascot artwork is now a token. See the corrected F1.

| Colour | Count | Lines |
|---|---|---|
| `#F2C94C` | 6 | 67, 198, 218, 221, 366, 367 |
| `#1F3864` | 6 | 9, 19, 185, 292, 336, 363 |
| `#fff` | 5 | 75, 82, 83, 98, 99 |
| `#3A5DA0` | 4 | 10, 185, 336, 363 |
| `#F5F8FF` | 3 | 111, 257, 383 |
| `#EF6F6C` | 3 | 25, 87, 88 |
| `#2B4A80` | 3 | 10, 185, 292 |
| `#BF9000` | 2 | 9, 20 |
| `#9FC0F0` | 2 | 219, 223 |
| `#FFF7E6` `#FFF3E0` `#F3E8FF` `#EF8FB4` `#E8F5E9` `#E3F2FD` `#E0A106` `#9B6DDF` `#8FB3E8` `#5B8DEF` `#3DB47E` | 1 each | 348, 38, 39, 30, 37, 36, 28, 29, 208, 26, 27 |

Only `#1F3864` and `#BF9000` are named (`NAVY`, `GOLD`, lines 19–20). The six subject colours, four feature-card pastels, three gradient stops and the page background are all inline literals.

**States:** no data fetching — no loading, empty or error state, and none needed. The only state is `menuOpen`.

**Information per card**

- Feature card (×4, line 267): **3** — emoji, title, description. The `soon` ribbon is dead (all four are `false`).
- Subject tile (×6, line 305): **2** — emoji, name. The colour is used only as a `+ "22"` alpha-suffixed background.
- Stat block (×4, line 351): **2** — value, label. Two of the four "values" are emoji (`⚡`, `📸`), so only 2 of 4 stats carry a number.
- Hero, school-photo slot, footer: static.

**Notes:** the school-photo section (line 330) is a labelled placeholder that ships to production reading *"Your school photo goes here (add attached_assets/school.webp — see the note in landing.tsx)"*. Nav "Games" and "Rewards" both point at `/student/login`, while the `/games` and `/rewards` routes rendering `ComingSoon` are unreachable from here.

---

## `teacher/login.tsx`

**shadcn (4):** Button, Card(+Content/Description/Header/Title), Input, Form(+Control/Field/Item/Label/Message).

**Arbitrary values:** none. **Hex:** none.

**States:** **Loading** ✅ full-screen `Loader2` while an already-authed teacher redirects (line 69); the submit button swaps to a spinner and disables. **Empty** n/a. **Error** ✅ destructive toast for both a rejected login and a thrown request; plus a dedicated session-expired banner at line 100 keyed off `?expired=1`.

**Density:** no rows. 2 form fields.

---

## `teacher/dashboard.tsx` — 971 lines, the largest teacher screen

**shadcn (7):** Button, Card(+Content/Description/Header/Title), Badge, Input, Textarea, Select(+Content/Item/Trigger/Value), Dialog(+Content/Description/Header/Title/Trigger).

**Arbitrary values (5)**

| Line | Value |
|---|---|
| 658 | `min-h-[100px]` (announcement textarea) |
| 717, 806, 865, 917 | `max-h-[600px]` ×4 (scroll containers) |

**Hex:** none. Uses `bg-orange-50`, `border-amber-300`, `text-primary` etc. throughout.

**States**

- **Loading** ✅ well covered — each of the 5 stat cards has its own inline spinner tied to its own query (`studentsLoading`, `assignmentsLoading`, `submissionsLoading`), and both list panels have a centred spinner.
- **Empty** ✅ good — "No assignments yet" with a create CTA (line 833), and "All caught up! No pending submissions." (line 887). Both vary their copy by the active class filter.
- **Error** ❌ **none.** Five `useQuery` calls (`assignments`, `students`, `submissions`, `announcements`, `archivedAssignments`), zero `isError` handling. A failed load renders as an empty dashboard reading "No assignments yet". The `archivedAssignments` query has a bare `queryFn` that calls `res.json()` without checking `res.ok` (line 91), so a 500's error body would flow through as data.

**Information per row/card**

| Element | Line | Fields |
|---|---|---|
| Stat card ×5 | 355–450 | **1** each (Total Students, Total Assignments, Pending Review, Marked, Total Submissions) |
| Missing-submission row | 506 | **5** — title, subject, form, due date, missing count |
| Nav card ×8 | 524–637 | **0** — all static title + description |
| Announcement row | 703 | **5** — title, priority badge, form badge, content (2-line clamp), created date |
| Assignment row, live | 267 | **5** — title, subject, form, target label, total marks |
| Assignment row, draft | 267 | **4** — title, Draft badge, subject, form (+ Publish button; no marks badge, no archive) |
| Class filter button ×7 | 749 | **3** — level, assignment count, pending count |
| Pending submission row | 897 | **2** — student name, assignment title |
| Archived row | 936 | **4** — title, subject, form, total marks |

**Notes:** delete uses `window.confirm` (line 167). `deleteAnnouncementMutation` (line 195) has no `onError`. The Missing-Submissions panel is computed client-side inside an IIFE in the JSX (line 460) — it needs all three of `assignments`, `submissions` and `students` loaded and silently renders nothing if any is missing.

---

## `teacher/create-assignment.tsx` — 1260 lines, largest file in the audit

**shadcn (7):** Button, Card(+Content/Description/Header/Title), Input, Textarea, Select(+…), Form(+…), Checkbox.

**Arbitrary values (1):** line 730 `min-h-[100px]` (instructions textarea).

**Hex (1):** line 1154 `backgroundColor: "#BF9000"` on the bottom "Add Question" button — the only hardcoded brand colour in the teacher folder, and it does not adapt to theme.

**States**

- **Loading** ⚠️ **the notable gap.** The submit path is handled (spinner + disabled button), but in **edit mode** (`/teacher/assignments/:id/edit`) there is **no loading branch** for the `editAssignment` query. The form renders immediately with its create-mode defaults (subject `MATHS`, form `Form 1`, one blank question) and then snaps to the real values when the prefill effect fires at line 209. On a slow connection a teacher briefly sees, and could start typing into, the wrong assignment.
- **Empty** n/a (it's a form). The student-picker at line 807 renders an empty box if the selected form has no students, with no message.
- **Error** ✅ toast on both `data.success === false` and a thrown request, with distinct create/update copy. Per-question answer-key validation failures each raise a targeted toast ("Question 3 — Add at least two options.").

**Density (per question card, line 852):** ~6 editable fields — question text, answer type, max score, images, the type-dependent answer key (options + correct / true-false / number + tolerance / accepted answers), explanation. Plus 6 actions (up, down, re-mark, duplicate, add image, delete). The bulk-paste preview row shows **2** — question text and joined answer key.

**Notes:** the re-mark button (line 843) correctly appears only for a saved, auto-markable question when submissions exist. Deleting a question that already has answers goes through `window.confirm` (line 544).

---

## `teacher/assignment-detail.tsx`

**shadcn (8):** Button, Card(+…), Badge, Input, Label, Textarea, Select(+…), Dialog(+…).

**Arbitrary values:** none — uses `max-h-96` from the scale. **Hex:** none.

**States**

- **Loading** ✅ page-level spinner (line 214), plus per-panel spinners in both tracker columns and inline spinners in all three stat cards.
- **Empty** ✅ two well-written ones: "No submissions yet" with a clock icon, and "All students have submitted!" in green with a tick — an empty state that reads as success.
- **Error** ⚠️ conflated. No `isError`; a failed `assignment` fetch falls to the `: (` branch at line 557 rendering **"Assignment not found"**. Three mutations (update, archive, extend) each have a proper `onError` toast — the queries do not.

**Information per row/card**

| Element | Line | Fields |
|---|---|---|
| Stat card ×3 | 341–380 | **1** each |
| Question block | 411 | **2** — question text, max score (+ ordinal) |
| Submitted row | 470 | **4** — name, submitted timestamp, marked/pending icon, score`/`totalMarks *or* "Needs Review" |
| Not-submitted row | 528 | **2** — name, form (+ Notify Parent action) |
| Extension row | 306 | **3** — student name, new due date, reason |

**Notes:** `lateDays` exists on `EnrichedSubmission` but is never shown, so a late submission is visually identical to an on-time one here — **still true**; the field was kept on purpose (see F6) and rendering it remains open work. The dead edit-dialog cluster — `isEditDialogOpen`, `handleOpenEditDialog`, `handleSaveEdit`, plus `updateAssignmentMutation` and four `useState` pairs it orphaned, **nine declarations** — was **removed in Rev 5**.

---

## `teacher/mark-submission.tsx`

**shadcn (6):** Button, Card(+…), Input, Textarea, Badge, Form(+…).

**Arbitrary values (1):** line 442 `min-h-[100px]`. **Hex:** none.

**States**

- **Loading** ✅ page spinner (line 180) + submit-button spinner.
- **Empty** n/a. **Error** ⚠️ conflated → "Submission not found" (line 471). Submit failures do toast.

**Density (per question card, line 224):** **5 displayed** — question text, max score, question reference images, the student's answer text, attached files (images inline, non-images as download tiles) — plus **2 inputs** (score, per-question feedback) and 3 quick-mark buttons.

**Note:** `answerHighlights` (line 56) is component-local only — the green/yellow/red highlighting a teacher applies while marking is lost on reload and never persisted or sent to the server.

---

## `teacher/submission-review.tsx` — the reference implementation for errors

**shadcn (4):** Card(+Content/Header/Title), Badge, Button, Input.

**Arbitrary values (2):** lines 215, 216 `text-[10px]` ×2 (type + teacher-adjusted badges). **Hex:** none.

**States**

- **Loading** ✅. **Empty** ✅ two distinct ones: "All correct! 🎉" as the mistakes summary, and a per-question "No answer given" *vs.* "Answer data not recorded" that correctly distinguishes a blank answer from a legacy row with no stored answers (line 234, backed by `review.hasAnswerData`).
- **Error** ✅✅ **the best in the repo.** `renderLoadError` (line 105) parses the status off the error and gives 401 / 404 / 500 / network their own message, and swaps the action button between "Go to login" and "Try again". Wrapped in `PageErrorBoundary` with a back link.

**Density (per question card, line 196):** up to **11** — index, type label, teacher-adjusted badge, question text, question images, student answer text, student answer images, correct answer, also-accepted list, numeric tolerance, verdict icon, `score/maxScore`, plus the override input. The densest card in the application.

---

## `teacher/gradebook.tsx` — the reference implementation for state coverage

**shadcn (6):** Card(+Content/Header/Title), Badge, Button, Input, Label, Select(+…).

**Arbitrary values:** none. **Hex:** none.

**States**

- **Loading** ✅ (line 336). **Empty** ✅ "No records found — Try adjusting your filters" — the only filter-aware empty state in the codebase. **Error** ✅✅ a dedicated `isError` branch (line 340) with an amber icon, "Couldn't load the Grade Book", and a Try-again button, explicitly commented as distinguishing failure from emptiness. Wrapped in `PageErrorBoundary`.

Also defensive throughout: `toRows()` (line 74) filters non-objects, `formatDate` returns `—` for an unparseable date, assignments with blank ids are excluded from the dropdown (they would crash the Select).

**Information per row/card**

| Element | Line | Fields |
|---|---|---|
| Summary card ×2 | 190–212 | **1** each |
| Per-question stat row | 314 | **4** — Q number, question text, `wrong of total`, % bar (red at ≥50% wrong) |
| Table row | 370 | **7** — student name, form, assignment, subject, score/total (linked), submitted at, status badge |

---

## `teacher/reports.tsx`

**shadcn (4):** Card(+…), Badge, Select(+…), Chart (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`).

**Arbitrary values (2):** lines 228, 250 `h-[300px]` ×2 (chart heights).

**Hex:** none. *(Rev 1 noted six hardcoded `hsl()` chart colours at lines 55–71 plus two inline `fill="hsl(...)"`. All eight are gone — see the corrected F7. The page now reads `hsl(var(--chart-1))` / `hsl(var(--chart-2))` and follows the theme.)*

**States**

- **Loading** ✅ (line 145). **Empty** ✅ partial — "No student data available", "No subject data available", "No form data available" per panel, and a page-level "No report data available yet." But the **Student Details table (line 288) has no empty state**: with no students it renders a header row over an empty `<tbody>`.
- **Error** ❌ none. A failed `/api/reports` renders "No report data available yet."

**Information per row/card**

| Element | Line | Fields |
|---|---|---|
| Summary card ×3 | 168–204 | **1** + a sub-label (Total Students / Average Score / Subjects) |
| Form comparison card | 265 | **3** — form, student count, average score (colour-graded) |
| Student table row | 297 | **7** — name, form, `submitted/total`, marked, `score/max`, average %, performance badge |
| Student perf. bar chart | 222 | 2 per bar — name, average % (capped at top 10, uncommunicated) |

---

## `teacher/daily-report.tsx`

**shadcn (5):** Button, Card(+Content/Header/Title), Badge, Select(+…), Input.

**Arbitrary values:** none. **Hex:** none.

**States**

- **Loading** ✅ both a spinner in the Generate button and a page-level spinner (line 306).
- **Empty** ✅ per-section and well phrased: "None submitted for this period." and "All students submitted. Well done! 🎉" in green. The low-attendance section hides itself entirely when empty.
- **Error** ✅ a dedicated `isError` card (line 312), plus a toast when clipboard copy fails with a manual-copy fallback instruction.

**Density**

- Submitted / not-submitted list item (lines 366, 391): **1** — full name (plus ordinal).
- Low-attendance item (line 414): **2** — full name, completion rate.
- Header line: **3** — date label, form, subject label.

**Note:** before the first Generate, the output area is simply absent — there is no idle/instructional state explaining that filters must be set first.

---

## `teacher/export.tsx`

**shadcn (5):** Button, Card(+…), Badge, Select(+…), Alert(+AlertDescription).

**Arbitrary values:** none. **Hex:** none.

**States**

- **Loading** ✅ "Calculating…" with a spinner for the preview; "Generating CSV…" on the download button.
- **Empty** ✅ two correctly separated: "Select filters above to see a preview." vs. "No data matches the current filters." (line 411); and "No exports yet. Download your first CSV above." for the log.
- **Error** ⚠️ partial. 401 is handled well — an inline `Alert` with a login link rather than a silent redirect (line 209). But **any other preview failure falls into the "No data matches the current filters" branch** (line 411), because the `queryFn` throws and `preview` is simply undefined. A 500 reads as "no matching data".

**Information per card/row**

| Element | Line | Fields |
|---|---|---|
| Export-type card ×4 | 238 | **0** — static label + description |
| Preview | 355–405 | **6** + optional date range — students, assignments, total rows, on-time, late, not submitted |
| Export log row | 481 | **4** — exported at, filter type, filter value, record count (`teacherEmail` is fetched but never shown) |

---

## `teacher/students.tsx`

**shadcn (7):** Button, Card(+…), Input, Label, Select(+…), Dialog(+Content/Description/Footer/Header/Title/Trigger), Badge.

**Arbitrary values (1):** line 463 `max-h-[600px]`. **Hex:** none.

**States**

- **Loading** ✅ (line 452). **Empty** ~~✅ but thin — a bare "No students found" with no icon and no CTA … also not filter-aware~~ **✅ fixed in Rev 4** — now two states ("No students in Form 2" with *Show all classes*, vs "No students yet" with an add CTA), both with an icon.
- **Error** ❌ **the worst coverage in the teacher folder.** The query has no `isError`. Of four mutations: `create` and `update` handle `data.success === false` but not a thrown request; `resetPassword` likewise; **`delete` (line 139) handles neither** — a failed delete is completely silent.

**Density (student row, line 466):** **5** — full name, student ID, form, gender, password-set state. Bulk-paste preview row: **2** — name, gender.

**Note:** removal goes through `window.confirm` (line 497).

---

## `teacher/lessons.tsx` — 908 lines

**shadcn (10):** Button, Card(+…), Input, Textarea, Label, Select(+…), Badge, Form(+…), Dialog(+…), Tabs(+Content/List/Trigger). The heaviest shadcn user after `resources`.

**Arbitrary values (4)**

| Line | Value |
|---|---|
| 588 | `max-h-[90vh]` (dialog) |
| 786, 822 | `w-[150px]` ×2 (filter triggers) |
| 801 | `w-[180px]` |

**Hex:** none.

**States**

- **Loading** ✅ list spinner (line 826); "Uploading recording…" for the recorder; spinner on the submit button.
- **Empty** ~~⚠️ **miswritten** (F4)~~ **✅ fixed in Rev 4** — a filtered-to-nothing list now reads "No lessons match these filters" with a Clear filters button; "No lessons yet" is reserved for a genuinely empty shelf.
- **Error** ❌ no `isError`; neither `createMutation` nor `deleteMutation` has an `onError`. The in-page `MediaRecorder_` does handle permission denial with a clear inline message (line 245), which is the one good error path here.

**Density (lesson card, line 831):** **7** — title, type badge, subject, form, description, duration, added-date, plus the embedded `LessonPlayer`. Bulk-paste preview row: **4** — title, resolved type, file URL, description.

---

## `teacher/resources.tsx` — 715 lines

**shadcn (11):** Button, Card(+…), Input, Textarea, Label, Select(+…), Badge, Form(+…), Switch, Dialog(+…). The most shadcn-dense screen in the app.

**Arbitrary values (4):** line 395 `max-h-[90vh]`; lines 583, 619 `w-[150px]` ×2; line 598 `w-[180px]`.

**Hex:** none.

**States**

- **Loading** ✅ (line 692). **Empty** ~~⚠️ miswritten~~ **✅ fixed in Rev 4** — filtered-to-nothing and genuinely-empty are now separate states. **Error** ~~❌ none~~ **✅ fixed in Rev 3** (query `isError`; both mutations have `onError`).

**Density (resource card, line 641):** **6** — title, type badge, teacher-only badge, description, subject, form, plus one action (Open Link or Download). Bulk-paste preview row: **3** — title, URL, description.

---

## `student/login.tsx`

**shadcn (4):** Button, Card(+…), Input, Form(+…).

**Arbitrary values:** none. **Hex:** none.

**States:** **Loading** ✅ (spinner on redirect at line 74, spinner on the submit button). **Empty** n/a. **Error** ✅ toasts for both a rejected login and a thrown request.

**Density:** 2 form fields, plus a first-time-login helper panel at line 174.

---

## `student/dashboard.tsx`

**shadcn (3):** Button, Card(+Content/Description/Header/Title), Badge. Notably thin for a 468-line screen — the XP bar, streak flame and every nav card are hand-built.

**Arbitrary values (3):** line 244 `max-h-[300px]`; lines 357, 413 `max-h-[400px]` ×2. **Hex:** none.

**States**

- **Loading** ✅ per-card inline spinners tied to their own queries (`assignmentsLoading`, `submissionsLoading`, `statsLoading`) plus panel spinners.
- **Empty** ✅ good and warm — "All caught up! No pending assignments." with a tick; "No results yet. Complete some assignments!". The Results panel has a smart three-way branch: marked → pending ("Awaiting Review" + "Edit Submission") → empty.
- **Error** ⚠️ boundary only. Four queries, no `isError` on any. Three `ErrorBoundary` wrappers (`xp-streak`, `treasure-card`, `penalty-card`) catch *render* crashes, not failed fetches. A failed stats load silently renders level 0 / 0 XP / 0% average via the `?? 0` fallbacks at lines 152–166 — **a fetch failure is indistinguishable from a genuinely new student**.

**Information per row/card**

| Element | Line | Fields |
|---|---|---|
| Stat card ×4 | 174–219 | **1** + sub-label each |
| Announcement | 229 | **4** — title, priority badge, content, date |
| Available-assignment row | 361 | **5** — title, subject, due date / OVERDUE, late-or-due-soon badge, total marks |
| Marked-result row | 417 | ~~**2**~~ **4** *(Rev 6)* — assignment title, submitted date, score, total marks (colour-graded) |
| Pending-submission row | 441 | **2** — assignment title, submitted date |
| Treasure / Penalty / nav cards | 262–336 | **0** — all static |

---

## `student/submit-assignment.tsx` — 660 lines

**shadcn (8):** Button, Card(+…), Textarea, Input, Badge, Alert(+AlertDescription), AlertDialog(+Action/Cancel/Content/Description/Footer/Header/Title), Form(+…).

**Arbitrary values (1):** line 491 `min-h-[120px]` (written-answer textarea). **Hex:** none.

**States**

- **Loading** ✅ page spinner (line 331), submit spinner, per-question upload spinner in each drop zone.
- **Empty** n/a. **Error** ⚠️ conflated → "Assignment not found" (line 649). Submission failures toast correctly. Notably, `handleAnswerFileDrop` (line 236) ignores a falsy `uploadFile` result — **a failed attachment upload is silent**; the student sees the spinner stop and no file appear.
- **Extra states, well done:** a late-submission `Alert` (line 590), an already-submitted `Alert` with three distinct messages for auto-marked-retry / teacher-marked-locked / editable (line 601), and a thin-answer `AlertDialog` (line 271) listing each short answer with its character count.

**Density (question card, line 370):** **3 displayed** — question text, max score, question images — plus one type-appropriate input (MCQ buttons / true-false / number / short text / textarea) and, for written questions only, an attachment drop zone with previews.

**Note:** `canEdit` is computed at line 101 and never used; the actual gate is `lockedByTeacherMark`.

---

## `student/view-results.tsx`

**shadcn (4):** Card(+…), Badge, Button, Progress.

**Arbitrary values:** none. **Hex:** none.

**States**

- **Loading** ✅ (line 96). **Empty** ✅ a genuinely good intermediate state — "Awaiting Review / Your submission is being reviewed by your teacher." (line 252) for a `SUBMITTED`-but-unmarked submission, distinct from the final fallback.
- **Error** ⚠️ conflated → "Results not found" (line 260). The `mark` query has no error handling; if it fails the page falls through to "Results not found" even though the submission loaded fine.

**Density (question card, line 168):** **7** — correct/incorrect icon, question text, question images, `score/maxScore` badge, the student's answer text, the student's attached images, per-question feedback. Header card: **6** — title, subject, form, `rawScore/totalMarks`, grade label, percentage + progress bar, plus optional XP badge and resource payout.

---

## `student/resources.tsx`

**shadcn (4):** Button, Card(+Content/Header/Title), Badge, Select(+…).

**Arbitrary values (2):** line 93 `w-[180px]`, line 114 `w-[150px]`. **Hex:** none.

**States:** **Loading** ✅ (line 128). **Empty** ✅ — but Rev 1's "correctly phrased" was too generous: it also fired on a narrow filter, telling a student their teacher had added nothing when their own dropdown was the cause. **✅ fixed in Rev 4.** **Error** ~~❌ none~~ **✅ fixed in Rev 3**.

**Density (resource card, line 135):** **5** — title, type badge, subject badge, description, and one action (Watch Video or Download).

---

## `student/lessons.tsx`

**shadcn (4):** Card(+Content/Header/Title), Badge, Select(+…), Button *(added in Rev 4 — the page previously had no buttons at all)*.

**Arbitrary values (2):** line 72 `w-[180px]`, line 93 `w-[150px]`. **Hex:** none.

**States:** **Loading** ✅ (line 108). **Empty** ✅ "No lessons available / Your teacher hasn't added any video or audio lessons for {form} yet." — names the student's form. Same caveat as `student/resources`: it also fired on a narrow filter, **✅ fixed in Rev 4**. **Error** ~~❌ none~~ **✅ fixed in Rev 3**.

**Density (lesson card, line 113):** **6** — title, type badge, subject badge, duration, description, plus the `LessonPlayer`.

---

## `student/treasure-island.tsx`

**shadcn (2):** Card(+CardContent), Progress. The map, chests and island are hand-drawn SVG.

**Arbitrary values:** none.

**Inline hex (23)** — all inside the SVG artwork, none themed.

| Purpose | Colours | Lines |
|---|---|---|
| Chest, unlocked | `#a86a2e` `#c07d3a` `#6b4a22` `#5e3a18` | 74–77 |
| Chest, locked | `#a49e93` `#b9b4a9` `#7d786f` ×2 `#8d8880` | 74–77, 129 |
| Gold / treasure | `#f6b93b` ×4, `#ffe08a` | 99, 129, 171, 172, 170 |
| Island & sea | `#a8d8ea` `#f3e2b3` `#e0cd93` `#b7d98f` | 177, 190, 191, 196 |
| Trail | `#8a6d3b` `#6b4f2a` | 206, 207 |
| Other | `#2e1c0e` `#000000` `#ffffff` | 98, 85, 184 |

**States:** **Loading** ✅ (line 305). **Empty** ✅ handled per-tile rather than per-page — an uncollected treasure renders as `❓` + "Locked" + "Keep going to unlock this treasure!", and the map marks the next chest with a pulsing glow. A student with zero rewards gets a complete, encouraging screen. **Error** ❌ none — a failed rewards fetch renders as *all twelve locked*, which reads as real data.

**Density**

- Treasure Log card, earned (line 322): **3** — emoji, name, description.
- Treasure Log card, locked: **0** real fields — `❓`, "Locked", generic encouragement.
- Map chest (line 71): **3** — state (open/next/locked), emoji, name via `<title>`.
- Progress card: **2** — collected count, total.
- XP bar: **4** — level, XP into level, XP for next level, percent (all silently `?? 0` on failure).

---

## `student/penalty-shootout.tsx` — 669 lines

**shadcn (3):** Card(+Content/Header/Title), Button, Badge. The pitch, goal, keeper and ball are all hand-drawn SVG driven by a `<style>` block of keyframes (line 244).

**Arbitrary values (6)**

| Line | Value |
|---|---|
| 335, 400, 422 | `active:scale-[0.99]`, `scale-[0.98]`, `scale-[0.97]` — three different press-scales for three button styles |
| 350, 353, 378 | `text-[10px]` ×3 |
| 563 | `bg-[#2e7d32]` (see hex) |

**Inline hex (28)** — the second-largest concentration.

| Purpose | Colours | Lines |
|---|---|---|
| Pitch | `#2e7d32` ×2 (one as an arbitrary class), `#317a35`, `#1b3b1d` | 563, 566, 568, 572 |
| Crowd | `#f4c542` `#e0e0e0` `#4a90d9` `#e07a5f` | 574 |
| Goal / net / ball | `#ffffff` ×9, `#2f3640` ×4 | 579–630 |
| Keeper & striker | `#ffd7a8` ×2, `#f4c542` ×3, `#1F3864` | 600–637 |
| Ball shadow | `#000000` | 614 |

`#1F3864` at line 637 is the brand navy, hardcoded again rather than shared with the `NAVY` constant in `landing.tsx`.

**States**

- **Loading** ✅ subject-list spinner (line 310) and a `marking` phase that renders "…" while the server marks a shot (line 445) — the comment at line 143 explains this phase exists specifically to stop the pitch reacting before the result arrives.
- **Empty** ✅ excellent — "No games ready yet" explains *why* (a shootout needs `MIN_QUESTIONS` questions in a subject) and what to do ("Ask your teacher to set a few more").
- **Error** ✅ a persistent `errorText` banner (line 296) covering start, finish and save failures, plus `PageErrorBoundary`. A mid-game network drop is deliberately degraded rather than fatal — the shot counts as missed (line 160) instead of freezing the pitch.

**Density**

- Subject button (line 331): **3 shown** — subject, best score`/`out of (or a "New!" badge), games played. `questionCount` is fetched and never displayed.
- Results "How you did" card (line 486): **4** — penalties scored, saves made, personal best, XP earned (conditional). `result.perRound` is fetched but unused in the render.
- In-play header: **4** — round, shot index, subject, live score.

---

# Retired pages (present in the folder, unreachable from the app)

All four redirect to `/student/dashboard` in `App.tsx` and are not imported. Audited for completeness.

## `student/dream-world.tsx` — 497 lines — **RETIRED**

**shadcn:** **none.** Every control is a hand-rolled `<button>`; the two modals are hand-built fixed overlays rather than `Dialog`.

**Arbitrary values (10):** lines 242, 347, 485, 492 `text-[11px]` ×4; lines 387, 433 `z-[100]` ×2; line 251 `bg-[#BF9000]` + `text-[#8a6a00]` + `text-[#E0B93A]`; line 270 `bg-[#BF9000]` + `border-[#BF9000]`.

**Hex (8):** `#BF9000` ×3 (251, 270 ×2), `#8FD673` ×3 (391, 444, 476 — the grass tile behind every building preview), `#E0B93A`, `#8a6a00`.

**States:** **Loading** ✅ (line 302). **Empty** ✅ an "empty wallet" nudge linking to the dashboard. **Error** ❌ none.

**Density:** BuildingTile (line 461) **4** — name (or "Locked"), cost breakdown, unlocked state, "N more to unlock". Wallet chip **1** each ×4. Town banner **5** — town name, mayor, founded date, town value, rename affordance.

## `student/visit.tsx` — 77 lines — **RETIRED**

**shadcn:** none. **Arbitrary values:** none. **Hex:** none.

**States:** Loading ✅; Empty ✅ ("No classmates have started a town yet — be the first to show yours off!"); Error ❌.

**Density:** neighbour row **3** — town name (falling back to "{firstName}'s town"), mayor first name, building count.

## `student/town-view.tsx` — 94 lines — **RETIRED**

**shadcn:** none. **Arbitrary values:** none. **Hex:** none.

**States:** Loading ✅; Empty ✅; Error ✅ — one of only four screens with an `isError` branch, and it prefers the server's own message with a sensible fallback ("You can only visit towns in your own class"), though error and empty share the one branch.

**Density:** banner **6** — town name, mayor, founded date, building count, town value, award.

## `student/certificate.tsx` — 109 lines — **RETIRED**

**shadcn:** none — the whole certificate is inline `style={{…}}`.

**Arbitrary values:** none. **Hex (9):** `#1F3864` (14), `#BF9000` (15), `#fff` (38), `#444` ×2 (80, 82), `#333` (87), `#555` ×3 (90, 95, 100). The three greys are print-only body text and exist nowhere else in the design system.

**States:** **Loading** ❌ **none** — the only screen in the audit without one; while the query is in flight `award` is null, so it shows the no-award message and then swaps to the certificate. **Empty** ✅ "No award yet — ask your teacher to run the Term Awards! 🏆". **Error** ❌ none — a failed fetch also shows "No award yet".

**Density:** certificate **7** — student full name, form, town name, award emoji, award name, award blurb, award term.

---

## Done so far

| | What | Where |
|---|---|---|
| ✅ | **F7 fixed** — charts read `--chart-1`/`--chart-2`; dark mode correct; dead `CHART_COLORS` deleted | `reports.tsx` |
| ✅ | **F1 unblocked** — brand tokens now exist; `--primary` is the real brand navy, gold has a token | `tailwind.config.ts`, `index.css` |
| ✅ | Design token layer: Carbon spacing (13 steps), Carbon type scale (line-height + letter-spacing per step), Carbon grey ramp, two radius values | `tailwind.config.ts`, `index.css` |
| ✅ | Build pipeline documented (Tailwind 3.4.17; `@tailwindcss/vite` inert) | this file |
| ✅ | **F2 fixed** (Rev 3) — 19/19 live query-bearing screens distinguish a failed load from an empty one | new `components/QueryError.tsx` + 15 screens |
| ✅ | **F3 fixed** (Rev 3) — 15/15 mutations report failure; `students.tsx` delete also gained its missing `success === false` check | 5 screens |
| ✅ | Edit-mode loading gate on `create-assignment.tsx` (was: form showed create defaults while loading) | `create-assignment.tsx` |
| ✅ | **F4 fixed** (Rev 4) — 5 screens separate "nothing here" from "filters hid it", each with a way to clear | 5 screens |
| ✅ | **F6 fixed** (Rev 5) — 26 unused symbols removed, compiler-verified to 0 | 13 files |
| ✅ | **F8 fixed** (Rev 6) — marked-result row and penalty subject button now show the data they were already fetching | 2 screens |
| ✅ | **F1 closed** (Rev 7) — landing 45 → 17 hex; `.op-landing` scope makes the light-mode opt-out explicit; 2 WCAG failures fixed; new `--brand-gold-ink` token | `landing.tsx`, `index.css`, `tailwind.config.ts` |

Verified after each revision: `vite build` passes and `tsc --noEmit` is clean.
Rev 2 additionally confirmed **0 of 216** spacing/type/radius utilities referenced
in source went missing from the built CSS, and that every colour pair in the new
palette meets WCAG AA or better (tightest: dark-mode primary at 5.63:1).

## Suggested order of work

1. ~~**F2 / F3**~~ — **done in Rev 3.**
2. ~~**F4**~~ — **done in Rev 4.**
3. ~~**F1 remainder**~~ — **done in Rev 7.** Leftover: the same white-on-gold button in `create-assignment.tsx:1154` (one line).
4. ~~**F6**~~ — **done in Rev 5.** Follow-up: enable `noUnusedLocals` and `noUnusedParameters` in `tsconfig.json` so it cannot drift back.
5. ~~**F8**~~ — **done in Rev 6.** Follow-up raised by it: `lateDays` is a stub column, always `0`; computing it server-side would make late submissions visible on `assignment-detail`.
6. **Legacy spacing burn-down** — 328 uses across 56 class names sit outside the Carbon scale and are quarantined in `LEGACY_SPACING` in `tailwind.config.ts` with a burn-down list. Fixing the call sites is what lets the block be deleted and the scale actually enforced.
7. **Arbitrary values** — `text-[10px]` / `text-[11px]` / `text-[0.8rem]` in 12 places (10 in pages, 2 in vendored components) and `rounded-[2rem]` in `landing.tsx` bypass the new scales entirely; they map onto `text-caption-01` and `rounded-lg`.
8. **Retired pages** — decide whether the four Dream World modules stay in the tree; if they do, a header comment on each would stop the next reader auditing them as live.
9. **Housekeeping** — remove `@tailwindcss/vite` from `package.json` (see Build & theme configuration).
