// Service worker: aset statis cache-first; halaman data selalu dari jaringan.
// Pengecualian: cangkang /belajar dan /kuis (statis, tanpa data pribadi; datanya diambil di klien
// dari IndexedDB) disimpan agar bisa dibuka tanpa internet. Halaman pribadi lain TIDAK di-cache.
const VERSION = "v2";
const STATIC = `static-${VERSION}`;
const SHELL = `shell-${VERSION}`;
const OFFLINE_URL = "/offline";
const SHELL_PATHS = ["/belajar", "/kuis"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC && k !== SHELL).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Hanya respons normal (bukan hasil pengalihan ke /login) yang boleh disimpan sebagai cangkang.
function cacheShell(pathname, res) {
  if (!res.ok || res.redirected) return;
  const copy = res.clone();
  caches.open(SHELL).then((c) => c.put(pathname, copy));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Aset statis berhash: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Pemanasan cangkang dari aplikasi (header x-warm): simpan tanpa menavigasi.
  if (req.headers.get("x-warm") === "1" && SHELL_PATHS.includes(url.pathname)) {
    e.respondWith(
      fetch(req).then((res) => {
        cacheShell(url.pathname, res);
        return res;
      }),
    );
    return;
  }

  // Navigasi: jaringan dulu. Offline -> cangkang yang tersimpan, atau halaman offline.
  if (req.mode === "navigate") {
    const isShell = SHELL_PATHS.includes(url.pathname);
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (isShell) cacheShell(url.pathname, res);
          return res;
        })
        .catch(async () => {
          if (isShell) {
            const hit = await caches.match(url.pathname);
            if (hit) return hit;
          }
          return caches.match(OFFLINE_URL);
        }),
    );
  }
});
