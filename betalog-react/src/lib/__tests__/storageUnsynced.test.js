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
