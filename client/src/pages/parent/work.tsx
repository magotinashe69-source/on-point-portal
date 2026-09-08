// The parent's completed-work pages.
//
// Two screens live here:
//
//   /parent/work                  — everything the child has handed in
//   /parent/work/:submissionId    — one piece, question by question
//
// The second one is the point of the whole thing: it is what a teacher goes
// through with a parent on consultation day — this is what your child wrote,
// this is the right answer, this is what I said about it.
//
// Both are read-only. There is not a control on either page that changes
// anything, and the server has no parent endpoint that writes.
//
// A note on the id in the second address. Every other parent address carries
// no pupil id on purpose. This one has to carry a submission id — a parent
// taps a piece of work to open it — so the server checks that submission
// belongs to their own child and answers 403 for anything else, existing or
// not (requireParentSubmission in server/routes.ts). Nothing on this page
// relies on the id being right.

import { useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { subjectLabel } from "@shared/weekly-report";
import {
  WORK_TEXT,
  type CompletedWorkItem,
  type QuestionOutcome,
  type ReviewedQuestion,
  type SubmissionReview,
} from "@shared/parent-work";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDot,
  Clock,
  Loader2,
  MessageSquare,
  X,
} from "lucide-react";
import logoPath from "@assets/logo.webp";

