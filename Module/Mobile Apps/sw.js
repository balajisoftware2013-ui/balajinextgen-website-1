/* ════════════════════════════════════════════════════════════════
   WealthPilot360 — Service Worker
   Upload this file in the SAME folder as your main HTML file on
   your server (e.g. Netlify). It must be served from the site's
   root/app folder, same-origin — that's a browser requirement for
   service workers, not something that can be fixed from the HTML.

   What this gives you:
   - Makes the app "installable" (Chrome/Edge require a registered
     service worker before showing the install icon in the address
     bar or firing the beforeinstallprompt banner).
   - Caches the app shell so the app still opens (and shows the
     last-loaded data) when there's no internet connection.
   - Bumping CACHE_VERSION below forces every installed copy to
     fetch the new files on next load, then auto-reload once
     (handled by the controllerchange listener already in the HTML).
   ════════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'wp360-v1';
const CACHE_NAME = `wealthpilot360-${CACHE_VERSION}`;

// Files that make up the app shell. Adjust the HTML filename below
// if yours is named differently than the one you uploaded.
const APP_SHELL = [
  './',
  './Balaji_WealthPilot360.html',
];

/* ── INSTALL: pre-cache the app shell ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('[SW] Pre-cache failed (non-fatal):', err))
  );
  // Activate this new service worker as soon as it finishes installing,
  // instead of waiting for all tabs to close.
  self.skipWaiting();
});

/* ── ACTIVATE: clean up old caches from previous versions ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of any already-open tabs immediately, which is what
  // triggers the 'controllerchange' event and the one-time auto-reload
  // in the HTML.
  self.clients.claim();
});

/* ── FETCH: network-first for navigation/HTML, cache-first for
   everything else. This keeps the app itself always up-to-date when
   online, while still working offline from the last cached version. ── */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests; let everything else (POST syncs to
  // Google Sheets, etc.) go straight to the network untouched.
  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate' ||
    (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Don't cache opaque/cross-origin error responses.
          if (!res || res.status !== 200 || res.type === 'error') return res;
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
    })
  );
});
