// A safety net for one part of a page.
//
// If the code inside it crashes, React would normally blank the whole app —
// a "white screen". This catches the crash, keeps the rest of the app alive,
// and shows a friendly message with a way back. We use it around the
// submission review so one odd submission can never take out the Grade Book.

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  // Where "Go back" should send the teacher.
  backHref?: string;
  backLabel?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Something went wrong." };
  }

  componentDidCatch(error: Error) {
    // Leave a trace in the browser console so the problem can be looked into.
    console.error("Caught by ErrorBoundary:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { backHref = "/teacher/gradebook", backLabel = "Back to Grade Book" } = this.props;
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="error-boundary">
        <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="font-medium">Sorry — this page couldn't be shown.</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Nothing has been lost. You can go back and try another submission.
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-md break-words">{this.state.message}</p>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-boundary-retry">
            Try again
          </Button>
          <Button onClick={() => { window.location.href = backHref; }} data-testid="button-boundary-back">
            {backLabel}
          </Button>
        </div>
      </div>
    );
  }
}
