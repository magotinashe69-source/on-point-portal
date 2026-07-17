import { useState, useEffect, useRef } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, Send, Calendar, BookOpen, Edit, AlertTriangle, ImagePlus, X, FileText, Paperclip, Circle, CheckCircle2 } from "lucide-react";
import { AttachmentDisplay } from "@/components/FileAttachmentZone";
import { Lightbox } from "@/components/Lightbox";
import { useUpload } from "@/hooks/use-upload";
import { isFullyAutoMarked } from "@shared/auto-marking";
import type { Assignment, Submission, StudentReward } from "@shared/schema";
import { TreasureRewardModal } from "@/components/TreasureRewardModal";
import logoPath from "@assets/logo.webp";

const MIN_ANSWER_LENGTH = 30;

const answerSchema = z.object({
  questionId: z.string(),
  answerText: z.string().min(1, "Answer is required"),
  imageUrls: z.array(z.string()).optional(),
});

const submitFormSchema = z.object({
  answers: z.array(answerSchema),
});

type SubmitForm = z.infer<typeof submitFormSchema>;

interface ExistingSubmission extends Submission {
  status: string;
}

interface ThinAnswer {
  questionNumber: number;
  charCount: number;
}

export default function SubmitAssignment() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { student } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [thinAnswers, setThinAnswers] = useState<ThinAnswer[]>([]);
  const [pendingValues, setPendingValues] = useState<SubmitForm | null>(null);
  // The treasure just earned, if any — shows the chest-opening reward pop-up.
  const [earnedReward, setEarnedReward] = useState<StudentReward | null>(null);

  useEffect(() => {
    if (!student) {
      setLocation("/student/login");
    }
  }, [student, setLocation]);

  const { data: assignment, isLoading: assignmentLoading } = useQuery<Assignment>({
    queryKey: ["/api/assignments", id],
    enabled: !!student && !!id,
  });

  const { data: existingSubmissions } = useQuery<ExistingSubmission[]>({
    queryKey: ["/api/submissions", { assignmentId: id, studentId: student?.id }],
    enabled: !!student && !!id,
  });

  const existingSubmission = existingSubmissions?.[0];
  const isEditing = !!existingSubmission;
  const isMarked = existingSubmission?.status === "MARKED";
  // Auto-marked assignments can be retried, so they stay editable even once
  // they show as "marked".
  const isAutoMarked = assignment ? isFullyAutoMarked(assignment.questions) : false;
  const lockedByTeacherMark = isMarked && !isAutoMarked;

  const isDeadlinePassed = assignment ? new Date() > new Date(assignment.dueDate) : false;
  const hasExtension = assignment?.extendedDeadlines?.find(e => e.studentId === student?.id);
  const effectiveDeadlinePassed = hasExtension
    ? new Date() > new Date(hasExtension.newDueDate)
    : isDeadlinePassed;

  const canEdit = isEditing && !isMarked;

  const form = useForm<SubmitForm>({
    resolver: zodResolver(submitFormSchema),
    defaultValues: {
      answers: [],
    },
  });

  useEffect(() => {
    if (assignment) {
      const answers = assignment.questions.map((q) => {
        const existingAnswer = existingSubmission?.answers?.find(a => a.questionId === q.id);
        return {
          questionId: q.id,
          answerText: existingAnswer?.answerText || "",
          imageUrls: existingAnswer?.imageUrls || [],
        };
      });
      form.reset({ answers });
    }
  }, [assignment, existingSubmission, form]);

  async function doSubmit(values: SubmitForm) {
    if (!student || !assignment) return;

    setIsLoading(true);
    try {
      let response;

      if (isEditing && existingSubmission) {
        response = await apiRequest("PUT", `/api/submissions/${existingSubmission.id}`, {
          answers: values.answers,
        });
      } else {
        response = await apiRequest("POST", "/api/submissions", {
          assignmentId: assignment.id,
          studentId: student.id,
          answers: values.answers,
        });
      }

      const data = await response.json();

      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });

        // Primary students may earn a Treasure Hunt collectible on a new
        // submission. When they do, celebrate with the chest-opening pop-up and
        // let it handle navigation. Everyone else goes straight to the dashboard.
        if (data.reward) {
          queryClient.invalidateQueries({ queryKey: ["/api/students/" + student.id + "/rewards"] });
          setEarnedReward(data.reward);
          return;
        }

        toast({
          title: isEditing ? "Updated successfully!" : "Submitted successfully!",
          description: isEditing ? "Your changes have been saved." : "Your work has been submitted for review.",
        });
        setLocation("/student/dashboard");
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to submit",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmit(values: SubmitForm) {
    // Only warn about short answers on hand-marked (written) questions — a
    // one-word or single-number answer is expected for auto-marked types.
    const thin: ThinAnswer[] = values.answers
      .map((a, i) => ({ questionNumber: i + 1, charCount: a.answerText.trim().length, type: assignment?.questions[i]?.type }))
      .filter(a => (!a.type || a.type === "written") && a.charCount < MIN_ANSWER_LENGTH)
      .map(({ questionNumber, charCount }) => ({ questionNumber, charCount }));

    if (thin.length > 0) {
      setThinAnswers(thin);
      setPendingValues(values);
      setShowWarningDialog(true);
      return;
    }

    doSubmit(values);
  }

  function handleConfirmSubmitAnyway() {
    setShowWarningDialog(false);
    if (pendingValues) {
      doSubmit(pendingValues);
      setPendingValues(null);
    }
  }

  function handleGoBack() {
    setShowWarningDialog(false);
    setPendingValues(null);
    setThinAnswers([]);
  }

  const { uploadFile: uploadAnswerFile } = useUpload();
  const [answerUploading, setAnswerUploading] = useState<Record<number, boolean>>({});
  const [answerDragging, setAnswerDragging] = useState<Record<number, boolean>>({});
  const answerFileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleAnswerFileDrop = async (index: number, files: FileList | File[]) => {
    const fileArr = Array.from(files);
    setAnswerUploading(prev => ({ ...prev, [index]: true }));
    for (const file of fileArr) {
      const result = await uploadAnswerFile(file);
      if (result) {
        const current = form.getValues(`answers.${index}.imageUrls`) || [];
        form.setValue(`answers.${index}.imageUrls`, [...current, result.objectPath]);
      }
    }
    setAnswerUploading(prev => ({ ...prev, [index]: false }));
  };

  if (!student) return null;

  return (
    <div className="min-h-screen bg-background">
      {earnedReward && (
        <TreasureRewardModal
          rewardName={earnedReward.rewardName}
          onClose={() => setLocation("/student/dashboard")}
          onViewMap={() => setLocation("/student/treasure")}
        />
      )}

      {lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxImages([])}
          onChange={setLightboxIndex}
        />
      )}

      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent data-testid="dialog-thin-answers">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Some answers look incomplete
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>The following question{thinAnswers.length !== 1 ? "s have" : " has"} a very short answer. Teachers may not be able to give full marks for very brief responses.</p>
                <ul className="space-y-1">
                  {thinAnswers.map(a => (
                    <li key={a.questionNumber} className="flex items-center gap-2 text-sm p-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      <span>
                        <strong>Question {a.questionNumber}</strong> — {a.charCount} character{a.charCount !== 1 ? "s" : ""} written
                        <span className="text-muted-foreground ml-1">(minimum {MIN_ANSWER_LENGTH} recommended)</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">You can go back and add more detail, or submit as-is if you have uploaded a photo of your work.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleGoBack} data-testid="button-go-back-improve">
              Go Back &amp; Improve
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmitAnyway}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="button-submit-anyway"
            >
              Submit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/student/dashboard" className="flex items-center gap-2">
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
        {assignmentLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : assignment ? (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <CardTitle className="text-2xl">{assignment.title}</CardTitle>
                  <Badge variant="outline">{assignment.subject}</Badge>
                </div>
                <CardDescription className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Due: {new Date(assignment.dueDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {assignment.totalMarks} marks
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-md">
                  <h3 className="font-semibold mb-2">Instructions</h3>
                  <p className="whitespace-pre-wrap text-sm">{assignment.instructions}</p>
                </div>
                {assignment.attachments && assignment.attachments.length > 0 && (
                  <div className="p-4 border rounded-md space-y-2">
                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                      <Paperclip className="h-4 w-4" />
                      Reference Materials from Teacher ({assignment.attachments.length})
                    </h3>
                    <AttachmentDisplay attachments={assignment.attachments} title="" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {assignment.questions.map((question, index) => (
                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                        <Badge variant="secondary">{question.maxScore} marks</Badge>
                      </div>
                      <CardDescription className="text-base text-foreground whitespace-pre-line">
                        {question.questionText}
                      </CardDescription>
                      {question.imageUrls && question.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {question.imageUrls.map((url, imgIndex) => (
                            <img
                              key={imgIndex}
                              src={url}
                              alt={`Question ${index + 1} image ${imgIndex + 1}`}
                              className="max-h-48 rounded-md border object-contain hover:opacity-80 transition-opacity cursor-pointer"
                              onClick={() => { setLightboxImages(question.imageUrls!); setLightboxIndex(imgIndex); }}
                              data-testid={`image-question-${index}-${imgIndex}`}
                            />
                          ))}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Multiple choice — tap an option */}
                      {question.type === "multiple_choice" ? (
                        <FormItem>
                          <FormLabel>Choose one</FormLabel>
                          <div className="space-y-2">
                            {(question.options || []).map((opt, optIdx) => {
                              const value = form.watch(`answers.${index}.answerText`) || "";
                              const selected = value === String(optIdx);
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => form.setValue(`answers.${index}.answerText`, String(optIdx), { shouldValidate: true })}
                                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                                  data-testid={`option-${index}-${optIdx}`}
                                >
                                  {selected
                                    ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                                    : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        </FormItem>
                      ) : question.type === "true_false" ? (
                        <FormItem>
                          <FormLabel>Choose one</FormLabel>
                          <div className="flex gap-3">
                            {[{ v: "true", l: "True" }, { v: "false", l: "False" }].map(({ v, l }) => {
                              const selected = (form.watch(`answers.${index}.answerText`) || "") === v;
                              return (
                                <Button
                                  key={v}
                                  type="button"
                                  variant={selected ? "default" : "outline"}
                                  className="flex-1"
                                  onClick={() => form.setValue(`answers.${index}.answerText`, v, { shouldValidate: true })}
                                  data-testid={`tf-${index}-${v}`}
                                >
                                  {l}
                                </Button>
                              );
                            })}
                          </div>
                        </FormItem>
                      ) : question.type === "numeric" ? (
                        <FormField
                          control={form.control}
                          name={`answers.${index}.answerText`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Your Answer (number)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="any"
                                  inputMode="decimal"
                                  placeholder="Type a number"
                                  data-testid={`input-number-${index}`}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : question.type === "short_text" ? (
                        <FormField
                          control={form.control}
                          name={`answers.${index}.answerText`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Your Answer</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Type a short answer"
                                  data-testid={`input-short-${index}`}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (
                        <FormField
                          control={form.control}
                          name={`answers.${index}.answerText`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Your Answer</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Type your answer here..."
                                  className="min-h-[120px]"
                                  data-testid={`textarea-answer-${index}`}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Answer Attachment Zone — only for written (hand-marked) questions */}
                      {(question.type && question.type !== "written") ? null : (() => {
                        const currentUrls = form.watch(`answers.${index}.imageUrls`) || [];
                        const isDraggingHere = answerDragging[index] || false;
                        const isUploadingHere = answerUploading[index] || false;

                        const isImageUrl = (url: string) => {
                          const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase() || "";
                          return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
                        };
                        const getFilename = (url: string) => {
                          const parts = url.split("/");
                          return parts[parts.length - 1] || "file";
                        };

                        return (
                          <div className="space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2">
                              <Paperclip className="h-4 w-4" />
                              Attach Files (photos of handwritten work, PDFs, documents)
                            </p>

                            {currentUrls.length > 0 && (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {currentUrls.map((url: string, imgIdx: number) => (
                                  <div key={imgIdx} className="relative group border rounded-lg overflow-hidden bg-muted/20" data-testid={`image-preview-${index}-${imgIdx}`}>
                                    {isImageUrl(url) ? (
                                      <a href={url} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={url}
                                          alt={`Attachment ${imgIdx + 1}`}
                                          className="h-20 w-full object-cover hover:opacity-90 transition-opacity"
                                        />
                                      </a>
                                    ) : (
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-20 gap-1 px-1 hover:bg-muted/50 transition-colors">
                                        <FileText className="h-7 w-7 text-red-500" />
                                        <span className="text-xs text-muted-foreground truncate w-full text-center px-1">{getFilename(url)}</span>
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => {
                                        const updated = currentUrls.filter((_: string, i: number) => i !== imgIdx);
                                        form.setValue(`answers.${index}.imageUrls`, updated);
                                      }}
                                      data-testid={`button-remove-image-${index}-${imgIdx}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div
                              onDragOver={(e) => { e.preventDefault(); setAnswerDragging(prev => ({ ...prev, [index]: true })); }}
                              onDragLeave={(e) => { e.preventDefault(); setAnswerDragging(prev => ({ ...prev, [index]: false })); }}
                              onDrop={async (e) => {
                                e.preventDefault();
                                setAnswerDragging(prev => ({ ...prev, [index]: false }));
                                if (e.dataTransfer.files.length > 0) {
                                  await handleAnswerFileDrop(index, e.dataTransfer.files);
                                }
                              }}
                              onClick={() => !isUploadingHere && answerFileRefs.current[index]?.click()}
                              className={`
                                border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                                ${isDraggingHere ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}
                                ${isUploadingHere ? "opacity-60 cursor-not-allowed" : ""}
                              `}
                              data-testid={`drop-zone-answer-${index}`}
                            >
                              <input
                                ref={(el) => { answerFileRefs.current[index] = el; }}
                                type="file"
                                accept="image/*,.pdf,.doc,.docx,.txt"
                                multiple
                                className="hidden"
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    await handleAnswerFileDrop(index, e.target.files);
                                  }
                                  if (e.target) e.target.value = "";
                                }}
                              />
                              <div className="flex flex-col items-center gap-1">
                                {isUploadingHere ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                ) : (
                                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {isUploadingHere ? "Uploading..." : isDraggingHere ? "Drop files here" : "Drag & drop or click — images, PDFs, documents"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                ))}

                {effectiveDeadlinePassed && !isMarked && (
                  <Alert className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950/30" data-testid="alert-late-submission">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800 dark:text-orange-300">
                      <strong>Deadline passed:</strong> The deadline has passed but you can still submit.
                    </AlertDescription>
                  </Alert>
                )}

                {isEditing && (
                  <Alert className="mb-4">
                    <Edit className="h-4 w-4" />
                    <AlertDescription>
                      {isAutoMarked && isMarked
                        ? "You've already had a go at this quiz. Change your answers and submit again for a fresh instant score."
                        : isMarked
                        ? "This assignment has been marked. You can no longer make changes."
                        : "You've already submitted this assignment. You can update your answers until your teacher marks it."}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading || lockedByTeacherMark}
                  data-testid="button-submit"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : isEditing ? (
                    <Edit className="h-4 w-4 mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isAutoMarked && isMarked
                    ? "Submit New Attempt"
                    : isEditing
                    ? "Update Submission"
                    : "Submit Assignment"}
                </Button>
              </form>
            </Form>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Assignment not found</p>
          </div>
        )}
      </main>
    </div>
  );
}
