// What to show when data fails to LOAD.
//
// Why this exists: most screens used to do
//
//     isLoading ? <spinner/> : data ? <content/> : <"Nothing found">
//
// which quietly tells a lie. A dropped connection, a server error and an
// expired login all fall into that last branch, so the teacher reads
// "No assignments yet" when the truth is "we couldn't ask the server".
// Empty and broken are different things and should never look the same.
//
// The pattern here was lifted from the one screen that already got this right
// (teacher/submission-review.tsx) so every screen now says the same kind of
// thing in the same voice.
//
// Errors reach us as `new Error("404: Not found")` — see lib/queryClient.ts —
// so the status code can be read straight off the message.

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/** Pull the HTTP status out of an error thrown by the query client, if it has one. */
export function statusOf(error: unknown): string | undefined {
  return /^(\d{3}):/.exec(String((error as Error)?.message || ""))?.[1];
}

/**
 * A short, plain sentence describing what went wrong.
 *
 * `what` names the thing being loaded or saved, so the sentence reads naturally:
 *   describeError(err, "the Grade Book") -> "Couldn't load the Grade Book. ..."
 *
 * Also used by mutation onError handlers, where a failed save must never be
 * silent.
 */
export function describeError(error: unknown, what = "this"): string {
  switch (statusOf(error)) {
    case "401":
      return "Your login has expired. Please sign in again.";
    case "403":
      return "You don't have permission to do that.";
    case "404":
      return `${what} could not be found — it may have been deleted.`;
    case "409":
      return "Someone else changed this first. Reload and try again.";
    case "500":
    case "502":
    case "503":
      return "The server had a problem. Please try again in a moment.";
    default:
      return "Please check your connection and try again.";
  }
}

interface Props {
  error: unknown;
  /** Names the thing that failed, e.g. "the Grade Book", "your lessons". */
  what?: string;
  /** Re-run the query. Usually `refetch` from useQuery. */
  onRetry?: () => void;
  /** "page" fills the main area; "panel" sits inside a card. */
  variant?: "page" | "panel";
  /** Where "sign in again" should lead when the login has expired. */
  role?: "teacher" | "student";
  "data-testid"?: string;
}

export function QueryError({
  error,
  what = "this",
  onRetry,
  variant = "panel",
  role = "teacher",
  "data-testid": testId = "query-error",
}: Props) {
  const status = statusOf(error);
  const expired = status === "401";
  const loginHref = role === "teacher" ? "/teacher/login" : "/student/login";

  // A page-level failure gets more room to breathe than one inside a card.
  const pad = variant === "page" ? "py-16" : "py-8";
  const icon = variant === "page" ? "h-6 w-6" : "h-4 w-4";

  return (
    <div className={`flex flex-col items-center justify-center ${pad} px-4 text-center`} data-testid={testId}>
      <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-3">
        <AlertTriangle className={`${icon} text-amber-600 dark:text-amber-400`} />
      </div>
      <p className="font-medium">Couldn&apos;t load {what}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{describeError(error, what)}</p>

      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {expired ? (
          <Link href={loginHref}>
            <Button size="sm" data-testid={`${testId}-login`}>Sign in again</Button>
          </Link>
        ) : (
          onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} data-testid={`${testId}-retry`}>
              Try again
            </Button>
          )
        )}
      </div>
    </div>
  );
}
