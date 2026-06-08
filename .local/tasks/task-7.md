---
title: Submission tracker with parent notify
---
# Submission Tracker

  ## What & Why
  Enhance the assignment detail page with a split-panel submission tracker so teachers can instantly see who has and hasn't submitted for each assignment. Add a dashboard widget showing today's missing submissions at a glance. Include a "Notify Parent" helper and automatic polling so the view stays current without a manual refresh.

  ## Done looks like
  - The assignment detail page has a split two-panel layout below the stats:
    - LEFT panel titled "Submitted" — lists each submitting student with their name, submission date/time, and mark (score/totalMarks) if the submission has been graded; clicking a row opens the mark page
    - RIGHT panel titled "Not Submitted" — lists each eligible student who hasn't submitted, with a "Notify Parent" button per student
  - Clicking "Notify Parent" opens a small dialog or popover pre-filled with a copyable message like: "Dear Parent of [Student Name], your child has not submitted the assignment '[Title]' (Subject: [Subject], Form: [Form]) which was due [Due Date]. Please follow up. — On Point Education Centre"
  - A form/class filter (radio buttons or dropdown) above the split view filters both panels to show only students from a selected form when the assignment spans multiple classes
  - Both panels auto-refresh (poll every 30 seconds) so a submission that comes in while the teacher is watching appears without a manual page reload
  - The teacher dashboard home page shows a "Missing Submissions Today" summary card listing assignments whose deadline is today (or has just passed) alongside the count of students who haven't submitted yet; each entry links to the relevant assignment detail page
  - The "Missing Submissions Today" card is hidden if there are no such assignments

  ## Out of scope
  - Sending actual emails or SMS (the notify feature only generates a copyable message)
  - Push/WebSocket real-time (polling every 30 s is sufficient)
  - Changing the marking workflow

  ## Tasks
  1. **Split-panel tracker on assignment detail page** — Replace the existing flat submissions list with a two-column card layout. Left card lists submitted students (name, date/time, score if marked, link to mark page). Right card lists non-submitted eligible students (respects targetStudentIds). Add a form-filter dropdown above the panels if eligible students span more than one form. Enable query polling (every 30 s) on both the submissions and students queries.

  2. **"Notify Parent" button and message dialog** — On each non-submitted student row add a "Notify Parent" button. Clicking it opens a Dialog containing the pre-written parent message (student name, assignment title, subject, form, due date) and a "Copy Message" button that copies the text to clipboard. No backend changes are needed.

  3. **Dashboard "Missing Submissions Today" card** — On the teacher dashboard, below the existing stat cards and above the quick-action grid, add a collapsible card titled "Missing Submissions Today". It fetches all active assignments whose dueDate equals today, then for each computes how many eligible students haven't submitted. Show a row per assignment with: assignment title, subject/form, missing count, and a link to the assignment detail. Hide the entire card if no assignments have any missing submissions. Enable 30-second polling on the relevant queries. No new backend endpoint is needed — use the existing GET /api/assignments and GET /api/submissions queries.

  ## Relevant files
  - `client/src/pages/teacher/assignment-detail.tsx`
  - `client/src/pages/teacher/dashboard.tsx`
  - `server/routes.ts`
  - `shared/schema.ts`