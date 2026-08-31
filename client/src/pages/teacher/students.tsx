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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, PlusCircle, Pencil, Trash2, KeyRound, Loader2, Users, ClipboardPaste } from "lucide-react";
import logoPath from "@assets/logo.webp";
import type { Student } from "@shared/schema";

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

export function parsePastedStudents(raw: string): ParsedStudents {
  const rows: ParsedStudentLine[] = [];
  const skipped: SkippedLine[] = [];

  for (const line of splitPastedLines(raw)) {
    const fullName = line.parts[0] ?? "";
    const genderRaw = (line.parts[1] ?? "").toLowerCase();

    if (fullName === "") {
      skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: "No name" });
      continue;
    }

    let gender: "Male" | "Female" | null = null;
    if (genderRaw !== "") {
      if (genderRaw === "m" || genderRaw === "male") gender = "Male";
      else if (genderRaw === "f" || genderRaw === "female") gender = "Female";
      else {
        skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: 'Gender should be "Male" or "Female"' });
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
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [filterForm, setFilterForm] = useState<string>("all");
  
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    fullName: "",
    gender: "Male" as "Male" | "Female",
    form: "Form 1" as "Stage 3" | "Stage 4" | "Stage 5" | "Stage 6" | "Form 1" | "Form 2",
  });

  // Bulk paste: the dialog, the pasted list, and the settings applied to the
  // whole batch. `pasteBusy` blocks a second click while pupils are being added.
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

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newStudent) => {
      const response = await apiRequest("POST", "/api/students", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/students"] });
        toast({ title: "Student added successfully!" });
        setIsAddDialogOpen(false);
        setNewStudent({ studentId: "", fullName: "", gender: "Male", form: "Form 1" });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
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
        toast({ title: "Student updated successfully!" });
        setIsEditDialogOpen(false);
        setEditingStudent(null);
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
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
      toast({ title: "Student removed successfully!" });
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
        toast({ title: "Password reset!", description: "Student will set a new password on next login." });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

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
  const pasteParsed = parsePastedStudents(pasteText);
  const pasteReview = separateDuplicates(pasteParsed.rows, {
    keyOf: r => r.fullName,
    labelOf: r => r.fullName,
    lineNumberOf: r => r.lineNumber,
    existingKeys: new Set(students.map(s => s.fullName.trim().toLowerCase())),
    existingReason: "Already on the register",
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

  if (!teacher) return null;

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
                Paste students
              </Button>
              <BulkPasteDialog
                open={isPasteDialogOpen}
                onOpenChange={setIsPasteDialogOpen}
                title="Paste students"
                description="One pupil per line. They all join the class you pick here. Anyone already on the register is skipped."
                noun={{ one: "student", many: "students" }}
                countSuffix={`to ${pasteForm}`}
                settings={
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Class</Label>
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
                      <Label>Gender if not given</Label>
                      <Select value={pasteGender} onValueChange={(v) => setPasteGender(v as "Male" | "Female")}>
                        <SelectTrigger data-testid="select-paste-gender"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                }
                value={pasteText}
                onValueChange={setPasteText}
                placeholder={"Tafara Moyo\nRudo Chikwanha | Female\nTendai Ncube | M"}
                hint="Add “| Female” or “| Male” after a name to set that pupil's gender. Student IDs are given out automatically."
                toAdd={pasteReview.toAdd}
                keyOfRow={(r) => r.lineNumber}
                renderRow={(r) => (
                  <span className="flex items-center justify-between gap-2">
                    <span>{r.fullName}</span>
                    <span className="text-xs text-muted-foreground">{r.gender ?? pasteGender}</span>
                  </span>
                )}
                emptyMessage="Nobody new to add — every name here is already on the register."
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

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-student">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Student</DialogTitle>
                    <DialogDescription>
                      Enter the student's details. They will create their password on first login.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Form</Label>
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
                      <Label>Student ID</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newStudent.studentId}
                          onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                          placeholder="e.g., F1-005"
                          data-testid="input-student-id"
                        />
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setNewStudent({ ...newStudent, studentId: generateStudentId() })}
                        >
                          Auto
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        value={newStudent.fullName}
                        onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                        placeholder="Enter full name"
                        data-testid="input-student-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select 
                        value={newStudent.gender} 
                        onValueChange={(v) => setNewStudent({ ...newStudent, gender: v as any })}
                      >
                        <SelectTrigger data-testid="select-student-gender">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
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
                      Add Student
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
                  <SelectValue placeholder="Filter by form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
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
            ) : filteredStudents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No students found</p>
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
                        <Badge className="bg-green-500">Password Set</Badge>
                      ) : (
                        <Badge variant="outline">No Password</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
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

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>
                Update the student's details
              </DialogDescription>
            </DialogHeader>
            {editingStudent && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Student ID</Label>
                  <Input
                    value={editingStudent.studentId}
                    onChange={(e) => setEditingStudent({ ...editingStudent, studentId: e.target.value })}
                    data-testid="input-edit-student-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editingStudent.fullName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                    data-testid="input-edit-student-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Form</Label>
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
                  <Label>Gender</Label>
                  <Select 
                    value={editingStudent.gender} 
                    onValueChange={(v) => setEditingStudent({ ...editingStudent, gender: v })}
                  >
                    <SelectTrigger data-testid="select-edit-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
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
