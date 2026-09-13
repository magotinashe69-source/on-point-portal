/**
 * Changing your own password, from inside the app.
 *
 * One dialog for all three portals. The server works out who is asking from the
 * session — there is no id in the request and nothing here says which kind of
 * account this is — so a teacher, a pupil and a parent all use this same form
 * and all can only ever change their own.
 *
 * Until this existed there was no way at all: a teacher's password was whatever
 * the database was seeded with, for ever, and a pupil depended on a teacher
 * clearing theirs.
 *
 * The CURRENT password is asked for, and that is the point of the form rather
 * than a formality. Without it, a session somebody walked away from — a shared
 * family phone, a classroom machine at break — is enough to lock the owner out
 * of their own account.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { serverMessage, useT } from "@/lib/i18n";
import { KeyRound, Loader2, Eye, EyeOff } from "lucide-react";

export function ChangePasswordDialog() {
  const t = useT();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  function reset() {
    setCurrent("");
    setNext("");
    setAgain("");
    setShow(false);
    setProblem("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setProblem("");

    // Checked here as well as on the server, so the two typing mistakes people
    // actually make are caught without a round trip.
    if (next.length < 8) {
      setProblem(t.password.tooShort);
      return;
    }
    if (next !== again) {
      setProblem(t.password.doNotMatch);
      return;
    }

    setSaving(true);
    try {
      // Plain fetch, not apiRequest: that helper throws on any non-2xx, which
      // would turn "that is not your current password" into a connection error.
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));

      if (!data.success) {
        setProblem(serverMessage(t, data, t.common.checkConnection));
        return;
      }

      toast({ title: t.password.changed, description: t.password.changedNote });
      setOpen(false);
      reset();
    } catch {
      setProblem(t.common.checkConnection);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Never leave a typed password sitting in a closed dialog.
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-change-password">
          <KeyRound className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{t.password.change}</span>
        </Button>
      </DialogTrigger>

      <DialogContent data-testid="dialog-change-password">
        <DialogHeader>
          <DialogTitle>{t.password.change}</DialogTitle>
          <DialogDescription>{t.password.note}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t.password.current}</Label>
            <Input
              id="current-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              data-testid="input-current-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t.password.next}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                data-testid="input-new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShow(!show)}
                aria-label={show ? t.common.hidePassword : t.common.showPassword}
                data-testid="button-toggle-new-password"
              >
                {show ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t.password.rule}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="again-password">{t.password.again}</Label>
            <Input
              id="again-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              data-testid="input-again-password"
            />
          </div>

          {problem && (
            <p
              className="text-sm rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2"
              role="alert"
              data-testid="text-change-password-problem"
            >
              {problem}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-change-password-cancel"
            >
              {t.controls.cancel}
            </Button>
            <Button type="submit" disabled={saving} data-testid="button-change-password-save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.password.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
