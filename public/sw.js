// ============================================================
// NAMATL Service Worker v3 — hardened, auto-updating
// ============================================================

// New SW takes over immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// 👈 BUMP THIS EVERY TIME YOU DEPLOY — triggers SW update on devices
const CACHE_VERSION = 3;
const CACHE_NAME = 'namatl-vote-v' + CACHE_VERSION;

const ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // ===== HTML / navigations → NETWORK FIRST =====
  // Always fetch the fresh page so the latest build loads instantly.
  if (request.mode === 'navigate' ||
      request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // ===== Everything else → STALE-WHILE-REVALIDATE =====
  // Show cached copy instantly, but fetch fresh in the background
  // so new JS/CSS replaces old copies on every load (no stale builds).
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && request.method === 'GET') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});