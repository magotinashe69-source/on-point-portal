// Take a safety copy of the PostgreSQL database to a file on this computer.
//
//   npm run backup:db
//   npm run backup:db -- --out "D:\school-backups"
//
// WHY THIS EXISTS. The school's real data lives in a hosted PostgreSQL database
// (Neon). Its own point-in-time restore protects against a bad migration, but
// not against losing the account it lives in — so it is worth holding a copy
// that does not depend on anybody's hosting being reachable.
//
// It shells out to `pg_dump` rather than writing the dump itself. Getting a
// correct, restorable dump of a live database — foreign keys, sequences, the
// order rows have to be inserted in — is exactly the job of the tool Postgres
// ships, and a hand-rolled one would be worse in ways nobody notices until the
// day they restore it.
//
// THE PART THAT MATTERS MOST IS THE VERIFY. A backup nobody has checked is a
// hope, not a safety copy, and `pg_dump` finishing quietly proves nothing: it
// exits 0 having written an empty file if it was pointed at an empty database.
// So this counts the rows in every table FIRST, takes the dump, then reads the
// dump back with `pg_restore --list` and checks that every table which had rows
// is actually in it. If it cannot do that check, it says so loudly rather than
// letting a skipped check look like a passed one.
//
// WHAT IT DOES NOT BACK UP: photos of handwritten work. Those are files on the
// server's disk (see server/local_object_storage.ts), not rows in the database.
// Copy that folder separately.

import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { is, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as pgSchema from "@shared/schema";

/** Where the dump goes when nothing else is asked for. Inside the repo, and gitignored. */
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "backups");

/**
 * Every table the app defines, read from the schema rather than typed out here.
 * A table added later is covered without anybody remembering to add it — the
 * same reason the subjects and question types live in one list.
 */
function tablesTheAppDefines(): string[] {
  return Object.values(pgSchema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table as never))
    .sort();
}

function outDirFromArgs(): string {
  const at = process.argv.indexOf("--out");
  return at !== -1 && process.argv[at + 1]
    ? path.resolve(process.argv[at + 1])
    : DEFAULT_OUT_DIR;
}

/**
 * The connection, split into the bits that are safe to print and the password,
 * which is never printed and never put on a command line.
 *
 * Two things are fixed up on the way through, both specific to Neon:
 *
 *  - the POOLED host (`...-pooler...`) is swapped for the direct one. pg_dump
 *    does not work reliably through a connection pooler, and the pooled string
 *    is the one the dashboard offers first, so this is the mistake to expect.
 *  - `sslmode=require` is added when it is missing. Neon refuses a plain
 *    connection, and the failure reads like a network problem.
 */
function readConnection(raw: string) {
  const url = new URL(raw);

  const pooled = url.hostname.includes("-pooler");
  if (pooled) url.hostname = url.hostname.replace("-pooler", "");

  const sslWasMissing = !url.searchParams.has("sslmode");
  if (sslWasMissing) url.searchParams.set("sslmode", "require");

  const password = decodeURIComponent(url.password);
  // What pg_dump is given. The password travels in the child's environment
  // instead, so it is not in the process list for anybody running `ps`.
  const withoutPassword = new URL(url.toString());
  withoutPassword.password = "";

  return {
    /** Safe to print: no password in it. */
    describe: `${url.username}@${url.hostname}${url.pathname}`,
    forPgDump: withoutPassword.toString(),
    forCounting: url.toString(),
    password,
    pooled,
    sslWasMissing,
  };
}

/** `pg_dump` on the PATH, or the newest one installed in the usual Windows place. */
function findTool(tool: "pg_dump" | "pg_restore"): string | null {
  const onPath = tryRun(tool, ["--version"]);
  if (onPath) return tool;

  const root = "C:\\Program Files\\PostgreSQL";
  if (!fs.existsSync(root)) return null;

  const versions = fs
    .readdirSync(root)
    .map((name) => ({ name, major: parseInt(name, 10) }))
    .filter((v) => Number.isFinite(v.major))
    .sort((a, b) => b.major - a.major); // newest first

  for (const version of versions) {
    const candidate = path.join(root, version.name, "bin", `${tool}.exe`);
    if (fs.existsSync(candidate) && tryRun(candidate, ["--version"])) return candidate;
  }
  return null;
}

