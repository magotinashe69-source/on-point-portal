import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, BarChart3, TrendingUp, Users, BookOpen, ClipboardList } from "lucide-react";
import { useState } from "react";
import logoPath from "@assets/image_1769457206059.png";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer
} from "recharts";

interface ReportData {
  studentPerformance: Array<{
    studentId: number;
    studentName: string;
    form: string;
    totalAssignments: number;
    submittedCount: number;
    markedCount: number;
    totalScore: number;
    maxPossibleScore: number;
    averagePercentage: number;
  }>;
  subjectPerformance: Array<{
    subject: string;
    averageScore: number;
    totalSubmissions: number;
    totalMarked: number;
  }>;
  formPerformance: Array<{
    form: string;
    averageScore: number;
    studentCount: number;
  }>;
}

const CHART_COLORS = [
  "hsl(224, 65%, 35%)",
  "hsl(0, 75%, 50%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
];

const chartConfig: ChartConfig = {
  averagePercentage: {
    label: "Average %",
    color: "hsl(224, 65%, 35%)",
  },
  averageScore: {
    label: "Average Score",
    color: "hsl(0, 75%, 50%)",
  },
};

export default function TeacherReports() {
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const [formFilter, setFormFilter] = useState<string>("all");

  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  const { data: reportResponse, isLoading } = useQuery<{ success: boolean; data: ReportData }>({
    queryKey: ["/api/reports"],
    enabled: !!teacher,
  });

  const reportData = reportResponse?.data;

  if (!teacher) return null;

  const filteredStudents = reportData?.studentPerformance?.filter(
    s => formFilter === "all" || s.form === formFilter
  ) || [];

  const getPerformanceColor = (pct: number) => {
    if (pct >= 80) return "text-green-600 dark:text-green-400";
    if (pct >= 60) return "text-primary";
    if (pct >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-destructive";
  };

  const getPerformanceBadge = (pct: number) => {
    if (pct >= 80) return <Badge className="bg-green-600">Excellent</Badge>;
    if (pct >= 60) return <Badge>Good</Badge>;
    if (pct >= 40) return <Badge variant="secondary">Average</Badge>;
    return <Badge variant="destructive">Needs Help</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Performance Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Track student progress and analyze performance trends
            </p>
          </div>
          <Link href="/teacher/daily-report">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-secondary text-secondary hover:bg-secondary/10 text-sm font-medium transition-colors"
              data-testid="link-daily-report-from-reports"
            >
              <ClipboardList className="h-4 w-4" />
              Daily WhatsApp Report
            </button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reportData ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Select value={formFilter} onValueChange={setFormFilter}>
                <SelectTrigger className="w-40" data-testid="select-form-filter">
                  <SelectValue placeholder="Filter by Form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Forms</SelectItem>
                  <SelectItem value="Stage 3">Stage 3</SelectItem>
                  <SelectItem value="Stage 4">Stage 4</SelectItem>
                  <SelectItem value="Stage 5">Stage 5</SelectItem>
                  <SelectItem value="Stage 6">Stage 6</SelectItem>
                  <SelectItem value="Form 1">Form 1</SelectItem>
                  <SelectItem value="Form 2">Form 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredStudents.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {formFilter === "all" ? "All forms" : formFilter}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getPerformanceColor(
                    filteredStudents.length > 0 
                      ? Math.round(filteredStudents.reduce((sum, s) => sum + s.averagePercentage, 0) / filteredStudents.length)
                      : 0
                  )}`}>
                    {filteredStudents.length > 0 
                      ? Math.round(filteredStudents.reduce((sum, s) => sum + s.averagePercentage, 0) / filteredStudents.length)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Class average</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Subjects</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.subjectPerformance?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Active subjects</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Student Performance</CardTitle>
                  <CardDescription>Average percentage by student</CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredStudents.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <BarChart data={filteredStudents.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis dataKey="studentName" type="category" width={80} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="averagePercentage" fill="hsl(224, 65%, 35%)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No student data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subject Performance</CardTitle>
                  <CardDescription>Average score by subject</CardDescription>
                </CardHeader>
                <CardContent>
                  {reportData.subjectPerformance && reportData.subjectPerformance.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <BarChart data={reportData.subjectPerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="subject" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis domain={[0, 100]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="averageScore" fill="hsl(0, 75%, 50%)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No subject data available</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Form Comparison</CardTitle>
                <CardDescription>Performance comparison between forms</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.formPerformance && reportData.formPerformance.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {reportData.formPerformance.map((form, index) => (
                      <Card key={form.form} className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{form.form}</CardTitle>
                          <CardDescription>{form.studentCount} students</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-3xl font-bold ${getPerformanceColor(form.averageScore)}`}>
                            {form.averageScore}%
                          </div>
                          <p className="text-sm text-muted-foreground">Average score</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No form data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Student Details</CardTitle>
                <CardDescription>Individual student performance breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-student-details">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Student</th>
                        <th className="text-left py-2 px-2">Form</th>
                        <th className="text-center py-2 px-2">Submitted</th>
                        <th className="text-center py-2 px-2">Marked</th>
                        <th className="text-center py-2 px-2">Score</th>
                        <th className="text-center py-2 px-2">Average</th>
                        <th className="text-center py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(student => (
                        <tr key={student.studentId} className="border-b hover-elevate">
                          <td className="py-2 px-2 font-medium">{student.studentName}</td>
                          <td className="py-2 px-2">
                            <Badge variant="outline">{student.form}</Badge>
                          </td>
                          <td className="text-center py-2 px-2">
                            {student.submittedCount}/{student.totalAssignments}
                          </td>
                          <td className="text-center py-2 px-2">{student.markedCount}</td>
                          <td className="text-center py-2 px-2">
                            {student.totalScore}/{student.maxPossibleScore}
                          </td>
                          <td className={`text-center py-2 px-2 font-bold ${getPerformanceColor(student.averagePercentage)}`}>
                            {student.averagePercentage}%
                          </td>
                          <td className="text-center py-2 px-2">
                            {getPerformanceBadge(student.averagePercentage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No report data available yet.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
