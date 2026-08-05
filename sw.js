// Twosday service worker.
//
// Two caching rules, both deliberately conservative:
//   - navigations: network first, cache as fallback. A deploy is picked up on
//     the next load; the cached shell only appears when the network fails.
//   - same-origin static assets: stale-while-revalidate, so the app opens
//     instantly offline and refreshes itself in the background.
//
// Firestore, Firebase Auth, and Google Fonts are never touched here. They are
// cross-origin and handled by the Firebase SDK's own offline layer.

const CACHE_VERSION = 'twosday-v8';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/privacy.html',
  '/share.html',
  '/css/style.css',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/js/config.js',
  '/js/utils.js',
  '/js/state.js',
  '/js/calendar-data.js',
  '/js/reconcile.js',
  '/js/calendar-store.js',
  '/js/audit.js',
  '/js/presence.js',
  '/js/demo-data.js',
  '/js/events.js',
  '/js/recurrence.js',
  '/js/modal.js',
  '/js/repeat-modal.js',
  '/js/find-time.js',
  '/js/analytics.js',
  '/js/import.js',
  '/js/conflicts.js',
  '/js/google-calendar.js',
  '/js/search.js',
  '/js/views/day-week.js',
  '/js/views/month.js',
  '/js/views/year.js',
  '/js/notes.js',
  '/js/settings.js',
  '/js/command-palette.js',
  '/js/share.js',
  '/js/share-page.js',
  '/js/pwa.js',
  '/js/mobile.js',
  '/js/app.js',
  '/js/auth.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll is all-or-nothing, so one 404 would abort the whole install.
      // Cache what resolves and let the rest fall back to the network.
      .then(cache => Promise.allSettled(SHELL_ASSETS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== SHELL_CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function isStaticAsset(url) {
  return /\.(?:css|js|png|svg|webmanifest|ico|woff2?)$/.test(url.pathname);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then(hit => hit || caches.match('/')))
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  // Ignore cache-busting query strings when reading/writing the shell cache.
  // Otherwise `/js/app.js?v=...` misses the pre-cached `/js/app.js` offline.
  const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });
  event.respondWith(
    caches.match(cacheKey).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then(cache => cache.put(cacheKey, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
