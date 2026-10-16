// Columns that are no longer part of the app and must be removed from an
// existing database.
//
// Kept in its own small file, with no database connection of its own, so two
// things can share it without side effects:
//   * server/db.ts, which drops them when the app starts (this is what cleans
//     the local SQLite database);
//   * script/drop-retired-columns.ts, which drops them on PostgreSQL BEFORE
//     `drizzle-kit push` runs during a deploy.
//
// Why the deploy needs the second one: when a column disappears from
// shared/schema.ts, `drizzle-kit push` wants to drop it too, and on a table
// with rows in it it stops and asks "Do you still want to push changes?".
// A deploy has nobody to answer, so the build would hang or fail. Dropping the
// column first leaves drizzle-kit nothing to ask about.
//
// Every drop is "if it exists", so running it again does nothing.

export const RETIRED_COLUMNS: { table: string; column: string }[] = [
  // The hashed one-time code for a pupil's first sign-in. The codes were
  // removed (a pupil now chooses their own password on their first sign-in),
  // and nothing has read this column since.
  { table: "students", column: "first_login_code" },
];
