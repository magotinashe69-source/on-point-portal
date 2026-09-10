/**
 * The little store on the child's own phone.
 *
 * IndexedDB rather than localStorage for two reasons that matter on a cheap
 * Android: it holds much more (a paper with twenty questions is not small), and
 * it does not freeze the screen while it reads and writes.
 *
 * Written by hand rather than with a library — it is about ninety lines, and a
 * database wrapper is a lot of download for a phone on a slow connection.
 *
 * TWO things live here and nothing else:
 *
 *   papers  — the questions of an assignment, saved while online so they can be
 *             opened with no signal. These are the SAME questions the server
 *             sends any pupil, with the answer key already stripped out by
 *             assignmentForStudent() — so nothing secret is being written to a
 *             shared family phone.
 *   outbox  — work answered offline, waiting to reach the school.
 *
 * What must NEVER live here is a MARK. A saved score would be shown to a child
 * long after their teacher had changed it, and a wrong mark on a screen is
 * worse than no mark at all. Results are always fetched live.
 */

import type { OutboxItem } from "@shared/offline";

const DB_NAME = "onpoint-offline";
const DB_VERSION = 1;
const PAPERS = "papers";
const OUTBOX = "outbox";

/** A downloaded assignment, ready to be answered with no connection. */
export interface SavedPaper {
  /** studentId:assignmentId — see below for why the child is part of the key. */
  key: string;
  studentId: number;
  assignmentId: number;
  /** The assignment exactly as the server sent it, answer key already removed. */
  assignment: unknown;
  savedAt: string;
}

/**
 * A phone is often shared between brothers and sisters, so a paper is saved
 * under the child who downloaded it. Without this, a Stage 4 sister could open
 * her Stage 6 brother's downloaded paper offline and be shown homework that is
 * not hers.
 */
export function paperKey(studentId: number, assignmentId: number): string {
  return `${studentId}:${assignmentId}`;
}

let openPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot save work offline."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PAPERS)) db.createObjectStore(PAPERS, { keyPath: "key" });
      // Keyed by the id the DEVICE made. Storing an item twice under the same
      // id is therefore impossible here as well as on the server.
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "clientId" });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });

  // A failed open must not be remembered for ever, or one bad moment (a private
  // window, a full disk) would leave offline mode broken until the app restarts.
  openPromise.catch(() => { openPromise = null; });
  return openPromise;
}

/** Run one job against a store and hand back its result. */
function run<T>(store: string, mode: IDBTransactionMode, job: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = job(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error("Offline storage failed."));
      }),
  );
}

// --- Papers ---

export function savePaper(paper: SavedPaper): Promise<void> {
  return run<void>(PAPERS, "readwrite", (s) => s.put(paper));
}

export function readPaper(studentId: number, assignmentId: number): Promise<SavedPaper | undefined> {
  return run<SavedPaper | undefined>(PAPERS, "readonly", (s) => s.get(paperKey(studentId, assignmentId)));
}

export function allPapers(): Promise<SavedPaper[]> {
  return run<SavedPaper[]>(PAPERS, "readonly", (s) => s.getAll());
}

export function removePaper(studentId: number, assignmentId: number): Promise<void> {
  return run<void>(PAPERS, "readwrite", (s) => s.delete(paperKey(studentId, assignmentId)));
}

// --- Outbox ---

export function saveItem(item: OutboxItem): Promise<void> {
  return run<void>(OUTBOX, "readwrite", (s) => s.put(item));
}

export function readItem(clientId: string): Promise<OutboxItem | undefined> {
  return run<OutboxItem | undefined>(OUTBOX, "readonly", (s) => s.get(clientId));
}

export function allItems(): Promise<OutboxItem[]> {
  return run<OutboxItem[]>(OUTBOX, "readonly", (s) => s.getAll());
}

export function removeItem(clientId: string): Promise<void> {
  return run<void>(OUTBOX, "readwrite", (s) => s.delete(clientId));
}
