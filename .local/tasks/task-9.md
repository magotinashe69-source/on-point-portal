---
title: Teacher data export page
---
# Comprehensive Teacher Data Export Page

## What & Why
Replace the two simple direct-download links on the teacher dashboard with a dedicated "Export Data" page that gives teachers four filtered export options, a live preview panel showing row counts before downloading, and a log of previous exports. The CSV format follows the detailed spec: one row per student × assignment (cross-joined so non-submissions still appear), sorted by class → subject → student → date, with ~38 columns grouped across school identity, class, student, assignment details, submission status, marks/performance, and teacher record.

## Done looks like
- "Export Data" card on the teacher dashboard navigates to `/teacher/export` — visible to teachers only, never students
- Four export options on the page: Full master export, Filter by term (derived from due-date month), Filter by class + subject, Filter by single assignment
- A preview panel that updates when filters change, showing: total students included, total assignments, total rows, breakdown of submitted / late / not submitted
- "Download CSV" button triggers a streamed download with a date-stamped filename (e.g. `HomeworkData_Master_2026-04-05.csv`)
- The CSV has a header row with ~38 lowercase underscore-named columns; each row is one student × assignment pair; blanks are truly blank (not "null" or "N/A"); submission_status is always populated; numbers are unquoted; text is quoted
- An export log table beneath the download button shows the last 20 exports: date, filter applied, and record count — persisted server-side across sessions
- Unauthenticated access to the export page or API routes redirects to teacher login; students who try the URL are redirected away

## Out of scope
- Editing or deleting export log entries
- Per-question mark breakdown in the CSV (only total score is exported)
- Storing school name, academic year, term number, week number, student DOB, or teacher names beyond the single hardcoded teacher account — these will be filled with sensible defaults or left blank when not stored in the DB
- Email delivery of export files

## Tasks
1. **Schema + storage: export log table** — Add an `exportLogs` table (id, exportedAt, teacherEmail, filterType, filterValue, recordCount) to `shared/schema.ts`, run `npm run db:push`, and add `createExportLog` / `getExportLogs` methods to `IStorage` and `DatabaseStorage` in `server/storage.ts`.

2. **Backend: preview endpoint** — Add `GET /api/export/preview` accepting the same filter params as the download endpoint (type, term, form, subject, assignmentId). Return JSON with totalStudents, totalAssignments, totalRows, submitted, late, notSubmitted counts. Apply the cross-join eligibility logic (form matching + targetStudentIds) so counts are accurate. Derive "term" from the assignment dueDate month (Jan–Mar = Term 1, Apr–Jun = Term 2, Jul–Sep = Term 3, Oct–Dec = Term 4).

3. **Backend: master export endpoint** — Add `GET /api/export/master` accepting type/term/form/subject/assignmentId query params. Fetch all data in parallel (students, assignments, submissions, marks pre-indexed in Maps). Stream the response with `res.write`/`res.end`. Produce ~38 CSV columns per the spec groups — map DB fields to spec columns; hardcode `school_name = "On Point Education Centre"`; derive grade symbol (A–F) and performance band; leave week_number / student_dob / assignment_type blank. After streaming, log the export to the exportLogs table. Return 401 with a redirect hint if no teacher is logged in. Filename: `HomeworkData_[Filter]_YYYY-MM-DD.csv`.

4. **Backend: export logs endpoint** — Add `GET /api/export/logs` that returns the last 20 export log entries from the DB. Check teacher auth before responding.

5. **Frontend: export page** — Create `client/src/pages/teacher/export.tsx`. Show four export-type option cards/tabs (Full, By Term, By Class+Subject, By Assignment). When a filter is selected, call `/api/export/preview` and display the counts in the preview panel. "Download CSV" button calls `/api/export/master` with current filters, shows a loading spinner, then shows a confirmation with the record count and filename. Below the download section, render an export log table (from `/api/export/logs`). Include a sticky page header matching the rest of the teacher portal (logo, back-to-dashboard link, theme toggle).

6. **Navigation wiring** — Register `/teacher/export` in `client/src/App.tsx`. On the teacher dashboard (`client/src/pages/teacher/dashboard.tsx`), replace the old "Export Grades" and "Data Science Export" cards with a single "Export Data" card that links to the new page. Add a route guard so students reaching `/teacher/export` are redirected to `/student/login`.

## Relevant files
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts`
- `client/src/App.tsx`
- `client/src/pages/teacher/dashboard.tsx`
- `client/src/pages/teacher/export.tsx`