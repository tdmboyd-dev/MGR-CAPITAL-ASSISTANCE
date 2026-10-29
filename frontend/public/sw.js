/** Public offline shell only. Private pages and API responses never enter this cache. */
const CACHE_NAME = 'mgr-capital-public-v2';
const OFFLINE_URL = '/offline.html';
const PUBLIC_ASSETS = new Set([OFFLINE_URL, '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png']);
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...PUBLIC_ASSETS])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('mgr-capital-') && name !== CACHE_NAME).map((name) => caches.delete(name)))),
    // The legacy queue stored credentials without account binding. Never replay it.
    new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('mgr-capital-offline');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close old Capital tabs to remove the legacy offline queue'));
    }),
  ]).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;
  if (PUBLIC_ASSETS.has(url.pathname) && !url.search) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  } else if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
  }
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification('MGR Capital', {
    body: 'Open Capital to check your notifications.', icon: '/icons/icon-192x192.png', data: { url: '/' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
