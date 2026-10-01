/* HAPPYSERVE steward service worker.
   - App shell cached for offline open.
   - HTML: network-first (so fixes reach stewards), cache fallback offline.
   - Google Apps Script / any cross-origin / non-GET request is NEVER cached
     (orders, KOTs and transfers must always hit the live server). */
const VERSION = 'happyserve-steward-v3';
const SHELL = ['./steward-mobile.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png', './assets/balaji-happyserve-96.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {}))); // one missing file must not break install
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('happyserve-steward-') && k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // API calls go straight to network
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(VERSION); c.put('./steward-mobile.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./steward-mobile.html')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) { const c = await caches.open(VERSION); c.put(req, res.clone()).catch(() => {}); }
      return res;
    } catch (err) { return Response.error(); }
  })());
});
