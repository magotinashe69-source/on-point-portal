import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BulkPasteDialog } from "@/components/BulkPasteDialog";
import { splitPastedLines, separateDuplicates, type SkippedLine } from "@/lib/bulk-paste";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { QrBackfillDialog } from "@/components/QrBackfillDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { QueryError } from "@/components/QueryError";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, PlusCircle, Pencil, Trash2, KeyRound, Loader2, Users, ClipboardPaste, QrCode, UserPlus, MessageSquare, Copy, Check } from "lucide-react";
import logoPath from "@assets/logo.webp";
import type { Student, Parent } from "@shared/schema";
import type { WeeklyReport } from "@shared/weekly-report";
import { serverMessage, useT } from "@/lib/i18n";

// --- Bulk paste ---------------------------------------------------------
// Enrolling a class means typing the same thing thirty times. Each line is one
// pupil:
//
//   Tafara Moyo
//   Rudo Chikwanha | Female
//
// The class is chosen once for the whole batch. A gender after a separator
// applies to that pupil; without one they take the batch default. The line
// splitting is shared with the other paste dialogs (see lib/bulk-paste).
export interface ParsedStudentLine {
  lineNumber: number;
  fullName: string;
  gender: "Male" | "Female" | null; // null = use the batch default
}

export interface ParsedStudents {
  rows: ParsedStudentLine[];
  skipped: SkippedLine[];
}

export function parsePastedStudents(
  raw: string,
  reasons = { noName: "No name", badGender: 'Gender should be "Male" or "Female"' },
): ParsedStudents {
  const rows: ParsedStudentLine[] = [];
  const skipped: SkippedLine[] = [];

  for (const line of splitPastedLines(raw)) {
    const fullName = line.parts[0] ?? "";
    const genderRaw = (line.parts[1] ?? "").toLowerCase();

    if (fullName === "") {
      skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: reasons.noName });
      continue;
    }

    let gender: "Male" | "Female" | null = null;
    if (genderRaw !== "") {
      if (genderRaw === "m" || genderRaw === "male") gender = "Male";
      else if (genderRaw === "f" || genderRaw === "female") gender = "Female";
      else {
        skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: reasons.badGender });
        continue;
      }
    }

    rows.push({ lineNumber: line.lineNumber, fullName, gender });
  }

  return { rows, skipped };
}

// Short code used at the front of a pupil's student id, per class.
const FORM_ID_PREFIX: Record<string, string> = {
  "Stage 3": "S3", "Stage 4": "S4", "Stage 5": "S5", "Stage 6": "S6", "Form 1": "F1", "Form 2": "F2",
};

