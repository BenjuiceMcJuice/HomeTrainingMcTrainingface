import { describe, it, expect, vi } from 'vitest'

// The pure helpers live beside Firebase calls; keep Firebase out of the test.
vi.mock('../firebase', () => ({ auth: {}, db: {}, googleProvider: {}, browserPopupRedirectResolver: {} }))

import { phraseMatches, signInMethod, deletionErrorMessage, DELETE_PHRASE } from '../accountDeletion'
import { betalogKeys } from '../storage'

describe('phraseMatches', () => {
  it('accepts the phrase, forgiving case and spaces', () => {
    expect(phraseMatches(DELETE_PHRASE)).toBe(true)
    expect(phraseMatches('  delete ')).toBe(true)
  })

  it('refuses anything else', () => {
    expect(phraseMatches('')).toBe(false)
    expect(phraseMatches('DELET')).toBe(false)
    expect(phraseMatches('DELETE ME')).toBe(false)
    expect(phraseMatches(undefined)).toBe(false)
  })
})

describe('signInMethod', () => {
  it('reads the provider', () => {
    expect(signInMethod({ providerData: [{ providerId: 'google.com' }] })).toBe('google')
    expect(signInMethod({ providerData: [{ providerId: 'password' }] })).toBe('password')
  })

  it('prefers the password when both are linked — no popup needed', () => {
    expect(signInMethod({ providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] })).toBe('password')
  })

  it('copes with no user or no providers', () => {
    expect(signInMethod(null)).toBe('other')
    expect(signInMethod({ providerData: [] })).toBe('other')
  })
})

describe('deletionErrorMessage', () => {
  it('says nothing was deleted when the sign-in step fails', () => {
    ;['auth/wrong-password', 'auth/invalid-credential', 'auth/popup-closed-by-user', 'auth/user-mismatch', 'auth/too-many-requests']
      .forEach(code => expect(deletionErrorMessage({ code })).toMatch(/Nothing has been deleted/))
  })

  it('falls back to the raw message', () => {
    expect(deletionErrorMessage({ message: 'boom' })).toBe('boom')
    expect(deletionErrorMessage(null)).toBe('Something went wrong.')
  })
})

describe('betalogKeys', () => {
  it('keeps only BetaLog keys, leaving Firebase and anything else alone', () => {
    var keys = ['il_sessions', 'il_groq_key', 'firebase:authUser:abc:[DEFAULT]', 'other', 'il_coach_tip']
    expect(betalogKeys(keys)).toEqual(['il_sessions', 'il_groq_key', 'il_coach_tip'])
  })
})
