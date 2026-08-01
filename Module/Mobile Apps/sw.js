// Service Worker for Balaji WealthPilot360
// Version 1.2 — fixes the SKIP_WAITING message field-name mismatch that
// let a broken/outdated service worker get stuck in control indefinitely
// (root cause of "blank screen/error after Install"), plus everything
// from v1.1 below.
//
// v1.2 ROOT CAUSE FIXED:
//  The page's own auto-update logic posts { type: 'SKIP_WAITING' } to
//  force an updated worker to activate immediately instead of waiting
//  for every open tab to close (the normal, much slower default
//  behavior). This file was only listening for event.data.action —
//  a different field entirely — so that message did nothing, every
//  time, on every device. A fixed deploy could sit "waiting" forever
//  while the phone kept the old, broken worker in control — which is
//  exactly what caused "I uploaded the fix but still get a blank
//  screen/error." Now accepts both `type` and the legacy `action` field.
//
// v1.1 ROOT CAUSES FIXED (from v1.0):
//  1. CACHE_URLS pointed at '/Balaji_WealthPilot360.html', but the file
//     actually deployed is 'WealthPilot360.html' (confirmed from the
//     live URL: .../Module/Mobile Apps/WealthPilot360.html). That file
//     never cached successfully, so install-time caching silently
//     failed for the one file that matters most.
//  2. The offline fallback looked up '/WealthPilot360/index.html' —
//     a path that has never existed on this site at all — so on a
//     genuine offline hit, caches.match() for the fallback ALSO came
//     back empty and the handler fell through to a bare HTML string,
//     losing the app shell entirely instead of serving the real page.
//  3. `caches.open(CACHE_VERSION).then(cache => cache.put(...))` had NO
//     .catch — cache.put() rejects (not just returns falsy) for
//     non-basic/opaque responses, non-GET requests, and unsupported
//     schemes (chrome-extension:, data:, blob:). Each rejection was an
//     unhandled promise rejection — exactly the "Uncaught (in promise)"
//     pattern seen in the console, and one more request scheme than
//     the original filter caught could easily produce a value that
//     isn't a Response by the time it reaches respondWith().
//  4. The fetch handler wasn't wrapped in try/catch and had no final
//     guarantee that every code path resolves to an actual Response —
//     any synchronous throw (e.g. response.clone() on an already-used
//     body) turned into an unhandled rejection instead of a safe
//     fallback Response.
//  5. Message handler read event.data.action without checking
//     event.data first — postMessage(undefined) would throw.
//
// FIX STRATEGY: same-origin GET requests only ever get cache-first-then-
// network; everything else (POST, cross-origin, non-http(s) schemes) is
// explicitly left alone (no respondWith at all) so the browser handles
// it natively — this is also what keeps your Apps Script /exec calls
// (SAVE_DB, LOAD_DB, etc.) completely untouched by the service worker,
// which is what you want for API calls. Every branch that DOES call
// respondWith is wrapped so it can only ever resolve to a Response.

const CACHE_VERSION = 'wealthpilot360-v1.2.0';
const APP_SHELL_URL = 'WealthPilot360.html'; // relative to SW scope — matches the real deployed filename
const CACHE_URLS = [
  './',
  APP_SHELL_URL,
  'sw.js' // v1.2 FIX: must be deployed AS sw.js (that's the literal filename the page registers) — caching it under its old name was never actually reachable
];

// Install Event - Cache essential files
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');

  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        console.log('✅ Cache opened:', CACHE_VERSION);
        return Promise.all(
          CACHE_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn('⚠️ Failed to cache:', url, err && err.message);
            })
          )
        );
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('❌ Installation failed:', err && err.message);
      })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activating...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => name !== CACHE_VERSION)
            .map(name => {
              console.log('🗑️ Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
      .catch(err => console.error('❌ Activation cleanup failed:', err && err.message))
  );
});

