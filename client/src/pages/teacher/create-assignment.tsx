import { useState, useEffect, useRef } from "react";
import { useLocation, Link, useParams } from "wouter";
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
import { BulkPasteDialog } from "@/components/BulkPasteDialog";
import { splitPastedLines, type SkippedLine } from "@/lib/bulk-paste";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Save, X, Image, Users, Circle, CheckCircle2, ChevronUp, ChevronDown, RefreshCw, FileClock, ClipboardPaste, Copy, AlertTriangle } from "lucide-react";
import logoPath from "@assets/logo.webp";
import { SimpleUploader } from "@/components/SimpleUploader";
import { FileAttachmentZone } from "@/components/FileAttachmentZone";
import type { AttachmentFile } from "@/components/FileAttachmentZone";
import type { Student, Assignment, Submission } from "@shared/schema";

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
  // Stable question id, preserved across edits so existing marks stay linked to
  // the right question. Named `qid` (not `id`) to avoid clashing with
  // react-hook-form's internal field key. New questions get a fresh one.
  qid: z.string().optional(),
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

// A short unique id for a brand-new question.
const newQid = () => "q_" + Math.random().toString(36).slice(2, 10);

// A fresh question starts as Short text worth 1 mark — the quickest kind to
// write (type the question, type the answer) and still marked automatically.
// The other types are one tap away in the Answer Type box. Each call gets its
// own unique qid.
const newQuestion = () => ({
  qid: newQid(),
  questionText: "",
  maxScore: 1, // new questions start at 1 mark; the teacher can type any value
  imageUrls: [] as string[],
  type: "short_text" as const,
  options: ["", ""],
  correctOption: 0,
  correctBool: true,
  correctNumber: undefined as number | undefined,
  tolerance: undefined as number | undefined,
  acceptedAnswers: [""],
  explanation: "",
});

// --- Bulk paste ---------------------------------------------------------
// Teachers often already have their questions typed out somewhere. Each line is
// a question and its answer(s):
//
//   What is the capital of Zimbabwe? | Harare
//
// Anything after a further separator counts as another acceptable answer, so
// "2 + 2 = ? | 4 | four" marks both as correct. The line splitting itself is
// shared with the other paste dialogs (see lib/bulk-paste).
export interface ParsedPasteLine {
  lineNumber: number;
  text: string;
  questionText: string;
  answers: string[];
}

export interface ParsedPaste {
  questions: ParsedPasteLine[];
  skipped: SkippedLine[];
}

