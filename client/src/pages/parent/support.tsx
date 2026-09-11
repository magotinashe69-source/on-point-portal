// "Areas to practise" — the parent's support report.
//
// This is the page a parent takes away and acts on: the topics their child
// keeps getting wrong, grouped by subject, plus which subject is going well
// and which one needs the time.
//
// The tone is deliberate. Every figure here comes from questions the child got
// wrong, which is an easy thing to write up as a list of failures. It is
// written instead as a plan — "practise: fractions" — because a parent who
// reads this should come away with something to DO on Saturday morning, not a
// reason to be disappointed in their child.
//
// Read-only, and no pupil id in the address: the server works out the child
// from the parent's own account.

import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";
import { subjectLabel } from "@shared/weekly-report";
import { WORK_TEXT, practiseLine, type SupportReport } from "@shared/parent-work";
import { ArrowLeft, Loader2, Sparkles, TrendingUp, Target } from "lucide-react";
import logoPath from "@assets/logo.webp";

export default function ParentSupportPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { parent } = useAuth();

  useEffect(() => {
    if (!parent) setLocation("/parent/login");
  }, [parent, setLocation]);

  const { data, isLoading, isError } = useQuery<{ success: boolean; report: SupportReport }>({
    queryKey: ["/api/parent/support-report"],
    enabled: !!parent,
  });

  if (!parent) return null;

  const report = data?.report;
  const subjects = report?.subjects || [];
  // Marked work exists, but the child got everything right — worth saying so
  // out loud rather than showing an empty page that looks broken.
  const allCorrect = !!report && subjects.length === 0 && report.questionsReviewed > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/parent/dashboard" className="flex items-center gap-2 min-w-0">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="text-sm truncate">{t.common.dashboard}</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-1">{WORK_TEXT.supportTitle}</h1>
        <p className="text-muted-foreground text-sm mb-6">{WORK_TEXT.supportNote}</p>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive" data-testid="text-support-error">
            We could not build the report just now. Try again in a moment.
          </p>
        )}

        {report && (
          <div className="space-y-4">
            {/* Strongest and working-on, side by side on a phone. Both are only
                filled in when two or more subjects have been marked — with one
                subject there is no strongest to name. */}
            {(report.strongest || report.workingOn) && (
              <div className="grid grid-cols-2 gap-3">
                {report.strongest && (
                  <div className="rounded-md border p-4" data-testid="row-support-strongest">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs">{WORK_TEXT.strongest}</span>
                    </div>
                    <p className="font-semibold">{subjectLabel(report.strongest.subject)}</p>
                    <p className="text-sm text-muted-foreground">{report.strongest.averagePercent}%</p>
                  </div>
                )}
                {report.workingOn && (
                  <div className="rounded-md border p-4" data-testid="row-support-working-on">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Target className="h-4 w-4" />
                      <span className="text-xs">{WORK_TEXT.workingOn}</span>
                    </div>
                    <p className="font-semibold">{subjectLabel(report.workingOn.subject)}</p>
                    <p className="text-sm text-muted-foreground">{report.workingOn.averagePercent}%</p>
                  </div>
                )}
              </div>
            )}

            {allCorrect && (
              <Card>
                <CardContent className="py-8 text-center" data-testid="text-support-all-correct">
                  <Sparkles className="h-6 w-6 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">{WORK_TEXT.supportAllCorrect}</p>
                </CardContent>
              </Card>
            )}

            {!allCorrect && subjects.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground" data-testid="text-support-empty">
                  {WORK_TEXT.supportEmpty}
                </CardContent>
              </Card>
            )}

            {/* One card per subject: the one-line "practise: …" a parent can
                read at a glance, then the topics with how often each came up. */}
            {subjects.map(subject => (
              <Card key={subject.subject} data-testid={`card-support-${subject.subject}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-base">{subjectLabel(subject.subject)}</CardTitle>
                    {subject.averagePercent !== null && (
                      <Badge variant="outline">{subject.averagePercent}%</Badge>
                    )}
                  </div>
                  <CardDescription data-testid={`text-practise-line-${subject.subject}`}>
                    {WORK_TEXT.practise}: {practiseLine(subject.topics)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {subject.topics.map(topic => (
                      <li
                        key={topic.topic}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                      >
                        <span className="text-sm font-medium">{topic.topic}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {t.parentWork.questionsToGoOver(topic.missed)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}

            {report.questionsReviewed > 0 && (
              <p className="text-xs text-muted-foreground border-t pt-4">
                {WORK_TEXT.basedOn} {report.questionsReviewed} {WORK_TEXT.questionsMarked}.
              </p>
            )}

            <p className="text-xs text-muted-foreground">{WORK_TEXT.readOnly}</p>
          </div>
        )}
      </main>
    </div>
  );
}
