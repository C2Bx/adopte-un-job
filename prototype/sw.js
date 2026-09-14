/* Coquille hors ligne minimale. Version a incrementer a chaque deploiement. */
var CACHE = 'aj-v1';
var FICHIERS = ['index.php', 'assets/app.css', 'assets/app.js', 'assets/data.js', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (l) {
    return Promise.all(l.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // reseau d'abord, cache en secours : jamais de page perimee servie en priorite
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copie = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copie); }).catch(function () {});
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});
