---
title: Remove late submission penalty
---
# Remove Late Submission Penalty

## What & Why
The 2-marks-per-day late submission penalty system is being removed entirely. Students who submitted late should have their full raw score restored in every view. The `lateDays` column is kept in the database schema to avoid a destructive migration, but its value is reset to 0 for all existing submissions and it is no longer written to or used in any calculation or display.

## Done looks like
- No penalty is applied anywhere — students see their full raw score on the results page with no deduction alert.
- The teacher mark page shows no orange "Late Submission" penalty card.
- The gradebook shows raw scores with no orange clock/deduction indicator.
- The CSV export uses raw `totalScore` with no `effectiveScore` deduction column.
- All existing submissions that previously showed late penalties now display the full score (because `late_days` is reset to 0 in the database).
- New submissions are stored with `lateDays = 0` and no late calculation is ever performed.

## Out of scope
- Removing the `lateDays` column from the database schema (kept to avoid a destructive migration)
- Any changes to how assignments or deadlines are displayed

## Tasks
1. **Reset existing late_days in the database** — Run `UPDATE submissions SET late_days = 0` via the app's database connection or `npm run db:push` equivalent so all previously-penalised submissions immediately show their full raw score. This is the step that "gives marks back."

2. **Remove lateDays calculation from server routes** — In `server/routes.ts`, remove the lateDays computation block from the POST `/api/submissions` handler and the PUT `/api/submissions/:id` handler (always pass 0). In the CSV export handler, replace `effectiveScore` with the raw `mark.totalScore` directly. Remove all other `lateDays`/`daysLate` references in routes (gradebook data endpoint, submission tracker endpoint).

3. **Remove lateDays from storage layer** — In `server/storage.ts`, remove the optional `lateDays` parameter from `createSubmission()` and `updateSubmission()` signatures; always store `lateDays: 0`. Remove the parameter from the `IStorage` interface as well.

4. **Remove penalty display from all UI** — In `client/src/pages/teacher/mark-submission.tsx`, delete the orange "Late Submission" penalty card. In `client/src/pages/student/view-results.tsx`, remove the `latePenalty`/`effectiveScore` calculation and show raw score everywhere; remove the orange late-penalty alert. In `client/src/pages/teacher/gradebook.tsx`, remove the orange clock/deduction indicator and show raw scores only.

## Relevant files
- `server/routes.ts`
- `server/storage.ts`
- `client/src/pages/teacher/mark-submission.tsx`
- `client/src/pages/student/view-results.tsx`
- `client/src/pages/teacher/gradebook.tsx`
- `shared/schema.ts`