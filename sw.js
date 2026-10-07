// sw.js
const CACHE_NAME = 'deepslate-cache-v1'; // Update this version string to force app updates
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/layout.css',
    './css/viewer.css',
    './js/app.js',
    './js/model/schematic.js',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png'
    // We will add renderer.js and isometric.js to this list as we build them.
];

// Install Event - Caches files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event - Cleans old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Cache First, then Network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).catch(() => {
                // Return a fallback if completely offline and asset not found
                return new Response('Offline mode. Asset unavailable.', { status: 503, statusText: 'Service Unavailable' });
            });
        })
    );
});

// Listen for update triggers from the main app
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
