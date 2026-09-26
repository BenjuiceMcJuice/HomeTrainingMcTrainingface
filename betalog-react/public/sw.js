// Bump this on ANY change to this file. The worker precaches the app shell and
// only purges old caches when the name changes, so without a bump an existing
// install keeps the old worker and never receives what was added below.
// v2 -> v3: push and notificationclick handlers (schedule reminders, Route B).
// v3 -> v4: notificationclick no longer uses client.navigate(). Bumped rather
// than edited in place so installed apps drop the v3 asset cache — a stale
// bundle is what made the first live push fail against a rotated VAPID key.
// v4 -> v5: several reminder times per routine. The service worker itself is
// unchanged; the bump is to drop the v4 asset cache so installed apps actually
// run the new bundle rather than serving the old one cache-first.
// v5 -> v6: "Currently" becomes the base grade. Again no change to this file --
// index.html is precached above, so an installed app would go on serving the
// old hashed bundle and show the old reading indefinitely.
// v6 -> v7: Plan opens on Goals. Same reason again -- without the bump an
// installed app keeps the old bundle and still opens on Schedule.
// v7 -> v8: cardio goals normalise their unit. An installed app on the old
// bundle goes on reading a 1500 m swim as 1500 km.
// v8 -> v9: cardio duration is optional and calories can come from distance.
// v9 -> v10: phase 3 puts a projected date on grade goals.
// v10 -> v11: gym sessions score by content, Settings gains the build readout
// and a Climbs CSV export.
// v11 -> v12: grade goals drop the percentage bar.
// v38 -> v39: the page reloads once when a new worker takes over, and checks for
// one when the app returns to the foreground (src/main.jsx). Bumped so the
// installed apps still on v38 receive the bundle that does the reloading.
// v39 -> v40: an achieved goal keeps its slot as a Complete! card; the Achieved
// list under Plan > Goals is gone.
// v40 -> v41: an Own goal's target rate is a blend — the base rate halved, worth
// two sends, plus the real sends since the first — so a send never pushes the
// date out (BTL-B49).
// v41 -> v42: the logger's venue chips come from the whole session log, so a
// wall climbed at before location existed is a tap; the most recent venues are
// offered when none is within 300 m; the pin says what it found.
// v42 -> v43: the guide, /help.html — every screen in plain words, linked from the
// explainer; the explainer links back. A HELP chip in the header opens a sheet with the
// guide and the feedback widget.
// v43 -> v44: the History climb summary carries the grade per outcome — "9 Flash
// to V3 · 1 Att at V4" — instead of a "Top" that read a lone attempt as a send.
// v44 -> v45: Settings › Account › Delete account… (BTL-B32), and the guide's
// Your data chapter says how it works.
// v45 -> v46: a reminder tap opens its routine — the open app is sent the link
// by message, a cold start reads /log?routine= (BTL-B64). Plus B63, B65, B66.
// v46 -> v47: /privacy.html, linked from Settings, the guide and the sign-in
// screen (BTL-B26).
var CACHE_NAME = 'betalog-v47'

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
      // Focus an open window if there is one, otherwise open a new one.
      // client.navigate() is deliberately not used: on an installed iOS web app
      // it can reject, and the old fallback chain then swallowed the failure, so
      // tapping a notification did nothing at all. Instead the open app is told
      // where to go by message and routes itself (App.jsx, BTL-B64).
      for (var i = 0; i < list.length; i++) {
        var client = list[i]
        if ('focus' in client) {
          client.postMessage({ type: 'betalog-open', url: target })
          return client.focus()
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined
    })
  )
})
