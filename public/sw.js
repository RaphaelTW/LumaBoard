/* LumaBoard v1.6.0 service worker */
const VERSION = "1.6.0";
const STATIC_CACHE = `lumaboard-static-${VERSION}`;
const PAGE_CACHE = `lumaboard-pages-${VERSION}`;
const API_CACHE = `lumaboard-api-${VERSION}`;
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-72.png",
  "/icons/icon-96.png",
  "/icons/icon-128.png",
  "/icons/icon-144.png",
  "/icons/icon-152.png",
  "/icons/icon-192.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];
const APP_PAGES = ["/", "/display", OFFLINE_URL];

async function notifyClients(message) {
  const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clientsList.forEach((client) => client.postMessage(message));
}

async function fetchWithTimeout(request, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function cachePageWithAssets(pathname) {
  const request = new Request(pathname, { cache: "reload" });
  const response = await fetch(request);
  if (!response.ok) return;
  const pageCache = await caches.open(PAGE_CACHE);
  await pageCache.put(request, response.clone());

  const html = await response.text();
  const assetUrls = Array.from(html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g), (match) => match[1]);
  if (assetUrls.length === 0) return;
  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(Array.from(new Set(assetUrls)).map((url) => staticCache.add(new Request(url, { cache: "reload" }))));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(STATIC_ASSETS.map((url) => staticCache.add(new Request(url, { cache: "reload" }))));
    await Promise.allSettled(APP_PAGES.map(cachePageWithAssets));
    await notifyClients({ type: "CACHE_READY", version: VERSION });
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("lumaboard-") && ![STATIC_CACHE, PAGE_CACHE, API_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_RUNTIME_CACHES") {
    event.waitUntil(Promise.all([caches.delete(PAGE_CACHE), caches.delete(API_CACHE)]));
  }
});

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchWithTimeout(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (cacheName === API_CACHE) await notifyClients({ type: "API_CACHE_UPDATED", url: request.url });
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    if (fallback) return (await caches.match(fallback)) || Response.error();
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/public/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, OFFLINE_URL));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
