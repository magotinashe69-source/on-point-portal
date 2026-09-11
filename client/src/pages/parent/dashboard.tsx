import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";
import { QueryError } from "@/components/QueryError";
import { subjectLabel, type WeeklyReport } from "@shared/weekly-report";
import { type ParentOverview } from "@shared/parent-overview";
import {
  earnedToday, leftToday, usedToday,
  weekActiveDays, weekEarned, weekUsed, type ParentPlays,
} from "@shared/parent-plays";
import { LogOut, Loader2, GraduationCap, CalendarDays, TrendingUp, AlertCircle, Flame, ClipboardList, MessageSquare, Megaphone, Eye, Target, ChevronRight, Gamepad2, Trophy } from "lucide-react";
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
  const t = useT();
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
  const { data, isLoading, isError, error, refetch } = useQuery<{ success: boolean; child: Child }>({
    queryKey: ["/api/parent/child"],
    enabled: !!parent,
  });

  const {
    data: reportData,
    isLoading: reportLoading,
    isError: reportError,
    error: reportErrorValue,
    refetch: refetchReport,
  } = useQuery<{ success: boolean; report: WeeklyReport }>({
    queryKey: ["/api/parent/weekly-report", { week }],
    enabled: !!parent,
  });

  // The fuller picture: current average, marks by subject, recent marks with
  // the teacher's feedback, homework, and announcements.
  //
  // Like the two above, this address carries NO pupil id. The server works out
  // whose child it is from the parent's own account, so there is nothing on
  // this page that could be pointed at somebody else's child.
  const {
    data: overviewData,
    isLoading: overviewLoading,
    isError: overviewError,
    error: overviewErrorValue,
    refetch: refetchOverview,
  } = useQuery<{ success: boolean; overview: ParentOverview }>({
    queryKey: ["/api/parent/overview"],
    enabled: !!parent,
  });

  // Game plays: what the games cost in homework, and what has been earned and
  // used. Carries no pupil id either, for the same reason as the three above.
  const {
    data: playsData,
    isLoading: playsLoading,
    isError: playsError,
    error: playsErrorValue,
    refetch: refetchPlays,
  } = useQuery<{ success: boolean; plays: ParentPlays }>({
    queryKey: ["/api/parent/plays"],
    enabled: !!parent,
  });

  if (!parent) return null;

  const child = data?.child;
  const report = reportData?.report;
  const overview = overviewData?.overview;
  const plays = playsData?.plays;

  // The teacher's written comments, taken from the recent marks that have one.
  // Kept as its own list so a parent can read the feedback on its own without
  // picking through the marks.
  const feedback = (overview?.recentMarks || []).filter(m => m.feedback);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <span className="text-sm font-semibold hidden sm:inline">{t.parentDash.portal}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
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
              {t.common.logOut}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-parent-welcome">
            Welcome, {parent.fullName}
          </h1>
          <p className="text-muted-foreground">{t.common.tagline}</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {t.parentDash.yourChild}
            </CardTitle>
            <CardDescription>
              {t.parentDash.linkedNote}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.common.loading}
              </div>
            )}

            {isError && (
              <QueryError
                error={error}
                what={t.errors.thing.childDetails}
                onRetry={() => refetch()}
                role="parent"
                data-testid="text-parent-child-error"
              />
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

        {/* ---- The two things a parent came here to do ----
             Big, plain buttons rather than a menu: this is read on a phone,
             often by someone who does not use apps much. */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/parent/work">
            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2" data-testid="button-completed-work">
              <ClipboardList className="h-5 w-5" />
              <span className="text-sm font-medium">{t.work.completedTitle}</span>
            </Button>
          </Link>
          <Link href="/parent/support">
            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2" data-testid="button-support-report">
              <Target className="h-5 w-5" />
              <span className="text-sm font-medium">{t.work.supportTitle}</span>
            </Button>
          </Link>
        </div>

        {/* ---- The weekly report ---- */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle>{t.report.title}</CardTitle>
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
                  {t.parentDash.thisWeek}
                </Button>
                <Button
                  size="sm"
                  variant={week === "last" ? "secondary" : "ghost"}
                  onClick={() => setWeek("last")}
                  data-testid="button-week-last"
                >
                  {t.parentDash.lastWeek}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {reportLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.common.loading}
              </div>
            )}

            {reportError && (
              <QueryError
                error={reportErrorValue}
                what={t.errors.thing.weeklyReport}
                onRetry={() => refetchReport()}
                role="parent"
                data-testid="text-report-error"
              />
            )}

            {report && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    icon={<CalendarDays className="h-4 w-4" />}
                    label={t.report.daysActive}
                    value={String(report.daysActive)}
                    testId="stat-days-active"
                  />
                  <Stat
                    icon={<GraduationCap className="h-4 w-4" />}
                    label={t.report.homework}
                    value={`${report.homework.completed} of ${report.homework.due}`}
                    testId="stat-homework"
                  />
                  <Stat
                    icon={<TrendingUp className="h-4 w-4" />}
                    label={t.report.average}
                    value={report.averagePercent === null ? "—" : `${report.averagePercent}%`}
                    testId="stat-average"
                  />
                  <Stat
                    icon={<Flame className="h-4 w-4" />}
                    label={t.report.streak}
                    value={`${report.streak.current} ${report.streak.current === 1 ? "day" : "days"}`}
                    testId="stat-streak"
                  />
                </div>

                {/* "Nothing marked yet" is said out loud rather than shown as a
                    0% average, which would read as a bad week. */}
                {report.averagePercent === null && (
                  <p className="text-sm text-muted-foreground" data-testid="text-nothing-marked">
                    {t.parentDash.nothingMarkedThisWeek}
                  </p>
                )}

                {report.strongest && (
                  <div className="rounded-md border p-4" data-testid="row-strongest">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs">{t.report.strongest}</span>
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
                      <span className="text-xs">{t.report.needsAttention}</span>
                    </div>
                    <p className="font-semibold">
                      {subjectLabel(report.needsAttention.subject)} — {report.needsAttention.averagePercent}%
                    </p>
                  </div>
                )}

                {/* Said plainly so "Days active" is never mistaken for a record
                    of the child being at school. */}
                <p className="text-xs text-muted-foreground border-t pt-4">
                  "{t.report.daysActive}" counts the days your child handed work in.
                  It is not a record of school attendance.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Everything else the parent may see ----
             All of it is read-only: there is not a single control on this page
             that changes anything, and the server has no parent endpoint that
             writes. */}
        {overviewLoading && (
          <div className="flex items-center gap-2 text-muted-foreground mt-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.common.loading}
          </div>
        )}

        {overviewError && (
          <div className="mt-6">
            <QueryError
              error={overviewErrorValue}
              what={t.errors.thing.restOfChildInfo}
              onRetry={() => refetchOverview()}
              role="parent"
              data-testid="text-overview-error"
            />
          </div>
        )}

        {overview && (
          <div className="space-y-6 mt-6">
            {/* Current average, and how each subject is going. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {t.overview.average}
                </CardTitle>
                <CardDescription>{t.overview.averageNote}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* An average of nothing is said out loud rather than shown as
                    0%, which would read as a bad report. */}
                <p className="text-4xl font-bold" data-testid="text-current-average">
                  {overview.averagePercent === null ? "—" : `${overview.averagePercent}%`}
                </p>
                {overview.averagePercent === null && (
                  <p className="text-sm text-muted-foreground" data-testid="text-overview-nothing-marked">
                    {t.overview.nothingMarked}
                  </p>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-3">{t.overview.subjects}</p>
                  {overview.subjects.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t.overview.subjectsEmpty}</p>
                  )}
                  <div className="space-y-2">
                    {overview.subjects.map(s => (
                      <div
                        key={s.subject}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                        data-testid={`row-subject-${s.subject}`}
                      >
                        <div>
                          <p className="font-medium">{subjectLabel(s.subject)}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.marked} {s.marked === 1 ? "marked piece" : "marked pieces"}
                          </p>
                        </div>
                        <p className="text-lg font-semibold">{s.averagePercent}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* The most recent marked work, newest first. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  {t.overview.recentMarks}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.recentMarks.length === 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-recent-marks">
                    {t.overview.recentMarksEmpty}
                  </p>
                )}
                {/* Each row opens that piece of work, question by question.
                    The whole row is the link so it is easy to hit with a thumb.
                    The id in the address is checked against this parent's own
                    child on the server before anything comes back. */}
                <div className="space-y-2">
                  {overview.recentMarks.map((m, i) => (
                    <Link
                      key={i}
                      href={`/parent/work/${m.submissionId}`}
                      data-testid={`link-recent-mark-${m.submissionId}`}
                    >
                      <div
                        className="rounded-md border p-3 hover-elevate active-elevate-2 cursor-pointer"
                        data-testid={`row-recent-mark-${i}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{m.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {subjectLabel(m.subject)} · {new Date(m.markedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold">{m.percent}%</p>
                            <p className="text-xs text-muted-foreground">
                              {m.score} / {m.outOf}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {overview.recentMarks.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {t.parentDash.tapAnyPiece}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Homework set against homework handed in, and what is left. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  {t.overview.homework}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    icon={<ClipboardList className="h-4 w-4" />}
                    label={t.overview.homeworkSet}
                    value={String(overview.homework.assigned)}
                    testId="stat-homework-assigned"
                  />
                  <Stat
                    icon={<GraduationCap className="h-4 w-4" />}
                    label={t.overview.homeworkDone}
                    value={String(overview.homework.completed)}
                    testId="stat-homework-completed"
                  />
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-3">{t.overview.outstanding}</p>
                  {overview.homework.outstanding.length === 0 && (
                    <p className="text-sm text-muted-foreground" data-testid="text-nothing-outstanding">
                      {t.overview.outstandingEmpty}
                    </p>
                  )}
                  <div className="space-y-2">
                    {overview.homework.outstanding.map((item, i) => (
                      // Not a link, on purpose: this is work that has NOT been
                      // handed in, so there are no answers to open. Making it
                      // tappable would promise a page that cannot exist yet.
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                        data-testid={`row-outstanding-${i}`}
                      >
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{subjectLabel(item.subject)}</p>
                        </div>
                        <Badge variant="outline">Due {item.dueDate}</Badge>
                      </div>
                    ))}
                  </div>

                  {/* The work that HAS been handed in is all openable, so the
                      way through to it sits here where a parent is already
                      thinking about homework. */}
                  {overview.homework.completed > 0 && (
                    <Link href="/parent/work">
                      <Button variant="outline" size="sm" className="mt-3 w-full" data-testid="button-see-completed-work">
                        <ClipboardList className="h-4 w-4 mr-2" />
                        See all {overview.homework.completed} handed in
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Said plainly, because the school keeps no attendance
                    register and this figure must never be mistaken for one. */}
                <div className="border-t pt-4">
                  <Stat
                    icon={<CalendarDays className="h-4 w-4" />}
                    label={t.overview.activity}
                    value={String(overview.attendance.daysActiveLast4Weeks)}
                    testId="stat-days-active-4-weeks"
                  />
                  <p className="text-xs text-muted-foreground mt-2">{t.overview.activityNote}</p>
                </div>
              </CardContent>
            </Card>

            {/* Games and screen time.
                Placed straight after homework on purpose: the two are the same
                number, and reading them together is the whole point. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  {t.plays.title}
                </CardTitle>
                <CardDescription>{t.plays.howItWorks}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {playsLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t.common.loading}
                  </div>
                )}

                {/* A failure must not read as "your child earned nothing".
                    Without this the card simply rendered empty, which is the
                    same trap the other three sections were pulled out of. */}
                {playsError && (
                  <QueryError
                    error={playsErrorValue}
                    what={t.errors.thing.childGamePlays}
                    onRetry={() => refetchPlays()}
                    role="parent"
                    variant="panel"
                    data-testid="text-plays-error"
                  />
                )}

                {/* Forms 1-2 do not have the games. Said plainly, because a row
                    of zeros would read as "your child has earned nothing". */}
                {!playsLoading && !playsError && plays && !plays.available && (
                  <p className="text-sm text-muted-foreground" data-testid="text-plays-not-available">
                    {t.plays.notAvailable}
                  </p>
                )}

                {!playsLoading && !playsError && plays?.available && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {/* All three count BOTH games, so they read against each
                          other: earned 4, used 3, left 1. The per-game split is
                          the lines underneath. */}
                      <Stat
                        icon={<ClipboardList className="h-4 w-4" />}
                        label={t.plays.earnedToday}
                        value={String(earnedToday(plays.today.games))}
                        testId="stat-plays-earned-today"
                      />
                      <Stat
                        icon={<Gamepad2 className="h-4 w-4" />}
                        label={t.plays.usedToday}
                        value={String(usedToday(plays.today.games))}
                        testId="stat-plays-used-today"
                      />
                      <Stat
                        icon={<Target className="h-4 w-4" />}
                        label={t.plays.leftToday}
                        value={String(leftToday(plays.today.games))}
                        testId="stat-plays-left-today"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">{t.plays.bothGamesNote}</p>

                    {/* Where today's plays came from, in the child's own terms. */}
                    {plays.today.assignmentsHandedIn === 0 ? (
                      <p className="text-sm text-muted-foreground" data-testid="text-plays-nothing-today">
                        {t.plays.nothingToday}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {plays.today.games.map((g) => (
                          <p key={g.game} className="text-sm" data-testid={`text-plays-${g.game}`}>
                            {t.plays.gameLine(g.label, g.left, g.earned)}
                          </p>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">{t.plays.resetNote}</p>

                    {/* The week, so a parent who looks in once can still read
                        the pattern rather than only the day they happened to
                        open it. */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold mb-3">{t.plays.week}</p>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <Stat
                          icon={<ClipboardList className="h-4 w-4" />}
                          label={t.plays.weekEarned}
                          value={String(weekEarned(plays.week))}
                          testId="stat-plays-week-earned"
                        />
                        <Stat
                          icon={<Gamepad2 className="h-4 w-4" />}
                          label={t.plays.weekUsed}
                          value={String(weekUsed(plays.week))}
                          testId="stat-plays-week-used"
                        />
                        <Stat
                          icon={<CalendarDays className="h-4 w-4" />}
                          label={t.plays.weekActive}
                          value={String(weekActiveDays(plays.week))}
                          testId="stat-plays-week-active"
                        />
                      </div>

                      <div className="space-y-2">
                        {plays.week.map((d) => (
                          <div
                            key={d.day}
                            className="flex items-center justify-between gap-3 rounded-md border p-3"
                            data-testid={`row-plays-day-${d.day}`}
                          >
                            <p className="text-sm font-medium">{d.day}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {d.assignmentsHandedIn} handed in
                              </Badge>
                              <Badge variant={d.playsUsed > 0 ? "secondary" : "outline"}>
                                {d.playsUsed} played
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Best scores, as encouragement rather than a report. */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        {t.plays.records}
                      </p>
                      {plays.records.length === 0 ? (
                        <p className="text-sm text-muted-foreground" data-testid="text-plays-no-records">
                          {t.plays.recordsEmpty}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {plays.records.map((r) => (
                            <div
                              key={r.game}
                              className="flex items-center justify-between gap-3 rounded-md border p-3"
                              data-testid={`row-plays-record-${r.game}`}
                            >
                              <div>
                                <p className="font-medium">{r.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {r.subject ? `${subjectLabel(r.subject)} · ` : ""}
                                  {r.gamesPlayed} played
                                </p>
                              </div>
                              <Badge variant="secondary">
                                {t.plays.recordLine(r.bestScore, r.bestOutOf)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Said plainly, in the same spirit as the attendance note:
                        this is plays, not minutes, and must not be read as a
                        record of time spent. */}
                    <p className="text-xs text-muted-foreground border-t pt-4">
                      {t.plays.notMinutes}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* What the teacher wrote about the work. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {t.overview.feedback}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedback.length === 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-feedback">
                    {t.overview.feedbackEmpty}
                  </p>
                )}
                <div className="space-y-3">
                  {feedback.map((m, i) => (
                    // Reading a comment is usually the moment a parent wants to
                    // see the work it is about, so these open it too.
                    <Link
                      key={i}
                      href={`/parent/work/${m.submissionId}`}
                      data-testid={`link-feedback-${m.submissionId}`}
                    >
                      <div
                        className="rounded-md border p-3 hover-elevate active-elevate-2 cursor-pointer"
                        data-testid={`row-feedback-${i}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground mb-1">
                              {subjectLabel(m.subject)} · {m.title}
                            </p>
                            <p className="text-sm">{m.feedback}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* School notices for this child's class. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  {t.overview.announcements}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.announcements.length === 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-announcements">
                    {t.overview.announcementsEmpty}
                  </p>
                )}
                <div className="space-y-3">
                  {overview.announcements.map(a => (
                    <div key={a.id} className="rounded-md border p-3" data-testid={`row-announcement-${a.id}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                        <p className="font-medium">{a.title}</p>
                        {a.priority !== "normal" && (
                          <Badge variant={a.priority === "urgent" ? "destructive" : "secondary"}>
                            {a.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* A plain reminder of what this account is. */}
            <p className="text-xs text-muted-foreground flex items-center gap-2" data-testid="text-read-only">
              <Eye className="h-3 w-3" />
              {t.overview.readOnly}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
