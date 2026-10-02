// تولید sw.js با فهرست کامل فایل‌های خروجی → برنامه وب هم کاملاً آفلاین می‌شود
// بعد از هر build اجرا می‌شود: node scripts/gen-sw.js (فایل را در out/ می‌نویسد)
import { readdirSync, statSync, writeFileSync, readFileSync } from "fs";
import { join, relative } from "path";

const OUT = join(process.cwd(), "out");
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else files.push("/" + relative(OUT, full).split("\\").join("/"));
  }
}
walk(OUT);

const ASSETS = files.filter((f) => !f.endsWith("/sw.js") && !f.endsWith(".map"));

const sw = `// Service Worker حساب‌یار v4 — پشتیبانی آفلاین کامل
const CACHE_NAME = "hesab-yar-v4";
const ASSETS = ${JSON.stringify(ASSETS, null, 2)};

self.addEventListener("install", (event) => {
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // ناوبری: اول شبکه، در نبود اینترنت از کش
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((c) => c || Response.error()))
    );
    return;
  }

  // بقیه فایل‌ها: اول کش (برنامه کاملاً استاتیک است)
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
`;

writeFileSync(join(OUT, "sw.js"), sw);
console.log(`sw.js generated with ${ASSETS.length} precached files`);
