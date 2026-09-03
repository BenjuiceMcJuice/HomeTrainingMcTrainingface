/**
 * betalog-push — cron smoke test.
 *
 * Drives `sendDue()` against an in-memory KV and a stubbed push service, so the
 * send loop can be exercised without deploying, without VAPID keys and without
 * a phone. It checks the decisions the Worker makes — who is due, what is sent,
 * what gets marked, what gets pruned — not the crypto, which is the library's.
 *
 *   node scripts/smoke-test.mjs
 *
 * Exits non-zero on the first failure.
 */

import { sendDue, pruneSent } from '../src/index.js'

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function fakeKV(initial) {
  var store = new Map(Object.entries(initial || {}))
  return {
    store: store,
    async get(key, type) {
      var raw = store.get(key)
      if (raw === undefined) return null
      return type === 'json' ? JSON.parse(raw) : raw
    },
    async put(key, value) { store.set(key, value) },
    async delete(key) { store.delete(key) },
    async list({ prefix, cursor }) {
      var keys = [...store.keys()].filter(k => k.startsWith(prefix || '')).map(name => ({ name }))
      return { keys, list_complete: true, cursor: cursor || null }
    },
  }
}

/** Replaces global fetch, recording every send and replying with `status`. */
function stubFetch(status) {
  var calls = []
  globalThis.fetch = async function (url) {
    calls.push(String(url))
    return { ok: status >= 200 && status < 300, status: status }
  }
  return calls
}

var VAPID = {
  VAPID_SUBJECT: 'mailto:test@betalog.co.uk',
  // A real, throwaway P-256 pair — buildPushPayload does actual crypto, so
  // structurally invalid keys would fail for the wrong reason.
  VAPID_PUBLIC_KEY: 'BE_DQX3zCywWNVgEbhnS6D2o6mWhZZDhrbcRHOlgiVu7c1zTto8m3FeQ0dB1806Vp7HE2EgwhJXaTJx-BalD-lU',
  VAPID_PRIVATE_KEY: 'mqy0TlSOxnDrmYAD3WSsac-ntWD8KKEj0wnIct4Cc4g',
}

// A throwaway subscription whose p256dh is a REAL point on the P-256 curve.
// buildPushPayload performs an actual ECDH against it, so a plausible-looking
// but invalid key fails inside the crypto and every send silently reports as a
// transient error — which is exactly how the first run of this test lied.
var SUBSCRIPTION = {
  endpoint: 'https://web.push.apple.com/test-endpoint',
  expirationTime: null,
  keys: {
    p256dh: 'BCeK7wYHsoGd-d4PIbA9PaRQ9fWUrtbD3y5Lsz-Rs2nQKNb4ui8VG_lWpfcPANrSjnaIbhNH3R0hwRiWgVOM5Ic',
    auth: 'IEEB5KsJ-tOKhwwg6rTzxA',
  },
}

// Thu 3 September 2026, 06:00 UTC = 07:00 in London (BST).
var NOW = Date.UTC(2026, 8, 3, 6, 0)

function record(entries, sent) {
  return JSON.stringify({
    subscription: SUBSCRIPTION,
    entries: entries,
    sent: sent || {},
    updatedAt: '2026-09-01T00:00:00.000Z',
  })
}

