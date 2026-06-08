import "dotenv/config"; // load DATABASE_URL from a .env file if present
import { defineConfig } from "drizzle-kit";

// Note: this config is only used for PostgreSQL (`npm run db:push`).
// The default local SQLite database creates its tables automatically and
// does not need this file.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. `db:push` is only needed for PostgreSQL. " +
    "For local SQLite development you don't need this — just run `npm run dev`."
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
