/**
 * BetaLog — calendar feed client
 *
 * Talks to the betalog-calendar Worker, which stores one .ics per token in KV and
 * serves it to whatever calendar app subscribed.
 *
 * The token IS the credential — for reading and for writing. Anyone holding it can
 * read your routine names or overwrite the feed, so it is 128 bits of randomness,
 * never logged, and revocable from Plan > Schedule. That symmetry is deliberate: the
 * alternative is authenticating a Worker against Firebase for what is, in the end,
 * a list of routine names and times.
 *
 * @see workers/betalog-calendar/README.md
 */

var API_BASE = (import.meta.env && import.meta.env.VITE_CALENDAR_API) ||
  'https://betalog-calendar.benjuicemcjuice.workers.dev'

/**
 * A new 128-bit feed token as 32 hex characters.
 * @returns {string}
 */
export function newFeedToken() {
  var bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.prototype.map
    .call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2) })
    .join('')
}

/**
 * The https URL of a feed — what the Worker serves.
 * @param {string} token
 * @returns {string}
 */
export function feedUrl(token) {
  return API_BASE + '/cal/' + token + '.ics'
}

/**
 * The webcal:// form. Tapping this on iOS/macOS opens Calendar's subscribe flow
 * directly instead of downloading a file.
 * @param {string} token
 * @returns {string}
 */
export function webcalUrl(token) {
  return feedUrl(token).replace(/^https?:/, 'webcal:')
}

/**
 * A cheap fingerprint of the feed body, stored so an unchanged schedule doesn't
 * re-upload on every save.
 * @param {string} text
 * @returns {string}
 */
export function feedHash(text) {
  var h = 5381
  for (var i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16)
}

/**
 * Upload the feed. Resolves on success, rejects with an Error otherwise.
 * @param {string} token
 * @param {string} icsText
 * @returns {Promise<void>}
 */
export function publishFeed(token, icsText) {
  return fetch(feedUrl(token), {
    method: 'PUT',
    headers: { 'Content-Type': 'text/calendar' },
    body: icsText,
  }).then(function (res) {
    if (!res.ok) throw new Error('Feed upload failed (' + res.status + ')')
  })
}

/**
 * Delete the feed server-side. Any calendar still subscribed starts 404ing.
 * @param {string} token
 * @returns {Promise<void>}
 */
export function revokeFeed(token) {
  return fetch(feedUrl(token), { method: 'DELETE' }).then(function (res) {
    // 404 means it's already gone, which is the outcome we wanted
    if (!res.ok && res.status !== 404) throw new Error('Revoke failed (' + res.status + ')')
  })
}
