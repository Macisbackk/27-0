/* 27-0 service worker: installable app + offline play.
 * - Hashed Next.js assets, icons and fonts: cache first (their names change on every deploy).
 * - Pages: network first, so a new deploy shows straight away; the cached copy is used offline.
 * - Anything else (Supabase, analytics, other sites): not touched.
 */
const VERSION = "v1";
const STATIC_CACHE = `27-0-static-${VERSION}`;
const PAGE_CACHE = `27-0-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("27-0-") && k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimPages() {
  const cache = await caches.open(PAGE_CACHE);
  const keys = await cache.keys();
  for (const req of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(req);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|ttf|otf)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && res.type === "basic") {
            const cache = await caches.open(PAGE_CACHE);
            await cache.put(req, res.clone());
            trimPages();
          }
          return res;
        } catch {
          const cache = await caches.open(PAGE_CACHE);
          return (
            (await cache.match(req, { ignoreSearch: true })) ||
            (await cache.match("/", { ignoreSearch: true })) ||
            (await caches.match(OFFLINE_URL))
          );
        }
      })()
    );
  }
});
