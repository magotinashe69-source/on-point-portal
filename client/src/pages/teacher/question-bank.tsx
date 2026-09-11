// The Question Bank — browse the library of saved questions.
//
// A teacher saves a question once (from the assignment form) and finds it again
// here by what it is ABOUT: subject, topic, class and difficulty, or by
// searching the wording when they remember the question but not its tags.
//
// Editing here changes ONLY the library copy. An assignment that already used a
// question keeps the copy it took, and the children who answered it keep their
// marks — rewording a bank question months later must never quietly change a
// paper somebody has already sat. The screen says so, because a teacher cannot
// be expected to assume it.
//
// Nothing on this page can reach an assignment. It only saves to, reads from
// and tidies the library.

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/api-error";
import { subjectLabel, SUBJECT_LABELS } from "@shared/weekly-report";
import {
  BANK_TEXT, DIFFICULTIES, describeAnswer, typeLabel,
  type BankQuestion, type Difficulty,
} from "@shared/question-bank";
import {
  ArrowLeft, Loader2, Library, Search, Pencil, Trash2, X, Save,
} from "lucide-react";
import logoPath from "@assets/logo.webp";
import { useT } from "@/lib/i18n";

const SUBJECTS = Object.keys(SUBJECT_LABELS);
const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];

/** "Any" rather than an empty string, because a Select cannot hold "". */
const ANY = "__any__";

