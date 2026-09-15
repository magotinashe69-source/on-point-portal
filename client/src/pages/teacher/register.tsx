import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, Clock, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { serverMessage, useT } from "@/lib/i18n";
import logoPath from "@assets/logo.webp";

// Asking to join as a teacher.
//
// What this creates can do nothing at all until an administrator approves it on
// the Staff screen: the server makes it a pending, regular teacher account and
// will not sign it in. So the page ends on the one thing the teacher needs to
// know — that it is waiting for the school.
export default function TeacherRegister() {
  const t = useT();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    // Checked here first, so a typo costs no trip to the server.
    if (password.length < 8) return setProblem(t.password.tooShort);
    if (password !== again) return setProblem(t.password.doNotMatch);
    setProblem(null);
    setSending(true);
    try {
      // Plain fetch, not apiRequest: that throws on any refusal, which would turn
      // "there is already an account with that email" into "check your connection".
      const res = await fetch("/api/auth/teacher/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) setSent(serverMessage(t, data));
      else setProblem(serverMessage(t, data, t.common.checkConnection));
    } catch {
      setProblem(t.common.checkConnection);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/login" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t.staff.backToLogin}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="On Point Education Centre" className="h-20 w-auto" />
            </div>
            <CardTitle className="text-2xl">{t.staff.registerTitle}</CardTitle>
            <CardDescription>{t.staff.registerNote}</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4" data-testid="panel-request-sent">
                <div className="mx-auto w-fit rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold">{t.staff.awaitingTitle}</h2>
                <p className="text-sm text-muted-foreground" data-testid="text-awaiting-approval">{sent}</p>
                <Link href="/teacher/login">
                  <Button variant="outline" data-testid="link-back-to-login">{t.staff.backToLogin}</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={send} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="register-name">{t.staff.fullName}</Label>
                  <Input
                    id="register-name"
                    autoComplete="name"
                    placeholder={t.staff.fullNamePlaceholder}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    data-testid="input-register-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="register-email">{t.staff.email}</Label>
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    placeholder={t.login.teacher.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-register-email"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="register-password">{t.staff.password}</Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-register-password"
                  />
                  <p className="text-xs text-muted-foreground">{t.staff.passwordRule}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="register-again">{t.staff.passwordAgain}</Label>
                  <Input
                    id="register-again"
                    type="password"
                    autoComplete="new-password"
                    value={again}
                    onChange={(e) => setAgain(e.target.value)}
                    data-testid="input-register-again"
                  />
                </div>

                {problem && (
                  <p className="text-sm text-destructive" data-testid="text-register-problem">{problem}</p>
                )}

                <Button type="submit" className="w-full" disabled={sending} data-testid="button-register">
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  {t.staff.send}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
