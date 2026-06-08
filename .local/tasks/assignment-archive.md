# Assignment Archive System

## What & Why
Teachers want to archive completed or old assignments so the main dashboard stays clean and uncluttered. Instead of deleting assignments (which would lose submission history), archiving hides them from the active view while keeping all data intact. Teachers can view archived assignments in a separate section and unarchive them if needed.

## Done looks like
- Each assignment row on the teacher dashboard has an individual Archive button (box/archive icon) next to the delete button
- Clicking Archive on an assignment immediately removes it from the main list and moves it to an "Archived Assignments" section below
- The Archived section only appears when there is at least one archived assignment
- Each archived assignment has an Unarchive button and a Delete button
- The assignment detail page also has an Archive/Unarchive button in the header
- Student-facing views are unaffected — students never see archived assignments

## Out of scope
- Bulk archive (select multiple and archive at once)
- Auto-archiving by date
- Archived assignments appearing in the student portal

## Tasks
1. **Schema + backend** — Add an `archived` boolean column (default false) to the assignments table, push the schema change, update `getAssignments()` to exclude archived by default and accept an `archived` query param, and add a `PATCH /api/assignments/:id/archive` endpoint that toggles the archived state.

2. **Dashboard archive UI** — Add an Archive icon button to each assignment row on the teacher dashboard. Wire it to the PATCH endpoint. Add a collapsible Archived Assignments section below the main list that fetches archived assignments and shows Unarchive + Delete buttons per row.

3. **Assignment detail page archive button** — Add an Archive/Unarchive button in the assignment detail page header. Clicking it calls the PATCH endpoint and redirects back to the dashboard.

## Relevant files
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts`
- `client/src/pages/teacher/dashboard.tsx`
- `client/src/pages/teacher/assignment-detail.tsx`
