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
import { ArrowLeft, PlusCircle, Trash2, Loader2, Save, X, Image, Users, Circle, CheckCircle2 } from "lucide-react";
import logoPath from "@assets/image_1769457206059.png";
import { SimpleUploader } from "@/components/SimpleUploader";
import { FileAttachmentZone } from "@/components/FileAttachmentZone";
import type { AttachmentFile } from "@/components/FileAttachmentZone";
import type { Student } from "@shared/schema";

// The question types a teacher can choose. "written" is marked by hand (the
// original behaviour); the other four are marked automatically in code.
const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "numeric", label: "Number" },
  { value: "short_text", label: "Short text" },
  { value: "written", label: "Written (marked by hand)" },
] as const;

const questionSchema = z.object({
  questionText: z.string().min(1, "Question text is required"),
  maxScore: z.number().min(1, "Score must be at least 1"),
  imageUrls: z.array(z.string()).optional(),
  // Auto-marking answer key (see shared/auto-marking.ts). All optional here;
  // completeness is checked in onSubmit with friendly messages.
  type: z.enum(["written", "multiple_choice", "true_false", "numeric", "short_text"]),
  options: z.array(z.string()).optional(),
  correctOption: z.number().optional(),
  correctBool: z.boolean().optional(),
  correctNumber: z.number().optional(),
  tolerance: z.number().optional(),
  acceptedAnswers: z.array(z.string()).optional(),
  explanation: z.string().optional(),
});

