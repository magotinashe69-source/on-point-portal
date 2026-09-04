import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { PageErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, CheckCircle, XCircle, Download, Printer, Loader2, BookOpen, AlertTriangle } from "lucide-react";
import logoPath from "@assets/logo.webp";

interface GradebookRow {
  studentId: number;
  studentName: string;
  form: string;
  assignmentId: number;
  assignmentTitle: string;
  subject: string;
  totalMarks: number;
  submissionId: number | null;
  submittedAt: string | null;
  score: number | null;
  status: string;
}

function GradeBookContent() {
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();

  const [filterAssignmentId, setFilterAssignmentId] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  // Only send filters that are actually set. Passing them as an object lets the
  // shared fetcher build the query string — and, importantly, handle an expired
  // login the same way every other page does.
  const filters: Record<string, string> = {};
  if (filterAssignmentId && filterAssignmentId !== "ALL") filters.assignmentId = filterAssignmentId;
  if (filterStatus && filterStatus !== "ALL") filters.status = filterStatus;
  if (filterDateFrom) filters.dateFrom = filterDateFrom;
  if (filterDateTo) filters.dateTo = filterDateTo;

  const { data, isLoading, isError } = useQuery<{ success: boolean; rows: GradebookRow[] }>({
    queryKey: ["/api/gradebook", filters],
    enabled: !!teacher,
  });

  // Only ever work with a real list of real rows. If the server sends back an
  // error shape, or a row is missing, we show an empty table instead of letting
  // the page fall over while it tries to read a name off nothing.
  const toRows = (value: unknown): GradebookRow[] =>
    Array.isArray(value) ? (value.filter(r => r && typeof r === "object") as GradebookRow[]) : [];

  const rows = toRows(data?.rows);

  // Unique assignments for the filter dropdown. This uses the same "no filters"
  // key as the table above, so when nothing is filtered both share one request
  // instead of fetching the whole Grade Book twice.
  const { data: allData } = useQuery<{ success: boolean; rows: GradebookRow[] }>({
    queryKey: ["/api/gradebook", {}],
    enabled: !!teacher,
  });

  // An assignment only belongs in the dropdown if it has a usable id — the
  // dropdown refuses a blank value and would take the page down with it.
  const uniqueAssignments = Array.from(
    new Map(
      toRows(allData?.rows)
        .filter(r => r.assignmentId !== null && r.assignmentId !== undefined && String(r.assignmentId) !== "")
        .map(r => [r.assignmentId, { id: r.assignmentId, title: r.assignmentTitle || "Untitled assignment" }])
    ).values()
  );

  // Class-wide per-question breakdown for the selected assignment.
  interface QuestionStat { index: number; questionId: string; questionText: string; type: string; maxScore: number; wrong: number; correct: number; partial: number; total: number; }
  const { data: statsData } = useQuery<{ success: boolean; totalMarked: number; stats: QuestionStat[] }>({
    queryKey: ["/api/teacher/assignments", filterAssignmentId, "question-stats"],
    enabled: !!teacher && filterAssignmentId !== "ALL",
  });

  // Same care as the rows above: a breakdown we cannot read is simply not shown.
  const questionStats: QuestionStat[] = Array.isArray(statsData?.stats)
    ? statsData.stats.filter(s => s && typeof s === "object")
    : [];

  const submittedCount = rows.filter(r => r.status && r.status !== "NOT_SUBMITTED").length;
  const notSubmittedCount = rows.filter(r => !r.status || r.status === "NOT_SUBMITTED").length;

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filterAssignmentId && filterAssignmentId !== "ALL") params.set("assignmentId", filterAssignmentId);
    if (filterStatus && filterStatus !== "ALL") params.set("status", filterStatus);
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    const qs = params.toString();
    window.location.href = `/api/export/grades${qs ? "?" + qs : ""}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const date = new Date(iso);
    // A date we cannot make sense of shows as a dash rather than "Invalid Date".
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handed in / not, as a dot and a word rather than a filled badge. Twenty
  // saturated badges stacked down a column shout; a dot carries the same
  // information quietly, which is what the staff skin asks for. The colour is
  // never the only cue - the word is always there for anyone who cannot
  // separate the two colours.
  const handedIn = (status: string) => {
    const not = status === "NOT_SUBMITTED";
    return (
      <span
        className="inline-flex items-center gap-2 whitespace-nowrap"
        data-testid={not ? "badge-not-submitted" : "badge-submitted"}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${not ? "bg-destructive" : "bg-green-600"}`}
        />
        {not ? "Not handed in" : "Handed in"}
      </span>
    );
  };

  if (!teacher) return null;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full { width: 100% !important; max-width: none !important; }
          header { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur no-print">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl print-full">
        <div className="flex items-center justify-between mb-6 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Grade Book</h1>
              <p className="text-sm text-muted-foreground">Track submissions and scores across all assignments</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handlePrint} data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />
              Print / PDF
            </Button>
          </div>
        </div>

        <div className="print-title hidden print:block mb-4">
          <h1 className="text-2xl font-bold">On Point Education Centre — Grade Book</h1>
          <p className="text-sm text-muted-foreground">Generated {new Date().toLocaleDateString("en-GB")}</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card data-testid="card-submitted-count">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{submittedCount}</p>
                <p className="text-sm text-muted-foreground">Submitted</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-not-submitted-count">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-3xl font-bold text-destructive">{notSubmittedCount}</p>
                <p className="text-sm text-muted-foreground">Not Submitted</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 no-print">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="filter-assignment">Assignment</Label>
                <Select value={filterAssignmentId} onValueChange={setFilterAssignmentId}>
                  <SelectTrigger id="filter-assignment" data-testid="select-filter-assignment">
                    <SelectValue placeholder="All assignments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Assignments</SelectItem>
                    {uniqueAssignments.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-status">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="filter-status" data-testid="select-filter-status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted (not yet marked)</SelectItem>
                    <SelectItem value="MARKED">Marked</SelectItem>
                    <SelectItem value="NOT_SUBMITTED">Not Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-from">Submitted From</Label>
                <Input
                  id="filter-from"
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  data-testid="input-filter-date-from"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-to">Submitted To</Label>
                <Input
                  id="filter-to"
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  data-testid="input-filter-date-to"
                />
              </div>
            </div>

            {(filterAssignmentId !== "ALL" || filterStatus !== "ALL" || filterDateFrom || filterDateTo) && (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterAssignmentId("ALL");
                    setFilterStatus("ALL");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class-wide per-question breakdown (when one assignment is selected). */}
        {filterAssignmentId !== "ALL" && statsData?.success && questionStats.length > 0 && (
          <Card className="mb-4" data-testid="class-breakdown">
            <CardHeader>
              <CardTitle className="text-base">Per-question breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Across {statsData.totalMarked} marked submission{statsData.totalMarked === 1 ? "" : "s"} — spot which questions the class struggled with.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {questionStats.map((s) => {
                const pctWrong = s.total > 0 ? Math.round((s.wrong / s.total) * 100) : 0;
                const hard = pctWrong >= 50;
                return (
                  <div key={s.questionId ?? s.index} className="flex items-center gap-3" data-testid={`stat-q-${s.index}`}>
                    <span className="w-8 shrink-0 text-sm font-medium">Q{s.index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate text-muted-foreground">{s.questionText}</span>
                        <span className={`text-sm font-semibold shrink-0 tabular-nums ${hard ? "text-destructive" : ""}`}>
                          {s.wrong} of {s.total} got this wrong
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${hard ? "bg-destructive" : "bg-primary/60"}`} style={{ width: `${pctWrong}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {statsData.totalMarked === 0 && (
                <p className="text-sm text-muted-foreground">No marked submissions yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Table.
            One frame around all four states - loading, failed, empty and the
            table itself - so the panel keeps its shape whatever is inside it.
            A plain div rather than <Card>, because Card carries shadow-sm and
            rounded-xl: this screen wants no shadow and a single 4px radius. */}
        <div className="overflow-hidden rounded-sm border border-border">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : isError ? (
              // A load that failed is not the same as a class with no records —
              // say which one it is, so nobody is left staring at an empty table.
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="gradebook-load-error">
                <AlertTriangle className="h-10 w-10 mb-3 text-amber-500" />
                <p className="font-medium">Couldn&apos;t load the Grade Book</p>
                <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
                <Button variant="outline" className="mt-4" onClick={() => window.location.reload()} data-testid="button-gradebook-retry">
                  Try again
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BookOpen className="h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">No records found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              /* Carbon `sm` density: 32px rows, so 20+ records read at once
                 without scrolling (20 rows + header = 672px, against 840px at
                 `md`). ONPOINT_UI_SPEC.md 4 reserves 40px+ for rows holding a
                 button, checkbox or input - the mark below is an inline text
                 link, not a control, so `sm` is the right size here.

                 No shadow and a single 4px radius on the frame only: rows and
                 cells are square, so there is exactly one corner treatment in
                 the whole component. */
              <div className="overflow-x-auto">
                <Table data-testid="table-gradebook">
                  <TableHeader>
                    <TableRow className="h-8 bg-muted/50 hover:bg-muted/50">
                      <TableHead className="h-8 px-3 text-label-01">Learner</TableHead>
                      <TableHead className="h-8 px-3 text-label-01 w-24">Class</TableHead>
                      <TableHead className="h-8 px-3 text-label-01">Assignment</TableHead>
                      <TableHead className="h-8 px-3 text-label-01 w-40">Handed in</TableHead>
                      <TableHead className="h-8 px-3 text-label-01 w-24 text-right">Mark</TableHead>
                      <TableHead className="h-8 px-3 text-label-01 w-40">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => (
                      <TableRow
                        key={`${row.studentId}-${row.assignmentId}-${idx}`}
                        className="h-8"
                        data-testid={`row-gradebook-${row.studentId}-${row.assignmentId}`}
                      >
                        <TableCell className="px-3 py-0 text-body-compact-01 font-medium">
                          {row.studentName || "\u2014"}
                        </TableCell>
                        <TableCell className="px-3 py-0 text-body-compact-01 text-muted-foreground">
                          {row.form || "\u2014"}
                        </TableCell>
                        <TableCell className="px-3 py-0 text-body-compact-01">
                          {row.assignmentTitle || "\u2014"}
                        </TableCell>
                        <TableCell className="px-3 py-0 text-body-compact-01">
                          {handedIn(row.status || "NOT_SUBMITTED")}
                        </TableCell>
                        {/* Right-aligned and tabular so marks line up down the
                            column and can be compared at a glance. No submission,
                            or no mark yet, is normal - a dash or "Awaiting",
                            never a broken cell. */}
                        <TableCell className="px-3 py-0 text-body-compact-01 text-right tabular-nums">
                          {row.status === "NOT_SUBMITTED" || !row.submissionId ? (
                            <span className="text-muted-foreground">{"\u2014"}</span>
                          ) : row.score !== null && row.score !== undefined ? (
                            <Link href={`/teacher/submissions/${row.submissionId}`}>
                              <span
                                className="font-medium text-primary underline underline-offset-2 cursor-pointer hover:opacity-80"
                                data-testid={`link-review-${row.submissionId}`}
                                title="Open this submission"
                              >
                                {row.score}/{row.totalMarks ?? 0}
                              </span>
                            </Link>
                          ) : (
                            <Link href={`/teacher/submissions/${row.submissionId}`}>
                              <span
                                className="text-primary underline underline-offset-2 cursor-pointer"
                                data-testid={`link-review-${row.submissionId}`}
                                title="Open this submission"
                              >
                                Awaiting
                              </span>
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-0 text-caption-01 text-muted-foreground whitespace-nowrap">
                          {formatDate(row.submittedAt ?? null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-right no-print">
          Showing {rows.length} record{rows.length !== 1 ? "s" : ""}
        </p>
      </main>
    </>
  );
}

// The safety net. If anything inside the Grade Book throws — one odd row, one
// unexpected answer from the server — the teacher sees a message with a way
// back instead of a blank white screen.
export default function GradeBook() {
  return (
    <PageErrorBoundary backHref="/teacher/dashboard" backLabel="Back to Dashboard" label="gradebook">
      <GradeBookContent />
    </PageErrorBoundary>
  );
}
