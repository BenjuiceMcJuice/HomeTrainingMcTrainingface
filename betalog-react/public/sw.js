// Bump this on ANY change to this file. The worker precaches the app shell and
// only purges old caches when the name changes, so without a bump an existing
// install keeps the old worker and never receives what was added below.
// v2 -> v3: push and notificationclick handlers (schedule reminders, Route B).
var CACHE_NAME = 'betalog-v3'

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

// ---------------------------------------------------------------------------
// Push reminders (Route B)
//
// The betalog-push Worker sends one message per due schedule entry, already
// shaped as {title, body, tag, url} by notificationFor() in src/lib/pushSchedule.js.
// Nothing is decided here: this worker renders what it is given, so the copy and
// the deep link stay in one tested place.
// ---------------------------------------------------------------------------

self.addEventListener('push', function (e) {
  var payload = {}
  try {
    payload = e.data ? e.data.json() : {}
  } catch {
    // A push with no body or a non-JSON body still deserves a notification —
    // iOS in particular will show its own generic one if we do not, and a
    // BetaLog-branded fallback beats "This website has been updated".
    payload = {}
  }

  var title = payload.title || 'BetaLog'
  var options = {
    body: payload.body || 'Time to train',
    // Own icon rather than the manifest default: notification icons are raster
    // on most platforms, and this gives one place to swap in a PNG if the SVG
    // does not render on a device.
    icon: '/icon.svg',
    badge: '/icon.svg',
    // Collapses a repeat of the same reminder onto the existing notification
    // instead of stacking a second copy.
    tag: payload.tag || 'betalog-reminder',
    renotify: false,
    data: { url: payload.url || '/log', entryId: payload.entryId || null },
  }

  // waitUntil keeps the worker alive until the notification is actually shown.
  // Without it the browser may kill us first and the push is silently lost.
  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (e) {
  e.notification.close()
  var target = (e.notification.data && e.notification.data.url) || '/log'

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      // Prefer focusing a window that is already open — opening a second one
      // would leave the user with two copies of an installed app.
      for (var i = 0; i < list.length; i++) {
        var client = list[i]
        if ('focus' in client) {
          if ('navigate' in client) {
            return client.navigate(target).then(function (c) { return c ? c.focus() : client.focus() })
              .catch(function () { return client.focus() })
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    })
  )
})
