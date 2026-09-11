// Games and homework — the teacher's view of the plays ledger, a class at a time.
//
// Deliberately not the parent's card with more rows in it. A parent asks about
// one child ("is the phone being earned, or just used?"); a teacher asks about
// a class ("is this reward pulling homework in, and who is it not reaching?").
//
// So the class is split into the four groups a teacher can act on, and the
// group that matters — the children who handed nothing in and played nothing —
// is listed FIRST. Nobody should have to scroll a class of thirty to find them.

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PLAY_GROUPS, TEACHER_PLAYS_TEXT, countGroup,
  type PlayGroup, type TeacherPlays,
} from "@shared/teacher-plays";
import { ArrowLeft, Loader2, Gamepad2, ClipboardList, Users, AlertTriangle } from "lucide-react";
import logoPath from "@assets/logo.webp";
import { useT } from "@/lib/i18n";

// The games are Stages 3-6 only, but every class is offered so a teacher who
// picks Form 1 gets a plain answer rather than wondering why it is missing.
const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"] as const;

type Range = "today" | "thisWeek";

/** Today, and the Monday of this week, as YYYY-MM-DD. */
function dateRange(range: Range): { dateFrom: string; dateTo: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();

  if (range === "today") return { dateFrom: fmt(today), dateTo: fmt(today) };

  // Weeks run Monday to Sunday, the same as the weekly parent report.
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return { dateFrom: fmt(monday), dateTo: fmt(today) };
}

/** How each group is coloured. The "neither" group is the one to notice. */
const GROUP_STYLES: Record<PlayGroup, string> = {
  neither: "border-destructive/50",
  playedNotEarned: "border-amber-500/50",
  earnedNotPlayed: "border-primary/40",
  earnedAndPlayed: "border-green-500/40",
};

/** One figure in the summary row. */
function Stat({ icon, label, value, testId }: {
  icon: React.ReactNode; label: string; value: string; testId: string;
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

export default function TeacherGamePlays() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();

  const [form, setForm] = useState<string>("");
  const [range, setRange] = useState<Range>("today");

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const { dateFrom, dateTo } = dateRange(range);

  const { data, isLoading, isError } = useQuery<{ success: boolean; plays: TeacherPlays }>({
    queryKey: ["/api/reports/plays", form, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams(
        dateFrom === dateTo ? { form, date: dateFrom } : { form, dateFrom, dateTo },
      );
      const res = await fetch(`/api/reports/plays?${params}`);
      return res.json();
    },
    // Nothing to ask for until a class is chosen.
    enabled: !!teacher && !!form,
    staleTime: 0,
  });

  const plays = data?.plays;

  if (!teacher) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t.teacherPlays.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t.teacherPlays.subtitle}</p>
        </div>

        {/* The rule this whole page rests on, said once. */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">{t.teacherPlays.howItWorks}</p>
          </CardContent>
        </Card>

        {/* Class and range. */}
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center gap-3">
            <Select value={form} onValueChange={setForm}>
              <SelectTrigger className="w-[180px]" data-testid="select-form">
                <SelectValue placeholder={t.teacherPlays.pickClass} />
              </SelectTrigger>
              <SelectContent>
                {FORMS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant={range === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setRange("today")}
                data-testid="button-range-today"
              >
                {t.teacherPlays.today}
              </Button>
              <Button
                variant={range === "thisWeek" ? "default" : "outline"}
                size="sm"
                onClick={() => setRange("thisWeek")}
                data-testid="button-range-week"
              >
                {t.teacherPlays.thisWeek}
              </Button>
            </div>
          </CardContent>
        </Card>

        {!form && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-pick-class">
              {t.teacherPlays.pickClass} to see who is earning their plays.
            </CardContent>
          </Card>
        )}

        {form && isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {form && isError && (
          <p className="text-sm text-destructive" data-testid="text-plays-error">
            Couldn't load the report. Check your connection and try again.
          </p>
        )}

        {/* Forms 1-2 have no games. Said plainly rather than as a class of zeros. */}
        {plays && !plays.available && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-not-available">
              {t.teacherPlays.notAvailable}
            </CardContent>
          </Card>
        )}

        {plays?.available && plays.rows.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-empty-class">
              {t.teacherPlays.emptyClass}
            </CardContent>
          </Card>
        )}

        {plays?.available && plays.rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                icon={<Users className="h-4 w-4" />}
                label={t.teacherPlays.children}
                value={String(plays.summary.children)}
                testId="stat-children"
              />
              <Stat
                icon={<ClipboardList className="h-4 w-4" />}
                label={t.teacherPlays.earning}
                value={String(plays.summary.earning)}
                testId="stat-earning"
              />
              <Stat
                icon={<Gamepad2 className="h-4 w-4" />}
                label={t.teacherPlays.playing}
                value={String(plays.summary.playing)}
                testId="stat-playing"
              />
              <Stat
                icon={<AlertTriangle className="h-4 w-4" />}
                label={t.teacherPlays.neither}
                value={String(plays.summary.neither)}
                testId="stat-neither"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                icon={<ClipboardList className="h-4 w-4" />}
                label={t.teacherPlays.totalEarned}
                value={String(plays.summary.totalEarned)}
                testId="stat-total-earned"
              />
              <Stat
                icon={<Gamepad2 className="h-4 w-4" />}
                label={t.teacherPlays.totalUsed}
                value={String(plays.summary.totalUsed)}
                testId="stat-total-used"
              />
            </div>

            {/* The groups, in the order the builder sorted them: the children
                the reward is not reaching come first. */}
            {PLAY_GROUPS
              .slice()
              .sort((a, b) => {
                const order: PlayGroup[] = ["neither", "playedNotEarned", "earnedNotPlayed", "earnedAndPlayed"];
                return order.indexOf(a) - order.indexOf(b);
              })
              .map((group) => {
                const rows = plays.rows.filter((r) => r.group === group);
                if (rows.length === 0) return null;
                return (
                  <Card key={group} className={GROUP_STYLES[group]} data-testid={`group-${group}`}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {t.teacherPlays.groups[group]}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({countGroup(plays.rows, group)})
                        </span>
                      </CardTitle>
                      <CardDescription>{t.teacherPlays.groupNotes[group]}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {rows.map((r) => (
                        <div
                          key={r.studentId}
                          className="flex items-center justify-between gap-3 rounded-md border p-3"
                          data-testid={`row-child-${r.studentId}`}
                        >
                          <div>
                            <p className="font-medium">{r.fullName}</p>
                            {/* The school's id, because two children can share
                                a name and this list is meant to be acted on. */}
                            <p className="text-xs text-muted-foreground" data-testid={`text-pupil-id-${r.studentId}`}>
                              ID: {r.pupilId} · {r.assignmentsHandedIn} handed in
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {t.teacherPlays.usedLine(r.playsUsed, r.playsEarned)}
                            </Badge>
                            {/* Only today has leftovers worth naming — plays do
                                not carry over, so a past day has none. */}
                            {r.playsLeft !== null && r.playsLeft > 0 && (
                              <Badge variant="outline">{r.playsLeft} left</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}

            <p className="text-xs text-muted-foreground">{t.teacherPlays.notMinutes}</p>
          </>
        )}
      </main>
    </div>
  );
}
