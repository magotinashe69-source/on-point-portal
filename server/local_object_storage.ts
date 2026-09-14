// Local file storage — works on any computer (no cloud, no Replit needed).
//
// Uploaded files (student photos, lesson videos/audio, documents) are saved
// into a local `uploads/` folder next to the project.
//
// The upload flow is kept exactly the same as before, so the frontend does
// NOT need any changes:
//   1. The browser calls  POST /api/uploads/request-url  -> gets { uploadURL, objectPath }
//   2. The browser uploads the file with  PUT uploadURL
//   3. The browser saves objectPath; the file is shown later via  GET /objects/<id>
//
// ─── WHAT WAS WRONG WITH IT, AND WHY IT MATTERED ─────────────────────────────
//
// These routes had NO login check of any kind. They are registered on the same
// app as everything else, but they live in this file rather than in routes.ts,
// so they sat outside the guard that every route in there goes through. The
// effect was that anybody on the internet could:
//
//   * write files to the school's disk, of any size, without signing in;
//   * choose the Content-Type stored beside the file, which GET /objects/:id
//     then echoed back verbatim.
//
// The second one is the dangerous half. Upload an HTML file, say it is
// text/html, and the school's own address serves your JavaScript. Session
// cookies are httpOnly so a script cannot read them — but it is running ON the
// school's origin, and the session cookie rides along on every request it
// makes from there. SVG counts as HTML for this purpose: it can carry script.
//
// Three rules now, and all three matter:
//
//   1. YOU MUST BE SIGNED IN. Uploading is for a teacher or a pupil. Reading a
//      file back also allows a parent, who has a real reason to see the photo
//      of their own child's handwritten work.
//   2. THE CONTENT TYPE IS OURS, NOT THE CALLER'S. It is checked against a
//      list of types that cannot execute; anything else is stored as
//      application/octet-stream.
//   3. NOTHING IS EVER SERVED AS HTML. Even a file that got through with a
//      dangerous type stored beside it — an old upload from before this
//      existed — is sent as a download rather than rendered.

import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// Folder on this computer where uploaded files are stored.
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

/**
 * The biggest file anybody can upload.
 *
 * Without a cap, one caller can fill the disk — and a full disk takes the whole
 * school portal down, not just uploads. 25MB is comfortably more than a photo
 * of a page of handwriting and enough for a short lesson recording.
 */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * The shape of an upload address, as step 1 hands them out (a random UUID).
 *
 * Checked on the way in so that the id is never anything else: not "../x", not
 * a name somebody made up, and not "<id>.type" — which is where a file's
 * content type is kept, and would otherwise be writable as if it were a file.
 */
const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Types that a browser cannot be tricked into executing.
 *
 * Deliberately a list of what IS allowed rather than a list of what is banned:
 * a banned-list is only as good as the last person's imagination, and the cost
 * of missing one is script running on the school's own address.
 *
 * image/svg+xml is NOT here, and that is not an oversight. An SVG is a document
 * that can carry <script>, so a browser showing one inline is running it.
 */
const SAFE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "application/pdf",
]);

