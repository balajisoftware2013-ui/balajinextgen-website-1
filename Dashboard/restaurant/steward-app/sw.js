/* HappyServe (steward-mobile) service worker — 2026-10-03 PRN-FW2
   Root cause fixed: phones kept running an OLD cached steward-mobile.html
   (the version that sent HTTPS to the printer's port 9100 → junk prints),
   so deploying the fix changed nothing on the phone.
   Now: pages are NETWORK-FIRST (cache only when offline), every old cache
   is deleted on activate, and the new worker takes over immediately.
   Requests to other origins (Google Apps Script API, Print Relay, printers)
   are never intercepted or cached. */
const VERSION = 'happyserve-2026-10-03-prnfw2';

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;           // API / relay / printer: browser handles it, never cached
  if (url.pathname.endsWith('/sw.js')) return;

  const isPage = req.mode === 'navigate' || /\.html?$/i.test(url.pathname) || url.pathname.endsWith('/');
  if (isPage) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) { const c = await caches.open(VERSION); c.put(req, fresh.clone()); }
        return fresh;
      } catch (_) {
        const hit = await caches.match(req, { ignoreSearch: true });
        return hit || new Response('<h3 style="font-family:sans-serif">Offline — reconnect to Wi-Fi and reopen HappyServe.</h3>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }
  /* icons / manifest / fonts on this origin: cache, refresh in background */
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
