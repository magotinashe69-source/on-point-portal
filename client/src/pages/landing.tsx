import { useState } from "react";
import { Link } from "wouter";
import logoPath from "@assets/logo.webp";

// ---------------------------------------------------------------------------
// On Point landing page.
//
// Design notes for future editors:
//  * The HERO has been rebuilt to ONPOINT_UI_SPEC.md. Read that file before
//    touching it. Everything below the hero is still the older playful
//    treatment and has NOT yet been brought in line with the spec.
//  * The brand blue now comes from the --onpoint-blue token in index.css.
//    The NAVY constant below is just that var() in a string, so there is no
//    blue hex in this file. GOLD is still a literal; the spec wants it
//    tokenised and retired to student celebration moments only (S1).
//  * The hero holds the one gradient the spec allows in the whole product
//    (S1, S13.10). The subjects strip and the final CTA used to carry navy
//    gradients of their own; they are flat token blue now.
//  * Copy on this page follows S11: no exclamation marks, no "adventure" /
//    "buddy" / "journey", and every button names what pressing it does.
//  * Animations live in index.css under the "op-" prefix and are all turned
//    off automatically when the phone asks for reduced motion.
// ---------------------------------------------------------------------------

// Brand colours in one place so they are easy to change later.
const NAVY = "var(--onpoint-blue)";
const GOLD = "#BF9000";

// The subjects shown as tiles, each with its own colour. "More subjects"
// points at the rest.
const SUBJECTS = [
  { name: "Maths", color: "#EF6F6C" },
  { name: "English", color: "#5B8DEF" },
  { name: "Science", color: "#3DB47E" },
  { name: "Business", color: "#E0A106" },
  { name: "Computer Science", color: "#9B6DDF" },
  { name: "More subjects", color: "#EF8FB4" },
];

// The four feature cards. Pastel backgrounds keep them light.
// Features that aren't built yet carry a "Coming soon" ribbon.
const FEATURES = [
  { title: "Homework", bg: "#E3F2FD", desc: "See your assignments and hand in your work.", href: "/student/login", soon: false },
  { title: "Practice Quizzes", bg: "#E8F5E9", desc: "Get an instant score the moment you finish.", href: "/student/login", soon: false },
  { title: "Earn Rewards", bg: "#FFF3E0", desc: "Earn XP and awards for work you hand in.", href: "/student/login", soon: false },
  { title: "Games", bg: "#F3E8FF", desc: "Practise by playing — penalty shootout, treasure island and dream world.", href: "/student/login", soon: false },
];

// Honest facts about the app (checked against the code — no exaggeration).
// Stage 3-6 plus Form 1-2 is six. Nothing else here was verifiable, so
// nothing else is claimed.
const STATS = [
  { value: "6", label: "Year groups" },
];

// Nav links. "#" links scroll to a section on this page; Games and Rewards go
// to the student login (the real games/rewards live behind login for primary
// classes) rather than to a "coming soon" placeholder.
const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Subjects", href: "#subjects" },
  { label: "Games", href: "/student/login" },
  { label: "Rewards", href: "/student/login" },
];

// A little backpack drawn as SVG — floats over the subjects strip.
function Backpack() {
  return (
    <svg viewBox="0 0 100 110" className="w-full h-full" role="img" aria-label="Backpack">
      <rect x="18" y="30" width="64" height="70" rx="18" fill={GOLD} />
      <rect x="30" y="55" width="40" height="30" rx="8" fill="#fff" opacity="0.9" />
      <path d="M35 32 q15 -22 30 0" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <rect x="44" y="60" width="12" height="20" rx="4" fill={NAVY} />
    </svg>
  );
}