/** A stored type we are willing to send back as-is. Anything else downloads. */
function safeContentType(stored: string): string {
  // "image/png; charset=..." -> "image/png"
  const bare = stored.split(";")[0].trim().toLowerCase();
  return SAFE_TYPES.has(bare) ? bare : "application/octet-stream";
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * A guard from routes.ts. Answers the request itself and returns false when the
 * caller is not allowed — the same shape as every other guard in this app.
 */
type Guard = (req: Request, res: Response) => Promise<boolean>;

export function registerObjectStorageRoutes(
  app: Express,
  guards: { canUpload: Guard; canRead: Guard },
): void {
  ensureUploadDir();

  // Step 1: Tell the browser where to upload the file.
  // We make up a unique id and hand back two paths:
  //   - uploadURL:  where to PUT the file bytes
  //   - objectPath: the address used later to view the file
  app.post("/api/uploads/request-url", async (req: Request, res: Response) => {
    if (!(await guards.canUpload(req, res))) return;

    const { name, size, contentType } = req.body || {};
    const id = randomUUID();
    res.json({
      uploadURL: `/api/uploads/local/${id}`,
      objectPath: `/objects/${id}`,
      metadata: { name, size, contentType },
    });
  });

  // Step 2: Receive the actual file and save it to disk.
  // We also remember its content type (in a small ".type" file) so we can
  // serve it back correctly later — but it is OUR reading of the type that is
  // stored, never the caller's word for it.
  app.put("/api/uploads/local/:id", async (req: Request, res: Response) => {
    if (!(await guards.canUpload(req, res))) return;

    // Only an address step 1 could have handed out. Anything else is refused
    // outright rather than tidied into a filename.
    const id = String(req.params.id);
    if (!UPLOAD_ID.test(id)) {
      return res.status(400).json({ success: false, error: "That is not an upload address." });
    }
    const filePath = path.join(UPLOAD_DIR, id);

    // "wx" means: create the file, and FAIL if it is already there.
    //
    // Without it this route wrote over whatever was stored at that address. Any
    // signed-in pupil holding the address of somebody else's upload — a photo
    // of another child's handwritten work, a teacher's lesson recording — could
    // replace it with their own bytes. An upload is written once, never again.
    const writeStream = fs.createWriteStream(filePath, { flags: "wx" });

    // Whether THIS request created the file, and whether it got to the end.
    // Only a file this request created and did not finish is ever removed —
    // never one that was already there.
    let created = false;
    let finished = false;
    writeStream.on("open", () => { created = true; });

    // Count the bytes as they arrive rather than trusting a Content-Length
    // header, which the caller also writes and can simply understate.
    let written = 0;
    let tooBig = false;

    req.on("data", (chunk: Buffer) => {
      written += chunk.length;
      if (written > MAX_UPLOAD_BYTES && !tooBig) {
        tooBig = true;
        req.unpipe(writeStream);
        writeStream.destroy();
        if (!res.headersSent) {
          res.status(413).json({ success: false, error: "That file is too big." });
        }
        req.destroy();
      }
    });

    // The connection dropped part way through. Stop writing, so the half a file
    // is cleared away below and the browser's retry to the same address works.
    req.on("close", () => {
      if (!req.complete && !finished) writeStream.destroy();
    });

    // A file this request created but did not finish — too big, or cut off —
    // is not an upload, so it does not stay on the disk.
    writeStream.on("close", () => {
      if (created && !finished) fs.rm(filePath, { force: true }, () => {});
    });

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      finished = true;
      if (tooBig) return;
      const claimed = String(req.headers["content-type"] || "application/octet-stream");
      // Store what we are prepared to serve, not what we were told.
      fs.writeFileSync(`${filePath}.type`, safeContentType(claimed));
      res.json({ success: true });
    });

    writeStream.on("error", (err: NodeJS.ErrnoException) => {
      if (tooBig) return; // destroying the stream ourselves is not a failure
      if (err.code === "EEXIST") {
        // Something is already stored here. It is left exactly as it is.
        if (!res.headersSent) {
          res.status(409).json({ success: false, error: "Something has already been uploaded to that address." });
        }
        return;
      }
      console.error("Upload write error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to save file" });
      }
    });
  });

  // Step 3: Serve a saved file back to the browser.
  app.get(/^\/objects\/(.+)$/, async (req: Request, res: Response) => {
    if (!(await guards.canRead(req, res))) return;

    const id = path.basename(req.path.replace(/^\/objects\//, ""));
    const filePath = path.join(UPLOAD_DIR, id);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Look up the content type we saved during upload. It is passed through
    // safeContentType() again on the way out, so a file stored BEFORE any of
    // this existed — when the caller's own word was written down — still
    // cannot be served as something that executes.
    let contentType = "application/octet-stream";
    try {
      const saved = fs.readFileSync(`${filePath}.type`, "utf-8").trim();
      if (saved) contentType = safeContentType(saved);
    } catch {
      // No ".type" file — fall back to the default above.
    }

    // If the request asks for a download, set a filename.
    const download = req.query.download as string | undefined;
    if (download) {
      res.set("Content-Disposition", `attachment; filename="${encodeURIComponent(download)}"`);
    } else if (contentType === "application/octet-stream") {
      // Anything we are not confident about is offered as a file rather than
      // rendered in the page.
      res.set("Content-Disposition", "attachment");
    }

    res.set("Content-Type", contentType);
    // Belt and braces: stops a browser guessing a type from the bytes and
    // rendering as HTML something we have just declared is not HTML.
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "private, max-age=3600");
    fs.createReadStream(filePath).pipe(res);
  });
}
