// "Save to Question Bank" — copying one question out of an assignment and into
// the library.
//
// It is a COPY, in one direction only. The assignment is not changed, not
// re-saved, and not linked to the library row: a teacher can bank a question
// and carry on writing the paper as if nothing happened, and editing the banked
// copy later cannot reach back into the paper.
//
// The tags are what make a question findable again, and an assignment already
// knows most of them — its subject, its class and its topic. Those are filled
// in for the teacher, who only has to say how hard the question is. All of them
// stay editable, because a paper's topic is often broader than the one question
// ("Fractions" on a paper called "Revision").

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/api-error";
import { SUBJECT_LABELS } from "@shared/weekly-report";
import {
  BANK_TEXT, DIFFICULTIES, describeAnswer, isBankType, typeLabel,
  validateBankQuestion, type Difficulty,
} from "@shared/question-bank";
import { Library, Loader2, Save } from "lucide-react";
import { serverMessage, subjectName, useT } from "@/lib/i18n";

const SUBJECTS = Object.keys(SUBJECT_LABELS);
const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];

/** The question being banked, in the shape the assignment form holds it. */
export interface BankableQuestion {
  questionText: string;
  type: string;
  maxScore: number;
  options?: string[];
  correctOption?: number;
  correctBool?: boolean;
  correctNumber?: number;
  tolerance?: number;
  acceptedAnswers?: string[];
  explanation?: string;
}

export function SaveToBankDialog({
  question, defaultSubject, defaultForm, defaultTopic, onClose,
}: {
  question: BankableQuestion;
  defaultSubject: string;
  defaultForm: string;
  defaultTopic: string;
  onClose: () => void;
}) {
  const t = useT();
  const { toast } = useToast();

  const [subject, setSubject] = useState(defaultSubject || SUBJECTS[0]);
  const [form, setForm] = useState(defaultForm || FORMS[0]);
  const [topic, setTopic] = useState(defaultTopic || "");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [saving, setSaving] = useState(false);

  // A written question is marked by hand, so there is no answer to save. Said
  // plainly here rather than letting the save fail with a validation message
  // that would read like a bug.
  const bankable = isBankType(question.type);

  // Only the fields this question's type actually uses are sent. Sending a
  // numeric answer along with a true/false question would put a second, unused
  // answer key on the row for somebody to trip over later.
  const answerFields = (): Record<string, unknown> => {
    switch (question.type) {
      case "multiple_choice":
        return { options: question.options ?? [], correctOption: question.correctOption };
      case "true_false":
        return { correctBool: question.correctBool };
      case "numeric":
        return { correctNumber: question.correctNumber, tolerance: question.tolerance };
      case "short_text":
        return {
          acceptedAnswers: (question.acceptedAnswers ?? []).filter((a) => a && a.trim()),
        };
      default:
        return {};
    }
  };

  const payload = () => ({
    questionText: question.questionText,
    type: question.type,
    maxScore: question.maxScore,
    explanation: question.explanation?.trim() || undefined,
    ...answerFields(),
    subject, topic, form, difficulty,
  });

  // Checked before sending so the teacher is told what is missing without a
  // round trip. The server checks again — this is a convenience, not the guard.
  // createdById is added by the server from the session, so it is stubbed here.
  const problems = bankable
    ? validateBankQuestion({ ...payload(), createdById: 0 } as any)
    : [t.bank.cannotSaveWritten];

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/question-bank", payload());
      const body = await res.json();
      if (body.success) {
        toast({ title: t.bank.saved });
        // So the Question Bank screen shows it straight away if it is open.
        queryClient.invalidateQueries({ queryKey: ["/api/question-bank"] });
        onClose();
      } else {
        toast({ title: serverMessage(t, body, "Could not save it"), variant: "destructive" });
      }
    } catch (error) {
      // A refusal (400) arrives here as a thrown error, so the server's own
      // words are dug back out. Showing "check your connection" for a question
      // that is merely incomplete would send a teacher looking at their wifi.
      toast({
        title: apiErrorMessage(error, "Could not save it. Check your connection."),
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
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Save to Question Bank
          </DialogTitle>
          <DialogDescription>
            Saves a copy for reuse. Your assignment is not changed.
          </DialogDescription>
        </DialogHeader>

        {!bankable ? (
          <p className="text-sm text-muted-foreground" data-testid="text-cannot-bank">
            {t.bank.cannotSaveWritten}
          </p>
        ) : (
          <div className="space-y-4">
            {/* What is being saved, so a teacher can see it is the right one. */}
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-sm font-medium" data-testid="text-bank-preview-question">
                {question.questionText || <span className="text-muted-foreground">(no question text yet)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {typeLabel(question.type)} · {question.maxScore === 1 ? "1 mark" : `${question.maxScore} marks`}
                {" · "}{t.bank.answer}: {describeAnswer(question)}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger data-testid="select-bank-save-subject"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((sub) => (
                      <SelectItem key={sub} value={sub}>{subjectName(t, sub)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Class</Label>
                <Select value={form} onValueChange={setForm}>
                  <SelectTrigger data-testid="select-bank-save-form"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="bank-save-topic">Topic</Label>
                <Input
                  id="bank-save-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Fractions"
                  data-testid="input-bank-save-topic"
                />
              </div>

              <div>
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                  <SelectTrigger data-testid="select-bank-save-difficulty"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>{t.bank.difficulties[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* What is still missing, in the words the validator uses, so the
                teacher fixes it here rather than being refused on save. */}
            {problems.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3" data-testid="text-bank-save-problems">
                <p className="text-sm font-medium mb-1">Before this can be saved:</p>
                <ul className="text-sm list-disc pl-5 space-y-0.5">
                  {problems.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-bank-save">Cancel</Button>
          <Button
            onClick={save}
            disabled={saving || !bankable || problems.length > 0}
            data-testid="button-confirm-bank-save"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save to bank
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
