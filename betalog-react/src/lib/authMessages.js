// ---------------------------------------------------------------------------
// authMessages.js — Firebase Auth error codes in words for the sign-in screen.
// Pure; no Firebase imports.
// ---------------------------------------------------------------------------

/**
 * A sign-in or sign-up failure in plain words. Firebase projects with email
 * enumeration protection (the default since 2023) answer a wrong password
 * *and* an unknown email with `auth/invalid-credential`, so that one message
 * has to cover both — and points at the reset link (BTL-B67).
 *
 * @param {{ code?: string, message?: string }} err
 * @returns {string}
 */
export function signInErrorMessage(err) {
  var code = err && err.code
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' || code === 'auth/wrong-password') {
    return 'Email or password is wrong. Check both, or tap Forgot password?'
  }
  if (code === 'auth/user-not-found')        return 'No account found — try Sign up'
  if (code === 'auth/email-already-in-use')  return 'Account already exists — try Sign in'
  if (code === 'auth/invalid-email')         return 'Invalid email address'
  if (code === 'auth/weak-password')         return 'Password must be at least 6 characters'
  if (code === 'auth/too-many-requests')     return 'Too many tries — wait a few minutes, or reset your password'
  if (code === 'auth/network-request-failed') return 'No connection — try again when you have signal'
  return (err && err.message) || 'Sign in failed'
}

/**
 * What the screen says after *Forgot password?* (BTL-B67). Success is worded
 * the same whether or not an account exists: with enumeration protection
 * Firebase does not say, and the screen must not guess.
 *
 * @param {string} email
 * @param {{ code?: string, message?: string } | null} err  null on success
 * @returns {{ ok: boolean, text: string }}
 */
export function resetMessage(email, err) {
  if (!err) {
    return { ok: true, text: 'If there is an account for ' + email + ', a reset link is on its way. Check your spam folder too.' }
  }
  var code = err.code
  if (code === 'auth/invalid-email' || code === 'auth/missing-email') return { ok: false, text: 'Type the email address you signed up with first' }
  if (code === 'auth/too-many-requests')      return { ok: false, text: 'Too many reset requests — wait a few minutes and try again' }
  if (code === 'auth/network-request-failed') return { ok: false, text: 'No connection — try again when you have signal' }
  // An unknown email, where a project still reports it, gets the same answer
  // as success, so the screen never confirms who has an account.
  if (code === 'auth/user-not-found') return resetMessage(email, null)
  return { ok: false, text: err.message || 'Could not send the reset email' }
}
