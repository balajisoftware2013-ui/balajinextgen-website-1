// ════════════════════════════════════════════════════════════════════════
// service-worker_wealthpilot360.js — KILL SWITCH
// ════════════════════════════════════════════════════════════════════════
// This file used to be a CACHE-FIRST service worker for the whole app
// shell (it served /Balaji_WealthPilot360.html straight from cache before
// ever asking the network). Any device that installed it is permanently
// stuck showing whatever HTML was cached on the day it was installed —
// that device never even requests a newer page, because this worker
// intercepts the request and answers from its own cache first.
//
// The current app registers a different, correct worker (sw.js, network-
// first for the app shell) — but a device already running THIS worker
// never sees that change, because it's still being served by this one.
//
// Fix: browsers periodically re-fetch a registered service worker's own
// script to check whether its bytes changed. Overwriting this exact file
// with the code below means any device still running the old cache-first
// version will, on its next check-in:
//   1. Install this version instead (skipWaiting — immediate).
//   2. Delete every cache this worker ever created (wipes the trapped
//      stale HTML/JS so it can never be served again).
//   3. Unregister itself entirely, so from that point on this scope has
//      NO service worker at all, and every request goes straight to the
//      network like a normal page — which is exactly where the current
//      app's own sw.js registration (from a normal, non-cached page load)
//      can take over cleanly.
//   4. Tell every open tab/window it controls to hard-reload immediately.
// ════════════════════════════════════════════════════════════════════════

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete every cache this worker (or its predecessor) ever created.
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    // Unregister this worker entirely — no service worker controls this
    // scope after this point, so every future request just hits the
    // network normally.
    await self.registration.unregister();

    // Force every open tab/window this worker controls to reload right
    // now, so people don't have to know to do it themselves.
    const clientsList = await self.clients.matchAll({ type: 'window' });
    clientsList.forEach((client) => {
      client.navigate(client.url).catch(() => {
        // navigate() can be unsupported in some contexts — fall back to
        // asking the page itself to reload via postMessage.
        client.postMessage({ type: 'FORCE_RELOAD' });
      });
    });
  })());
});

// No fetch handler at all — while this version is briefly active during
// the transition, every request passes straight through untouched rather
// than being intercepted, which is the safest possible behavior for a
// worker that's in the process of decommissioning itself.
