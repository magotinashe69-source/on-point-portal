// A printable Town Award certificate in the On Point navy/gold style. Reads the
// student's current award from their Dream World state and lets them print it
// (browser print — no libraries). Screen shows a "Print" button and back link;
// print shows only the certificate.

import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isPrimaryForm } from "@shared/schema";
import { ArrowLeft, Printer } from "lucide-react";
import { AWARDS, type AwardId } from "@shared/dreamworld";

const NAVY = "#1F3864";
const GOLD = "#BF9000";

export default function Certificate() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();

  useEffect(() => {
    if (!student) setLocation("/student/login");
    else if (!isPrimaryForm(student.form)) setLocation("/student/dashboard");
  }, [student, setLocation]);

  const { data } = useQuery<{ success: boolean; townName: string; award: string; awardTerm: string }>({
    queryKey: ["/api/students/" + student?.id + "/dreamworld"],
    enabled: !!student && isPrimaryForm(student.form),
  });

  if (!student || !isPrimaryForm(student.form)) return null;
  const award = data?.award ? AWARDS[data.award as AwardId] : null;

  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4">
      <style>{`
        @media print {
          body { background: #fff; }
          .cert-noprint { display: none !important; }
          .cert-sheet { box-shadow: none !important; margin: 0 !important; }
          @page { margin: 12mm; }
        }
      `}</style>

      <div className="cert-noprint mx-auto max-w-3xl flex items-center justify-between mb-4">
        <Link href="/student/dream-world" className="inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to My Town
        </Link>
        {award && (
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: NAVY }}
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" /> Print certificate
          </button>
        )}
      </div>

      {!award ? (
        <p className="text-center text-sm text-muted-foreground py-16" data-testid="no-award">
          No award yet — ask your teacher to run the Term Awards! 🏆
        </p>
      ) : (
        <div
          className="cert-sheet mx-auto max-w-3xl bg-white text-center shadow-xl"
          style={{ border: `10px solid ${NAVY}`, outline: `2px solid ${GOLD}`, outlineOffset: "-16px", padding: "3.5rem 2.5rem" }}
          data-testid="certificate"
        >
          <div style={{ color: NAVY, fontWeight: 800, letterSpacing: "0.06em", fontSize: "0.8rem", textTransform: "uppercase" }}>
            On Point Education Centre
          </div>
          <div style={{ color: GOLD, fontStyle: "italic", fontSize: "0.8rem", marginTop: "0.15rem" }}>Quality Beyond Measure</div>

          <div style={{ margin: "1.75rem 0 0.25rem", fontSize: "2rem" }}>{award.emoji}</div>
          <h1 style={{ color: NAVY, fontSize: "1.9rem", fontWeight: 800, margin: "0.25rem 0" }}>Certificate of Achievement</h1>
          <div style={{ height: 3, width: 120, background: GOLD, margin: "0.5rem auto 1.5rem" }} />

          <p style={{ color: "#444", fontSize: "0.95rem" }}>This certificate is proudly awarded to</p>
          <p style={{ color: NAVY, fontSize: "1.6rem", fontWeight: 800, margin: "0.5rem 0" }} data-testid="cert-name">{student.fullName}</p>
          <p style={{ color: "#444", fontSize: "0.95rem" }}>
            Mayor of <span style={{ fontWeight: 700 }} data-testid="cert-town">{data?.townName || "their Dream World town"}</span> ({student.form})
          </p>

          <div style={{ margin: "1.75rem auto", maxWidth: "34rem" }}>
            <p style={{ color: "#333", fontSize: "1.05rem" }}>
              for winning <span style={{ color: GOLD, fontWeight: 800 }} data-testid="cert-award">{award.name}</span>
            </p>
            <p style={{ color: "#555", fontSize: "0.95rem", marginTop: "0.35rem" }}>{award.blurb}.</p>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "2.5rem", gap: "1rem" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ borderTop: `2px solid ${NAVY}`, paddingTop: "0.35rem", fontSize: "0.8rem", color: "#555" }} data-testid="cert-term">
                {data?.awardTerm || "This Term"}
              </div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ borderTop: `2px solid ${NAVY}`, paddingTop: "0.35rem", fontSize: "0.8rem", color: "#555" }}>
                On Point Education Centre
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
