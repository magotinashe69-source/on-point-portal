import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import logoPath from "@assets/logo.webp";

// The frame shared by the Privacy Policy and the Terms of Service.
//
// Both are DRAFTS until a lawyer has read them, and the banner says so at the
// very top, before anything else on the page. Take the banner away only once
// the wording is approved and the school has chosen the date it takes effect.
//
// The wording is in English only for now, on purpose. A legal text should be
// translated once, from the approved version — not from a draft that is going
// to change underneath the translation.

export const DRAFT_NOTICE = "DRAFT — pending legal review, not yet in effect.";

export function LegalPage({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-legal-home">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to the main page</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <article className="mx-auto max-w-3xl" data-testid={testId}>
          <p
            role="note"
            className="mb-8 rounded-md border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-center font-bold text-amber-900 dark:text-amber-200"
            data-testid="text-draft-notice"
          >
            {DRAFT_NOTICE}
          </p>

          <div className="flex items-center gap-3 mb-2">
            <img src={logoPath} alt="On Point Education Centre" className="h-10 w-auto" />
            <span className="font-semibold text-muted-foreground">On Point Education Centre</span>
          </div>
          <h1 className="text-3xl font-extrabold mb-8">{title}</h1>

          <div className="space-y-8 leading-relaxed">{children}</div>
        </article>
      </main>
    </div>
  );
}

/** One numbered part of a legal page: a heading and what sits under it. */
export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{heading}</h2>
      {children}
    </section>
  );
}

/** A bulleted list, spaced for reading rather than scanning. */
export function Points({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-6 space-y-2">{children}</ul>;
}

/**
 * Something only the school can decide — how long records are kept, who to
 * contact. Highlighted so nobody can miss it on the way to legal review, and
 * so it cannot quietly go live still reading like a real answer.
 */
export function ToConfirm({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 dark:bg-amber-900/50 px-1 text-inherit">
      [School to confirm: {children}]
    </mark>
  );
}
