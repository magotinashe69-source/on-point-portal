import type { Express, Request, Response } from "express";

/**
 * Serves `/.well-known/assetlinks.json` — the file Android looks for to confirm
 * that this website and the Android app belong to the same owner.
 *
 * Why it matters: the Play Store app is a "Trusted Web Activity", which is
 * really Chrome showing this website full-screen. Android only hides the browser
 * address bar once it has fetched this file from the live site and found the
 * app's signing fingerprint listed in it. Without it the app still works, but
 * a URL bar sits at the top and it stops looking like a real app.
 *
 * It is generated from environment variables rather than committed as a static
 * file, because the fingerprint depends on the signing key used for the Play
 * Store upload:
 *
 *   ANDROID_PACKAGE_NAME       e.g. zw.co.onpointeducation.homework
 *   ANDROID_CERT_FINGERPRINTS  SHA-256 fingerprint(s), comma separated
 *
 * See docs/ANDROID_PACKAGING.md for where to find the fingerprint.
 */
export function registerWellKnown(app: Express) {
  app.get("/.well-known/assetlinks.json", (_req: Request, res: Response) => {
    const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
    const fingerprints = parseFingerprints(process.env.ANDROID_CERT_FINGERPRINTS);

    // Not set up yet (for example, on a local machine or before the first Play
    // Store upload). Say so clearly instead of falling through to the React app,
    // which would confusingly return an HTML page for a .json address.
    if (!packageName || fingerprints.length === 0) {
      return res.status(404).json({
        message:
          "Android app links are not configured. Set ANDROID_PACKAGE_NAME and " +
          "ANDROID_CERT_FINGERPRINTS — see docs/ANDROID_PACKAGING.md.",
      });
    }

    res.type("application/json");
    // Android re-checks this occasionally; a short cache keeps it current.
    res.set("Cache-Control", "public, max-age=300");
    res.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ]);
  });
}

/**
 * Turns the comma-separated environment variable into a clean list.
 *
 * Fingerprints get copied out of Play Console and `keytool` in slightly
 * different shapes, so this accepts them with or without colons and in any
 * letter case, then writes them out the one way Android expects:
 * upper-case pairs separated by colons.
 *
 * Anything that is not 32 bytes of hex is dropped and logged, so a typo shows up
 * in the server log instead of quietly breaking app verification.
 */
function parseFingerprints(raw: string | undefined): string[] {
  if (!raw) return [];

  const cleaned: string[] = [];

  for (const entry of raw.split(",")) {
    const hexOnly = entry.replace(/[^0-9a-fA-F]/g, "").toUpperCase();

    if (hexOnly.length !== 64) {
      if (entry.trim()) {
        console.warn(`[assetlinks] ignoring fingerprint that is not 32 hex bytes: "${entry.trim()}"`);
      }
      continue;
    }

    cleaned.push(hexOnly.match(/.{2}/g)!.join(":"));
  }

  return cleaned;
}
