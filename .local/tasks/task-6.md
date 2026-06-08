---
title: Grade Book module
---
# Grade Book Module

  ## What & Why
  Add a dedicated Grade Book page for teachers at `/teacher/gradebook`. It shows every student × assignment combination in a table so teachers can quickly see who submitted, their score, and when — all in one place. Filters and export make it useful for reporting to parents and school management.

  ## Done looks like
  - A "Grade Book" link appears in the teacher dashboard quick-action cards
  - The page shows a filterable table with columns: Student Name, Form, Assignment Name, Subject, Mark/Score, Submitted At, and Status
  - Status is shown as a green "Submitted" badge or a red "Not Submitted" badge
  - Teachers can filter by assignment name (searchable dropdown or text), date range (from/to), and submission status
  - Two summary cards at the top: "Submitted" count and "Not Submitted" count (for the currently filtered view)
  - An "Export CSV" button downloads the filtered table as a CSV file
  - A "Print / Export PDF" button triggers the browser print dialog so teachers can save as PDF — the page has print-friendly styles so the table renders cleanly without the header/filters

  ## Out of scope
  - Editing marks or scores from the grade book (teachers mark via the existing mark-submission page)
  - Generating PDF server-side (browser print is sufficient)

  ## Tasks
  1. **Backend API endpoint** — Add `GET /api/gradebook` that joins assignments, students, submissions, and marks. For each active (non-archived) assignment, return one row per eligible student with: studentId, studentName, form, assignmentId, assignmentTitle, subject, totalMarks, submittedAt (or null), score (from marks, or null), status ("SUBMITTED"/"MARKED"/"NOT_SUBMITTED"), lateDays. Respect `targetStudentIds` so only assigned students appear. Accept optional query params: `form`, `assignmentId`, `status`, `dateFrom`, `dateTo`.

  2. **Grade Book page** — Create `client/src/pages/teacher/gradebook.tsx`. Fetch `/api/gradebook` with TanStack Query. Show two summary stat cards ("Submitted" and "Not Submitted") computed from the returned data. Render a table with the columns above. Add filter controls (assignment dropdown populated from the results, status radio/select, date-range from/to inputs). Wire the filters to query params so the backend does the filtering. Include an "Export CSV" button that calls `/api/export/grades` (existing endpoint) and a "Print / PDF" button that calls `window.print()`. Add a `@media print` style block that hides the header, filters, and action buttons during printing.

  3. **Navigation wiring** — Add a "Grade Book" quick-action card to the teacher dashboard alongside the existing "Reports & Analytics" and "Export Grades" cards. Register `/teacher/gradebook` as a route in `client/src/App.tsx`.

  ## Relevant files
  - `server/routes.ts`
  - `server/storage.ts`
  - `shared/schema.ts`
  - `client/src/App.tsx`
  - `client/src/pages/teacher/dashboard.tsx`