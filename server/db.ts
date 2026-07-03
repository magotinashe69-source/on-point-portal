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

// Filled in below depending on which database we use.
let activeDb: unknown;
let pgPoolInstance: pg.Pool | undefined;
let ensureSchemaFn: () => Promise<void>;

if (usePostgres) {
  // ---------- PostgreSQL ----------
  const { Pool } = pg;
  pgPoolInstance = new Pool({ connectionString: process.env.DATABASE_URL });
  activeDb = drizzlePg(pgPoolInstance, { schema: pgSchema });

  // PostgreSQL tables are created separately with `npm run db:push`,
  // so there is nothing to create here.
  ensureSchemaFn = async () => {};

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
} = (usePostgres ? pgSchema : sqliteSchema) as typeof pgSchema;
