// Linking a whole class of attendance cards to pupils in one go.
//
// Doing this a pupil at a time through the edit dialog is not realistic for a
// roll of a hundred, but a bulk link is exactly where a card quietly lands on
// the wrong child. So nothing is saved until a person has looked at every
// pairing: the paste is matched, the matches are shown with how confident each
// one is, and only ticked rows are written.
//
// Two rules the code enforces rather than trusts:
//   * a studentId is never sent, so a backfill cannot renumber a pupil;
//   * a card already on another pupil is refused before saving, not after.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Check, HelpCircle, Loader2 } from "lucide-react";
import { parsePastedCardCodes, type SkippedLine } from "@/lib/bulk-paste";
import { matchName, type MatchKind } from "@/lib/name-match";
import type { Student } from "@shared/schema";

/** One pasted line, once we have decided who it refers to. */
interface Row {
  lineNumber: number;
  code: string;
  pastedName: string;
  kind: MatchKind;
  student: Student | null;      // the proposed pupil, when there is one
  alternatives: Student[];      // other candidates, for an ambiguous line
  reason: string;               // why this row is what it is
  blocked: string | null;       // set when it cannot be saved at all
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  /** Saves one link. Resolves to an error message, or null when it worked. */
  onSave: (studentId: number, code: string) => Promise<string | null>;
  onDone: () => void;
}

