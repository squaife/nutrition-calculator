// DS Nutrition Calculator — Service Worker
// Cache-first strategy: app works fully offline after first load.
// Update strategy: new SW activates immediately on next visit after an update.

const CACHE_NAME = 'ds-nutrition-v1';

// Files to cache on install — the complete app shell
const PRECACHE_URLS = [
  './nutrition-calculator.html',
  './manifest.json',
  // Google Fonts are cached at runtime on first load (see fetch handler below)
];

// ---- INSTALL: pre-cache app shell ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ---- ACTIVATE: clean up old caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control immediately
  );
});

// ---- FETCH: cache-first, fall back to network ----
self.addEventListener('fetch', event => {
  // Skip non-GET requests and browser-extension requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(response => {
        // Only cache valid responses (not errors, not opaque cross-origin)
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Cache Google Fonts and other assets on first use
        const shouldCache =
          event.request.url.includes('fonts.googleapis.com') ||
          event.request.url.includes('fonts.gstatic.com') ||
          event.request.url.endsWith('.html') ||
          event.request.url.endsWith('.json') ||
          event.request.url.endsWith('.png') ||
          event.request.url.endsWith('.svg');

        if (shouldCache) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }

        return response;
      }).catch(() => {
        // Network failed — return offline fallback if available
        return caches.match('./nutrition-calculator.html');
      });
    })
  );
});
