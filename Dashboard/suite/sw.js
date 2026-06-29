// ════════════════════════════════════════════════════════════════
// WealthPilot360 Service Worker v2 — Balaji NextGen Solutions
// This file MUST be served from the same directory as the HTML
// ════════════════════════════════════════════════════════════════
const CACHE_NAME = 'wp360-v2';
const APP_SHELL  = [
  './',
  './Balaji_WealthPilot360.html',
  './manifest.json'
];

// ── Install: cache app shell ──────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] Cache addAll partial fail:', err);
      });
    })
  );
});

// ── Activate: clear old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first with cache fallback ──────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (GAS, fonts, etc.)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache fresh responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // For navigation requests, return the main app
          if (event.request.mode === 'navigate') {
            return caches.match('./Balaji_WealthPilot360.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
