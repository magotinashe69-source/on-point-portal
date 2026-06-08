# Objective
Add an archive system for assignments so teachers can move individual assignments out of the main view without deleting them. Each assignment gets its own archive button. Archived assignments go to a separate "Archived Assignments" section and are hidden from the active list.

# Tasks

### T001: Add archived field to schema and backend
- **Blocked By**: []
- **Details**:
  - Add `archived: boolean("archived").default(false).notNull()` to the `assignments` table in `shared/schema.ts`
  - Run `npm run db:push` to apply the schema change to the database
  - In `server/storage.ts` → `getAssignments()`: filter to only return `archived = false` by default; accept an optional `archived` boolean param to fetch archived ones instead
  - Add `PATCH /api/assignments/:id/archive` endpoint in `server/routes.ts` that accepts `{ archived: boolean }` and updates the assignment
  - Update `updateAssignment()` in `server/storage.ts` to handle the `archived` field
  - Files: `shared/schema.ts`, `server/storage.ts`, `server/routes.ts`
  - Acceptance: Active assignment list excludes archived ones; PATCH endpoint toggles archive status

### T002: Archive button on each assignment row (dashboard)
- **Blocked By**: [T001]
- **Details**:
  - On the teacher dashboard, add an Archive icon button (Archive/Box icon from lucide-react) next to the delete button on each assignment row
  - Clicking archive calls `PATCH /api/assignments/:id/archive` with `{ archived: true }` and invalidates the assignments query cache
  - Add a collapsible "Archived Assignments" section below the main assignments list — it fetches from `/api/assignments?archived=true` and shows archived assignments with an "Unarchive" button and a delete button each
  - Archived section only renders if there is at least one archived assignment
  - Files: `client/src/pages/teacher/dashboard.tsx`
  - Acceptance: Each assignment row has its own archive button; archiving it removes it from the main list and adds it to the archive section

### T003: Archive button on assignment detail page
- **Blocked By**: [T001]
- **Details**:
  - Add an Archive/Unarchive button in the header actions area of the assignment detail page (`/teacher/assignments/:id`)
  - If the assignment is currently active, show "Archive Assignment" button (Archive icon); if already archived, show "Unarchive" button
  - Clicking it calls the PATCH endpoint and navigates back to the dashboard on success
  - Files: `client/src/pages/teacher/assignment-detail.tsx`
  - Acceptance: Teachers can archive/unarchive a specific assignment from its detail page
