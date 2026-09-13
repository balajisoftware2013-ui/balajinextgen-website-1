const CACHE = 'bnx-steward-v1-2026-09-09';
const APP_SHELL = [
  './steward-mobile.html',
  './manifest.json',
  './assets/common/app-icon.png',
  './assets/common/site-favicon.png',
  './assets/logo/logo-dark.png',
  './assets/logo/logo-light.png',
  './assets/login-bg/login-background.png',
  './assets/splash/splash-background.png',
  './assets/footer/footer-banner.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Same-origin application shell: cache first, then refresh in background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(resp => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return resp;
        }).catch(()=>cached);
        return cached || network;
      })
    );
  }
});
