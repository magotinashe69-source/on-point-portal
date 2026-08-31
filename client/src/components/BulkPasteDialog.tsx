// The "paste a list" dialog, shared by every page that offers one.
//
// The shape is always the same: a box to paste into, a preview underneath that
// shows exactly what will be added before anything happens, notes about what is
// being skipped and why, and a button that says how many will go in. What each
// line *means* is the calling page's business — it does the parsing, hands over
// the rows, and says how to draw one.

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PlusCircle, Loader2 } from "lucide-react";
import type { DuplicateLine, SkippedLine } from "@/lib/bulk-paste";

/** The data-testids each page wants on the shared parts, so they stay stable. */
export interface BulkPasteTestIds {
  textarea: string;
  preview: string;
  rowPrefix: string;   // a row gets `${rowPrefix}${index}`
  duplicates: string;
  skipped: string;
  confirm: string;
  cancel: string;
}

export interface BulkPasteDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;
  description: string;

  /** What is being added, for the counts: e.g. { one: "student", many: "students" }. */
  noun: { one: string; many: string };
  /** Optional tail on the count line, e.g. "to Form 2" — where they are going. */
  countSuffix?: string;

  /** Extra controls that apply to the whole batch (class, subject, and so on). */
  settings?: ReactNode;

  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** A line of help under the box — how to use the extra columns, typically. */
  hint?: ReactNode;

  /** The rows that would actually be added, already filtered by the page. */
  toAdd: T[];
  renderRow: (row: T, index: number) => ReactNode;
  keyOfRow: (row: T, index: number) => string | number;
  /** Shown in place of the list when there is nothing left to add. */
  emptyMessage: string;

  duplicates?: DuplicateLine[];
  skipped?: SkippedLine[];

  busy?: boolean;
  onConfirm: () => void;

  testIds: BulkPasteTestIds;
}

export function BulkPasteDialog<T>({
  open, onOpenChange, title, description, noun, countSuffix, settings,
  value, onValueChange, placeholder, hint,
  toAdd, renderRow, keyOfRow, emptyMessage,
  duplicates = [], skipped = [],
  busy = false, onConfirm, testIds,
}: BulkPasteDialogProps<T>) {
  const count = toAdd.length;
  const countedNoun = count === 1 ? noun.one : noun.many;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {settings}

          <Textarea
            rows={8}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
            className="font-mono text-sm"
            data-testid={testIds.textarea}
          />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

          {/* The preview. Always shown before anything is added, so nothing
              happens that the teacher has not already seen. */}
          {value.trim() !== "" && (
            <div className="rounded-md border" data-testid={testIds.preview}>
              <div className="border-b bg-muted/50 px-3 py-2 text-sm font-medium">
                Preview — {count} {countedNoun} will be added{countSuffix ? ` ${countSuffix}` : ""}
              </div>

              <div className="max-h-52 overflow-y-auto divide-y">
                {toAdd.map((row, i) => (
                  <div
                    key={keyOfRow(row, i)}
                    className="px-3 py-1.5 text-sm"
                    data-testid={`${testIds.rowPrefix}${i}`}
                  >
                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                    {renderRow(row, i)}
                  </div>
                ))}
                {count === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</p>
                )}
              </div>

              {duplicates.length > 0 && (
                <div className="border-t bg-amber-50 px-3 py-2 dark:bg-amber-950/40" data-testid={testIds.duplicates}>
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    {duplicates.length} skipped as duplicate{duplicates.length === 1 ? "" : "s"}:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {duplicates.slice(0, 6).map(d => (
                      <li key={d.lineNumber} className="text-xs text-amber-900/80 dark:text-amber-100/80">
                        {d.label} — {d.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {skipped.length > 0 && (
                <div className="border-t bg-amber-50 px-3 py-2 dark:bg-amber-950/40" data-testid={testIds.skipped}>
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    {skipped.length} line{skipped.length === 1 ? "" : "s"} could not be read:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {skipped.slice(0, 5).map(sk => (
                      <li key={sk.lineNumber} className="text-xs text-amber-900/80 dark:text-amber-100/80">
                        Line {sk.lineNumber}: {sk.reason} — {sk.text.slice(0, 50)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid={testIds.cancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={count === 0 || busy}
            data-testid={testIds.confirm}
          >
            {busy
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding…</>
              : <><PlusCircle className="h-4 w-4 mr-2" />Add {count || ""} {countedNoun}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
