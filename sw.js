const RELEASE = '162';
const CACHE_NAME = 'nxtfrm-v162-premium-cache';

// The offline shell. Versioned URLs match exactly what index.html requests, so
// a cold start offline serves the same files the page asks for rather than an
// unversioned near-miss. Retired with the V98 layer: no legacy UI assets remain.
//
// Not listed: the thirteen wearable modules. The page stopped loading them in the Ascension
// performance pass: D55 switched the feature off and no provider sync ever shipped, so
// precaching about 350 KB of them cost every install time and storage for nothing. The files
// and their suites stay in the repository.
const VERSIONED = [
  'cut-support.js',
  'coach.js',
  'cut-support.css',
  'train-anatomy.js',
  'premium-ui.js',
  'premium-ui.css',
  'vnext.css',
  'strata.css',
  'strata.js',
  'seed.dev.js',
  'seed.scenarios.js'
];
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo-mark.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './fonts/geist-latin-wght.woff2'
].concat(VERSIONED.map(function (f) { return './' + f + '?v=' + RELEASE; }));

// ---- Fetch strategy ----------------------------------------------------------------------------
// Network-first, with the cache as the offline fallback: navigations (so a new release is picked
// up as soon as the app opens online), ./index.html, the manifest, and any unversioned file.
//
// Stale-while-revalidate for this release's own files (?v=<RELEASE>: every script and stylesheet
// index.html requests) and for the font and icons listed in ASSETS (see isShellFile below):
//   - A cached copy answers at once, so a launch never waits on the network for them and an
//     offline launch still opens the shell. Instant launch.
//   - In the same event a background fetch (a conditional request, so an unchanged file costs a
//     304) replaces the cache entry when the response is ok, not redirected and not the same ETag.
//     The NEXT launch runs the new bytes. A failed, non-ok or redirected fetch leaves the entry
//     exactly as it was.
//   - A miss fetches and stores, like any other file. An offline miss answers 503 "Offline".
//
// Why that is safe:
//   - A real release still switches atomically. RELEASE moves the ?v= on every tag in index.html,
//     CACHE_NAME and the list above together (wearables.release-gate.test.js pins the cache name,
//     and wearables.sw-strategy.test.js pins that every ?v= in index.html equals RELEASE). The
//     changed sw.js installs a new worker that precaches the new URLs into a NEW cache, read from
//     the network and never from the HTTP cache, and deletes this one on activation. The old and
//     the new generation are never mixed.
//   - Only this release's own version qualifies (v === RELEASE). A page or tab running another
//     build asks the network, so a worker never answers with, or stores, the wrong generation.
// The caveat: a deploy WITHOUT a bump (a trial preview that keeps receiving pushes) is picked up
// one launch late. For that one launch a fresh index.html can run against the previous scripts,
// and files update one by one, so an interrupted revalidation can leave a mixed set until the
// next launch. A bump removes both effects, so bump whenever index.html and the scripts have to
// change together.
const NOT_STATIC = ['./', './index.html', './manifest.webmanifest'];
let staticPaths = null;
function isShellFile(request, url) {
  if (request.mode === 'navigate') return false;
  if (url.searchParams.get('v') === RELEASE) return true;
  if (!staticPaths) {
    staticPaths = new Set(ASSETS
      .filter(function (a) { return NOT_STATIC.indexOf(a) === -1 && a.indexOf('?') === -1; })
      .map(function (a) { return new URL(a, self.registration.scope).pathname; }));
  }
  return staticPaths.has(url.pathname);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' reads from the network, not the HTTP cache. These entries answer requests
      // before any network check, so they must be exactly what the server holds.
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => {
      // Only this app's own shell caches. Never touches the page's own storage,
      // where workouts, history and settings live.
      if (key !== CACHE_NAME && /^(nxtfrm-|apexcut-|apex-)/i.test(key)) return caches.delete(key);
    }))).then(() => self.clients.claim())
  );
});

// Keeps the worker alive until a background write finishes. It must never change the answer, so a
// refusal to extend the event's lifetime is swallowed.
function keepAlive(event, promise) {
  try { event.waitUntil(promise); } catch (e) { /* the answer is already on its way */ }
}

// Network first, cached copy when the network fails. A stale-while-revalidate miss lands here too,
// so the response is stored for next time.
function networkFirst(event) {
  return fetch(event.request).then(response => {
    if (response.ok && !response.redirected) {
      const copy = response.clone();
      keepAlive(event, caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {}));
    }
    return response;
  }).catch(() => caches.match(event.request).then(async cached => cached || (event.request.mode === 'navigate' ? await caches.match('./index.html') : null) || new Response('Offline', { status: 503 })));
}

// The background half of stale-while-revalidate. A conditional request (cache: 'no-cache'), so an
// unchanged file costs a 304 and a long max-age cannot hide a change. The entry is replaced only by
// an ok, non-redirected response with a different ETag; a rejected fetch or any other answer leaves
// the cache exactly as it was.
function revalidate(event, cache, cached) {
  return fetch(new Request(event.request, { cache: 'no-cache' })).then(response => {
    if (!response.ok || response.redirected) return;
    const etag = response.headers.get('etag');
    if (etag && etag === cached.headers.get('etag')) return;
    return cache.put(event.request, response);
  }).catch(() => {});
}

// Answer from this release's cache at once and refresh the entry for the next launch.
function staleWhileRevalidate(event) {
  return caches.open(CACHE_NAME)
    .then(cache => cache.match(event.request, { ignoreVary: true }).then(hit => {
      if (!hit) return networkFirst(event);
      keepAlive(event, revalidate(event, cache, hit));
      return hit;
    }))
    .catch(() => networkFirst(event));
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(isShellFile(event.request, url) ? staleWhileRevalidate(event) : networkFirst(event));
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: 'NXTFRM', body: event.data ? event.data.text() : 'Reminder' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'NXTFRM', {
      body: data.body || 'Reminder',
      tag: data.tag || 'nxtfrm',
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: data.url || './index.html'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
