// Fuel Log — Service Worker
// Bump CACHE_VERSION whenever index.html or these assets change, so
// installed clients pick up the update (the app also surfaces an
// "update available" toast tied to this via the SW lifecycle events).
const CACHE_VERSION = 'v4';
const CACHE_NAME = 'fuellog-' + CACHE_VERSION;
const SCOPE = '/Fuel-loggings/';

const PRECACHE_URLS = [
  SCOPE,
  SCOPE + 'index.html',
  SCOPE + 'manifest.json',
  SCOPE + 'icon-192.png',
  SCOPE + 'icon-512.png',
  SCOPE + 'icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // don't block install if one precache asset 404s
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Never intercept cross-origin requests (Google Maps, Nominatim, PetrolSpy,
  // open-meteo, the XLSX/Leaflet/Tesseract CDN scripts, etc.) — those need
  // the network directly and their own normal browser caching.
  if (!req.url.startsWith(self.location.origin)) return;

  // Navigations (loading the app shell): network-first so you get the
  // latest version when online, falling back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
          return resp;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match(SCOPE + 'index.html')))
    );
    return;
  }

  // Everything else same-origin: cache-first, revalidate in the background.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Lets the app trigger a notification from JS via
// navigator.serviceWorker.ready.then(reg => reg.showNotification(...))
// — used for the local over-budget alert. No push subscription or backend
// is involved; this only fires while the app is open and calls it directly.
