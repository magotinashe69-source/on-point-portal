// The printable certificate itself, in the school's navy and gold.
//
// The design is lifted from the old Town Award page (which Dream World's
// retirement left stranded) so the school has ONE certificate look rather than
// two that drifted apart. That page is now replaced by this component.
//
// "PDF" here means the browser's own print dialog with "Save as PDF" chosen —
// the same approach the Grade Book already uses. It adds no library, embeds no
// fonts, and on a phone it is the native Share → Print → Save as PDF path.
//
// Everything outside the sheet is hidden when printing, so what comes out is
// the certificate alone on a clean page.

import {
  certificateDate, certificateReason,
  type Certificate,
} from "@shared/certificates";
import logoPath from "@assets/logo.webp";
import { longDate, useT } from "@/lib/i18n";

const NAVY = "var(--onpoint-blue, #1F3864)";
const GOLD = "#BF9000";

export function CertificateSheet({
  certificate, studentName, form,
}: {
  certificate: Certificate;
  studentName: string;
  form: string;
}) {
  const t = useT();

  return (
    <>
      <style>{`
        @media print {
          /* The page around the sheet is grey on screen. Printed, that grey is
             a wasted field of ink around the certificate, so everything behind
             it goes white — the body AND the wrapper the page sits in. */
          body { background: #fff !important; }
          .cert-page { background: #fff !important; padding: 0 !important; }
          .cert-noprint { display: none !important; }
          .cert-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            /* Kept on one sheet: a certificate that breaks across two pages is
               not a certificate. */
            page-break-inside: avoid;
          }
          @page { margin: 12mm; }
        }
      `}</style>

      <div
        className="cert-sheet mx-auto w-full max-w-3xl bg-white text-center shadow-xl"
        style={{
          border: `10px solid ${NAVY}`,
          outline: `2px solid ${GOLD}`,
          outlineOffset: "-16px",
          // Tighter padding on a phone so the sheet is readable on screen; the
          // print stylesheet uses the page margin above rather than this.
          padding: "clamp(1.5rem, 6vw, 3.5rem) clamp(1rem, 5vw, 2.5rem)",
        }}
        data-testid="certificate-sheet"
      >
        <img
          src={logoPath}
          alt=""
          style={{ height: "44px", width: "auto", margin: "0 auto 0.5rem" }}
        />

        <div style={{ color: NAVY, fontWeight: 800, letterSpacing: "0.06em", fontSize: "0.8rem", textTransform: "uppercase" }}>
          {t.certificates.school}
        </div>
        <div style={{ color: GOLD, fontStyle: "italic", fontSize: "0.8rem", marginTop: "0.15rem" }}>
          {t.certificates.tagline}
        </div>

        <h1 style={{ color: NAVY, fontSize: "clamp(1.4rem, 5vw, 1.9rem)", fontWeight: 800, margin: "0.5rem 0 0" }}>
          {t.certificates.heading}
        </h1>
        <div style={{ height: 3, width: 120, background: GOLD, margin: "0.5rem auto 1.5rem" }} />

        <p style={{ color: "#444", fontSize: "0.95rem", margin: 0 }}>{t.certificates.awardedTo}</p>
        <p
          style={{ color: NAVY, fontSize: "clamp(1.25rem, 5.5vw, 1.6rem)", fontWeight: 800, margin: "0.5rem 0 0" }}
          data-testid="cert-name"
        >
          {studentName}
        </p>
        <p style={{ color: "#444", fontSize: "0.95rem", margin: "0.15rem 0 0" }}>{form}</p>

        <div style={{ margin: "1.75rem auto", maxWidth: "34rem" }}>
          <p
            style={{ color: GOLD, fontSize: "clamp(1.1rem, 4.5vw, 1.35rem)", fontWeight: 800, margin: 0 }}
            data-testid="cert-title"
          >
            {certificate.title}
          </p>
          <p style={{ color: "#333", fontSize: "1rem", margin: "0.35rem 0 0" }}>
            {t.certificates.reasons[certificate.kind]}
          </p>
          <p
            style={{ color: "#555", fontSize: "0.95rem", margin: "0.5rem 0 0" }}
            data-testid="cert-detail"
          >
            {certificate.detail}
          </p>
        </div>

        {/* flex-start, not flex-end: the two blocks put their rule at the TOP,
            and on a narrow screen "On Point Education Centre" wraps to two
            lines. Bottom-aligning them then left the two rules at different
            heights, which on a certificate reads as crooked. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "2.5rem", gap: "1rem" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div
              style={{ borderTop: `2px solid ${NAVY}`, paddingTop: "0.35rem", fontSize: "0.8rem", color: "#555" }}
              data-testid="cert-date"
            >
              {longDate(t, certificate.earnedAt)}
            </div>
          </div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ borderTop: `2px solid ${NAVY}`, paddingTop: "0.35rem", fontSize: "0.8rem", color: "#555" }}>
              {t.certificates.school}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
