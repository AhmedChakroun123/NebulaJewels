const CACHE_NAME = 'nebula-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'game.js',
  'ui.js',
  'levels.js',
  'particles.js',
  'audio.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
