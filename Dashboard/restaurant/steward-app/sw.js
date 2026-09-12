const CACHE='bnx-steward-v2026-09-11';
const APP_SHELL=['./','./steward-mobile.html','./manifest.json'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  // FIX ("PWA offline shell never works"): CACHE was declared but never
  // written to anywhere in this file -- install() only called
  // skipWaiting(), and fetch() fell back to caches.match(e.request) on a
  // cache that had never received a single entry, so that fallback could
  // never succeed and the app was 100% dependent on a live network
  // connection even to open the shell, despite the frontend's own offline
  // queueing (bnxQueuePending) assuming the app itself can still load.
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).catch(()=>{}));
});

self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    self.clients.claim(),
    // Drop any cache from a previous CACHE version so an app update can't
    // keep serving stale steward-mobile.html forever.
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    fetch(e.request).then(res=>{
      // Only runtime-cache same-origin, successful responses -- caching
      // opaque/cross-origin or error responses would let a bad response
      // (e.g. a 404 or a GAS auth redirect) get served offline forever.
      if(res && res.ok && res.type==='basic'){
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      }
      return res;
    }).catch(()=>caches.match(e.request))
  );
});
