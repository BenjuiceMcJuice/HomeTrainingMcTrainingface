/**
 * BetaLog — web push client helpers.
 *
 * Talks to the betalog-push Worker, which holds one subscription mirror per
 * token in KV and sends the reminders from a cron trigger.
 *
 * The token is the credential, exactly as it is for the calendar feed: 128 bits
 * of client randomness, revocable from Plan > Schedule, and behind it nothing
 * but routine names, times and a push endpoint.
 *
 * Support detection lives here rather than in the component because it is the
 * one piece of this feature with a real chance of being wrong on a device none
 * of us owns, and a pure function can be tested.
 *
 * @see workers/betalog-push/README.md
 */

var API_BASE = (import.meta.env && import.meta.env.VITE_PUSH_API) ||
  'https://betalog-push.benjuicemcjuice.workers.dev'

/** The VAPID public key. Safe to ship — it is the half that identifies the sender. */
export var VAPID_PUBLIC_KEY = (import.meta.env && import.meta.env.VITE_VAPID_PUBLIC_KEY) || ''

/**
 * What this browser can do, as one of three states.
 *
 * Pure so it can be tested for devices we cannot hold: pass the readings in.
 * @param {{hasServiceWorker: boolean, hasPushManager: boolean, hasNotification: boolean, isIOS: boolean, isStandalone: boolean}} env
 * @returns {'supported' | 'needs-install' | 'unsupported'}
 */
export function pushSupport(env) {
  var e = env || {}
  if (e.hasServiceWorker && e.hasPushManager && e.hasNotification) return 'supported'
  // iOS exposes the Push API only to an installed web app, and has done since
  // 16.4. In a Safari tab the APIs are simply absent — indistinguishable from a
  // browser that will never support them, except that we know installing fixes it.
  if (e.isIOS && !e.isStandalone) return 'needs-install'
  return 'unsupported'
}

/**
 * Whether the push card is worth showing at all.
 *
 * One rule, in one place, because two callers need it: the card itself and the
 * section header above it. A header sitting over nothing is worse than neither.
 * @param {object} env - as returned by detectEnv()
 * @param {boolean} hasVapidKey
 * @returns {boolean}
 */
export function shouldOfferPush(env, hasVapidKey) {
  return !!hasVapidKey && pushSupport(env) !== 'unsupported'
}

/**
 * Read the current browser's capabilities. The impure half of `pushSupport`.
 * @returns {{hasServiceWorker: boolean, hasPushManager: boolean, hasNotification: boolean, isIOS: boolean, isStandalone: boolean}}
 */
export function detectEnv() {
  var nav = typeof navigator !== 'undefined' ? navigator : {}
  var win = typeof window !== 'undefined' ? window : {}
  var ua = nav.userAgent || ''
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away
    (/Macintosh/.test(ua) && typeof nav.maxTouchPoints === 'number' && nav.maxTouchPoints > 1)
  var standalone = false
  try {
    standalone = !!(nav.standalone || (win.matchMedia && win.matchMedia('(display-mode: standalone)').matches))
  } catch { /* matchMedia is absent in some embedded webviews */ }
  return {
    hasServiceWorker: 'serviceWorker' in nav,
    hasPushManager:   'PushManager' in win,
    hasNotification:  'Notification' in win,
    isIOS:            isIOS,
    isStandalone:     standalone,
  }
}

/**
 * A new 128-bit push token as 32 hex characters.
 * @returns {string}
 */
export function newPushToken() {
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
 * Decode a base64url VAPID key into the Uint8Array `pushManager.subscribe` wants.
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function urlBase64ToUint8Array(base64) {
  var padded = String(base64 || '') + '='.repeat((4 - (String(base64 || '').length % 4)) % 4)
  var normal = padded.replace(/-/g, '+').replace(/_/g, '/')
  var raw = atob(normal)
  var out = new Uint8Array(raw.length)
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * A PushSubscription reduced to the shape the Worker sends with.
 *
 * Returns null for anything missing a key, because a subscription without both
 * `p256dh` and `auth` cannot be encrypted to and would fail silently at send.
 * @param {PushSubscription | {toJSON: () => object}} sub
 * @returns {{endpoint: string, expirationTime: number | null, keys: {p256dh: string, auth: string}} | null}
 */
export function serializeSubscription(sub) {
  if (!sub) return null
  var json = typeof sub.toJSON === 'function' ? sub.toJSON() : sub
  var keys = json.keys || {}
  if (!json.endpoint || !keys.p256dh || !keys.auth) return null
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime === undefined ? null : json.expirationTime,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  }
}

/**
 * A cheap fingerprint, stored so an unchanged mirror doesn't re-upload on every
 * schedule save.
 * @param {string} text
 * @returns {string}
 */
export function mirrorHash(text) {
  var h = 5381
  for (var i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16)
}

function subUrl(token) {
  return API_BASE + '/sub/' + token
}

/**
 * Store or replace the subscription mirror.
 * @param {string} token
 * @param {object} body - {subscription, entries}
 * @returns {Promise<void>}
 */
export function publishSubscription(token, body) {
  return fetch(subUrl(token), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function (res) {
    if (!res.ok) throw new Error('Could not save the reminder subscription (' + res.status + ')')
  })
}

/**
 * Delete the mirror server-side. The next cron finds nothing and sends nothing.
 * @param {string} token
 * @returns {Promise<void>}
 */
export function revokeSubscription(token) {
  return fetch(subUrl(token), { method: 'DELETE' }).then(function (res) {
    if (!res.ok && res.status !== 404) throw new Error('Revoke failed (' + res.status + ')')
  })
}
