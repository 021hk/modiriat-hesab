// Service Worker برای حساب‌یار - پشتیبانی آفلاین
const CACHE_NAME = "hesab-yar-v6";
const ASSETS = [
  "/fonts/Vazirmatn-Regular.woff2",
  "/fonts/Vazirmatn-Medium.woff2",
  "/fonts/Vazirmatn-Bold.woff2",
  "/fonts/Vazirmatn-Light.woff2",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  // نصب مقاوم: اگر یکی از فایل‌ها پیدا نشد، کل نصب شکست نمی‌خورد
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ASSETS.map((a) => cache.add(a).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// استراتژی: شبکه اول، کش فقط برای فونت و آیکون‌ها
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  // API ها همیشه از شبکه
  if (url.pathname.startsWith("/api/")) return;

  const isStatic = url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icon");

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return res;
          })
        );
      })
    );
  }
});
