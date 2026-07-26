/* ═══════════════════════════════════════════════════════════════
   Balaji WealthPilot 360 — Service Worker
   Upload this file next to your index.html on Netlify (same folder).
   The app's install code already looks for it at: <yourpath>/sw.js
═══════════════════════════════════════════════════════════════ */

// Bump this string on every deploy that should force a cache refresh.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `wealthpilot360-${CACHE_VERSION}`;

/* ── INSTALL: pre-cache the app shell, activate immediately ────── */
self.addEventListener('install', (event) => {
  self.skipWaiting(); // don't wait for old tabs to close
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([self.registration.scope]).catch(() => {})
    )
  );
});

/* ── ACTIVATE: drop old caches, take control of open tabs ──────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('wealthpilot360-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
      // Your page's controllerchange listener will now fire and
      // auto-reload the app to the fresh version — no code needed there.
    })()
  );
});

/* ── FETCH: offline-first strategy ──────────────────────────────
   - App navigation (the HTML itself): network-first, cached fallback
     so you always get the latest deploy when online, and the last
     cached version when offline.
   - Same-origin assets: cache-first, refreshed in the background.
   - Cross-origin calls (currency rates, Google Apps Script, etc.):
     network-first, cached fallback so a flaky connection doesn't
     hard-fail requests that were previously successful.
────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(
          () =>
            caches.match(req).then((cached) => cached) ||
            caches.match(self.registration.scope)
        )
    );
    return;
  }

  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});

/* ── PUSH: display a notification when the server sends one ────
   This handles RECEIVING and SHOWING a push once one arrives — it's
   the piece that has to live in the service worker. To actually send
   notifications you still need, separately from this file:
     1. A VAPID key pair (public key goes in the page,
        private key stays on your backend).
     2. Client code calling pushManager.subscribe() and saving the
        subscription (e.g. to your Google Apps Script backend).
     3. Backend code that POSTs to that subscription via the Web Push
        protocol when you want to notify a user.
   None of that exists yet in your app — this only wires up the
   receiving half so it's ready once you add the above.
────────────────────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Balaji WealthPilot 360', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Balaji WealthPilot 360';
  const options = {
    body: data.body || 'You have a new update.',
    icon: data.icon,
    badge: data.badge,
    data: data.url ? { url: data.url } : {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
