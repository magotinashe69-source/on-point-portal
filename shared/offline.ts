/**
 * Offline mode — the shapes and the rules, with no database and no browser.
 *
 * A child on a bus with no signal must be able to answer their homework, and
 * that work must reach the school EXACTLY ONCE: never lost, never twice.
 *
 * The whole design rests on one idea:
 *
 *   > The DEVICE names the submission, not the server.
 *
 * When a child taps "Hand in" with no connection, the app makes up a random id
 * (the clientId) and saves it alongside the answers. Every later attempt to
 * send that work carries the same id, for ever. That gives both halves of the
 * promise:
 *
 *   * never duplicated — the server keeps that id under a unique index, so a
 *     second arrival returns the FIRST submission instead of making another;
 *   * never lost — the device throws the queued work away only once the server
 *     has said in words that it has it. A crash mid-send leaves it queued.
 *
 * This file is deliberately pure: the hard part (deciding what to do with each
 * answer the server gives) can then be tested without a browser or a network.
 */

/** How many times we keep trying before we stop and ask the child for help. */
export const MAX_ATTEMPTS = 8;

/**
 * A send that has been in flight longer than this is assumed to have died with
 * the app that started it (a closed tab, a flat battery) and is picked up
 * again. Safe to be wrong about: re-sending is harmless, which is the whole
 * point of the id.
 */
export const STALE_SENDING_MS = 60_000;

/** Where a queued piece of work has got to. */
export type OutboxState =
  /** Waiting for a connection. The normal resting state. */
  | "pending"
  /** A send is in flight right now. */
  | "sending"
  /** The school has it. Kept only long enough to tell the child. */
  | "done"
  /** The server refused for a reason trying again will never fix. */
  | "blocked";

/** One answer, exactly as the online form sends it. */
export interface OfflineAnswer {
  questionId: string;
  answerText: string;
  imageUrls?: string[];
}

/**
 * One piece of homework waiting to reach the school.
 *
 * NOTE what is NOT here: no score, no mark, no feedback. A mark must never be
 * kept on the device, because a stale one would show a child a score that is
 * not theirs any more. submissionId is only a pointer to fetch the real, live
 * result with.
 */
export interface OutboxItem {
  /** The idempotency key. Made once, on the device, and never changed. */
  clientId: string;
  /** Whose work this is. Only ever sent while THIS child is signed in. */
  studentId: number;
  assignmentId: number;
  /** Shown in the waiting list so a child knows which paper it is. */
  assignmentTitle: string;
  answers: OfflineAnswer[];
  /** The device's clock at the moment the child tapped "Hand in". */
  completedAt: string;
  state: OutboxState;
  attempts: number;
  /** When the current send started — used to spot one that died with the app. */
  sendingSince?: number;
  /** The server's own words, when it refused. Shown to the child as-is. */
  message?: string;
  /** Filled in once the school has it, so the child can open the result. */
  submissionId?: number;
}

/** What came back from one attempt to send a queued item. */
export type SendOutcome =
  /** The server has it — either just now, or it already did. */
  | { kind: "accepted"; submissionId: number }
  /** No connection, or the server did not answer. Try again later. */
  | { kind: "offline" }
  /** The server is having a bad moment (a 500). Worth trying again. */
  | { kind: "serverError"; message: string }
  /** The server refused, and will refuse again. Stop and tell the child. */
  | { kind: "refused"; message: string };

/** What the queue should do next with an item, given how the send went. */
export type Decision =
  | { next: "done"; submissionId: number }
  | { next: "retry" }
  | { next: "blocked"; message: string };

/**
 * The one decision this whole feature turns on.
 *
 * Kept apart from the network code so it can be tested exhaustively: getting
 * this wrong either loses a child's work (dropping something we should keep) or
 * hands it in twice (retrying something already accepted).
 */
