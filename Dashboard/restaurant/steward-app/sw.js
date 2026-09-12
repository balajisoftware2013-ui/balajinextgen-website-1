const CACHE='bnx-steward-v2026-09-12-final';
const APP_SHELL=[
  './', './steward-mobile.html', './manifest.json',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png',
  './assets/login-bg.jpg'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).catch(()=>{}));
});
self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).then(res=>{
    if(res && res.ok && res.type==='basic'){
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
    }
    return res;
  }).catch(()=>caches.match(e.request)));
});
