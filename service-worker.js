// Balaji NextGen ERP - Service Worker
// Enables offline functionality, caching, and background sync

const CACHE_NAME = 'balaji-erp-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/manifest.json',
  '/assets/Logos/logo.png',
  '/assets/Logos/icon-192.png',
  '/assets/Logos/icon-512.png',
  '/assets/Logos/apple-touch-icon.png'
];

// ============================================
// INSTALLATION EVENT
// ============================================
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      // Don't fail if some assets aren't available
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATION EVENT
// ============================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================
// FETCH EVENT - Network-first strategy
// ============================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external origins
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Network-first for API calls (marked with ?nocache or specific paths)
  if (url.searchParams.has('nocache') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful responses
          if (response.ok && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache if network fails
          return caches.match(request).then(cached => {
            return cached || createOfflineResponse();
          });
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(request).then(response => {
          // Don't cache if not OK
          if (!response || response.status !== 200) {
            return response;
          }
          // Don't cache POST requests or responses with no-store
          if (request.method === 'POST' || response.headers.get('Cache-Control')?.includes('no-store')) {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clone);
          });
          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        if (request.destination === 'document') {
          return createOfflineResponse();
        }
        return new Response('Network request failed', {
          status: 408,
          statusText: 'Request Timeout'
        });
      })
  );
});

// ============================================
// OFFLINE RESPONSE
// ============================================
function createOfflineResponse() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Balaji ERP - Offline</title>
      <style>
        body { font-family: 'Poppins', sans-serif; background: #f4f8ff; display: flex; 
               align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .offline-box { background: white; border-radius: 12px; padding: 40px; 
                       text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
                       max-width: 400px; }
        h1 { color: #2563eb; font-size: 28px; margin-bottom: 10px; }
        p { color: #64748b; font-size: 16px; line-height: 1.6; }
        .icon { font-size: 48px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="offline-box">
        <div class="icon">📡</div>
        <h1>You're Offline</h1>
        <p>Your device is not connected to the internet. Please check your connection and try again.</p>
        <p style="font-size: 14px; margin-top: 20px; color: #94a3b8;">
          Some pages may still work with cached data.
        </p>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// ============================================
// BACKGROUND SYNC (for queuing offline requests)
// ============================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      (async () => {
        try {
          const requests = await getQueuedRequests();
          for (const req of requests) {
            await fetch(req);
          }
          await clearQueuedRequests();
        } catch (err) {
          console.error('[SW] Background sync failed:', err);
        }
      })()
    );
  }
});

// ============================================
// MESSAGE HANDLER (for app-to-worker communication)
// ============================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});

// Dummy functions (implement with IndexedDB if needed)
async function getQueuedRequests() { return []; }
async function clearQueuedRequests() { return true; }
