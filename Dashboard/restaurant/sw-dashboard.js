/* v2 (2026-10-11): always revalidate with the server (no stale HTTP-cache copy) and ignore the _v cache-buster when storing.
   Balaji NextGen ERP — offline copy of the restaurant dashboard (2026-10-09)
   Put this file in the SAME folder as restaurant-dashboard.html (e.g. Dashboard/restaurant/).
   Network-first: when online you always get the newest deployed files; when offline the last copy opens.
   Never caches the ERP API (script.google.com) or any POST — live data and saves always go to the server. */
const BNX_CACHE = 'bnx-dashboard-v2';   /* v2: forces old stored copies to be deleted */
const BNX_CDN = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)$/;
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== BNX_CACHE && k.indexOf('bnx-dashboard-') === 0) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin && !BNX_CDN.test(u.hostname)) return;   /* API and everything else: untouched */
  const key = new URL(r.url); key.searchParams.delete('_v');          /* one stored copy per page, not one per click */
  const ck = key.toString();
  e.respondWith((async () => {
    try {
      const res = await fetch(r, { cache: 'no-cache' });                /* always ask the server if the file changed */
      if (res && (res.ok || res.type === 'opaque')) { const c = await caches.open(BNX_CACHE); c.put(ck, res.clone()); }
      return res;
    } catch (err) {
      const c = await caches.open(BNX_CACHE);
      return (await c.match(ck)) || (await c.match(r)) || (r.mode === 'navigate' ? await c.match(ck, { ignoreSearch: true }) : null) || Response.error();
    }
  })());
});
