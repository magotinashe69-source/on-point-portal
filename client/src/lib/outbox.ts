/**
 * The outbox — work answered with no signal, on its way to the school.
 *
 * The rules it exists to keep (see shared/offline.ts for the reasoning):
 *
 *   * A queued item is deleted ONLY once the server has said, in words, that it
 *     has the work. Anything else — a dead connection, a closed app, a crash
 *     mid-send — leaves it exactly where it was.
 *   * Every attempt carries the same device id, so arriving twice is harmless.
 *   * Nothing here ever stores a mark.
 */

import {
  classifyOutcome, interpretReply, itemsToSend, newClientId, summarise,
  type OfflineAnswer, type OutboxItem, type Reply, type SendOutcome, type SyncSummary,
} from "@shared/offline";
import { allItems, readItem, removeItem, saveItem } from "./offline-db";

// --- Telling the screens something changed ---

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => {
    try { l(); } catch { /* a broken listener must not stop the sync */ }
  });
}

/** Everything queued for one child. Another child's work is never touched. */
export async function itemsFor(studentId: number): Promise<OutboxItem[]> {
  const all = await allItems().catch(() => [] as OutboxItem[]);
  return all.filter((i) => i.studentId === studentId);
}

export async function summaryFor(studentId: number): Promise<SyncSummary> {
  return summarise(await itemsFor(studentId));
}

// --- Putting work in ---

export interface QueueInput {
  studentId: number;
  assignmentId: number;
  assignmentTitle: string;
  answers: OfflineAnswer[];
  /**
   * The id this hand-in already carries, when the page has one.
   *
   * The submit page makes an id for EVERY hand-in, online or not, and sends it
   * with the request. So when an online hand-in fails and lands here instead,
   * it must keep the id it already used — otherwise a copy that did reach the
   * school under the old id would not be recognised, and the work would be
   * stored twice.
   */
  clientId?: string;
}

/**
 * Save a piece of work to be sent later, and note the time by the child's own
 * clock — that is the moment they finished, and it is what the school should
 * count, not whenever the phone next found a signal.
 */
export async function queueSubmission(input: QueueInput): Promise<OutboxItem> {
  const item: OutboxItem = {
    clientId: input.clientId ?? newClientId(),
    studentId: input.studentId,
    assignmentId: input.assignmentId,
    assignmentTitle: input.assignmentTitle,
    answers: input.answers,
    completedAt: new Date().toISOString(),
    state: "pending",
    attempts: 0,
  };
  await saveItem(item);
  notify();
  // If the connection came back while they were typing, this goes now.
  void syncNow(input.studentId);
  return item;
}

/** True when this child already has this paper waiting to be sent. */
export async function isQueued(studentId: number, assignmentId: number): Promise<boolean> {
  const mine = await itemsFor(studentId);
  return mine.some((i) => i.assignmentId === assignmentId && i.state !== "blocked");
}

/**
 * Forget a piece of work the school has refused.
 *
 * Only ever called by the child, from the "needs your attention" list, after
 * they have been shown the server's own reason. Nothing throws work away on its
 * own.
 */
export async function dismiss(clientId: string): Promise<void> {
  const item = await readItem(clientId);
  if (item?.state !== "blocked") return;
  await removeItem(clientId);
  notify();
}

// --- Sending ---

/**
 * One attempt to send, turned into a plain answer to "what now?".
 *
 * The judgement itself lives in interpretReply() in shared/offline.ts, where it
 * can be tested against every shape of reply — including the school-WiFi
 * hotspot that answers everything with its own page and a cheerful 200.
 */
async function sendOne(item: OutboxItem): Promise<SendOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        assignmentId: item.assignmentId,
        studentId: item.studentId,
        answers: item.answers,
        clientSubmissionId: item.clientId,
        completedAt: item.completedAt,
      }),
    });
  } catch {
    // No connection, DNS gone, the phone went into a tunnel.
    return { kind: "offline" };
  }

  let body: Reply["body"] = null;
  try {
    body = await response.json();
  } catch {
    // Left as null on purpose: a reply we cannot read is not a success.
  }

  return interpretReply({ status: response.status, body });
}

// Only one sync at a time in this tab. Without it, a child who reconnects while
// the app is already syncing would send everything twice — harmless, because of
// the device id, but it wastes a slow connection they are paying for.
let running: Promise<void> | null = null;

