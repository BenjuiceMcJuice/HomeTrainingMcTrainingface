// ---------------------------------------------------------------------------
// googleSignIn.js — how Google sign-in is done on this device. Pure; no
// Firebase imports, so firebase.js and the tests can both use it.
//
// The installed iPhone app (Add to Home Screen) has storage of its own,
// separate from Safari's, and Firebase's popup cannot come back to it. Until
// 2026-10-02 the sign-in screen refused Google there and told the climber to
// sign in in Safari — which never carried over, because the storage is not
// shared. The fix is Firebase's documented one for browsers that partition
// storage: serve the auth handler from the app's own origin
// (functions/__/auth/[[path]].js proxies /__/auth/* to firebaseapp.com), make
// that origin the authDomain, and use the redirect flow in the installed app.
// The handler's state is then first-party and survives the trip to Google.
//
// The proxied origin only works once Google knows about it: each host in
// PROXIED_AUTH_HOSTS needs https://<host>/__/auth/handler as an authorised
// redirect URI on the OAuth client (Google Cloud console), and the host in
// Firebase › Authentication › Authorised domains. Any other host keeps the
// firebaseapp.com domain and the popup, as before.
// ---------------------------------------------------------------------------

/** Firebase's own auth domain — the fallback, and the proxy's upstream. */
export var FIREBASE_AUTH_DOMAIN = 'betalog-340b3.firebaseapp.com'

/**
 * Hosts that serve /__/auth/* themselves and are registered with Google.
 * The pages.dev entry is this change's preview branch, so the installed app
 * can be tried there before release.
 */
export var PROXIED_AUTH_HOSTS = ['betalog.co.uk', 'claude-pwa-google-signin.betalog.pages.dev']

/**
 * The authDomain to give Firebase on this host.
 * @param {string} hostname - window.location.hostname
 * @returns {string}
 */
export function authDomainFor(hostname) {
  var host = String(hostname || '').toLowerCase()
  return PROXIED_AUTH_HOSTS.indexOf(host) !== -1 ? host : FIREBASE_AUTH_DOMAIN
}

/**
 * Whether the app is running installed (home screen / standalone window).
 * @param {Window} [win]
 * @returns {boolean}
 */
export function isStandalone(win) {
  if (!win) return false
  if (win.navigator && win.navigator.standalone === true) return true
  return !!(win.matchMedia && win.matchMedia('(display-mode: standalone)').matches)
}

/**
 * How to sign in with Google here: the redirect flow in the installed app,
 * when this host serves its own auth handler; the popup everywhere else.
 * 'blocked' is the installed app on a host without the proxy, where neither
 * flow can come back.
 *
 * @param {boolean} standalone
 * @param {string} hostname
 * @returns {'popup' | 'redirect' | 'blocked'}
 */
export function googleFlow(standalone, hostname) {
  if (!standalone) return 'popup'
  return authDomainFor(hostname) === FIREBASE_AUTH_DOMAIN ? 'blocked' : 'redirect'
}

// The redirect leaves the page, so the screen it returns to needs telling that
// a sign-in is under way. Calling getRedirectResult only then keeps the
// redirect machinery off every other page load (see firebase.js).
export var REDIRECT_KEY = 'betalogGoogleRedirect'
/** A redirect older than this is abandoned, not finished. */
export var REDIRECT_TTL_MS = 10 * 60 * 1000

/**
 * Note that a redirect is starting.
 * @param {Storage} storage
 * @param {number} now - ms
 */
export function markRedirect(storage, now) {
  try { storage.setItem(REDIRECT_KEY, String(now)) } catch { /* private mode: the result is still read below */ }
}

/**
 * Forget a redirect that never left (signInWithRedirect failed).
 * @param {Storage} storage
 */
export function clearRedirect(storage) {
  try { storage.removeItem(REDIRECT_KEY) } catch { /* nothing to clear */ }
}

/**
 * Whether this page load is the return from a redirect we started. Clears the
 * note either way, so a reload does not try again.
 * @param {Storage} storage
 * @param {number} now - ms
 * @returns {boolean}
 */
export function takeRedirect(storage, now) {
  var raw = null
  try {
    raw = storage.getItem(REDIRECT_KEY)
    storage.removeItem(REDIRECT_KEY)
  } catch { return false }
  var at = Number(raw)
  if (!raw || !isFinite(at)) return false
  return now - at >= 0 && now - at < REDIRECT_TTL_MS
}

/**
 * A Google sign-in failure in plain words, or null when there is nothing to
 * say (the climber backed out).
 * @param {{ code?: string, message?: string }} err
 * @returns {string | null}
 */
export function googleErrorMessage(err) {
  var code = (err && err.code) || ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ||
      code === 'auth/redirect-cancelled-by-user') return null
  if (code === 'auth/network-request-failed') return 'No connection — try again when you have signal'
  if (code === 'auth/account-exists-with-different-credential') {
    return 'That email already has a BetaLog account with a password. Use email login below.'
  }
  if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not set up for this address yet. Use email login below.'
  }
  if (code === 'auth/web-storage-unsupported') {
    return 'Google sign-in needs website data turned on. Use email login below.'
  }
  return (err && err.message) || 'Google sign-in failed. Try again, or use email login below.'
}

/** Said when a redirect comes back with no sign-in — iOS lost the state. */
export var REDIRECT_LOST_MESSAGE =
  "Google sign-in didn't finish. Try again, or use email login below."

/** Said in the installed app on a host without the proxy. */
export var BLOCKED_MESSAGE =
  "Google sign-in can't open in the installed app on this address. Use email login below, or open betalog.co.uk."
