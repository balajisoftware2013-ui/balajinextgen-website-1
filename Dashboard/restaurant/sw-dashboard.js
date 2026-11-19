/* v3 (2026-11-19) — Balaji NextGen ERP · restaurant folder service worker (restaurant-dashboard, customer-order,
   item-ar, menu-book … everything in this folder). Put this file in the SAME folder as restaurant-dashboard.html.
   Online  → always the website's current file (revalidated; 304 when unchanged) — never an older stored copy.
   Offline → the last stored copy, so the dashboard still opens.
   Never touches the ERP API (script.google.com), POST requests or partial (range) downloads.
   v3: new cache name (old stored copies are deleted), only real files are stored, range requests skipped. */
const BNX_CACHE = 'bnx-dashboard-v3';
const BNX_CDN = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|ajax\.googleapis\.com)$/;
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== BNX_CACHE && k.indexOf('bnx-dashboard-') === 0) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  let u; try { u = new URL(r.url); } catch (_) { return; }
  const same = u.origin === self.location.origin;
  if (!same && !BNX_CDN.test(u.hostname)) return;                 /* API, Drive photos, everything else: untouched */
  if (same && /\/sw(-dashboard)?\.js$/.test(u.pathname)) return;
  const key = new URL(r.url); key.searchParams.delete('_v'); key.searchParams.delete('_fresh');   /* one stored copy per file */
  const ck = key.toString();
  const isPage = r.mode === 'navigate' || /\.html?$/i.test(u.pathname) || u.pathname.endsWith('/');
  e.respondWith((async () => {
    try {
      const res = await fetch(r, { cache: isPage ? 'no-store' : 'no-cache' });   /* always ask the website */
      if (res && (res.ok && (res.type === 'basic' || res.type === 'cors') || res.type === 'opaque')) { const c = await caches.open(BNX_CACHE); c.put(ck, res.clone()); }
      return res;
    } catch (err) {                                                  /* offline */
      const c = await caches.open(BNX_CACHE);
      return (await c.match(ck)) || (await c.match(r)) || (isPage ? await c.match(ck, { ignoreSearch: true }) : null) || Response.error();
    }
  })());
});
