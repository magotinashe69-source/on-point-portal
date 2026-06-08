import { useState, useEffect } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  CheckCircle, 
  Image as ImageIcon,
  ZoomIn,
  AlertTriangle,
  Check,
  XCircle,
  Highlighter,
} from "lucide-react";
import { Lightbox } from "@/components/Lightbox";
import type { Submission, Assignment, Mark, Student } from "@shared/schema";
import logoPath from "@assets/image_1769457206059.png";

const markQuestionSchema = z.object({
  questionId: z.string(),
  score: z.number().min(0),
  maxScore: z.number(),
  feedback: z.string().optional(),
});

const markFormSchema = z.object({
  feedback: z.string().optional(),
  questionMarks: z.array(markQuestionSchema),
});

type MarkForm = z.infer<typeof markFormSchema>;

export default function MarkSubmission() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [answerHighlights, setAnswerHighlights] = useState<Record<string, 'green' | 'red' | 'yellow' | null>>({});

  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images);
    setLightboxIndex(idx);
  };
  const closeLightbox = () => setLightboxImages([]);

  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  const { data: submissionData, isLoading: submissionLoading } = useQuery<Submission & { assignment?: Assignment }>({
    queryKey: ["/api/submissions", id],
    enabled: !!teacher && !!id,
  });

  // Use the assignment embedded in the submission response (returned by /api/submissions/:id)
  const submission = submissionData;
  const assignment = submissionData?.assignment;

  const { data: student } = useQuery<Student>({
    queryKey: ["/api/students", submission?.studentId],
    enabled: !!submission?.studentId,
  });

  const { data: existingMark } = useQuery<Mark>({
    queryKey: ["/api/marks", id],
    enabled: !!submission && submission.status === "MARKED",
  });

  const form = useForm<MarkForm>({
    resolver: zodResolver(markFormSchema),
    defaultValues: {
      feedback: "",
      questionMarks: [],
    },
  });

  useEffect(() => {
    if (assignment && assignment.questions && submission) {
      const questionMarks = assignment.questions.map((q) => {
        const existingQuestionMark = existingMark?.questionMarks.find(qm => qm.questionId === q.id);
        return {
          questionId: q.id,
          score: existingQuestionMark?.score || 0,
          maxScore: q.maxScore,
          feedback: existingQuestionMark?.feedback || "",
        };
      });
      form.reset({
        feedback: existingMark?.feedback || "",
        questionMarks,
      });
    }
  }, [assignment, submission, existingMark, form]);

  const questionMarks = form.watch("questionMarks") || [];
  const totalScore = questionMarks.reduce((sum, qm) => sum + (qm.score || 0), 0);
  const totalMaxScore = questionMarks.reduce((sum, qm) => sum + (qm.maxScore || 0), 0);

  async function onSubmit(values: MarkForm) {
    if (!teacher || !submission) return;
    
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/marks", {
        submissionId: submission.id,
        totalScore,
        feedback: values.feedback,
        markedById: teacher.id,
        questionMarks: values.questionMarks,
      });
      
      const data = await response.json();
      
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/marks"] });
        toast({
          title: "Marked successfully!",
          description: "The submission has been marked and sent to the student.",
        });
        setLocation(`/teacher/assignments/${submission.assignmentId}`);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to mark submission",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark submission. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!teacher) return null;

  const aiAnalysis = submission?.aiAnalysis;
  const hasAiFlags = aiAnalysis && aiAnalysis.flags && aiAnalysis.flags.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={closeLightbox}
          onChange={setLightboxIndex}
        />
      )}
      
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
        {submissionLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : submission && assignment && assignment.questions ? (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold">Mark Submission</h1>
                <Badge variant={submission.status === "MARKED" ? "default" : "secondary"}>
                  {submission.status === "MARKED" ? "Already Marked" : "Needs Review"}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                <strong>{student?.fullName || 'Student'}</strong> - {assignment.title}
              </p>
            </div>

            {hasAiFlags && (
              <Card className="mb-6 border-destructive/50 bg-destructive/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-destructive">AI Detection Alert</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-2">
                    <strong>AI Score:</strong> {aiAnalysis?.overallScore}% likelihood of AI-generated content
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {aiAnalysis?.flags.map((flag, i) => (
                      <Badge key={i} variant="destructive">{flag}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{aiAnalysis?.details}</p>
                </CardContent>
              </Card>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {assignment.questions.map((question, index) => {
                  const studentAnswer = submission.answers.find(a => a.questionId === question.id);
                  const hasImages = studentAnswer?.imageUrls && studentAnswer.imageUrls.length > 0;
                  
                  return (
                    <Card key={question.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                          <Badge variant="outline">{question.maxScore} marks</Badge>
                        </div>
                        <CardDescription className="whitespace-pre-line">{question.questionText}</CardDescription>
                        {question.imageUrls && question.imageUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {question.imageUrls.map((url, imgIdx) => (
                              <img 
                                key={imgIdx} 
                                src={url} 
                                alt={`Question ${index + 1} reference`} 
                                className="h-16 w-16 object-cover rounded-md border cursor-pointer opacity-90 hover:opacity-100"
                                onClick={() => openLightbox(question.imageUrls!, imgIdx)}
                                data-testid={`image-question-${index}-${imgIdx}`}
                              />
                            ))}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Quick Mark:</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                              onClick={() => form.setValue(`questionMarks.${index}.score`, question.maxScore)}
                              data-testid={`button-full-marks-${index}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Full
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400"
                              onClick={() => form.setValue(`questionMarks.${index}.score`, 0)}
                              data-testid={`button-zero-marks-${index}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Zero
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => form.setValue(`questionMarks.${index}.score`, Math.round(question.maxScore / 2))}
                              data-testid={`button-half-marks-${index}`}
                            >
                              Half
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground mr-1">
                              <Highlighter className="h-3 w-3 inline" /> Highlight:
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={`h-6 w-6 bg-green-200 dark:bg-green-800 ${answerHighlights[question.id] === 'green' ? 'ring-2 ring-green-600' : ''}`}
                              onClick={() => setAnswerHighlights(prev => ({ ...prev, [question.id]: prev[question.id] === 'green' ? null : 'green' }))}
                              data-testid={`button-highlight-green-${index}`}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={`h-6 w-6 bg-yellow-200 dark:bg-yellow-800 ${answerHighlights[question.id] === 'yellow' ? 'ring-2 ring-yellow-600' : ''}`}
                              onClick={() => setAnswerHighlights(prev => ({ ...prev, [question.id]: prev[question.id] === 'yellow' ? null : 'yellow' }))}
                              data-testid={`button-highlight-yellow-${index}`}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={`h-6 w-6 bg-red-200 dark:bg-red-800 ${answerHighlights[question.id] === 'red' ? 'ring-2 ring-red-600' : ''}`}
                              onClick={() => setAnswerHighlights(prev => ({ ...prev, [question.id]: prev[question.id] === 'red' ? null : 'red' }))}
                              data-testid={`button-highlight-red-${index}`}
                            />
                          </div>
                        </div>
                        
                        <div className={`p-4 rounded-md transition-colors ${
                          answerHighlights[question.id] === 'green' ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400' :
                          answerHighlights[question.id] === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/40 border-2 border-yellow-400' :
                          answerHighlights[question.id] === 'red' ? 'bg-red-100 dark:bg-red-900/40 border-2 border-red-400' :
                          'bg-muted'
                        }`}>
                          <p className="text-sm font-medium mb-2">Student's Answer:</p>
                          <p className="whitespace-pre-wrap mb-4">
                            {studentAnswer?.answerText || <em className="text-muted-foreground">No text answer provided</em>}
                          </p>
                          
                          {hasImages && (
                            <div className="border-t pt-4 mt-4">
                              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                <ImageIcon className="h-4 w-4" />
                                Attached Files ({studentAnswer?.imageUrls?.length})
                              </p>
                              <div className="flex flex-wrap gap-3">
                                {studentAnswer?.imageUrls?.map((url, imgIdx) => {
                                  const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase() || "";
                                  const isImg = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
                                  return isImg ? (
                                    <div 
                                      key={imgIdx} 
                                      className="relative group cursor-pointer"
                                      onClick={() => openLightbox(studentAnswer!.imageUrls!.filter(u => { const e = u.split(".").pop()?.split("?")[0]?.toLowerCase() || ""; return ["jpg","jpeg","png","gif","webp","svg"].includes(e); }), studentAnswer!.imageUrls!.filter(u => { const e = u.split(".").pop()?.split("?")[0]?.toLowerCase() || ""; return ["jpg","jpeg","png","gif","webp","svg"].includes(e); }).indexOf(url))}
                                      data-testid={`image-answer-${index}-${imgIdx}`}
                                    >
                                      <img 
                                        src={url} 
                                        alt={`Student answer ${imgIdx + 1}`} 
                                        className="h-24 w-24 object-cover rounded-md border shadow-sm hover:shadow-md transition-shadow"
                                      />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                        <ZoomIn className="h-6 w-6 text-white" />
                                      </div>
                                    </div>
                                  ) : (
                                    <a
                                      key={imgIdx}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex flex-col items-center justify-center h-24 w-24 border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors gap-1 px-1"
                                      data-testid={`file-answer-${index}-${imgIdx}`}
                                    >
                                      <ImageIcon className="h-8 w-8 text-red-500" />
                                      <span className="text-xs text-muted-foreground truncate w-full text-center">{url.split("/").pop()}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`questionMarks.${index}.score`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Score (out of {question.maxScore})</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={question.maxScore}
                                    data-testid={`input-score-${index}`}
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`questionMarks.${index}.feedback`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Feedback (optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Feedback for this question..."
                                    data-testid={`input-feedback-${index}`}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Card>
                  <CardHeader>
                    <CardTitle>Overall Feedback</CardTitle>
                    <CardDescription>
                      Total Score: <strong>{totalScore}</strong> / {totalMaxScore}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="feedback"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>General Comments</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Provide overall feedback for the student..."
                              className="min-h-[100px]"
                              data-testid="textarea-overall-feedback"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-submit-mark"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {submission.status === "MARKED" ? "Update Mark" : "Submit Mark"}
                </Button>
              </form>
            </Form>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Submission not found</p>
          </div>
        )}
      </main>
    </div>
  );
}
