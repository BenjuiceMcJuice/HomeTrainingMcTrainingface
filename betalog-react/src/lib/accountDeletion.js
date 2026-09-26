/**
 * BetaLog — deleting an account (BTL-B32).
 *
 * Settings › Account › Delete account runs `deleteAccount` after three
 * confirmations and a fresh sign-in. The order is chosen so a failure part-way
 * never leaves the athlete with a live account and no data, or data with no
 * account:
 *
 *   1. Sign in again. Firebase refuses to delete a user who signed in more than
 *      a few minutes ago, and finding that out AFTER the data is gone would
 *      strand a live, empty account. Doing it first also makes the last
 *      "are you sure" a real one.
 *   2. Switch off the reminders — the calendar feed and this device's push
 *      subscription live on Cloudflare Workers, keyed by a token, not by user.
 *      Best-effort: a feed that fails to delete holds only routine names.
 *   3. Firestore — friends' lists, public profile, friend code, main document.
 *   4. The Firebase Auth user.
 *   5. This device's copy.
 *
 * Not reachable from here: feedback messages (held by the shared Benjuicey
 * feedback service) and push reminders turned on from another device, whose
 * token only that device knows. The confirmation screen says so.
 */

import { auth, googleProvider, browserPopupRedirectResolver } from './firebase'
import { deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import Storage from './storage'
import { revokeFeed } from './calendarFeed'
import { revokeSubscription } from './push'

/** What the athlete types on the last screen. */
export var DELETE_PHRASE = 'DELETE'

/**
 * Whether the typed confirmation matches. Case and surrounding space are
 * forgiven — the point is a deliberate act, not a spelling test.
 * @param {string} input
 * @returns {boolean}
 */
export function phraseMatches(input) {
  return typeof input === 'string' && input.trim().toUpperCase() === DELETE_PHRASE
}

/**
 * How this user signs in, which decides how they prove it is them.
 * @param {{ providerData?: { providerId: string }[] } | null} user
 * @returns {'google' | 'password' | 'other'}
 */
export function signInMethod(user) {
  var ids = ((user && user.providerData) || []).map(function (p) { return p && p.providerId })
  if (ids.indexOf('password') !== -1) return 'password'
  if (ids.indexOf('google.com') !== -1) return 'google'
  return 'other'
}

/**
 * Prove it is them. Resolves when Firebase has a fresh sign-in.
 * @param {object} user - the Firebase user
 * @param {string} [password] - for email accounts
 * @returns {Promise<void>}
 */
export function reauthenticate(user, password) {
  if (signInMethod(user) === 'password') {
    return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password || ''))
  }
  return reauthenticateWithPopup(user, googleProvider, browserPopupRedirectResolver)
}

/**
 * A sentence for an error the athlete can act on.
 * @param {{ code?: string, message?: string }} err
 * @returns {string}
 */
export function deletionErrorMessage(err) {
  var code = (err && err.code) || ''
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
    return 'That password is not right. Nothing has been deleted.'
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in was cancelled. Nothing has been deleted.'
  }
  if (code === 'auth/user-mismatch') {
    return 'That was a different Google account. Sign in as the account you are deleting. Nothing has been deleted.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a few minutes and try again. Nothing has been deleted.'
  }
  if (code === 'auth/network-request-failed') {
    return 'No connection. Nothing has been deleted — try again when you are online.'
  }
  return (err && err.message) || 'Something went wrong.'
}

/**
 * Delete the account and everything behind it. Call only after `reauthenticate`
 * has resolved.
 *
 * @param {object} user - the Firebase user
 * @param {{ calendarFeed?: { token?: string } | null, pushSub?: { token?: string } | null }} data
 * @param {function(string): void} [onStep] - progress, as a short line
 * @returns {Promise<void>}
 */
export function deleteAccount(user, data, onStep) {
  var step = onStep || function () {}
  var feed = data && data.calendarFeed
  var push = data && data.pushSub

  step('Switching off reminders…')
  var reminders = []
  if (feed && feed.token) reminders.push(revokeFeed(feed.token).catch(function () {}))
  if (push && push.token) {
    reminders.push(revokeSubscription(push.token).catch(function () {}))
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      reminders.push(navigator.serviceWorker.ready
        .then(function (reg) { return reg.pushManager.getSubscription() })
        .then(function (sub) { return sub ? sub.unsubscribe() : true })
        .catch(function () {}))
    }
  }

  return Promise.all(reminders)
    .then(function () {
      step('Deleting your log from the cloud…')
      return Storage.deleteCloudData(user.uid)
    })
    .then(function () {
      step('Deleting your account…')
      return deleteUser(auth.currentUser || user)
    })
    .then(function () {
      step('Clearing this device…')
      Storage.clearLocal()
    })
}