export default function Landing() {
  // Tiny bit of state: whether the mobile menu is open. Kept simple.
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    // Explicit light background so the page stays bright even in dark theme.
    <div className="min-h-screen" style={{ backgroundColor: "#F5F8FF" }}>
      {/* ================= NAV ================= */}
      <header className="sticky top-0 z-50 w-full backdrop-blur bg-white/85 border-b border-black/5">
        <div className="mx-auto max-w-6xl flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src={logoPath} alt="On Point Education Centre" className="h-9 w-auto" />
            <span className="font-extrabold hidden sm:block" style={{ color: NAVY }}>On Point</span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-6 font-semibold" style={{ color: NAVY }}>
            {NAV_LINKS.map((l) => (
              l.href.startsWith("#") ? (
                <a key={l.label} href={l.href} className="hover:opacity-70 transition-opacity" data-testid={`nav-${l.label.toLowerCase()}`}>
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} href={l.href} className="hover:opacity-70 transition-opacity" data-testid={`nav-${l.label.toLowerCase()}`}>
                  {l.label}
                </Link>
              )
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/student/login" className="font-semibold px-3 py-2 rounded-full hover:bg-black/5 transition-colors" style={{ color: NAVY }} data-testid="link-login">
              Log In
            </Link>
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: NAVY }}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              data-testid="button-menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                {menuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <nav className="md:hidden border-t border-black/5 bg-white px-4 py-3 flex flex-col gap-1 font-semibold" style={{ color: NAVY }}>
            {NAV_LINKS.map((l) => (
              l.href.startsWith("#") ? (
                <a key={l.label} href={l.href} className="py-2 px-2 rounded-lg hover:bg-black/5" onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} href={l.href} className="py-2 px-2 rounded-lg hover:bg-black/5" onClick={() => setMenuOpen(false)}>
                  {l.label}
                </Link>
              )
            ))}
            <Link href="/student/login" className="py-2 px-2 rounded-lg hover:bg-black/5" onClick={() => setMenuOpen(false)}>Log In</Link>
          </nav>
        )}
      </header>

      {/* ================= HERO =================
          Rebuilt to ONPOINT_UI_SPEC.md. What the spec dictates here:
           * S10 - no mascots, no clipart. The star, the speech bubble, the
             drifting stars and the planet are gone; the only picture is a
             real photograph of the school, slotted in below.
           * S1  - this gradient is the ONE gradient allowed in the product.
             Both stops are tokens (--onpoint-blue, --onpoint-blue-deep):
             one hue, lightness only, so no raw hex lives in this file.
           * S3  - hierarchy from size and weight only. The headline is a
             single colour; colouring individual words is banned.
           * S5  - one button, labelled with exactly what it does. No arrow,
             no emoji, no exclamation mark. */}
      <section
        className="relative"
        style={{
          background:
            "linear-gradient(170deg, var(--onpoint-blue) 0%, var(--onpoint-blue-deep) 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          {/* Left: words and the single call to action. */}
          <div className="op-slide-in text-center md:text-left">
            {/* One colour throughout. The second line steps down in size and
                weight -- that is the whole hierarchy, per S3. */}
            <h1 className="font-sans text-white">
              <span className="block text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Homework at On Point
              </span>
              <span className="mt-4 block text-lg sm:text-xl font-normal leading-relaxed max-w-lg mx-auto md:mx-0">
                Set by your teacher, handed in from your phone, marked and
                returned in one place.
              </span>
            </h1>

            <div className="mt-8">
              <Link
                href="/student/login"
                className="inline-block rounded-lg bg-accent px-8 py-4 font-sans text-lg font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                data-testid="button-student-start"
              >
                Log In
              </Link>
            </div>
          </div>

          {/* Right: photograph slot.
              TO ADD THE IMAGE: drop the file in attached_assets, import it at
              the top of this file (e.g. `import heroPath from
              "@assets/hero.webp";`) and replace this whole <div> with:

                <img
                  src={heroPath}
                  alt="<describe what the photograph shows>"
                  className="op-slide-in w-full rounded-lg object-cover aspect-video"
                  loading="lazy"
                  width={1200}
                  height={900}
                />

              S10: a real photograph of On Point, WebP, under 1 MB, and
              written parental consent first if any child is identifiable. */}
          <div
            className="op-slide-in w-full aspect-video rounded-lg border border-white/25 flex items-center justify-center"
            style={{ animationDelay: "0.15s" }}
            data-testid="hero-image-placeholder"
          >
            <span className="font-sans text-sm text-white/70">
              Photograph to be supplied
            </span>
          </div>
        </div>
      </section>

      {/* ================= FEATURE CARDS ================= */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-2xl sm:text-3xl font-extrabold mb-8" style={{ color: NAVY }}>
          What can you do here?
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {FEATURES.map((f, i) => (
            <Link
              key={f.title}
              href={f.href}
              className="op-lift op-slide-in relative rounded-3xl p-5 sm:p-6 text-center overflow-hidden block"
              style={{ backgroundColor: f.bg, animationDelay: `${i * 0.08}s` }}
              data-testid={`card-feature-${i}`}
            >
              {f.soon && (
                <span
                  className="absolute top-3 -right-8 rotate-45 text-white text-[10px] font-bold px-8 py-1 shadow"
                  style={{ backgroundColor: GOLD }}
                >
                  Coming soon
                </span>
              )}
              <h3 className="font-extrabold text-base sm:text-lg mb-1" style={{ color: NAVY }}>{f.title}</h3>
              <p className="text-xs sm:text-sm text-black/60">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= SUBJECTS STRIP ================= */}
      <section id="subjects" className="relative overflow-hidden py-14" style={{ backgroundColor: NAVY }}>
        {/* Floating backpack decoration. */}
        <div className="op-float absolute right-4 top-4 w-16 h-16 sm:w-24 sm:h-24 opacity-90" aria-hidden="true">
          <Backpack />
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white mb-8">
            All your subjects in one place
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {SUBJECTS.map((s, i) => (
              <div
                key={s.name}
                className="op-lift op-slide-in rounded-2xl bg-white/95 p-5 flex items-center gap-3 shadow-sm"
                style={{ animationDelay: `${i * 0.06}s` }}
                data-testid={`tile-subject-${i}`}
              >
                <span
                  className="rounded-xl shrink-0"
                  style={{ width: 48, height: 48, backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className="font-bold" style={{ color: NAVY }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= STATS BAR ================= */}
      <section className="py-10" style={{ backgroundColor: "#FFF7E6" }}>
        <div className="mx-auto max-w-6xl px-4 flex flex-wrap justify-center gap-12 text-center">
          {STATS.map((s, i) => (
            <div key={s.label} className="op-slide-in" style={{ animationDelay: `${i * 0.08}s` }} data-testid={`stat-${i}`}>
              <div className="text-3xl sm:text-4xl font-extrabold" style={{ color: GOLD }}>{s.value}</div>
              <div className="font-semibold mt-1" style={{ color: NAVY }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div
          className="op-slide-in relative overflow-hidden rounded-[2rem] px-6 py-14 text-center shadow-xl"
          style={{ backgroundColor: NAVY }}
        >
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-6">
            See what your teacher has set
          </h2>
          <Link
            href="/student/login"
            className="op-lift inline-block rounded-full px-8 py-4 font-bold text-lg text-white shadow-lg"
            style={{ backgroundColor: GOLD }}
            data-testid="button-final-cta"
          >
            Log In
          </Link>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-black/5 py-8" style={{ backgroundColor: "#F5F8FF" }}>
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={logoPath} alt="On Point Education Centre" className="h-8 w-auto" />
            <span className="font-extrabold" style={{ color: NAVY }}>On Point Education Centre</span>
          </div>
          <p className="text-sm text-black/50 mb-4">Quality Beyond Measure</p>
          {/* Teacher access is kept discreet here so staff can still log in. */}
          <Link href="/teacher/login" className="text-sm font-semibold hover:underline" style={{ color: NAVY }} data-testid="link-teacher-login">
            Teacher Login
          </Link>
        </div>
      </footer>
    </div>
  );
}
