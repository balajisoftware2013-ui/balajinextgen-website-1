/* HAPPYSERVE service worker — makes Android/Chrome offer "Install app" and keeps the shell available offline.
   Live data (Google Apps Script, print relay) is NEVER cached. Bump VERSION to force an update. */
const VERSION = 'hs-shell-20261003-1';
const SHELL = ['./', './steward-mobile.html', './manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))   // one missing file must not break install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // script.google.com, fonts, relay etc. go straight to network
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html');
  if (isPage) {
    // network first so a new app version is picked up immediately; cached copy only when offline
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./steward-mobile.html')))
    );
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
