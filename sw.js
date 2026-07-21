const CACHE_NAME = 'sidecut-shell-v35.6';
const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting(); // don't wait for old tabs to close — new version takes over right away
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME })))
  );
});

// Auto-update cache: index.html (and other same-origin shell files) go network-first,
// so a visit while online always checks for a newer version instead of quietly serving
// a stale cached copy. Falls back to whatever's cached the moment the network fails,
// so it still works offline. Everything cross-origin (fonts, JSZip CDN) just goes to network.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

// Lets a page ask the waiting/active worker to check for updates on demand
// (used by the in-app "Check for updates" flow) instead of only on page load.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_FOR_UPDATE') {
    self.registration.update().catch(() => {});
  }
});
