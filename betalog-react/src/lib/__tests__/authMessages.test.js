import { describe, it, expect } from 'vitest'
import { signInErrorMessage, resetMessage } from '../authMessages'

describe('signInErrorMessage', function () {
  it('reads the enumeration-protected wrong password and points at the reset link', function () {
    expect(signInErrorMessage({ code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' }))
      .toBe('Email or password is wrong. Check both, or tap Forgot password?')
    expect(signInErrorMessage({ code: 'auth/wrong-password' })).toMatch(/Forgot password/)
  })

  it('keeps the older codes and falls back to the message', function () {
    expect(signInErrorMessage({ code: 'auth/user-not-found' })).toBe('No account found — try Sign up')
    expect(signInErrorMessage({ code: 'auth/email-already-in-use' })).toBe('Account already exists — try Sign in')
    expect(signInErrorMessage({ code: 'auth/other', message: 'Odd' })).toBe('Odd')
    expect(signInErrorMessage(null)).toBe('Sign in failed')
  })
})

describe('resetMessage', function () {
  it('says the same on success whether or not an account exists', function () {
    var ok = resetMessage('a@b.co', null)
    expect(ok.ok).toBe(true)
    expect(ok.text).toBe('If there is an account for a@b.co, a reset link is on its way. Check your spam folder too.')
    expect(resetMessage('a@b.co', { code: 'auth/user-not-found' })).toEqual(ok)
  })

  it('asks for the email when it is missing or malformed', function () {
    expect(resetMessage('', { code: 'auth/missing-email' }).text).toBe('Type the email address you signed up with first')
    expect(resetMessage('x', { code: 'auth/invalid-email' }).ok).toBe(false)
  })

  it('says so when rate-limited or offline', function () {
    expect(resetMessage('a@b.co', { code: 'auth/too-many-requests' }).text).toMatch(/wait a few minutes/)
    expect(resetMessage('a@b.co', { code: 'auth/network-request-failed' }).text).toMatch(/No connection/)
  })
})
