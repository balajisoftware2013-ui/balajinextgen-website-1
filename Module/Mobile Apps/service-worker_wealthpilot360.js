// Service Worker for Balaji WealthPilot360
// Version 1.0
// Features: Offline support, caching, background sync

const CACHE_VERSION = 'wealthpilot360-v1.0.0';
const CACHE_URLS = [
  '/',
  '/Balaji_WealthPilot360.html',
  '/manifest_wealthpilot360.json',
  '/service-worker_wealthpilot360.js'
];

// Install Event - Cache essential files
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        console.log('✅ Cache opened:', CACHE_VERSION);
        // Cache essential files
        return Promise.all(
          CACHE_URLS.map(url => {
            return cache.add(url).catch(err => {
              console.warn('⚠️ Failed to cache:', url, err);
            });
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        self.skipWaiting();
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
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_VERSION) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch Event - Serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip external URLs
  if (url.includes('googleapis.com') || url.includes('google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if available
        if (response) {
          console.log('📦 Serving from cache:', url);
          return response;
        }
        
        // Fetch from network
        return fetch(event.request)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200) {
              return response;
            }
            
            // Clone response for caching
            const responseToCache = response.clone();
            
            // Cache successful responses
            caches.open(CACHE_VERSION)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('💾 Cached:', url);
              });
            
            return response;
          })
          .catch(error => {
            // Network error - return cached fallback
            console.log('🔌 Offline - serving cached:', url);
            return caches.match('/WealthPilot360/index.html')
              .then(response => {
                if (response) {
                  return response;
                }
                // Generic offline response
                return new Response(
                  '<html><body><h1>Offline</h1><p>You are offline. Local data is still accessible.</p></body></html>',
                  {
                    headers: { 'Content-Type': 'text/html' }
                  }
                );
              });
          });
      })
  );
});

// Background Sync Event - Sync data when online
self.addEventListener('sync', event => {
  console.log('🔄 Background sync event:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Send queued data to server
      self.clients.matchAll()
        .then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'BACKGROUND_SYNC',
              message: 'Syncing financial data with server...'
            });
          });
        })
        .catch(err => {
          console.error('❌ Sync error:', err);
        })
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
  );
});

// Notification Click Event
self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(clientList => {
          // Look for already open window
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].url === '/WealthPilot360/index.html' && 'focus' in clientList[i]) {
              return clientList[i].focus();
            }
          }
          // Open new window if not found
          if (clients.openWindow) {
            return clients.openWindow('/WealthPilot360/index.html');
          }
        })
    );
  }
});

// Message Handler - Receive messages from app
self.addEventListener('message', event => {
  console.log('📨 Message from app:', event.data);
  
  if (event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.action === 'CLEAR_CACHE') {
    caches.delete(CACHE_VERSION).then(() => {
      console.log('🗑️ Cache cleared');
    });
  }
  
  if (event.data.action === 'CACHE_URLS') {
    caches.open(CACHE_VERSION)
      .then(cache => {
        cache.addAll(event.data.urls || []);
      });
  }
});

console.log('✅ WealthPilot360 Service Worker loaded and ready');
