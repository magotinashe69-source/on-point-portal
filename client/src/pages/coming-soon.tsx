import { Link } from "wouter";

// A placeholder page used for features that are not built yet (Games,
// Rewards, Parents), so a child who taps the link still lands somewhere
// that explains itself rather than on a dead end.
//
// Each route passes in its own title, so this one small component serves
// all the "coming soon" pages.
export default function ComingSoon({
  title,
  message = "This part of the app is not ready yet. Check back later.",
}: {
  title: string;
  message?: string;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center text-white"
      // Flat brand blue. This used to be a three-stop navy gradient; the
      // hero is the only gradient the spec allows (S1, S13.10).
      style={{ backgroundColor: "var(--onpoint-blue)" }}
    >
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">{title}</h1>
      <p className="text-lg text-white/80 max-w-md mb-2">Coming soon</p>
      <p className="text-white/70 max-w-md mb-8">{message}</p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="rounded-full bg-white/15 hover:bg-white/25 px-6 py-3 font-semibold transition-colors"
          data-testid="link-coming-soon-home"
        >
          Back to the main page
        </Link>
        <Link
          href="/student/login"
          className="rounded-full px-6 py-3 font-bold transition-transform hover:scale-105"
          style={{ color: "var(--onpoint-blue)", backgroundColor: "#BF9000" }}
          data-testid="link-coming-soon-login"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
