// A classmate's town, read-only. No build menu, no editing, and no social
// features (no chat/comments/likes) — just their town to look at. The server
// only returns towns in the visitor's own class, so this can't show another
// class or a Form.

import { useEffect } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isPrimaryForm } from "@shared/schema";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AWARDS, type AwardId, type Placed } from "@shared/dreamworld";
import { TownPlot } from "@/components/TownPlot";
import logoPath from "@assets/logo.webp";

interface TownView {
  studentId: number;
  townName: string;
  mayorFirstName: string;
  foundedAt: string;
  layout: Placed[];
  award: string;
  buildingCount: number;
}

export default function TownViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  useEffect(() => {
    if (!student) setLocation("/student/login");
    else if (!isPrimaryForm(student.form)) setLocation("/student/dashboard");
  }, [student, setLocation]);

  const { data, isLoading, isError } = useQuery<{ success: boolean; town: TownView; message?: string }>({
    queryKey: ["/api/students/" + student?.id + "/dreamworld/town/" + id],
    enabled: !!student && isPrimaryForm(student.form) && !!id,
    retry: false,
  });

  if (!student || !isPrimaryForm(student.form)) return null;
  const town = data?.town;
  const foundedDate = town?.foundedAt ? new Date(town.foundedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  const award = town?.award ? AWARDS[town.award as AwardId] : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/student/visit" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Towns</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : isError || !town ? (
          <p className="text-center text-sm text-muted-foreground py-10" data-testid="town-view-blocked">
            {data?.message || "You can only visit towns in your own class."}
          </p>
        ) : (
          <>
            <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-transparent px-4 py-3 mb-3 text-center">
              <div className="font-bold" data-testid="town-view-banner">
                🏙️ {town.townName || `${town.mayorFirstName}'s town`}
                <span className="text-muted-foreground font-normal"> • Mayor {town.mayorFirstName}</span>
                {foundedDate && <span className="text-muted-foreground font-normal"> • Founded {foundedDate}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {town.buildingCount} building{town.buildingCount === 1 ? "" : "s"}
                {award && <span> • {award.emoji} {award.name}</span>}
              </div>
            </div>

            <TownPlot layout={town.layout} interactive={false} />

            <p className="text-center text-xs text-muted-foreground mt-3">You're just visiting — this town is view-only. 👀</p>
          </>
        )}
      </main>
    </div>
  );
}
