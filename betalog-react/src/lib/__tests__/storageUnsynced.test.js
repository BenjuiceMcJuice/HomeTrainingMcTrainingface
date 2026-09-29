import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../firebase', () => ({ auth: {}, db: {}, googleProvider: {}, browserPopupRedirectResolver: {} }))

var resolveWrite
vi.mock('firebase/firestore', async (importOriginal) => {
  var real = await importOriginal()
  return Object.assign({}, real, {
    doc: function () { return {} },
    setDoc: function () { return new Promise(function (r) { resolveWrite = r }) },
  })
})

var mem = {}
globalThis.localStorage = {
  getItem: function (k) { return k in mem ? mem[k] : null },
  setItem: function (k, v) { mem[k] = String(v) },
  removeItem: function (k) { delete mem[k] },
  key: function (i) { return Object.keys(mem)[i] || null },
  get length() { return Object.keys(mem).length },
}

import Storage from '../storage'

function flush() { return new Promise(function (r) { setTimeout(r, 0) }) }

describe('unsynced changes (BTL-B37)', function () {
  beforeEach(function () { mem = {}; Storage.updatePublicProfile = function () { return Promise.resolve() } })

  it('is marked per account, so another account never inherits it', function () {
    expect(Storage.hasUnsynced('u1')).toBe(false)
    Storage.markUnsynced('u1')
    expect(Storage.hasUnsynced('u1')).toBe(true)
    expect(Storage.hasUnsynced('u2')).toBe(false)
  })

  it('clears once the cloud write lands', async function () {
    Storage.markUnsynced('u1')
    Storage.syncToFirestore('u1', { sessions: [] })
    expect(Storage.hasUnsynced('u1')).toBe(true)   // not yet confirmed
    resolveWrite(); await flush()
    expect(Storage.hasUnsynced('u1')).toBe(false)
  })

  it('stays when something changed while the write was in flight', async function () {
    Storage.markUnsynced('u1')
    Storage.syncToFirestore('u1', { sessions: [] })
    await new Promise(function (r) { setTimeout(r, 5) })
    Storage.markUnsynced('u1')                      // a newer change
    resolveWrite(); await flush()
    expect(Storage.hasUnsynced('u1')).toBe(true)
  })
})

describe('where a session was, against the walls table (2026-09-29)', function () {
  beforeEach(function () { mem = {} })

  it('load drops the profile\'s venues key, from either era', function () {
    localStorage.setItem('il_athleteProfile', JSON.stringify({ name: 'Ben', venues: [{ name: 'Redpoint', lat: 51.5, lng: -2.6, uses: 3, lastUsed: 'x' }] }))
    expect(Storage.load().athleteProfile).toEqual({ name: 'Ben' })
    localStorage.setItem('il_athleteProfile', JSON.stringify({ name: 'Ben', venues: [{ id: 'v1', name: 'Flashpoint', lat: 51.44, lng: -2.59 }] }))
    expect(Storage.load().athleteProfile).toEqual({ name: 'Ben' })
  })

  it('a cloud copy is migrated the same way on merge', function () {
    Storage.mergeFromCloud({ athleteProfile: { name: 'Ben', venues: [] } })
    expect(Storage.load().athleteProfile).toEqual({ name: 'Ben' })
  })

  it('a profile without venues is untouched', function () {
    localStorage.setItem('il_athleteProfile', JSON.stringify({ name: 'Ben' }))
    expect(Storage.load().athleteProfile).toEqual({ name: 'Ben' })
  })

  it('load links a climb session whose text is a wall\'s spelling, and drops a registry-era id', function () {
    localStorage.setItem('il_sessions', JSON.stringify([
      { id: 's1', type: 'climb', date: '2026-09-16', location: 'Redpoint bristol', climbs: [{ id: 'c1', grade: 'V3', discipline: 'boulder', outcome: 'sent', location: 'Redpoint bristol' }] },
      { id: 's2', type: 'climb', date: '2026-09-10', location: 'My loft wall', venueId: '6e4fe94d-225c-492c-8919-273fbb70b3dc', climbs: [] },
      { id: 's3', type: 'gym', date: '2026-09-09', location: 'Redpoint', climbs: [], exercises: [] },
    ]))
    var out = Storage.load().sessions
    expect(out[0].venueId).toBe('redpoint-bristol')
    expect(out[0].location).toBe('Redpoint Bristol')
    expect(out[0].climbs[0].location).toBe('Redpoint Bristol')
    expect(out[1].venueId).toBe(null)
    expect(out[1].location).toBe('My loft wall')
    expect(out[2].venueId).toBeUndefined()   // only climb sessions are looked at
  })
})
