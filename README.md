# On Point Education Centre — Homework & Learning Portal

A web app for On Point Education Centre where **teachers** create homework
assignments and **students** submit answers and receive marks and feedback.

- **Tagline:** *Quality Beyond Measure*
- **Roles:** Student and Teacher
- **Classes:** Stage 3–6 (primary) and Form 1–2 (secondary)

---

## Quick start (run it locally)

You need **Node.js 20 or newer** installed. Check with `node --version`.

```bash
# 1. Install the dependencies (first time only)
npm install

# 2. Start the app
npm run dev
```

Then open **http://localhost:5000** in your browser.

That's it — no database to install and nothing to configure. On first run the app
creates a local database file and fills it with the teacher account, the students,
and a few sample assignments.

To stop the app, press **Ctrl + C** in the terminal.

---

## Logging in

**Teacher**
- Email: `onpointeducationcentremoza@gmail.com`
- Password: `onpoint123`

**Student**
- Type your name exactly as registered (first name is also accepted, e.g. `Nathaniel`).
- Choose a password (at least 6 characters) the first time — it's saved for next time.

> A master password also exists for admin access. See the project notes for details.

---

## How data is stored

- **Database:** By default the app uses a local **SQLite** file at `data/local.db`.
  No setup needed. The tables are created automatically on first run.
- **Uploaded files** (student photos, lesson videos/audio, documents) are saved to
  a local `uploads/` folder.

Both `data/` and `uploads/` are ignored by Git, so your local data stays on your machine.

---

## Switching to PostgreSQL (optional, for later)

The app can use PostgreSQL instead of SQLite — useful for hosting it online.

1. Copy `.env.example` to `.env`.
2. In `.env`, set your connection string:
   ```
   DATABASE_URL=postgres://user:password@host:5432/databasename
   ```
3. Create the tables once:
   ```bash
   npm run db:push
   ```
4. Start the app as usual (`npm run dev`). It now uses PostgreSQL automatically.

If `DATABASE_URL` is not set, the app falls back to local SQLite.

---

## Available commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app for local development (http://localhost:5000) |
| `npm run build` | Build the app for production (into `dist/`) |
| `npm run start` | Run the production build (requires `SESSION_SECRET` to be set) |
| `npm run check` | Type-check the code with TypeScript |
| `npm run db:push` | Create/update PostgreSQL tables (only when using PostgreSQL) |

---

## Environment variables

For local development you don't need any of these. Copy `.env.example` to `.env`
to set them.

| Variable | Needed when | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Using PostgreSQL | PostgreSQL connection string |
| `SESSION_SECRET` | Running in production | Secret used to sign login cookies |
| `PORT` | Optional | Port to listen on (defaults to `5000`) |

---

## Tech stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, Shadcn/UI
- **Backend:** Express (Node.js)
- **Database:** SQLite by default, PostgreSQL optional (Drizzle ORM)
- **File storage:** Local `uploads/` folder

## Project structure

```
client/    Frontend (React)
  src/
    pages/teacher/   Teacher screens
    pages/student/   Student screens
server/    Backend (Express API)
  index.ts           Server entry point
  routes.ts          API endpoints
  storage.ts         Database reads/writes
  db.ts              Chooses SQLite or PostgreSQL
shared/    Code shared by frontend and backend
  schema.ts          Table definitions (PostgreSQL) + types
  schema.sqlite.ts   Table definitions (SQLite)
```

See `CLAUDE.md` for more detailed notes about the project.
