// Steward App — service worker
// Caches the app shell so it installs as a PWA and opens even with a flaky connection.
const CACHE = 'steward-app';
const ASSETS = [
  './steward-mobile.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // FIX ("install app not show" — while other pages in the suite
  // install fine): cache.addAll() is all-or-nothing — if even ONE of
  // these 4 files 404s on the server (a typo'd path, an icon that
  // was never actually uploaded), the whole install event rejects and
  // this service worker never finishes installing. A browser's native
  // "Add to Home Screen" / install prompt requires an ACTIVE service
  // worker as one of its installability criteria — so one missing
  // icon file could silently block the real install prompt entirely,
  // not just this app's own shell caching. Caches each asset
  // independently instead: one missing file is logged and skipped,
  // it no longer takes the rest down with it.
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(ASSETS.map((url) =>
        cache.add(url).catch((err) => console.warn('[sw] could not cache', url, err))
      ))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for HTML (so users always get the latest screen data/logic),
// cache-first for everything else (icons, manifest).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./steward-mobile.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const clone = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, clone));
      return res;
    }))
  );
});
