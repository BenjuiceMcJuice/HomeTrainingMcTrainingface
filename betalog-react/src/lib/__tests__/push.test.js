import { describe, it, expect } from 'vitest'
import {
  pushSupport, shouldOfferPush, newPushToken, urlBase64ToUint8Array,
  serializeSubscription, mirrorHash,
} from '../push'

var ANDROID   = { hasServiceWorker: true,  hasPushManager: true,  hasNotification: true,  isIOS: false, isStandalone: false }
var IOS_HOME  = { hasServiceWorker: true,  hasPushManager: true,  hasNotification: true,  isIOS: true,  isStandalone: true }
var IOS_TAB   = { hasServiceWorker: true,  hasPushManager: false, hasNotification: false, isIOS: true,  isStandalone: false }
var ANCIENT   = { hasServiceWorker: false, hasPushManager: false, hasNotification: false, isIOS: false, isStandalone: false }

describe('pushSupport', () => {
  it('supports a normal Android or desktop browser', () => {
    expect(pushSupport(ANDROID)).toBe('supported')
  })

  it('supports an installed iOS web app', () => {
    // The Home Screen install is the entire iOS prerequisite
    expect(pushSupport(IOS_HOME)).toBe('supported')
  })

  it('tells an iOS Safari tab to install first', () => {
    // The APIs are absent in a tab and have been since 16.4 — indistinguishable
    // from "never supported" except that we know installing fixes it
    expect(pushSupport(IOS_TAB)).toBe('needs-install')
  })

  it('reports no support at all when nothing is there', () => {
    expect(pushSupport(ANCIENT)).toBe('unsupported')
  })

  it('does not promise support on a half-capable browser', () => {
    expect(pushSupport(Object.assign({}, ANDROID, { hasNotification: false }))).toBe('unsupported')
    expect(pushSupport(Object.assign({}, ANDROID, { hasPushManager: false }))).toBe('unsupported')
  })

  it('is safe with no readings at all', () => {
    expect(pushSupport()).toBe('unsupported')
    expect(pushSupport({})).toBe('unsupported')
  })
})

describe('shouldOfferPush', () => {
  it('offers where push works', () => {
    expect(shouldOfferPush(ANDROID, true)).toBe(true)
    expect(shouldOfferPush(IOS_HOME, true)).toBe(true)
  })

  it('still offers on an iOS tab, because the install advice is worth showing', () => {
    expect(shouldOfferPush(IOS_TAB, true)).toBe(true)
  })

  it('offers nothing where push can never work', () => {
    expect(shouldOfferPush(ANCIENT, true)).toBe(false)
  })

  it('offers nothing when the build has no VAPID key', () => {
    // Without a key the switch could only ever fail, so the card and its
    // section header both stay away rather than advertising a dead control.
    expect(shouldOfferPush(ANDROID, false)).toBe(false)
    expect(shouldOfferPush(IOS_HOME, '')).toBe(false)
  })
})

describe('newPushToken', () => {
  it('is 32 hex characters', () => {
    expect(newPushToken()).toMatch(/^[a-f0-9]{32}$/)
  })

  it('does not repeat', () => {
    var seen = {}
    for (var i = 0; i < 200; i++) seen[newPushToken()] = true
    expect(Object.keys(seen).length).toBe(200)
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url, including the - and _ substitutions', () => {
    // "a?b>c" encodes to "YT9iPmM=" in standard base64 and "YT9iPmM" in base64url
    expect(Array.from(urlBase64ToUint8Array('YT9iPmM'))).toEqual([97, 63, 98, 62, 99])
  })

  it('pads correctly whatever the length modulo 4', () => {
    expect(urlBase64ToUint8Array('QQ').length).toBe(1)     // 'A'
    expect(urlBase64ToUint8Array('QUI').length).toBe(2)    // 'AB'
    expect(urlBase64ToUint8Array('QUJD').length).toBe(3)   // 'ABC'
  })

  it('produces the 65 bytes a VAPID application server key should be', () => {
    // A P-256 uncompressed point: 0x04 followed by two 32-byte coordinates
    var key = 'B' + 'A'.repeat(86) // 87 base64url chars -> 65 bytes
    expect(urlBase64ToUint8Array(key).length).toBe(65)
  })

  it('is safe on empty input', () => {
    expect(urlBase64ToUint8Array('').length).toBe(0)
    expect(urlBase64ToUint8Array(null).length).toBe(0)
  })
})

describe('serializeSubscription', () => {
  var raw = {
    endpoint: 'https://web.push.apple.com/abc',
    expirationTime: null,
    keys: { p256dh: 'PPP', auth: 'AAA' },
  }

  it('reduces a PushSubscription to what the sender needs', () => {
    expect(serializeSubscription({ toJSON: () => raw })).toEqual(raw)
  })

  it('accepts a plain object too', () => {
    expect(serializeSubscription(raw)).toEqual(raw)
  })

  it('normalises a missing expirationTime to null', () => {
    var out = serializeSubscription({ endpoint: 'https://x/1', keys: { p256dh: 'P', auth: 'A' } })
    expect(out.expirationTime).toBeNull()
  })

  it('rejects a subscription that could not be encrypted to', () => {
    // Both keys are required by RFC 8291. Without them the send fails at the
    // push service, silently, long after the user thought they had enabled it.
    expect(serializeSubscription({ endpoint: 'https://x/1', keys: { p256dh: 'P' } })).toBeNull()
    expect(serializeSubscription({ endpoint: 'https://x/1', keys: { auth: 'A' } })).toBeNull()
    expect(serializeSubscription({ endpoint: 'https://x/1' })).toBeNull()
    expect(serializeSubscription({ keys: { p256dh: 'P', auth: 'A' } })).toBeNull()
    expect(serializeSubscription(null)).toBeNull()
  })

  it('drops anything else the browser attached', () => {
    var out = serializeSubscription(Object.assign({}, raw, { unsubscribe: 'fn', extra: 1 }))
    expect(Object.keys(out).sort()).toEqual(['endpoint', 'expirationTime', 'keys'])
  })
})

describe('mirrorHash', () => {
  it('is stable for the same text', () => {
    expect(mirrorHash('abc')).toBe(mirrorHash('abc'))
  })

  it('differs for different text', () => {
    expect(mirrorHash('abc')).not.toBe(mirrorHash('abd'))
  })

  it('handles empty input', () => {
    expect(typeof mirrorHash('')).toBe('string')
  })
})
