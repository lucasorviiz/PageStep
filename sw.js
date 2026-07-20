/*
 * sw.js — service worker for PageStep.
 *
 * Strategy:
 *   - Precache the app shell on install so it opens offline.
 *   - Serve same-origin GET requests cache-first, updating the cache in the
 *     background (stale-while-revalidate). Session logging works with no signal.
 *   - Never cache the Open Library API (cross-origin); those just pass through
 *     and fail gracefully when offline, falling back to manual add in the UI.
 *
 * Bump CACHE_VERSION whenever the shell files change to force an update.
 */
const CACHE_VERSION = "pagestep-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/store.js",
  "./js/api.js",
  "./js/goals.js",
  "./js/ui.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle our own origin; let the Open Library API / covers pass through.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        // cache successful basic responses for next time
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached); // offline: fall back to cache

      // cache-first for speed, revalidate in background
      return cached || network;
    })
  );
});