// A tiny helper that is GUARANTEED to return a real Response no matter
// what goes wrong upstream — this is what closes off the
// "Failed to convert value to 'Response'" error class for good.
function offlineFallbackResponse() {
  return caches.match(APP_SHELL_URL)
    .then(cached => cached || new Response(
      '<html><body style="font-family:sans-serif;text-align:center;padding:40px">' +
      '<h1>You are offline</h1><p>Your saved data is still available in the app.</p>' +
      '</body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    ))
    .catch(() => new Response(
      '<html><body><h1>Offline</h1></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    ));
}

// Fetch Event - cache-first for same-origin GET requests only.
// Everything else (POST/PUT/etc, cross-origin calls like your Apps
// Script /exec endpoint, non-http(s) schemes) is left completely alone
// — no event.respondWith() at all — so the browser's normal network
// stack handles it, and the service worker can never interfere with
// SAVE_DB / LOAD_DB / login / any other API call.
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;                 // let POST/etc pass through untouched
  let reqUrl;
  try { reqUrl = new URL(req.url); } catch (e) { return; }
  if (reqUrl.protocol !== 'http:' && reqUrl.protocol !== 'https:') return; // chrome-extension:, data:, blob:, etc — leave alone
  if (reqUrl.origin !== self.location.origin) return; // cross-origin (Apps Script, Google Fonts, CDNs, etc) — always go straight to network, never cached

  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(req);
        if (cached) return cached;

        const netResponse = await fetch(req);

        // Only cache genuinely cacheable, successful, basic responses.
        if (netResponse && netResponse.ok && netResponse.type === 'basic') {
          try {
            const toCache = netResponse.clone();
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(req, toCache);
          } catch (cacheErr) {
            console.warn('⚠️ Cache put skipped:', cacheErr && cacheErr.message);
          }
        }

        return netResponse || await offlineFallbackResponse();
      } catch (err) {
        console.log('🔌 Offline or fetch failed, serving fallback for:', req.url);
        return offlineFallbackResponse();
      }
    })()
  );
});

// Background Sync Event - Sync data when online
self.addEventListener('sync', event => {
  console.log('🔄 Background sync event:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(
      self.clients.matchAll()
        .then(clientList => {
          clientList.forEach(client => {
            client.postMessage({
              type: 'BACKGROUND_SYNC',
              message: 'Syncing financial data with server...'
            });
          });
        })
        .catch(err => console.error('❌ Sync error:', err && err.message))
    );
  }
});

// Push Notification Event
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
      {
        action: 'open',
        title: 'Open',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><text x="48" y="60" font-size="50" text-anchor="middle">➜</text></svg>'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><text x="48" y="60" font-size="50" text-anchor="middle">✕</text></svg>'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('WealthPilot360', options)
      .catch(err => console.error('❌ showNotification failed:', err && err.message))
  );
});

// Notification Click Event
self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' })
        .then(clientList => {
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].url.endsWith(APP_SHELL_URL) && 'focus' in clientList[i]) {
              return clientList[i].focus();
            }
          }
          if (self.clients.openWindow) {
            return self.clients.openWindow(APP_SHELL_URL);
          }
        })
        .catch(err => console.error('❌ notificationclick failed:', err && err.message))
    );
  }
});

// Message Handler - Receive messages from app
self.addEventListener('message', event => {
  console.log('📨 Message from app:', event.data);

  if (!event.data) return; // guard against postMessage(undefined/null)

  // v1.2 FIX ("stuck old service worker → blank screen after install"):
  // the page's own auto-update logic posts { type: 'SKIP_WAITING' } to
  // force-activate a waiting worker immediately (see the registration
  // code in the HTML). This handler was only checking event.data.action
  // — a different field — so that message was silently ignored every
  // single time, and a broken/outdated service worker could stay in
  // control indefinitely with no way to self-heal. Accepts both `type`
  // and the legacy `action` field now, so the page's update mechanism
  // actually works.
  const cmd = event.data.type || event.data.action;

  if (cmd === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (cmd === 'CLEAR_CACHE') {
    caches.delete(CACHE_VERSION)
      .then(() => console.log('🗑️ Cache cleared'))
      .catch(err => console.error('❌ Cache clear failed:', err && err.message));
  }

  if (cmd === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(event.data.urls))
      .catch(err => console.warn('⚠️ CACHE_URLS addAll failed:', err && err.message));
  }
});

console.log('✅ WealthPilot360 Service Worker v1.2 loaded and ready');
