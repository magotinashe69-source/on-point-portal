# Deploying On Point Portal to Render

This is a **Node.js / TypeScript** app (Express 5 backend + React/Vite frontend),
**not** a Python/Flask app — so there is no `requirements.txt` and no gunicorn.
Dependencies are declared in `package.json`; the app serves itself with `npm start`.

## Option A — Blueprint (recommended)

The repo includes `render.yaml`. In Render: **New + → Blueprint**, select this repo,
and Render reads the build/start commands, creates a PostgreSQL database, and wires
the environment variables for you.

## Option B — Manual Web Service

Create a **Web Service** (Node environment) and enter:

| Field             | Value                                                        |
| ----------------- | ----------------------------------------------------------- |
| **Build Command** | `npm install && npm run build`                              |
| **Start Command** | `npm start`                                                 |

Then set these environment variables in the dashboard:

| Variable         | Why it's needed                                                                 |
| ---------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`   | Render Postgres connection string. See the filesystem warning below.            |
| `SESSION_SECRET` | Any long random string. The app refuses to start in production without it.      |

After the first deploy with a Postgres DB, create the tables once by running
`npm run db:push` (Render **Shell** tab), or append it to the Build Command for the
first deploy: `npm install && npm run build && npm run db:push`.

### Then create the session table (required, once)

`npm run db:push` builds the app's own 14 tables from `shared/schema.ts`. It does
**not** create the `session` table — that one belongs to `connect-pg-simple`,
which is not part of the Drizzle schema. Create it by hand:

```
psql "$DATABASE_URL" -f docs/DEPLOYMENT-SESSION-TABLE.sql
```

or paste that file into Render's PSQL console. Skipping it does not break the
boot, but the first login fails with `relation "session" does not exist`.

The app deliberately does **not** create this table itself. `connect-pg-simple`
would do it at boot with `createTableIfMissing`, but that option makes it read
its own `table.sql` off disk relative to `__dirname` — and the server is bundled
by esbuild into a single `dist/index.cjs`, where that asset does not exist. The
result was a crash on start: `ENOENT ... dist/table.sql`. So the option is off
(`server/index.ts`) and the table is a one-time manual step.

## How the app reads its environment (already implemented)

- **Port** — `server/index.ts` reads `process.env.PORT` (defaults to 5000) and
  listens on `0.0.0.0`. Render sets `PORT` automatically.
- **Database** — `server/db.ts` reads `process.env.DATABASE_URL`. When set, it uses
  PostgreSQL; when unset, it falls back to a local SQLite file.

## Important: Render's filesystem is ephemeral

Render wipes the disk on every deploy and restart. Two consequences:

1. **Always set `DATABASE_URL`.** Without it the app silently uses SQLite at
   `data/local.db`, which is erased on each deploy — all data would be lost.
2. **Uploaded files don't persist.** Homework photos are saved to a local
   `uploads/` folder (`server/local_object_storage.ts`) and will disappear on
   deploy. To keep them, attach a Render **persistent disk** mounted at the uploads
   path (requires a paid instance type) or switch to cloud object storage (S3).
