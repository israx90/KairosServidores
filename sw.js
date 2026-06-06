const CACHE_NAME = 'krs-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index2.html',
    './css/style.css',
    './logo/logo.png',
    './assets/default-avatar.svg',
    // Third party
    'https://unpkg.com/@phosphor-icons/web',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js'
];

self.addEventListener('install', (event) => {
    // Force immediate takeover
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Cache First Strategy for assets, Network First for APIs
self.addEventListener('fetch', (event) => {
    const isApiCall = event.request.url.includes('/api/');
    
    if (isApiCall) {
        // Bypass Service Worker completely for API calls
        return;
    } else {
        // Cache First, fallback to network
        event.respondWith(
            caches.match(event.request)
            .then((response) => {
                if (response) return response;
                // Fetch and cache newly discovered assets dynamically (Stale-While-Revalidate pattern manually)
                return fetch(event.request).then(
                    (networkResponse) => {
                        // Don't cache if not a valid response
                        if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // Only cache GET requests
                                if(event.request.method === 'GET') {
                                    cache.put(event.request, responseToCache);
                                }
                            });
                        return networkResponse;
                    }
                );
            })
        );
    }
});

// Web Push Notifications Handling
self.addEventListener('push', function(event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const options = {
                body: data.body,
                icon: data.icon || './logo/logo.png',
                data: data.data || {},
                actions: data.actions || []
            };
            event.waitUntil(self.registration.showNotification(data.title, options));
        } catch(e) {
            console.error("Error parsing push data", e);
        }
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'confirm-wa' && event.notification.data && event.notification.data.url) {
        event.waitUntil(clients.openWindow(event.notification.data.url));
    } else {
        event.waitUntil(clients.openWindow('/'));
    }
});
