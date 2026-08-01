// Service Worker for Balaji WealthPilot360
// Version 2.0 — FIXED: network-first for the app shell, so new deploys
// are picked up automatically instead of being served from a
// permanently-frozen cache.
//
// ⚠️ BUMP THIS NUMBER ON EVERY DEPLOY. Even with the fix below, bumping
// it guarantees a clean cache on update and makes old caches get swept
// by the activate handler.
const CACHE_VERSION = 'wealthpilot360-v2.0.1';

// Only the bare shell — everything else is cached on-demand as it's
// requested, using the fetch handler below.
const APP_SHELL = ['./', './WealthPilot360.html'];

// ── Install: pre-cache the shell using a REAL network fetch ─────────
// { cache: 'reload' } bypasses the browser's own HTTP cache, so we
// don't accidentally seed the SW cache with a stale HTTP-cached copy.
self.addEventListener('install', event => {
  console.log('🔧 SW installing:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.all(
        APP_SHELL.map(url =>
          fetch(url, { cache: 'reload' })
            .then(res => cache.put(url, res))
            .catch(err => console.warn('⚠️ Precache failed:', url, err))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete every cache that isn't the current version ─────
self.addEventListener('activate', event => {
  console.log('🔄 SW activating:', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE_VERSION).map(n => {
          console.log('🗑️ Deleting old cache:', n);
          return caches.delete(n);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = req.url;

  if (req.method !== 'GET') return;

  // Never intercept Google / Apps Script calls — let those hit the
  // network directly, always, no caching.
  if (url.includes('googleapis.com') || url.includes('google.com') || url.includes('script.google.com')) {
    return;
  }

  const isAppShell = req.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/');

  if (isAppShell) {
    // NETWORK-FIRST for the app shell: always try to get the latest
    // HTML when online. Cache is only a fallback for offline use —
    // never the primary source. This is the core fix: previously this
    // was cache-first, which meant an installed PWA could get stuck
    // showing a version from months ago forever, even after redeploys.
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          console.log('🔌 Offline — falling back to cached shell for:', url);
          return caches.match(req).then(cached => cached || caches.match('./WealthPilot360.html'));
        })
    );
    return;
  }

  // CACHE-FIRST for everything else (icons, fonts, static assets that
  // rarely change) — fine to serve instantly from cache, refresh in
  // the cache for next time.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});

// ── Background Sync (unchanged) ──────────────────────────────────
self.addEventListener('sync', event => {
  console.log('🔄 Background sync event:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(
      self.clients.matchAll()
        .then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'BACKGROUND_SYNC', message: 'Syncing financial data with server...' });
          });
        })
        .catch(err => console.error('❌ Sync error:', err))
    );
  }
});

// ── Push Notifications (unchanged) ───────────────────────────────
self.addEventListener('push', event => {
  console.log('📬 Push notification received');
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23FF7A1A" width="192" height="192" rx="30"/><text x="96" y="110" font-size="80" fill="white" text-anchor="middle" font-family="Arial" font-weight="bold">WP</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle fill="%23FF7A1A" cx="48" cy="48" r="48"/></svg>',
    tag: 'wealthpilot360-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  event.waitUntil(self.registration.showNotification('WealthPilot360', options));
});

self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event.action);
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(clientList => {
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].url.endsWith('WealthPilot360.html') && 'focus' in clientList[i]) {
              return clientList[i].focus();
            }
          }
          if (clients.openWindow) return clients.openWindow('./WealthPilot360.html');
        })
    );
  }
});

// ── Message Handler (unchanged) ──────────────────────────────────
self.addEventListener('message', event => {
  console.log('📨 Message from app:', event.data);
  if (event.data && event.data.action === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.action === 'CLEAR_CACHE') {
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
    console.log('🗑️ All caches cleared');
  }
  if (event.data && event.data.action === 'CACHE_URLS') {
    caches.open(CACHE_VERSION).then(cache => cache.addAll(event.data.urls || []));
  }
});

console.log('✅ WealthPilot360 Service Worker (v2.0.1, network-first shell) loaded and ready');
