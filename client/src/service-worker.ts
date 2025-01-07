/// <reference lib="webworker" />

const CACHE_NAME = 'bevpro-cache-v1';
const API_CACHE_NAME = 'bevpro-api-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/media/',
];

const API_ROUTES = [
  '/api/drinks',
  '/api/dashboard/stats',
];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (API_ROUTES.some(route => url.pathname.startsWith(route))) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            // Cache the new response
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => {
            // Return cached response if fetch fails
            return cache.match(request);
          });
      })
    );
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200) {
          return response;
        }

        // Cache successful responses for static assets
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response.clone());
          return response;
        });
      });
    })
  );
});

// Clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

export {};
