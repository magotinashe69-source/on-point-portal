// Submission review — a teacher opens one student's submitted assignment from
// the Grade Book and sees their actual answers, the correct answers, and the
// marks, question by question. The teacher can override any mark (e.g. award
// partial credit on a written answer); the total and the student's XP update
// consistently, and the change is flagged as teacher-adjusted.

import { useEffect, useState } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageErrorBoundary } from "@/components/ErrorBoundary";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Pencil } from "lucide-react";
import logoPath from "@assets/logo.webp";

interface QReview {
  index: number;
  questionId: string;
  questionText: string;
  imageUrls: string[];
  type: string;
  autoMarkable: boolean;
  studentAnswerText: string;
  studentAnswerDisplay: string;
  studentAnswerImages: string[];
  correctAnswerDisplay: string;
  acceptedAnswers?: string[];
  tolerance?: number;
  score: number;
  maxScore: number;
  verdict: "correct" | "wrong" | "partial" | "unmarked";
  teacherAdjusted: boolean;
  feedback?: string;
}

interface ReviewData {
  submissionId: number;
  status: string;
  submittedAt: string | null;
  student: { id: number; name: string; form: string } | null;
  assignment: { id: number; title: string; subject: string; totalMarks: number };
  totalScore: number | null;
  // False for any submission saved without per-question answers (older rows).
  hasAnswerData: boolean;
  questions: QReview[];
}

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / False",
  numeric: "Number",
  short_text: "Short text",
  written: "Written (hand-marked)",
};

