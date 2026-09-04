/**
 * Shared CORS policy for the BetaLog Workers.
 *
 * Both Workers serve the same app from the same origins, and both had their own
 * copy of the list. They had already drifted into being wrong the same way: the
 * list named `betalog.pages.dev` but not the per-branch preview deploys
 * Cloudflare actually builds, which are `<branch-slug>.betalog.pages.dev`. So a
 * change could never be tested on its own preview URL — the browser's preflight
 * came back without an allow header and the request was blocked before it left.
 *
 * One module, imported by both, so the next fix lands in one place.
 */

/** Exact origins, always allowed. */
export var ALLOWED_ORIGINS = [
  'https://betalog.co.uk',
  'https://www.betalog.co.uk',
  'https://betalog.pages.dev',
  'http://localhost:5173',
]

/**
 * Cloudflare Pages preview deploys: one subdomain per branch.
 *
 * Anchored at both ends, and the label cannot contain a dot, so this matches
 * `claude-whats-next.betalog.pages.dev` while rejecting the two shapes that
 * matter: a lookalike registered elsewhere (`evil-betalog.pages.dev` — no dot
 * before `betalog`) and a suffix attack (`betalog.pages.dev.evil.com`).
 */
var PREVIEW_RE = /^https:\/\/[a-z0-9][a-z0-9-]*\.betalog\.pages\.dev$/

/**
 * Is this origin allowed to call the Workers?
 * @param {string | null} origin - the request's Origin header
 * @returns {boolean}
 */
export function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false
  if (ALLOWED_ORIGINS.indexOf(origin) >= 0) return true
  return PREVIEW_RE.test(origin)
}

/**
 * CORS response headers for a request, echoing the origin when it is allowed.
 *
 * An origin that is not allowed gets the headers without
 * `Access-Control-Allow-Origin`, which is what makes the browser block it.
 * @param {Request} request
 * @param {string} methods - the Access-Control-Allow-Methods value
 * @returns {Record<string, string>}
 */
export function corsHeaders(request, methods) {
  var origin = request.headers.get('Origin') || ''
  var headers = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}
