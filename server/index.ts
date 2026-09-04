import "dotenv/config"; // load variables from a .env file if one exists
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import memorystore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { registerWellKnown } from "./well_known";
import { createServer } from "http";
import { pgPool, usePostgres, ensureSchema } from "./db";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Session type augmentation
declare module "express-session" {
  interface SessionData {
    teacherId?: number;
  }
}

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable must be set in production.");
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

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "onpoint-dev-secret",
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
      if (capturedJsonResponse) {
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

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
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
