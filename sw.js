// ── Fuel Log Service Worker ─────────────────────────────────────────
// Hosted at: https://ericbui670.github.io/Fuel-loggings/

const CACHE_NAME = 'fuellog-v1';
const BASE = '/Fuel-loggings';

const SHELL = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/sw.js',
];

// ── Install: cache app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for shell, network-first for APIs ─────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always pass through external API calls (Google, Nominatim, OpenMeteo etc.)
  if (url.origin !== self.location.origin) {
    return; // let browser handle normally
  }

  // Cache-first for same-origin requests (app shell)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful same-origin responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — serve index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(BASE + '/index.html');
        }
      });
    })
  );
});
