import { useState } from "react";
import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Copy, CheckCheck, ClipboardList, LogOut } from "lucide-react";
import logoPath from "@assets/logo.webp";

interface DailyReportData {
  submitted: Array<{ fullName: string }>;
  notSubmitted: Array<{ fullName: string }>;
  lowAttendance: Array<{ fullName: string; completionRate: number }>;
}

type DatePreset = "today" | "yesterday" | "thisWeek" | "custom";

const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"] as const;
const SUBJECTS = [
  "MATHS", "ENGLISH", "SCIENCE", "PHYSICS", "CHEMISTRY",
  "BIOLOGY", "ECONOMICS", "BUSINESS_STUDIES", "GEOGRAPHY",
  "COMPUTER_SCIENCE", "HISTORY", "ACCOUNTING",
] as const;

const SUBJECT_LABELS: Record<string, string> = {
  MATHS: "Maths",
  ENGLISH: "English",
  SCIENCE: "Science",
  PHYSICS: "Physics",
  CHEMISTRY: "Chemistry",
  BIOLOGY: "Biology",
  ECONOMICS: "Economics",
  BUSINESS_STUDIES: "Business Studies",
  GEOGRAPHY: "Geography",
  COMPUTER_SCIENCE: "Computer Science",
  HISTORY: "History",
  ACCOUNTING: "Accounting",
};

function getDateRange(preset: DatePreset, customDate: string): { dateFrom: string; dateTo: string; label: string } {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === "today") {
    const s = fmt(today);
    return { dateFrom: s, dateTo: s, label: `Today (${s})` };
  }
  if (preset === "yesterday") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const s = fmt(d);
    return { dateFrom: s, dateTo: s, label: `Yesterday (${s})` };
  }
  if (preset === "thisWeek") {
    const dayOfWeek = today.getDay(); // 0=Sun
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    const from = fmt(monday);
    const to = fmt(today);
    return { dateFrom: from, dateTo: to, label: `This Week (${from} to ${to})` };
  }
  // custom
  return { dateFrom: customDate, dateTo: customDate, label: customDate };
}

function buildWhatsAppText(
  data: DailyReportData,
  dateLabel: string,
  form: string,
  subject: string
): string {
  const subjectLabel = subject === "all" ? "All Subjects" : (SUBJECT_LABELS[subject] || subject);
  const lines: string[] = [];

  lines.push("📚 *Homework Submission Report*");
  lines.push(`📅 Date: ${dateLabel}`);
  lines.push(`🏫 Class: ${form}`);
  lines.push(`📖 Subject: ${subjectLabel}`);
  lines.push("");

  if (data.submitted.length > 0) {
    lines.push("✅ *Students who submitted homework:*");
    data.submitted.forEach((s, i) => lines.push(`${i + 1}. ${s.fullName}`));
  } else {
    lines.push("✅ *Students who submitted homework:*");
    lines.push("None submitted for this period.");
  }
  lines.push("");

  if (data.notSubmitted.length > 0) {
    lines.push("❌ *Students who did not submit homework:*");
    data.notSubmitted.forEach((s, i) => lines.push(`${i + 1}. ${s.fullName}`));
  } else {
    lines.push("❌ *Students who did not submit homework:*");
    lines.push("All students submitted. Well done!");
  }
  lines.push("");

  if (data.lowAttendance.length > 0) {
    lines.push("⚠️ *Students who need to improve homework attendance:*");
    data.lowAttendance.forEach((s, i) =>
      lines.push(`${i + 1}. ${s.fullName} — ${s.completionRate}% completion`)
    );
    lines.push("");
  }

  lines.push("💬 *Message for Parents:*");
  lines.push(
    "Dear Parents, thank you to all learners who completed today's homework. Your effort is noticed and appreciated."
  );
  lines.push("");
  lines.push(
    "Learners who did not submit must please complete the work as soon as possible. Homework is part of academic discipline and helps us track progress. We strongly encourage parents to support their children daily so they do not fall behind."
  );
  if (data.lowAttendance.length > 0) {
    lines.push("");
    lines.push(
      "Those with low homework attendance are kindly reminded to improve and catch up. Consistent homework completion will help learners perform better and avoid being left behind."
    );
  }
  lines.push("");
  lines.push("— On Point Education Centre");

  return lines.join("\n");
}

