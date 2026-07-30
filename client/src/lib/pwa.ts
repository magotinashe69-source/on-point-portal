/**
 * Turns on the service worker (see client/public/sw.js) — the background helper
 * that lets the app open without internet and makes it start faster.
 *
 * Only runs in the built/production app. During development it is deliberately
 * switched off, and any worker left over from a previous production visit is
 * removed, because a cached old version while you are editing code is
 * confusing.
 */

/** Where the service worker lives. It must sit at the top level to cover the whole app. */
const SERVICE_WORKER_URL = "/sw.js";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (!import.meta.env.PROD) {
    void removeAnyServiceWorker();
    return;
  }

  // Wait until the page has finished loading so this never competes with the
  // app itself for a slow connection.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL)
      .then((registration) => {
        // If a newer version is already waiting, let it take over right away.
        watchForUpdates(registration);
      })
      .catch((error) => {
        // Not being able to install it is never fatal — the app still works.
        console.warn("[pwa] service worker did not install:", error);
      });
  });
}

/**
 * When a new version of the app is deployed, ask the waiting worker to take
 * over immediately instead of lingering until every tab is closed.
 */
function watchForUpdates(registration: ServiceWorkerRegistration) {
  const askWaitingWorkerToTakeOver = () => {
    registration.waiting?.postMessage("SKIP_WAITING");
  };

  askWaitingWorkerToTakeOver();

  registration.addEventListener("updatefound", () => {
    registration.installing?.addEventListener("statechange", (event) => {
      if ((event.target as ServiceWorker).state === "installed") {
        askWaitingWorkerToTakeOver();
      }
    });
  });
}

/** Development safety net: clear out a worker installed by an earlier production build. */
async function removeAnyServiceWorker() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Nothing to clean up, or the browser would not let us. Either way, carry on.
  }
}
