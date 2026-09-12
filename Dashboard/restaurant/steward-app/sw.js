const CACHE = 'happyserve-steward-v2026-09-12-error-fixed';
const CORE = [
  './', './steward-mobile.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './assets/balaji-brand-logo.png', './assets/balaji-brand-logo-black.png',
  './assets/balaji-logo.png', './assets/common-balaji-banner.jpg', './assets/login-bg.jpg',
  './assets/client-10-logo.png', './assets/client-10-banner.png',
  './assets/clients/CLIENT-10/logo.png', './assets/clients/CLIENT-10/banner.png',
  './assets/clients/CLIENT-10/branding.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  try { if (new URL(r.url).origin !== self.location.origin) return; } catch (_) { return; }
  e.respondWith(fetch(r).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(r).then(x => x || caches.match('./steward-mobile.html'))));
});
