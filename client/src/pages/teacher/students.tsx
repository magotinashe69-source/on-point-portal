import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, PlusCircle, Pencil, Trash2, KeyRound, Loader2, Users } from "lucide-react";
import logoPath from "@assets/image_1769457206059.png";
import type { Student } from "@shared/schema";

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
    const formMap: Record<string, string> = { "Stage 3": "S3", "Stage 4": "S4", "Stage 5": "S5", "Stage 6": "S6", "Form 1": "F1", "Form 2": "F2" };
    const form = formMap[newStudent.form] || "F1";
    const formStudents = students.filter(s => s.form === newStudent.form);
    const nextNum = formStudents.length + 1;
    return `${form}-${String(nextNum).padStart(3, '0')}`;
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
