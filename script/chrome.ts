// Driving a real Chrome, over the DevTools Protocol.
//
// Why a real browser at all, when the HTTP checks already prove the server
// keeps its side of the bargain? Because the promise offline mode makes is
// about a PHONE: work answered with no signal, saved on the device, sent when
// the signal comes back. None of that happens on the server, and none of it can
// be tested by sending it requests. It needs a browser that really has
// IndexedDB, really runs a service worker, and can really have its network
// pulled out.
//
// Two things a real browser caught that no HTTP test would have:
//
//   * navigator.onLine reported TRUE after reopening the app with the network
//     pulled — it only knows the device is attached to something, not that the
//     something can reach the school.
//   * an offline page request fell back to a dead-end "you are offline" page,
//     so a child who had saved their homework could not get to it.
//
// Written against the protocol directly, with the `ws` this project already
// depends on, rather than adding Puppeteer: a browser driver is a very large
// dependency to install on every machine for the sake of two check scripts.
// What is needed here is small — open a tab, run some JavaScript in it, turn
// the network off — and it is all below.
//
// The one piece of real cunning is setOffline(). Chrome's network emulation is
// set per DEBUGGING SESSION, not per browser, and a service worker is a target
// of its own with its own session. Turning the network off on the page alone
// leaves the service worker happily online — which is precisely the half that
// has to fail for the offline fallback to be exercised at all. So every target
// is attached to as it appears, and the network is pulled on all of them.

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Where Chrome usually is. CHROME_PATH wins, for anywhere it is not. */
function findChrome(): string {
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    localAppData ? join(localAppData, "Google", "Chrome", "Application", "chrome.exe") : undefined,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((path): path is string => !!path);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Could not find Chrome. Install it, or set CHROME_PATH to the browser you want these checks driven in.",
  );
}

// --- The protocol connection ---

type Params = Record<string, unknown>;
type EventHandler = (params: any, sessionId?: string) => void;

/**
 * One WebSocket to the browser, carrying every conversation on it.
 *
 * "Flattened" sessions are the reason there is only one socket: each attached
 * target gets a sessionId, and a message is addressed by putting that id on it.
 * Without flattening, every target would need its own socket and its own
 * plumbing.
 */
class Connection {
  private socket: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private handlers = new Map<string, Set<EventHandler>>();
  private closed = false;

  private constructor(socket: WebSocket) {
    this.socket = socket;

    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());

      if (typeof message.id === "number") {
        const waiting = this.pending.get(message.id);
        if (!waiting) return;
        this.pending.delete(message.id);
        if (message.error) waiting.reject(new Error(`${message.error.message} (${message.error.code})`));
        else waiting.resolve(message.result);
        return;
      }

