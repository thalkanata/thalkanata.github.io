self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.open('v1').then(function(cache) {
      return cache.match(event.request).then(function(response) {
        return response || fetch(event.request).then(function(res) {
          if (event.request.method === 'GET' && res.ok) {
            cache.put(event.request, res.clone());
          }
          return res;
        });
      });
    })
  );
});
