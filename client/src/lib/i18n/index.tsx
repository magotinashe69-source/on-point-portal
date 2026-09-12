/**
 * The language the interface is shown in.
 *
 * Two languages, both built into the app: English and Portuguese (European /
 * Mozambican, which is what the school and its families use). Deliberately no
 * translation library — the whole job here is "pick one of two objects", and a
 * translation engine is a lot of download for a phone on a slow connection,
 * the same reasoning as the hand-written store in lib/offline-db.ts.
 *
 * Switching costs nothing: both dictionaries are plain objects built once when
 * the app loads, so changing language swaps a reference and React re-renders.
 * Nothing is fetched, parsed or compiled, and there is no loading state to
 * design around.
 *
 * The choice is kept on the DEVICE (localStorage), not on the account. It has
 * to work on the login page, where nobody is signed in yet — a parent who reads
 * Portuguese needs the login page in Portuguese to get as far as logging in.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en } from "./en";
import { pt } from "./pt";

export type Language = "en" | "pt";

/**
 * The shape both dictionaries share.
 *
 * The wording groups in `shared/` are declared `as const`, which makes each of
 * their values its own literal TYPE — `average: "Average"` is not `string`, it
 * is the type `"Average"`. Used directly that would demand the Portuguese
 * dictionary also say "Average", which is the opposite of the point. Widen puts
 * every one of them back to `string`, while keeping the KEYS exactly as they
 * are and leaving function signatures alone.
 *
 * So: Portuguese must have every key English has, with the same shape, and may
 * say anything it likes in them. A missing or misspelled key is a build error
 * from `npm run check` rather than a blank label a family finds first.
 */
type Widen<T> =
  T extends string ? string
  // The RETURN type is widened too. Without that, an English function written
  // as `n === 1 ? "…item…" : "…items…"` has a type of those two exact
  // sentences, and Portuguese would be required to return the English ones.
  : T extends (...args: infer A) => infer R ? (...args: A) => Widen<R>
  : { [K in keyof T]: Widen<T[K]> };

export type Translation = Widen<typeof en>;

const DICTIONARIES: Record<Language, Translation> = { en, pt };

const STORAGE_KEY = "onpoint-language";

/** What the toggle offers, in the order it offers it. */
export const LANGUAGES: { code: Language; name: string }[] = [
  { code: "en", name: en.languageName },
  { code: "pt", name: pt.languageName },
];

function readSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "pt") return saved;
  } catch {
    // A private window can refuse localStorage. English rather than a crash.
  }
  return "en";
}

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translation;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Read in the initialiser, not in an effect: an effect runs AFTER the first
  // paint, so a Portuguese-speaking family would see the whole page flash up in
  // English and then change under them.
  const [language, setLanguageState] = useState<Language>(readSavedLanguage);

  // Tells the browser what language the page is in, which is what a screen
  // reader uses to choose a voice and how to pronounce it.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(next: Language) {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage refused. The choice still applies for this visit.
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: DICTIONARIES[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

function useLanguageContext(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useT must be used inside a LanguageProvider");
  return context;
}

/**
 * The interface text, in the language currently chosen.
 *
 *   const t = useT();
 *   <CardTitle>{t.login.student.title}</CardTitle>
 *
 * Never use it for anything that came out of the database.
 */
export function useT(): Translation {
  return useLanguageContext().t;
}

/**
 * Every subject code the school uses, in the order they are offered.
 *
 * Screens with a subject filter map over this rather than listing the twelve
 * again, so a subject added here reaches every filter at once. Before this the
 * same list was typed out in full on six different screens.
 */
export const SUBJECT_CODES = Object.keys(en.subjects);

/**
 * A subject as somebody should read it.
 *
 * Falls back to tidying the code itself (BUSINESS_STUDIES -> "Business
 * Studies") so a subject the school adds later still reads properly before
 * anyone adds it to the dictionary — the same fallback subjectLabel() in
 * shared/weekly-report.ts has always had.
 *
 * The cast is because the dictionary lists its subjects by name, which is what
 * makes a missing Portuguese one a build error; the code being looked up is
 * whatever the database holds.
 */
export function subjectName(t: Translation, subject: string): string {
  const known = (t.subjects as Record<string, string>)[subject];
  if (known) return known;
  return subject
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * A date spelled out in the reader's own language: "9 September 2026", or
 * "9 de setembro de 2026". Used where a date is READ rather than scanned — a
 * certificate, an award — and an empty string for a date that will not parse,
 * because a certificate with "Invalid Date" on it is worse than one with none.
 */
export function longDate(t: Translation, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return t.dates.long(d.getDate(), t.dates.months[d.getMonth()], d.getFullYear());
}

/**
 * What the SERVER said, in the reader's own language.
 *
 * A refusal carries a `code` naming what happened (see shared/server-messages.ts)
 * and an English sentence beside it. This prefers the code, because that is the
 * one the dictionary can translate, and falls back to the sentence for a code
 * this build does not know yet — so a message added on the server can never
 * show up as a blank space, only as English until somebody translates it.
 *
 *     toast({ description: serverMessage(t, data) });
 */
export function serverMessage(t: Translation, body: unknown, fallback?: string): string {
  const reply = body as { code?: string; message?: string } | null | undefined;
  const known = reply?.code ? (t.server as Record<string, string>)[reply.code] : undefined;
  return known ?? reply?.message ?? fallback ?? t.errors.connection;
}

/** The chosen language and a way to change it. For the toggle. */
export function useLanguage(): { language: Language; setLanguage: (l: Language) => void } {
  const { language, setLanguage } = useLanguageContext();
  return { language, setLanguage };
}
