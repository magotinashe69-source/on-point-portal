# Daily Homework Submission Report

## What & Why
Teachers need a fast way to see who submitted and who didn't on any given day — and share that information with parents over WhatsApp. The current analytics page shows charts and trends, but provides no copy-paste-ready daily snapshot. This feature adds a dedicated "Daily Report" page that generates a formatted, emoji-rich text report ready to paste straight into a WhatsApp group, with one click.

## Done looks like
- A new "Daily Report" button/link on the teacher dashboard and/or the existing reports page navigates to `/teacher/daily-report`
- The teacher selects: **Date preset** (Today / Yesterday / This Week / Custom), **Class** (Stage 3–6, Form 1–2), and **Subject** (All Subjects or one specific subject)
- Clicking "Generate Report" fetches live data and displays a formatted report showing:
  - ✅ Students who submitted homework on the selected date (for the selected class/subject)
  - ❌ Students who did not submit (assigned to that class but no submission on that date)
  - ⚠️ Students below 60% overall homework completion who need to catch up (for the selected class)
  - A pre-written parent message at the bottom
- A **"Copy WhatsApp Message"** button copies the full formatted text to the clipboard and shows a brief confirmation toast
- The report header shows the selected date, class, and subject clearly
- No technical fields or IDs are shown — names only
- The page is mobile-friendly and readable on a phone screen

## Out of scope
- Sending WhatsApp messages directly (copy-to-clipboard only)
- Email delivery of reports
- Scheduling/automating reports
- Modifying existing analytics charts on `/teacher/reports`

## Steps

1. **Backend: new `/api/reports/daily` endpoint** — Accept query params `date` (ISO date string, e.g. `2026-05-05`), `form`, and `subject` (optional, omit = all). Return three lists: `submitted` (students with ≥1 submission on that date for matching assignments), `notSubmitted` (eligible students with no submission), and `lowAttendance` (students whose total submissions / total assigned < 0.60 for all-time or current calendar year — compute from existing submissions and assignments data). Each student entry should only include `fullName`. No new schema changes needed — query existing `assignments`, `submissions`, and `students` tables.

2. **New page `/teacher/daily-report`** — Create `client/src/pages/teacher/daily-report.tsx`. Add date-preset buttons (Today, Yesterday, This Week, Custom date picker), class dropdown, and subject dropdown. Wire them to the backend endpoint using TanStack Query (disabled until the teacher hits "Generate"). Show a loading spinner while fetching.

3. **Report display and copy button** — Once data loads, render the three sections (submitted, not submitted, low attendance) with their emoji headers and numbered student lists, followed by the fixed parent message text. Add a "Copy WhatsApp Message" button that uses the Clipboard API to copy the entire formatted text and shows a success toast. Keep styling clean: white card on a light background, clear section headings, readable font size.

4. **Navigation wiring** — Register the new page in `client/src/App.tsx` at `/teacher/daily-report`. Add a "Daily Report" button (ClipboardList or FileText icon) to the teacher dashboard's quick-action area and link it from the existing reports page header.

## Relevant files
- `server/routes.ts`
- `server/storage.ts`
- `shared/schema.ts`
- `client/src/App.tsx`
- `client/src/pages/teacher/dashboard.tsx`
- `client/src/pages/teacher/reports.tsx`
