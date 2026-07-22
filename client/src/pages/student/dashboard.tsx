import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  LogOut, 
  FileText, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  BookOpen,
  Loader2,
  Calendar,
  Library,
  AlertTriangle,
  TrendingUp,
  Bell,
  Video,
  Map
} from "lucide-react";
import type { Assignment, Announcement } from "@shared/schema";
import { isPrimaryForm } from "@shared/schema";
import { XpLevelBar } from "@/components/XpLevelBar";
import { StreakFlame } from "@/components/StreakFlame";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import logoPath from "@assets/logo.webp";

interface EnrichedSubmission {
  id: number;
  assignmentId: number;
  studentId: number;
  status: string;
  submittedAt: string;
  studentName?: string;
  assignmentTitle?: string;
  totalMarks?: number;
}

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const { student, logout } = useAuth();

  useEffect(() => {
    if (!student) {
      setLocation("/student/login");
    }
  }, [student, setLocation]);

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments", { form: student?.form, studentId: student?.id }],
    enabled: !!student,
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<EnrichedSubmission[]>({
    queryKey: ["/api/submissions", { studentId: student?.id }],
    enabled: !!student,
  });

  interface StudentStats {
    completed: number;
    pending: number;
    averageScore: number;
    totalSubmissions: number;
    xp?: {
      totalXp: number;
      level: number;
      xpIntoLevel: number;
      xpForNextLevel: number;
      progressPercent: number;
    };
    streak?: {
      current: number;
      longest: number;
      freezes: number;
      maxFreezes: number;
      notice: { type: string; message: string } | null;
    };
  }

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; stats: StudentStats }>({
    queryKey: ["/api/students", student?.id, "stats"],
    enabled: !!student,
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements", { form: student?.form }],
    enabled: !!student,
  });

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  if (!student) return null;

  const submittedAssignmentIds = new Set(submissions?.map(s => s.assignmentId) || []);
  const pendingAssignments = assignments?.filter(a => !submittedAssignmentIds.has(a.id)) || [];
  const markedSubmissions = submissions?.filter(s => s.status === "MARKED") || [];
  const pendingSubmissions = submissions?.filter(s => s.status === "SUBMITTED") || [];

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();
  const isDueSoon = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 2 && diffDays >= 0;
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case "urgent": return <Badge variant="destructive">Urgent</Badge>;
      case "important": return <Badge className="bg-orange-500">Important</Badge>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-10 w-auto" />
            <span className="font-semibold text-primary hidden sm:block">Student Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:block">
              {student.fullName} ({student.form})
            </span>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Welcome, {student.fullName}!</h1>
          <p className="text-muted-foreground">{student.form} - ID: {student.studentId}</p>
        </div>

        {/* Level + XP progress with the daily streak flame beside it. Both come
            from the stats already loaded above, so this adds no extra request.
            Shows zeroed values until stats arrive. */}
        <ErrorBoundary label="xp-streak">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0">
              <XpLevelBar
                level={statsData?.stats?.xp?.level ?? 0}
                xpIntoLevel={statsData?.stats?.xp?.xpIntoLevel ?? 0}
                xpForNextLevel={statsData?.stats?.xp?.xpForNextLevel ?? 500}
                progressPercent={statsData?.stats?.xp?.progressPercent ?? 0}
              />
            </div>
            <StreakFlame
              current={statsData?.stats?.streak?.current ?? 0}
              freezes={statsData?.stats?.streak?.freezes ?? 0}
              maxFreezes={statsData?.stats?.streak?.maxFreezes ?? 2}
            />
          </div>

          {/* A gentle one-time note when a freeze saved the streak, a milestone
              was reached, or a lost streak needs an encouraging nudge. */}
          {statsData?.stats?.streak?.notice && (
            <div
              className="mb-6 -mt-2 rounded-xl border px-4 py-3 text-sm font-medium bg-muted/40"
              data-testid="streak-notice"
            >
              {statsData.stats.streak.notice.message}
            </div>
          )}
        </ErrorBoundary>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignmentsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : pendingAssignments.length}
              </div>
              <p className="text-xs text-muted-foreground">assignments to complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {submissionsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : pendingSubmissions.length}
              </div>
              <p className="text-xs text-muted-foreground">awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Marked</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {submissionsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : markedSubmissions.length}
              </div>
              <p className="text-xs text-muted-foreground">with feedback</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${statsData?.stats?.averageScore || 0}%`}
              </div>
              <p className="text-xs text-muted-foreground">across all marked work</p>
            </CardContent>
          </Card>
        </div>

        {announcements && announcements.length > 0 && (
          <Card className="mb-6 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Announcements</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {announcements.map((announcement) => (
                  <div 
                    key={announcement.id} 
                    className={`p-3 rounded-md border ${announcement.priority === 'urgent' ? 'border-destructive/50 bg-destructive/5' : announcement.priority === 'important' ? 'border-orange-500/50 bg-orange-500/5' : ''}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium">{announcement.title}</span>
                      {getPriorityBadge(announcement.priority)}
                    </div>
                    <p className="text-sm text-muted-foreground">{announcement.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(announcement.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Treasure Island map — a fun collectibles game for primary classes
            (Stages 3-6) only. Secondary students (Form 1/2) never see this. */}
        {isPrimaryForm(student.form) && (
          <ErrorBoundary label="treasure-card">
          <Link href="/student/treasure">
            <Card className="hover-elevate cursor-pointer mb-6 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/15 text-2xl leading-none">🏝️</div>
                <div className="flex-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Map className="h-5 w-5 text-primary" />
                    Treasure Island
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Collect all 12 treasures by finishing your assignments!
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </Link>
          </ErrorBoundary>
        )}

        {/* Dream World — a town-building reward game for primary classes
            (Stages 3-6) only. Secondary students (Form 1/2) never see this. */}
        {isPrimaryForm(student.form) && (
          <ErrorBoundary label="dreamworld-card">
          <Link href="/student/dream-world">
            <Card className="hover-elevate cursor-pointer mb-6 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/15 text-2xl leading-none">🏙️</div>
                <div className="flex-1">
                  <h3 className="font-semibold">My Dream World</h3>
                  <p className="text-sm text-muted-foreground">
                    Spend the coins, bricks and wood you earn to build your own town!
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </Link>
          </ErrorBoundary>
        )}

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Link href="/student/resources">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/10">
                  <Library className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Learning Resources</h3>
                  <p className="text-sm text-muted-foreground">Access textbooks and study materials</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/student/lessons">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/10">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Video & Audio Lessons</h3>
                  <p className="text-sm text-muted-foreground">Watch and listen to recorded lessons</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Available Assignments</CardTitle>
              <CardDescription>Assignments waiting for your submission</CardDescription>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingAssignments.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {pendingAssignments.map((assignment) => (
                    <Link key={assignment.id} href={`/student/submit/${assignment.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-md border hover-elevate cursor-pointer">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{assignment.title}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{assignment.subject.replace('_', ' ')}</span>
                              <span>-</span>
                              <span className={`flex items-center gap-1 ${isOverdue(assignment.dueDate) ? 'text-destructive font-medium' : isDueSoon(assignment.dueDate) ? 'text-orange-500 font-medium' : ''}`}>
                                {isOverdue(assignment.dueDate) ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : (
                                  <Calendar className="h-3 w-3" />
                                )}
                                {isOverdue(assignment.dueDate) ? 'OVERDUE' : `Due: ${new Date(assignment.dueDate).toLocaleDateString()}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOverdue(assignment.dueDate) && (
                            <Badge variant="destructive">Late</Badge>
                          )}
                          {isDueSoon(assignment.dueDate) && !isOverdue(assignment.dueDate) && (
                            <Badge className="bg-orange-500">Due Soon</Badge>
                          )}
                          <Badge variant="outline">{assignment.totalMarks} marks</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-primary mb-4" />
                  <p className="text-muted-foreground">All caught up! No pending assignments.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Results</CardTitle>
              <CardDescription>Marked assignments with feedback</CardDescription>
            </CardHeader>
            <CardContent>
              {submissionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : markedSubmissions.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {markedSubmissions.map((submission) => (
                    <Link key={submission.id} href={`/student/results/${submission.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-md border hover-elevate cursor-pointer">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{submission.assignmentTitle || 'Assignment'}</p>
                            <p className="text-sm text-muted-foreground">
                              Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">View Results</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : pendingSubmissions.length > 0 ? (
                <div className="space-y-3">
                  {pendingSubmissions.map((submission) => (
                    <Link key={submission.id} href={`/student/submit/${submission.assignmentId}`}>
                      <div className="flex items-center justify-between p-4 rounded-md border hover-elevate cursor-pointer" data-testid={`row-pending-submission-${submission.id}`}>
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-secondary" />
                          <div>
                            <p className="font-medium">{submission.assignmentTitle || 'Assignment'}</p>
                            <p className="text-sm text-muted-foreground">
                              Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <Badge variant="outline" className="text-primary border-primary/40">Edit Submission</Badge>
                          <Badge variant="secondary">Awaiting Review</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No results yet. Complete some assignments!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
