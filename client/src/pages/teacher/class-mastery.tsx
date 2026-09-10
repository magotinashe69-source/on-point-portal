// Class skills — the teacher's view of the mastery map.
//
// Deliberately not the child's map with more names in it. The two ask opposite
// questions, and it shows in the ordering:
//
//   A child asks  "what am I good at?"     -> strongest first, to encourage.
//   A teacher asks "what must I reteach?"  -> WEAKEST first, to act on.
//
// The thing this page exists to prevent is a split class hiding behind an
// average. A topic at 65% might be every child at 65%, or half at 100% and half
// at 30% — completely different lessons. So every topic shows the spread beside
// the figure, and a genuinely split one is called out in words.

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subjectLabel } from "@shared/weekly-report";
import {
  CLASS_MASTERY_TEXT, MASTERY_TEXT, isSplit,
  type ClassMastery, type ClassTopicMastery, type MasteryBand,
} from "@shared/mastery";
import {
  ArrowLeft, Loader2, Target, Users, GraduationCap, AlertTriangle, CheckCircle2, TrendingUp,
} from "lucide-react";
import logoPath from "@assets/logo.webp";

const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];

/** Colour AND an icon AND words, the same rule as the child's map. */
const BAND_STYLE: Record<MasteryBand, { dot: string; text: string; bar: string; icon: React.ReactNode }> = {
  mastered: {
    dot: "bg-green-500", text: "text-green-700 dark:text-green-400", bar: "bg-green-500",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  developing: {
    dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-500", bar: "bg-amber-500",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  practise: {
    dot: "bg-red-500", text: "text-red-700 dark:text-red-400", bar: "bg-red-500",
    icon: <Target className="h-4 w-4" />,
  },
};

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

function TopicRow({ topic }: { topic: ClassTopicMastery }) {
  const style = BAND_STYLE[topic.band];
  const split = isSplit(topic);
  return (
    <div className="py-3" data-testid={`row-class-topic-${topic.subject}-${topic.topic}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${style.dot}`} aria-hidden />
            <span className="font-medium truncate">{topic.topic}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subjectLabel(topic.subject)}</p>
        </div>
        <div className={`flex items-center gap-1.5 shrink-0 ${style.text}`}>
          {style.icon}
          <span className="text-sm font-semibold tabular-nums" data-testid={`text-class-percent-${topic.topic}`}>
            {topic.percent}%
          </span>
        </div>
      </div>

      <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${style.bar}`}
          style={{ width: `${Math.max(topic.percent, 2)}%` }}
          aria-hidden
        />
      </div>

      {/* The spread. Without this the number above can hide a class split down
          the middle, which is the one thing this page must not do. */}
      <p className="text-xs text-muted-foreground mt-1" data-testid={`text-spread-${topic.topic}`}>
        {topic.children} {topic.children === 1 ? "pupil" : "pupils"} ·{" "}
        {CLASS_MASTERY_TEXT.spread(topic.mastered, topic.developing, topic.practise)}
      </p>

      {split && (
        <p className="text-xs mt-1 flex items-center gap-1.5 text-amber-700 dark:text-amber-500"
           data-testid={`text-split-${topic.topic}`}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {CLASS_MASTERY_TEXT.splitWarning}
        </p>
      )}
    </div>
  );
}

export default function ClassMasteryPage() {
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const [form, setForm] = useState("");

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const { data, isLoading, isError } = useQuery<{ success: boolean; mastery: ClassMastery }>({
    queryKey: ["/api/reports/mastery", form],
    queryFn: async () => {
      const res = await fetch(`/api/reports/mastery?form=${encodeURIComponent(form)}`);
      return res.json();
    },
    enabled: !!teacher && !!form,
    staleTime: 0,
  });

  const mastery = data?.mastery;

  if (!teacher) return null;

  // Weakest first for reteaching; the strongest few shown separately so the
  // page is not only bad news.
  const weakest = (mastery?.topics || []).filter((t) => t.band !== "mastered");
  const strongest = (mastery?.topics || []).filter((t) => t.band === "mastered").reverse();

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
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{CLASS_MASTERY_TEXT.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{CLASS_MASTERY_TEXT.subtitle}</p>
        </div>

        <Card>
          <CardContent className="py-4">
            <Select value={form} onValueChange={setForm}>
              <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-mastery-form">
                <SelectValue placeholder={CLASS_MASTERY_TEXT.pickClass} />
              </SelectTrigger>
              <SelectContent>
                {FORMS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {!form && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-pick-class">
              {CLASS_MASTERY_TEXT.pickClass} to see what it can do.
            </CardContent>
          </Card>
        )}

        {form && isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {form && isError && (
          <p className="text-sm text-destructive" data-testid="text-mastery-error">
            Couldn't load the class skills. Check your connection and try again.
          </p>
        )}

        {mastery && mastery.children === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-empty-class">
              {CLASS_MASTERY_TEXT.emptyClass}
            </CardContent>
          </Card>
        )}

        {mastery && mastery.children > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat
                icon={<Users className="h-4 w-4" />}
                label={CLASS_MASTERY_TEXT.children}
                value={String(mastery.children)}
                testId="stat-children"
              />
              <Stat
                icon={<GraduationCap className="h-4 w-4" />}
                label={CLASS_MASTERY_TEXT.withWork}
                value={String(mastery.withWork)}
                testId="stat-with-work"
              />
              <Stat
                icon={<Target className="h-4 w-4" />}
                label={CLASS_MASTERY_TEXT.topicsTracked}
                value={String(mastery.topics.length)}
                testId="stat-topics"
              />
            </div>

            {mastery.topics.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-no-skills">
                  {CLASS_MASTERY_TEXT.empty}
                </CardContent>
              </Card>
            )}

            {weakest.length > 0 && (
              <Card className="border-primary/40" data-testid="card-reteach">
                <CardContent className="py-4">
                  <p className="font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {CLASS_MASTERY_TEXT.reteach}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    {CLASS_MASTERY_TEXT.reteachNote}
                  </p>
                  <div className="divide-y">
                    {weakest.map((t) => <TopicRow key={`${t.subject}-${t.topic}`} topic={t} />)}
                  </div>
                </CardContent>
              </Card>
            )}

            {strongest.length > 0 && (
              <Card data-testid="card-strongest">
                <CardContent className="py-4">
                  <p className="font-semibold mb-2">{CLASS_MASTERY_TEXT.strongest}</p>
                  <div className="divide-y">
                    {strongest.map((t) => <TopicRow key={`${t.subject}-${t.topic}`} topic={t} />)}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card data-testid="card-need-support">
              <CardContent className="py-4">
                <p className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {CLASS_MASTERY_TEXT.needSupport}
                </p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  {CLASS_MASTERY_TEXT.needSupportNote}
                </p>

                {mastery.needSupport.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-gaps">
                    {CLASS_MASTERY_TEXT.noGaps}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {mastery.needSupport.map((c) => (
                      <div
                        key={c.studentId}
                        className="rounded-md border p-3"
                        data-testid={`row-support-${c.studentId}`}
                      >
                        <p className="font-medium">{c.fullName}</p>
                        {/* Two children really can share a name, and this page
                            exists to be acted on — a name alone would send a
                            teacher to the wrong child. */}
                        <p className="text-xs text-muted-foreground" data-testid={`text-pupil-id-${c.studentId}`}>
                          ID: {c.pupilId}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {c.topics.map((t) => (
                            <Badge
                              key={`${t.subject}-${t.topic}`}
                              variant="outline"
                              className="text-xs"
                              data-testid={`badge-support-${c.studentId}-${t.topic}`}
                            >
                              {t.topic} · {t.percent}%
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Said plainly, so a thin map is explained rather than mistaken for
                a class that has done nothing. */}
            {mastery.untagged > 0 && (
              <p className="text-xs text-muted-foreground" data-testid="text-untagged-note">
                {CLASS_MASTERY_TEXT.untaggedNote(mastery.untagged)}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {MASTERY_TEXT.bands.mastered} is {80}%+, {MASTERY_TEXT.bands.developing} is 50–79%,{" "}
              {MASTERY_TEXT.bands.practise} is below 50%.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
