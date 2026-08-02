// Service Worker for WealthPilot360 v1.4
// Handles offline support, caching, and auto-updates

const CACHE_VERSION = 'wealthpilot360-v26';
const APP_SHELL_URL = 'WealthPilot360.html';
const CACHE_URLS = [
  './',
  APP_SHELL_URL,
  'sw.js'
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
              console.warn('⚠️ Failed to cache:', url);
            })
          )
        );
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('❌ Installation failed:', err);
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
      .catch(err => console.error('❌ Activation failed:', err))
  );
});

// Fallback response for offline
function offlineFallbackResponse() {
  return caches.match(APP_SHELL_URL)
    .then(cached => cached || new Response(
      '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h1>You are offline</h1><p>App data is saved locally</p></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    ))
    .catch(() => new Response(
      '<html><body><h1>Offline</h1></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    ));
}

// Fetch Event - Network first for app shell, cache first for assets
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;
  
  let reqUrl;
  try { reqUrl = new URL(req.url); } catch (e) { return; }
  
  if (reqUrl.protocol !== 'http:' && reqUrl.protocol !== 'https:') return;
  if (reqUrl.origin !== self.location.origin) return;

  const isAppShell = req.mode === 'navigate' ||
    reqUrl.pathname.endsWith('/' + APP_SHELL_URL) ||
    reqUrl.pathname === '/' || reqUrl.pathname.endsWith('/');

  if (isAppShell) {
    // Network first for app shell
    event.respondWith(
      (async () => {
        try {
          const netResponse = await fetch(req, { cache: 'no-store' });
          if (netResponse && netResponse.ok) {
            try {
              const cache = await caches.open(CACHE_VERSION);
              await cache.put(req, netResponse.clone());
            } catch (cacheErr) {
              console.warn('⚠️ Cache update failed');
            }
            return netResponse;
          }
          const cached = await caches.match(req);
          return cached || netResponse || await offlineFallbackResponse();
        } catch (err) {
          console.log('🔌 Offline, serving cached app');
          const cached = await caches.match(req);
          return cached || await offlineFallbackResponse();
        }
      })()
    );
    return;
  }

  // Cache first for static assets
  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(req);
        if (cached) return cached;

        const netResponse = await fetch(req);
        if (netResponse && netResponse.ok && netResponse.type === 'basic') {
          try {
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(req, netResponse.clone());
          } catch (cacheErr) {
            console.warn('⚠️ Cache put skipped');
          }
        }
        return netResponse || await offlineFallbackResponse();
      } catch (err) {
        console.log('🔌 Offline, checking cache');
        return await offlineFallbackResponse();
      }
    })()
  );
});

// Message handler - Receive messages from app
self.addEventListener('message', event => {
  if (!event.data) return;

  const cmd = event.data.type || event.data.action;

  if (cmd === 'SKIP_WAITING') {
    self.skipWaiting();
    console.log('✅ Skipping waiting, activating update');
  }

  if (cmd === 'CLEAR_CACHE') {
    caches.delete(CACHE_VERSION)
      .then(() => console.log('🗑️ Cache cleared'))
      .catch(err => console.error('❌ Cache clear failed:', err));
  }
});

console.log('✅ WealthPilot360 Service Worker v1.4 loaded');
