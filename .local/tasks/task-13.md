---
title: Submission warnings and revisit after submit
---
# Submission Warnings & Revisit After Submit

## What & Why
Students currently have no feedback when they write very thin answers before submitting, and once they submit they cannot navigate back to their work from the dashboard — submitted (awaiting review) assignments appear as static, unclickable items. This task fixes both gaps.

## Done looks like
- When a student clicks "Submit Assignment", if any answer has fewer than 30 characters, a clear warning dialog appears listing the question numbers with thin answers, with a count of characters written vs. the minimum. The student can either go back and improve the answer or confirm and submit anyway.
- On the student dashboard, the "Awaiting Review" items in the Results panel are clickable and link back to `/student/submit/:assignmentId`, allowing the student to view and edit their answers until the teacher marks it.
- A small "Edit Submission" label/badge appears on awaiting-review items so students understand they can still go back.
- After returning to the submit page, the existing "You've already submitted. You can update your answers until your teacher marks it." alert is already shown — no duplicate messaging needed.

## Out of scope
- Server-side minimum length enforcement (client-side warning is sufficient)
- Warning for missing file attachments (text answers only)
- Changing the submission flow for marked assignments (already locked with a clear message)

## Steps
1. **Add pre-submit warning dialog** — In the submit page, before the form's `onSubmit` fires, check each answer's trimmed text length against a 30-character minimum. If any fall short, intercept the submit and show a confirmation dialog that lists the affected questions (e.g., "Question 2 — 12 characters written, minimum 30 recommended"). Include two buttons: "Go Back & Improve" (closes dialog) and "Submit Anyway" (proceeds with submission). Use Shadcn's `AlertDialog` component.

2. **Make awaiting-review submissions clickable** — In the student dashboard, replace the static `div` wrapper around pending (not-yet-marked) submissions with a `Link` pointing to `/student/submit/:assignmentId`. Add an "Edit Submission" badge alongside the existing "Awaiting Review" badge so it's clear the student can still make changes. The submit page already handles the editing state gracefully.

## Relevant files
- `client/src/pages/student/submit-assignment.tsx`
- `client/src/pages/student/dashboard.tsx:332-354`