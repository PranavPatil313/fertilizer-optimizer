const CACHE_NAME = 'fert-opt-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  // API calls: Network-first, fallback to cache
  if (event.request.url.includes('/api/') || event.request.url.includes('/predict') || event.request.url.includes('/recommend')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    // Static assets: Cache-first, fallback to network
    event.respondWith(
      caches.match(event.request).then((res) => res || fetch(event.request))
    );
  }
});