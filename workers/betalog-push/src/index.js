/**
 * betalog-push — sends each user's schedule reminders as web push.
 *
 * Two halves. The fetch handler stores one subscription mirror per token in KV;
 * the cron handler wakes every few minutes, works out which reminders are due
 * in each user's own wall-clock time, and sends them.
 *
 *   PUT    /sub/<token>   store {subscription, entries}   (body: application/json)
 *   DELETE /sub/<token>   forget it
 *
 * There is deliberately no GET. Unlike the calendar feed, nothing needs to read
 * this back — a mirror that could be fetched with the token would turn a leaked
 * URL into a readable push endpoint someone else could then send to.
 *
 * Auth is possession of the token, 128 bits generated on the client. Behind it:
 * routine names, reminder times, and the browser's push endpoint.
 *
 * The due-time rule is imported from the app rather than reimplemented here, so
 * the behaviour the unit tests describe is the behaviour that actually ships.
 * @see betalog-react/src/lib/pushSchedule.js
 */

import { buildPushPayload } from '@block65/webcrypto-web-push'
import { dueEntries, notificationFor, zonedParts } from '../../../betalog-react/src/lib/pushSchedule.js'
import { corsHeaders as sharedCors, isAllowedOrigin } from '../../shared/cors.js'

export { isAllowedOrigin } // re-exported so the smoke test can cover the policy

var TOKEN_RE = /^[a-f0-9]{32}$/
var MAX_BYTES = 32 * 1024

function corsHeaders(request) {
  return sharedCors(request, 'PUT, DELETE, OPTIONS')
}

function tokenFrom(pathname) {
  var match = /^\/sub\/([^/]+)$/.exec(pathname)
  if (!match) return null
  var token = match[1].toLowerCase()
  return TOKEN_RE.test(token) ? token : null
}

/** A stored record is only usable if it can actually be sent to. */
function isValidRecord(record) {
  if (!record || typeof record !== 'object') return false
  var sub = record.subscription
  if (!sub || typeof sub.endpoint !== 'string') return false
  if (!/^https:\/\//.test(sub.endpoint)) return false // RFC 8291 requires https
  if (!sub.keys || !sub.keys.p256dh || !sub.keys.auth) return false
  return Array.isArray(record.entries)
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
    var key = 'sub:' + token

    if (request.method === 'PUT') {
      var raw = await request.text()
      if (raw.length > MAX_BYTES) {
        return new Response('Mirror too large', { status: 413, headers: cors })
      }
      var parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        return new Response('Not JSON', { status: 400, headers: cors })
      }
      if (!isValidRecord(parsed)) {
        return new Response('Unusable subscription', { status: 400, headers: cors })
      }
      // `sent` is preserved across updates so editing a schedule mid-morning
      // cannot replay a reminder that already fired today.
      var existing = await env.SUBS.get(key, 'json')
      await env.SUBS.put(key, JSON.stringify({
        subscription: parsed.subscription,
        entries: parsed.entries,
        sent: (existing && existing.sent) || {},
        updatedAt: new Date().toISOString(),
      }))
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method === 'DELETE') {
      await env.SUBS.delete(key)
      return new Response(null, { status: 204, headers: cors })
    }

    return new Response('Method not allowed', { status: 405, headers: cors })
  },

  /**
   * Cron entry point. Sends every reminder that has come due since the last run.
   *
   * KV list+get per tick is fine at this scale: one key per subscribed device,
   * and the free tier allows 100k reads a day against a handful of ticks an hour.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDue(env, Date.now()))
  },
}

/**
 * Find and send everything due. Exported for the smoke-test script.
 * @param {object} env
 * @param {number} nowMs
 * @returns {Promise<{checked: number, sent: number, failed: number, pruned: number}>}
 */
export async function sendDue(env, nowMs) {
  var vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }
  var stats = { checked: 0, sent: 0, failed: 0, pruned: 0 }
  var cursor

  do {
    var page = await env.SUBS.list({ prefix: 'sub:', cursor: cursor })
    for (var i = 0; i < page.keys.length; i++) {
      var key = page.keys[i].name
      var record = await env.SUBS.get(key, 'json')
      if (!isValidRecord(record)) continue
      stats.checked++

      var sent = record.sent || {}
      var due = dueEntries(record.entries, nowMs, sent)
      if (!due.length) continue

      var changed = false
      var gone = false

      for (var j = 0; j < due.length; j++) {
        var entry = due[j]
        var note = notificationFor(entry)
        var today = zonedParts(nowMs, entry.tz).ymd

        try {
          var payload = await buildPushPayload(
            { data: note, options: { ttl: 3600, urgency: 'normal' } },
            record.subscription,
            vapid
          )
          var res = await fetch(record.subscription.endpoint, payload)

          if (res.status === 404 || res.status === 410) {
            // The push service says this subscription is dead — the user
            // uninstalled, or the browser rotated the endpoint. Nothing we send
            // will ever arrive, so stop holding it.
            gone = true
            break
          }
          if (!res.ok) {
            stats.failed++
            // Leave `sent` alone so the next tick retries inside the grace window
            continue
          }
          // Mark before anything else can fail: a duplicate reminder is a worse
          // bug than a missed one, and the grace window bounds the retry anyway.
          sent[entry.id] = today
          changed = true
          stats.sent++
        } catch {
          stats.failed++
        }
      }

      if (gone) {
        await env.SUBS.delete(key)
        stats.pruned++
        continue
      }
      if (changed) {
        await env.SUBS.put(key, JSON.stringify(
          Object.assign({}, record, { sent: pruneSent(sent, record.entries) })
        ))
      }
    }
    cursor = page.list_complete ? null : page.cursor
  } while (cursor)

  return stats
}

/**
 * Drop `sent` marks for entries that no longer exist, so the map cannot grow
 * without bound as routines are added and deleted over the years.
 * @param {Record<string, string>} sent
 * @param {Array<{id: string}>} entries
 * @returns {Record<string, string>}
 */
export function pruneSent(sent, entries) {
  var live = {}
  for (var i = 0; i < (entries || []).length; i++) live[entries[i].id] = true
  var out = {}
  for (var id in sent) if (live[id]) out[id] = sent[id]
  return out
}
