/**
 * betalog-calendar — serves each user's private training calendar.
 *
 * The client renders the .ics (see betalog-react/src/lib/ics.js, unit tested there)
 * and PUTs the finished text here; this Worker stores it in KV and serves it to
 * whichever calendar app subscribed. Keeping the iCalendar logic in the app means
 * one tested implementation rather than two.
 *
 *   PUT    /cal/<token>.ics   store the feed         (body: text/calendar)
 *   GET    /cal/<token>.ics   serve it to a calendar client
 *   DELETE /cal/<token>.ics   revoke it
 *
 * Auth is possession of the token, for reads and writes alike. It is 128 bits of
 * client-generated randomness and never leaves the user's devices except in the
 * subscription URL. The data behind it is a list of routine names and times.
 */

import { corsHeaders as sharedCors } from '../../shared/cors.js'

var TOKEN_RE = /^[a-f0-9]{32}$/
var MAX_BYTES = 64 * 1024

function corsHeaders(request) {
  return sharedCors(request, 'GET, PUT, DELETE, OPTIONS')
}

function tokenFrom(pathname) {
  var match = /^\/cal\/([^/]+)\.ics$/.exec(pathname)
  if (!match) return null
  var token = match[1].toLowerCase()
  return TOKEN_RE.test(token) ? token : null
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url)
    var cors = corsHeaders(request)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    var token = tokenFrom(url.pathname)
    if (!token) {
      return new Response('Not found', { status: 404, headers: cors })
    }
    var key = 'feed:' + token

    if (request.method === 'GET') {
      var stored = await env.FEEDS.get(key)
      if (stored === null) {
        return new Response('Not found', { status: 404, headers: cors })
      }
      return new Response(stored, {
        headers: Object.assign({}, cors, {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'inline; filename="betalog.ics"',
          // private: this is one person's schedule, never a shared cache entry
          'Cache-Control': 'private, max-age=3600',
        }),
      })
    }

    if (request.method === 'PUT') {
      var body = await request.text()
      if (body.length > MAX_BYTES) {
        return new Response('Feed too large', { status: 413, headers: cors })
      }
      if (body.indexOf('BEGIN:VCALENDAR') !== 0) {
        return new Response('Not an iCalendar body', { status: 400, headers: cors })
      }
      await env.FEEDS.put(key, body)
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method === 'DELETE') {
      await env.FEEDS.delete(key)
      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Method not allowed', { status: 405, headers: cors })
  },
}
