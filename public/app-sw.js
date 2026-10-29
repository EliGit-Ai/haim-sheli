// Service worker של האפליקציה: שומר את המעטפת (דף, גופנים, אייקונים) כדי שהאפליקציה תיפתח גם בלי רשת.
// התוכן עצמו נשמר על ידי האפליקציה בזיכרון המקומי של המכשיר. התשובות לא עוברות כאן בכלל.

const SHELL = "haim-sheli-shell-v1";
const FILES = [
  "/app",
  "/app/manifest.webmanifest",
  "/app/icon-192.png",
  "/app/icon-512.png",
  "/app/apple-touch-icon.png",
  "/app/fonts/frank-ruhl-libre-hebrew-700-normal.woff2",
  "/app/fonts/frank-ruhl-libre-hebrew-900-normal.woff2",
  "/app/fonts/frank-ruhl-libre-latin-700-normal.woff2",
  "/app/fonts/assistant-hebrew-400-normal.woff2",
  "/app/fonts/assistant-hebrew-700-normal.woff2",
  "/app/fonts/assistant-latin-400-normal.woff2",
  "/app/fonts/assistant-latin-700-normal.woff2",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // the content request carries the access code: never cache it here
  if (url.pathname.startsWith("/api/")) return;
  if (!url.pathname.startsWith("/app")) return;

  // the page itself: network first so updates arrive, cache when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put("/app", copy));
          return res;
        })
        .catch(() => caches.match("/app"))
    );
    return;
  }

  // fonts and icons: cache first
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
