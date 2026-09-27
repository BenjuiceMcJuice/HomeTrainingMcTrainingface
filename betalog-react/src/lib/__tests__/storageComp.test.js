import { describe, it, expect, vi } from 'vitest'

vi.mock('../firebase', () => ({ auth: {}, db: {}, googleProvider: {}, browserPopupRedirectResolver: {} }))

var getDocMock = vi.fn()
vi.mock('firebase/firestore', async (importOriginal) => {
  var real = await importOriginal()
  return Object.assign({}, real, {
    doc: function () { return {} },
    getDoc: function () { return getDocMock.apply(null, arguments) },
  })
})

import Storage, { withCode } from '../storage'

describe('getEntry', () => {
  it('reads a refused read of your own entry as not entered — the rules refuse it until you are (BTL-B82)', async () => {
    getDocMock.mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }))
    expect(await Storage.getEntry('CP-K7M2Q', 'u1')).toBe(null)
  })

  it('returns the entry with its uid when there is one', async () => {
    getDocMock.mockResolvedValueOnce({ exists: function () { return true }, data: function () { return { displayName: 'Alex' } } })
    expect(await Storage.getEntry('CP-K7M2Q', 'u1')).toEqual({ uid: 'u1', displayName: 'Alex' })
  })

  it('still fails on any other error', async () => {
    getDocMock.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
    await expect(Storage.getEntry('CP-K7M2Q', 'u1')).rejects.toThrow('offline')
  })
})

describe('withCode', () => {
  it('puts the code on last, over a draft\'s null', () => {
    expect(withCode('CP-K7M2Q', { code: null, name: 'X' })).toEqual({ code: 'CP-K7M2Q', name: 'X' })
    expect(withCode('CP-K7M2Q', { name: 'X' }).code).toBe('CP-K7M2Q')
  })

  it('does not touch the data it was given', () => {
    var d = { code: null }
    withCode('CP-AAAAA', d)
    expect(d.code).toBe(null)
  })
})
