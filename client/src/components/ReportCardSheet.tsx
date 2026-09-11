// A printable report card, in the school's navy and gold.
//
// Same printing story as the certificates: the browser's own dialog, with
// "Save as PDF" for a file. No library, no embedded fonts.
//
// One card per printed page. A class of thirty prints as thirty pages from one
// press of Print, which is what a teacher actually wants at the end of term.

import {
  hasMarkedWork, versusClass, type ReportCard,
} from "@shared/report-card";
import { subjectLabel } from "@shared/weekly-report";
import { certificateDate } from "@shared/certificates";
import logoPath from "@assets/logo.webp";
import { subjectName, useT } from "@/lib/i18n";

const NAVY = "var(--onpoint-blue, #1F3864)";
const GOLD = "#BF9000";

/** The print rules, written once however many cards are on the page. */
export function ReportCardPrintStyles() {
  return (
    <style>{`
      @media print {
        body { background: #fff !important; }
        .rc-page { background: #fff !important; padding: 0 !important; }
        .rc-noprint { display: none !important; }
        .rc-sheet {
          box-shadow: none !important;
          margin: 0 !important;
          /* One card per page. Without this a class of thirty runs together and
             two children share a sheet. */
          page-break-after: always;
          break-after: page;
        }
        .rc-sheet:last-child { page-break-after: auto; break-after: auto; }
        @page { margin: 12mm; }
      }

      /* On a phone the five-column table cannot fit, and "Pieces marked" was
         being clipped mid-header. It is the least important column — the
         average and the grade are what a card is read for — so it is dropped
         on a narrow SCREEN only. The printed A4 card has room and keeps it. */
      @media screen and (max-width: 640px) {
        .rc-col-marked { display: none; }
      }
    `}</style>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "0.4rem", fontSize: "0.85rem" }}>
      <span style={{ color: "#666" }}>{label}:</span>
      <span style={{ fontWeight: 600, color: "#222" }}>{value}</span>
    </div>
  );
}