export function QrBackfillDialog({ open, onOpenChange, students, onSave, onDone }: Props) {
  const [pasted, setPasted] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; failed: string[] } | null>(null);

  const { rows, skipped } = useMemo<{ rows: Row[]; skipped: SkippedLine[] }>(() => {
    if (!reviewing) return { rows: [], skipped: [] };

    const parsed = parsePastedCardCodes(pasted);

    // Two passes. The first pairs each line with a pupil; the second looks
    // across the whole list for clashes, which no single line can see.
    const first: Row[] = parsed.rows.map(line => {
      const m = matchName(line.fullName, students, s => s.fullName);
      const best = m.candidates[0];
      return {
        lineNumber: line.lineNumber,
        code: line.code,
        pastedName: line.fullName,
        kind: m.kind,
        student: m.kind === "exact" || m.kind === "close" ? best.student : null,
        alternatives: m.kind === "ambiguous" ? m.candidates.map(c => c.student) : [],
        reason:
          m.kind === "none"
            ? "No pupil on the register looks like this name"
            : m.kind === "ambiguous"
              ? "More than one pupil could be this name"
              : best.reason,
        blocked: null,
      };
    });

    // Clashes across the list and against the register.
    const codeCounts = new Map<string, number>();
    const studentCounts = new Map<number, number>();
    for (const r of first) {
      codeCounts.set(r.code, (codeCounts.get(r.code) ?? 0) + 1);
      if (r.student) studentCounts.set(r.student.id, (studentCounts.get(r.student.id) ?? 0) + 1);
    }

    const rows = first.map(r => {
      let blocked: string | null = null;

      if ((codeCounts.get(r.code) ?? 0) > 1) {
        blocked = "This card code appears more than once in the pasted list";
      } else if (r.student && (studentCounts.get(r.student.id) ?? 0) > 1) {
        blocked = "Two lines both point at this pupil";
      } else if (r.student) {
        const heldByAnother = students.find(s => s.qrCode === r.code && s.id !== r.student!.id);
        if (heldByAnother) {
          blocked = `Card already belongs to ${heldByAnother.fullName}`;
        }
      }

      return { ...r, blocked };
    });

    return { rows, skipped: parsed.skipped };
  }, [reviewing, pasted, students]);

  const linkable = rows.filter(r => r.student && !r.blocked);
  const needsYou = rows.filter(r => !r.student || r.blocked);
  const ticked = linkable.filter(r => approved[r.lineNumber]);

  function review() {
    setResult(null);
    setReviewing(true);
    // Exact matches start ticked; anything less certain has to be ticked on
    // purpose, so a spelling guess is never saved by pressing straight through.
    const initial: Record<number, boolean> = {};
    const parsed = parsePastedCardCodes(pasted);
    for (const line of parsed.rows) {
      const m = matchName(line.fullName, students, s => s.fullName);
      initial[line.lineNumber] = m.kind === "exact";
    }
    setApproved(initial);
  }

  async function save() {
    setSaving(true);
    const failed: string[] = [];
    let saved = 0;
    for (const r of ticked) {
      // Only the card code goes up. The studentId is never in this payload,
      // so a backfill cannot renumber anyone even if the server would let it.
      const err = await onSave(r.student!.id, r.code);
      if (err) failed.push(`Line ${r.lineNumber} (${r.code}): ${err}`);
      else saved++;
    }
    setSaving(false);
    setResult({ saved, failed });
    onDone();
  }

  function close() {
    setPasted("");
    setReviewing(false);
    setApproved({});
    setResult(null);
    onOpenChange(false);
  }

  const alreadyLinked = (s: Student) => s.qrCode && s.qrCode !== "";

  return (
    <Dialog open={open} onOpenChange={o => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Link cards to pupils</DialogTitle>
          <DialogDescription>
            Paste one line per card, as <strong>card code | full name</strong>. A tab works
            instead of the bar, so a column pair copied from a spreadsheet can go straight in.
            Nothing is saved until you tick it.
          </DialogDescription>
        </DialogHeader>

        {!reviewing ? (
          <div className="space-y-3 py-2">
            <Label htmlFor="qr-paste">Card codes and names</Label>
            <Textarea
              id="qr-paste"
              value={pasted}
              onChange={e => setPasted(e.target.value)}
              rows={12}
              className="font-mono text-body-compact-01"
              placeholder={"CODE | Full Name\nCODE | Full Name"}
              data-testid="input-qr-paste"
            />
            <p className="text-xs text-muted-foreground">
              Names are matched against the register, ignoring accents, punctuation and small
              spelling differences. Anything uncertain is shown for you to decide.
            </p>
          </div>
        ) : result ? (
          <div className="py-4 space-y-3" data-testid="qr-backfill-result">
            <p className="font-medium">
              {result.saved} card{result.saved === 1 ? "" : "s"} linked.
            </p>
            {result.failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  {result.failed.length} did not save:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {result.failed.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2 space-y-4 max-h-[26rem] overflow-y-auto">
            {linkable.length > 0 && (
              <div className="space-y-2">
                <p className="text-label-01 uppercase tracking-wide text-muted-foreground">
                  Ready to link — {ticked.length} of {linkable.length} ticked
                </p>
                {linkable.map(r => (
                  <label
                    key={r.lineNumber}
                    className="flex items-start gap-3 rounded-sm border p-3 cursor-pointer"
                    data-testid={`qr-row-${r.lineNumber}`}
                  >
                    <Checkbox
                      checked={!!approved[r.lineNumber]}
                      onCheckedChange={v =>
                        setApproved(a => ({ ...a, [r.lineNumber]: v === true }))
                      }
                      data-testid={`qr-approve-${r.lineNumber}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-body-compact-01">
                        <span className="font-mono font-medium">{r.code}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{r.student!.fullName}</span>
                        <span className="text-muted-foreground">
                          {r.student!.studentId} · {r.student!.form}
                        </span>
                      </div>
                      <p className="text-caption-01 text-muted-foreground mt-0.5">
                        {r.kind === "exact" ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="h-3 w-3" /> {r.reason}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            Pasted as &ldquo;{r.pastedName}&rdquo; · {r.reason}
                          </span>
                        )}
                        {alreadyLinked(r.student!) && r.student!.qrCode !== r.code && (
                          <span className="block text-amber-700 dark:text-amber-400">
                            Replaces the card already on this pupil ({r.student!.qrCode})
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {needsYou.length > 0 && (
              <div className="space-y-2">
                <p className="text-label-01 uppercase tracking-wide text-muted-foreground">
                  Needs a decision — {needsYou.length}
                </p>
                {needsYou.map(r => (
                  <div
                    key={r.lineNumber}
                    className="rounded-sm border border-destructive/40 p-3"
                    data-testid={`qr-unmatched-${r.lineNumber}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap text-body-compact-01">
                      <span className="font-mono font-medium">{r.code}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{r.pastedName}</span>
                    </div>
                    <p className="text-caption-01 text-destructive mt-0.5 inline-flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" /> {r.blocked ?? r.reason}
                    </p>
                    {r.alternatives.length > 0 && (
                      <p className="text-caption-01 text-muted-foreground mt-1">
                        Could be: {r.alternatives.map(s => `${s.fullName} (${s.studentId})`).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
                <p className="text-caption-01 text-muted-foreground">
                  These are left alone. Correct the spelling in your list and paste again, or link
                  them one at a time from the pupil&rsquo;s own row.
                </p>
              </div>
            )}

            {skipped.length > 0 && (
              <div className="space-y-1">
                <p className="text-label-01 uppercase tracking-wide text-muted-foreground">
                  Lines skipped — {skipped.length}
                </p>
                {skipped.map(s => (
                  <p key={s.lineNumber} className="text-caption-01 text-muted-foreground">
                    Line {s.lineNumber}: {s.reason} — &ldquo;{s.text}&rdquo;
                  </p>
                ))}
              </div>
            )}

            {rows.length === 0 && skipped.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing to read in that paste. Each line needs a card code and a name.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={close} data-testid="button-qr-close">Close</Button>
          ) : !reviewing ? (
            <>
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={review} disabled={pasted.trim() === ""} data-testid="button-qr-review">
                Check matches
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setReviewing(false)} data-testid="button-qr-back">
                Back to the list
              </Button>
              <Button onClick={save} disabled={ticked.length === 0 || saving} data-testid="button-qr-save">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Link {ticked.length} card{ticked.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