/**
 * Send everything this child has waiting, oldest first.
 *
 * Stops at the first sign of no connection rather than working through a queue
 * of twenty and failing twenty times.
 */
export function syncNow(studentId: number): Promise<void> {
  if (running) return running;
  running = runSync(studentId).finally(() => { running = null; });
  return running;
}

async function runSync(studentId: number): Promise<void> {
  let queue: OutboxItem[];
  try {
    queue = itemsToSend(await itemsFor(studentId), Date.now());
  } catch {
    return; // No offline storage on this device. Nothing to do.
  }
  if (queue.length === 0) return;

  for (const queued of queue) {
    // Read it again immediately before sending. Another tab may have finished
    // this one while we were working through the list.
    const item = await readItem(queued.clientId).catch(() => undefined);
    if (!item || (item.state !== "pending" && item.state !== "sending")) continue;

    await saveItem({ ...item, state: "sending", sendingSince: Date.now() });
    notify();

    const outcome = await sendOne(item);
    const decision = classifyOutcome(outcome, item.attempts);

    if (decision.next === "done") {
      // The order here is the whole promise. The work is only forgotten AFTER
      // the school has confirmed it, never before.
      await removeItem(item.clientId);
      recordJustSent({ ...item, state: "done", submissionId: decision.submissionId });
      notify();
      continue;
    }

    if (decision.next === "blocked") {
      await saveItem({
        ...item,
        state: "blocked",
        attempts: item.attempts + 1,
        sendingSince: undefined,
        message: decision.message,
      });
      notify();
      continue;
    }

    // Retry later. A dead connection does not count as an attempt, so a child
    // in a valley for a week cannot exhaust their tries and lose their work.
    const isNoConnection = outcome.kind === "offline";
    await saveItem({
      ...item,
      state: "pending",
      attempts: isNoConnection ? item.attempts : item.attempts + 1,
      sendingSince: undefined,
      message: isNoConnection ? undefined : (outcome as { message?: string }).message,
    });
    notify();

    // No point marching through the rest with no signal.
    if (isNoConnection) break;
  }
}

// --- Work sent in the last few minutes ---
//
// Kept in memory only, and holding no score — just enough to say "that has gone
// to your teacher" and offer a link to the LIVE result. Deliberately not saved
// to the device: a mark on a phone goes stale, and a stale mark is a lie.

export interface JustSent {
  clientId: string;
  assignmentTitle: string;
  submissionId: number;
  at: number;
}

const justSent: JustSent[] = [];

function recordJustSent(item: OutboxItem) {
  if (!item.submissionId) return;
  justSent.unshift({
    clientId: item.clientId,
    assignmentTitle: item.assignmentTitle,
    submissionId: item.submissionId,
    at: Date.now(),
  });
  justSent.splice(5); // A short list. It is a notice, not a history.
}

export function recentlySent(): JustSent[] {
  return justSent;
}

export function clearRecentlySent(): void {
  justSent.length = 0;
  notify();
}

// --- Starting up ---

/**
 * Pick up anything left mid-send by an app that closed, and keep an eye on the
 * connection from then on.
 *
 * A freshly loaded page cannot have a send in flight, so anything marked
 * "sending" belongs to a previous life of the app and is put straight back to
 * "pending" — rather than waiting a minute for it to look stale. Re-sending is
 * safe: that is what the device id is for.
 */
export async function startSyncing(studentId: number): Promise<() => void> {
  try {
    const mine = await itemsFor(studentId);
    for (const item of mine) {
      if (item.state === "sending") {
        await saveItem({ ...item, state: "pending", sendingSince: undefined });
      }
    }
    if (mine.length > 0) notify();
  } catch {
    // No offline storage here. The app works exactly as it always did.
    return () => {};
  }

  const goSync = () => { void syncNow(studentId); };
  const onVisible = () => { if (document.visibilityState === "visible") goSync(); };

  goSync();
  window.addEventListener("online", goSync);
  // Coming back to the app is the other moment worth trying: a phone often
  // finds signal while the screen is off, and "online" has long since fired.
  document.addEventListener("visibilitychange", onVisible);

  // Both listeners come off together. Named rather than inline for exactly that
  // reason — an inline one cannot be removed, and would pile up every time the
  // dashboard was opened.
  return () => {
    window.removeEventListener("online", goSync);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
