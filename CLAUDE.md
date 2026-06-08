# CLAUDE.md

Guidance for working in this repository.

## What this project is

The **On Point Education Centre Homework & Learning Portal** — a web app where
**teachers** create homework assignments and **students** submit answers and
receive marks and feedback. It serves a Zimbabwe-based school.

## House style (branding)

- **Primary colour — Navy:** `#1F3864`
- **Accent colour — Gold** (use for highlights, buttons, accents)
- **Font:** clean sans-serif, Calibri-style
- **School tagline:** "Quality Beyond Measure"

Keep the look clean, friendly, and easy to read for a school setting: large clear
buttons, readable text, consistent spacing.

## User roles

There are **two roles**:

- **Student** — views assignments, submits answers (including photos of handwritten
  work), and views marks and feedback.
- **Teacher** — creates/edits assignments, manages students, marks submissions,
  posts announcements, and adds learning resources and lessons.

(An admin/master-password override also exists for teacher-level access.)

## Classes (forms)

Assignments and students are grouped by class:

- **Primary:** Stage 3, Stage 4, Stage 5, Stage 6
- **Secondary:** Form 1, Form 2

## Language

- The app is **English** for now.
- It should be built **ready to add Portuguese later** — prefer keeping
  user-facing text easy to translate (avoid hard-coding strings in awkward places;
  group display text so it can be swapped out for another language later).

## How to work in this codebase (important)

1. **Always explain what you're about to change before you change it** — in plain
   language, so a non-expert can follow.
2. **Write clean, beginner-readable code** — simple names, small functions, and
   **simple comments** that explain the "why" in everyday language.
3. Match the style of the surrounding code.

## Tech stack

- **Language:** TypeScript (frontend and backend).
- **Frontend:** React 18 + Vite, Tailwind CSS + Shadcn/UI. Routing with Wouter,
  data fetching with TanStack Query. Lives in `client/`.
- **Backend:** Express 5 (Node.js) in `server/`. One server serves both the API
  (`/api/...`) and the React app on a single port (**5000**).
- **Database:** Works on **SQLite by default** (zero setup, stored at
  `data/local.db`) and can switch to **PostgreSQL** by setting `DATABASE_URL`.
  Drizzle ORM. Shared types live in `shared/schema.ts`; the SQLite table
  definitions live in `shared/schema.sqlite.ts`.
- **File storage:** Uploaded files are saved to a local `uploads/` folder
  (`server/local_object_storage.ts`) — works anywhere, no cloud needed.

## Project structure

```
client/
  src/
    components/   # Reusable UI components
    pages/
      teacher/    # Teacher pages (login, dashboard, create, mark, resources, lessons)
      student/    # Student pages (login, dashboard, submit, results, resources, lessons)
    lib/          # Query client and auth helpers
    hooks/        # Custom hooks
server/
  index.ts        # Server entry point + session setup
  routes.ts       # All API endpoints (incl. login)
  storage.ts      # Database reads/writes + startup seeding
  db.ts           # Database connection
  replit_integrations/object_storage/   # File-upload integration (see caveat below)
shared/
  schema.ts       # Drizzle tables, TypeScript types, login schemas
```

## How login works

- **Teacher login** (`POST /api/auth/teacher/login`): checks email + password, then
  creates a real server-side session (cookie-based). Protected teacher routes
  require this session.
- **Student login** (`POST /api/auth/student/login`): student enters their **name**
  (full name or first name, case-insensitive) plus a password. On first login the
  password they type becomes their saved password. A master password also grants
  admin access.
- **Note:** passwords are currently stored as plain text — this should be improved
  (hashing) before any real production use.

## Database notes

- `server/db.ts` chooses the database at startup:
  - **No `DATABASE_URL`** → local **SQLite** file at `data/local.db`. Tables are
    created automatically on first run (no migration step). This is the default.
  - **`DATABASE_URL` set** → **PostgreSQL**. Run `npm run db:push` once to create
    the tables (Drizzle Kit).
- Sessions: stored in memory in SQLite mode; stored in PostgreSQL
  (`connect-pg-simple`) when `DATABASE_URL` is set.
- On startup, `storage.seedInitialData()` creates the teacher account, the
  registered students, and sample assignments if they don't already exist.
- The same TypeScript types are used for both databases (from `shared/schema.ts`);
  `shared/schema.sqlite.ts` holds the matching SQLite table definitions.

## Running the app

- Start dev server: `npm run dev` — runs on **http://localhost:5000**, no setup
  needed (uses the local SQLite database).
- The `dev`/`start` scripts use `cross-env`, so they work on Windows, macOS, and Linux.
- Environment variables can go in a `.env` file (see `.env.example`). None are
  required for local development.

## Switching to PostgreSQL later

1. Put `DATABASE_URL=postgres://...` in a `.env` file.
2. Run `npm run db:push` once to create the tables.
3. Start the app as usual — it will use PostgreSQL automatically.

## Environment / portability notes

This app was originally built on Replit, but the Replit-specific parts have been
replaced with standard equivalents that run anywhere:

- **File uploads** are saved to a local `uploads/` folder
  (`server/local_object_storage.ts`). No cloud account needed.
- **Database** defaults to local SQLite; PostgreSQL is opt-in via `DATABASE_URL`.
- **`SESSION_SECRET`** is required only in production (`NODE_ENV=production`).
- The build (`vite.config.ts`) no longer uses any `@replit/*` plugins.
- The `.replit` file remains in the repo but is ignored outside Replit; the
  standard equivalents are the npm scripts and the `.env` file.
