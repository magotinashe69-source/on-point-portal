import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, CheckCircle, XCircle, Download, Printer, Loader2, BookOpen } from "lucide-react";
import logoPath from "@assets/image_1769457206059.png";

interface GradebookRow {
  studentId: number;
  studentName: string;
  form: string;
  assignmentId: number;
  assignmentTitle: string;
  subject: string;
  totalMarks: number;
  submittedAt: string | null;
  score: number | null;
  status: string;
}

export default function GradeBook() {
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();

  const [filterAssignmentId, setFilterAssignmentId] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (filterAssignmentId && filterAssignmentId !== "ALL") params.set("assignmentId", filterAssignmentId);
    if (filterStatus && filterStatus !== "ALL") params.set("status", filterStatus);
    if (filterDateFrom) params.set("dateFrom", filterDateFrom);
    if (filterDateTo) params.set("dateTo", filterDateTo);
    return params.toString();
  };

  const { data, isLoading } = useQuery<{ success: boolean; rows: GradebookRow[] }>({
    queryKey: ["/api/gradebook", filterAssignmentId, filterStatus, filterDateFrom, filterDateTo],
    queryFn: async () => {
      const qs = buildQuery();
      const res = await fetch(`/api/gradebook${qs ? "?" + qs : ""}`);
      return res.json();
    },
    enabled: !!teacher,
  });

  const rows = data?.rows || [];

  // Unique assignments for filter dropdown (from unfiltered data — always load all for dropdown)
  const { data: allData } = useQuery<{ success: boolean; rows: GradebookRow[] }>({
    queryKey: ["/api/gradebook"],
    queryFn: async () => {
      const res = await fetch("/api/gradebook");
      return res.json();
    },
    enabled: !!teacher,
  });

  const uniqueAssignments = Array.from(
    new Map((allData?.rows || []).map(r => [r.assignmentId, { id: r.assignmentId, title: r.assignmentTitle }])).values()
  );

  const submittedCount = rows.filter(r => r.status !== "NOT_SUBMITTED").length;
  const notSubmittedCount = rows.filter(r => r.status === "NOT_SUBMITTED").length;

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
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === "NOT_SUBMITTED") {
      return (
        <Badge variant="destructive" className="gap-1" data-testid="badge-not-submitted">
          <XCircle className="h-3 w-3" />
          Not Submitted
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 bg-green-600 hover:bg-green-700" data-testid="badge-submitted">
        <CheckCircle className="h-3 w-3" />
        Submitted
      </Badge>
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

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BookOpen className="h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">No records found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-gradebook">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium">Student Name</th>
                      <th className="text-left px-4 py-3 font-medium">Form</th>
                      <th className="text-left px-4 py-3 font-medium">Assignment</th>
                      <th className="text-left px-4 py-3 font-medium">Subject</th>
                      <th className="text-left px-4 py-3 font-medium">Score</th>
                      <th className="text-left px-4 py-3 font-medium">Submitted At</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={`${row.studentId}-${row.assignmentId}`}
                        className={`border-b last:border-0 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/20"} hover:bg-muted/40`}
                        data-testid={`row-gradebook-${row.studentId}-${row.assignmentId}`}
                      >
                        <td className="px-4 py-3 font-medium">{row.studentName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.form}</td>
                        <td className="px-4 py-3">{row.assignmentTitle}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.subject}</td>
                        <td className="px-4 py-3">
                          {row.status === "NOT_SUBMITTED" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : row.score !== null ? (
                            <span className="font-medium">
                              {row.score}/{row.totalMarks}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Awaiting mark</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(row.submittedAt)}</td>
                        <td className="px-4 py-3">{getStatusBadge(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground mt-4 text-right no-print">
          Showing {rows.length} record{rows.length !== 1 ? "s" : ""}
        </p>
      </main>
    </>
  );
}
