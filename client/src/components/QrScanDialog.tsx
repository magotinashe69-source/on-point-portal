// The camera half of card login.
//
// html5-qrcode is deliberately imported only when this dialog first opens.
// It is a few hundred kilobytes, and a pupil logging in with a name and
// password on a cheap Android over mobile data should never pay for it.
//
// The scanner fires its error callback on every frame it cannot read, which
// is most of them while the phone is still focusing. Those are not errors and
// are ignored; only a real failure — no camera, permission refused — is shown.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Where the video is mounted. html5-qrcode takes an element id, not a ref. */
const REGION_ID = "qr-scan-region";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the decoded text. Returns an error message, or null on success. */
  onScanned: (code: string) => Promise<string | null>;
}

export function QrScanDialog({ open, onOpenChange, onScanned }: Props) {
  const t = useT();
  const [status, setStatus] = useState<"starting" | "scanning" | "checking" | "failed">("starting");
  const [message, setMessage] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  // A scan fires repeatedly once it locks on. Without this the same card is
  // submitted a dozen times while the camera is still shutting down.
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    handledRef.current = false;
    setStatus("starting");
    setMessage(null);

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(REGION_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" }, // the back camera on a phone
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decoded: string) => {
            if (handledRef.current) return;
            handledRef.current = true;
            setStatus("checking");

            // Stop the camera before the network call, so the light goes out
            // as soon as the card has been read.
            try { await scanner.stop(); } catch { /* already stopping */ }

            const err = await onScanned(decoded);
            if (cancelled) return;
            if (err) {
              setStatus("failed");
              setMessage(err);
            }
            // On success the caller navigates away; nothing to do here.
          },
          () => {
            // Fired for every unreadable frame. Normal while focusing.
          },
        );

        if (!cancelled) setStatus("scanning");
      } catch (e: any) {
        if (cancelled) return;
        setStatus("failed");
        const name = String(e?.name || e?.message || e);
        if (/NotAllowed|Permission/i.test(name)) {
          setMessage("Please allow camera access, then tap Scan again.");
        } else if (/NotFound|NotReadable|Overconstrained/i.test(name)) {
          setMessage("No camera was found on this device. Log in with your name and password instead.");
        } else {
          setMessage("The camera could not be started. Log in with your name and password instead.");
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      // Best effort: the camera must be released even if the dialog is closed
      // mid-scan, or the light stays on.
      if (s) { try { s.stop().then(() => s.clear()).catch(() => {}); } catch { /* gone */ } }
    };
  }, [open, onScanned]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.visiting.scanYourCard}</DialogTitle>
          <DialogDescription>
            Hold your On Point card up to the camera. It will log you in on its own.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {/* The video region must stay mounted while scanning; html5-qrcode
              attaches to it by id. */}
          <div
            id={REGION_ID}
            className="w-full overflow-hidden rounded-sm bg-muted"
            style={{ minHeight: status === "failed" ? 0 : 240 }}
            data-testid="qr-scan-region"
          />

          {status === "starting" && (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting the camera
            </p>
          )}
          {status === "checking" && (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2" data-testid="qr-scan-checking">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your card
            </p>
          )}
          {status === "failed" && message && (
            <p className="text-sm text-destructive inline-flex items-start gap-2" data-testid="qr-scan-error">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {message}
            </p>
          )}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-qr-scan-close">
          {status === "failed" ? t.controls.close : t.controls.cancel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
