// Most Improved — the one certificate a teacher runs by hand.
//
// Pick a class, a subject and two periods; see who climbed furthest; award it.
//
// Looking is separate from awarding on purpose. A teacher can compare periods
// as often as they like without anything being issued, and the certificate is
// only written down when they choose a child and press the button.

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/api-error";
import { subjectLabel, SUBJECT_LABELS } from "@shared/weekly-report";
import { type ImprovementRow } from "@shared/certificates";
import { ArrowLeft, Award, Loader2, TrendingUp } from "lucide-react";
import logoPath from "@assets/logo.webp";
import { serverMessage, subjectName, useT } from "@/lib/i18n";

const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];
const SUBJECTS = Object.keys(SUBJECT_LABELS);

/** A sensible default: the month before last, against last month. */
function defaultPeriods() {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  const startOfThis = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLast = new Date(today.getFullYear(), today.getMonth(), 0);
  const startOfBefore = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const endOfBefore = new Date(today.getFullYear(), today.getMonth() - 1, 0);
  return {
    beforeFrom: fmt(startOfBefore), beforeTo: fmt(endOfBefore),
    afterFrom: fmt(startOfLast), afterTo: fmt(today) >= fmt(startOfThis) ? fmt(today) : fmt(endOfLast),
  };
}

export default function MostImprovedPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState("");
  const [subject, setSubject] = useState("");
  const [periods, setPeriods] = useState(defaultPeriods);
  const [rows, setRows] = useState<ImprovementRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [awarding, setAwarding] = useState<number | null>(null);
  const [awarded, setAwarded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const compare = async () => {
    if (!form || !subject) {
      toast({ title: "Choose a class and a subject first", variant: "destructive" });
      return;
    }
    setLoading(true);
    setRows(null);
    setAwarded(new Set());
    try {
      const params = new URLSearchParams({ form, subject, ...periods });
      const res = await fetch(`/api/reports/most-improved?${params}`);
      const body = await res.json();
      if (body.success) setRows(body.rows);
      else toast({ title: serverMessage(t, body, "Could not compare those periods"), variant: "destructive" });
    } catch {
      toast({ title: "Could not compare. Check your connection.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const award = async (row: ImprovementRow) => {
    if (row.beforePercent === null || row.afterPercent === null) return;
    setAwarding(row.studentId);
    try {
      const res = await apiRequest("POST", "/api/reports/most-improved/award", {
        studentId: row.studentId,
        subject,
        beforePercent: row.beforePercent,
        afterPercent: row.afterPercent,
        from: periods.beforeFrom,
        to: periods.afterTo,
      });
      const body = await res.json();
      if (body.success) {
        setAwarded((prev) => new Set(prev).add(row.studentId));
        toast({
          title: body.alreadyAwarded ? serverMessage(t, body) : t.mostImproved.awarded,
          description: body.alreadyAwarded ? undefined : `${row.fullName} — it is on their certificates page now.`,
        });
      } else {
        toast({ title: serverMessage(t, body, "Could not award it"), variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: apiErrorMessage(error, "Could not award it. Check your connection."),
        variant: "destructive",
      });
    } finally {
      setAwarding(null);
    }
  };

  if (!teacher) return null;

  const rankable = (rows || []).filter((r) => r.changePercent !== null);
  const unrankable = (rows || []).filter((r) => r.changePercent === null);

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
            <Award className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t.mostImproved.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t.mostImproved.subtitle}</p>
        </div>

        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={form} onValueChange={setForm}>
                <SelectTrigger data-testid="select-improved-form">
                  <SelectValue placeholder={t.mostImproved.pickClass} />
                </SelectTrigger>
                <SelectContent>
                  {FORMS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger data-testid="select-improved-subject">
                  <SelectValue placeholder={t.mostImproved.pickSubject} />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{subjectName(t, s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.mostImproved.before}</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="date" value={periods.beforeFrom}
                    onChange={(e) => setPeriods({ ...periods, beforeFrom: e.target.value })}
                    data-testid="input-before-from" />
                  <Input type="date" value={periods.beforeTo}
                    onChange={(e) => setPeriods({ ...periods, beforeTo: e.target.value })}
                    data-testid="input-before-to" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t.mostImproved.after}</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="date" value={periods.afterFrom}
                    onChange={(e) => setPeriods({ ...periods, afterFrom: e.target.value })}
                    data-testid="input-after-from" />
                  <Input type="date" value={periods.afterTo}
                    onChange={(e) => setPeriods({ ...periods, afterTo: e.target.value })}
                    data-testid="input-after-to" />
                </div>
              </div>
            </div>

            <Button onClick={compare} disabled={loading} data-testid="button-compare">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
              {t.mostImproved.run}
            </Button>
          </CardContent>
        </Card>

        {rows && rankable.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-no-candidates">
              {t.mostImproved.noCandidates}
            </CardContent>
          </Card>
        )}

        {rankable.map((r, i) => (
          <Card key={r.studentId} className={i === 0 ? "border-primary" : ""} data-testid={`row-improved-${r.studentId}`}>
            <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium">
                  {i === 0 && <span className="text-primary mr-1.5">★</span>}
                  {r.fullName}
                </p>
                {/* The school's id, because two children can share a name. */}
                <p className="text-xs text-muted-foreground">ID: {r.pupilId}</p>
                <p className="text-sm mt-1" data-testid={`text-movement-${r.studentId}`}>
                  {t.mostImproved.movement(r.beforePercent!, r.afterPercent!)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.beforeMarked} marked before · {r.afterMarked} after
                </p>
              </div>
              <Button
                size="sm"
                variant={i === 0 ? "default" : "outline"}
                disabled={awarding === r.studentId || awarded.has(r.studentId)}
                onClick={() => award(r)}
                data-testid={`button-award-${r.studentId}`}
              >
                {awarding === r.studentId
                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  : <Award className="h-4 w-4 mr-1" />}
                {awarded.has(r.studentId) ? "Awarded" : t.mostImproved.award}
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* Shown so a teacher can see WHY somebody is missing from the ranking,
            rather than wondering whether the page forgot them. */}
        {unrankable.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm font-medium mb-2">Not ranked</p>
              <div className="flex flex-wrap gap-1.5">
                {unrankable.map((r) => (
                  <Badge key={r.studentId} variant="outline" className="text-xs">
                    {r.fullName}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t.mostImproved.cannotRank}.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
