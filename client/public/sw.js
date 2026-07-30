/*
 * Service worker — the little background helper that lets the app open even
 * when the phone has no internet, and makes it start faster on a slow network.
 *
 * Plain JavaScript on purpose: it is copied straight into the build as-is, so
 * there is no compile step to think about.
 *
 * The rules, in plain language:
 *   * Pages          -> try the internet first, so people always get the newest
 *                       version. If the internet is down, show the offline page.
 *   * Built files     -> (the /assets/... files Vite makes) safe to keep forever,
 *                       because every build gives them a brand-new file name.
 *   * Icons, fonts    -> serve the saved copy straight away, then quietly refresh
 *                       it in the background.
 *   * Anything under /api/ or /uploads/ -> never saved. Marks, homework and
 *                       photos must always come fresh from the server, and we do
 *                       not want a student's work sitting in a cache.
 *
 * IMPORTANT: bump CACHE_VERSION whenever these rules change, so old saved copies
 * are thrown away.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `onpoint-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `onpoint-assets-${CACHE_VERSION}`;
const OFFLINE_PAGE = "/offline.html";

// The few files needed to show *something* useful with no internet.
const SHELL_FILES = [
  OFFLINE_PAGE,
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one missing file cannot fail the whole install.
      await Promise.all(
        SHELL_FILES.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {
            console.warn("[sw] could not pre-save", url);
          }),
        ),
      );
      // Don't sit around waiting — this version takes over on the next load.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Throw away caches left behind by older versions of this file.
      const keep = [SHELL_CACHE, ASSET_CACHE];
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// Lets the page ask us to activate straight away (see client/src/lib/pwa.ts).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** True for things that must never be saved: live data and uploaded files. */
function isPrivateOrLiveData(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/");
}

/** True for Vite's built files, whose names change on every build. */
function isBuiltAsset(url) {
  return url.pathname.startsWith("/assets/");
}

/** Icons, the manifest, fonts — small, rarely changing extras. */
function isStaticExtra(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.png" ||
    url.pathname === "/manifest.webmanifest" ||
    url.host === "fonts.googleapis.com" ||
    url.host === "fonts.gstatic.com"
  );
}

/** Only save real, complete answers (or fonts, which come back "opaque"). */
function isSaveable(response) {
  if (!response) return false;
  if (response.type === "opaque") return true; // cross-site font files
  return response.ok && response.status === 200;
}

/** Pages: internet first, saved copy or the offline page as a backup. */
async function handlePageRequest(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (
      (await cache.match(request)) ||
      (await cache.match(OFFLINE_PAGE)) ||
      new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
}

/** Built files: saved copy first — they never change under the same name. */
async function handleBuiltAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;

  const response = await fetch(request);
  if (isSaveable(response)) cache.put(request, response.clone());
  return response;
}

/** Extras: show the saved copy now, refresh it in the background. */
async function handleStaticExtra(request) {
  const cache = await caches.open(SHELL_CACHE);
  const saved = await cache.match(request);

  const refresh = fetch(request)
    .then((response) => {
      if (isSaveable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  if (saved) return saved;

  const fresh = await refresh;
  if (fresh) return fresh;
  throw new Error("offline and nothing saved");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only plain page/file downloads. Logins, submissions and part-file
  // ("range") requests for audio and video are left completely alone.
  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (isPrivateOrLiveData(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(handlePageRequest(request));
    return;
  }

  if (url.origin === self.location.origin && isBuiltAsset(url)) {
    event.respondWith(handleBuiltAsset(request));
    return;
  }

  if (isStaticExtra(url)) {
    event.respondWith(handleStaticExtra(request).catch(() => fetch(request)));
  }
});
