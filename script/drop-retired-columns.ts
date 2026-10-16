// Drops the columns listed in server/retired-columns.ts from the PostgreSQL
// database, before `drizzle-kit push` runs.
//
//   Runs automatically as the first half of `npm run db:push`.
//
// See server/retired-columns.ts for why this cannot be left to drizzle-kit.
//
// It opens its own connection rather than importing server/db.ts, the same as
// backup-db.ts: importing that file would run the app's whole startup setup.

import "dotenv/config"; // load DATABASE_URL from a .env file if present
import pg from "pg";
import { RETIRED_COLUMNS } from "../server/retired-columns";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. This step is only for PostgreSQL.");
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const { table, column } of RETIRED_COLUMNS) {
      // Look first, only so the log can say plainly what happened.
      const found = await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
        [table, column],
      );
      if (found.rowCount === 0) {
        console.log(`[retired-columns] ${table}.${column} is already gone`);
        continue;
      }
      await client.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS ${column}`);
      console.log(`[retired-columns] dropped ${table}.${column}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[retired-columns] failed:", error);
  // exitCode rather than process.exit(), so the process ends cleanly and
  // `&& drizzle-kit push` does not run.
  process.exitCode = 1;
});