function entry(over) {
  return Object.assign({
    id: 'e1', routineId: 'r1', routineName: 'Glutes!!!',
    days: [4], remindAt: '07:00', tz: 'Europe/London',
  }, over)
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

var failures = 0
function check(name, actual, expected) {
  var a = JSON.stringify(actual)
  var e = JSON.stringify(expected)
  if (a === e) {
    console.log('  ok   ' + name)
  } else {
    failures++
    console.log('  FAIL ' + name + '\n         expected ' + e + '\n         actual   ' + a)
  }
}

console.log('\nbetalog-push — cron smoke test\n')

// 1. A due reminder is sent and marked
{
  var kv = fakeKV({ 'sub:aaa': record([entry()]) })
  var calls = stubFetch(201)
  var stats = await sendDue({ SUBS: kv, ...VAPID }, NOW)
  check('sends one due reminder', stats.sent, 1)
  check('hits the subscription endpoint', calls, [SUBSCRIPTION.endpoint])
  var after = JSON.parse(kv.store.get('sub:aaa'))
  check('marks it sent under the local date', after.sent, { e1: '2026-09-03' })
}

// 2. Not sent twice on the same day
{
  var kv2 = fakeKV({ 'sub:aaa': record([entry()], { e1: '2026-09-03' }) })
  var calls2 = stubFetch(201)
  var stats2 = await sendDue({ SUBS: kv2, ...VAPID }, NOW)
  check('does not resend the same day', stats2.sent, 0)
  check('makes no request at all', calls2.length, 0)
}

// 3. Wrong day, and not yet due
{
  var kv3 = fakeKV({
    'sub:aaa': record([entry({ id: 'wrongday', days: [1] })]),
    'sub:bbb': record([entry({ id: 'later', remindAt: '18:00' })]),
  })
  stubFetch(201)
  var stats3 = await sendDue({ SUBS: kv3, ...VAPID }, NOW)
  check('sends nothing off-schedule', stats3.sent, 0)
  check('still checked both records', stats3.checked, 2)
}

// 4. A dead subscription is pruned
{
  var kv4 = fakeKV({ 'sub:aaa': record([entry()]) })
  stubFetch(410) // Gone — the browser rotated or the app was uninstalled
  var stats4 = await sendDue({ SUBS: kv4, ...VAPID }, NOW)
  check('prunes a 410 subscription', stats4.pruned, 1)
  check('removes the KV record', kv4.store.has('sub:aaa'), false)
}

// 5. A transient failure is retried, not marked
{
  var kv5 = fakeKV({ 'sub:aaa': record([entry()]) })
  stubFetch(500)
  var stats5 = await sendDue({ SUBS: kv5, ...VAPID }, NOW)
  check('counts a 500 as failed', stats5.failed, 1)
  var after5 = JSON.parse(kv5.store.get('sub:aaa'))
  check('leaves it unmarked so the next tick retries', after5.sent, {})
  check('keeps the subscription', kv5.store.has('sub:aaa'), true)
}

// 6. Timezone: the same instant is past-due in Sydney
{
  var kv6 = fakeKV({ 'sub:aaa': record([entry({ tz: 'Australia/Sydney' })]) })
  stubFetch(201)
  var stats6 = await sendDue({ SUBS: kv6, ...VAPID }, NOW)
  check('respects the entry own timezone', stats6.sent, 0)
}

// 7. Two due entries on one subscription both send
{
  var kv7 = fakeKV({
    'sub:aaa': record([entry({ id: 'a' }), entry({ id: 'b', remindAt: '06:45' })]),
  })
  var calls7 = stubFetch(201)
  var stats7 = await sendDue({ SUBS: kv7, ...VAPID }, NOW)
  check('sends both due entries', stats7.sent, 2)
  check('one request each', calls7.length, 2)
}

// 8. A malformed record is skipped rather than crashing the tick
{
  var kv8 = fakeKV({
    'sub:bad': JSON.stringify({ subscription: { endpoint: 'http://insecure/x' }, entries: [] }),
    'sub:ok':  record([entry()]),
  })
  stubFetch(201)
  var stats8 = await sendDue({ SUBS: kv8, ...VAPID }, NOW)
  check('skips the unusable record', stats8.checked, 1)
  check('still sends the good one', stats8.sent, 1)
}

// 9. pruneSent forgets deleted entries
{
  check('pruneSent drops marks for entries that no longer exist',
    pruneSent({ a: '2026-09-03', gone: '2026-09-01' }, [{ id: 'a' }]),
    { a: '2026-09-03' })
}

console.log('\n' + (failures ? failures + ' FAILED\n' : 'all passed\n'))
process.exit(failures ? 1 : 0)
