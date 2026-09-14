import "dotenv/config"; // load variables from a .env file if one exists
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import memorystore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { registerWellKnown } from "./well_known";
import { createServer } from "http";
import { randomBytes } from "node:crypto";
import { pgPool, usePostgres, ensureSchema } from "./db";
import { say } from "@shared/server-messages";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    /**
     * True once a login on this request has succeeded.
     *
     * The login rate limiters read it to spend their budget on failures only.
     * A wrong password is answered 200 here, so the status code cannot tell
     * them apart — see onlyCountFailures in routes.ts.
     */
    loginSucceeded?: boolean;
  }
}

// Session type augmentation
declare module "express-session" {
  interface SessionData {
    teacherId?: number;
    // A student's own login. Until this existed there was no server-side
    // student identity at all: the client held the student in localStorage
    // and passed its id in the URL, so every /api/students/:id/* route
    // trusted whatever id it was handed.
    studentId?: number;
    // A parent's login. Deliberately a THIRD, separate field rather than a
    // shared "userId" with a role beside it: because teacher and student
    // routes read teacherId and studentId only, a parent session satisfies
    // none of them and is refused by the whole existing app by default. A
    // parent can therefore never gain student or teacher access, and new
    // routes are locked down unless someone opts them in.
    parentId?: number;
  }
}

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable must be set in production.");
}

/**
 * The key login cookies are signed with.
 *
 * Production must set it, and the line above refuses to start without one.
 * Development used to fall back to the fixed string "onpoint-dev-secret" — and
 * a signing key published in the repository is not a signing key: anyone who
 * can reach a dev server can mint a cookie that says they are the teacher.
 *
 * So development now gets a fresh random one each time the server starts. That
 * costs nothing here, because in SQLite mode sessions are kept in memory and
 * are already lost on every restart — and `npm run dev` restarts on every file
 * change. Anyone signed in is signed out by a restart either way.
 */
function sessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  const generated = randomBytes(32).toString("hex");
  console.log("[session] No SESSION_SECRET set, so a new one was generated for this run.");
  console.log("[session] Anyone signed in will be signed out when the server restarts.");
  return generated;
}

// Pick where login sessions are stored:
//   * PostgreSQL mode -> store sessions in the database (survives restarts).
//   * SQLite mode     -> keep sessions in memory (simple, fine for local use).
//
// createTableIfMissing is deliberately false. With it on, connect-pg-simple
// creates the table at boot by reading its own table.sql off disk:
//
//     fs.readFile(path.resolve(__dirname, './table.sql'))
//
// That works from node_modules, but this server is bundled by esbuild into a
// single dist/index.cjs (connect-pg-simple is on the bundle allowlist in
// script/build.ts). In the bundle __dirname is dist/, table.sql was never
// copied there, and the server dies on Render with:
//
//     ENOENT: no such file or directory, open '.../dist/table.sql'
//
// So the table is created once, by hand, and the app never runs DDL at boot.
// The SQL is in docs/DEPLOYMENT-SESSION-TABLE.sql. This is the better shape for
// production anyway: no schema changes on a cold start, and the app's database
// user does not need CREATE rights.
const sessionStore = usePostgres
  ? new (connectPgSimple(session))({ pool: pgPool as any, createTableIfMissing: false })
  : new (memorystore(session))({ checkPeriod: 24 * 60 * 60 * 1000 }); // clear expired daily

// ─── Transport security and response headers ────────────────────────────────
//
// Written out rather than pulled in from helmet, for the same reason passwords
// use Node's own scrypt: it is a dozen lines, every one of them readable, and
// it is one less dependency to install, audit and have `npm audit` complain
// about on a school laptop.
//
// These run BEFORE the session and the routes, so they cover every answer the
// server gives — the API, the React page, and an uploaded file alike.

/**
 * Send people to HTTPS, and tell their browser to stop asking.
 *
 * Deliberately keyed on X-Forwarded-Proto being PRESENT and saying http, not
 * on `NODE_ENV === "production"` alone. The header is set by the proxy the app
 * runs behind in production; a request that arrives without one is not coming
 * through that proxy at all — it is a health check, or `npm run check:offline:pwa`,
 * which serves a real production build over plain HTTP on port 5050. Redirecting
 * those would break them while protecting nobody.
 */
