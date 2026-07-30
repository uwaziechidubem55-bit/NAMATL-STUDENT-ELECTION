// ===== ADDED: Version bump forces SW update on deploy =====
// Change this number every time you push an update.
const CACHE_VERSION = 2; // 👈 Set this to 2 to match your target version

// Rename your cache to include the version
const CACHE_NAME = 'namatl-vote-v' + CACHE_VERSION; // 👈 Automatically becomes 'namatl-vote-v2'

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
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 🚫 NEVER cache HTML — always fetch fresh from network
  if (event.request.mode === 'navigate' || 
      event.request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          if (event.request.method === 'GET') {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      });
    })
  );
});
