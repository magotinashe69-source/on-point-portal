// One certificate, opened to be printed.
//
// This file used to hold the Town Award certificate, which Dream World's
// retirement left pointing at a dead endpoint. The sheet design it carried was
// the school's, so it lives on in CertificateSheet — this page is now the
// printable view for any certificate a child has earned.
//
// Printing is the browser's own dialog. Choosing "Save as PDF" there produces
// the file; on a phone it is Share → Print → Save as PDF. No library, no fonts
// to embed, and the page is the thing that prints.

import { useEffect } from "react";
import { useLocation, Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { CertificateSheet } from "@/components/CertificateSheet";
import { CERTIFICATE_TEXT, type Certificate } from "@shared/certificates";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

const NAVY = "var(--onpoint-blue, #1F3864)";

export default function CertificatePage() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();
  const params = useParams<{ id?: string }>();
  const certificateId = params.id;

  useEffect(() => {
    if (!student) setLocation("/student/login");
  }, [student, setLocation]);

  const { data, isLoading } = useQuery<{
    success: boolean;
    certificate: Certificate;
    student: { fullName: string; form: string };
  }>({
    queryKey: ["/api/students", student?.id, "certificates", certificateId],
    enabled: !!student && !!certificateId,
  });

  if (!student) return null;

  const certificate = data?.certificate;

  return (
    <div className="cert-page min-h-screen bg-muted/40 py-6 px-3">
      <div className="cert-noprint mx-auto max-w-3xl flex items-center justify-between gap-3 mb-4">
        <Link href="/student/certificates" className="inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> {CERTIFICATE_TEXT.back}
        </Link>
        {certificate && (
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: NAVY }}
            data-testid="button-print"
          >
            <Printer className="h-4 w-4" /> {CERTIFICATE_TEXT.print}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="cert-noprint flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !certificate && (
        <p className="cert-noprint text-center text-sm text-muted-foreground py-16" data-testid="text-no-certificate">
          That certificate could not be found.
        </p>
      )}

      {certificate && (
        <>
          <CertificateSheet
            certificate={certificate}
            studentName={data?.student.fullName ?? student.fullName}
            form={data?.student.form ?? student.form}
          />
          <p className="cert-noprint text-center text-xs text-muted-foreground mt-4">
            {CERTIFICATE_TEXT.printNote}
          </p>
        </>
      )}
    </div>
  );
}
