import { Link } from "wouter";

// A friendly placeholder page used for features that are not built yet
// (Games, Rewards, Parents). It keeps the playful On Point look so a child
// who taps the link still lands somewhere warm — never a dead end.
//
// Each route passes in its own title and emoji, so this one small component
// serves all the "coming soon" pages.
export default function ComingSoon({
  title,
  emoji = "✨",
  message = "We're building something fun here. Check back soon!",
}: {
  title: string;
  emoji?: string;
  message?: string;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center text-white"
      // Flat brand blue. This used to be a three-stop navy gradient; the
      // hero is the only gradient the spec allows (S1, S13.10).
      style={{ backgroundColor: "var(--onpoint-blue)" }}
    >
      {/* Big bobbing emoji so the page still feels alive while empty. */}
      <div className="text-7xl mb-6 op-bob" aria-hidden="true">
        {emoji}
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">{title}</h1>
      <p className="text-lg text-white/80 max-w-md mb-2">Coming soon {emoji}</p>
      <p className="text-white/70 max-w-md mb-8">{message}</p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="rounded-full bg-white/15 hover:bg-white/25 px-6 py-3 font-semibold transition-colors"
          data-testid="link-coming-soon-home"
        >
          ← Back Home
        </Link>
        <Link
          href="/student/login"
          className="rounded-full px-6 py-3 font-bold transition-transform hover:scale-105"
          style={{ color: "var(--onpoint-blue)", backgroundColor: "#BF9000" }}
          data-testid="link-coming-soon-login"
        >
          Let's Start! 🚀
        </Link>
      </div>
    </div>
  );
}
