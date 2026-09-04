-- =============================================================================
-- Session table for connect-pg-simple
-- =============================================================================
-- Run this ONCE against the PostgreSQL database, before the first deploy that
-- uses DATABASE_URL. On Render: dashboard -> your Postgres instance -> "Connect"
-- -> PSQL Command, then paste this in. Or:
--
--     psql "$DATABASE_URL" -f docs/DEPLOYMENT-SESSION-TABLE.sql
--
-- Why by hand: the app sets `createTableIfMissing: false` (server/index.ts).
-- With it on, connect-pg-simple builds the table at boot by reading its own
-- table.sql off disk with path.resolve(__dirname, './table.sql'). The server is
-- bundled by esbuild into a single dist/index.cjs, so __dirname is dist/ and
-- that .sql asset is not there - the server crashes on start with
-- ENOENT ... dist/table.sql. Creating the table once, here, avoids running any
-- DDL at boot and means the app's database user needs no CREATE rights.
--
-- This matches connect-pg-simple 10.0.0's own table.sql, with three changes:
--   * IF NOT EXISTS, so re-running it is safe.
--   * The PRIMARY KEY is inline rather than a separate ALTER TABLE. PostgreSQL
--     names it "session_pkey" either way, so the result is identical, but a
--     bare ALTER TABLE ADD CONSTRAINT fails on a second run.
--   * WITH (OIDS=FALSE) dropped. PostgreSQL 12 removed OID columns; the clause
--     is accepted as a no-op on modern servers and does nothing.
--
-- The app uses the default table and schema names, so this is "session" in
-- whatever schema the connection's search_path resolves to (normally public).
-- If you ever pass schemaName/tableName to the store, change them here to match.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "session" (
  "sid"    varchar      NOT NULL COLLATE "default" PRIMARY KEY,
  "sess"   json         NOT NULL,
  "expire" timestamp(6) NOT NULL
);

-- connect-pg-simple deletes expired rows on a timer; without this index that
-- sweep is a sequential scan over every session.
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");


-- --- Check it worked --------------------------------------------------------
-- Expected: three columns (sid varchar, sess json, expire timestamp), plus the
-- session_pkey and IDX_session_expire indexes.
--
--     \d "session"
--
-- Or, without psql's backslash commands:
--
--     SELECT column_name, data_type
--       FROM information_schema.columns
--      WHERE table_name = 'session'
--      ORDER BY ordinal_position;
--
--     SELECT indexname FROM pg_indexes WHERE tablename = 'session';
