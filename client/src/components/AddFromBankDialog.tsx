// "Add from bank" — pulling saved questions into the assignment being written.
//
// The questions added are COPIES. The assignment gets its own independent
// version of each one, with a fresh question id, and nothing links it back to
// the library row afterwards.
//
// That is the same rule the Question Bank screen already states in the other
// direction: editing a saved question never changes a paper. If this made a
// reference instead of a copy, that promise would break the first time somebody
// tidied the library — a paper a class had already answered would change under
// them and their marks would stop matching the questions.
//
// The filters start on the assignment's own subject and class, because that is
// what a teacher writing that paper is looking for. They can be widened.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { subjectLabel, SUBJECT_LABELS } from "@shared/weekly-report";
import {
  BANK_TEXT, DIFFICULTIES, describeAnswer, typeLabel, type BankQuestion,
} from "@shared/question-bank";
import { Library, Loader2, Search } from "lucide-react";

const SUBJECTS = Object.keys(SUBJECT_LABELS);
const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];

/** "Any" rather than an empty string, because a Select cannot hold "". */
const ANY = "__any__";

export function AddFromBankDialog({
  defaultSubject, defaultForm, alreadyAdded, onAdd, onClose,
}: {
  defaultSubject: string;
  defaultForm: string;
  /** Question wordings already on the paper, so repeats can be pointed out. */
  alreadyAdded: string[];
  onAdd: (questions: BankQuestion[]) => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(defaultSubject || ANY);
  const [form, setForm] = useState(defaultForm || ANY);
  const [difficulty, setDifficulty] = useState(ANY);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const params = new URLSearchParams();
  if (subject !== ANY) params.set("subject", subject);
  if (form !== ANY) params.set("form", form);
  if (difficulty !== ANY) params.set("difficulty", difficulty);
  if (search.trim()) params.set("search", search.trim());

  const { data, isLoading } = useQuery<{ success: boolean; questions: BankQuestion[] }>({
    queryKey: ["/api/question-bank", "picker", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/question-bank?${params.toString()}`);
      return res.json();
    },
    staleTime: 0,
  });

  const questions = data?.questions ?? [];
  const onPaper = new Set(alreadyAdded.map((t) => t.trim().toLowerCase()));

  const toggle = (id: number) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const add = () => {
    // Added in the order they are shown, so what a teacher saw is what the
    // paper gets rather than the order they happened to tick them in.
    onAdd(questions.filter((q) => picked.has(q.id)));
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Add from Question Bank
          </DialogTitle>
          <DialogDescription>
            Adds a copy to this assignment. The saved question stays as it is,
            and editing it later will not change this paper.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={BANK_TEXT.searchPlaceholder}
              className="pl-9"
              data-testid="input-pick-search"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger data-testid="select-pick-subject"><SelectValue placeholder="Any subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any subject</SelectItem>
                {SUBJECTS.map((sub) => (
                  <SelectItem key={sub} value={sub}>{subjectLabel(sub)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={form} onValueChange={setForm}>
              <SelectTrigger data-testid="select-pick-form"><SelectValue placeholder="Any class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any class</SelectItem>
                {FORMS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger data-testid="select-pick-difficulty"><SelectValue placeholder="Any difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any difficulty</SelectItem>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>{BANK_TEXT.difficulties[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {!isLoading && questions.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-pick-empty">
              {BANK_TEXT.empty}
            </p>
          )}

          <div className="space-y-2">
            {questions.map((q) => {
              const repeat = onPaper.has(q.questionText.trim().toLowerCase());
              return (
                <label
                  key={q.id}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover-elevate"
                  data-testid={`row-pick-${q.id}`}
                >
                  <Checkbox
                    checked={picked.has(q.id)}
                    onCheckedChange={() => toggle(q.id)}
                    data-testid={`checkbox-pick-${q.id}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{q.questionText}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {typeLabel(q.type)} · {q.maxScore === 1 ? "1 mark" : `${q.maxScore} marks`}
                      {" · "}{BANK_TEXT.answer}: {describeAnswer(q)}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <Badge variant="outline" className="text-xs">{subjectLabel(q.subject)}</Badge>
                      <Badge variant="outline" className="text-xs">{q.topic}</Badge>
                      <Badge variant="outline" className="text-xs">{q.form}</Badge>
                      <Badge variant="outline" className="text-xs">{BANK_TEXT.difficulties[q.difficulty]}</Badge>
                      {/* Pointed out, not blocked: a teacher may well want the
                          same question twice, and only they can say. */}
                      {repeat && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-already-${q.id}`}>
                          Already on this paper
                        </Badge>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-pick">Cancel</Button>
          <Button onClick={add} disabled={picked.size === 0} data-testid="button-confirm-pick">
            {picked.size === 0
              ? "Choose some questions"
              : picked.size === 1 ? "Add 1 question" : `Add ${picked.size} questions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