      // forEach rather than for...of throughout this file: the project compiles
      // without a target, so iterating a Set or Map directly is a type error.
      this.handlers.get(message.method)?.forEach((handler) => {
        handler(message.params, message.sessionId);
      });
    });

    // A browser that dies mid-run must fail the checks, not hang them for ever.
    const giveUp = () => {
      this.closed = true;
      this.pending.forEach((waiting) => {
        waiting.reject(new Error("The browser closed while the check was still talking to it."));
      });
      this.pending.clear();
    };
    socket.on("close", giveUp);
    socket.on("error", giveUp);
  }

  static async open(url: string): Promise<Connection> {
    const socket = new WebSocket(url, { maxPayload: 256 * 1024 * 1024 });
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    return new Connection(socket);
  }

  send(method: string, params: Params = {}, sessionId?: string): Promise<any> {
    if (this.closed) return Promise.reject(new Error("The browser connection is closed."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(method: string, handler: EventHandler): void {
    let set = this.handlers.get(method);
    if (!set) { set = new Set(); this.handlers.set(method, set); }
    set.add(handler);
  }

  close(): void {
    this.closed = true;
    try { this.socket.close(); } catch { /* already gone */ }
  }
}

// --- A tab ---

export class Page {
  constructor(private connection: Connection, readonly sessionId: string) {}

  private send(method: string, params: Params = {}): Promise<any> {
    return this.connection.send(method, params, this.sessionId);
  }

  async start(): Promise<void> {
    await this.send("Page.enable");
    await this.send("Runtime.enable");
  }

  /**
   * Run JavaScript in the page and hand back what it returns.
   *
   * The code is wrapped in an async function, so `return` and `await` both work
   * and a check can read IndexedDB — which is the whole reason this exists.
   */
  async evaluate<T = unknown>(code: string): Promise<T> {
    const result = await this.send("Runtime.evaluate", {
      expression: `(async () => { ${code} })()`,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      const thrown = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`The page threw: ${thrown}`);
    }
    return result.result?.value as T;
  }

  /**
   * Wait until some JavaScript in the page says yes.
   *
   * Errors are swallowed rather than thrown, because "the page is halfway
   * through navigating and has no execution context yet" is the normal state of
   * a browser being driven, not a failure. Only running out of time is.
   */
  async waitFor(code: string, what: string, timeoutMs = 15000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError = "";
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate<boolean>(code)) return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await sleep(100);
    }
    throw new Error(
      `Waited ${timeoutMs}ms for ${what} and it never happened.${lastError ? ` Last error: ${lastError}` : ""}`,
    );
  }

  async goto(url: string): Promise<void> {
    await this.send("Page.navigate", { url });
    await this.waitForLoad();
  }

  async reload(): Promise<void> {
    await this.send("Page.reload", {});
    await this.waitForLoad();
  }

  async waitForLoad(timeoutMs = 20000): Promise<void> {
    await this.waitFor(`return document.readyState === "complete"`, "the page to finish loading", timeoutMs);
  }

  async url(): Promise<string> {
    return this.evaluate<string>(`return location.pathname`);
  }

  // --- Talking to the app by its test ids ---
  //
  // Every control this drives already carries a data-testid, so nothing here
  // depends on wording, styling or where a button sits on the screen.

  async exists(testId: string): Promise<boolean> {
    return this.evaluate<boolean>(`return !!document.querySelector('[data-testid="${testId}"]')`);
  }

  async waitForTestId(testId: string, timeoutMs = 15000): Promise<void> {
    await this.waitFor(
      `return !!document.querySelector('[data-testid="${testId}"]')`,
      `[data-testid="${testId}"] to appear`,
      timeoutMs,
    );
  }

  async textOf(testId: string): Promise<string> {
    return this.evaluate<string>(
      `return document.querySelector('[data-testid="${testId}"]')?.textContent?.trim() ?? ""`,
    );
  }

  /** The whole page as text, for checking a sentence a child would actually read. */
  async bodyText(): Promise<string> {
    return this.evaluate<string>(`return document.body?.innerText ?? ""`);
  }

  async click(testId: string): Promise<void> {
    await this.waitForTestId(testId);
    await this.evaluate(`
      const el = document.querySelector('[data-testid="${testId}"]');
      if (el.disabled) throw new Error('[data-testid="${testId}"] is disabled');
      el.click();
    `);
  }

  /**
   * Type into a field the way React will notice.
   *
   * Setting .value straight is invisible to React: it tracks the value itself
   * and skips an event whose value it thinks it already knows. Going through
   * the prototype's own setter and then firing a bubbling "input" is what
   * Testing Library does, and it is what the form here listens for.
   */
  async fill(testId: string, value: string): Promise<void> {
    await this.waitForTestId(testId);
    await this.evaluate(`
      const el = document.querySelector('[data-testid="${testId}"]');
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    `);
  }

  // --- Holding a request up ---
  //
  // Used for the one case no amount of waiting can produce on its own: a
  // hand-in that REACHES the school and whose reply never gets back.

  async interceptRequests(urlPattern: string, stage: "Request" | "Response"): Promise<void> {
    await this.send("Fetch.enable", { patterns: [{ urlPattern, requestStage: stage }] });
  }

  async stopIntercepting(): Promise<void> {
    await this.send("Fetch.disable").catch(() => { /* the tab may already be gone */ });
  }

  onRequestPaused(handler: (params: any) => void): void {
    this.connection.on("Fetch.requestPaused", (params, sessionId) => {
      if (sessionId === this.sessionId) handler(params);
    });
  }
}

// --- The browser ---

export class Browser {
  private offline = false;
  /** Every target we are attached to, so the network can be pulled on all of them. */
  private sessions = new Set<string>();
  /** Which session belongs to which target, so a new tab can be found again. */
  private sessionByTarget = new Map<string, string>();

  private constructor(
    private connection: Connection,
    private process: ChildProcess,
    private profileDir: string,
  ) {}

  static async launch(options: { headless?: boolean } = {}): Promise<Browser> {
    const headless = options.headless ?? process.env.HEADED !== "1";
    const profileDir = mkdtempSync(join(tmpdir(), "onpoint-offline-check-"));

    // A brand-new profile every run, thrown away at the end. These checks are
    // about what a phone has SAVED — a leftover service worker or an old
    // IndexedDB from the last run would make a green run meaningless.
    const args = [
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-extensions",
      "--disable-sync",
      "--mute-audio",
      "--window-size=1280,900",
      ...(headless ? ["--headless=new"] : []),
      "about:blank",
    ];

    const chrome = spawn(findChrome(), args, { stdio: ["ignore", "ignore", "pipe"] });

    // Chrome writes the port it actually chose into the profile. Asking for a
    // fixed port instead would collide with any Chrome already being debugged,
    // and silently drive the wrong browser.
    const port = await readChosenPort(chrome, profileDir);
    const endpoint = await browserWebSocketUrl(port);

    const connection = await Connection.open(endpoint);
    const browser = new Browser(connection, chrome, profileDir);
    await browser.watchTargets();
    return browser;
  }

