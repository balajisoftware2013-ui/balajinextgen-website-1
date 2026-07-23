// Balaji WealthPilot 360 — Service Worker
// Upload this file to the SAME Netlify folder as Balaji_WealthPilot360.html
// (e.g. /Module/Mobile Apps/Balaji_WealthPilot360/sw.js) so it's registered same-origin.
const CACHE = 'wp360-v2';

// v2 FIX: script.google.com is the live financial-data sync API (GAS_URL in
// the app). The old fetch handler cached EVERY successful GET, including
// those sync calls — so if a request failed offline, it would silently
// serve an old cached balance/transaction snapshot with no indication it
// was stale. That's the one place "offline" should mean "fail visibly",
// not "show possibly-wrong numbers" — the app's own sync-status UI already
// handles offline/pending state correctly, so we just let those requests
// pass straight through, uncached, instead of intercepting them.
const NEVER_CACHE_HOSTS = ['script.google.com', 'script.googleusercontent.com'];

self.addEventListener('install', e => {
  self.skipWaiting();
  // Precache the app shell itself so a first offline open after at least
  // one successful online visit still has something to show.
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([self.registration.scope])).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (NEVER_CACHE_HOSTS.includes(url.hostname)) return; // let it hit the network directly, no cache involved

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match(self.registration.scope)))
  );
});
