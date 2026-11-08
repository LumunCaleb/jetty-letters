// Offline support: serve everything from the cache, refresh it in the background.
// Bump CACHE when files are renamed or removed.
const CACHE = 'jetty-letters-v3';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'config.js',
  'pdf.js',
  'app.js',
  'sync.js',
  'manifest.webmanifest',
  'assets/brand/letterhead.jpg',
  'vendor/jspdf.umd.min.js',
  'vendor/jspdf.plugin.autotable.min.js',
  'vendor/firebase-app-compat.js',
  'vendor/firebase-auth-compat.js',
  'vendor/firebase-firestore-compat.js',
  'assets/fonts/NotoSans-Regular.ttf',
  'assets/fonts/NotoSans-Bold.ttf',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const key = req.mode === 'navigate' ? 'index.html' : req;
      const cached = await cache.match(key, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(fresh);
        return cached;
      }
      return (await fresh) || new Response('Offline', { status: 503 });
    })
  );
});