export default function DailyReport() {
  const [, setLocation] = useLocation();
  const { teacher, logout } = useAuth();
  const { toast } = useToast();

  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [form, setForm] = useState<string>("");
  const [subject, setSubject] = useState<string>("all");
  const [queryParams, setQueryParams] = useState<{
    dateFrom: string;
    dateTo: string;
    dateLabel: string;
    form: string;
    subject: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const { data: response, isLoading, isError } = useQuery<{
    success: boolean;
    data: DailyReportData;
  }>({
    queryKey: ["/api/reports/daily", queryParams],
    queryFn: async () => {
      if (!queryParams) throw new Error("No params");
      // Use `date` for single-day presets, `dateFrom`+`dateTo` for ranges (This Week)
      const isSingleDay = queryParams.dateFrom === queryParams.dateTo;
      const params = new URLSearchParams({
        form: queryParams.form,
        ...(isSingleDay
          ? { date: queryParams.dateFrom }
          : { dateFrom: queryParams.dateFrom, dateTo: queryParams.dateTo }),
        ...(queryParams.subject !== "all" && { subject: queryParams.subject }),
      });
      const res = await fetch(`/api/reports/daily?${params}`);
      return res.json();
    },
    enabled: !!queryParams,
    staleTime: 0,
  });

  const reportData = response?.data;

  const handleGenerate = () => {
    if (!form) {
      toast({ title: "Please select a class", variant: "destructive" });
      return;
    }
    const { dateFrom, dateTo, label } = getDateRange(datePreset, customDate);
    setQueryParams({ dateFrom, dateTo, dateLabel: label, form, subject });
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!reportData || !queryParams) return;
    const text = buildWhatsAppText(reportData, queryParams.dateLabel, queryParams.form, queryParams.subject);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied!", description: "Report copied to clipboard. Paste it into WhatsApp." });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: "Copy failed", description: "Please select and copy the text manually.", variant: "destructive" });
    }
  };

  if (!teacher) return null;

  const subjectLabel = queryParams?.subject === "all" ? "All Subjects" : (SUBJECT_LABELS[queryParams?.subject || ""] || queryParams?.subject);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-10 w-auto" />
            <span className="font-semibold text-primary hidden sm:block">Teacher Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:block">Welcome, {teacher.fullName}</span>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => { logout(); setLocation("/"); }} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/teacher/dashboard">
            <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-1">
            <ClipboardList className="h-8 w-8 text-primary" />
            Daily Homework Report
          </h1>
          <p className="text-muted-foreground">Generate a WhatsApp-ready submission snapshot for any class and date.</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Report Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date preset */}
            <div>
              <label className="text-sm font-medium block mb-2">Date</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(["today", "yesterday", "thisWeek", "custom"] as DatePreset[]).map(p => (
                  <Button
                    key={p}
                    variant={datePreset === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDatePreset(p)}
                    data-testid={`button-preset-${p}`}
                  >
                    {p === "today" ? "Today" : p === "yesterday" ? "Yesterday" : p === "thisWeek" ? "This Week" : "Custom Date"}
                  </Button>
                ))}
              </div>
              {datePreset === "custom" && (
                <Input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="max-w-xs"
                  data-testid="input-custom-date"
                />
              )}
            </div>

            {/* Class */}
            <div>
              <label className="text-sm font-medium block mb-2">Class</label>
              <Select value={form} onValueChange={setForm}>
                <SelectTrigger className="max-w-xs" data-testid="select-form">
                  <SelectValue placeholder="Select a class…" />
                </SelectTrigger>
                <SelectContent>
                  {FORMS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium block mb-2">Subject</label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="max-w-xs" data-testid="select-subject">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {SUBJECTS.map(s => (
                    <SelectItem key={s} value={s}>{SUBJECT_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              className="w-full sm:w-auto"
              data-testid="button-generate-report"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardList className="h-4 w-4 mr-2" />}
              Generate Report
            </Button>
          </CardContent>
        </Card>

        {/* Report output */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <Card className="border-destructive/50">
            <CardContent className="py-6 text-center text-destructive">
              Failed to load report. Please try again.
            </CardContent>
          </Card>
        )}

        {reportData && queryParams && !isLoading && (
          <Card className="border-primary/30" data-testid="card-report-output">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    📚 Homework Submission Report
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    📅 {queryParams.dateLabel} &nbsp;·&nbsp; 🏫 {queryParams.form} &nbsp;·&nbsp; 📖 {subjectLabel}
                  </p>
                </div>
                <Button
                  onClick={handleCopy}
                  variant={copied ? "default" : "outline"}
                  size="sm"
                  className={copied ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  data-testid="button-copy-whatsapp"
                >
                  {copied ? (
                    <><CheckCheck className="h-4 w-4 mr-2" />Copied!</>
                  ) : (
                    <><Copy className="h-4 w-4 mr-2" />Copy WhatsApp Message</>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-6">
              {/* Submitted */}
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2 mb-3">
                  <span className="text-xl">✅</span>
                  Students who submitted homework
                  <Badge className="bg-green-600 text-white ml-1" data-testid="badge-submitted-count">
                    {reportData.submitted.length}
                  </Badge>
                </h3>
                {reportData.submitted.length === 0 ? (
                  <p className="text-muted-foreground text-sm pl-8">None submitted for this period.</p>
                ) : (
                  <ol className="space-y-1 pl-8" data-testid="list-submitted">
                    {reportData.submitted.map((s, i) => (
                      <li key={s.fullName} className="text-sm">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        <span className="font-medium">{s.fullName}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Not submitted */}
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2 mb-3">
                  <span className="text-xl">❌</span>
                  Students who did not submit homework
                  <Badge variant="destructive" className="ml-1" data-testid="badge-not-submitted-count">
                    {reportData.notSubmitted.length}
                  </Badge>
                </h3>
                {reportData.notSubmitted.length === 0 ? (
                  <p className="text-sm pl-8 text-green-700 dark:text-green-400 font-medium">
                    All students submitted. Well done! 🎉
                  </p>
                ) : (
                  <ol className="space-y-1 pl-8" data-testid="list-not-submitted">
                    {reportData.notSubmitted.map((s, i) => (
                      <li key={s.fullName} className="text-sm">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        <span className="font-medium">{s.fullName}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Low attendance */}
              {reportData.lowAttendance.length > 0 && (
                <div>
                  <h3 className="font-semibold text-base flex items-center gap-2 mb-3">
                    <span className="text-xl">⚠️</span>
                    Students who need to improve homework attendance
                    <Badge className="bg-orange-500 text-white ml-1" data-testid="badge-low-attendance-count">
                      {reportData.lowAttendance.length}
                    </Badge>
                  </h3>
                  <ol className="space-y-1 pl-8" data-testid="list-low-attendance">
                    {reportData.lowAttendance.map((s, i) => (
                      <li key={s.fullName} className="text-sm flex items-center gap-2">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        <span className="font-medium">{s.fullName}</span>
                        <Badge variant="outline" className="text-orange-600 border-orange-400 text-xs">
                          {s.completionRate}% completion
                        </Badge>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Parent message */}
              <div className="rounded-lg bg-muted/50 border p-4 text-sm space-y-2" data-testid="div-parent-message">
                <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-2">Message for Parents</p>
                <p>Dear Parents, thank you to all learners who completed today's homework. Your effort is noticed and appreciated.</p>
                <p>Learners who did not submit must please complete the work as soon as possible. Homework is part of academic discipline and helps us track progress. We strongly encourage parents to support their children daily so they do not fall behind.</p>
                {reportData.lowAttendance.length > 0 && (
                  <p>Those with low homework attendance are kindly reminded to improve and catch up. Consistent homework completion will help learners perform better and avoid being left behind.</p>
                )}
              </div>

              {/* Bottom copy button */}
              <Button
                onClick={handleCopy}
                className={`w-full ${copied ? "bg-green-600 hover:bg-green-700" : ""}`}
                data-testid="button-copy-whatsapp-bottom"
              >
                {copied ? (
                  <><CheckCheck className="h-4 w-4 mr-2" />Copied to Clipboard!</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" />Copy WhatsApp Message</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
