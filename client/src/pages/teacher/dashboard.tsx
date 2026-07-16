import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  PlusCircle, 
  FileText, 
  LogOut, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  BookOpen,
  Users,
  Loader2,
  Library,
  Trash2,
  Megaphone,
  Bell,
  Video,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  XCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Assignment, Student, Announcement } from "@shared/schema";
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

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const { teacher, logout } = useAuth();

  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
    enabled: !!teacher,
    refetchInterval: 30000,
  });

  const { data: students, isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    enabled: !!teacher,
    refetchInterval: 30000,
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<EnrichedSubmission[]>({
    queryKey: ["/api/submissions"],
    enabled: !!teacher,
    refetchInterval: 30000,
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    enabled: !!teacher,
  });

  const { data: archivedAssignments, isLoading: archivedLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments", { archived: true }],
    queryFn: async () => {
      const res = await fetch("/api/assignments?archived=true");
      return res.json();
    },
    enabled: !!teacher,
  });

  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementForm, setAnnouncementForm] = useState<string>("all");
  const [announcementPriority, setAnnouncementPriority] = useState<string>("normal");
  const [activeClassFilter, setActiveClassFilter] = useState<string>("all");
  const [showMissingSubmissions, setShowMissingSubmissions] = useState(true);

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/assignments/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Assignment Deleted",
        description: "The assignment has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      setDeletingId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete assignment. Please try again.",
        variant: "destructive",
      });
      setDeletingId(null);
    },
  });

  const archiveAssignmentMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: number; archived: boolean }) => {
      const response = await apiRequest("PATCH", `/api/assignments/${id}/archive`, { archived });
      return response.json();
    },
    onSuccess: (_, { archived }) => {
      toast({
        title: archived ? "Assignment Archived" : "Assignment Restored",
        description: archived ? "The assignment has been moved to the archive." : "The assignment has been restored to active assignments.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      setArchivingId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update assignment. Please try again.",
        variant: "destructive",
      });
      setArchivingId(null);
    },
  });

  const handleArchiveAssignment = (e: React.MouseEvent, id: number, archived: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setArchivingId(id);
    archiveAssignmentMutation.mutate({ id, archived });
  };

  const handleDeleteAssignment = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this assignment? This will also delete all student submissions.")) {
      setDeletingId(id);
      deleteAssignmentMutation.mutate(id);
    }
  };

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; form: string | null; priority: string }) => {
      const response = await apiRequest("POST", "/api/announcements", {
        ...data,
        createdById: teacher?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Announcement Posted", description: "Your announcement has been sent to students." });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setIsAnnouncementDialogOpen(false);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      setAnnouncementForm("all");
      setAnnouncementPriority("normal");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to post announcement.", variant: "destructive" });
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/announcements/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Announcement Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
  });

  const handlePostAnnouncement = () => {
    if (!announcementTitle.trim() || !announcementContent.trim()) {
      toast({ title: "Error", description: "Title and content are required.", variant: "destructive" });
      return;
    }
    createAnnouncementMutation.mutate({
      title: announcementTitle,
      content: announcementContent,
      form: announcementForm === "all" ? null : announcementForm,
      priority: announcementPriority,
    });
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case "urgent": return <Badge variant="destructive">Urgent</Badge>;
      case "important": return <Badge className="bg-orange-500">Important</Badge>;
      default: return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getAssignmentTargetLabel = (assignment: Assignment): string => {
    const targetIds = assignment.targetStudentIds || [];
    if (targetIds.length === 0) {
      return `All ${assignment.form}`;
    }
    if (!students) return `${targetIds.length} student(s)`;
    const targetStudents = students.filter(s => targetIds.includes(s.id));
    if (targetStudents.length <= 2) {
      return targetStudents.map(s => s.fullName.split(' ')[0]).join(', ');
    }
    return `${targetStudents.length} students`;
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  if (!teacher) return null;

  const pendingSubmissions = submissions?.filter(s => s.status === "SUBMITTED") || [];
  const markedSubmissions = submissions?.filter(s => s.status === "MARKED") || [];

  const classLevels = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"] as const;

  const filteredAssignments = assignments?.filter(a => 
    activeClassFilter === "all" || a.form === activeClassFilter
  ) || [];

  const getSubmissionForm = (submission: EnrichedSubmission): string => {
    const assignment = assignments?.find(a => a.id === submission.assignmentId);
    return assignment?.form || "";
  };

  const filteredPendingSubmissions = pendingSubmissions.filter(s =>
    activeClassFilter === "all" || getSubmissionForm(s) === activeClassFilter
  );

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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Manage your assignments and student submissions</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-students">
                {studentsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${students?.length || 0} students`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignmentsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : assignments?.length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {submissionsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : pendingSubmissions.length}
              </div>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {submissionsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : submissions?.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Missing Submissions Today */}
        {(() => {
          if (!assignments || !submissions || !students) return null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayStr = today.toISOString().split("T")[0];
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split("T")[0];

          const missingSummary = assignments
            .filter(a => !a.archived && (a.dueDate === todayStr || a.dueDate === yesterdayStr))
            .map(a => {
              const targetIds = (a.targetStudentIds as number[] | null);
              const eligible = targetIds && targetIds.length > 0
                ? students.filter(s => targetIds.includes(s.id))
                : students.filter(s => s.form === a.form);
              const submittedIds = new Set(
                submissions.filter(s => s.assignmentId === a.id).map(s => s.studentId)
              );
              const missingCount = eligible.filter(s => !submittedIds.has(s.id)).length;
              return { assignment: a, missingCount };
            })
            .filter(x => x.missingCount > 0);

          if (missingSummary.length === 0) return null;

          return (
            <Card className="mb-6 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20" data-testid="card-missing-submissions">
              <button
                className="w-full text-left"
                onClick={() => setShowMissingSubmissions(p => !p)}
                data-testid="button-toggle-missing-submissions"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400 text-base">
                    <AlertCircle className="h-5 w-5" />
                    Missing Submissions Today
                    <Badge className="bg-orange-600 text-white">{missingSummary.length} assignment{missingSummary.length !== 1 ? "s" : ""}</Badge>
                    <span className="ml-auto">
                      {showMissingSubmissions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </CardTitle>
                  <CardDescription>Due today or yesterday — students who haven't submitted yet</CardDescription>
                </CardHeader>
              </button>
              {showMissingSubmissions && (
                <CardContent>
                  <div className="space-y-2">
                    {missingSummary.map(({ assignment, missingCount }) => (
                      <Link key={assignment.id} href={`/teacher/assignments/${assignment.id}`}>
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-700 hover-elevate cursor-pointer" data-testid={`row-missing-${assignment.id}`}>
                          <div>
                            <p className="font-medium text-sm">{assignment.title}</p>
                            <p className="text-xs text-muted-foreground">{assignment.subject} · {assignment.form} · Due {new Date(assignment.dueDate).toLocaleDateString()}</p>
                          </div>
                          <Badge variant="destructive" className="shrink-0">
                            {missingCount} missing
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })()}

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4 mb-6">
          <Link href="/teacher/resources">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/10">
                  <Library className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Learning Resources</h3>
                  <p className="text-sm text-muted-foreground">Manage textbooks, videos, lesson plans</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/teacher/lessons">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/10">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Video & Audio Lessons</h3>
                  <p className="text-sm text-muted-foreground">Upload or record lessons for students</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/teacher/students">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Manage Students</h3>
                  <p className="text-sm text-muted-foreground">Add, edit, or remove students</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/teacher/reports" data-testid="link-reports">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Reports & Analytics</h3>
                  <p className="text-sm text-muted-foreground">View charts and track progress</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/teacher/gradebook" data-testid="link-gradebook">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/10">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Grade Book</h3>
                  <p className="text-sm text-muted-foreground">Track submissions and scores</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/teacher/export" data-testid="link-export-data">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-primary/10">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Export Data</h3>
                  <p className="text-sm text-muted-foreground">Download filtered CSV reports</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/teacher/daily-report" data-testid="link-daily-report">
            <Card className="hover-elevate cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 py-6">
                <div className="p-3 rounded-md bg-secondary/10">
                  <Bell className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold">Daily Report</h3>
                  <p className="text-sm text-muted-foreground">WhatsApp-ready submission snapshot</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
            <DialogTrigger asChild>
              <Card className="hover-elevate cursor-pointer h-full">
                <CardContent className="flex items-center gap-4 py-6">
                  <div className="p-3 rounded-md bg-secondary/10">
                    <Megaphone className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Post Announcement</h3>
                    <p className="text-sm text-muted-foreground">Send notices to students</p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Post Announcement</DialogTitle>
                <DialogDescription>Send a notice to all students or a specific form</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Announcement title"
                    data-testid="input-announcement-title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="Write your announcement..."
                    className="min-h-[100px]"
                    data-testid="textarea-announcement-content"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Target Audience</label>
                    <Select value={announcementForm} onValueChange={setAnnouncementForm}>
                      <SelectTrigger data-testid="select-announcement-form">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        <SelectItem value="Stage 3">Stage 3 Only</SelectItem>
                        <SelectItem value="Stage 4">Stage 4 Only</SelectItem>
                        <SelectItem value="Stage 5">Stage 5 Only</SelectItem>
                        <SelectItem value="Stage 6">Stage 6 Only</SelectItem>
                        <SelectItem value="Form 1">Form 1 Only</SelectItem>
                        <SelectItem value="Form 2">Form 2 Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <Select value={announcementPriority} onValueChange={setAnnouncementPriority}>
                      <SelectTrigger data-testid="select-announcement-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="important">Important</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handlePostAnnouncement}
                  disabled={createAnnouncementMutation.isPending}
                  className="w-full"
                  data-testid="button-post-announcement"
                >
                  {createAnnouncementMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
                  Post Announcement
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {announcements && announcements.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Active Announcements</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="flex items-start justify-between gap-3 p-3 rounded-md border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium">{announcement.title}</span>
                        {getPriorityBadge(announcement.priority)}
                        {announcement.form && <Badge variant="outline">{announcement.form}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{announcement.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Posted {new Date(announcement.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAnnouncementMutation.mutate(announcement.id)}
                      data-testid={`button-delete-announcement-${announcement.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Filter by Class</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeClassFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveClassFilter("all")}
              data-testid="filter-class-all"
            >
              All Classes
            </Button>
            {classLevels.map((level) => {
              const count = assignments?.filter(a => a.form === level).length || 0;
              const pendingCount = pendingSubmissions.filter(s => getSubmissionForm(s) === level).length;
              return (
                <Button
                  key={level}
                  variant={activeClassFilter === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveClassFilter(level)}
                  data-testid={`filter-class-${level.replace(" ", "-").toLowerCase()}`}
                  className="relative"
                >
                  {level}
                  {count > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{count}</Badge>
                  )}
                  {pendingCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{pendingCount}</Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Assignments {activeClassFilter !== "all" ? `— ${activeClassFilter}` : ""}</CardTitle>
                  <CardDescription>
                    {activeClassFilter === "all" ? "Your created assignments" : `Assignments for ${activeClassFilter}`}
                  </CardDescription>
                </div>
                <Link href="/teacher/assignments/new">
                  <Button size="sm" data-testid="button-create-assignment">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create New
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAssignments.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-3 rounded-md border hover-elevate">
                      <Link href={`/teacher/assignments/${assignment.id}`} className="flex items-center gap-3 flex-1 cursor-pointer">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="font-medium">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.subject} - {assignment.form}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="hidden sm:flex">
                          <Users className="h-3 w-3 mr-1" />
                          {getAssignmentTargetLabel(assignment)}
                        </Badge>
                        <Badge variant="outline">{assignment.totalMarks} marks</Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => handleArchiveAssignment(e, assignment.id, true)}
                          disabled={archivingId === assignment.id}
                          data-testid={`button-archive-assignment-${assignment.id}`}
                          title="Archive assignment"
                        >
                          {archivingId === assignment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Archive className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => handleDeleteAssignment(e, assignment.id)}
                          disabled={deletingId === assignment.id}
                          data-testid={`button-delete-assignment-${assignment.id}`}
                          title="Delete assignment"
                        >
                          {deletingId === assignment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {activeClassFilter === "all" ? "No assignments yet" : `No assignments for ${activeClassFilter}`}
                  </p>
                  <Link href="/teacher/assignments/new">
                    <Button size="sm">Create your first assignment</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Submissions {activeClassFilter !== "all" ? `— ${activeClassFilter}` : ""}</CardTitle>
              <CardDescription>
                {activeClassFilter === "all" ? "Submissions awaiting your review" : `Submissions for ${activeClassFilter} awaiting review`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submissionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPendingSubmissions.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredPendingSubmissions.map((submission) => (
                    <Link key={submission.id} href={`/teacher/mark/${submission.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-secondary shrink-0" />
                          <div>
                            <p className="font-medium">{submission.studentName || "Student"}</p>
                            <p className="text-sm text-muted-foreground">
                              {submission.assignmentTitle || 'Assignment'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">Needs Review</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-primary mb-4" />
                  <p className="text-muted-foreground">
                    {activeClassFilter === "all" ? "All caught up! No pending submissions." : `No pending submissions for ${activeClassFilter}.`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {archivedAssignments && archivedAssignments.length > 0 && (
          <div className="mt-6">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-center gap-2 mb-3"
              onClick={() => setShowArchived(!showArchived)}
              data-testid="button-toggle-archived"
            >
              <Archive className="h-4 w-4" />
              Archived Assignments ({archivedAssignments.length})
              {showArchived ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {showArchived && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5" />
                    Archived Assignments
                  </CardTitle>
                  <CardDescription>These assignments are hidden from your active list</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {archivedAssignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 rounded-md border">
                        <Link href={`/teacher/assignments/${assignment.id}`} className="flex items-center gap-3 flex-1 cursor-pointer">
                          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium">{assignment.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {assignment.subject} - {assignment.form}
                            </p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{assignment.totalMarks} marks</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleArchiveAssignment(e, assignment.id, false)}
                            disabled={archivingId === assignment.id}
                            data-testid={`button-unarchive-assignment-${assignment.id}`}
                            title="Restore assignment"
                          >
                            {archivingId === assignment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArchiveRestore className="h-4 w-4 text-primary" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteAssignment(e, assignment.id)}
                            disabled={deletingId === assignment.id}
                            data-testid={`button-delete-archived-${assignment.id}`}
                            title="Delete assignment"
                          >
                            {deletingId === assignment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