app.use((req, res, next) => {
  const forwarded = req.headers["x-forwarded-proto"];
  if (typeof forwarded === "string" && forwarded.split(",")[0].trim() === "http") {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }

  // Only worth sending once the connection is actually secure — and only then
  // is it safe: a browser that is told this over http has no way to check it.
  if (req.secure) {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // A browser must not guess a type from the bytes. This is the other half of
  // the uploaded-file fix: it is what stops a file we have declared is not
  // HTML being rendered as HTML anyway.
  res.set("X-Content-Type-Options", "nosniff");
  // Nothing here should ever be framed by another site.
  res.set("X-Frame-Options", "DENY");
  // Do not leak the address of a page — which can name a pupil or a submission
  // id — to anything the page links out to.
  res.set("Referrer-Policy", "same-origin");
  // The app asks for no camera, microphone or location, so say so.
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");

  next();
});

/**
 * The Content Security Policy — production only.
 *
 * Not in development because Vite's dev server needs inline scripts, `eval` for
 * hot reloading, and a websocket to a port of its own. A policy loose enough
 * for that would be loose enough to be worth nothing, and the thing it protects
 * against is a stranger reaching the school's real address, not localhost.
 *
 * Two entries are worth explaining rather than being taken on trust:
 *
 *  - `script-src 'self'` with NO 'unsafe-inline'. This is the one that matters,
 *    and it is only possible because client/index.html has no inline script —
 *    just a module tag. Adding one would silently break the app in production
 *    only, which is the worst place to find out, so don't.
 *  - `style-src` DOES allow 'unsafe-inline', because React sets inline styles
 *    and the chart component injects a <style> tag. An injected stylesheet is a
 *    far smaller problem than injected script, and removing it would mean
 *    rewriting how the UI is styled.
 *
 * The Google Fonts pair is there because index.html loads the school's
 * typefaces from them; drop the <link> and these can go.
 */
if (process.env.NODE_ENV === "production") {
  const CSP = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
  ].join("; ");

  app.use((_req, res, next) => {
    res.set("Content-Security-Policy", CSP);
    next();
  });
}

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: "auto",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // The BODY of the answer is logged in development only.
      //
      // It is genuinely useful while working, and it is the wrong thing to
      // write down on a running school: these bodies are children's names,
      // their marks and their teacher's comments, and a log is copied about,
      // shipped to whatever collects it, and kept long after the screen it was
      // drawn on. The line above — method, path, status, duration — is what a
      // production log actually needs.
      if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create the database tables if they don't exist yet (SQLite zero-setup mode).
  await ensureSchema();

  await registerRoutes(httpServer, app);

  // Android app-verification file. Registered before the client is served so it
  // is never swallowed by the catch-all that returns the React page.
  registerWellKnown(app);

  // The last line of defence: anything a route threw without catching.
  //
  // It used to answer with `err.message`, whatever that happened to be. A
  // thrown database error names tables and columns; a file error names paths on
  // the server; a driver error can carry a fragment of the query. None of that
  // is any use to a teacher, and all of it is useful to somebody probing the
  // app — so in production the details go to the log and a plain sentence goes
  // to the screen.
  //
  // `err.expose` is the http-errors convention: true when a message was written
  // deliberately to be read by whoever made the request (a 400 saying which
  // field is wrong), false for anything that merely escaped. Using the flag
  // rather than guessing from the status code means a route that raises a
  // deliberate, translated 4xx still reads properly.
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    // The full error, always, wherever the server's logs go.
    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    const inProduction = process.env.NODE_ENV === "production";
    const safeToShow = !inProduction || err.expose === true;

    if (safeToShow && err.message) {
      return res.status(status).json({ success: false, message: err.message });
    }
    // say() so this reads in the family's language like every other refusal.
    return res.status(status).json({ success: false, ...say("serverError") });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serve the app on the port from the PORT environment variable (default 5000).
  // This serves both the API and the client on the same port.
  // Note: `reusePort` is not used because Windows does not support it.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