function tryRun(command: string, args: string[]): boolean {
  const result = spawnSyncQuiet(command, args);
  return result !== null && result.code === 0;
}

/** A tiny synchronous run, used to test whether a tool exists and to read a dump's contents. */
function spawnSyncQuiet(command: string, args: string[]) {
  try {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (result.error) return null;
    return { code: result.status ?? 1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
  } catch {
    return null;
  }
}

/** Run a command, showing its output as it goes. Resolves with the exit code. */
function run(command: string, args: string[], password: string): Promise<{ code: number; errors: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      // The password goes here rather than into the connection string on the
      // command line, where the process list would expose it.
      env: { ...process.env, PGPASSWORD: password },
      stdio: ["ignore", "inherit", "pipe"],
    });

    let errors = "";
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      errors += text;
      process.stderr.write(text); // pg_dump's --verbose progress goes to stderr
    });

    child.on("error", (error) => resolve({ code: 1, errors: `${errors}${error.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, errors }));
  });
}

/** Read the dump's own table of contents back. Null when pg_restore is missing. */
function tablesInsideTheDump(pgRestore: string | null, file: string): Set<string> | null {
  if (!pgRestore) return null;
  const result = spawnSyncQuiet(pgRestore, ["--list", file]);
  if (!result || result.code !== 0) return null;

  const found = new Set<string>();
  for (const line of result.out.split(/\r?\n/)) {
    // Lines look like: "4160; 0 16428 TABLE DATA public students onpoint_owner"
    const match = line.match(/TABLE DATA\s+\S+\s+(\S+)/);
    if (match) found.add(match[1]);
  }
  return found;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("\nThere is no DATABASE_URL set, so there is no PostgreSQL database to back up.");
    console.error("This machine runs on the local SQLite file instead — to copy that, copy data/local.db.");
    console.error("\nTo back up the school's hosted database, put its connection string in .env:");
    console.error("  DATABASE_URL=postgresql://...");
    console.error("Get it from the Neon console, with connection pooling turned OFF.\n");
    process.exitCode = 1;
    return;
  }

  let connection: ReturnType<typeof readConnection>;
  try {
    connection = readConnection(raw);
  } catch {
    console.error("\nDATABASE_URL is not a connection string this can read.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`\nBacking up ${connection.describe}`);
  if (connection.pooled) {
    console.log("  (that is the POOLED address — using the direct one instead, which pg_dump needs)");
  }
  if (connection.sslWasMissing) {
    console.log("  (added sslmode=require, which the host insists on)");
  }

  const pgDump = findTool("pg_dump");
  if (!pgDump) {
    console.error("\npg_dump is not installed, and it is what actually takes the backup.");
    console.error("Install the PostgreSQL CLIENT tools (not the server) from:");
    console.error("  https://www.postgresql.org/download/windows/");
    console.error("In the installer, untick PostgreSQL Server, pgAdmin and Stack Builder.");
    console.error("Then either restart the terminal, or run this once in it:");
    console.error('  $env:Path += ";C:\\Program Files\\PostgreSQL\\17\\bin"\n');
    process.exitCode = 1;
    return;
  }

  // ---------------------------------------------------------------------
  // Where it goes. Settled BEFORE anything slow happens: being told the
  // destination is wrong after several minutes of reading a database is a
  // waste of the time you were trying to protect.
  //
  // Never anywhere git would pick it up: the file holds every child's name,
  // their marks, and the parents' password hashes.
  // ---------------------------------------------------------------------
  const outDir = outDirFromArgs();
  const insideRepo = !path.relative(process.cwd(), outDir).startsWith("..");
  if (insideRepo) {
    const ignore = fs.existsSync(".gitignore") ? fs.readFileSync(".gitignore", "utf8") : "";
    const folder = `${path.basename(outDir)}/`;
    if (!ignore.split(/\r?\n/).some((line) => line.trim() === folder || line.trim() === path.basename(outDir))) {
      console.error(`\n${outDir} is inside the project but is not in .gitignore.`);
      console.error("A backup holds every child's name and the parents' password hashes;");
      console.error("it must not be committable. Add this line to .gitignore first:");
      console.error(`  ${folder}\n`);
      process.exitCode = 1;
      return;
    }
  }
  fs.mkdirSync(outDir, { recursive: true });

  // ---------------------------------------------------------------------
  // Count what is there BEFORE dumping, so there is something to check the
  // dump against afterwards.
  //
  // Its own connection, deliberately: importing the app's db module would run
  // ensureSchema(), which issues ALTER TABLE statements. A backup must not
  // change the thing it is backing up.
  // ---------------------------------------------------------------------
  const expected = tablesTheAppDefines();
  const counts = new Map<string, number>();
  const pool = new pg.Pool({ connectionString: connection.forCounting });

  try {
    for (const table of expected) {
      try {
        const result = await pool.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
        counts.set(table, result.rows[0].n as number);
      } catch {
        // A table the app defines but the database has not got yet. Worth
        // saying, but not worth refusing to take a backup over.
        counts.set(table, -1);
      }
    }
  } finally {
    await pool.end();
  }

  const missing = expected.filter((t) => counts.get(t) === -1);
  const withRows = expected.filter((t) => (counts.get(t) ?? 0) > 0);

  console.log(`\n${expected.length} tables defined by the app, ${withRows.length} with anything in them:\n`);
  for (const table of expected) {
    const n = counts.get(table) ?? 0;
    const shown = n === -1 ? "not in the database yet" : n === 0 ? "empty" : `${n}`;
    console.log(`  ${table.padEnd(18)} ${shown}`);
  }

  if (withRows.length === 0) {
    console.error("\nEvery table is empty. That is almost certainly the wrong database —");
    console.error("backing it up would give you a file that restores nothing.\n");
    process.exitCode = 1;
    return;
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const file = path.join(outDir, `onpoint-${stamp}.dump`);

  console.log(`\nWriting ${file}\n`);

  // --format=custom  compressed, and lets a single table be restored later.
  // --no-owner       the host's role names will not exist wherever this is
  // --no-acl         restored, and without these the restore errors on them.
  const { code, errors } = await run(
    pgDump,
    ["--format=custom", "--no-owner", "--no-acl", "--verbose", `--file=${file}`, connection.forPgDump],
    connection.password,
  );

  if (code !== 0) {
    console.error("\npg_dump failed, so there is NO backup.");
    if (/server version|version mismatch/i.test(errors)) {
      console.error("It looks like a version mismatch: pg_dump must be at least as new as the");
      console.error("server. Install a newer PostgreSQL client and try again.");
    }
    console.error();
    if (fs.existsSync(file)) fs.unlinkSync(file); // never leave a half-written file looking like a backup
    process.exitCode = 1;
    return;
  }

  // ---------------------------------------------------------------------
  // Read it back. This is the half that makes it a backup rather than a file.
  // ---------------------------------------------------------------------
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  console.log(`\nWrote ${humanSize(size)}.`);

  const pgRestore = findTool("pg_restore");
  const inside = tablesInsideTheDump(pgRestore, file);

  if (!inside) {
    console.error("\nThe backup was written, but it could NOT BE CHECKED: pg_restore did not run.");
    console.error("Do not treat this file as a safety copy until you have listed it yourself:");
    console.error(`  pg_restore --list "${file}"\n`);
    process.exitCode = 1;
    return;
  }

  const absent = withRows.filter((table) => !inside.has(table));
  if (absent.length > 0) {
    console.error(`\nThe dump is MISSING ${absent.length} table(s) that have rows: ${absent.join(", ")}`);
    console.error("Do not rely on this file.\n");
    process.exitCode = 1;
    return;
  }

  const rows = withRows.reduce((total, table) => total + (counts.get(table) ?? 0), 0);
  console.log(`Checked: all ${withRows.length} tables with rows are in it (${rows} rows in total).`);
  if (missing.length > 0) {
    console.log(`Not in the database at all, so not in the backup: ${missing.join(", ")}`);
  }

  console.log("\nKeep it somewhere that is not this computer as well — a backup that");
  console.log("burns with the laptop is not a backup.");
  console.log("It holds children's names, their marks and the parents' password hashes,");
  console.log("so treat the file like the register: do not email it, do not commit it.");
  console.log("\nPhotos of handwritten work are NOT in it — those are files on the server's");
  console.log("disk (uploads/), and have to be copied separately.");
  console.log("\nTo restore it into an empty database:");
  console.log(`  pg_restore --dbname=<connection string> --no-owner --no-acl "${file}"\n`);
}

void main().catch((error) => {
  console.error("\nThe backup did not finish:", error instanceof Error ? error.message : error);
  console.error();
  process.exitCode = 1;
});