export function parsePastedQuestions(raw: string): ParsedPaste {
  const questions: ParsedPasteLine[] = [];
  const skipped: SkippedLine[] = [];

  for (const line of splitPastedLines(raw)) {
    const questionText = line.parts[0] ?? "";
    const answers = line.parts.slice(1).filter(a => a !== "");

    if (questionText === "") {
      skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: "No question text" });
      continue;
    }
    if (answers.length === 0) {
      skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: 'No answer — put it after a "|"' });
      continue;
    }
    questions.push({ lineNumber: line.lineNumber, text: line.text, questionText, answers });
  }

  return { questions, skipped };
}

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
  const [remarkingQid, setRemarkingQid] = useState<string | null>(null);
  // Bulk paste: whether the dialog is open, and the text pasted into it.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  // When set, the effect below scrolls to that question's text box and focuses
  // it — so after "Add question" the teacher can type immediately.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const formMethods = useForm<CreateAssignmentForm>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      subject: "MATHS",
      topic: "",
      form: "Form 1",
      title: "",
      instructions: "",
      dueDate: "",
      questions: [newQuestion()],
    },
  });

  // Edit mode: /teacher/assignments/:id/edit reuses this form to edit an
  // existing assignment. No :id = the normal "create" flow.
  const params = useParams<{ id?: string }>();
  const editId = params.id ? parseInt(params.id) : null;
  const isEdit = editId != null;
  const prefilledRef = useRef(false);
  const lastFormRef = useRef<string>("Form 1");

  // Fetch students based on selected form
  const selectedForm = formMethods.watch("form");
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students", { form: selectedForm }],
    enabled: !!selectedForm,
  });

  // In edit mode, load the assignment (to pre-fill) and its submissions (for the
  // "already handed in" notice and the per-question re-mark actions).
  const { data: editAssignment } = useQuery<Assignment>({
    queryKey: ["/api/assignments", editId],
    enabled: isEdit,
  });
  // True when the assignment being edited hasn't been published yet.
  const isEditingDraft = editAssignment?.published === false;

  const { data: editSubmissions = [] } = useQuery<Submission[]>({
    queryKey: ["/api/submissions", { assignmentId: editId }],
    enabled: isEdit,
  });
  const submissionCount = editSubmissions.length;

  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  // Clear the selected students only when the teacher actively switches class —
  // NOT on mount or during the edit pre-fill (which would wipe the assignment's
  // targeting).
  useEffect(() => {
    if (lastFormRef.current === selectedForm) return;
    lastFormRef.current = selectedForm;
    setSelectedStudentIds([]);
    setAssignToAll(true);
  }, [selectedForm]);

  const { fields, append, remove, move, insert } = useFieldArray({
    control: formMethods.control,
    name: "questions",
  });

  // Pre-fill the form once the assignment being edited has loaded (only once).
  useEffect(() => {
    if (!editAssignment || prefilledRef.current) return;
    const a = editAssignment;
    lastFormRef.current = a.form; // so the class-change effect doesn't clear targeting
    formMethods.reset({
      subject: a.subject as any,
      topic: a.topic || "",
      form: a.form,
      title: a.title,
      instructions: a.instructions,
      dueDate: a.dueDate ? new Date(a.dueDate).toISOString().split("T")[0] : "",
      questions: (a.questions || []).map((q: any) => ({
        qid: q.id,
        questionText: q.questionText,
        maxScore: q.maxScore,
        imageUrls: q.imageUrls || [],
        type: q.type || "written",
        options: q.options && q.options.length ? q.options : ["", ""],
        correctOption: q.correctOption ?? 0,
        correctBool: q.correctBool ?? true,
        correctNumber: q.correctNumber,
        tolerance: q.tolerance,
        acceptedAnswers: q.acceptedAnswers && q.acceptedAnswers.length ? q.acceptedAnswers : [""],
        explanation: q.explanation || "",
      })),
    });
    const targets = ((a.targetStudentIds as number[] | null) || []);
    if (targets.length > 0) { setAssignToAll(false); setSelectedStudentIds(targets); }
    else { setAssignToAll(true); setSelectedStudentIds([]); }
    setAttachments((((a.attachments as any[]) || []).map((att) => ({ ...att }))) as AttachmentFile[]);
    prefilledRef.current = true;
  }, [editAssignment]);

  // Add a new question, then scroll to it and focus its text box so the teacher
  // can keep typing without scrolling or clicking. Used by both add buttons.
  const addQuestionAndFocus = () => {
    const newIndex = fields.length;
    append(newQuestion());
    setFocusIndex(newIndex);
  };

  // Copy a question's settings into a new one right below it. Everything is
  // carried over — type, marks, options, accepted answers, explanation — except
  // the wording, which is left blank and focused so only the text has to change.
  const duplicateQuestion = (index: number) => {
    const q = formMethods.getValues(`questions.${index}`);
    insert(index + 1, {
      ...q,
      qid: newQid(),            // a new question, not the same one twice
      questionText: "",         // the one thing the teacher still types
      options: [...(q.options || [])],
      acceptedAnswers: [...(q.acceptedAnswers || [])],
      imageUrls: [],            // images belong to the question they were added to
    });
    setFocusIndex(index + 1);
  };

  // What the pasted box currently works out to. Recomputed as they type, so the
  // preview below the box is always what would actually be added.
  const pastePreview = parsePastedQuestions(pasteText);

  // Turn the preview into real questions. Each pasted line becomes a Short text
  // question worth 1 mark, with its answers as the answer key.
  const addPastedQuestions = () => {
    const parsed = pastePreview.questions;
    if (parsed.length === 0) return;

    const built = parsed.map(p => ({
      ...newQuestion(),
      qid: newQid(),
      questionText: p.questionText,
      type: "short_text" as const,
      maxScore: 1,
      acceptedAnswers: p.answers,
    }));

    // If the only question so far is the untouched blank one the form starts
    // with, replace it rather than leaving an empty card above the pasted set.
    const existing = formMethods.getValues("questions") || [];
    const onlyBlankStarter =
      existing.length === 1 && !existing[0]?.questionText?.trim();

    const firstNewIndex = onlyBlankStarter ? 0 : existing.length;
    append(built);
    if (onlyBlankStarter) remove(0);

    setPasteOpen(false);
    setPasteText("");
    toast({
      title: `Added ${built.length} question${built.length === 1 ? "" : "s"}`,
      description: "Each one is Short text, 1 mark, with its answer key filled in.",
    });
    setFocusIndex(firstNewIndex);
  };

  useEffect(() => {
    if (focusIndex === null) return;
    // Wait a tick for the new card to render, then bring it into view + focus.
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-testid="textarea-question-${focusIndex}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
      setFocusIndex(null);
    }, 80);
    return () => window.clearTimeout(t);
  }, [focusIndex]);

  const totalMarks = formMethods.watch("questions").reduce((sum, q) => sum + (q.maxScore || 0), 0);

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Merge some changes into one question.
  //
  // Each field is written on its own path with setValue. The obvious way to do
  // this — useFieldArray's update() — hands the question a brand new field id,
  // and because the list of questions is keyed by that id, React throws the
  // whole question card away and builds a fresh one. That is what used to make
  // a text box lose focus after every single character: you were not typing
  // into the same box any more. setValue changes the value and leaves the id
  // alone, so the box you are typing in stays put.
  const patchQuestion = (index: number, patch: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(patch)) {
      formMethods.setValue(`questions.${index}.${key}` as any, value as any, { shouldDirty: true });
    }
  };

  const handleQuestionImageUpload = (questionIndex: number, url: string) => {
    const currentImages = formMethods.getValues(`questions.${questionIndex}.imageUrls`) || [];
    patchQuestion(questionIndex, { imageUrls: [...currentImages, url] });
  };

  const removeQuestionImage = (questionIndex: number, imageIndex: number) => {
    const newImages = [...(formMethods.getValues(`questions.${questionIndex}.imageUrls`) || [])];
    newImages.splice(imageIndex, 1);
    patchQuestion(questionIndex, { imageUrls: newImages });
  };

  // --- Auto-marking answer-key helpers ---
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

  // Validate + save the assignment (create or edit). Returns true on success.
  // `navigate` controls whether we leave the page afterwards — the re-mark flow
  // saves without navigating so it can then re-mark on the same screen.
  // `asDraft` is only used when creating: true saves it hidden from students
  // until the teacher taps Publish. Editing never changes the draft state — a
  // draft stays a draft until it is published on purpose.
  async function doSave(values: CreateAssignmentForm, navigate: boolean, asDraft = false): Promise<boolean> {
    if (!teacher) return false;

    // Validate student selection
    if (!assignToAll && selectedStudentIds.length === 0) {
      toast({
        title: "No students selected",
        description: "Select at least one student, or choose all students.",
        variant: "destructive",
      });
      return false;
    }

    // Check every auto-marked question has a complete answer key, and build a
    // clean payload that only keeps the fields relevant to each type.
    const cleanedQuestions = [];
    for (let i = 0; i < values.questions.length; i++) {
      const q = values.questions[i];
      const base = {
        id: q.qid || newQid(), // preserve the existing id so marks stay linked
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
        if (options.length < 2) { fail("Add at least two options."); return false; }
        if (q.correctOption == null || q.correctOption >= (q.options || []).length) {
          fail("Choose which option is correct."); return false;
        }
        // Re-point "correct" in case blank options were trimmed out.
        const correctText = (q.options || [])[q.correctOption];
        const correctOption = Math.max(0, options.indexOf(correctText.trim()));
        cleanedQuestions.push({ ...base, options, correctOption });
      } else if (q.type === "true_false") {
        cleanedQuestions.push({ ...base, correctBool: q.correctBool ?? true });
      } else if (q.type === "numeric") {
        if (q.correctNumber == null || Number.isNaN(q.correctNumber)) {
          fail("Enter the correct number."); return false;
        }
        cleanedQuestions.push({ ...base, correctNumber: q.correctNumber, tolerance: q.tolerance ?? 0 });
      } else if (q.type === "short_text") {
        const acceptedAnswers = (q.acceptedAnswers || []).map(a => a.trim()).filter(a => a !== "");
        if (acceptedAnswers.length === 0) { fail("Add at least one accepted answer."); return false; }
        cleanedQuestions.push({ ...base, acceptedAnswers });
      } else {
        // written: marked by hand, no answer key
        cleanedQuestions.push(base);
      }
    }

    setIsLoading(true);
    try {
      const payload = {
        ...values,
        questions: cleanedQuestions,
        attachments,
        totalMarks,
        targetStudentIds: assignToAll ? [] : selectedStudentIds,
      };
      const response = isEdit
        ? await apiRequest("PUT", `/api/assignments/${editId}`, payload)
        : await apiRequest("POST", "/api/assignments", { ...payload, createdById: teacher.id, published: !asDraft });

      const data = await response.json();

      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
        if (isEdit) {
          queryClient.invalidateQueries({ queryKey: ["/api/assignments", editId] });
          // A plain save can clean marks for deleted questions, so refresh those too.
          queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
        }
        if (navigate) {
          toast({
            title: isEdit ? "Assignment updated" : asDraft ? "Draft saved" : "Assignment created",
            description: isEdit
              ? "Your changes have been saved."
              : asDraft
                ? "It is hidden from students until you tap Publish."
                : "Your assignment has been created successfully.",
          });
          setLocation(isEdit ? `/teacher/assignments/${editId}` : "/teacher/dashboard");
        }
        return true;
      }
      toast({
        title: isEdit ? "Assignment not updated" : "Assignment not created",
        description: data.message || "Check the form and try again.",
        variant: "destructive",
      });
      return false;
    } catch (error) {
      toast({
        title: isEdit ? "Assignment not updated" : "Assignment not created",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmit(values: CreateAssignmentForm) {
    void doSave(values, true);
  }

  // "Save as draft" — same assignment, same checks, just not released yet.
  // Runs the form's own validation first so the teacher gets the usual
  // messages about missing fields.
  const handleSaveAsDraft = () => {
    void formMethods.handleSubmit((values) => doSave(values, true, true))();
  };

  // The ids of questions that existed when this assignment was loaded — i.e.
  // questions that may already have student answers.
  const originalQuestionIds = new Set((editAssignment?.questions || []).map((q: any) => q.id));

  // Delete a question. If it already has student answers, warn first — deleting
  // will remove its marks from those students' totals.
  const handleRemoveQuestion = (index: number) => {
    const qid = formMethods.getValues(`questions.${index}.qid`);
    const hasAnswers = isEdit && submissionCount > 0 && qid && originalQuestionIds.has(qid);
    if (hasAnswers) {
      const okToRemove = window.confirm(
        "This question already has student answers. Deleting it will remove its marks from those students' totals (their other answers keep their scores). Delete it?",
      );
      if (!okToRemove) return;
    }
    remove(index);
  };

  // Re-mark one question across existing submissions after its correct answer
  // changed. First saves the current edits (so the new answer is persisted),
  // without navigating away, then re-marks just this question.
  const handleRemark = (qid: string | undefined) => {
    if (!qid || !isEdit) return;
    void formMethods.handleSubmit(async (values) => {
      const saved = await doSave(values, false);
      if (!saved) return;
      setRemarkingQid(qid);
      try {
        const res = await apiRequest("POST", `/api/assignments/${editId}/questions/${qid}/remark`, {});
        const data = await res.json();
        if (data.success) {
          queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
          toast({
            title: "Re-marked",
            description: `${data.affected} submission${data.affected === 1 ? "" : "s"} updated with the new correct answer.`,
          });
        } else {
          toast({ title: "Couldn't re-mark", description: data.message || "Please try again.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Couldn't re-mark", description: "Please try again.", variant: "destructive" });
      } finally {
        setRemarkingQid(null);
      }
    })();
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

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* When editing an assignment that already has submissions, warn that
            changing questions won't retroactively alter marks already given. */}
        {isEdit && submissionCount > 0 && (
          <div className="mb-4 rounded-xl border border-orange-400/60 bg-orange-500/10 px-4 py-3 text-sm" data-testid="submissions-notice">
            <AlertTriangle className="inline h-4 w-4 mr-1 align-text-bottom" aria-hidden="true" /><span className="font-semibold">{submissionCount} student{submissionCount === 1 ? " has" : "s have"} already handed in.</span>{" "}
            Changes to questions will <span className="font-semibold">not</span> alter marks already given. To update a fixed answer, use the{" "}
            <span className="font-semibold">Re-mark</span> button on that question.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{isEdit ? "Edit Assignment" : "Create New Assignment"}</CardTitle>
            <CardDescription>
              {isEdit
                ? "Change any field or question. Total Marks updates as you go."
                : "Create an assignment with questions for your students. You can add images to questions."}
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
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPasteOpen(true)}
                        data-testid="button-paste-questions"
                      >
                        <ClipboardPaste className="h-4 w-4 mr-2" />
                        Paste questions
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addQuestionAndFocus}
                        data-testid="button-add-question"
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add question
                      </Button>
                    </div>
                  </div>

                  {fields.map((field, index) => (
                    <Card key={field.id} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-medium">Question {index + 1}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Reorder */}
                            <Button type="button" variant="ghost" size="icon" disabled={index === 0}
                              onClick={() => move(index, index - 1)} title="Move up" data-testid={`button-move-up-${index}`}>
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" disabled={index === fields.length - 1}
                              onClick={() => move(index, index + 1)} title="Move down" data-testid={`button-move-down-${index}`}>
                              <ChevronDown className="h-4 w-4" />
                            </Button>

                            {/* Re-mark: only for a saved, auto-markable question when submissions exist. */}
                            {isEdit && submissionCount > 0
                              && originalQuestionIds.has(formMethods.watch(`questions.${index}.qid`) || "")
                              && formMethods.watch(`questions.${index}.type`) !== "written" && (
                              <Button type="button" variant="outline" size="sm"
                                disabled={remarkingQid === formMethods.watch(`questions.${index}.qid`)}
                                onClick={() => handleRemark(formMethods.getValues(`questions.${index}.qid`))}
                                title="Save changes and re-mark this question for students who have already handed in"
                                data-testid={`button-remark-${index}`}>
                                {remarkingQid === formMethods.watch(`questions.${index}.qid`)
                                  ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1" />
                                  : <RefreshCw className="h-4 w-4 sm:mr-1" />}
                                <span className="hidden sm:inline">Re-mark</span>
                              </Button>
                            )}

                            {/* Copy this question's settings into a fresh one
                                below it, so only the wording has to change. */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => duplicateQuestion(index)}
                              title="Make another question with these same settings"
                              data-testid={`button-duplicate-question-${index}`}
                            >
                              <Copy className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Duplicate</span>
                            </Button>

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
                                onClick={() => handleRemoveQuestion(index)}
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
                                    <PlusCircle className="h-4 w-4 mr-2" /> Add option
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
                                    <PlusCircle className="h-4 w-4 mr-2" /> Add accepted answer
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

                  {/* Primary "add" button — right below the last question, so after
                      finishing one the next-question button is right there (no
                      scrolling up). Adds a card, scrolls to it, and focuses its
                      text box. Full-width works well on mobile too. */}
                  <Button
                    type="button"
                    size="lg"
                    onClick={addQuestionAndFocus}
                    className="w-full font-bold text-white shadow-md hover:opacity-90"
                    style={{ backgroundColor: "#BF9000" }}
                    data-testid="button-add-question-bottom"
                  >
                    <PlusCircle className="h-5 w-5 mr-2" />
                    Add question
                  </Button>
                </div>

                {/* Bulk paste. The teacher pastes a block they already have, sees
                    exactly what will be created, and only then adds it. */}
                <BulkPasteDialog
                  open={pasteOpen}
                  onOpenChange={setPasteOpen}
                  title="Paste questions"
                  description="One question per line, with the answer after a bar. Each line becomes a Short text question worth 1 mark, marked automatically."
                  noun={{ one: "question", many: "questions" }}
                  value={pasteText}
                  onValueChange={setPasteText}
                  placeholder={"What is the capital of Zimbabwe? | Harare\nHow many sides does a triangle have? | 3 | three\nWho wrote Nervous Conditions? | Tsitsi Dangarembga"}
                  hint="Tip: add more answers after further bars — “2 + 2 = ? | 4 | four” accepts both."
                  toAdd={pastePreview.questions}
                  keyOfRow={(q) => q.lineNumber}
                  renderRow={(q) => (
                    <>
                      {q.questionText}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Answer key: {q.answers.join("  ·  ")}
                      </div>
                    </>
                  )}
                  emptyMessage="Nothing to add yet — every line needs an answer after a bar."
                  skipped={pastePreview.skipped}
                  onConfirm={addPastedQuestions}
                  testIds={{
                    textarea: "textarea-paste-questions",
                    preview: "paste-preview",
                    rowPrefix: "paste-preview-row-",
                    duplicates: "paste-preview-duplicates",
                    skipped: "paste-preview-skipped",
                    confirm: "button-paste-confirm",
                    cancel: "button-paste-cancel",
                  }}
                />

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

                {/* Editing a draft: remind the teacher it is still hidden, and
                    that saving here does not release it. */}
                {isEditingDraft && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
                    <FileClock className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-amber-900 dark:text-amber-100">
                      This is a draft — students can't see it yet. Saving keeps it a draft;
                      use the Publish button when you're ready to release it.
                    </p>
                  </div>
                )}

                {/* Save. When creating, "Save as draft" sits beside the normal
                    create button so the assignment can be prepared ahead of time
                    and released later with one tap. */}
                <div className="flex flex-col gap-2 sm:flex-row">
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
                    {isEdit ? (isEditingDraft ? "Save Draft" : "Save Changes") : "Create Assignment"}
                  </Button>

                  {!isEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isLoading}
                      onClick={handleSaveAsDraft}
                      data-testid="button-save-draft"
                    >
                      <FileClock className="h-4 w-4 mr-2" />
                      Save as draft
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
