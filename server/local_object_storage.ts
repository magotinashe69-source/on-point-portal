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

import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// Folder on this computer where uploaded files are stored.
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export function registerObjectStorageRoutes(app: Express): void {
  ensureUploadDir();

  // Step 1: Tell the browser where to upload the file.
  // We make up a unique id and hand back two paths:
  //   - uploadURL:  where to PUT the file bytes
  //   - objectPath: the address used later to view the file
  app.post("/api/uploads/request-url", (req: Request, res: Response) => {
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
  // serve it back correctly later.
  app.put("/api/uploads/local/:id", (req: Request, res: Response) => {
    const id = path.basename(String(req.params.id)); // basename blocks sneaky paths like "../"
    const filePath = path.join(UPLOAD_DIR, id);
    const writeStream = fs.createWriteStream(filePath);

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      const contentType = req.headers["content-type"] || "application/octet-stream";
      fs.writeFileSync(`${filePath}.type`, String(contentType));
      res.json({ success: true });
    });

    writeStream.on("error", (err) => {
      console.error("Upload write error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to save file" });
      }
    });
  });

  // Step 3: Serve a saved file back to the browser.
  app.get(/^\/objects\/(.+)$/, (req: Request, res: Response) => {
    const id = path.basename(req.path.replace(/^\/objects\//, ""));
    const filePath = path.join(UPLOAD_DIR, id);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Look up the content type we saved during upload.
    let contentType = "application/octet-stream";
    try {
      const saved = fs.readFileSync(`${filePath}.type`, "utf-8").trim();
      if (saved) contentType = saved;
    } catch {
      // No ".type" file — fall back to the default above.
    }

    // If the request asks for a download, set a filename.
    const download = req.query.download as string | undefined;
    if (download) {
      res.set("Content-Disposition", `attachment; filename="${encodeURIComponent(download)}"`);
    }

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "private, max-age=3600");
    fs.createReadStream(filePath).pipe(res);
  });
}