export default function QuestionBankPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();

  const [subject, setSubject] = useState(ANY);
  const [topic, setTopic] = useState("");
  const [form, setForm] = useState(ANY);
  const [difficulty, setDifficulty] = useState(ANY);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [deleting, setDeleting] = useState<BankQuestion | null>(null);

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const params = new URLSearchParams();
  if (subject !== ANY) params.set("subject", subject);
  if (form !== ANY) params.set("form", form);
  if (difficulty !== ANY) params.set("difficulty", difficulty);
  if (topic.trim()) params.set("topic", topic.trim());
  if (search.trim()) params.set("search", search.trim());

  const { data, isLoading, isError } = useQuery<{ success: boolean; questions: BankQuestion[] }>({
    queryKey: ["/api/question-bank", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/question-bank?${params.toString()}`);
      return res.json();
    },
    enabled: !!teacher,
    staleTime: 0,
  });

  const questions = data?.questions ?? [];
  const filtering = subject !== ANY || form !== ANY || difficulty !== ANY || !!topic.trim() || !!search.trim();

  const clearFilters = () => {
    setSubject(ANY); setForm(ANY); setDifficulty(ANY); setTopic(""); setSearch("");
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/question-bank"] });

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res = await apiRequest("DELETE", `/api/question-bank/${deleting.id}`);
      const body = await res.json();
      if (body.success) {
        toast({ title: t.bankScreen.removed });
        refresh();
      } else {
        toast({ title: body.message || "Could not remove it", variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: apiErrorMessage(error, "Could not remove it. Check your connection."),
        variant: "destructive",
      });
    }
    setDeleting(null);
  };

  if (!teacher) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t.common.dashboard}</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Library className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t.bank.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t.bank.subtitle}</p>
        </div>

        {/* Filters. Stacked on a phone, side by side once there is room. */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.bank.searchPlaceholder}
                className="pl-9"
                data-testid="input-bank-search"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger data-testid="select-bank-subject">
                  <SelectValue placeholder={t.bankScreen.anySubject} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t.bankScreen.anySubject}</SelectItem>
                  {SUBJECTS.map((sub) => (
                    <SelectItem key={sub} value={sub}>{subjectLabel(sub)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={form} onValueChange={setForm}>
                <SelectTrigger data-testid="select-bank-form">
                  <SelectValue placeholder={t.bankScreen.anyClass} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t.bankScreen.anyClass}</SelectItem>
                  {FORMS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger data-testid="select-bank-difficulty">
                  <SelectValue placeholder={t.bankScreen.anyDifficulty} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t.bankScreen.anyDifficulty}</SelectItem>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>{t.bank.difficulties[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t.bankScreen.anyTopic}
                data-testid="input-bank-topic"
              />
            </div>

            {filtering && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                <X className="h-4 w-4 mr-1" /> Clear filters
              </Button>
            )}
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive" data-testid="text-bank-error">
            Couldn't load the question bank. Check your connection and try again.
          </p>
        )}

        {!isLoading && !isError && (
          <p className="text-sm text-muted-foreground" data-testid="text-bank-count">
            {questions.length === 1 ? "1 question" : `${questions.length} questions`}
            {filtering ? " match these filters" : " saved"}
          </p>
        )}

        {!isLoading && !isError && questions.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-bank-empty">
              {filtering ? t.bank.empty : t.bank.emptyLibrary}
            </CardContent>
          </Card>
        )}

        {questions.map((q) => (
          <Card key={q.id} data-testid={`card-bank-question-${q.id}`}>
            <CardContent className="py-4 space-y-3">
              <p className="font-medium" data-testid={`text-bank-question-${q.id}`}>{q.questionText}</p>

              {/* The answer, in words a teacher can check at a glance. */}
              <p className="text-sm" data-testid={`text-bank-answer-${q.id}`}>
                <span className="text-muted-foreground">{t.bank.answer}: </span>
                {describeAnswer(q)}
              </p>

              {q.explanation && (
                <p className="text-xs text-muted-foreground">{q.explanation}</p>
              )}

              {/* All outline: these are neutral facts about a question. The
                  `secondary` variant is the school's RED (see --secondary in
                  index.css), which made a difficulty of "Easy" read as an
                  alarm. Red is kept for things that actually want attention. */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{typeLabel(q.type)}</Badge>
                <Badge variant="outline">{q.maxScore === 1 ? "1 mark" : `${q.maxScore} marks`}</Badge>
                <Badge variant="outline">{subjectLabel(q.subject)}</Badge>
                <Badge variant="outline">{q.topic}</Badge>
                <Badge variant="outline">{q.form}</Badge>
                <Badge variant="outline">{t.bank.difficulties[q.difficulty]}</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(q)} data-testid={`button-edit-${q.id}`}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(q)} data-testid={`button-delete-${q.id}`}>
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>

      {editing && (
        <EditQuestionDialog
          question={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.bankScreen.confirmRemove}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.bank.deleteWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t.bankScreen.keepIt}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete">
              Remove it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Edit one saved question.
 *
 * Deliberately edits the WORDING, the MARKS and the TAGS — not the question
 * type or the shape of its answer key. Changing "multiple choice" into
 * "numeric" in a small dialog is how a half-converted question ends up in the
 * library marking every child wrong; a teacher who wants a different type is
 * better served saving a new question. The answer itself is editable in the
 * form each type actually needs.
 */
function EditQuestionDialog({
  question, onClose, onSaved,
}: {
  question: BankQuestion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [questionText, setQuestionText] = useState(question.questionText);
  const [maxScore, setMaxScore] = useState(String(question.maxScore));
  const [topic, setTopic] = useState(question.topic);
  const [subject, setSubject] = useState(question.subject);
  const [form, setForm] = useState(question.form);
  const [difficulty, setDifficulty] = useState<Difficulty>(question.difficulty);
  const [explanation, setExplanation] = useState(question.explanation ?? "");

  // The answer, in whichever shape this question's type needs.
  const [options, setOptions] = useState<string[]>(question.options ?? []);
  const [correctOption, setCorrectOption] = useState(question.correctOption ?? 0);
  const [correctBool, setCorrectBool] = useState(question.correctBool ?? true);
  const [correctNumber, setCorrectNumber] = useState(
    question.correctNumber != null ? String(question.correctNumber) : "",
  );
  const [tolerance, setTolerance] = useState(
    question.tolerance != null ? String(question.tolerance) : "",
  );
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(question.acceptedAnswers ?? []);

  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const changes: Record<string, unknown> = {
        questionText,
        maxScore: Number(maxScore),
        topic, subject, form, difficulty,
        explanation: explanation.trim() || undefined,
      };

      if (question.type === "multiple_choice") {
        changes.options = options;
        changes.correctOption = correctOption;
      } else if (question.type === "true_false") {
        changes.correctBool = correctBool;
      } else if (question.type === "numeric") {
        changes.correctNumber = correctNumber === "" ? undefined : Number(correctNumber);
        changes.tolerance = tolerance === "" ? undefined : Number(tolerance);
      } else if (question.type === "short_text") {
        changes.acceptedAnswers = acceptedAnswers.filter((a) => a.trim());
      }

      const res = await apiRequest("PATCH", `/api/question-bank/${question.id}`, changes);
      const body = await res.json();
      if (body.success) {
        toast({ title: t.bankScreen.updated });
        onSaved();
      } else {
        toast({ title: body.message || "Could not save the change", variant: "destructive" });
      }
    } catch (error) {
      // An edit refused for leaving the question unmarkable arrives as a thrown
      // 400. The teacher needs to read WHY, not be told their connection failed.
      toast({
        title: apiErrorMessage(error, "Could not save the change. Check your connection."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit saved question</DialogTitle>
          <DialogDescription>{t.bank.editWarning}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bank-edit-text">Question</Label>
            <Textarea
              id="bank-edit-text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              data-testid="input-edit-question-text"
            />
          </div>

          {/* The answer, in the shape this type needs. */}
          {question.type === "multiple_choice" && (
            <div className="space-y-2">
              <Label>Options — tap the circle beside the right one</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={correctOption === i ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCorrectOption(i)}
                    data-testid={`button-edit-correct-${i}`}
                  >
                    {correctOption === i ? "Correct" : "Mark"}
                  </Button>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    data-testid={`input-edit-option-${i}`}
                  />
                </div>
              ))}
            </div>
          )}

          {question.type === "true_false" && (
            <div>
              <Label>The correct answer</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={correctBool ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCorrectBool(true)}
                  data-testid="button-edit-true"
                >
                  True
                </Button>
                <Button
                  type="button"
                  variant={!correctBool ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCorrectBool(false)}
                  data-testid="button-edit-false"
                >
                  False
                </Button>
              </div>
            </div>
          )}

          {question.type === "numeric" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bank-edit-number">Correct number</Label>
                <Input
                  id="bank-edit-number"
                  value={correctNumber}
                  onChange={(e) => setCorrectNumber(e.target.value)}
                  inputMode="decimal"
                  data-testid="input-edit-number"
                />
              </div>
              <div>
                <Label htmlFor="bank-edit-tolerance">Tolerance (optional)</Label>
                <Input
                  id="bank-edit-tolerance"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  inputMode="decimal"
                  data-testid="input-edit-tolerance"
                />
              </div>
            </div>
          )}

          {question.type === "short_text" && (
            <div className="space-y-2">
              <Label>Accepted answers — any one of these counts as correct</Label>
              {acceptedAnswers.map((a, i) => (
                <Input
                  key={i}
                  value={a}
                  onChange={(e) => {
                    const next = [...acceptedAnswers];
                    next[i] = e.target.value;
                    setAcceptedAnswers(next);
                  }}
                  data-testid={`input-edit-accepted-${i}`}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAcceptedAnswers([...acceptedAnswers, ""])}
                data-testid="button-edit-add-accepted"
              >
                Add another
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bank-edit-marks">Marks</Label>
              <Input
                id="bank-edit-marks"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                inputMode="numeric"
                data-testid="input-edit-marks"
              />
            </div>
            <div>
              <Label htmlFor="bank-edit-topic">Topic</Label>
              <Input
                id="bank-edit-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                data-testid="input-edit-topic"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger data-testid="select-edit-subject"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((sub) => (
                    <SelectItem key={sub} value={sub}>{subjectLabel(sub)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={form} onValueChange={setForm}>
                <SelectTrigger data-testid="select-edit-form"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger data-testid="select-edit-difficulty"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>{t.bank.difficulties[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="bank-edit-explanation">Note shown after marking (optional)</Label>
            <Input
              id="bank-edit-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              data-testid="input-edit-explanation"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit">Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="button-save-edit">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
