import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Save, X, Image, Users } from "lucide-react";
import logoPath from "@assets/image_1769457206059.png";
import { SimpleUploader } from "@/components/SimpleUploader";
import { FileAttachmentZone } from "@/components/FileAttachmentZone";
import type { AttachmentFile } from "@/components/FileAttachmentZone";
import type { Student } from "@shared/schema";

const questionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  maxScore: z.number().min(1, "Score must be at least 1"),
  imageUrls: z.array(z.string()).optional(),
});

const createAssignmentSchema = z.object({
  subject: z.enum(["MATHS", "ENGLISH", "SCIENCE", "PHYSICS", "CHEMISTRY", "BIOLOGY", "ECONOMICS", "BUSINESS_STUDIES", "GEOGRAPHY", "COMPUTER_SCIENCE", "HISTORY", "ACCOUNTING"]),
  topic: z.string().optional(),
  form: z.string().min(1, "Form is required"),
  title: z.string().min(1, "Title is required"),
  instructions: z.string().min(1, "Instructions are required"),
  dueDate: z.string().min(1, "Due date is required"),
  questions: z.array(questionSchema).min(1, "At least one question is required"),
});

type CreateAssignmentForm = z.infer<typeof createAssignmentSchema>;

export default function CreateAssignment() {
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [assignToAll, setAssignToAll] = useState(true);

  const formMethods = useForm<CreateAssignmentForm>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      subject: "MATHS",
      topic: "",
      form: "Form 1",
      title: "",
      instructions: "",
      dueDate: "",
      questions: [{ questionText: "", maxScore: 10, imageUrls: [] }],
    },
  });

  // Fetch students based on selected form
  const selectedForm = formMethods.watch("form");
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students", { form: selectedForm }],
    enabled: !!selectedForm,
  });

  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  // Reset selected students when form changes
  useEffect(() => {
    setSelectedStudentIds([]);
    setAssignToAll(true);
  }, [selectedForm]);

  const { fields, append, remove, update } = useFieldArray({
    control: formMethods.control,
    name: "questions",
  });

  const totalMarks = formMethods.watch("questions").reduce((sum, q) => sum + (q.maxScore || 0), 0);

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleQuestionImageUpload = (questionIndex: number, url: string) => {
    const currentQuestion = formMethods.getValues(`questions.${questionIndex}`);
    const currentImages = currentQuestion.imageUrls || [];
    update(questionIndex, {
      ...currentQuestion,
      imageUrls: [...currentImages, url],
    });
  };

  const removeQuestionImage = (questionIndex: number, imageIndex: number) => {
    const currentQuestion = formMethods.getValues(`questions.${questionIndex}`);
    const newImages = [...(currentQuestion.imageUrls || [])];
    newImages.splice(imageIndex, 1);
    update(questionIndex, {
      ...currentQuestion,
      imageUrls: newImages,
    });
  };

  async function onSubmit(values: CreateAssignmentForm) {
    if (!teacher) return;
    
    // Validate student selection
    if (!assignToAll && selectedStudentIds.length === 0) {
      toast({
        title: "No students selected",
        description: "Please select at least one student or assign to all students.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/assignments", {
        ...values,
        questions: values.questions.map((q, i) => ({
          id: `q${i + 1}`,
          ...q,
        })),
        attachments,
        totalMarks,
        targetStudentIds: assignToAll ? [] : selectedStudentIds,
        createdById: teacher.id,
      });
      
      const data = await response.json();
      
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
        toast({
          title: "Assignment created!",
          description: "Your assignment has been created successfully.",
        });
        setLocation("/teacher/dashboard");
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to create assignment",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

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

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Assignment</CardTitle>
            <CardDescription>
              Create an assignment with questions for your students. You can add images to questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...formMethods}>
              <form onSubmit={formMethods.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={formMethods.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-subject">
                              <SelectValue placeholder="Select subject" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MATHS">Maths</SelectItem>
                            <SelectItem value="ENGLISH">English</SelectItem>
                            <SelectItem value="SCIENCE">Science</SelectItem>
                            <SelectItem value="PHYSICS">Physics</SelectItem>
                            <SelectItem value="CHEMISTRY">Chemistry</SelectItem>
                            <SelectItem value="BIOLOGY">Biology</SelectItem>
                            <SelectItem value="ECONOMICS">Economics</SelectItem>
                            <SelectItem value="BUSINESS_STUDIES">Business Studies</SelectItem>
                            <SelectItem value="GEOGRAPHY">Geography</SelectItem>
                            <SelectItem value="COMPUTER_SCIENCE">Computer Science</SelectItem>
                            <SelectItem value="HISTORY">History</SelectItem>
                            <SelectItem value="ACCOUNTING">Accounting</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={formMethods.control}
                    name="form"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Form</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-form">
                              <SelectValue placeholder="Select form" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Stage 3">Stage 3</SelectItem>
                            <SelectItem value="Stage 4">Stage 4</SelectItem>
                            <SelectItem value="Stage 5">Stage 5</SelectItem>
                            <SelectItem value="Stage 6">Stage 6</SelectItem>
                            <SelectItem value="Form 1">Form 1</SelectItem>
                            <SelectItem value="Form 2">Form 2</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={formMethods.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., Algebra, Photosynthesis, World War II"
                          data-testid="input-topic"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formMethods.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Week 1 Maths Homework" 
                          data-testid="input-title"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formMethods.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide instructions for students..." 
                          className="min-h-[100px]"
                          data-testid="textarea-instructions"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formMethods.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          data-testid="input-duedate"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Student Assignment Section */}
                <div className="space-y-4 p-4 border rounded-md">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Assign To</h3>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="assignToAll" 
                      checked={assignToAll}
                      onCheckedChange={(checked) => {
                        setAssignToAll(checked === true);
                        if (checked) {
                          setSelectedStudentIds([]);
                        }
                      }}
                      data-testid="checkbox-assign-all"
                    />
                    <label 
                      htmlFor="assignToAll"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      All {selectedForm} Students
                    </label>
                  </div>

                  {!assignToAll && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Select specific students for tailored homework:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md bg-muted/30">
                        {students.map((student) => (
                          <div key={student.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`student-${student.id}`}
                              checked={selectedStudentIds.includes(student.id)}
                              onCheckedChange={() => toggleStudentSelection(student.id)}
                              data-testid={`checkbox-student-${student.id}`}
                            />
                            <label
                              htmlFor={`student-${student.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {student.fullName}
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedStudentIds.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {selectedStudentIds.length} student(s)
                        </p>
                      )}
                      {selectedStudentIds.length === 0 && (
                        <p className="text-sm text-destructive">
                          Please select at least one student
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold">Questions</h3>
                      <p className="text-sm text-muted-foreground">Total Marks: {totalMarks}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ questionText: "", maxScore: 10, imageUrls: [] })}
                      data-testid="button-add-question"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <Card key={field.id} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-medium">Question {index + 1}</span>
                          <div className="flex items-center gap-2">
                            <SimpleUploader
                              onUpload={(url) => handleQuestionImageUpload(index, url)}
                              accept="image/*"
                              label="Add Image"
                            />
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                data-testid={`button-remove-question-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {formMethods.watch(`questions.${index}.imageUrls`)?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {formMethods.watch(`questions.${index}.imageUrls`)?.map((url, imgIdx) => (
                              <div key={imgIdx} className="relative group">
                                <img 
                                  src={url} 
                                  alt={`Question ${index + 1} image ${imgIdx + 1}`} 
                                  className="h-20 w-20 object-cover rounded-md border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeQuestionImage(index, imgIdx)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <FormField
                          control={formMethods.control}
                          name={`questions.${index}.questionText`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Question Text</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Enter your question..." 
                                  data-testid={`textarea-question-${index}`}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={formMethods.control}
                          name={`questions.${index}.maxScore`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Score</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  data-testid={`input-maxscore-${index}`}
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Attachments (optional)</h3>
                  <p className="text-sm text-muted-foreground">Upload reference materials for students — images, PDFs, Word documents</p>
                  <FileAttachmentZone
                    attachments={attachments}
                    onChange={setAttachments}
                    label="Upload Reference Files"
                    hint="Images (JPG, PNG), PDFs, Word documents, text files"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-create"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Create Assignment
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
