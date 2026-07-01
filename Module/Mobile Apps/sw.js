// Balaji NextGen — Business OS — service worker
// Purpose: (1) satisfies the "installable PWA" requirement, (2) gives basic offline
// resilience for the app shell, (3) makes sure new deployments actually reach users
// instead of getting stuck on a stale cached copy forever.
//
// STRATEGY: network-first for the HTML/manifest — always try to fetch the LATEST
// version first, and only fall back to the cached copy if the network request fails
// (genuinely offline). This is the opposite of cache-first, which was the bug: once
// cached, a cache-first strategy NEVER re-checks the network, so every future deploy
// was invisible until someone manually cleared their browser cache.
//
// Bump CACHE_NAME any time you want to force a clean slate for all users.
const CACHE_NAME = 'balaji-bos-v2';
const APP_SHELL = ['./balaji-business-os.html', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Never cache Google Apps Script calls — must always be live/fresh
  if (url.includes('script.google.com')) return;

  // Images (the logo, etc.) rarely change — serve from cache instantly if we have it,
  // and only hit the network the very first time. This is what actually fixes "logo
  // loads slowly every time" — a fresh network fetch on every single page load.
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(()=>{});
          return response;
        });
      })
    );
    return;
  }

  // Everything else (the HTML app shell, manifest) — network-first, see note above.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(()=>{});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