// A fresh question starts as multiple choice with two blank options, so the
// auto-marking path is the default and easy to discover.
const BLANK_QUESTION = {
  questionText: "",
  maxScore: 10,
  imageUrls: [] as string[],
  type: "multiple_choice" as const,
  options: ["", ""],
  correctOption: 0,
  correctBool: true,
  correctNumber: undefined as number | undefined,
  tolerance: undefined as number | undefined,
  acceptedAnswers: [""],
  explanation: "",
};

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
      questions: [{ ...BLANK_QUESTION }],
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

  // --- Auto-marking answer-key helpers ---
  // Small helper: merge some changes into one question and refresh the field.
  const patchQuestion = (index: number, patch: Record<string, unknown>) => {
    const current = formMethods.getValues(`questions.${index}`);
    update(index, { ...current, ...patch });
  };

  // Change a question's type, filling in sensible defaults for the new type.
  const changeQuestionType = (index: number, type: string) => {
    const q = formMethods.getValues(`questions.${index}`);
    patchQuestion(index, {
      type,
      options: type === "multiple_choice" ? (q.options?.length ? q.options : ["", ""]) : q.options,
      correctOption: type === "multiple_choice" ? (q.correctOption ?? 0) : q.correctOption,
      correctBool: type === "true_false" ? (q.correctBool ?? true) : q.correctBool,
      acceptedAnswers: type === "short_text" ? (q.acceptedAnswers?.length ? q.acceptedAnswers : [""]) : q.acceptedAnswers,
    });
  };

  // Multiple-choice option helpers.
  const addOption = (index: number) => {
    const q = formMethods.getValues(`questions.${index}`);
    patchQuestion(index, { options: [...(q.options || []), ""] });
  };
  const setOption = (index: number, optIndex: number, value: string) => {
    const q = formMethods.getValues(`questions.${index}`);
    const options = [...(q.options || [])];
    options[optIndex] = value;
    patchQuestion(index, { options });
  };
  const removeOption = (index: number, optIndex: number) => {
    const q = formMethods.getValues(`questions.${index}`);
    const options = [...(q.options || [])];
    options.splice(optIndex, 1);
    // Keep the "correct" pointer valid after removing an option.
    let correctOption = q.correctOption ?? 0;
    if (correctOption >= options.length) correctOption = Math.max(0, options.length - 1);
    patchQuestion(index, { options, correctOption });
  };

  // Short-text accepted-answer helpers.
  const addAccepted = (index: number) => {
    const q = formMethods.getValues(`questions.${index}`);
    patchQuestion(index, { acceptedAnswers: [...(q.acceptedAnswers || []), ""] });
  };
  const setAccepted = (index: number, ansIndex: number, value: string) => {
    const q = formMethods.getValues(`questions.${index}`);
    const acceptedAnswers = [...(q.acceptedAnswers || [])];
    acceptedAnswers[ansIndex] = value;
    patchQuestion(index, { acceptedAnswers });
  };
  const removeAccepted = (index: number, ansIndex: number) => {
    const q = formMethods.getValues(`questions.${index}`);
    const acceptedAnswers = [...(q.acceptedAnswers || [])];
    acceptedAnswers.splice(ansIndex, 1);
    patchQuestion(index, { acceptedAnswers });
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

    // Check every auto-marked question has a complete answer key, and build a
    // clean payload that only keeps the fields relevant to each type.
    const cleanedQuestions = [];
    for (let i = 0; i < values.questions.length; i++) {
      const q = values.questions[i];
      const base = {
        id: `q${i + 1}`,
        questionText: q.questionText,
        maxScore: q.maxScore,
        imageUrls: q.imageUrls || [],
        type: q.type,
        explanation: q.explanation?.trim() || undefined,
      };
      const fail = (msg: string) => {
        toast({ title: `Question ${i + 1}`, description: msg, variant: "destructive" });
      };

      if (q.type === "multiple_choice") {
        const options = (q.options || []).map(o => o.trim()).filter(o => o !== "");
        if (options.length < 2) { fail("Add at least two options."); return; }
        if (q.correctOption == null || q.correctOption >= (q.options || []).length) {
          fail("Choose which option is correct."); return;
        }
        // Re-point "correct" in case blank options were trimmed out.
        const correctText = (q.options || [])[q.correctOption];
        const correctOption = Math.max(0, options.indexOf(correctText.trim()));
        cleanedQuestions.push({ ...base, options, correctOption });
      } else if (q.type === "true_false") {
        cleanedQuestions.push({ ...base, correctBool: q.correctBool ?? true });
      } else if (q.type === "numeric") {
        if (q.correctNumber == null || Number.isNaN(q.correctNumber)) {
          fail("Enter the correct number."); return;
        }
        cleanedQuestions.push({ ...base, correctNumber: q.correctNumber, tolerance: q.tolerance ?? 0 });
      } else if (q.type === "short_text") {
        const acceptedAnswers = (q.acceptedAnswers || []).map(a => a.trim()).filter(a => a !== "");
        if (acceptedAnswers.length === 0) { fail("Add at least one accepted answer."); return; }
        cleanedQuestions.push({ ...base, acceptedAnswers });
      } else {
        // written: marked by hand, no answer key
        cleanedQuestions.push(base);
      }
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/assignments", {
        ...values,
        questions: cleanedQuestions,
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
                      onClick={() => append({ ...BLANK_QUESTION })}
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
                        <div className="grid gap-4 sm:grid-cols-2">
                          {/* Pick how this question is answered and marked */}
                          <FormItem>
                            <FormLabel>Answer Type</FormLabel>
                            <Select
                              value={formMethods.watch(`questions.${index}.type`)}
                              onValueChange={(val) => changeQuestionType(index, val)}
                            >
                              <SelectTrigger data-testid={`select-qtype-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {QUESTION_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>

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

                        {/* Answer key — the fields shown depend on the type above */}
                        {(() => {
                          const qType = formMethods.watch(`questions.${index}.type`);

                          if (qType === "written") {
                            return (
                              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                                This question will be marked by hand. Auto-marking is off for it.
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3 rounded-md border-l-4 border-primary bg-primary/5 p-3">
                              <p className="text-sm font-semibold text-primary">Answer Key (used for instant marking)</p>

                              {qType === "multiple_choice" && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground">Add the options and tap the circle to mark the correct one.</p>
                                  {(formMethods.watch(`questions.${index}.options`) || []).map((opt, optIdx) => {
                                    const correct = formMethods.watch(`questions.${index}.correctOption`);
                                    const options = formMethods.watch(`questions.${index}.options`) || [];
                                    return (
                                      <div key={optIdx} className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => patchQuestion(index, { correctOption: optIdx })}
                                          className="shrink-0"
                                          title="Mark as correct"
                                          data-testid={`radio-correct-${index}-${optIdx}`}
                                        >
                                          {correct === optIdx
                                            ? <CheckCircle2 className="h-5 w-5 text-primary" />
                                            : <Circle className="h-5 w-5 text-muted-foreground" />}
                                        </button>
                                        <Input
                                          value={opt}
                                          placeholder={`Option ${optIdx + 1}`}
                                          onChange={(e) => setOption(index, optIdx, e.target.value)}
                                          data-testid={`input-option-${index}-${optIdx}`}
                                        />
                                        {options.length > 2 && (
                                          <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index, optIdx)}>
                                            <X className="h-4 w-4 text-destructive" />
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <Button type="button" variant="outline" size="sm" onClick={() => addOption(index)}>
                                    <PlusCircle className="h-4 w-4 mr-2" /> Add Option
                                  </Button>
                                </div>
                              )}

                              {qType === "true_false" && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">Correct answer:</span>
                                  {[true, false].map((val) => {
                                    const correct = formMethods.watch(`questions.${index}.correctBool`);
                                    return (
                                      <Button
                                        key={String(val)}
                                        type="button"
                                        variant={correct === val ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => patchQuestion(index, { correctBool: val })}
                                        data-testid={`button-tf-${index}-${val}`}
                                      >
                                        {val ? "True" : "False"}
                                      </Button>
                                    );
                                  })}
                                </div>
                              )}

                              {qType === "numeric" && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <FormLabel className="text-sm">Correct number</FormLabel>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={formMethods.watch(`questions.${index}.correctNumber`) ?? ""}
                                      onChange={(e) => patchQuestion(index, { correctNumber: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                                      placeholder="e.g. 3.14"
                                      data-testid={`input-correctnumber-${index}`}
                                    />
                                  </div>
                                  <div>
                                    <FormLabel className="text-sm">Tolerance (±)</FormLabel>
                                    <Input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={formMethods.watch(`questions.${index}.tolerance`) ?? ""}
                                      onChange={(e) => patchQuestion(index, { tolerance: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                                      placeholder="e.g. 0.05 (0 = exact)"
                                      data-testid={`input-tolerance-${index}`}
                                    />
                                  </div>
                                </div>
                              )}

                              {qType === "short_text" && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground">Any of these count as correct. Matching ignores capital letters and extra spaces.</p>
                                  {(formMethods.watch(`questions.${index}.acceptedAnswers`) || []).map((ans, ansIdx) => {
                                    const accepted = formMethods.watch(`questions.${index}.acceptedAnswers`) || [];
                                    return (
                                      <div key={ansIdx} className="flex items-center gap-2">
                                        <Input
                                          value={ans}
                                          placeholder={`Accepted answer ${ansIdx + 1}`}
                                          onChange={(e) => setAccepted(index, ansIdx, e.target.value)}
                                          data-testid={`input-accepted-${index}-${ansIdx}`}
                                        />
                                        {accepted.length > 1 && (
                                          <Button type="button" variant="ghost" size="icon" onClick={() => removeAccepted(index, ansIdx)}>
                                            <X className="h-4 w-4 text-destructive" />
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <Button type="button" variant="outline" size="sm" onClick={() => addAccepted(index)}>
                                    <PlusCircle className="h-4 w-4 mr-2" /> Add Accepted Answer
                                  </Button>
                                </div>
                              )}

                              {/* Optional one-line note shown to students with the correct answer */}
                              <div>
                                <FormLabel className="text-sm">Explanation (optional)</FormLabel>
                                <Input
                                  value={formMethods.watch(`questions.${index}.explanation`) ?? ""}
                                  onChange={(e) => patchQuestion(index, { explanation: e.target.value })}
                                  placeholder="A one-line note shown with the correct answer"
                                  data-testid={`input-explanation-${index}`}
                                />
                              </div>
                            </div>
                          );
                        })()}
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
