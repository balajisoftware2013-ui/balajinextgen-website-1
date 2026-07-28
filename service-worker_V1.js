/*******************************************************
 BALAJI NEXTGEN ERP
 FILE : service-worker.js
 PURPOSE : OFFLINE CACHE + PWA SUPPORT
 VERSION : V4 — Updated paths for v7 release
 Contact : 9832014403
********************************************************/

const CACHE_NAME = "BALAJI_NEXTGEN_CACHE_V4";

const urlsToCache = [
  "/",
  "/login.html",
  "/01_new_company_wizard.html",
  "/erp-config.js",
  "/session_guard.js",
  "/manifest.json",
  "/offline.html",
  "/assets/Logos/logo.png",
  "/assets/Logos/balajinextgen.png",
  "/balaji_erp_package/welcome_v9_dashboard_selector.html",
  "/Dashboard/restaurant/dashboard.html",
  "/Dashboard/restaurant/cashier-dashboard.html",
  "/Dashboard/restaurant/chef-orders.html",
  "/Dashboard/retail/Dashboard.html",
  "/Dashboard/super_admin_v4_UPGRADED.html",
  "/Dashboard/employee-dashboard.html",
  "/Dashboard/accounts/accounts.html"
];

/* ── INSTALL: cache core files ── */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[SW] Caching core files");
      return cache.addAll(urlsToCache).catch(err => {
        console.warn("[SW] Some files failed to cache:", err);
      });
    })
  );
  self.skipWaiting();
});

/* ── ACTIVATE: delete old caches ── */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            })
      )
    )
  );
  self.clients.claim();
});

/* ── FETCH: network first, cache fallback ── */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  /* Always go network-first for GAS API calls */
  if (url.hostname === "script.google.com") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          /* Offline fallback for HTML pages */
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/offline.html");
          }
        })
      )
  );
});
