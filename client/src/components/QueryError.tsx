// What to show when data fails to LOAD.
//
// Lifted from the design-tokens-and-error-states branch. Its wording predated
// S11.1, so every sentence here has been brought onto the Voice rules: no
// "Please", no contractions, and the action is called "Log in" as it is
// everywhere else.
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
import { useT, type Translation } from "@/lib/i18n";

/** Pull the HTTP status out of an error thrown by the query client, if it has one. */
export function statusOf(error: unknown): string | undefined {
  return /^(\d{3}):/.exec(String((error as Error)?.message || ""))?.[1];
}

/**
 * A short, plain sentence describing what went wrong.
 *
 * `what` names the thing being loaded or saved, so the sentence reads naturally:
 *   describeError(err, t.errors.thing.gradeBook, t.errors)
 *
 * The wording is passed in rather than read from a hook, because this is a
 * plain function: it is also meant for mutation onError handlers, where a
 * failed save must never be silent, and those are not React components.
 */
export function describeError(error: unknown, what: string, words: Translation["errors"]): string {
  switch (statusOf(error)) {
    case "401":
      return words.expired;
    case "403":
      return words.noPermission;
    case "404":
      return words.notFound(what);
    case "409":
      return words.conflict;
    case "500":
    case "502":
    case "503":
      return words.serverProblem;
    default:
      return words.connection;
  }
}

interface Props {
  error: unknown;
  /** Names the thing that failed, from t.errors.thing — it carries its own article. */
  what?: string;
  /** Re-run the query. Usually `refetch` from useQuery. */
  onRetry?: () => void;
  /** "page" fills the main area; "panel" sits inside a card. */
  variant?: "page" | "panel";
  /** Where "sign in again" should lead when the login has expired. */
  role?: "teacher" | "student" | "parent";
  "data-testid"?: string;
}

export function QueryError({
  error,
  what,
  onRetry,
  variant = "panel",
  role = "teacher",
  "data-testid": testId = "query-error",
}: Props) {
  const t = useT();
  // Named in the reader's own language when the caller did not say what failed.
  const thing = what ?? t.errors.thing.generic;

  const status = statusOf(error);
  const expired = status === "401";
  // Each portal has its own login page, and a parent must land on theirs —
  // sending a parent to the teacher login would look like the app had mixed
  // them up with a member of staff.
  const loginHref = `/${role}/login`;

  // A page-level failure gets more room to breathe than one inside a card.
  const pad = variant === "page" ? "py-16" : "py-8";
  const icon = variant === "page" ? "h-6 w-6" : "h-4 w-4";

  return (
    <div className={`flex flex-col items-center justify-center ${pad} px-4 text-center`} data-testid={testId}>
      <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-3">
        <AlertTriangle className={`${icon} text-amber-600 dark:text-amber-400`} />
      </div>
      <p className="font-medium">{t.errors.couldNotLoad(thing)}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{describeError(error, thing, t.errors)}</p>

      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {expired ? (
          <Link href={loginHref}>
            <Button size="sm" data-testid={`${testId}-login`}>{t.errors.logIn}</Button>
          </Link>
        ) : (
          onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} data-testid={`${testId}-retry`}>
              {t.errors.tryAgain}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
