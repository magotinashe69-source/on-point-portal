/**
 * Storing a password so that reading the database does not hand over the school.
 *
 * Until now every password — teachers', pupils', parents' — sat in the database
 * as the person typed it. Anyone who could read the file could sign in as
 * anybody: the teacher, and then every child and every family. Passwords are
 * also reused, so it would not only have been this app they got into.
 *
 * WHY SCRYPT, AND WHY NOTHING NEW IN package.json.
 * scrypt is built into Node, so there is no dependency to install, audit or
 * fail to build on a school laptop — the same reasoning behind the
 * hand-written store in client/src/lib/offline-db.ts. It is deliberately slow
 * and deliberately memory-hungry, which is what makes guessing a stolen hash
 * expensive rather than a weekend's work with a graphics card.
 *
 * NOBODY IS LOCKED OUT BY THIS.
 * Every password already in the database is in plain text, and there is no way
 * to turn one into a hash without the password itself — which only its owner
 * has. So a stored value that is not in the format below is understood as a
 * legacy one, compared as it always was, and REWRITTEN AS A HASH the moment its
 * owner next signs in successfully. The school does not have to reset anybody,
 * and a child who has not logged in since the change still gets in.
 *
 * The format carries its own parameters:
 *
 *     scrypt$16384$8$1$<salt hex>$<hash hex>
 *
 * so the cost can be raised years from now without invalidating what is already
 * stored — verify() reads the parameters out of each stored value rather than
 * assuming today's.
 */

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * The promisified scrypt, typed by hand.
 *
 * Node's own types give promisify() the three-argument overload only, so the
 * options object — which is where the cost parameters live, and therefore the
 * entire point — would not typecheck without this.
 */
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/** Today's cost. Raising N makes every new hash harder; old ones still verify. */
const N = 16384; // CPU/memory cost — 2^14
const R = 8;     // block size
const P = 1;     // parallelisation
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

const PREFIX = "scrypt";

/** True when a stored value is one of ours rather than a legacy plain one. */
export function isHashed(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX + "$");
}

/** Turn a password into something safe to keep. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(plain, salt, KEY_LENGTH, { N, r: R, p: P });
  return [PREFIX, N, R, P, salt.toString("hex"), key.toString("hex")].join("$");
}

export type PasswordCheck = {
  /** Whether the password was right. */
  ok: boolean;
  /**
   * True when it was right AND what is stored is still a legacy plain value.
   * The caller writes back `await hashPassword(plain)` — that is the whole
   * migration, one account at a time, as people sign in.
   */
  needsUpgrade: boolean;
};

/**
 * Check a password against what is stored.
 *
 * Both comparisons are timing-safe. That matters more for the legacy branch
 * than it looks: comparing two strings with `===` stops at the first character
 * that differs, and the time it takes is a measurement of how much of the
 * password was right.
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<PasswordCheck> {
  if (typeof stored !== "string" || stored === "") return { ok: false, needsUpgrade: false };

  if (!isHashed(stored)) {
    const ok = sameString(plain, stored);
    return { ok, needsUpgrade: ok };
  }

  const parts = stored.split("$");
  // scrypt $ N $ r $ p $ salt $ hash
  if (parts.length !== 6) return { ok: false, needsUpgrade: false };

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return { ok: false, needsUpgrade: false };
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "hex");
    expected = Buffer.from(parts[5], "hex");
  } catch {
    return { ok: false, needsUpgrade: false };
  }
  if (salt.length === 0 || expected.length === 0) return { ok: false, needsUpgrade: false };

  let actual: Buffer;
  try {
    actual = await scrypt(plain, salt, expected.length, { N: n, r, p });
  } catch {
    // Stored parameters this build cannot run (a cost raised beyond maxmem, say).
    return { ok: false, needsUpgrade: false };
  }

  return { ok: timingSafeEqual(actual, expected), needsUpgrade: false };
}

/**
 * Compare two strings without giving away how much of one was right.
 *
 * Both sides are digested first, and that is the point rather than a detail:
 * timingSafeEqual refuses buffers of different lengths, so comparing the raw
 * strings would mean branching on length before comparing — and the branch
 * itself tells an attacker how long the real password is. Two SHA-256 digests
 * are always 32 bytes, so every comparison costs the same whatever was sent.
 */
export function sameString(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}
