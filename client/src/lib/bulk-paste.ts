// Shared plumbing for the "paste a list" dialogs.
//
// Several teacher pages let you paste a block of text instead of filling the
// same dialog over and over — questions, students, resources. They all read the
// text the same way: one item per line, with the fields separated by a bar.
// Only the meaning of the fields differs, so the splitting lives here and each
// page decides what its own columns mean.

/** One usable line from a pasted block, already split into its fields. */
export interface PastedLine {
  lineNumber: number; // 1-based, so a message can point at the offending line
  text: string;       // the whole line as typed, for showing back to the teacher
  parts: string[];    // the bar-separated fields, trimmed
}

/** A line we could not use, and the plain-language reason why. */
export interface SkippedLine {
  lineNumber: number;
  text: string;
  reason: string;
}

/** Something we understood but are not adding, because it is already there. */
export interface DuplicateLine {
  lineNumber: number;
  label: string;  // what to call it in the list, usually the name or title
  reason: string;
}

// Fields may be separated by a bar or by a tab — a tab is what you get when a
// list is copied out of a spreadsheet, and a teacher should not have to care
// which they pasted.
const FIELD_SEPARATOR = /\s*[|\t]\s*/;

/**
 * Split a pasted block into lines with their fields.
 *
 * Blank lines are dropped — they are just spacing. Nothing else is judged here:
 * a line with a missing field still comes back, so the calling page can explain
 * what is wrong with it rather than losing it silently.
 */
export function splitPastedLines(raw: string): PastedLine[] {
  const lines: PastedLine[] = [];

  raw.split("\n").forEach((line, i) => {
    const text = line.replace("\r", "").trim();
    if (text === "") return;
    lines.push({
      lineNumber: i + 1,
      text,
      parts: text.split(FIELD_SEPARATOR).map(p => p.trim()),
    });
  });

  return lines;
}

/**
 * Split a list into what to add and what to skip, using a key that decides
 * whether two entries are the same thing (a pupil's name, a resource's link).
 *
 * Anything already present is skipped, and so is a repeat within the pasted
 * list itself — so pasting the same block twice adds nothing the second time.
 */
export function separateDuplicates<T>(
  rows: T[],
  options: {
    keyOf: (row: T) => string;
    labelOf: (row: T) => string;
    lineNumberOf: (row: T) => number;
    existingKeys: Set<string>;
    existingReason: string;
    repeatedReason?: string;
  },
): { toAdd: T[]; duplicates: DuplicateLine[] } {
  const toAdd: T[] = [];
  const duplicates: DuplicateLine[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = options.keyOf(row).trim().toLowerCase();
    const entry = { lineNumber: options.lineNumberOf(row), label: options.labelOf(row) };

    if (options.existingKeys.has(key)) {
      duplicates.push({ ...entry, reason: options.existingReason });
    } else if (seen.has(key)) {
      duplicates.push({ ...entry, reason: options.repeatedReason ?? "Repeated in this list" });
    } else {
      seen.add(key);
      toAdd.push(row);
    }
  }

  return { toAdd, duplicates };
}
