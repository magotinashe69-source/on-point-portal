import { useState } from "react";
import { Link } from "wouter";
import logoPath from "@assets/logo.webp";

// ---------------------------------------------------------------------------
// On Point landing page — a playful, kid-focused homepage.
//
// Design notes for future editors:
//  * Brand colours: navy #1F3864 and gold #BF9000. We use LIGHTER navy
//    gradients (#2B4A80 / #3A5DA0) so the page feels bright and friendly.
//  * Everything decorative (stars, planet, backpack, subject tiles, waves)
//    is CSS or inline SVG — NO image files — so it loads fast on cheap
//    Android phones. The only picture is the existing brand logo.
//  * Animations live in index.css under the "op-" prefix and are all turned
//    off automatically when the phone asks for reduced motion.
// ---------------------------------------------------------------------------

// Brand colours in one place so they are easy to change later.
const NAVY = "#1F3864";
const GOLD = "#BF9000";

// The subjects shown as colourful tiles. Each has a friendly emoji and its
// own bright colour. "More" hints there are others (the app has 12 subjects).
const SUBJECTS = [
  { name: "Maths", emoji: "➗", color: "#EF6F6C" },
  { name: "English", emoji: "📚", color: "#5B8DEF" },
  { name: "Science", emoji: "🔬", color: "#3DB47E" },
  { name: "Business", emoji: "💼", color: "#E0A106" },
  { name: "Computer Science", emoji: "💻", color: "#9B6DDF" },
  { name: "More…", emoji: "✨", color: "#EF8FB4" },
];

// The four feature cards. Pastel backgrounds keep them light and playful.
// Features that aren't built yet carry a "Coming soon" ribbon.
const FEATURES = [
  { title: "Homework Help", emoji: "📝", bg: "#E3F2FD", desc: "See your tasks and hand in your work.", href: "/student/login", soon: false },
  { title: "Practice Quizzes", emoji: "🧠", bg: "#E8F5E9", desc: "Get an instant score the moment you finish.", href: "/student/login", soon: false },
  { title: "Earn Rewards", emoji: "🏆", bg: "#FFF3E0", desc: "Collect treasures for finishing your work.", href: "/student/login", soon: false },
  { title: "Fun Games", emoji: "🎮", bg: "#F3E8FF", desc: "Learn while you play — battles and more.", href: "/student/login", soon: false },
];

