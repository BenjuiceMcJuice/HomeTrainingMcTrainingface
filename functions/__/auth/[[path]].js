/**
 * Firebase's auth handler, served from betalog.co.uk — /__/auth/*
 *
 * Google sign-in runs through a small page Firebase hosts at
 * <project>.firebaseapp.com/__/auth/handler. On a browser that keeps each
 * site's storage apart — the installed iPhone app above all — that page's
 * storage is third-party to the app, the sign-in state is lost on the way
 * back, and the installed app could not sign in with Google at all. Firebase's
 * documented fix ("Option 3: proxy auth requests to firebaseapp.com") is to
 * serve the handler from the app's own origin and make that origin the
 * authDomain (src/lib/googleSignIn.js). This Pages Function is the proxy: every
 * request under /__/auth/ goes to firebaseapp.com unchanged and the answer
 * comes back unchanged, redirects included, so the browser sees one origin.
 *
 * Only /__/auth/* runs it. It needs, once, in the Google Cloud console, the
 * redirect URI https://betalog.co.uk/__/auth/handler on the web OAuth client.
 */

export var UPSTREAM = 'https://betalog-340b3.firebaseapp.com'

// Cloudflare's own request headers, and Host, which must be firebaseapp.com's.
var DROP = ['host', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'cf-worker', 'x-forwarded-proto', 'x-real-ip']

/**
 * Forward one request to firebaseapp.com and hand back its answer.
 * @param {Request} request
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<Response>}
 */
export async function proxy(request, fetchImpl) {
  var url = new URL(request.url)
  var headers = new Headers(request.headers)
  DROP.forEach(function (h) { headers.delete(h) })

  var init = { method: request.method, headers: headers, redirect: 'manual' }
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer()

  var res
  try {
    res = await fetchImpl(UPSTREAM + url.pathname + url.search, init)
  } catch {
    return new Response('Sign-in is unreachable just now. Try again in a moment.', {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  var out = new Response(res.body, res)
  // A redirect from the handler to itself stays on this origin.
  var loc = out.headers.get('location')
  if (loc && loc.indexOf(UPSTREAM + '/') === 0) out.headers.set('location', url.origin + loc.slice(UPSTREAM.length))
  return out
}

export function onRequest(context) {
  return proxy(context.request, fetch)
}