export default function StudentManagement() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [filterForm, setFilterForm] = useState<string>("all");
  
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    qrCode: "",
    fullName: "",
    gender: "Male" as "Male" | "Female",
    form: "Form 1" as "Stage 3" | "Stage 4" | "Stage 5" | "Stage 6" | "Form 1" | "Form 2",
  });

  // Bulk paste: the dialog, the pasted list, and the settings applied to the
  // whole batch. `pasteBusy` blocks a second click while pupils are being added.
  // Parent accounts. `parentForStudent` is the child whose parent dialog is
  // open — null when the dialog is closed.
  const [parentForStudent, setParentForStudent] = useState<Student | null>(null);
  const [newParent, setNewParent] = useState({ fullName: "", username: "", password: "" });
  // Editing the account a child already has. `editingParent` is true while the
  // edit form is showing; `parentEdits` holds what the teacher has typed.
  // A blank password here means "keep the current one".
  const [editingParent, setEditingParent] = useState(false);
  const [parentEdits, setParentEdits] = useState({ fullName: "", username: "", password: "" });

  // Weekly report. `reportForStudent` is the child whose report is open —
  // null when the dialog is closed. `reportWeek` picks which week to show.
  const [reportForStudent, setReportForStudent] = useState<Student | null>(null);
  const [reportWeek, setReportWeek] = useState<"this" | "last">("last");
  const [reportCopied, setReportCopied] = useState(false);

  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteForm, setPasteForm] = useState<"Stage 3" | "Stage 4" | "Stage 5" | "Stage 6" | "Form 1" | "Form 2">("Form 1");
  const [pasteGender, setPasteGender] = useState<"Male" | "Female">("Male");
  const [pasteBusy, setPasteBusy] = useState(false);


  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  const { data: students = [], isLoading, isError, error, refetch } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  // Every parent account in the school, so each row can show whether that child
  // already has one. Passwords are never included — the server strips them.
  const { data: parentAccounts = [] } = useQuery<Parent[]>({
    queryKey: ["/api/parents"],
  });

  // The parent account linked to a child, if there is one. One per child for now.
  const parentFor = (studentId: number) => parentAccounts.find(p => p.studentId === studentId);

  const createParentMutation = useMutation({
    mutationFn: async ({ studentId, data }: { studentId: number; data: typeof newParent }) => {
      // The child is named in the address, not the body, so the account can
      // only ever be linked to the pupil whose record this dialog was opened on.
      const response = await apiRequest("POST", `/api/students/${studentId}/parent`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/parents"] });
        toast({
          title: t.register.parentCreated,
          description: t.register.parentCreatedNote,
        });
        setParentForStudent(null);
        setNewParent({ fullName: "", username: "", password: "" });
      } else {
        toast({ title: t.register.parentNotCreated, description: serverMessage(t, data), variant: "destructive" });
      }
    },
  });

  const deleteParentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/parents/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parents"] });
      toast({ title: t.register.parentRemoved, description: t.register.parentRemovedNote });
      setParentForStudent(null);
      setEditingParent(false);
    },
  });

  // Correcting an account that already exists. The child is not sent, and the
  // server would ignore it anyway — an account stays with the pupil it was
  // created on, so an edit can never point a parent at a different child.
  const updateParentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof parentEdits }) => {
      const response = await apiRequest("PATCH", `/api/parents/${id}`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/parents"] });
        toast({
          title: t.register.parentUpdated,
          description: t.register.parentUpdatedNote,
        });
        setEditingParent(false);
        setParentEdits({ fullName: "", username: "", password: "" });
      } else {
        toast({ title: t.register.parentNotUpdated, description: serverMessage(t, data), variant: "destructive" });
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newStudent) => {
      const response = await apiRequest("POST", "/api/students", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/students"] });
        toast({ title: t.register.studentAdded });
        setIsAddDialogOpen(false);
        setNewStudent({ studentId: "", qrCode: "", fullName: "", gender: "Male", form: "Form 1" });
      } else {
        toast({ title: t.register.studentNotAdded, description: serverMessage(t, data), variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Student> }) => {
      const response = await apiRequest("PUT", `/api/students/${id}`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/students"] });
        toast({ title: t.register.studentUpdated });
        setIsEditDialogOpen(false);
        setEditingStudent(null);
      } else {
        toast({ title: t.register.studentNotUpdated, description: serverMessage(t, data), variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/students/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: t.register.studentRemoved });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/students/${id}/reset-password`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/students"] });
        toast({ title: t.register.passwordReset, description: t.register.passwordResetNote });
      } else {
        toast({ title: t.register.passwordNotReset, description: serverMessage(t, data), variant: "destructive" });
      }
    },
  });

  // The report and its WhatsApp message for the child whose dialog is open.
  // The server sends both together, so the teacher sees exactly what they are
  // about to send without a second request.
  const { data: reportData, isLoading: reportLoading, isError: reportError } = useQuery<{
    success: boolean;
    report: WeeklyReport;
    message: string;
  }>({
    queryKey: [`/api/students/${reportForStudent?.id}/weekly-report/whatsapp`, { week: reportWeek }],
    enabled: !!reportForStudent,
  });

  const copyReport = async () => {
    const text = reportData?.message;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setReportCopied(true);
      toast({ title: t.register.copied, description: t.register.copiedNote });
      setTimeout(() => setReportCopied(false), 3000);
    } catch {
      toast({ title: t.register.copyFailed, description: t.register.copyFailedNote, variant: "destructive" });
    }
  };

  const filteredStudents = students.filter(s => 
    filterForm === "all" || s.form === filterForm
  );

  const generateStudentId = () => {
    const form = FORM_ID_PREFIX[newStudent.form] || "F1";
    const formStudents = students.filter(s => s.form === newStudent.form);
    const nextNum = formStudents.length + 1;
    return `${form}-${String(nextNum).padStart(3, '0')}`;
  };

  // Work out what a paste would actually do, so the preview and the button
  // agree with what happens. A pupil already on the register is skipped, and so
  // is a name repeated twice in the pasted list itself.
  const pasteParsed = parsePastedStudents(pasteText, { noName: t.register.noName, badGender: t.register.badGender });
  const pasteReview = separateDuplicates(pasteParsed.rows, {
    keyOf: r => r.fullName,
    labelOf: r => r.fullName,
    lineNumberOf: r => r.lineNumber,
    existingKeys: new Set(students.map(s => s.fullName.trim().toLowerCase())),
    existingReason: t.register.alreadyOnRegister,
  });

  // Student IDs for the batch. Carries on from the highest number already used
  // in that class, so it cannot collide with an existing pupil even if someone
  // has been removed, and each pupil in the batch gets their own.
  const nextIdsForBatch = (form: string, count: number) => {
    const prefix = FORM_ID_PREFIX[form] || "F1";
    let highest = 0;
    for (const s of students) {
      const m = s.studentId?.match(/(\d+)$/);
      if (s.form === form && m) highest = Math.max(highest, parseInt(m[1], 10));
    }
    return Array.from({ length: count }, (_, i) => `${prefix}-${String(highest + 1 + i).padStart(3, "0")}`);
  };

  // Add everyone in the preview. Pupils go in one at a time so that one bad
  // row cannot lose the rest; the toast at the end says exactly what happened.
  const addPastedStudents = async () => {
    const rows = pasteReview.toAdd;
    if (rows.length === 0 || pasteBusy) return;
    setPasteBusy(true);

    const ids = nextIdsForBatch(pasteForm, rows.length);
    let added = 0;
    const failed: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const response = await apiRequest("POST", "/api/students", {
          studentId: ids[i],
          fullName: rows[i].fullName,
          gender: rows[i].gender ?? pasteGender,
          form: pasteForm,
        });
        const data = await response.json();
        if (data.success) added++;
        else failed.push(rows[i].fullName);
      } catch {
        failed.push(rows[i].fullName);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/api/students"] });
    setPasteBusy(false);
    setIsPasteDialogOpen(false);
    setPasteText("");

    const skippedCount = pasteReview.duplicates.length;
    toast({
      title: `Added ${added} student${added === 1 ? "" : "s"} to ${pasteForm}`,
      description: [
        skippedCount > 0 ? `${skippedCount} already on the register or repeated — skipped.` : "",
        failed.length > 0 ? `Could not add: ${failed.join(", ")}.` : "",
      ].filter(Boolean).join(" ") || "Everyone on the list was added.",
      variant: failed.length > 0 ? "destructive" : undefined,
    });
  };

  // The account already linked to the child whose dialog is open, if any.
  const existingParent = parentForStudent ? parentFor(parentForStudent.id) : undefined;

  if (!teacher) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t.submit.backToDashboard}</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Users className="h-6 w-6" />
                  Student Management
                </CardTitle>
                <CardDescription>
                  Add, edit, or remove students from the system
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
              {/* Bulk paste — enrol a whole class from a pasted list. */}
              <Button variant="outline" onClick={() => setIsPasteDialogOpen(true)} data-testid="button-paste-students">
                <ClipboardPaste className="h-4 w-4 mr-2" />
                {t.register.pasteStudents}
              </Button>
              <BulkPasteDialog
                open={isPasteDialogOpen}
                onOpenChange={setIsPasteDialogOpen}
                title={t.register.pasteStudents}
                description={t.register.pasteNote}
                noun={{ one: t.register.pasteNounOne, many: t.register.pasteNounMany }}
                countSuffix={`to ${pasteForm}`}
                settings={
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t.register.pasteClass}</Label>
                      <Select value={pasteForm} onValueChange={(v) => setPasteForm(v as typeof pasteForm)}>
                        <SelectTrigger data-testid="select-paste-form"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.keys(FORM_ID_PREFIX).map(f => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.register.pasteGender}</Label>
                      <Select value={pasteGender} onValueChange={(v) => setPasteGender(v as "Male" | "Female")}>
                        <SelectTrigger data-testid="select-paste-gender"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">{t.register.male}</SelectItem>
                          <SelectItem value="Female">{t.register.female}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                }
                value={pasteText}
                onValueChange={setPasteText}
                placeholder={"Tafara Moyo\nRudo Chikwanha | Female\nTendai Ncube | M"}
                hint={t.register.pasteHint}
                toAdd={pasteReview.toAdd}
                keyOfRow={(r) => r.lineNumber}
                renderRow={(r) => (
                  <span className="flex items-center justify-between gap-2">
                    <span>{r.fullName}</span>
                    <span className="text-xs text-muted-foreground">{r.gender ?? pasteGender}</span>
                  </span>
                )}
                emptyMessage={t.register.pasteEmpty}
                duplicates={pasteReview.duplicates}
                skipped={pasteParsed.skipped}
                busy={pasteBusy}
                onConfirm={addPastedStudents}
                testIds={{
                  textarea: "textarea-paste-students",
                  preview: "paste-students-preview",
                  rowPrefix: "paste-student-row-",
                  duplicates: "paste-students-duplicates",
                  skipped: "paste-students-skipped",
                  confirm: "button-paste-students-confirm",
                  cancel: "button-paste-students-cancel",
                }}
              />

              <Button
                variant="outline"
                onClick={() => setIsBackfillOpen(true)}
                data-testid="button-link-cards"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Link cards
              </Button>

              <QrBackfillDialog
                open={isBackfillOpen}
                onOpenChange={setIsBackfillOpen}
                students={students}
                onSave={async (studentId, code) => {
                  // Only the card code is sent. studentId is deliberately not
                  // in this payload, so a backfill can never renumber a pupil.
                  try {
                    const res = await apiRequest("PUT", `/api/students/${studentId}`, { qrCode: code });
                    const data = await res.json();
                    return data.success ? null : (serverMessage(t, data, "Did not save"));
                  } catch {
                    return "Check your connection and try again.";
                  }
                }}
                onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/students"] })}
              />

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-student">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add student
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t.register.addStudent}</DialogTitle>
                    <DialogDescription>
                      Enter the student's details. They will create their password on first login.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{t.register.form}</Label>
                      <Select 
                        value={newStudent.form} 
                        onValueChange={(v) => setNewStudent({ ...newStudent, form: v as any })}
                      >
                        <SelectTrigger data-testid="select-student-form">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Stage 3">Stage 3</SelectItem>
                          <SelectItem value="Stage 4">Stage 4</SelectItem>
                          <SelectItem value="Stage 5">Stage 5</SelectItem>
                          <SelectItem value="Stage 6">Stage 6</SelectItem>
                          <SelectItem value="Form 1">Form 1</SelectItem>
                          <SelectItem value="Form 2">Form 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.register.studentId}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newStudent.studentId}
                          onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                          placeholder={t.register.studentIdPlaceholder}
                          data-testid="input-student-id"
                        />
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setNewStudent({ ...newStudent, studentId: generateStudentId() })}
                        >
                          Generate ID
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="input-student-qr">{t.register.qrCode}</Label>
                      <Input
                        id="input-student-qr"
                        value={newStudent.qrCode}
                        onChange={(e) => setNewStudent({ ...newStudent, qrCode: e.target.value.toUpperCase() })}
                        placeholder={t.register.qrCodePlaceholder}
                        data-testid="input-student-qr"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t.register.qrCodeNote}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.register.fullName}</Label>
                      <Input
                        value={newStudent.fullName}
                        onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                        placeholder={t.register.fullNamePlaceholder}
                        data-testid="input-student-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.register.gender}</Label>
                      <Select 
                        value={newStudent.gender} 
                        onValueChange={(v) => setNewStudent({ ...newStudent, gender: v as any })}
                      >
                        <SelectTrigger data-testid="select-student-gender">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">{t.register.male}</SelectItem>
                          <SelectItem value="Female">{t.register.female}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={() => createMutation.mutate(newStudent)}
                      disabled={!newStudent.studentId || !newStudent.fullName || createMutation.isPending}
                      data-testid="button-save-student"
                    >
                      {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add student
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Select value={filterForm} onValueChange={setFilterForm}>
                <SelectTrigger className="w-48" data-testid="select-filter-form">
                  <SelectValue placeholder={t.register.filterByForm} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.register.allStudents}</SelectItem>
                  <SelectItem value="Stage 3">Stage 3</SelectItem>
                  <SelectItem value="Stage 4">Stage 4</SelectItem>
                  <SelectItem value="Stage 5">Stage 5</SelectItem>
                  <SelectItem value="Stage 6">Stage 6</SelectItem>
                  <SelectItem value="Form 1">Form 1</SelectItem>
                  <SelectItem value="Form 2">Form 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <QueryError error={error} what={t.errors.thing.theRegister} onRetry={() => refetch()} data-testid="students-load-error" />
            ) : filteredStudents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t.register.noStudents}</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredStudents.map((student) => (
                  <div 
                    key={student.id} 
                    className="flex items-center justify-between p-4 rounded-md border"
                    data-testid={`student-row-${student.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-sm text-muted-foreground">{student.studentId}</p>
                      </div>
                      <Badge variant="outline">{student.form}</Badge>
                      <Badge variant="secondary">{student.gender}</Badge>
                      {student.password ? (
                        <Badge className="bg-green-500">{t.register.passwordSet}</Badge>
                      ) : (
                        <Badge variant="outline">{t.register.noPassword}</Badge>
                      )}
                      {parentFor(student.id) && (
                        <Badge variant="secondary" data-testid={`badge-parent-${student.id}`}>
                          Parent account
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* This child's weekly report, ready to send to a parent. */}
                      <Button
                        size="icon"
                        variant="ghost"
                        title={t.register.weeklyReport}
                        aria-label={t.register.weeklyReport}
                        onClick={() => {
                          setReportForStudent(student);
                          setReportWeek("last");
                        }}
                        data-testid={`button-weekly-report-${student.id}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      {/* Add (or review) this child's parent account. */}
                      <Button
                        size="icon"
                        variant="ghost"
                        title={parentFor(student.id) ? t.register.parentAccount : t.register.addParentAccount}
                        aria-label={parentFor(student.id) ? t.register.parentAccount : t.register.addParentAccount}
                        onClick={() => {
                          setParentForStudent(student);
                          setEditingParent(false);
                          setNewParent({ fullName: "", username: "", password: "" });
                        }}
                        data-testid={`button-add-parent-${student.id}`}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingStudent(student);
                          setIsEditDialogOpen(true);
                        }}
                        data-testid={`button-edit-${student.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => resetPasswordMutation.mutate(student.id)}
                        disabled={resetPasswordMutation.isPending}
                        data-testid={`button-reset-${student.id}`}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove ${student.fullName}? This will also delete their submissions.`)) {
                            deleteMutation.mutate(student.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${student.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* This child's weekly report, and the message to send to their parent.
            The figures shown here are the same ones the parent sees in their
            own portal — both come from the server's one report builder. */}
        <Dialog open={!!reportForStudent} onOpenChange={(open) => { if (!open) setReportForStudent(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t.register.weeklyReport}{reportForStudent ? ` — ${reportForStudent.fullName}` : ""}
              </DialogTitle>
              <DialogDescription>
                {reportData?.report
                  ? t.register.weekOf(reportData.report.week.label)
                  : t.register.copyAndSend}
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-1 rounded-md border p-1 w-fit">
              <Button
                size="sm"
                variant={reportWeek === "last" ? "secondary" : "ghost"}
                onClick={() => setReportWeek("last")}
                data-testid="button-report-week-last"
              >
                Last week
              </Button>
              <Button
                size="sm"
                variant={reportWeek === "this" ? "secondary" : "ghost"}
                onClick={() => setReportWeek("this")}
                data-testid="button-report-week-this"
              >
                This week
              </Button>
            </div>

            {reportLoading && (
              <div className="flex items-center gap-2 text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Building the report…
              </div>
            )}

            {reportError && (
              <p className="text-sm text-destructive py-6" data-testid="text-report-error">
                We could not build this report just now. Try again in a moment.
              </p>
            )}

            {reportData?.message && (
              <>
                {/* Shown exactly as it will arrive, so nothing is a surprise. */}
                <div
                  className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto"
                  data-testid="text-weekly-report-message"
                >
                  {reportData.message}
                </div>
                <DialogFooter>
                  <Button className="w-full" onClick={copyReport} data-testid="button-copy-weekly-report">
                    {reportCopied ? (
                      <><Check className="h-4 w-4 mr-2" />Copied</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-2" />{t.register.copyWhatsApp}</>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Add a parent account for one child.
            The child is fixed by the record this was opened from, and is sent
            in the address of the request — a teacher never picks the child on
            this form, and a parent can never change it afterwards. */}
        <Dialog open={!!parentForStudent} onOpenChange={(open) => { if (!open) { setParentForStudent(null); setEditingParent(false); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.register.parentAccount}</DialogTitle>
              <DialogDescription>
                {parentForStudent
                  ? `For ${parentForStudent.fullName} (${parentForStudent.form})`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            {parentForStudent && existingParent && !editingParent && (
              /* This child already has an account. One per child for now, so
                 what is already linked is shown instead of the add form, with
                 the two things a teacher can do to it: edit, or remove. */
              <div className="space-y-4 py-4">
                <div className="rounded-md border p-4 space-y-1">
                  <p className="text-sm text-muted-foreground">{t.register.parent}</p>
                  <p className="font-medium" data-testid="text-existing-parent-name">{existingParent.fullName}</p>
                  <p className="text-sm text-muted-foreground pt-2">{t.register.username}</p>
                  <p className="font-mono text-sm" data-testid="text-existing-parent-username">{existingParent.username}</p>
                  <p className="text-sm text-muted-foreground pt-2">{t.register.linkedTo}</p>
                  <p className="text-sm" data-testid="text-existing-parent-child">
                    {parentForStudent.fullName} ({parentForStudent.form})
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  This account can only ever see {parentForStudent.fullName}. To link the
                  parent to a different child, remove this account and add one on that
                  child's record.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // Start the form from what is saved, so a teacher changing
                    // one field does not have to retype the others. The
                    // password starts blank, meaning "leave it alone".
                    setParentEdits({
                      fullName: existingParent.fullName,
                      username: existingParent.username,
                      password: "",
                    });
                    setEditingParent(true);
                  }}
                  data-testid="button-edit-parent"
                >
                  Edit details
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-destructive"
                  onClick={() => {
                    if (confirm(`Remove the parent account for ${parentForStudent.fullName}? The pupil and their work are not affected.`)) {
                      deleteParentMutation.mutate(existingParent.id);
                    }
                  }}
                  disabled={deleteParentMutation.isPending}
                  data-testid="button-remove-parent"
                >
                  {deleteParentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Remove parent account
                </Button>
              </div>
            )}

            {parentForStudent && existingParent && editingParent && (
              /* Correcting the account. Note there is no way to change the
                 child here — that is fixed for the life of the account. */
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="input-edit-parent-name">{t.register.parentName}</Label>
                    <Input
                      id="input-edit-parent-name"
                      value={parentEdits.fullName}
                      onChange={(e) => setParentEdits({ ...parentEdits, fullName: e.target.value })}
                      data-testid="input-edit-parent-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-edit-parent-username">{t.register.username}</Label>
                    <Input
                      id="input-edit-parent-username"
                      value={parentEdits.username}
                      onChange={(e) => setParentEdits({ ...parentEdits, username: e.target.value.toLowerCase() })}
                      autoCapitalize="none"
                      autoCorrect="off"
                      data-testid="input-edit-parent-username"
                    />
                    <p className="text-xs text-muted-foreground">
                      No spaces. Changing this changes what the parent types to log in.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-edit-parent-password">{t.register.newPassword}</Label>
                    <Input
                      id="input-edit-parent-password"
                      value={parentEdits.password}
                      onChange={(e) => setParentEdits({ ...parentEdits, password: e.target.value })}
                      placeholder={t.register.newPasswordPlaceholder}
                      data-testid="input-edit-parent-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      Only fill this in to give the parent a new password.
                    </p>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">
                      Still linked to {parentForStudent.fullName}. Editing cannot move an
                      account to another child.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEditingParent(false)}
                    data-testid="button-cancel-edit-parent"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      updateParentMutation.mutate({ id: existingParent.id, data: parentEdits });
                    }}
                    disabled={updateParentMutation.isPending}
                    data-testid="button-save-parent"
                  >
                    {updateParentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save changes
                  </Button>
                </DialogFooter>
              </>
            )}

            {parentForStudent && !existingParent && (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="input-parent-name">{t.register.parentName}</Label>
                    <Input
                      id="input-parent-name"
                      value={newParent.fullName}
                      onChange={(e) => setNewParent({ ...newParent, fullName: e.target.value })}
                      placeholder={t.register.parentNamePlaceholder}
                      data-testid="input-parent-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-parent-username">{t.register.username}</Label>
                    <Input
                      id="input-parent-username"
                      value={newParent.username}
                      onChange={(e) => setNewParent({ ...newParent, username: e.target.value.toLowerCase() })}
                      placeholder={t.register.usernamePlaceholder}
                      autoCapitalize="none"
                      autoCorrect="off"
                      data-testid="input-parent-username"
                    />
                    <p className="text-xs text-muted-foreground">
                      No spaces. This is what the parent types to log in.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-parent-password">{t.register.password}</Label>
                    <Input
                      id="input-parent-password"
                      value={newParent.password}
                      onChange={(e) => setNewParent({ ...newParent, password: e.target.value })}
                      placeholder={t.register.passwordPlaceholder}
                      data-testid="input-parent-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      Write this down and give it to the parent — it is not shown again.
                    </p>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">
                      This account will only ever be able to see {parentForStudent.fullName}.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      createParentMutation.mutate({
                        studentId: parentForStudent.id,
                        data: newParent,
                      });
                    }}
                    disabled={createParentMutation.isPending}
                    data-testid="button-create-parent"
                  >
                    {createParentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create parent account
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.register.editStudent}</DialogTitle>
              <DialogDescription>
                Update the student's details
              </DialogDescription>
            </DialogHeader>
            {editingStudent && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t.register.studentId}</Label>
                  <Input
                    value={editingStudent.studentId}
                    onChange={(e) => setEditingStudent({ ...editingStudent, studentId: e.target.value })}
                    data-testid="input-edit-student-id"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-sm border p-3 cursor-pointer">
                  <Checkbox
                    checked={editingStudent.active !== false}
                    onCheckedChange={v =>
                      setEditingStudent({ ...editingStudent, active: v === true })
                    }
                    data-testid="checkbox-edit-student-active"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t.register.active}</span>
                    <span className="block text-xs text-muted-foreground">
                      An inactive pupil keeps their work and marks, but cannot log in and their
                      card stops working. Use this when a pupil leaves.
                    </span>
                  </span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="input-edit-student-qr">QR card code</Label>
                  <Input
                    id="input-edit-student-qr"
                    value={editingStudent.qrCode ?? ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, qrCode: e.target.value.toUpperCase() })}
                    placeholder={t.register.qrCodePlaceholder}
                    data-testid="input-edit-student-qr"
                  />
                  <p className="text-xs text-muted-foreground">
                    The ID on the attendance card, from the Master Student Database.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t.register.fullName}</Label>
                  <Input
                    value={editingStudent.fullName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                    data-testid="input-edit-student-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.register.form}</Label>
                  <Select 
                    value={editingStudent.form} 
                    onValueChange={(v) => setEditingStudent({ ...editingStudent, form: v })}
                  >
                    <SelectTrigger data-testid="select-edit-form">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Stage 3">Stage 3</SelectItem>
                      <SelectItem value="Stage 4">Stage 4</SelectItem>
                      <SelectItem value="Stage 5">Stage 5</SelectItem>
                      <SelectItem value="Stage 6">Stage 6</SelectItem>
                      <SelectItem value="Form 1">Form 1</SelectItem>
                      <SelectItem value="Form 2">Form 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.register.gender}</Label>
                  <Select 
                    value={editingStudent.gender} 
                    onValueChange={(v) => setEditingStudent({ ...editingStudent, gender: v })}
                  >
                    <SelectTrigger data-testid="select-edit-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">{t.register.male}</SelectItem>
                      <SelectItem value="Female">{t.register.female}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button 
                onClick={() => {
                  if (editingStudent) {
                    updateMutation.mutate({
                      id: editingStudent.id,
                      data: {
                        studentId: editingStudent.studentId,
                        // Blank means "no card", which the column stores as null.
                        qrCode: editingStudent.qrCode?.trim() || null,
                        active: editingStudent.active !== false,
                        fullName: editingStudent.fullName,
                        form: editingStudent.form,
                        gender: editingStudent.gender,
                      }
                    });
                  }
                }}
                disabled={updateMutation.isPending}
                data-testid="button-update-student"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