// Honest facts about the app (checked against the code — no exaggeration).
const STATS = [
  { value: "6", label: "Year Groups" },
  { value: "12", label: "Subjects" },
  { value: "⚡", label: "Instant Marking" },
  { value: "📸", label: "Photo Answers" },
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

// A friendly star "study buddy" drawn as SVG so it costs nothing to download
// and can bob around smoothly. This is our hero mascot.
function StarMascot() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full" role="img" aria-label="On Point star mascot">
      <defs>
        <linearGradient id="starFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2C94C" />
          <stop offset="100%" stopColor={GOLD} />
        </linearGradient>
      </defs>
      {/* star body */}
      <path
        d="M100 15 l22 46 51 7 -37 36 9 51 -45 -24 -45 24 9 -51 -37 -36 51 -7 Z"
        fill="url(#starFill)"
        stroke="#fff"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* eyes */}
      <circle cx="86" cy="92" r="8" fill={NAVY} />
      <circle cx="114" cy="92" r="8" fill={NAVY} />
      <circle cx="89" cy="89" r="2.5" fill="#fff" />
      <circle cx="117" cy="89" r="2.5" fill="#fff" />
      {/* smile */}
      <path d="M84 108 q16 16 32 0" fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
      {/* rosy cheeks */}
      <circle cx="74" cy="104" r="5" fill="#EF6F6C" opacity="0.6" />
      <circle cx="126" cy="104" r="5" fill="#EF6F6C" opacity="0.6" />
    </svg>
  );
}

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
            <Link href="/student/login" className="hidden sm:inline font-semibold px-3 py-2 rounded-full hover:bg-black/5 transition-colors" style={{ color: NAVY }} data-testid="link-login">
              Log In
            </Link>
            <Link
              href="/student/login"
              className="font-bold px-5 py-2 rounded-full text-white shadow-sm transition-transform hover:scale-105"
              style={{ backgroundColor: GOLD }}
              data-testid="link-signup"
            >
              Sign Up
            </Link>
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: NAVY }}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
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

      {/* ================= HERO ================= */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #3A5DA0 0%, #2B4A80 55%, #1F3864 100%)" }}
      >
        {/* Drifting gold stars — pure CSS, positioned by hand. */}
        {[
          { top: "12%", left: "8%", d: "0s", s: 18 },
          { top: "24%", left: "82%", d: "1.2s", s: 12 },
          { top: "62%", left: "14%", d: "2.1s", s: 14 },
          { top: "72%", left: "78%", d: "0.6s", s: 20 },
          { top: "40%", left: "45%", d: "1.8s", s: 10 },
        ].map((star, i) => (
          <span
            key={i}
            className="op-drift absolute select-none"
            style={{ top: star.top, left: star.left, animationDelay: star.d, fontSize: star.s, color: "#F2C94C" }}
            aria-hidden="true"
          >
            ★
          </span>
        ))}

        {/* A small planet floating in the background. */}
        <div className="op-float absolute -right-6 top-10 opacity-70" aria-hidden="true">
          <svg width="90" height="90" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="26" fill="#8FB3E8" />
            <ellipse cx="45" cy="45" rx="42" ry="12" fill="none" stroke={GOLD} strokeWidth="4" transform="rotate(-20 45 45)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          {/* Left: words + buttons */}
          <div className="op-slide-in text-center md:text-left">
            <h1 className="font-extrabold leading-tight tracking-tight text-4xl sm:text-5xl lg:text-6xl">
              <span className="text-white">Homework </span>
              <span style={{ color: "#F2C94C" }}>Made </span>
              <span style={{ color: "#9FC0F0" }}>Fun, </span>
              <br className="hidden sm:block" />
              <span style={{ color: "#F2C94C" }}>Learning </span>
              <span className="text-white">Made </span>
              <span style={{ color: "#9FC0F0" }}>Easy!</span>
            </h1>
            <p className="mt-5 text-lg text-white/85 max-w-lg mx-auto md:mx-0">
              Your fun buddy for homework, practice &amp; success at On Point Education Centre.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link
                href="/student/login"
                className="op-lift rounded-full px-7 py-4 font-bold text-lg text-white shadow-lg"
                style={{ backgroundColor: GOLD }}
                data-testid="button-student-start"
              >
                Let's Start! 🚀
              </Link>
            </div>
          </div>

          {/* Right: bobbing mascot with a speech bubble. */}
          <div className="op-slide-in relative flex justify-center" style={{ animationDelay: "0.15s" }}>
            <div className="relative w-56 h-56 sm:w-72 sm:h-72">
              {/* Speech bubble */}
              <div className="absolute -top-2 -right-2 sm:right-4 bg-white rounded-2xl px-4 py-2 shadow-lg font-bold text-sm z-10" style={{ color: NAVY }}>
                Let's learn together!
                <span className="absolute -bottom-1.5 left-6 w-3 h-3 bg-white rotate-45" />
              </div>
              <div className="op-bob w-full h-full drop-shadow-xl">
                <StarMascot />
              </div>
            </div>
          </div>
        </div>

        {/* Wavy bottom edge (SVG) into the next section. */}
        <svg className="block w-full" viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ height: 48 }} aria-hidden="true">
          <path d="M0 40 C240 90 480 0 720 30 C960 60 1200 10 1440 40 L1440 80 L0 80 Z" fill="#F5F8FF" />
        </svg>
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
              <div className="op-bob text-4xl sm:text-5xl mb-3" style={{ animationDelay: `${i * 0.3}s` }}>{f.emoji}</div>
              <h3 className="font-extrabold text-base sm:text-lg mb-1" style={{ color: NAVY }}>{f.title}</h3>
              <p className="text-xs sm:text-sm text-black/60">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= SUBJECTS STRIP ================= */}
      <section id="subjects" className="relative overflow-hidden py-14" style={{ background: "linear-gradient(160deg, #2B4A80 0%, #1F3864 100%)" }}>
        {/* Floating backpack decoration. */}
        <div className="op-float absolute right-4 top-4 w-16 h-16 sm:w-24 sm:h-24 opacity-90" aria-hidden="true">
          <Backpack />
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white mb-8">
            All Your Subjects, All in One Place!
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
                  className="op-bob flex items-center justify-center rounded-xl text-2xl shrink-0"
                  style={{ width: 48, height: 48, backgroundColor: s.color + "22", animationDelay: `${i * 0.2}s` }}
                >
                  {s.emoji}
                </span>
                <span className="font-bold" style={{ color: NAVY }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========== SCHOOL PHOTO SLOT ===========
          A place for ONE compressed WebP photo of the school. It is optional:
          right now it shows a friendly gradient placeholder so nothing breaks.
          To add your real photo later:
            1. Save a compressed .webp (aim for < 80 KB, ~1000px wide) as
               attached_assets/school.webp
            2. At the top of this file add:  import schoolPhoto from "@assets/school.webp";
            3. Replace the <div> below with:
               <img src={schoolPhoto} alt="Students at On Point" className="w-full h-full object-cover" />
      */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="op-slide-in rounded-3xl overflow-hidden shadow-md">
          <div
            className="w-full h-48 sm:h-72 flex items-center justify-center text-white text-center px-6"
            style={{ background: "linear-gradient(120deg, #3A5DA0, #1F3864)" }}
          >
            <div>
              <div className="text-5xl mb-2">🏫📸</div>
              <p className="font-bold text-lg">Your school photo goes here</p>
              <p className="text-white/70 text-sm">(add attached_assets/school.webp — see the note in landing.tsx)</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS BAR ================= */}
      <section className="py-10" style={{ backgroundColor: "#FFF7E6" }}>
        <div className="mx-auto max-w-6xl px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
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
          style={{ background: "linear-gradient(160deg, #3A5DA0 0%, #1F3864 100%)" }}
        >
          {/* A couple of drifting stars for sparkle. */}
          <span className="op-drift absolute top-6 left-10 text-xl" style={{ color: "#F2C94C" }} aria-hidden="true">★</span>
          <span className="op-drift absolute bottom-8 right-12 text-lg" style={{ color: "#F2C94C", animationDelay: "1.5s" }} aria-hidden="true">★</span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-6">
            Start your learning adventure today!
          </h2>
          <Link
            href="/student/login"
            className="op-lift inline-block rounded-full px-8 py-4 font-bold text-lg text-white shadow-lg"
            style={{ backgroundColor: GOLD }}
            data-testid="button-final-cta"
          >
            Let's Go! →
          </Link>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-black/5 py-8" style={{ backgroundColor: "#F5F8FF" }}>
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
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
