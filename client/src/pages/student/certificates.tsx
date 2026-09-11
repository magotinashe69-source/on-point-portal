// A child's certificates — everything they have been awarded.
//
// Reached from the dashboard. Each one opens as a printable sheet.
//
// Merely opening this page is what earns any newly reached milestone: the
// server works them out on read and writes down the new ones. That is why
// nothing here has to be told when a child hits a streak or scores full marks —
// and why marking, XP and streaks are untouched by the whole feature.

import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type Certificate, type CertificateKind,
} from "@shared/certificates";
import { ArrowLeft, Award, Flame, Loader2, Sparkles, Star, Target, TrendingUp } from "lucide-react";
import logoPath from "@assets/logo.webp";
import { longDate, useT } from "@/lib/i18n";

/** An icon per kind, so the list is scannable without reading every line. */
const KIND_ICON: Record<CertificateKind, React.ReactNode> = {
  perfect_score: <Star className="h-5 w-5" />,
  streak_star: <Flame className="h-5 w-5" />,
  topic_master: <Target className="h-5 w-5" />,
  level_up: <TrendingUp className="h-5 w-5" />,
  most_improved: <Award className="h-5 w-5" />,
};

export default function CertificatesPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  useEffect(() => {
    if (!student) setLocation("/student/login");
  }, [student, setLocation]);

  const { data, isLoading } = useQuery<{ success: boolean; certificates: Certificate[] }>({
    queryKey: ["/api/students", student?.id, "certificates"],
    enabled: !!student,
  });

  if (!student) return null;
  const list = data?.certificates ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/student/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t.common.dashboard}</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t.certificates.areaTitle}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t.certificates.areaSubtitle}</p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {/* Nothing yet is an invitation, not an empty screen — the same rule the
            skills map follows. A child with no certificates has not failed. */}
        {!isLoading && list.length === 0 && (
          <Card data-testid="card-no-certificates">
            <CardContent className="py-10 text-center space-y-2">
              <Sparkles className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium" data-testid="text-no-certificates">{t.certificates.empty}</p>
              <p className="text-sm text-muted-foreground">{t.certificates.emptyNote}</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && list.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground" data-testid="text-certificate-count">
              {t.certificates.count(list.length)}
            </p>

            {list.map((c) => (
              <Link key={c.id} href={`/student/certificate/${c.id}`}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-certificate-${c.id}`}>
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-md bg-primary/10 text-primary shrink-0">
                      {KIND_ICON[c.kind]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold" data-testid={`text-certificate-title-${c.id}`}>{c.title}</p>
                      <p className="text-sm text-muted-foreground break-words">{c.detail}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {longDate(t, c.earnedAt)}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
