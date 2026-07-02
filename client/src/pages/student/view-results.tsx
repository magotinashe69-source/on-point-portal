import { useEffect, useState } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Trophy, MessageSquare, Image as ImageIcon, RotateCcw } from "lucide-react";
import { Lightbox } from "@/components/Lightbox";
import { isFullyAutoMarked } from "@shared/auto-marking";
import type { Submission, Assignment, Mark } from "@shared/schema";
import logoPath from "@assets/image_1769457206059.png";

export default function ViewResults() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { student } = useAuth();
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!student) {
      setLocation("/student/login");
    }
  }, [student, setLocation]);

  const { data: submissionData, isLoading: submissionLoading } = useQuery<Submission & { assignment?: Assignment }>({
    queryKey: ["/api/submissions", id],
    enabled: !!student && !!id,
  });

  // Use the assignment embedded in the submission response (returned by /api/submissions/:id)
  const submission = submissionData;
  const assignment = submissionData?.assignment;

  const { data: mark } = useQuery<Mark>({
    queryKey: ["/api/marks", id],
    enabled: !!submission && submission.status === "MARKED",
  });

  if (!student) return null;

  const rawScore = mark?.totalScore || 0;
  const totalMarks = assignment?.totalMarks || 1;
  const percentage = mark ? Math.round((rawScore / totalMarks) * 100) : 0;

  const getGradeColor = (pct: number) => {
    if (pct >= 80) return "text-green-600 dark:text-green-400";
    if (pct >= 60) return "text-primary";
    if (pct >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-destructive";
  };

  const getGradeLabel = (pct: number) => {
    if (pct >= 80) return "Excellent!";
    if (pct >= 60) return "Good Work!";
    if (pct >= 40) return "Keep Trying!";
    return "Needs Improvement";
  };

  return (
    <div className="min-h-screen bg-background">
      {lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxImages([])}
          onChange={setLightboxIndex}
        />
      )}
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
        {submissionLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : submission && assignment && assignment.questions && mark ? (
          <>
            <Card className="mb-6">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Trophy className={`h-10 w-10 ${getGradeColor(percentage)}`} />
                </div>
                <CardTitle className="text-2xl">{assignment.title}</CardTitle>
                <CardDescription>{assignment.subject} - {assignment.form}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <div className={`text-5xl font-bold mb-2 ${getGradeColor(percentage)}`} data-testid="text-score">
                    {rawScore}/{totalMarks}
                  </div>
                  <p className={`text-lg font-medium ${getGradeColor(percentage)}`}>
                    {getGradeLabel(percentage)}
                  </p>
                  <p className="text-muted-foreground">{percentage}%</p>
                </div>
                <Progress value={percentage} className="h-3" />

                {/* Auto-marked quizzes can be retried for a fresh instant score. */}
                {assignment.questions && isFullyAutoMarked(assignment.questions) && (
                  <div className="mt-6 flex justify-center">
                    <Button
                      onClick={() => setLocation(`/student/submit/${assignment.id}`)}
                      size="lg"
                      data-testid="button-try-again"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {mark.feedback && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Teacher's Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{mark.feedback}</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Question Results</h2>
              {assignment.questions.map((question, index) => {
                const studentAnswer = submission.answers.find(a => a.questionId === question.id);
                const questionMark = mark.questionMarks.find(qm => qm.questionId === question.id);
                const isCorrect = questionMark && questionMark.score === questionMark.maxScore;
                const questionPct = questionMark ? Math.round((questionMark.score / questionMark.maxScore) * 100) : 0;

                return (
                  <Card key={question.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {isCorrect ? (
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                          <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                        </div>
                        <Badge 
                          variant={questionPct >= 60 ? "default" : "secondary"}
                          className={questionPct >= 80 ? "bg-green-600" : ""}
                        >
                          {questionMark?.score || 0}/{question.maxScore}
                        </Badge>
                      </div>
                      <CardDescription className="text-base whitespace-pre-line">
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
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium mb-1">Your Answer:</p>
                        <p className="whitespace-pre-wrap text-sm">
                          {studentAnswer?.answerText || <em className="text-muted-foreground">No answer provided</em>}
                        </p>
                        {studentAnswer?.imageUrls && studentAnswer.imageUrls.length > 0 && (
                          <div className="border-t pt-3 mt-3">
                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              Your Attached Images ({studentAnswer.imageUrls.length})
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {studentAnswer.imageUrls.map((url, imgIdx) => (
                                <img
                                  key={imgIdx}
                                  src={url}
                                  alt={`Your attachment ${imgIdx + 1}`}
                                  className="h-24 w-24 object-cover rounded-md border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => { setLightboxImages(studentAnswer.imageUrls!); setLightboxIndex(imgIdx); }}
                                  data-testid={`image-answer-${index}-${imgIdx}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {questionMark?.feedback && (
                        <div className="p-3 bg-primary/5 rounded-md border-l-4 border-primary">
                          <p className="text-sm font-medium mb-1">Feedback:</p>
                          <p className="text-sm">{questionMark.feedback}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : submission && submission.status === "SUBMITTED" ? (
          <div className="text-center py-16">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10">
              <Loader2 className="h-8 w-8 text-secondary animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Awaiting Review</h2>
            <p className="text-muted-foreground">Your submission is being reviewed by your teacher.</p>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Results not found</p>
          </div>
        )}
      </main>
    </div>
  );
}
