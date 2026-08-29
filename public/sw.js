// RentLink service worker — minimal, network-first. Its job is installability
// and a graceful offline page, NOT caching live data (this is a live app, so we
// never serve stale properties/payments from cache).
const CACHE = "rentlink-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Only intercept page navigations, to show the offline page when the network
  // is gone. Everything else goes straight to the network.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const c = await caches.open(CACHE);
          const offline = await c.match(OFFLINE_URL);
          return offline || Response.error();
        }
      })()
    );
  }
});
