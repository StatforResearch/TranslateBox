// Retire the old cache-first worker: it could pin outdated HTML indefinitely.
// Network-only navigation also prevents caching operator pages or credentials.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('translatebox-live-')).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
