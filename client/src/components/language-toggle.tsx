import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANGUAGES, useLanguage, useT } from "@/lib/i18n";

/**
 * English / Português, side by side.
 *
 * Both languages are shown with the current one filled in, rather than one
 * button showing the other language. A single button reading "PT" is ambiguous
 * in the worst possible place: a parent who is not sure whether it means "you
 * are reading Portuguese" or "tap for Portuguese" has to tap it to find out,
 * and the tap they are afraid of is the one that changes the language of a
 * screen they were managing to read.
 *
 * Each name is written in its OWN language — "English", "Português" — because
 * somebody looking for Portuguese is looking for the word "Português", not for
 * "Portuguese" spelled the English way.
 *
 * It sits beside the theme toggle in the header, and it is on the login pages
 * too: the login page is the first thing a family sees, and needing to be
 * signed in before you can read the screen would be no use to anyone.
 */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const t = useT();

  return (
    <div
      className="flex items-center rounded-md border p-0.5"
      role="group"
      aria-label={t.common.language}
      data-testid="language-toggle"
    >
      <Languages className="h-4 w-4 mx-1.5 text-muted-foreground shrink-0" aria-hidden="true" />
      {LANGUAGES.map(({ code, name }) => (
        <Button
          key={code}
          type="button"
          variant={language === code ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          data-testid={`button-language-${code}`}
        >
          {name}
        </Button>
      ))}
    </div>
  );
}
