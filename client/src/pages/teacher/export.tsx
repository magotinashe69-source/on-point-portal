import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, LogOut, Download, Loader2, FileText,
  Users, BookOpen, CheckCircle, Clock, XCircle, History,
  Database, Filter, Calendar, AlertTriangle,
} from "lucide-react";
import logoPath from "@assets/logo.webp";
import type { Assignment } from "@shared/schema";

interface PreviewData {
  totalStudents: number;
  totalAssignments: number;
  totalRows: number;
  submitted: number;
  late: number;
  notSubmitted: number;
  dateRange: { from: string; to: string } | null;
}

interface ExportLog {
  id: number;
  exportedAt: string;
  teacherEmail: string;
  filterType: string;
  filterValue: string;
  recordCount: number;
}

type ExportType = "full" | "term" | "class" | "assignment";

const SUBJECTS = [
  "MATHS", "ENGLISH", "SCIENCE", "PHYSICS", "CHEMISTRY", "BIOLOGY",
  "ECONOMICS", "BUSINESS_STUDIES", "GEOGRAPHY", "COMPUTER_SCIENCE", "HISTORY", "ACCOUNTING",
];
const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];
const TERMS = ["1", "2", "3", "4"];

export default function TeacherExport() {
  const [, setLocation] = useLocation();
  const { teacher, student, logout } = useAuth();
  const { toast } = useToast();

  const [exportType, setExportType] = useState<ExportType>("full");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedForm, setSelectedForm] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastDownload, setLastDownload] = useState<{ filename: string; count: number } | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (student) { setLocation("/student/login"); return; }
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, student, setLocation]);

  // Handle session expiry: show inline error instead of redirecting/logging out
  const handle401 = useCallback(() => {
    setSessionExpired(true);
  }, []);

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
    enabled: !!teacher,
  });

  const { data: archivedAssignments } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments", { archived: true }],
    queryFn: async () => {
      const res = await fetch("/api/assignments?archived=true");
      return res.json();
    },
    enabled: !!teacher,
  });

  const allAssignments = [...(assignments || []), ...(archivedAssignments || [])];

  const buildQueryParams = useCallback(() => {
    const params: Record<string, string> = { type: exportType };
    if (exportType === "term" && selectedTerm) params.term = selectedTerm;
    if ((exportType === "term" || exportType === "class") && selectedForm) params.form = selectedForm;
    if (exportType === "class" && selectedSubject) params.subject = selectedSubject;
    if (exportType === "assignment" && selectedAssignmentId) params.assignmentId = selectedAssignmentId;
    return new URLSearchParams(params).toString();
  }, [exportType, selectedTerm, selectedForm, selectedSubject, selectedAssignmentId]);

  const previewReady = (() => {
    if (exportType === "full") return true;
    if (exportType === "term" && selectedTerm) return true;
    if (exportType === "class") return true;
    if (exportType === "assignment" && selectedAssignmentId) return true;
    return false;
  })();

  const { data: preview, isLoading: previewLoading } = useQuery<PreviewData>({
    queryKey: ["/api/export/preview", exportType, selectedTerm, selectedForm, selectedSubject, selectedAssignmentId],
    queryFn: async () => {
      const res = await fetch(`/api/export/preview?${buildQueryParams()}`);
      if (res.status === 401) { handle401(); throw new Error("401"); }
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!teacher && previewReady,
  });

  const { data: exportLogs, refetch: refetchLogs } = useQuery<ExportLog[]>({
    queryKey: ["/api/export/logs"],
    queryFn: async () => {
      const res = await fetch("/api/export/logs");
      if (res.status === 401) { handle401(); throw new Error("401"); }
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!teacher,
  });

  const handleLogout = () => { logout(); setLocation("/"); };

  const handleDownload = async () => {
    setIsDownloading(true);
    setLastDownload(null);
    try {
      const url = `/api/export/master?${buildQueryParams()}`;
      const response = await fetch(url);
      if (response.status === 401) { handle401(); return; }
      if (!response.ok) throw new Error("Export failed");

      const contentDisposition = response.headers.get("content-disposition") || "";
      const filenameMatch = contentDisposition.match(/filename=([^;]+)/);
      const filename = filenameMatch ? filenameMatch[1].trim() : "HomeworkData_Export.csv";

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      setLastDownload({ filename, count: preview?.totalRows ?? 0 });
      toast({ title: "Export Complete", description: `Downloaded ${filename}` });
      refetchLogs();
    } catch {
      toast({ title: "Export Failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!teacher) return null;

  const exportTypeCards: { type: ExportType; label: string; description: string; icon: JSX.Element }[] = [
    {
      type: "full",
      label: "Full Master Export",
      description: "All students, all assignments, all subjects — nothing filtered out",
      icon: <Database className="h-5 w-5" />,
    },
    {
      type: "term",
      label: "By Term",
      description: "Filter by school term (Jan–Mar = Term 1, Apr–Jun = 2, Jul–Sep = 3, Oct–Dec = 4)",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      type: "class",
      label: "By Class & Subject",
      description: "Filter by a specific class level and/or subject",
      icon: <Filter className="h-5 w-5" />,
    },
    {
      type: "assignment",
      label: "By Assignment",
      description: "Every student's result for one specific assignment — ideal for parent reporting",
      icon: <FileText className="h-5 w-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-10 w-auto" />
            <span className="font-semibold text-primary hidden sm:block">Teacher Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:block">
              Welcome, {teacher.fullName}
            </span>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {sessionExpired && (
          <Alert className="mb-6 border-destructive/50 bg-destructive/10" data-testid="alert-session-expired">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              <strong>Your session has expired.</strong>{" "}
              <Link href="/teacher/login" className="underline font-medium">
                Please log in again
              </Link>{" "}
              to continue exporting data.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/teacher/dashboard">
            <Button variant="ghost" size="sm" data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Export Data</h1>
          <p className="text-muted-foreground">
            Download a complete CSV of homework data — every student cross-joined with every assignment.
            Non-submissions are included as rows so nothing is missed.
          </p>
        </div>

        {/* Step 1 — Choose export type */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Choose what to export</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {exportTypeCards.map(({ type, label, description, icon }) => (
                <button
                  key={type}
                  onClick={() => { setExportType(type); setLastDownload(null); }}
                  data-testid={`button-export-type-${type}`}
                  className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                    exportType === type
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className={`mt-0.5 ${exportType === type ? "text-primary" : "text-muted-foreground"}`}>
                    {icon}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 2 — Filters (conditional) */}
        {exportType !== "full" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Step 2 — Set filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {exportType === "term" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Term</label>
                    <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                      <SelectTrigger data-testid="select-term">
                        <SelectValue placeholder="Select term..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMS.map(t => (
                          <SelectItem key={t} value={t}>Term {t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Class (optional)</label>
                    <Select value={selectedForm || "__all__"} onValueChange={v => setSelectedForm(v === "__all__" ? "" : v)}>
                      <SelectTrigger data-testid="select-form-term">
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All classes</SelectItem>
                        {FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {exportType === "class" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Class level</label>
                    <Select value={selectedForm || "__all__"} onValueChange={v => setSelectedForm(v === "__all__" ? "" : v)}>
                      <SelectTrigger data-testid="select-form-class">
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All classes</SelectItem>
                        {FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Subject</label>
                    <Select value={selectedSubject || "__all__"} onValueChange={v => setSelectedSubject(v === "__all__" ? "" : v)}>
                      <SelectTrigger data-testid="select-subject">
                        <SelectValue placeholder="All subjects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All subjects</SelectItem>
                        {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {exportType === "assignment" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Assignment</label>
                  <Select value={selectedAssignmentId || "__none__"} onValueChange={v => setSelectedAssignmentId(v === "__none__" ? "" : v)}>
                    <SelectTrigger data-testid="select-assignment">
                      <SelectValue placeholder="Select an assignment..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select an assignment...</SelectItem>
                      {allAssignments.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.title} — {a.form} · {a.subject}{a.archived ? " (archived)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              {exportType !== "full" ? "Step 3 — " : ""}Preview
            </CardTitle>
            <CardDescription>Live count of what will be included in the export</CardDescription>
          </CardHeader>
          <CardContent>
            {previewLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Calculating...</span>
              </div>
            ) : preview ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Users className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-2xl font-bold">{preview.totalStudents}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <BookOpen className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-2xl font-bold">{preview.totalAssignments}</p>
                      <p className="text-xs text-muted-foreground">Assignments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-2xl font-bold text-primary">{preview.totalRows}</p>
                      <p className="text-xs text-muted-foreground">Total CSV rows</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-muted-foreground">On time:</span>
                    <span className="font-medium">{preview.submitted}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                    <span className="text-muted-foreground">Late:</span>
                    <span className="font-medium">{preview.late}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-muted-foreground">Not submitted:</span>
                    <span className="font-medium">{preview.notSubmitted}</span>
                  </div>
                </div>

                {preview.dateRange && (
                  <p className="text-xs text-muted-foreground">
                    Date range: {preview.dateRange.from} → {preview.dateRange.to}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                {!previewReady
                  ? "Select filters above to see a preview."
                  : "No data matches the current filters."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Download button + confirmation */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <Button
              className="w-full sm:w-auto"
              size="lg"
              onClick={handleDownload}
              disabled={isDownloading || !previewReady || (preview?.totalRows === 0)}
              data-testid="button-download-csv"
            >
              {isDownloading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Generating CSV...</>
              ) : (
                <><Download className="h-5 w-5 mr-2" />Download Master CSV</>
              )}
            </Button>

            {lastDownload && (
              <div className="mt-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-400" data-testid="text-download-confirmation">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>Downloaded {lastDownload.count} records — {lastDownload.filename}</span>
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              The CSV includes 42 columns (school identity, class, student, assignment, submission status, marks/grades, teacher record).
              One row per student × assignment — non-submissions included as blank rows.
            </p>
          </CardContent>
        </Card>

        {/* Export log */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Export History</CardTitle>
            </div>
            <CardDescription>Last 20 exports from this account</CardDescription>
          </CardHeader>
          <CardContent>
            {!exportLogs || exportLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No exports yet. Download your first CSV above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-export-logs">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Date exported</th>
                      <th className="pb-2 font-medium text-muted-foreground">Filter</th>
                      <th className="pb-2 font-medium text-muted-foreground">Filter value</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {exportLogs.map(log => (
                      <tr key={log.id} data-testid={`row-export-log-${log.id}`}>
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                          {new Date(log.exportedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline" className="capitalize">{log.filterType}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{log.filterValue || "All"}</td>
                        <td className="py-2 text-right font-medium">{log.recordCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