/** The header every parent page shares. */
function ParentHeader({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href={backTo} className="flex items-center gap-2 min-w-0">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="text-sm truncate">{backLabel}</span>
        </Link>
        <div className="flex items-center gap-2">
          <img src={logoPath} alt="On Point" className="h-8 w-auto" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** A short date a parent can read at a glance. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// How each outcome looks. Green for right, amber for partly right, red for not
// yet — kept in one place so the list and the detail can never disagree, and
// so a colour-blind parent still has the words and the icon to go on.
const OUTCOME_STYLE: Record<
  QuestionOutcome,
  { label: string; badge: string; edge: string; icon: React.ReactNode }
> = {
  correct: {
    label: WORK_TEXT.outcomeCorrect,
    badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    edge: "border-l-4 border-l-green-500",
    icon: <Check className="h-4 w-4" />,
  },
  partly: {
    label: WORK_TEXT.outcomePartly,
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    edge: "border-l-4 border-l-amber-500",
    icon: <CircleDot className="h-4 w-4" />,
  },
  incorrect: {
    label: WORK_TEXT.outcomeIncorrect,
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    edge: "border-l-4 border-l-red-500",
    icon: <X className="h-4 w-4" />,
  },
  not_marked: {
    label: WORK_TEXT.outcomeNotMarked,
    badge: "bg-muted text-muted-foreground",
    edge: "border-l-4 border-l-muted-foreground/40",
    icon: <Clock className="h-4 w-4" />,
  },
};

// ---------------------------------------------------------------------------
// Screen one: everything the child has handed in
// ---------------------------------------------------------------------------

export function ParentWorkList() {
  const [, setLocation] = useLocation();
  const { parent } = useAuth();

  useEffect(() => {
    if (!parent) setLocation("/parent/login");
  }, [parent, setLocation]);

  // No id in this address: the server works out the child from the parent's
  // own account, exactly like the dashboard.
  const { data, isLoading, isError } = useQuery<{ success: boolean; work: CompletedWorkItem[] }>({
    queryKey: ["/api/parent/completed-work"],
    enabled: !!parent,
  });

  if (!parent) return null;
  const work = data?.work || [];

  return (
    <div className="min-h-screen bg-background">
      <ParentHeader backTo="/parent/dashboard" backLabel="Dashboard" />

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-1">{WORK_TEXT.completedTitle}</h1>
        <p className="text-muted-foreground text-sm mb-6">{WORK_TEXT.completedNote}</p>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive" data-testid="text-work-error">
            We could not load your child's work just now. Try again in a moment.
          </p>
        )}

        {data && work.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground" data-testid="text-work-empty">
              {WORK_TEXT.completedEmpty}
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {work.map(item => (
            // A whole-row link, so it is easy to hit with a thumb.
            <Link
              key={item.submissionId}
              href={`/parent/work/${item.submissionId}`}
              data-testid={`link-work-${item.submissionId}`}
            >
              <Card className="hover-elevate active-elevate-2 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline">{subjectLabel(item.subject)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {WORK_TEXT.handedIn} {shortDate(item.submittedAt)}
                        </span>
                      </div>
                      <p className="font-medium truncate">{item.title}</p>
                    </div>

                    <div className="text-right shrink-0">
                      {item.marked ? (
                        <>
                          <p className="text-lg font-semibold leading-tight">
                            {item.score}/{item.outOf}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.percent}%</p>
                        </>
                      ) : (
                        // Waiting on the teacher is said out loud. Showing a 0
                        // here would read as a bad mark rather than no mark.
                        <p className="text-xs text-muted-foreground max-w-[6rem]">
                          {WORK_TEXT.notMarkedYet}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-6 border-t pt-4">{WORK_TEXT.readOnly}</p>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen two: one piece of work, question by question
// ---------------------------------------------------------------------------

/** One question: what was asked, what the child put, and what was right. */
function QuestionCard({ question }: { question: ReviewedQuestion }) {
  const style = OUTCOME_STYLE[question.outcome];

  return (
    <Card className={style.edge} data-testid={`card-question-${question.number}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium flex-1">
            <span className="text-muted-foreground mr-2">{question.number}.</span>
            {question.questionText}
          </p>
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${style.badge}`}
            data-testid={`badge-outcome-${question.number}`}
          >
            {style.icon}
            {style.label}
          </span>
        </div>

        {/* What the child wrote. */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{WORK_TEXT.yourChildsAnswer}</p>
          <p className="rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap" data-testid={`text-child-answer-${question.number}`}>
            {question.childAnswer
              ? question.childAnswer
              : question.answeredWithPhoto
                ? WORK_TEXT.answeredWithPhoto
                : WORK_TEXT.noAnswerGiven}
          </p>
        </div>

        {/* The right answer — but only called that when it really is one.
            An auto-marked question has an exact key: anything else was wrong.
            A written question has at best the teacher's model answer, which is
            an EXAMPLE of a good answer, not the only right one, so it is
            labelled differently and a parent is told their child's answer need
            not match it. With neither, we say the teacher marked it by hand
            rather than inventing an answer. */}
        {question.correctAnswer ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {question.correctAnswerKind === "model" ? WORK_TEXT.modelAnswer : WORK_TEXT.correctAnswer}
            </p>
            <p
              className="rounded-md bg-green-50 dark:bg-green-950/40 px-3 py-2 text-sm font-medium whitespace-pre-wrap"
              data-testid={`text-correct-answer-${question.number}`}
            >
              {question.correctAnswer}
            </p>
            {question.correctAnswerKind === "model" && (
              <p className="text-xs text-muted-foreground mt-1">{WORK_TEXT.modelAnswerNote}</p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-1">{WORK_TEXT.markedByTeacher}</p>
            <p className="text-sm text-muted-foreground">{WORK_TEXT.markedByTeacherNote}</p>
          </div>
        )}

        {question.explanation && (
          <p className="text-sm text-muted-foreground">{question.explanation}</p>
        )}

        {question.teacherComment && (
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">{WORK_TEXT.teacherComment}</span>
            </div>
            <p className="text-sm" data-testid={`text-question-feedback-${question.number}`}>
              {question.teacherComment}
            </p>
          </div>
        )}

        {question.score !== null && (
          <p className="text-xs text-muted-foreground">
            {question.score} of {question.maxScore} marks
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ParentWorkDetail() {
  const [, setLocation] = useLocation();
  const { parent } = useAuth();
  const [, params] = useRoute("/parent/work/:submissionId");
  const submissionId = params?.submissionId;

  useEffect(() => {
    if (!parent) setLocation("/parent/login");
  }, [parent, setLocation]);

  // The id travels in the address, and the server checks it belongs to this
  // parent's child before answering. A parent who edits it gets a 403, which
  // lands here as an error message — no other child's work can appear.
  const { data, isLoading, isError } = useQuery<{ success: boolean; review: SubmissionReview }>({
    queryKey: ["/api/parent/submissions", submissionId],
    enabled: !!parent && !!submissionId,
  });

  if (!parent) return null;
  const review = data?.review;

  return (
    <div className="min-h-screen bg-background">
      <ParentHeader backTo="/parent/work" backLabel={WORK_TEXT.completedTitle} />

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {isError && (
          // This is also what a parent sees if they edit the id in the address:
          // the server refuses, and they are told plainly rather than being
          // shown anything of another child's.
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <p className="text-sm text-destructive" data-testid="text-review-error">
                We could not open that piece of work. You can only see your own child's work.
              </p>
              <Button variant="outline" size="sm" onClick={() => setLocation("/parent/work")}>
                {WORK_TEXT.back}
              </Button>
            </CardContent>
          </Card>
        )}

        {review && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline">{subjectLabel(review.subject)}</Badge>
                {review.topic && <Badge variant="secondary">{review.topic}</Badge>}
              </div>
              <h1 className="text-2xl font-bold" data-testid="text-review-title">{review.title}</h1>
              <p className="text-muted-foreground text-sm">
                {review.child.fullName} · {WORK_TEXT.handedIn.toLowerCase()} {shortDate(review.submittedAt)}
              </p>
            </div>

            {review.marked ? (
              <Card className="mb-6">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Mark</p>
                    <p className="text-2xl font-semibold" data-testid="text-review-score">
                      {review.score}/{review.outOf}
                    </p>
                  </div>
                  <p className="text-3xl font-bold" data-testid="text-review-percent">{review.percent}%</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-6">
                <CardContent className="p-4 text-sm text-muted-foreground" data-testid="text-awaiting-marking">
                  {WORK_TEXT.awaitingMarking}
                </CardContent>
              </Card>
            )}

            {review.teacherFeedback && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {WORK_TEXT.overallFeedback}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm" data-testid="text-review-feedback">{review.teacherFeedback}</p>
                </CardContent>
              </Card>
            )}

            <p className="text-sm text-muted-foreground mb-4">{WORK_TEXT.reviewNote}</p>

            <div className="space-y-3">
              {review.questions.map(q => (
                <QuestionCard key={q.number} question={q} />
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-6 border-t pt-4">{WORK_TEXT.readOnly}</p>
          </>
        )}
      </main>
    </div>
  );
}