function SubmissionReviewContent() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [savingQid, setSavingQid] = useState<string | null>(null);

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const queryKey = ["/api/teacher/submissions", id, "review"];
  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; review: ReviewData }>({
    queryKey,
    enabled: !!teacher && !!id,
  });

  const review = data?.review;
  const isMarked = review ? review.totalScore !== null : false;

  const saveOverride = async (q: QReview) => {
    const raw = scoreInputs[q.questionId];
    const value = raw === undefined ? q.score : Number(raw);
    if (!Number.isFinite(value)) { toast({ title: "Enter a number", variant: "destructive" }); return; }
    if (value < 0 || value > q.maxScore) { toast({ title: `Score must be 0–${q.maxScore}`, variant: "destructive" }); return; }
    setSavingQid(q.questionId);
    try {
      const res = await apiRequest("POST", `/api/teacher/submissions/${id}/questions/${q.questionId}/mark`, { score: value });
      const body = await res.json();
      if (body.success) {
        await queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ["/api/gradebook"] });
        setScoreInputs((s) => { const n = { ...s }; delete n[q.questionId]; return n; });
        toast({ title: "Mark updated", description: `Q${q.index + 1} set to ${body.score}/${q.maxScore}. New total ${body.totalScore}/${review?.assignment.totalMarks}.` });
      } else {
        toast({ title: "Couldn't update", description: body.message || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't update", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingQid(null);
    }
  };

  // Say what actually went wrong. Before, every failure looked the same
  // ("Couldn't load this submission"), which hid the real cause — usually an
  // expired login being refused, rather than any missing answer data.
  const renderLoadError = () => {
    const status = /^(\d{3}):/.exec(String((error as Error)?.message || ""))?.[1];
    const message =
      status === "401" ? "Your teacher login has expired. Please sign in again to view this submission."
      : status === "404" ? "This submission no longer exists. It may have been deleted."
      : status === "500" ? "The server had a problem loading this submission."
      : "Couldn't load this submission. Please check your connection and try again.";
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="review-error">
        <p className="font-medium">{message}</p>
        <div className="flex gap-2 mt-4">
          {status === "401" ? (
            <Button onClick={() => setLocation("/teacher/login")} data-testid="button-review-login">Go to login</Button>
          ) : (
            <Button variant="outline" onClick={() => refetch()} data-testid="button-review-retry">Try again</Button>
          )}
          <Link href="/teacher/gradebook">
            <Button variant="ghost" data-testid="button-review-back">Back to Grade Book</Button>
          </Link>
        </div>
      </div>
    );
  };

  if (!teacher) return null;

  const wrongList = (review?.questions || []).filter((q) => q.verdict === "wrong" || q.verdict === "partial");
  const mistakesLabel = wrongList.length === 0
    ? "All correct! 🎉"
    : "Missed " + wrongList.map((q) => `Q${q.index + 1}${q.verdict === "partial" ? " (partial)" : ""}`).join(", ");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/gradebook" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Grade Book</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (error || !review) ? (
          renderLoadError()
        ) : (
          <>
            {/* Mistakes summary */}
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">{review.student?.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {review.assignment.title} · {review.assignment.subject} · {review.student?.form}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums" data-testid="text-total-score">
                      {isMarked ? `${review.totalScore}/${review.assignment.totalMarks}` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{isMarked ? "total" : "awaiting mark"}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm" data-testid="mistakes-summary">
                  <span className="font-medium">{mistakesLabel}</span>
                </div>
                {/* Some older submissions were saved before the app kept each
                    answer, so there is genuinely nothing to show for them. Say
                    so plainly instead of leaving the teacher looking at blanks. */}
                {!review.hasAnswerData && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200" data-testid="notice-no-answer-data">
                    Answer data not recorded for this submission. It was submitted before the app
                    started saving each answer, so only the marks below are available.
                  </div>
                )}
                {!isMarked && (
                  <Link href={`/teacher/mark/${review.submissionId}`}>
                    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary cursor-pointer">
                      This submission hasn't been marked yet — open the marking page to mark it. →
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Per-question review */}
            <div className="space-y-3">
              {review.questions.map((q) => {
                const isWritten = !q.autoMarkable;
                return (
                  <Card key={q.questionId} data-testid={`review-q-${q.index}`}>
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">Question {q.index + 1}</span>
                            <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[q.type] || q.type}</Badge>
                            {q.teacherAdjusted && <Badge variant="secondary" className="text-[10px]" data-testid={`badge-adjusted-${q.index}`}>Teacher-adjusted</Badge>}
                          </div>
                          <p className="text-sm mt-1">{q.questionText}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {q.verdict === "correct" && <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
                          {q.verdict === "wrong" && <XCircle className="h-5 w-5 text-destructive" />}
                          {q.verdict === "partial" && <Badge className="bg-amber-500 text-white">Partial</Badge>}
                          <span className="font-bold tabular-nums" data-testid={`score-${q.index}`}>{q.score}/{q.maxScore}</span>
                        </div>
                      </div>

                      {q.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {q.imageUrls.map((url, i) => (
                            <img key={i} src={url} alt={`Question ${q.index + 1} image ${i + 1}`} className="h-24 w-24 object-cover rounded border" />
                          ))}
                        </div>
                      )}

                      {/* Student answer — prominent for written work. */}
                      <div className={`rounded-lg border p-3 ${isWritten ? "bg-muted/40" : ""}`}>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Student's answer</div>
                        {q.studentAnswerDisplay ? (
                          <p className={`whitespace-pre-wrap break-words ${isWritten ? "text-base" : "text-sm font-medium"}`} data-testid={`answer-${q.index}`}>
                            {q.studentAnswerDisplay}
                          </p>
                        ) : (
                          <p className="text-sm italic text-muted-foreground">
                            {review.hasAnswerData ? "No answer given" : "Answer data not recorded"}
                          </p>
                        )}
                        {q.studentAnswerImages.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {q.studentAnswerImages.map((url, i) => (
                              <img key={i} src={url} alt={`Answer image ${i + 1}`} className="h-20 w-20 object-cover rounded border" />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Correct answer (auto-markable types only). */}
                      {q.autoMarkable && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Correct answer: </span>
                          <span className="font-medium">{q.correctAnswerDisplay || "—"}</span>
                          {q.acceptedAnswers && q.acceptedAnswers.length > 1 && (
                            <span className="text-muted-foreground"> (also accepts: {q.acceptedAnswers.slice(1).join(", ")})</span>
                          )}
                          {q.type === "numeric" && (
                            <span className="text-muted-foreground"> · tolerance ±{q.tolerance ?? 0}</span>
                          )}
                        </div>
                      )}

                      {/* Teacher override. */}
                      {isMarked && (
                        <div className="flex items-center gap-2 pt-1 border-t mt-1">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Override:</span>
                          <Input
                            type="number" min={0} max={q.maxScore}
                            className="h-8 w-20"
                            value={scoreInputs[q.questionId] ?? String(q.score)}
                            onChange={(e) => setScoreInputs((s) => ({ ...s, [q.questionId]: e.target.value }))}
                            data-testid={`input-override-${q.index}`}
                          />
                          <span className="text-xs text-muted-foreground">/ {q.maxScore}</span>
                          <Button
                            size="sm" variant="outline"
                            disabled={savingQid === q.questionId || (scoreInputs[q.questionId] ?? String(q.score)) === String(q.score)}
                            onClick={() => saveOverride(q)}
                            data-testid={`button-save-override-${q.index}`}
                          >
                            {savingQid === q.questionId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// The safety net. If anything inside the review throws, the teacher sees a
// message with a way back instead of the whole app going blank — one odd
// submission can never white-screen them out of the Grade Book.
export default function SubmissionReview() {
  return (
    <PageErrorBoundary backHref="/teacher/gradebook" backLabel="Back to Grade Book" label="submission-review">
      <SubmissionReviewContent />
    </PageErrorBoundary>
  );
}
