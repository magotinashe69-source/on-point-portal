/**
 * "2 items waiting to sync" — the one place a child can see where their offline
 * work has got to.
 *
 * It follows the same rule as the rest of this app: never show a number without
 * saying what it means, and never leave something looking broken without saying
 * why. A child who handed work in on the bus needs to be able to check that it
 * actually reached their teacher.
 *
 * It shows nothing at all when there is nothing to say and the connection is
 * fine, so an ordinary day is not cluttered with reassurance nobody asked for.
 */

import { useState } from "react";
import { Link } from "wouter";
import { useT } from "@/lib/i18n";
import { useOnline, useOutbox } from "@/hooks/use-offline";
import { dismiss, recentlySent } from "@/lib/outbox";
import { Button } from "@/components/ui/button";
import { CloudOff, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  studentId: number | undefined;
  /** True on the dashboard, which is the page that owns the syncing. */
  driveSync?: boolean;
}

export function SyncStatus({ studentId, driveSync = false }: Props) {
  const t = useT();
  const online = useOnline();
  const { items, summary, retry } = useOutbox(studentId, driveSync);
  const [open, setOpen] = useState(false);
  const sent = recentlySent();

  const waiting = items.filter((i) => i.state !== "blocked");
  const blocked = items.filter((i) => i.state === "blocked");

  // Nothing to report and the connection is fine: stay out of the way.
  if (online && waiting.length === 0 && blocked.length === 0 && sent.length === 0) return null;

  const tone =
    blocked.length > 0
      ? "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30"
      : "border-primary/30 bg-primary/5";

  return (
    <div className={`rounded-lg border ${tone} p-3 mb-4`} data-testid="sync-status">
      <div className="flex items-center gap-2 flex-wrap">
        {!online && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium" data-testid="badge-offline">
            <CloudOff className="h-4 w-4 shrink-0" />
            {t.offline.offlineBadge}
          </span>
        )}

        {(waiting.length > 0 || blocked.length > 0) && (
          <>
            {/* The separator sits OUTSIDE the sentence below, so what the child
                is told is exactly the sentence and nothing else. */}
            {!online && <span className="text-muted-foreground" aria-hidden="true">·</span>}
            <span className="text-sm font-medium" data-testid="text-sync-summary">
              {t.sync.summary(summary.waiting, summary.blocked, summary.sending)}
            </span>
          </>
        )}

        {online && waiting.length === 0 && blocked.length === 0 && sent.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400" data-testid="text-sync-done">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t.offline.syncedJustNow}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {online && waiting.length > 0 && !summary.sending && (
            <Button variant="ghost" size="sm" onClick={retry} data-testid="button-sync-now">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Try now
            </Button>
          )}
          {(waiting.length > 0 || blocked.length > 0 || sent.length > 0) && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} data-testid="button-sync-details">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="sr-only">Details</span>
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {waiting.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {t.offline.waitingHeading}
              </div>
              <ul className="space-y-1">
                {waiting.map((item) => (
                  <li key={item.clientId} className="text-sm flex items-start gap-2" data-testid={`waiting-${item.assignmentId}`}>
                    <RefreshCw className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${item.state === "sending" ? "animate-spin" : "opacity-50"}`} />
                    <span className="min-w-0">
                      <span className="font-medium break-words">{item.assignmentTitle}</span>
                      <span className="text-muted-foreground block text-xs">
                        Finished {new Date(item.completedAt).toLocaleString()}
                      </span>
                      {item.message && <span className="text-muted-foreground block text-xs">{item.message}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {blocked.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {t.offline.blockedHeading}
              </div>
              <ul className="space-y-2">
                {blocked.map((item) => (
                  <li key={item.clientId} className="text-sm flex items-start gap-2" data-testid={`blocked-${item.assignmentId}`}>
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium break-words">{item.assignmentTitle}</span>
                      {/* The server's own words. A child is told what actually
                          happened, not a shrug. */}
                      <span className="text-muted-foreground block text-xs">{item.message}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs mt-1"
                        onClick={() => void dismiss(item.clientId)}
                        data-testid={`button-dismiss-${item.assignmentId}`}
                      >
                        Remove from list
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sent.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {t.offline.syncedJustNow}
              </div>
              <ul className="space-y-1">
                {sent.map((s) => (
                  <li key={s.clientId} className="text-sm flex items-start gap-2" data-testid={`sent-${s.submissionId}`}>
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600" />
                    <span className="min-w-0">
                      <span className="font-medium break-words">{s.assignmentTitle}</span>
                      {/* A link to the LIVE result. The score itself is never
                          kept on the phone, so this always fetches fresh. */}
                      <Link
                        href={`/student/results/${s.submissionId}`}
                        className="block text-xs text-primary underline"
                        data-testid={`link-result-${s.submissionId}`}
                      >
                        See your result
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
