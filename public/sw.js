// "Kill switch" service worker.
//
// Some users may already have an older PWA service-worker installed which can
// cause stale builds (not refreshing after new Vercel deployments).
//
// By serving this script at the same URL, the browser can update the SW and then
// we immediately unregister + clear caches.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      // Claim clients so we can refresh them.
      await self.clients.claim();
    } catch {
      // ignore
    }

    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // ignore
    }

    try {
      await self.registration.unregister();
    } catch {
      // ignore
    }

    // Best-effort reload to get users onto the network version.
    try {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(windowClients.map((client) => client.navigate(client.url)));
    } catch {
      // ignore
    }
  })());
});
