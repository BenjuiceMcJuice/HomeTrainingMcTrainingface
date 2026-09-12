/**
 * BetaLog — which build am I running?
 *
 * ## Why this exists *(BTL-B14, asked for 2026-09-04)*
 *
 * The service worker serves app assets **cache-first**, so an installed PWA can
 * go on running a bundle that shipped weeks ago and nothing on screen says so.
 * On 4 September that cost an hour: a push signed with a rotated key kept being
 * rejected, and whether the phone had picked up the new bundle at all could only
 * be inferred from the failure. `CACHE_NAME` has been bumped four times since.
 *
 * Three facts, because no one of them answers the question:
 *
 * - **Version** — `package.json`. Only changes when somebody bumps it, so it is
 *   the weakest of the three and is shown last.
 * - **Build** — the commit Cloudflare Pages built from. Changes every deploy,
 *   and is the thing to quote when something looks stale.
 * - **Cache** — the service worker's `CACHE_NAME`, read from the *running*
 *   worker rather than from source. This is the one that actually governs
 *   whether a device is on old code, and reading it live is the difference
 *   between what should be installed and what is.
 */

import pkg from '../../package.json'

/** Injected by `vite.config.js`; null in dev and in tests. */
export var BUILD_SHA = typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : null
export var BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null
export var APP_VERSION = pkg.version

/** Short form of the commit, which is all anyone reads aloud. */
export function shortSha(sha) {
  return sha ? String(sha).slice(0, 7) : null
}

/**
 * The cache name the **running** service worker is using.
 *
 * Asked of the worker itself rather than read from source, because the whole
 * point is to catch a device still serving an old bundle — and a device in that
 * state has the old worker too.
 *
 * @returns {Promise<string|null>} null when there is no worker, or it does not
 *   answer, or caching is unavailable (a private window, an unsupported browser).
 */
export function runningCacheName() {
  if (typeof caches === 'undefined' || !caches.keys) return Promise.resolve(null)
  return caches.keys()
    .then(function (keys) {
      var mine = keys.filter(function (k) { return k.indexOf('betalog') === 0 })
      return mine.length ? mine.sort().reverse()[0] : null
    })
    .catch(function () { return null })
}

/**
 * Everything worth showing, in one line per fact.
 *
 * @param {string|null} cacheName
 * @returns {{label: string, value: string}[]}
 */
export function buildLines(cacheName) {
  var out = []
  out.push({ label: 'Build', value: shortSha(BUILD_SHA) || 'dev' })
  out.push({ label: 'Cache', value: cacheName || 'none' })
  out.push({ label: 'Version', value: APP_VERSION })
  return out
}
