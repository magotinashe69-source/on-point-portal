/**
 * Two small hooks the offline screens share: is there a connection, and what is
 * still waiting to be sent.
 */

import { useCallback, useEffect, useState } from "react";
import { summarise, type OutboxItem, type SyncSummary } from "@shared/offline";
import { itemsFor, startSyncing, subscribe, syncNow } from "@/lib/outbox";

/**
 * Whether the phone thinks it has a connection.
 *
 * "Thinks" is the important word: navigator.onLine only knows whether the phone
 * is attached to something, not whether that something can reach the school. So
 * it is used to decide what to OFFER a child, never to decide whether their
 * work arrived — only the server's own reply decides that.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}

export interface OutboxView {
  items: OutboxItem[];
  summary: SyncSummary;
  /** Try the queue now — used by the "try again" button. */
  retry: () => void;
}

/**
 * The queue for one child, kept up to date as the sync runs.
 *
 * Pass `andSync` on the page that is always open (the dashboard) so syncing
 * starts once, rather than on every screen the child visits.
 */
export function useOutbox(studentId: number | undefined, andSync = false): OutboxView {
  const [items, setItems] = useState<OutboxItem[]>([]);

  const reload = useCallback(() => {
    if (!studentId) return;
    itemsFor(studentId).then(setItems).catch(() => setItems([]));
  }, [studentId]);

  useEffect(() => {
    reload();
    return subscribe(reload);
  }, [reload]);

  useEffect(() => {
    if (!andSync || !studentId) return;
    let stop: (() => void) | undefined;
    startSyncing(studentId).then((s) => { stop = s; });
    return () => stop?.();
  }, [andSync, studentId]);

  const retry = useCallback(() => {
    if (studentId) void syncNow(studentId);
  }, [studentId]);

  return { items, summary: summarise(items), retry };
}
