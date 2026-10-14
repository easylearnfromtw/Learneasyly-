/* Learn Angle offline shell v7: network first for the app and data, cache first for pinned OCR and math files from the CDN. */
const CACHE = "learneasyly-shell-v18";
const CDN_CACHE = "learneasyly-cdn-v1";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./fx.js", "./glass.js", "./cube.js", "./icon.svg", "./icon-maskable.svg", "./brand/pinned-tab.svg", "./assets/favicon.ico", "./assets/icon-32.png", "./assets/icon-48.png", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/icon-maskable-192.png", "./assets/icon-maskable-512.png", "./assets/apple-touch-icon.png", "./assets/og-image.jpg", "./assets/social-square.jpg", "./sitemap.xml", "./manifest.webmanifest", "./privacy.html", "./data/exams.json"];
const CDN_FILES = /^\/(npm\/(tesseract\.js(-core)?@|katex@)|gh\/tesseract-ocr\/tessdata_fast@)/;
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith("learneasyly-shell-")).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  /* 版本固定的辨識程式與語言模型 下載一次之後離線也能用 */
  if (url.hostname === "cdn.jsdelivr.net" && CDN_FILES.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      if (response.ok && (response.type === "cors" || response.type === "basic")) cache.put(event.request, response.clone()).catch(() => {});
      return response;
    })());
    return;
  }
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {}));
      }
      return response;
    } catch (err) {
      const cached = await caches.match(event.request, { ignoreSearch: event.request.mode === "navigate" });
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});