const CACHE_NAME = "mgr-capital-v1";
const STATIC_ASSETS = [
  "/",
  "/auth/login",
  "/offline.html",
  "/manifest.json",
];

const API_CACHE_NAME = "mgr-capital-api-v1";
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response for caching
          const responseClone = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - cache first, network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        event.waitUntil(
          fetch(request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          })
        );
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (request.mode === "navigate") {
            return caches.match("/offline.html");
          }
          return new Response("Offline", { status: 503 });
        });
    })
  );
});

// Background sync for offline form submissions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending") {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  const db = await openDB();
  const pending = await db.getAll("pending-requests");

  for (const item of pending) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      await db.delete("pending-requests", item.id);
    } catch (error) {
      console.error("[SW] Sync failed:", error);
    }
  }
}

// Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || "New notification from MGR Capital",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
    },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "MGR Capital", options)
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      const url = event.notification.data?.url || "/";

      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

console.log("[SW] Service Worker loaded");