  /**
   * Attach to everything, as it appears.
   *
   * Service workers are the reason this is automatic rather than a list of
   * tabs. One starts up on its own, some time after the page that registered
   * it, and it is a separate target with a separate session — so it has to be
   * caught as it is created and have the network pulled on it too, or the "no
   * signal" checks quietly test nothing.
   */
  private async watchTargets(): Promise<void> {
    this.connection.on("Target.attachedToTarget", (params) => {
      const { sessionId, targetInfo } = params;
      this.sessions.add(sessionId);
      if (targetInfo?.targetId) this.sessionByTarget.set(targetInfo.targetId, sessionId);
      // A worker that starts while the network is already off must be born
      // offline, not join a run that has moved on without it.
      if (this.offline) void this.pullNetwork(sessionId, true);
    });

    this.connection.on("Target.detachedFromTarget", (params) => {
      this.sessions.delete(params.sessionId);
      this.sessionByTarget.forEach((sessionId, targetId) => {
        if (sessionId === params.sessionId) this.sessionByTarget.delete(targetId);
      });
    });

    await this.connection.send("Target.setAutoAttach", {
      autoAttach: true,
      // Nothing may start life paused: a service worker held at its first line
      // would never install, and the run would wait for a cache that is never
      // written.
      waitForDebuggerOnStart: false,
      flatten: true,
    });
  }

  async newPage(url = "about:blank"): Promise<Page> {
    const { targetId } = await this.connection.send("Target.createTarget", { url });

    // Auto-attach usually gets there first; if it has not, ask directly.
    const deadline = Date.now() + 5000;
    while (!this.sessionByTarget.has(targetId) && Date.now() < deadline) await sleep(50);

    let sessionId = this.sessionByTarget.get(targetId);
    if (!sessionId) {
      const attached = await this.connection.send("Target.attachToTarget", { targetId, flatten: true });
      sessionId = attached.sessionId as string;
      this.sessions.add(sessionId);
      this.sessionByTarget.set(targetId, sessionId);
    }

    const page = new Page(this.connection, sessionId);
    await page.start();
    return page;
  }

  /**
   * Pull the network out, or plug it back in — everywhere at once.
   *
   * Chrome's own emulation rather than a blocked port or a stopped server,
   * because it is the only one of the three that makes navigator.onLine false
   * and fetch() reject exactly as a phone losing signal does.
   */
  async setOffline(offline: boolean): Promise<void> {
    this.offline = offline;
    const attached: string[] = [];
    this.sessions.forEach((sessionId) => attached.push(sessionId));
    for (const sessionId of attached) {
      await this.pullNetwork(sessionId, offline);
    }
  }

  private async pullNetwork(sessionId: string, offline: boolean): Promise<void> {
    try {
      await this.connection.send("Network.enable", {}, sessionId);
      await this.connection.send("Network.emulateNetworkConditions", {
        offline,
        latency: 0,
        downloadThroughput: offline ? 0 : -1,
        uploadThroughput: offline ? 0 : -1,
      }, sessionId);
    } catch {
      // Not every target speaks Network, and one that does not is not a failure.
    }
  }

  async close(): Promise<void> {
    try { await this.connection.send("Browser.close"); } catch { /* already going */ }
    this.connection.close();

    // Windows keeps a handle on the profile for a moment after Chrome exits,
    // and a check that leaves temporary directories behind is one that fills a
    // disk over a term.
    await Promise.race([
      new Promise<void>((resolve) => this.process.once("exit", () => resolve())),
      sleep(5000),
    ]);
    if (this.process.exitCode === null) this.process.kill();

    for (let attempt = 0; attempt < 10; attempt++) {
      try { rmSync(this.profileDir, { recursive: true, force: true }); return; }
      catch { await sleep(200); }
    }
  }
}

/** Chrome writes the port it chose into DevToolsActivePort once it is ready. */
async function readChosenPort(chrome: ChildProcess, profileDir: string): Promise<number> {
  const portFile = join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 30000;

  let complaints = "";
  chrome.stderr?.on("data", (chunk) => { complaints += chunk.toString(); });

  while (Date.now() < deadline) {
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited before it was ready (${chrome.exitCode}).\n${complaints.slice(-2000)}`);
    }
    try {
      // The file is written in two goes, so a first line that is not yet a
      // number means we caught it halfway.
      const first = readFileSync(portFile, "utf-8").split("\n")[0]?.trim();
      if (first && /^\d+$/.test(first)) return parseInt(first, 10);
    } catch { /* not written yet */ }
    await sleep(100);
  }
  throw new Error(`Chrome never said which port it was debugging on.\n${complaints.slice(-2000)}`);
}

async function browserWebSocketUrl(port: number): Promise<string> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      const body = await response.json() as { webSocketDebuggerUrl?: string };
      if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl;
    } catch { /* still starting */ }
    await sleep(100);
  }
  throw new Error("Chrome is debugging on a port but would not say where to connect.");
}