export function classifyOutcome(outcome: SendOutcome, attempts: number): Decision {
  switch (outcome.kind) {
    case "accepted":
      return { next: "done", submissionId: outcome.submissionId };

    case "refused":
      // The server has looked at this and said no — wrong class, paper
      // withdrawn, already handed in from another phone. Trying again would
      // just be refused again, so stop and show the child the reason.
      return { next: "blocked", message: outcome.message };

    case "offline":
      // A dead connection is not the child's fault and does not count against
      // them: this is not a failed attempt, it is a non-event. Retried for ever.
      return { next: "retry" };

    case "serverError":
      // Something broke at our end. Worth trying again, but not for ever — a
      // child stuck on this needs to be told rather than left with a spinner.
      return attempts + 1 >= MAX_ATTEMPTS
        ? { next: "blocked", message: outcome.message }
        : { next: "retry" };
  }
}

/** What the server said, reduced to the two things that decide the outcome. */
export interface Reply {
  status: number;
  /** The parsed JSON body, or null when the reply could not be read as JSON. */
  body: { success?: boolean; message?: string; submission?: { id?: number } } | null;
}

/**
 * Turn one reply into "did the school get it?".
 *
 * Read the shape of this carefully. Everything that is not a clear, understood
 * YES is treated as "did not arrive", because mistaking a confusing reply for
 * success would delete a child's work and send it nowhere.
 *
 * The trap this exists to survive is school WiFi. A hotspot that wants you to
 * sign in answers every request with its own web page and a cheerful 200 — so
 * "the request came back without throwing" is not remotely the same thing as
 * "the school has the work". Only a reply we can read, that says success, and
 * that names a submission, counts.
 */
export function interpretReply(reply: Reply): SendOutcome {
  const { status, body } = reply;

  if (status === 401) {
    // The login has ended. Trying again is pointless until they sign in, but
    // the work is perfectly good — keep it, and say why.
    return { kind: "serverError", message: "Sign in again to send your work." };
  }

  if (status >= 500) {
    return { kind: "serverError", message: "The school's system had a problem. We will try again." };
  }

  if (body === null) {
    return { kind: "serverError", message: "We could not reach the school. We will try again." };
  }

  if (status >= 200 && status < 300 && body.success === true && typeof body.submission?.id === "number") {
    // Either it was stored just now, or the server recognised the device id and
    // handed back the copy it already had. Both mean the same thing here: the
    // school has this work, and we can stop carrying it.
    return { kind: "accepted", submissionId: body.submission.id };
  }

  if (body.success === false) {
    // The server looked at it and said no — the paper was withdrawn, or it was
    // handed in from another phone. Trying again would only be refused again.
    return { kind: "refused", message: body.message || "Your teacher's system would not accept this." };
  }

  return { kind: "serverError", message: "We could not reach the school. We will try again." };
}

/**
 * True when a "sending" item has been left behind by an app that closed
 * mid-send, so it is safe to pick up again.
 */
export function isStaleSending(item: OutboxItem, now: number): boolean {
  if (item.state !== "sending") return false;
  return now - (item.sendingSince ?? 0) > STALE_SENDING_MS;
}

/**
 * The items this run should try, oldest completion first.
 *
 * Oldest first because that is the order the child did the work in, and the
 * order they will expect the results to appear in.
 */
