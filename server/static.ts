import express, { type Express, type Response } from "express";
import fs from "fs";
import path from "path";

/**
 * Serves the built React app in production, with the caching rules an
 * installed/Android-packaged app needs.
 *
 * The important idea: files whose names change on every build can be kept by the
 * phone forever, but the files that decide *which* version to load must always be
 * re-checked. Otherwise a student's phone can sit on an old version of the app
 * for days after an update.
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        applyCacheRules(res, filePath);
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    // Never cached: this is what tells the phone which build to load.
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

function applyCacheRules(res: Response, filePath: string) {
  const name = path.basename(filePath);
  const inAssetsFolder = path.dirname(filePath).split(path.sep).includes("assets");

  // The service worker decides when the app updates itself, so the phone must
  // always ask the server whether there is a newer copy.
  if (name === "sw.js") {
    res.set("Cache-Control", "no-cache");
    res.set("Service-Worker-Allowed", "/");
    return;
  }

  // The page shell and the install details, likewise always re-checked.
  if (name === "index.html" || name === "offline.html") {
    res.set("Cache-Control", "no-cache");
    return;
  }

  if (name === "manifest.webmanifest") {
    // Some older Android versions are fussy about this content type.
    res.type("application/manifest+json");
    res.set("Cache-Control", "public, max-age=3600");
    return;
  }

  // Vite gives these a content hash in the file name (app-a1b2c3d4.js), so a
  // changed file is always a *different* file. Safe to keep indefinitely.
  if (inAssetsFolder) {
    res.set("Cache-Control", `public, max-age=${ONE_YEAR_IN_SECONDS}, immutable`);
    return;
  }

  // Icons and the favicon: keep for a day. They change only when the logo does.
  res.set("Cache-Control", `public, max-age=${ONE_DAY_IN_SECONDS}`);
}
