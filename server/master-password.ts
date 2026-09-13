/**
 * The master password — the one that signs in as any pupil.
 *
 * It exists so staff can see exactly what a child sees without asking for their
 * password. That is a reasonable thing to want, and it is also the single most
 * powerful credential in the app: it opens every child's account on the
 * register, one name at a time.
 *
 * WHAT WAS WRONG WITH IT.
 *
 * It was a constant in shared/schema.ts:
 *
 *     export const MASTER_PASSWORD = "onpoint_admin_2024";
 *
 * Three separate problems in one line.
 *
 *   1. It was in the source, so it is in the repository, so it is in the
 *      history of every clone of it — for ever. Changing the line does not
 *      un-publish it.
 *   2. It was in `shared/`, the folder the BROWSER imports from. Nothing in the
 *      client imported that particular export, so the bundler happened to drop
 *      it — but "we are safe because tree-shaking noticed" is not a security
 *      boundary. One `import { MASTER_PASSWORD }` in a client file and it ships
 *      to every pupil's phone.
 *   3. It never changed, so it had no way to be rotated.
 *
 * WHAT IT IS NOW. An environment variable, read on the server only, and the
 * feature is OFF unless it is set. There is deliberately no fallback: falling
 * back to a value published in a git repository would be leaving the door open
 * and hanging a sign on it.
 *
 * THE OLD VALUE IS REFUSED OUTRIGHT. Anyone who has ever had the repository has
 * it, so it cannot be un-burned by being put in an env var.
 */

/** Published in the repository since the first commit. It can never be used again. */
const BURNED = "onpoint_admin_2024";

/** The shortest thing worth calling a master password. */
const MINIMUM_LENGTH = 16;

let warned = false;

function warnOnce(why: string): null {
  if (!warned) {
    warned = true;
    console.warn(`[master password] Disabled: ${why}`);
  }
  return null;
}

/**
 * The master password, or null when there isn't a usable one.
 *
 * Read on every call rather than cached at import, so a deployment that sets
 * the variable does not need this module to be loaded in a particular order.
 */
export function masterPassword(): string | null {
  const value = process.env.MASTER_PASSWORD?.trim();

  if (!value) {
    return warnOnce("MASTER_PASSWORD is not set, so signing in as a pupil is not available.");
  }
  if (value === BURNED) {
    return warnOnce(
      "MASTER_PASSWORD is the old value from the source code, which is public. Choose a new one.",
    );
  }
  if (value.length < MINIMUM_LENGTH) {
    return warnOnce(`MASTER_PASSWORD is shorter than ${MINIMUM_LENGTH} characters. Choose a longer one.`);
  }
  return value;
}
