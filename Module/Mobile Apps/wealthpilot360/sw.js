// ════════════════════════════════════════════════════════════════════════
// Balaji NextGen — Shared Service Worker (Mobile Apps folder)
// ════════════════════════════════════════════════════════════════════════
// Serves BOTH balaji-business-os.html and WealthPilot360.html — they live
// in the same folder and both register 'sw.js' at that same folder path,
// so there is only ever one service worker/cache scope covering both apps
// regardless of which HTML file the person currently has open. This file
// merges the two previously-separate copies (which had drifted slightly
// out of sync) back into one source of truth.
//
// A frequently-updated app shell must NEVER be cache-first — only truly
// static sub-resources (logo, icons, manifest) should be cached, and even
// those go network-first so an updated asset shows promptly. The HTML
// document itself (any .html file, so this works for BOTH apps without
// naming either one specifically), and anything talking to the Apps
// Script backend, always goes straight to the network; a cached copy is
// only used as an offline fallback if the network request genuinely fails.
//
// Bump CACHE_VERSION whenever you want to force every open tab/PWA of
// EITHER app to drop its cached static assets and refetch them fresh —
// not required for ordinary HTML/JS changes inside either app's own
// file, since those are never cached by this worker at all.
// ════════════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'balaji-apps-v1';

self.addEventListener('install', () => {
  // Take over immediately instead of waiting for every open tab to close —
  // this is what makes a fresh deploy actually take effect, combined with
  // each app's own 'controllerchange' listener that reloads the page once
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

// Explicit handshake some pages' registration code sends: forces an
// already-installed-but-waiting worker to activate right now, instead of
// sitting idle until every open tab/PWA instance of either app closes —
// on mobile, apps are usually backgrounded rather than actually closed,
// so without this a fresh deploy could sit waiting indefinitely.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

  // App shell (ANY .html page — covers both apps without naming either
  // one) and every call to the Apps Script backend: always network, no
  // caching at all. A stale HTML page or a cached API response are both
  // worse than a failed request here.
  if (isNavigation || isHtmlFile || isBackend) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Everything else (logos, icons, manifest.json, etc., for either app):
  // network-first so an updated asset is picked up on the very next load,
  // falling back to the last cached copy only when the network request
  // fails (offline / flaky connection) — never served stale-while-
  // network-is-fine.
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
