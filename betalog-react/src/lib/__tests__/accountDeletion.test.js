import { describe, it, expect, vi } from 'vitest'

// The pure helpers live beside Firebase calls; keep Firebase out of the test.
vi.mock('../firebase', () => ({ auth: {}, db: {}, googleProvider: {}, browserPopupRedirectResolver: {} }))

import { phraseMatches, signInMethod, deletionErrorMessage, DELETE_PHRASE, signedInRecently, reauthenticate, FRESH_SIGN_IN_MS } from '../accountDeletion'
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

describe('signedInRecently — the installed app’s proof for a Google account', () => {
  var now = Date.parse('2026-10-02T12:00:00Z')
  function at(iso) { return { metadata: { lastSignInTime: new Date(iso).toUTCString() } } }

  it('a sign-in a minute ago counts', () => {
    expect(signedInRecently(at('2026-10-02T11:59:00Z'), now)).toBe(true)
  })

  it('stops counting inside Firebase’s five minutes, so the deletion has time to run', () => {
    expect(FRESH_SIGN_IN_MS).toBeLessThan(5 * 60 * 1000)
    expect(signedInRecently({ metadata: { lastSignInTime: new Date(now - FRESH_SIGN_IN_MS).toUTCString() } }, now)).toBe(false)
    expect(signedInRecently(at('2026-10-02T11:50:00Z'), now)).toBe(false)
  })

  it('no metadata, or a time in the future, does not count', () => {
    expect(signedInRecently(null, now)).toBe(false)
    expect(signedInRecently({}, now)).toBe(false)
    expect(signedInRecently({ metadata: { lastSignInTime: 'garbage' } }, now)).toBe(false)
    expect(signedInRecently(at('2026-10-02T12:05:00Z'), now)).toBe(false)
  })
})

describe('reauthenticate in the installed app', () => {
  var google = { providerData: [{ providerId: 'google.com' }] }

  it('a recent sign-in resolves without a popup', async () => {
    var u = Object.assign({ metadata: { lastSignInTime: new Date().toUTCString() } }, google)
    await expect(reauthenticate(u, '', { noPopup: true })).resolves.toBe(undefined)
  })

  it('an old one refuses before anything is deleted, and says what to do', async () => {
    var u = Object.assign({ metadata: { lastSignInTime: new Date(Date.now() - 60 * 60 * 1000).toUTCString() } }, google)
    var err = await reauthenticate(u, '', { noPopup: true }).catch(function (e) { return e })
    expect(err.code).toBe('betalog/sign-in-stale')
    expect(deletionErrorMessage(err)).toMatch(/sign back in with Google.*Nothing has been deleted/)
  })
})
