/* Balaji NextGen — offline service worker for the Balaji POS page.
   Keep this file in the SAME folder as balaji-pos-billing.html and restaurant-dashboard.html. */
const CACHE = 'bnx-pos-offline-v2';
const CORE = ['balaji-pos-billing.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('bnx-pos-offline-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isPos = url.origin === location.origin && /balaji-pos-billing\.html$/.test(url.pathname);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'cdn.jsdelivr.net' && /\/qz-tray@/.test(url.pathname));
  if (!isPos && !isFont) return; // never touch dashboard / API calls

  // Stale-while-revalidate: open instantly (even offline), refresh cache when online.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: isPos }).then((hit) => {
        const net = fetch(req)
          .then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || net;
      })
    )
  );
});
