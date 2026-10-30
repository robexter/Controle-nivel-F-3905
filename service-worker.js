/* Incrementar CACHE_VERSION sempre que publicar uma alteração. */
const CACHE_VERSION = 'f3905-concept-v3.4-20261029';
const CORE = ['./', './index.html', './manifest.webmanifest', './assets/diagrama-f3905-original.png', './assets/dinamica.css', './assets/dinamica.js', './assets/navegacao.css', './assets/navegacao.js', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(fetch(req).then(response => {
      if (response.ok) { const copy=response.clone(); caches.open(CACHE_VERSION).then(cache=>cache.put(req,copy)); }
      return response;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html'))));
  } else {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response=>{
      if (response.ok){const copy=response.clone();caches.open(CACHE_VERSION).then(cache=>cache.put(req,copy));}
      return response;
    })));
  }
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
