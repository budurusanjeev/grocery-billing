// Hand-written service worker (no Workbox/build step) — caches pages and
// assets as they're visited, so the web app can be reopened later with no
// internet at all, as long as it's been opened at least once before while
// online. Deliberately does NOT touch cross-origin requests (Supabase, the
// scan/items/bills backend) — those need fresh data and already show a
// clear "no internet" message when offline (see src/lib/network.ts). This
// cache is only for the app shell itself: HTML/JS/CSS/images.
//
// Network-first, not cache-first: this app deploys often, and a cache-first
// strategy risks a shopkeeper getting stuck on a stale build indefinitely.
// Every successful online load refreshes the cache; offline falls back to
// whatever was last cached.

const CACHE_NAME = 'kirana-bill-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(
        () =>
          caches.match(request).then((cached) => cached) ||
          // A route that's never been visited before, opened offline for
          // the first time — fall back to the billing screen shell rather
          // than a bare browser "no internet" error page.
          caches.match('/index.html'),
      ),
  );
});
