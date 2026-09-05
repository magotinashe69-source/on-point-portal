// Error boundaries — so a crash in one part of the app can never white-screen
// the whole page.
//
// Two flavours, both built on the same boundary:
//   * <ErrorBoundary>     — for a small widget inside a page. Shows a quiet
//                           "couldn't load this bit" note and the rest of the
//                           page carries on.
//   * <PageErrorBoundary> — for a whole page's content. Shows a friendly
//                           message with a way to retry or go back.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode; // custom fallback; defaults to a small note
  label?: string;       // shown in the console log to help identify the widget
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[widget error${this.props.label ? `: ${this.props.label}` : ""}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            className="rounded-xl border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground"
            data-testid="widget-error"
          >
            Couldn&apos;t load this bit — try refreshing. The rest of your page still works.
          </div>
        )
      );
    }
    return this.props.children;
  }
}

interface PageProps {
  children: ReactNode;
  backHref?: string;  // where "go back" should lead
  backLabel?: string;
  label?: string;     // shown in the console log
}

// The bigger fallback, for when a whole page's content fails rather than one
// widget. Nothing has been lost, so we say so and offer a way onwards.
export function PageErrorBoundary({
  children,
  backHref = "/",
  backLabel = "Go back",
  label,
}: PageProps) {
  const fallback = (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="page-error">
      <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
        <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <p className="font-medium">This page could not be shown.</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Nothing has been lost. You can go back and try again.
      </p>
      <div className="flex gap-2 mt-5">
        <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-page-error-retry">
          Try again
        </Button>
        <Button onClick={() => { window.location.href = backHref; }} data-testid="button-page-error-back">
          {backLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <ErrorBoundary label={label} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}
