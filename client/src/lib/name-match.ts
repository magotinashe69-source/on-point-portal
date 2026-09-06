// Matching a pasted name to a pupil already on the register.
//
// The Master Student Database and this portal were typed up by different
// people at different times, so the same child is "José Marí­a Banda" in one
// and "Jose Maria Banda" in the other, or "Tendai Moyo" against "Tendia Moyo".
// A backfill that only accepted exact matches would reject most of a real
// roll, so this module decides how close is close enough — and, just as
// importantly, when two pupils are so alike that a person has to choose.
//
// Nothing here knows any actual names. Everything is compared at runtime
// against whatever is on the register and whatever was pasted.

/**
 * Reduce a name to the form we compare on: no accents, no punctuation, no
 * double spaces, all lower case.
 *
 * NFD splits an accented letter into the plain letter plus its mark, and the
 * mark is then dropped, so "é" and "e" compare equal. This is deliberate for
 * matching only — the name shown back to the teacher is always the original.
 */
export function normaliseName(name: string): string {
  return name
    // Invisible characters survive a copy out of Word or a spreadsheet. A soft
    // hyphen or a zero-width space is not punctuation between two words, it is
    // nothing, so it is removed rather than turned into a space -- otherwise
    // "Maria" arrives as "Mari a" and matches nobody.
    .replace(/[­​-‍﻿]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // combining accents
    .replace(/[^a-z0-9\s]/gi, " ")   // punctuation, hyphens, apostrophes
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** The words of a normalised name, for comparing "Tendai" against "Tendai Moyo". */
export function nameTokens(name: string): string[] {
  const n = normaliseName(name);
  return n === "" ? [] : n.split(" ");
}

/**
 * Levenshtein edit distance, capped so a hopeless pair costs little to reject.
 * Two rows of the matrix are enough; the full grid is never needed.
 */
export function editDistance(a: string, b: string, cap = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowBest = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowBest) rowBest = curr[j];
    }
    // Every path through this row is already worse than the cap.
    if (rowBest > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

/** How alike two names are, 0 (nothing in common) to 1 (identical once normalised). */
export function similarity(a: string, b: string): number {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (x === "" || y === "") return 0;
  if (x === y) return 1;

  const longest = Math.max(x.length, y.length);
  const distance = editDistance(x, y, Math.ceil(longest * 0.35));
  return Math.max(0, 1 - distance / longest);
}

/**
 * Does one name look like a shortened form of the other — "Tendai" against
 * "Tendai Moyo", or a middle name dropped? True only when every word of the
 * shorter name appears in the longer one, and the shorter has at least one
 * word, so it never fires on an empty string.
 */
export function isSubsetName(a: string, b: string): boolean {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (x.length === 0 || y.length === 0) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length === long.length) return false;
  return short.every(t => long.includes(t));
}

/** How confident we are in a single proposed pairing. */
export type MatchKind = "exact" | "close" | "ambiguous" | "none";

export interface Candidate<S> {
  student: S;
  score: number;      // 1 for an exact match, otherwise the similarity
  reason: string;     // shown next to the name so the teacher can judge it
}

export interface NameMatch<S> {
  kind: MatchKind;
  candidates: Candidate<S>[];  // best first; empty when kind is "none"
}

// One transposition in a name of ordinary length scores about 0.82, and a
// transposition is the commonest typing slip there is, so the bar sits just
// below it. Two different surnames score far lower and are never offered.
const CLOSE_ENOUGH = 0.80;
const TOO_CLOSE_APART = 0.06; // two candidates this alike cannot be told apart

/**
 * Find the pupil a pasted name refers to.
 *
 * Returns "exact" only when exactly one pupil matches once accents and
 * punctuation are set aside. Anything less certain comes back as "close" with
 * the best candidate, or "ambiguous" when two pupils are too alike to choose
 * between — which a person has to settle, not a threshold.
 */
export function matchName<S>(
  pasted: string,
  students: S[],
  nameOf: (s: S) => string,
): NameMatch<S> {
  const target = normaliseName(pasted);
  if (target === "") return { kind: "none", candidates: [] };

  const exact = students.filter(s => normaliseName(nameOf(s)) === target);
  if (exact.length === 1) {
    return { kind: "exact", candidates: [{ student: exact[0], score: 1, reason: "Exact match" }] };
  }
  if (exact.length > 1) {
    return {
      kind: "ambiguous",
      candidates: exact.map(s => ({ student: s, score: 1, reason: "Same name as another pupil" })),
    };
  }

  const scored: Candidate<S>[] = [];
  for (const s of students) {
    const name = nameOf(s);
    const score = similarity(pasted, name);
    if (score >= CLOSE_ENOUGH) {
      scored.push({ student: s, score, reason: `Spelling differs (${Math.round(score * 100)}% alike)` });
    } else if (isSubsetName(pasted, name)) {
      // A shortened name is a weaker signal than a near-spelling, so it sits
      // below the spelling matches when both turn up.
      scored.push({ student: s, score: 0.8, reason: "Part of the name matches" });
    }
  }

  if (scored.length === 0) return { kind: "none", candidates: [] };

  scored.sort((a, b) => b.score - a.score);

  // Two candidates that are nearly as good as each other are not a match, they
  // are a question. Saying "did you mean A?" when B is just as likely is how a
  // card ends up on the wrong child.
  if (scored.length > 1 && scored[0].score - scored[1].score < TOO_CLOSE_APART) {
    return { kind: "ambiguous", candidates: scored.slice(0, 4) };
  }

  return { kind: "close", candidates: scored.slice(0, 4) };
}
