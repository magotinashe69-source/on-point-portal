import { useEffect, useState } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ArrowLeft, FileText, Clock, CheckCircle, AlertCircle, Loader2, Calendar,
  BookOpen, Edit, UserPlus, Archive, ArchiveRestore, XCircle, Bell, Copy, RefreshCw, Paperclip
} from "lucide-react";
import { AttachmentDisplay } from "@/components/FileAttachmentZone";
import type { Assignment, Student } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoPath from "@assets/logo.webp";

interface EnrichedSubmission {
  id: number;
  assignmentId: number;
  studentId: number;
  status: string;
  submittedAt: string;
  studentName?: string;
  totalMarks?: number;
  score?: number | null;
  lateDays?: number;
}

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [extensionStudentId, setExtensionStudentId] = useState("");
  const [extensionNewDate, setExtensionNewDate] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [notifyStudent, setNotifyStudent] = useState<Student | null>(null);
  const [formFilter, setFormFilter] = useState<string>("all");

  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  const { data: assignment, isLoading: assignmentLoading } = useQuery<Assignment>({
    queryKey: ["/api/assignments", id],
    enabled: !!teacher && !!id,
    refetchInterval: 30000,
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<EnrichedSubmission[]>({
    queryKey: ["/api/submissions", { assignmentId: id }],
    enabled: !!teacher && !!id,
    refetchInterval: 30000,
  });

  const { data: students } = useQuery<Student[]>({
    queryKey: ["/api/students"],
    enabled: !!teacher,
    refetchInterval: 30000,
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async (data: { title?: string; instructions?: string; dueDate?: string; topic?: string }) => {
      return await apiRequest("PUT", `/api/assignments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      setIsEditDialogOpen(false);
      toast({ title: "Assignment updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update assignment", variant: "destructive" });
    },
  });

  const archiveAssignmentMutation = useMutation({
    mutationFn: async (archived: boolean) => {
      return await apiRequest("PATCH", `/api/assignments/${id}/archive`, { archived });
    },
    onSuccess: (_, archived) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      toast({ title: archived ? "Assignment archived" : "Assignment restored" });
      setLocation("/teacher/dashboard");
    },
    onError: () => {
      toast({ title: "Failed to update assignment", variant: "destructive" });
    },
  });

  const extendDeadlineMutation = useMutation({
    mutationFn: async (data: { studentId: number; newDueDate: string; reason?: string }) => {
      const currentExtensions = assignment?.extendedDeadlines || [];
      const filteredExtensions = currentExtensions.filter(e => e.studentId !== data.studentId);
      const newExtensions = [...filteredExtensions, data];
      return await apiRequest("PUT", `/api/assignments/${id}`, { extendedDeadlines: newExtensions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", id] });
      setIsExtendDialogOpen(false);
      setExtensionStudentId("");
      setExtensionNewDate("");
      setExtensionReason("");
      toast({ title: "Deadline extended successfully" });
    },
    onError: () => {
      toast({ title: "Failed to extend deadline", variant: "destructive" });
    },
  });

  if (!teacher) return null;

  const pendingSubmissions = submissions?.filter(s => s.status === "SUBMITTED") || [];
  const markedSubmissions = submissions?.filter(s => s.status === "MARKED") || [];

  // Determine eligible students for this assignment (respecting targetStudentIds)
  const targetIds = assignment?.targetStudentIds as number[] | null;
  const eligibleStudents = (() => {
    if (!students || !assignment) return [];
    let pool = targetIds && targetIds.length > 0
      ? students.filter(s => targetIds.includes(s.id))
      : students.filter(s => s.form === assignment.form);
    if (formFilter !== "all") pool = pool.filter(s => s.form === formFilter);
    return pool;
  })();

  // Unique forms present among eligible students (for filter dropdown)
  const allEligibleStudents = (() => {
    if (!students || !assignment) return [];
    return targetIds && targetIds.length > 0
      ? students.filter(s => targetIds.includes(s.id))
      : students.filter(s => s.form === assignment.form);
  })();
  const eligibleForms = Array.from(new Set(allEligibleStudents.map(s => s.form)));
  const showFormFilter = eligibleForms.length > 1;

  const submittedStudentIds = new Set(submissions?.map(s => s.studentId) || []);
  const submittedList = eligibleStudents.filter(s => submittedStudentIds.has(s.id));
  const notSubmittedList = eligibleStudents.filter(s => !submittedStudentIds.has(s.id));

  const getSubmissionForStudent = (studentId: number) =>
    submissions?.find(s => s.studentId === studentId);

  const handleOpenEditDialog = () => {
    if (assignment) {
      setEditTitle(assignment.title);
      setEditInstructions(assignment.instructions);
      setEditDueDate(new Date(assignment.dueDate).toISOString().split("T")[0]);
      setEditTopic(assignment.topic || "");
    }
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    updateAssignmentMutation.mutate({
      title: editTitle,
      instructions: editInstructions,
      dueDate: editDueDate,
      topic: editTopic || undefined,
    });
  };

  const handleExtendDeadline = () => {
    if (!extensionStudentId || !extensionNewDate) return;
    extendDeadlineMutation.mutate({
      studentId: parseInt(extensionStudentId),
      newDueDate: extensionNewDate,
      reason: extensionReason || undefined,
    });
  };

  const buildNotifyMessage = (student: Student) => {
    const dueDate = assignment
      ? new Date(assignment.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "the due date";
    return `Dear Parent of ${student.fullName},\n\nYour child has not yet submitted the assignment "${assignment?.title}" (Subject: ${assignment?.subject}, Form: ${assignment?.form}) which was due on ${dueDate}.\n\nPlease follow up with your child and ensure the work is submitted as soon as possible.\n\nThank you,\nOn Point Education Centre`;
  };

  const handleCopyMessage = (message: string) => {
    navigator.clipboard.writeText(message).then(() => {
      toast({ title: "Message copied to clipboard" });
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/dashboard" className="flex items-center gap-2" data-testid="link-back-dashboard">
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
        {assignmentLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : assignment ? (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold">{assignment.title}</h1>
                  <Badge variant="outline">{assignment.subject}</Badge>
                  <Badge variant="secondary">{assignment.form}</Badge>
                  {assignment.topic && <Badge variant="outline">{assignment.topic}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {/* Edit */}
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={handleOpenEditDialog} data-testid="button-edit-assignment">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Assignment</DialogTitle>
                        <DialogDescription>Update assignment details</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="edit-title">Title</Label>
                          <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} data-testid="input-edit-title" />
                        </div>
                        <div>
                          <Label htmlFor="edit-topic">Topic (optional)</Label>
                          <Input id="edit-topic" value={editTopic} onChange={(e) => setEditTopic(e.target.value)} placeholder="e.g., Algebra, Grammar" data-testid="input-edit-topic" />
                        </div>
                        <div>
                          <Label htmlFor="edit-due-date">Due Date</Label>
                          <Input id="edit-due-date" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} data-testid="input-edit-due-date" />
                        </div>
                        <div>
                          <Label htmlFor="edit-instructions">Instructions</Label>
                          <Textarea id="edit-instructions" value={editInstructions} onChange={(e) => setEditInstructions(e.target.value)} rows={4} data-testid="input-edit-instructions" />
                        </div>
                        <Button onClick={handleSaveEdit} disabled={updateAssignmentMutation.isPending} className="w-full" data-testid="button-save-edit">
                          {updateAssignmentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Archive */}
                  <Button variant="outline" size="sm" onClick={() => archiveAssignmentMutation.mutate(!assignment.archived)} disabled={archiveAssignmentMutation.isPending} data-testid="button-archive-detail">
                    {archiveAssignmentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : assignment.archived ? <ArchiveRestore className="h-4 w-4 mr-1" /> : <Archive className="h-4 w-4 mr-1" />}
                    {assignment.archived ? "Unarchive" : "Archive"}
                  </Button>

                  {/* Extend Deadline */}
                  <Dialog open={isExtendDialogOpen} onOpenChange={setIsExtendDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-extend-deadline">
                        <UserPlus className="h-4 w-4 mr-1" />
                        Extend Deadline
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Extend Deadline for Student</DialogTitle>
                        <DialogDescription>Give a specific student more time</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="extension-student">Student</Label>
                          <Select value={extensionStudentId} onValueChange={setExtensionStudentId}>
                            <SelectTrigger data-testid="select-extension-student">
                              <SelectValue placeholder="Select a student" />
                            </SelectTrigger>
                            <SelectContent>
                              {students?.filter(s => s.form === assignment.form).map((student) => (
                                <SelectItem key={student.id} value={student.id.toString()}>
                                  {student.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="extension-date">New Due Date</Label>
                          <Input id="extension-date" type="date" value={extensionNewDate} onChange={(e) => setExtensionNewDate(e.target.value)} data-testid="input-extension-date" />
                        </div>
                        <div>
                          <Label htmlFor="extension-reason">Reason (optional)</Label>
                          <Textarea id="extension-reason" value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)} placeholder="e.g., Medical leave, family emergency" rows={2} data-testid="input-extension-reason" />
                        </div>
                        <Button onClick={handleExtendDeadline} disabled={extendDeadlineMutation.isPending || !extensionStudentId || !extensionNewDate} className="w-full" data-testid="button-save-extension">
                          {extendDeadlineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Extend Deadline
                        </Button>
                      </div>
                      {assignment.extendedDeadlines && assignment.extendedDeadlines.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium mb-2">Current Extensions</h4>
                          <div className="space-y-2 text-sm">
                            {assignment.extendedDeadlines.map((ext, idx) => {
                              const student = students?.find(s => s.id === ext.studentId);
                              return (
                                <div key={idx} className="p-2 bg-muted rounded">
                                  <span className="font-medium">{student?.fullName || `Student ${ext.studentId}`}</span>
                                  {" — "}
                                  {new Date(ext.newDueDate).toLocaleDateString()}
                                  {ext.reason && <span className="text-muted-foreground"> ({ext.reason})</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Due: {new Date(assignment.dueDate).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {assignment.totalMarks} marks
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  Auto-refreshes every 30 s
                </span>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid gap-6 lg:grid-cols-3 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Total Submissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {submissionsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : submissions?.length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-secondary" />
                    Pending Review
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-secondary">
                    {submissionsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : pendingSubmissions.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Marked
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {submissionsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : markedSubmissions.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Instructions */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{assignment.instructions}</p>
              </CardContent>
            </Card>

            {/* Assignment Attachments */}
            {assignment.attachments && assignment.attachments.length > 0 && (
              <Card className="mb-8">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Paperclip className="h-4 w-4" />
                    Reference Materials ({assignment.attachments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AttachmentDisplay attachments={assignment.attachments} title="" />
                </CardContent>
              </Card>
            )}

            {/* Questions */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {assignment.questions.map((q, index) => (
                    <div key={q.id} className="p-4 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Question {index + 1}</span>
                        <Badge variant="outline">{q.maxScore} marks</Badge>
                      </div>
                      <p className="whitespace-pre-line">{q.questionText}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Submission Tracker ── */}
            <div className="mb-2 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Submission Tracker
              </h2>
              {showFormFilter && (
                <Select value={formFilter} onValueChange={setFormFilter}>
                  <SelectTrigger className="w-40" data-testid="select-form-filter">
                    <SelectValue placeholder="All forms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Forms</SelectItem>
                    {eligibleForms.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2 mb-8">
              {/* LEFT: Submitted */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    Submitted
                    <Badge className="ml-auto bg-green-600">{submittedList.length}</Badge>
                  </CardTitle>
                  <CardDescription>Students who have submitted their work</CardDescription>
                </CardHeader>
                <CardContent>
                  {submissionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : submittedList.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No submissions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {submittedList.map(student => {
                        const sub = getSubmissionForStudent(student.id);
                        if (!sub) return null;
                        return (
                          <Link key={student.id} href={`/teacher/mark/${sub.id}`}>
                            <div
                              className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer"
                              data-testid={`row-submitted-${student.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {sub.status === "MARKED" ? (
                                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                                ) : (
                                  <Clock className="h-4 w-4 text-secondary shrink-0" />
                                )}
                                <div>
                                  <p className="font-medium text-sm">{student.fullName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(sub.submittedAt).toLocaleString("en-GB", {
                                      day: "2-digit", month: "short", year: "numeric",
                                      hour: "2-digit", minute: "2-digit"
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {sub.status === "MARKED" && sub.score !== null && sub.score !== undefined ? (
                                  <Badge className="bg-primary text-white text-xs">
                                    {sub.score}/{assignment.totalMarks}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Needs Review</Badge>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* RIGHT: Not Submitted */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    Not Submitted
                    <Badge className="ml-auto bg-destructive">{notSubmittedList.length}</Badge>
                  </CardTitle>
                  <CardDescription>Students who haven't submitted yet</CardDescription>
                </CardHeader>
                <CardContent>
                  {submissionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : notSubmittedList.length === 0 ? (
                    <div className="text-center py-8 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">All students have submitted!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {notSubmittedList.map(student => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-3 rounded-md border"
                          data-testid={`row-not-submitted-${student.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{student.fullName}</p>
                              <p className="text-xs text-muted-foreground">{student.form}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 text-xs"
                            onClick={() => setNotifyStudent(student)}
                            data-testid={`button-notify-${student.id}`}
                          >
                            <Bell className="h-3 w-3 mr-1" />
                            Notify Parent
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Assignment not found</p>
          </div>
        )}
      </main>

      {/* Notify Parent Dialog */}
      <Dialog open={!!notifyStudent} onOpenChange={(open) => { if (!open) setNotifyStudent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notify Parent — {notifyStudent?.fullName}
            </DialogTitle>
            <DialogDescription>
              Copy this message and send it to the parent via WhatsApp, email, or any other channel.
            </DialogDescription>
          </DialogHeader>
          {notifyStudent && assignment && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono leading-relaxed" data-testid="text-notify-message">
                {buildNotifyMessage(notifyStudent)}
              </div>
              <Button
                className="w-full"
                onClick={() => handleCopyMessage(buildNotifyMessage(notifyStudent))}
                data-testid="button-copy-message"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Message
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
