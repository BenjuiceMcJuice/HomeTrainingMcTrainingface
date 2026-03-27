var CACHE_NAME = 'betalog-v1'

// Cache app shell on install
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/icon.svg',
        '/favicon.svg',
      ])
    })
  )
  self.skipWaiting()
})

// Clean old caches on activate
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME })
            .map(function (k) { return caches.delete(k) })
      )
    })
  )
  self.clients.claim()
})

// Network-first for API calls, cache-first for app assets
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url)

  // Never cache API calls or external resources
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetched = fetch(e.request).then(function (response) {
        // Cache successful responses
        if (response.ok) {
          var clone = response.clone()
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone)
          })
        }
        return response
      }).catch(function () {
        // Network failed, return cached version
        return cached
      })
      // Return cached immediately if available, but still update in background
      return cached || fetched
    })
  )
})
