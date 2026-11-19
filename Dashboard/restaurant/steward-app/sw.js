/* HappyServe (steward-mobile) service worker — 2026-11-19 FRESH
   2026-10-03: pages network-first (old cached steward-mobile.html sent HTTPS to the printer → junk prints).
   2026-11-19: EVERYTHING on this site is now network-first, not only pages. Before, data files, photos and scripts
               (book.json, menu photos, menu-ar.js …) came from the stored copy first and were refreshed only in the
               background, so Chrome stayed one upload behind (Google app, which has no worker, showed the new one).
   Now: online → always the file on the website (revalidated, 304 when unchanged); offline → the last stored copy.
   Old caches are deleted on activate and the new worker takes over at once.
   Requests to other origins (Google Apps Script API, Print Relay, printers) are never intercepted or cached. */
const VERSION = 'happyserve-2026-11-19-fresh';

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
  if (req.headers.has('range')) return;                      // video / partial downloads: browser handles them

  const isPage = req.mode === 'navigate' || /\.html?$/i.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: isPage ? 'no-store' : 'no-cache' });   // always the website's current file
      if (fresh && fresh.ok && fresh.type === 'basic') { const c = await caches.open(VERSION); c.put(req, fresh.clone()); }
      return fresh;
    } catch (_) {                                             // offline: last stored copy
      const c = await caches.open(VERSION);
      const hit = (await c.match(req)) || (isPage ? await c.match(req, { ignoreSearch: true }) : null);
      if (hit) return hit;
      return isPage
        ? new Response('<h3 style="font-family:sans-serif">Offline — reconnect to Wi-Fi and reopen HappyServe.</h3>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        : Response.error();
    }
  })());
});
