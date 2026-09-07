import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { REPORT_TEXT, subjectLabel, type WeeklyReport } from "@shared/weekly-report";
import { LogOut, Loader2, GraduationCap, CalendarDays, TrendingUp, AlertCircle, Flame } from "lucide-react";
import logoPath from "@assets/logo.webp";

// What the server sends back about the child. Deliberately small: a parent sees
// their child's name and class, and the weekly report below it.
type Child = {
  id: number;
  fullName: string;
  form: string;
};

/** One figure in the summary row. */
function Stat({
  icon,
  label,
  value,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold" data-testid={testId}>{value}</p>
    </div>
  );
}

export default function ParentDashboard() {
  const [, setLocation] = useLocation();
  const { parent, logout } = useAuth();

  // Which week the parent is looking at. "this" is the week we are in; "last"
  // is the completed week, which is the one the school sends out.
  const [week, setWeek] = useState<"this" | "last">("this");

  useEffect(() => {
    if (!parent) {
      setLocation("/parent/login");
    }
  }, [parent, setLocation]);

  // Note there is no id in either address. The server works out which child to
  // send from the parent's own account, so this page has no way to ask for
  // anybody else's child even if it wanted to.
  const { data, isLoading, isError } = useQuery<{ success: boolean; child: Child }>({
    queryKey: ["/api/parent/child"],
    enabled: !!parent,
  });

  const {
    data: reportData,
    isLoading: reportLoading,
    isError: reportError,
  } = useQuery<{ success: boolean; report: WeeklyReport }>({
    queryKey: ["/api/parent/weekly-report", { week }],
    enabled: !!parent,
  });

  if (!parent) return null;

  const child = data?.child;
  const report = reportData?.report;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <span className="text-sm font-semibold hidden sm:inline">Parent Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                setLocation("/parent/login");
              }}
              data-testid="button-parent-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-parent-welcome">
            Welcome, {parent.fullName}
          </h1>
          <p className="text-muted-foreground">Quality Beyond Measure</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Your child
            </CardTitle>
            <CardDescription>
              This account is linked to one pupil, and shows only their information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}

            {isError && (
              <p className="text-sm text-destructive" data-testid="text-parent-child-error">
                We could not load your child's details just now. Try again in a moment.
              </p>
            )}

            {child && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xl font-semibold" data-testid="text-child-name">
                  {child.fullName}
                </p>
                <Badge variant="outline" data-testid="badge-child-form">{child.form}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- The weekly report ---- */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle>{REPORT_TEXT.title}</CardTitle>
                <CardDescription data-testid="text-report-week">
                  {report ? report.week.label : " "}
                </CardDescription>
              </div>
              {/* Two plain buttons rather than a dropdown — this has to be easy
                  to use on a phone. */}
              <div className="flex gap-1 rounded-md border p-1">
                <Button
                  size="sm"
                  variant={week === "this" ? "secondary" : "ghost"}
                  onClick={() => setWeek("this")}
                  data-testid="button-week-this"
                >
                  This week
                </Button>
                <Button
                  size="sm"
                  variant={week === "last" ? "secondary" : "ghost"}
                  onClick={() => setWeek("last")}
                  data-testid="button-week-last"
                >
                  Last week
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {reportLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}

            {reportError && (
              <p className="text-sm text-destructive" data-testid="text-report-error">
                We could not load the weekly report just now. Try again in a moment.
              </p>
            )}

            {report && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    icon={<CalendarDays className="h-4 w-4" />}
                    label={REPORT_TEXT.daysActive}
                    value={String(report.daysActive)}
                    testId="stat-days-active"
                  />
                  <Stat
                    icon={<GraduationCap className="h-4 w-4" />}
                    label={REPORT_TEXT.homework}
                    value={`${report.homework.completed} of ${report.homework.due}`}
                    testId="stat-homework"
                  />
                  <Stat
                    icon={<TrendingUp className="h-4 w-4" />}
                    label={REPORT_TEXT.average}
                    value={report.averagePercent === null ? "—" : `${report.averagePercent}%`}
                    testId="stat-average"
                  />
                  <Stat
                    icon={<Flame className="h-4 w-4" />}
                    label={REPORT_TEXT.streak}
                    value={`${report.streak.current} ${report.streak.current === 1 ? "day" : "days"}`}
                    testId="stat-streak"
                  />
                </div>

                {/* "Nothing marked yet" is said out loud rather than shown as a
                    0% average, which would read as a bad week. */}
                {report.averagePercent === null && (
                  <p className="text-sm text-muted-foreground" data-testid="text-nothing-marked">
                    No work has been marked for this week yet.
                  </p>
                )}

                {report.strongest && (
                  <div className="rounded-md border p-4" data-testid="row-strongest">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs">{REPORT_TEXT.strongest}</span>
                    </div>
                    <p className="font-semibold">
                      {subjectLabel(report.strongest.subject)} — {report.strongest.averagePercent}%
                    </p>
                  </div>
                )}

                {report.needsAttention && (
                  <div className="rounded-md border p-4" data-testid="row-needs-attention">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs">{REPORT_TEXT.needsAttention}</span>
                    </div>
                    <p className="font-semibold">
                      {subjectLabel(report.needsAttention.subject)} — {report.needsAttention.averagePercent}%
                    </p>
                  </div>
                )}

                {/* Said plainly so "Days active" is never mistaken for a record
                    of the child being at school. */}
                <p className="text-xs text-muted-foreground border-t pt-4">
                  "{REPORT_TEXT.daysActive}" counts the days your child handed work in.
                  It is not a record of school attendance.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
