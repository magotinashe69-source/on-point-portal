// Change a teacher's password.
//
//   npm run set-teacher-password
//   npm run set-teacher-password -- --email someone@example.com
//
// WHY THIS EXISTS. There is no way to change a teacher's password inside the
// app — no screen, no endpoint. So the account the school has been using has
// whatever it was seeded with, and what it was seeded with was "onpoint123",
// written in the source of a repository anybody can read. Hashing the stored
// value did not help: you do not need the hash if you can read what went into
// it. Until the app grows a change-password screen, this is the way to rotate
// it, and it should be run on any database that was seeded before that changed.
//
// It reads the new password from a prompt rather than from an argument, because
// an argument ends up in the shell history and in the process list, where the
// next person to run `history` can read it.

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { storage } from "../server/storage";
import { ensureSchema } from "../server/db";
import { isHashed } from "../server/passwords";

const MINIMUM = 10;
const DEFAULT_EMAIL = "onpointeducationcentremoza@gmail.com";

/** The one that was in the source, and is therefore no longer a password. */
const PUBLISHED = "onpoint123";

function emailFromArgs(): string {
  const at = process.argv.indexOf("--email");
  return at !== -1 && process.argv[at + 1] ? process.argv[at + 1] : DEFAULT_EMAIL;
}

async function main() {
  await ensureSchema();

  const email = emailFromArgs();
  const teacher = await storage.getTeacherByEmail(email);
  if (!teacher) {
    console.error(`\nNo teacher with the email ${email}.`);
    console.error("Pass a different one with --email, or check the address.\n");
    process.exitCode = 1;
    return;
  }

  console.log(`\nChanging the password for ${teacher.fullName} <${email}>.`);
  console.log(
    isHashed(teacher.password)
      ? "What is stored now is a hash."
      : "What is stored now is the password itself, in plain text.",
  );

  const ask = await openPrompt();
  try {
    const first = (await ask.question("\nNew password: ")).trim();
    if (first.length < MINIMUM) {
      console.error(`\nToo short — use at least ${MINIMUM} characters. Nothing was changed.\n`);
      process.exitCode = 1;
      return;
    }
    if (first === PUBLISHED) {
      console.error("\nThat is the password from the source code, which everybody has.");
      console.error("Nothing was changed.\n");
      process.exitCode = 1;
      return;
    }

    const again = (await ask.question("Type it again: ")).trim();
    if (first !== again) {
      console.error("\nThose do not match. Nothing was changed.\n");
      process.exitCode = 1;
      return;
    }

    await storage.updateTeacherPassword(teacher.id, first);
    console.log("\nChanged. It is stored as a hash, and this is the only copy of it there is —");
    console.log("nobody, including whoever runs this script next, can read it back out.\n");
  } finally {
    ask.close();
  }
}

/**
 * Somewhere to read two passwords from, whether or not a person is typing.
 *
 * At a terminal it prompts, and does not echo what is typed — a password that
 * scrolls past stays in the scrollback, and on somebody's shoulder.
 *
 * Piped in (a test, a setup script), it reads the lines it was handed. That is
 * not a nicety: readline's SECOND question never resolves once a piped stream
 * has ended, so this script used to print both prompts, change nothing, and
 * exit reporting success — the worst of the three things it could have done.
 */
async function openPrompt(): Promise<{ question: (q: string) => Promise<string>; close: () => void }> {
  if (!stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) chunks.push(chunk as Buffer);
    const lines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
    let next = 0;
    return {
      question: async (q: string) => {
        stdout.write(q + "\n");
        return lines[next++] ?? "";
      },
      close: () => {},
    };
  }

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  return {
    question: async (q: string) => {
      stdout.write(q);
      const wasMuted = (rl as unknown as { output: NodeJS.WriteStream }).output;
      // Take the echo away while the answer is typed, and put it back after.
      (rl as unknown as { output: unknown }).output = { write: () => {} };
      const answer = await rl.question("");
      (rl as unknown as { output: unknown }).output = wasMuted;
      stdout.write("\n");
      return answer;
    },
    close: () => rl.close(),
  };
}

main().catch((error) => {
  console.error("\nThe password was not changed:");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
