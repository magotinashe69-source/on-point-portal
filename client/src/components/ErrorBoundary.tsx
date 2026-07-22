// A small error boundary so one failing widget can never white-screen the whole
// page. If a wrapped widget throws during render, we show a quiet "couldn't
// load" note and the rest of the page keeps working.

import { Component, type ErrorInfo, type ReactNode } from "react";

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
