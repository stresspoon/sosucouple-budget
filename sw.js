// Service Worker for 소수커플 가계부 PWA
const CACHE_NAME = 'sosu-budget-v1';
const STATIC_ASSETS = [
  '/',
  '/add',
  '/calendar',
  '/stats',
  '/settings',
  '/js/tailwind-config.js',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/calendar.js',
  '/js/stats.js',
  '/icon.png',
  '/manifest.json'
];

// Install: pre-cache static shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/data, cache-first for static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // Network-first for API calls and Supabase
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first for external CDNs (Tailwind, fonts, html2canvas, Gemini)
  if (url.hostname !== location.hostname) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for local static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Background update
        fetch(e.request).then(res => {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, res));
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      });
    })
  );
});
