/* LumaBoard v1.8.9 service worker */
const VERSION = "1.8.9";
const STATIC_CACHE = `lumaboard-static-${VERSION}`;
const PAGE_CACHE = `lumaboard-pages-${VERSION}`;
const API_CACHE = `lumaboard-api-${VERSION}`;
const OFFLINE_URL = "/offline";
const CACHE_LIMITS = { [STATIC_CACHE]: 80, [PAGE_CACHE]: 20, [API_CACHE]: 40 };
const CACHE_MAX_BYTES = { static: 8_000_000, page: 2_000_000, api: 4_000_000 };
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
const APP_PAGES = ["/", "/display", "/termos", "/privacidade", "/cookies", OFFLINE_URL];
const ALLOWED_MESSAGE_TYPES = new Set(["SKIP_WAITING", "CLEAR_RUNTIME_CACHES"]);
const ALLOWED_NOTIFICATION_PATHS = new Set(["/", "/display", "/termos", "/privacidade", "/cookies"]);

async function notifyClients(message) {
  const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clientsList.forEach((client) => client.postMessage(message));
}

async function fetchWithTimeout(request, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal, redirect: "error" });
  } finally {
    clearTimeout(timeout);
  }
}

function cacheControlDisallowsStorage(response) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  return cacheControl.includes("no-store") || cacheControl.includes("private");
}

function responseLooksSafe(response, kind) {
  if (!response || !response.ok || response.type !== "basic" || cacheControlDisallowsStorage(response)) return false;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > (CACHE_MAX_BYTES[kind] ?? 2_000_000)) return false;
  if (kind === "api") return contentType.includes("application/json");
  if (kind === "page") return contentType.includes("text/html");
  return /(?:text\/(?:css|javascript)|application\/(?:javascript|json|manifest\+json)|font\/|image\/)/.test(contentType);
}

async function trimCache(cacheName) {
  const limit = CACHE_LIMITS[cacheName] ?? 20;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((request) => cache.delete(request)));
}

async function putSafe(cacheName, request, response, kind) {
  if (!responseLooksSafe(response, kind)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await trimCache(cacheName);
}

async function cachePage(pathname) {
  const request = new Request(pathname, { cache: "reload", credentials: "same-origin", redirect: "error" });
  const response = await fetchWithTimeout(request);
  await putSafe(PAGE_CACHE, request, response, "page");
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await Promise.allSettled(STATIC_ASSETS.map(async (url) => {
      const request = new Request(url, { cache: "reload", credentials: "same-origin", redirect: "error" });
      const response = await fetch(request);
      await putSafe(STATIC_CACHE, request, response, "static");
    }));
    await Promise.allSettled(APP_PAGES.map(cachePage));
    await notifyClients({ type: "CACHE_READY", version: VERSION });
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("lumaboard-") && ![STATIC_CACHE, PAGE_CACHE, API_CACHE].includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function isTrustedMessage(event) {
  if (!event.source || typeof event.source.url !== "string") return false;
  try {
    return new URL(event.source.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (!ALLOWED_MESSAGE_TYPES.has(type)) return;
  event.waitUntil((async () => {
    if (!(await isTrustedMessage(event))) return;
    if (type === "SKIP_WAITING") await self.skipWaiting();
    if (type === "CLEAR_RUNTIME_CACHES") await Promise.all([caches.delete(PAGE_CACHE), caches.delete(API_CACHE)]);
  })());
});

async function networkFirst(request, cacheName, fallback, kind) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetchWithTimeout(request);
    await putSafe(cacheName, request, response, kind);
    if (cacheName === API_CACHE && responseLooksSafe(response, "api")) {
      await notifyClients({ type: "API_CACHE_UPDATED", url: request.url });
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
  const network = fetchWithTimeout(request).then(async (response) => {
    await putSafe(STATIC_CACHE, request, response, "static");
    return response;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/public/")) {
    event.respondWith(networkFirst(request, API_CACHE, null, "api"));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, OFFLINE_URL, "page"));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let targetUrl = new URL("/", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || "/", self.location.origin);
    if (candidate.origin === self.location.origin && ALLOWED_NOTIFICATION_PATHS.has(candidate.pathname)) targetUrl = candidate;
    if (candidate.origin === self.location.origin && candidate.pathname === "/" && candidate.searchParams.get("view") === "agenda") targetUrl = candidate;
  } catch {
    // Keep the safe default.
  }
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      const navigated = await existing.navigate(targetUrl.href);
      return (navigated || existing).focus();
    }
    return self.clients.openWindow(targetUrl.href);
  }));
});
