import { Link } from "wouter";
import { useT } from "@/lib/i18n";
import logoPath from "@assets/logo.webp";

const GOLD = "#BF9000";

// The page for an address that does not exist — a mistyped link, an old
// bookmark, a page that has moved.
//
// In the school's navy and gold, like the placeholder pages (coming-soon.tsx),
// so it reads as part of On Point rather than as something broken. It used to
// be a plain grey card with a note meant for a developer ("Did you forget to
// add the page to the router?"), which is the last thing a parent should read.
//
// One way out, and it is the main page: every portal's login is one tap away
// from there, so nobody has to know which one they were looking for.
export default function NotFound() {
  const t = useT();
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center text-white"
      style={{ backgroundColor: "var(--onpoint-blue)" }}
      data-testid="page-not-found"
    >
      <div className="rounded-2xl bg-white p-3 mb-8 shadow-lg">
        <img src={logoPath} alt="On Point Education Centre" className="h-16 w-auto" />
      </div>
      <p className="text-7xl font-extrabold tracking-tight mb-2" style={{ color: GOLD }} aria-hidden="true">
        404
      </p>
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-3">{t.notFoundPage.title}</h1>
      <p className="text-white/80 max-w-md mb-8">{t.notFoundPage.note}</p>
      <Link
        href="/"
        className="rounded-full px-8 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: GOLD }}
        data-testid="link-not-found-home"
      >
        {t.notFoundPage.home}
      </Link>
    </div>
  );
}
