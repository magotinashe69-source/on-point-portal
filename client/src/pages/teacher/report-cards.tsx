// Report cards — the teacher's screen.
//
// Pick a class and a term, build the cards, write a comment against any pupil,
// and print one or the whole class. Nothing here changes a mark; the cards are
// assembled from marks already stored.
//
// Printing is the browser's own dialog, the same as the certificates. Printing
// "all" prints one card per page, which is what a teacher wants at the end of
// term — a class of thirty from one press.

import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/api-error";
import { ReportCardSheet, ReportCardPrintStyles } from "@/components/ReportCardSheet";
import {
  DEFAULT_BOUNDARIES, sortBoundaries, validateBoundaries,
  type GradeBoundary, type ReportCard,
} from "@shared/report-card";
import { ArrowLeft, FileText, Loader2, Printer, Save, SlidersHorizontal } from "lucide-react";
import logoPath from "@assets/logo.webp";
import { serverMessage, useT } from "@/lib/i18n";

const FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"];

/** A sensible default term: the start of this month to today. */
function defaultTerm() {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  return {
    label: `Term ${Math.floor(now.getMonth() / 4) + 1} ${now.getFullYear()}`,
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmt(now),
  };
}

export default function ReportCardsPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState("");
  const [term, setTerm] = useState(defaultTerm);
  const [cards, setCards] = useState<ReportCard[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Which card is being printed. Null prints the whole class.
  const [printing, setPrinting] = useState<number | null>(null);
  const [commenting, setCommenting] = useState<ReportCard | null>(null);
  const [boundariesOpen, setBoundariesOpen] = useState(false);

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const build = async () => {
    if (!form || !term.label.trim()) {
      toast({ title: "Choose a class and name the term", variant: "destructive" });
      return;
    }
    setLoading(true);
    setCards(null);
    try {
      const params = new URLSearchParams({ form, termLabel: term.label, from: term.from, to: term.to });
      const res = await fetch(`/api/report-cards?${params}`);
      const body = await res.json();
      if (body.success) setCards(body.cards);
      else toast({ title: serverMessage(t, body, "Could not build the cards"), variant: "destructive" });
    } catch {
      toast({ title: "Could not build the cards. Check your connection.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const printOne = (studentId: number) => {
    setPrinting(studentId);
    // Let React paint the single card before the print dialog reads the page.
    setTimeout(() => { window.print(); setPrinting(null); }, 120);
  };
  const printAll = () => {
    setPrinting(null);
    setTimeout(() => window.print(), 120);
  };

  if (!teacher) return null;

  const shown = printing === null ? (cards ?? []) : (cards ?? []).filter((c) => c.student.id === printing);

  return (
    <div className="rc-page min-h-screen bg-background">
      <ReportCardPrintStyles />

      <header className="rc-noprint sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        <div className="rc-noprint">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t.reportCard.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t.reportCard.subtitle}</p>
        </div>

        <Card className="rc-noprint">
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.reportCard.pickClass}</Label>
                <Select value={form} onValueChange={setForm}>
                  <SelectTrigger className="mt-1" data-testid="select-rc-form">
                    <SelectValue placeholder={t.reportCard.pickClass} />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs" htmlFor="rc-term">{t.reportCard.termLabel}</Label>
                <Input
                  id="rc-term"
                  className="mt-1"
                  value={term.label}
                  onChange={(e) => setTerm({ ...term, label: e.target.value })}
                  data-testid="input-term-label"
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="rc-from">{t.reportCard.termFrom}</Label>
                <Input id="rc-from" type="date" className="mt-1" value={term.from}
                  onChange={(e) => setTerm({ ...term, from: e.target.value })}
                  data-testid="input-term-from" />
              </div>
              <div>
                <Label className="text-xs" htmlFor="rc-to">{t.reportCard.termTo}</Label>
                <Input id="rc-to" type="date" className="mt-1" value={term.to}
                  onChange={(e) => setTerm({ ...term, to: e.target.value })}
                  data-testid="input-term-to" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={build} disabled={loading} data-testid="button-build">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                {t.reportCard.build}
              </Button>
              <Button variant="outline" onClick={() => setBoundariesOpen(true)} data-testid="button-boundaries">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                {t.reportCard.editBoundaries}
              </Button>
              {cards && cards.length > 0 && (
                <Button variant="outline" onClick={printAll} data-testid="button-print-all">
                  <Printer className="h-4 w-4 mr-2" />
                  {t.reportCard.printAll} ({cards.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {cards && cards.length === 0 && (
          <Card className="rc-noprint">
            <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="text-empty-class">
              No pupils on the register for this class yet.
            </CardContent>
          </Card>
        )}

        {/* The cards. Each has its own Comment and Print above it, which the
            print stylesheet hides. */}
        {shown.map((card) => (
          <div key={card.student.id} className="space-y-2">
            <div className="rc-noprint flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="font-medium">{card.student.fullName}</span>
                <span className="text-xs text-muted-foreground ml-2">ID: {card.student.pupilId}</span>
              </div>
              <div className="flex items-center gap-2">
                {card.comment
                  ? <Badge variant="outline" className="text-xs">Comment saved</Badge>
                  : <Badge variant="outline" className="text-xs text-muted-foreground">No comment</Badge>}
                <Button size="sm" variant="outline" onClick={() => setCommenting(card)}
                  data-testid={`button-comment-${card.student.id}`}>
                  {t.reportCard.editComment}
                </Button>
                <Button size="sm" variant="outline" onClick={() => printOne(card.student.id)}
                  data-testid={`button-print-${card.student.id}`}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
            </div>
            <ReportCardSheet card={card} />
          </div>
        ))}

        {cards && cards.length > 0 && (
          <p className="rc-noprint text-center text-xs text-muted-foreground">
            {t.reportCard.printNote}
          </p>
        )}
      </main>

      {commenting && (
        <CommentDialog
          card={commenting}
          term={term}
          onClose={() => setCommenting(null)}
          onSaved={(text) => {
            setCards((prev) => (prev ?? []).map((c) =>
              c.student.id === commenting.student.id ? { ...c, comment: text } : c));
            setCommenting(null);
          }}
        />
      )}

      {boundariesOpen && (
        <BoundariesDialog
          onClose={() => setBoundariesOpen(false)}
          onSaved={() => { setBoundariesOpen(false); if (cards) build(); }}
        />
      )}
    </div>
  );
}

/** Write or edit the comment that appears on one pupil's card. */
function CommentDialog({
  card, term, onClose, onSaved,
}: {
  card: ReportCard;
  term: { label: string; from: string; to: string };
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [text, setText] = useState(card.comment ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/report-cards/comment", {
        studentId: card.student.id,
        termLabel: term.label, from: term.from, to: term.to,
        comment: text,
      });
      const body = await res.json();
      if (body.success) {
        toast({ title: t.reportCard.commentSaved });
        onSaved(body.comment);
      } else {
        toast({ title: serverMessage(t, body, "Could not save the comment"), variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: apiErrorMessage(error, "Could not save the comment. Check your connection."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card.student.fullName}</DialogTitle>
          <DialogDescription>
            {t.reportCard.comment} for {term.label}. It is saved against this term, so next
            term's comment will not overwrite it.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={t.reportCard.commentPlaceholder}
          data-testid="input-comment"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-comment">Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="button-save-comment">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {t.reportCard.saveComment}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Set the school's own grade boundaries. */
function BoundariesDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { toast } = useToast();
  const [rows, setRows] = useState<GradeBoundary[]>(DEFAULT_BOUNDARIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/report-cards/boundaries");
        const body = await res.json();
        if (body.success) setRows(body.boundaries);
      } catch { /* the defaults above stand */ }
      setLoading(false);
    })();
  }, []);

  // Checked as the teacher types, so a set that cannot be saved says why before
  // the button is pressed rather than after.
  const problems = validateBoundaries(rows);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/report-cards/boundaries", { boundaries: rows });
      const body = await res.json();
      if (body.success) {
        toast({ title: t.reportCard.boundariesSaved });
        onSaved();
      } else {
        toast({ title: serverMessage(t, body, "Could not save the boundaries"), variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: apiErrorMessage(error, "Could not save the boundaries. Check your connection."),
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
          <DialogTitle>{t.reportCard.editBoundaries}</DialogTitle>
          <DialogDescription>
            The lowest mark that earns each grade. These are printed on every report card,
            so a family can read the grade without having to ask what it means here.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {sortBoundaries(rows).map((b) => (
              <div key={b.grade} className="flex items-center gap-2">
                <Input
                  className="w-20"
                  value={b.grade}
                  onChange={(e) => setRows(rows.map((r) => r.grade === b.grade ? { ...r, grade: e.target.value } : r))}
                  data-testid={`input-grade-${b.grade}`}
                />
                <span className="text-sm text-muted-foreground">from</span>
                <Input
                  className="w-24"
                  inputMode="numeric"
                  value={String(b.min)}
                  onChange={(e) => {
                    const n = e.target.value === "" ? NaN : Number(e.target.value);
                    setRows(rows.map((r) => r.grade === b.grade ? { ...r, min: n } : r));
                  }}
                  data-testid={`input-min-${b.grade}`}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            ))}

            {problems.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3" data-testid="text-boundary-problems">
                <ul className="text-sm list-disc pl-5 space-y-0.5">
                  {problems.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={() => setRows(DEFAULT_BOUNDARIES)}
              data-testid="button-reset-boundaries">
              {t.reportCard.resetBoundaries}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-boundaries">Cancel</Button>
          <Button onClick={save} disabled={saving || problems.length > 0} data-testid="button-save-boundaries">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
