import { describe, it, expect, vi } from 'vitest'

vi.mock('../firebase', () => ({ auth: {}, db: {}, googleProvider: {}, browserPopupRedirectResolver: {} }))

import { withCode } from '../storage'

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
