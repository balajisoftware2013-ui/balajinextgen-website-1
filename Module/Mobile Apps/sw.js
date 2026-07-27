// ════════════════════════════════════════════════════════════════════════
// Balaji NextGen Business OS — Service Worker
// ════════════════════════════════════════════════════════════════════════
// FIX (this version): the old service worker cached the app's own HTML,
// which is exactly what caused "I uploaded a new balaji-business-os.html
// but some browsers still show the old one." A frequently-updated app
// shell must NEVER be cache-first — only truly static sub-resources
// (logo, icons, manifest) should be cached, and even those go
// network-first so an updated asset shows promptly. The HTML document
// itself, and anything talking to the Apps Script backend, always goes
// straight to the network; a cached copy is only used as an offline
// fallback if the network request genuinely fails.
//
// Bump CACHE_VERSION on every deploy that changes cached static assets
// (not required for HTML/JS changes inside balaji-business-os.html itself,
// since those are never cached by this file — only bump when logo/icon/
// manifest files change). Bumping it also forces old cached entries from
// any previous version to be dropped on activate.
// ════════════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'bnos-v1';

self.addEventListener('install', () => {
  // Take over immediately instead of waiting for every open tab to close —
  // this is what makes a fresh deploy actually take effect, combined with
  // the app's own 'controllerchange' listener that reloads the page once
  // this new worker takes control.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept POSTs (e.g. Apps Script saves)

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Only ever handle plain http(s) requests. Caching a "chrome-extension://"
  // (or any other non-http scheme) request always throws
  // "Failed to execute 'put' on 'Cache': Request scheme ... is unsupported" —
  // this guard is what stops those errors from appearing in the console.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  const isHtmlFile = url.pathname.endsWith('.html');
  const isBackend = url.hostname === 'script.google.com';

  // App shell (any .html page) and every call to the Apps Script backend:
  // always network, no caching at all. A stale HTML page or a cached API
  // response are both worse than a failed request here.
  if (isNavigation || isHtmlFile || isBackend) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Everything else (logo, icons, manifest.json, etc.): network-first so an
  // updated asset is picked up on the very next load, falling back to the
  // last cached copy only when the network request fails (offline / flaky
  // connection) — never served stale-while-network-is-fine.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
