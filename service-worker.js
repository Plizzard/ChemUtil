/* ============================================================
   service-worker.js — offline-first
   • App shell is precached on install.
   • RDKit MinimalLib (JS + WASM) is cached on first fetch, so the
     viewer works fully offline from the second launch onward.
   • PubChem is never cached — it stays a live, opt-in network call.
   Bump CACHE on any release to invalidate old assets.
   ============================================================ */
const CACHE = "smiles-bench-v1";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/rdkit.js",
  "./js/structure.js",
  "./js/dilution.js",
  "./js/nmr.js",
  "./js/app.js",
  "./vendor/RDKit_minimal.js",
  "./vendor/RDKit_minimal.wasm",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

// Hosts whose responses we cache opportunistically (the RDKit CDN).
const RUNTIME_CACHE_HOSTS = ["unpkg.com", "cdn.jsdelivr.net"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache PubChem — opt-in live data only.
  if (url.hostname.endsWith("ncbi.nlm.nih.gov")) {
    return; // default to network
  }

  // RDKit CDN: cache-first, populate on first online load.
  if (RUNTIME_CACHE_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => hit)
      )
    );
    return;
  }

  // Same-origin app shell: cache-first, fall back to network, then to index for navigations.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }).catch(() => {
          if (req.mode === "navigate") return caches.match("./index.html");
        })
      )
    );
  }
});