export function itemsToSend(items: OutboxItem[], now: number): OutboxItem[] {
  return items
    .filter((i) => i.state === "pending" || isStaleSending(i, now))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

/** What the little indicator says. */
export interface SyncSummary {
  waiting: number;
  blocked: number;
  sending: boolean;
  /** The whole sentence, ready to show. */
  text: string;
}

export function summarise(items: OutboxItem[]): SyncSummary {
  const waiting = items.filter((i) => i.state === "pending" || i.state === "sending").length;
  const blocked = items.filter((i) => i.state === "blocked").length;
  const sending = items.some((i) => i.state === "sending");

  let text: string;
  if (sending) {
    text = waiting === 1 ? "Sending your work..." : `Sending ${waiting} pieces of work...`;
  } else if (waiting > 0) {
    text = waiting === 1 ? "1 item waiting to sync" : `${waiting} items waiting to sync`;
  } else if (blocked > 0) {
    text = blocked === 1 ? "1 item needs your attention" : `${blocked} items need your attention`;
  } else {
    text = "Everything is synced";
  }

  return { waiting, blocked, sending, text };
}

/** Plain words, gathered so they can be translated later in one place. */
export const OFFLINE_TEXT = {
  saveForOffline: "Save for offline",
  saving: "Saving...",
  savedForOffline: "Saved to this device. You can answer it with no internet.",
  savedAlready: "Saved on this device",
  cannotSave: "Could not save this to your device. Try again while you have internet.",

  handedInOffline: "Saved on your phone",
  handedInOfflineDetail:
    "You have no internet, so your answers are safe on this device. They will be sent to your teacher on their own as soon as you are back online.",

  noPhotosOffline: "Photos need internet. You can still type your answers now and add photos later.",
  cannotEditOffline: "You have already handed this in, so it can only be changed with internet.",

  waitingHeading: "Waiting to sync",
  syncedJustNow: "Sent to your teacher",
  blockedHeading: "Needs your attention",
  offlineBadge: "No internet",

  // Said out loud on the paper, because a child who cannot see their mark needs
  // to know why rather than assume something is broken.
  markComesLater: "Your mark will appear once your work reaches the school.",
} as const;

/**
 * A fresh idempotency key.
 *
 * crypto.randomUUID is missing on some older Android browsers, so there is a
 * fallback. The id only has to be unique to one device, and both are far past
 * that.
 */
export function newClientId(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `off-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The longest a device clock may be wrong before we stop believing it.
 *
 * Not used to reject work — a phone that has been off for a fortnight has a
 * legitimately old completion time. It guards the other direction only: see
 * resolveCompletedAt.
 */
export interface CompletedAtInput {
  /** What the device said, if anything. */
  completedAt?: string | null;
  /** Server time now. */
  now: Date;
  /** When the paper was set — nothing can be answered before it existed. */
  assignmentCreatedAt?: Date | null;
}

/** Why a device's claimed completion time was not used. */
export type ClockVerdict = "trusted" | "no-claim" | "in-future" | "before-assignment" | "unreadable";

export interface ResolvedCompletedAt {
  /** The time to store as when the work was handed in. */
  submittedAt: Date;
  verdict: ClockVerdict;
}

/**
 * Decide what time a piece of offline work was really completed.
 *
 * The device clock is USED but not TRUSTED. A cheap Android with a flat battery
 * comes back believing it is 1970; a child who wants to beat a deadline can set
 * the clock back on purpose. Two checks catch both without punishing the honest
 * case of a phone that was genuinely offline for a fortnight:
 *
 *   1. Never in the future. A submission dated tomorrow would land in tomorrow's
 *      CAT day and quietly break the game-plays count and the streak.
 *   2. Never before the paper was set. You cannot answer a question that did not
 *      exist, so a clock claiming that is simply wrong.
 *
 * Failing either falls back to server time, which is late but true.
 */
export function resolveCompletedAt(input: CompletedAtInput): ResolvedCompletedAt {
  const { completedAt, now, assignmentCreatedAt } = input;

  if (!completedAt) return { submittedAt: now, verdict: "no-claim" };

  const claimed = new Date(completedAt);
  if (Number.isNaN(claimed.getTime())) return { submittedAt: now, verdict: "unreadable" };

  if (claimed.getTime() > now.getTime()) return { submittedAt: now, verdict: "in-future" };

  if (assignmentCreatedAt && claimed.getTime() < assignmentCreatedAt.getTime()) {
    return { submittedAt: now, verdict: "before-assignment" };
  }

  return { submittedAt: claimed, verdict: "trusted" };
}
