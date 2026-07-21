// Database connection.
//
// This project supports two databases:
//   * PostgreSQL — used automatically when a DATABASE_URL is set.
//   * SQLite     — used by default, stored in a local file (data/local.db).
//                  This needs zero setup, so the app just runs on any PC.
//
// To switch to PostgreSQL later, set the DATABASE_URL environment variable
// (for example in a .env file) and run `npm run db:push` once to create the
// tables. No code changes needed.

import "dotenv/config"; // load variables from a .env file if one exists
import path from "path";
import fs from "fs";

import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { drizzle as drizzleSqlite } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

import * as pgSchema from "@shared/schema";
import * as sqliteSchema from "@shared/schema.sqlite";

// True when a PostgreSQL connection string is provided.
export const usePostgres = !!process.env.DATABASE_URL;

// PostgreSQL "create if missing" for the stand-alone gamification tables. This
// mirrors the matching SQLite DDL and is only a safety net around `db:push`.
// It must stay in sync with the pgTable definitions in shared/schema.ts.
const PG_GAMIFICATION_DDL = `
CREATE TABLE IF NOT EXISTS student_rewards (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_name TEXT NOT NULL,
  assignment_id INTEGER,
  earned_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS student_xp (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  daily_xp INTEGER NOT NULL DEFAULT 0,
  daily_date TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS student_streaks (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT NOT NULL DEFAULT '',
  freezes INTEGER NOT NULL DEFAULT 0,
  reached_milestones TEXT NOT NULL DEFAULT '',
  pending_notice TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dream_world (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  bricks INTEGER NOT NULL DEFAULT 0,
  wood INTEGER NOT NULL DEFAULT 0,
  gems INTEGER NOT NULL DEFAULT 0,
  layout TEXT NOT NULL DEFAULT '[]',
  seen_unlocks TEXT NOT NULL DEFAULT '',
  town_name TEXT NOT NULL DEFAULT '',
  town_named_at TEXT NOT NULL DEFAULT '',
  founded_at TEXT NOT NULL DEFAULT '',
  award TEXT NOT NULL DEFAULT '',
  award_term TEXT NOT NULL DEFAULT '',
  grid_size INTEGER NOT NULL DEFAULT 8,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
`;

// Columns added to dream_world after it first shipped. Each dialect's startup
// runs these idempotently so existing tables gain the new columns.
const DREAM_WORLD_ADDED_COLUMNS: { name: string; type: string }[] = [
  { name: "seen_unlocks",   type: "TEXT NOT NULL DEFAULT ''" },
  { name: "town_name",      type: "TEXT NOT NULL DEFAULT ''" },
  { name: "town_named_at",  type: "TEXT NOT NULL DEFAULT ''" },
  { name: "founded_at",     type: "TEXT NOT NULL DEFAULT ''" },
  { name: "award",          type: "TEXT NOT NULL DEFAULT ''" },
  { name: "award_term",     type: "TEXT NOT NULL DEFAULT ''" },
  { name: "grid_size",      type: "INTEGER NOT NULL DEFAULT 8" },
];

// Filled in below depending on which database we use.
let activeDb: unknown;
let pgPoolInstance: pg.Pool | undefined;
let ensureSchemaFn: () => Promise<void>;

if (usePostgres) {
  // ---------- PostgreSQL ----------
  const { Pool } = pg;
  pgPoolInstance = new Pool({ connectionString: process.env.DATABASE_URL });
  activeDb = drizzlePg(pgPoolInstance, { schema: pgSchema });

  // The core tables are created by `npm run db:push` on deploy. As a safety net
  // we also create the stand-alone gamification tables here if they are missing,
  // so a deploy where `db:push` does not pick up a brand-new table can never
  // leave the dashboard reading a table that does not exist. All three are
  // additive and reference a student id only, so `CREATE TABLE IF NOT EXISTS`
  // is completely safe and does nothing when they already exist.
  ensureSchemaFn = async () => {
    await pgPoolInstance!.query(PG_GAMIFICATION_DDL);
    // Add columns introduced after a table first shipped (idempotent).
    for (const col of DREAM_WORLD_ADDED_COLUMNS) {
      await pgPoolInstance!.query(`ALTER TABLE dream_world ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
    }
  };

  console.log("[db] Using PostgreSQL (DATABASE_URL is set)");
} else {
  // ---------- SQLite (default, zero setup) ----------
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const dbFile = path.join(dataDir, "local.db");
  const client = createClient({ url: `file:${dbFile}` });
  activeDb = drizzleSqlite(client, { schema: sqliteSchema });

  // Create the tables on first run if the file is new.
  ensureSchemaFn = async () => {
    await client.executeMultiple(sqliteSchema.SQLITE_DDL);
    // Add columns introduced after a table first shipped. SQLite has no
    // "ADD COLUMN IF NOT EXISTS", so ignore the error when it already exists.
    for (const col of DREAM_WORLD_ADDED_COLUMNS) {
      try { await client.execute(`ALTER TABLE dream_world ADD COLUMN ${col.name} ${col.type}`); }
      catch { /* column already present */ }
    }
  };

  console.log(`[db] Using local SQLite database at ${dbFile}`);
}

// Exported for use by the rest of the server.
//
// We type `db` and the tables with the PostgreSQL types so the app keeps full
// type-safety. At runtime they are whichever database was chosen above; the
// Drizzle query methods (select/insert/update/delete) are the same for both.
export const db = activeDb as NodePgDatabase<typeof pgSchema>;

// The PostgreSQL connection pool (used by the session store). Undefined in SQLite mode.
export const pgPool = pgPoolInstance;

// Creates the database tables if needed. Call this once on startup.
export const ensureSchema = ensureSchemaFn;

// Table objects for queries — correct dialect at runtime, PostgreSQL types for editing.
export const {
  teachers,
  students,
  assignments,
  submissions,
  marks,
  resources,
  announcements,
  lessons,
  exportLogs,
  studentRewards,
  studentXp,
  studentStreaks,
  dreamWorld,
} = (usePostgres ? pgSchema : sqliteSchema) as typeof pgSchema;
