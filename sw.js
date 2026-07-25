const CACHE_NAME = 'sidecut-shell-v40.3';
const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// Always skip waiting to get the latest version immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
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

// Network-first for index.html to ensure we always get the latest version
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Network-first for same-origin, especially index.html
  if (url.origin !== self.location.origin) return;
  
  // For index.html specifically, ALWAYS go to network
  if (url.pathname.endsWith('index.html') || url.pathname === '/' || url.pathname === '') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Update cache
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // For other files, try network first then cache
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_FOR_UPDATE') {
    self.registration.update().catch(() => {});
  }
});
