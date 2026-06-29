/* ═══════════════════════════════════════════════════════════════
   BALAJI NEXTGEN ERP — Service Worker v1.0
   Offline-first with network-fallback strategy
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME     = 'bn-erp-v1';
const OFFLINE_URL    = '/offline.html';
const STATIC_ASSETS  = [
  '/',
  '/login.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

/* ── INSTALL: pre-cache shell ─────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching shell assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache (OK on first deploy):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: clean up old caches ───────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => { console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: Network-first, cache fallback ─────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and cross-origin requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  // Skip Google Apps Script / API calls — always go to network
  if (url.href.includes('script.google.com') ||
      url.href.includes('googleapis.com') ||
      url.href.includes('docs.google.com')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(networkResponse => {
        // Cache successful HTML/CSS/JS/image responses
        if (networkResponse.ok) {
          const resType = networkResponse.headers.get('content-type') || '';
          if (resType.includes('html') || resType.includes('css') ||
              resType.includes('javascript') || resType.includes('image')) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // For navigation requests, show offline page
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          // Return empty 204 for other assets
          return new Response('', { status: 204, statusText: 'Offline' });
        });
      })
  );
});

/* ── PUSH NOTIFICATIONS (future use) ─────────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'Balaji NextGen ERP', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Balaji NextGen ERP', {
      body:    payload.body  || 'You have a new notification',
      icon:    '/icons/icon-192x192.png',
      badge:   '/icons/icon-96x96.png',
      vibrate: [200, 100, 200],
      data:    payload.url ? { url: payload.url } : {}
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/login.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url === targetUrl && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow(targetUrl);
    })
  );
});
