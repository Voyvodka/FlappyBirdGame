const CACHE_NAME = "ultra-flappy-v2";
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/favicon.ico", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => {
            void cache.put("/", copy);
          });
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          if (cached) {
            return cached;
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const contentType = response.headers.get("content-type") ?? "";
          const shouldCache =
            contentType.includes("javascript") ||
            contentType.includes("text/css") ||
            contentType.includes("image/") ||
            contentType.includes("font/") ||
            url.pathname.endsWith(".json") ||
            url.pathname.includes("/assets/");

          if (!shouldCache) {
            return response;
          }

          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => {
            void cache.put(event.request, copy);
          });
          return response;
        })
        .catch(async () => {
          const fallback = await caches.match(event.request);
          if (fallback) {
            return fallback;
          }
          return new Response("", { status: 504, statusText: "Gateway Timeout" });
        });
    })
  );
});