export function ReportCardSheet({ card }: { card: ReportCard }) {
  const t = useT();
  const anyWork = hasMarkedWork(card);

  return (
    <div
      className="rc-sheet mx-auto w-full max-w-3xl bg-white shadow-xl"
      style={{
        border: `8px solid ${NAVY}`,
        outline: `2px solid ${GOLD}`,
        outlineOffset: "-12px",
        padding: "clamp(1.25rem, 5vw, 2.5rem)",
      }}
      data-testid={`report-card-${card.student.id}`}
    >
      {/* Masthead */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: `2px solid ${NAVY}`, paddingBottom: "0.75rem" }}>
        <img src={logoPath} alt="" style={{ height: "42px", width: "auto" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: NAVY, fontWeight: 800, letterSpacing: "0.05em", fontSize: "0.8rem", textTransform: "uppercase" }}>
            {t.reportCard.school}
          </div>
          <div style={{ color: GOLD, fontStyle: "italic", fontSize: "0.75rem" }}>{t.reportCard.tagline}</div>
        </div>
        <div style={{ color: NAVY, fontWeight: 800, fontSize: "clamp(1rem, 4vw, 1.3rem)" }}>
          {t.reportCard.heading}
        </div>
      </div>

      {/* Who and when */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "0.35rem 1rem", margin: "0.9rem 0 1.1rem" }}>
        <Row label={t.reportCard.student} value={card.student.fullName} />
        <Row label={t.reportCard.pupilId} value={card.student.pupilId} />
        <Row label={t.reportCard.form} value={card.student.form} />
        <Row label={t.reportCard.term} value={card.term.label} />
        <Row label={t.reportCard.issued} value={certificateDate(card.issuedAt)} />
      </div>

      {!anyWork ? (
        <p style={{ color: "#555", fontSize: "0.95rem", padding: "1.5rem 0" }} data-testid="text-nothing-marked">
          {t.reportCard.nothingMarked}
        </p>
      ) : (
        <>
          {/* The subjects */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  {[t.reportCard.subject, t.reportCard.average, t.reportCard.grade, t.reportCard.classAverage, t.reportCard.marked].map((h, i) => (
                    <th key={h} className={h === t.reportCard.marked ? "rc-col-marked" : undefined} style={{
                      textAlign: i === 0 ? "left" : "right",
                      padding: "0.45rem 0.5rem",
                      borderBottom: `2px solid ${NAVY}`,
                      color: NAVY, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.subjects.map((s) => (
                  <tr key={s.subject} data-testid={`row-subject-${s.subject}`}>
                    <td style={{ padding: "0.45rem 0.5rem", borderBottom: "1px solid #e5e7eb" }}>
                      {subjectName(t, s.subject)}
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}
                        data-testid={`text-percent-${s.subject}`}>
                      {s.percent === null ? "—" : `${s.percent}%`}
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontWeight: 800, color: NAVY }}
                        data-testid={`text-grade-${s.subject}`}>
                      {s.grade ?? "—"}
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#555" }}
                        data-testid={`text-class-${s.subject}`}>
                      {s.classPercent === null ? "—" : `${s.classPercent}%`}
                    </td>
                    <td className="rc-col-marked" style={{ padding: "0.45rem 0.5rem", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#555" }}>
                      {s.marked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Overall */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", background: "#f6f7fa", border: "1px solid #e5e7eb", padding: "0.7rem 0.9rem", marginTop: "0.9rem" }}>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#666" }}>
                {t.reportCard.overall}
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: NAVY, fontVariantNumeric: "tabular-nums" }}
                   data-testid="text-overall">
                {card.overallPercent === null ? "—" : `${card.overallPercent}%`}
                <span style={{ fontSize: "1rem", color: GOLD, marginLeft: "0.5rem" }} data-testid="text-overall-grade">
                  {card.overallGrade ?? ""}
                </span>
              </div>
              {card.classOverallPercent !== null && (
                <div style={{ fontSize: "0.78rem", color: "#666" }}>
                  {versusClass(card.overallPercent, card.classOverallPercent)} ({card.classOverallPercent}%)
                </div>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#666" }}>
                {t.reportCard.attendance}
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: NAVY, fontVariantNumeric: "tabular-nums" }}
                   data-testid="text-days-active">
                {card.attendance.daysActive}
              </div>
            </div>
          </div>

          {/* Said ON the card, not in a footnote. A parent must not read the
              number above as an attendance record — the school keeps none. */}
          <p style={{ fontSize: "0.7rem", color: "#777", marginTop: "0.4rem" }} data-testid="text-attendance-note">
            {t.reportCard.attendanceNote}
          </p>
        </>
      )}

      {/* The teacher's comment */}
      <div style={{ marginTop: "1.1rem" }}>
        <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: NAVY, fontWeight: 700 }}>
          {t.reportCard.comment}
        </div>
        <div style={{ border: "1px solid #e5e7eb", minHeight: "4.5rem", padding: "0.6rem 0.7rem", marginTop: "0.3rem", fontSize: "0.88rem", color: "#222", whiteSpace: "pre-wrap" }}
             data-testid="text-comment">
          {card.comment || <span style={{ color: "#999" }}>{t.reportCard.noComment}</span>}
        </div>
      </div>

      {/* The boundaries this card was graded against, so a parent can read the
          grade without having to ask what a B means at this school. */}
      <div style={{ marginTop: "1rem", borderTop: "1px solid #e5e7eb", paddingTop: "0.5rem" }}>
        <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#666", marginBottom: "0.25rem" }}>
          {t.reportCard.boundariesHeading}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.72rem", color: "#555" }}>
          {card.boundaries.map((b) => (
            <span key={b.grade}>
              <strong style={{ color: NAVY }}>{b.grade}</strong> {b.min}+
            </span>
          ))}
        </div>
      </div>

      {/* Signature lines. flex-start so the two rules line up even when one
          block's text wraps — the same fix the certificate needed. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginTop: "1.6rem" }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ borderTop: `2px solid ${NAVY}`, paddingTop: "0.3rem", fontSize: "0.75rem", color: "#555" }}>
            Class teacher
          </div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ borderTop: `2px solid ${NAVY}`, paddingTop: "0.3rem", fontSize: "0.75rem", color: "#555" }}>
            {t.reportCard.school}
          </div>
        </div>
      </div>
    </div>
  );
}
