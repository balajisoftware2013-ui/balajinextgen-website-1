// Balaji NextGen — Business OS — minimal service worker
// Purpose: satisfies the "installable PWA" requirement (Chrome/Android need an active
// service worker with a fetch handler) and gives basic offline resilience for the app shell.
// This intentionally does NOT cache API calls to Google Apps Script — those always go live.

const CACHE_NAME = 'balaji-bos-v1';
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

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
