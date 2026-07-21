// Visit Towns — a list of classmates in the SAME class only. Tapping one opens
// their town read-only. The server returns only same-class primary students, so
// there is no way to reach another class or a Form here.

import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isPrimaryForm } from "@shared/schema";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2, ArrowRight } from "lucide-react";
import logoPath from "@assets/logo.webp";

interface Neighbour { studentId: number; firstName: string; townName: string; buildingCount: number; }

export default function VisitTowns() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  useEffect(() => {
    if (!student) setLocation("/student/login");
    else if (!isPrimaryForm(student.form)) setLocation("/student/dashboard");
  }, [student, setLocation]);

  const { data, isLoading } = useQuery<{ success: boolean; neighbours: Neighbour[] }>({
    queryKey: ["/api/students/" + student?.id + "/dreamworld/neighbours"],
    enabled: !!student && isPrimaryForm(student.form),
  });

  if (!student || !isPrimaryForm(student.form)) return null;
  const neighbours = data?.neighbours ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/student/dream-world" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to My Town</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-xl">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold">Visit Towns 🏘️</h1>
          <p className="text-muted-foreground text-sm mt-1">Look around towns built by your classmates in {student.form}.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : neighbours.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No classmates have started a town yet — be the first to show yours off!</p>
        ) : (
          <div className="grid gap-2" data-testid="neighbour-list">
            {neighbours.map((n) => (
              <Link key={n.studentId} href={`/student/town/${n.studentId}`}>
                <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover-elevate cursor-pointer" data-testid={`neighbour-${n.studentId}`}>
                  <div className="p-2 rounded-md bg-primary/10 text-xl leading-none">🏙️</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{n.townName || `${n.firstName}'s town`}</div>
                    <div className="text-xs text-muted-foreground">Mayor {n.firstName} • {n.buildingCount} building{n.buildingCount === 1 ? "" : "s"}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
