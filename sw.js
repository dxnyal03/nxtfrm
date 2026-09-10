if (location.hostname === 'localhost') return;

const CACHE_NAME = 'nxtfrm-v100-premium-cache';
const ASSETS = [
  './',
  './index.html',
  './cut-support.js',
  './cut-support.css',
  './premium-ui.js',
  './premium-ui.css',
  './manifest.webmanifest',
  './logo-mark.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => {
      if (key !== CACHE_NAME && /^(nxtfrm-|apexcut-|apex-)/i.test(key)) return caches.delete(key);
    }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && !response.redirected) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(event.request).then(async cached => cached || (event.request.mode === 'navigate' ? await caches.match('./index.html') : null) || new Response('Offline', { status: 503 })))
  );
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
