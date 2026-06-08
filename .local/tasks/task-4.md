---
title: Late submission penalty system
---
# Late Submission Penalty System

## What & Why
Teachers want students to be able to submit overdue assignments (instead of being locked out), but late work should carry a penalty of 2 marks deducted per day it is overdue. This encourages timely submission while still allowing work to be handed in late.

## Done looks like
- Students can submit assignments after the deadline — the submit button is no longer disabled for overdue work
- A clear warning is shown: "This assignment is X days overdue. A penalty of Y marks will be deducted from your score."
- When a student submits late, the number of days overdue is stored on the submission
- When the teacher marks the submission and the student views results, the effective score shows the raw mark minus the penalty (e.g., "18/20 → 14/20 after 2-day late penalty")
- Teachers see the late penalty flag on the marking page so they are aware when reviewing
- Students with individual deadline extensions are judged against their extended deadline, not the original

## Out of scope
- Teacher ability to waive the late penalty per student (future feature)
- Penalty for partial-day lateness (whole days only, rounded down)

## Tasks
1. **Schema change** — Add a `lateDays` integer column (default 0) to the submissions table so late penalty info is persisted.

2. **Backend: allow late submissions and calculate late days** — Remove the deadline enforcement block in the submission creation endpoint. When a submission is created or updated, calculate how many days overdue it is (comparing submission time to due date, accounting for individual extended deadlines) and store it in `lateDays`.

3. **Student submit page: warning and allow late** — Remove the "deadline passed" lock. Instead show a visible orange/red warning banner when the assignment is overdue, telling the student how many marks will be deducted. Keep the submit button active.

4. **Teacher mark page: show late penalty indicator** — Display a "Late submission — X days overdue, -Y marks penalty" badge so the teacher knows when reviewing.

5. **Student results page: show effective score** — Display both the raw marked score and the effective score after the late penalty is applied (e.g., "Raw: 18/20 | Effective: 14/20 after 2-day late penalty").

## Relevant files
- `shared/schema.ts`
- `server/routes.ts`
- `server/storage.ts`
- `client/src/pages/student/submit-assignment.tsx`
- `client/src/pages/teacher/mark.tsx`
- `client/src/pages/student/results.tsx`