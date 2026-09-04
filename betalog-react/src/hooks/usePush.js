import { useState } from 'react'
import { useData } from '../App'
import Storage from '../lib/storage'
import { mirrorEntries } from '../lib/pushSchedule'
import {
  VAPID_PUBLIC_KEY, detectEnv, pushSupport, newPushToken, urlBase64ToUint8Array,
  serializeSubscription, publishSubscription, revokeSubscription, mirrorHash,
} from '../lib/push'

// Mirror hash currently uploading, per token. Module-level for the same reason
// useCalendarFeed does it: two mounted copies of this hook can both run the sync
// before either has stored its hash in state, which races into duplicate PUTs.
var inFlight = {}

/**
 * Push reminders: enable, disable, and keep the Worker's copy of the schedule
 * matching the app's.
 *
 * Off until `enable()` is called. That call is also the only place a permission
 * prompt is ever raised, and it must stay attached to a user gesture — iOS gives
 * you exactly one prompt per install, and a decline cannot be re-asked from the
 * web at all, only undone in iOS Settings. So we never probe on load.
 */
export default function usePush() {
  var { data, setData } = useData()
  var [busy,  setBusy]  = useState(false)
  var [error, setError] = useState(null)

  var record = data.pushSub || null
  var enabled = !!(record && record.token && record.subscription)
  var support = pushSupport(detectEnv())
  var configured = !!VAPID_PUBLIC_KEY

  function save(next) {
    Storage.savePushSub(next)
    setData(function (prev) { return Object.assign({}, prev, { pushSub: next }) })
  }

  function body(subscription) {
    return { subscription: subscription, entries: mirrorEntries(data.schedule || []) }
  }

  /**
   * Ask permission, subscribe, and upload the first mirror.
   *
   * Returns null on any failure rather than throwing — every caller is a click
   * handler, and the message is already in `error` for the UI to render.
   */
  function enable() {
    if (busy) return Promise.resolve(null)
    if (!configured) {
      setError('Push is not configured for this build (no VAPID public key).')
      return Promise.resolve(null)
    }
    if (support !== 'supported') {
      setError(support === 'needs-install'
        ? 'Add BetaLog to your Home Screen first — iOS only allows notifications for installed apps.'
        : 'This browser cannot receive push notifications.')
      return Promise.resolve(null)
    }

    setBusy(true)
    setError(null)

    return Notification.requestPermission()
      .then(function (permission) {
        if (permission !== 'granted') {
          // 'denied' is terminal on iOS: the web cannot ask twice.
          throw new Error(permission === 'denied'
            ? 'Notifications are blocked. Turn them back on in your device settings for BetaLog.'
            : 'Notification permission was not granted.')
        }
        return navigator.serviceWorker.ready
      })
      .then(function (reg) {
        return reg.pushManager.subscribe({
          // Non-user-visible pushes are refused by every current browser, and we
          // have no use for one: every message here becomes a notification.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      })
      .then(function (sub) {
        var serialized = serializeSubscription(sub)
        if (!serialized) throw new Error('The browser returned an unusable subscription.')
        var next = {
          token: newPushToken(),
          subscription: serialized,
          createdAt: new Date().toISOString(),
        }
        var payload = body(serialized)
        var hash = mirrorHash(JSON.stringify(payload))
        inFlight[next.token] = hash
        return publishSubscription(next.token, payload).then(function () {
          next.pushedAt = new Date().toISOString()
          next.pushedHash = hash
          save(next)
          delete inFlight[next.token]
          return next
        })
      })
      .catch(function (err) {
        setError(err.message || 'Could not turn on push reminders')
        return null
      })
      .finally(function () { setBusy(false) })
  }

  /**
   * Unsubscribe this device and delete its mirror.
   *
   * The local record is cleared even if the network calls fail — leaving a
   * switch stuck "on" for a subscription the user has asked to end is worse
   * than an orphaned KV entry, which expires with the endpoint anyway.
   */
  function disable() {
    if (!record || busy) return Promise.resolve()
    setBusy(true)
    setError(null)
    delete inFlight[record.token]

    return navigator.serviceWorker.ready
      .then(function (reg) { return reg.pushManager.getSubscription() })
      .then(function (sub) { return sub ? sub.unsubscribe() : true })
      .catch(function () { return true }) // already gone; carry on to the server
      .then(function () { return revokeSubscription(record.token) })
      .then(function () { save(null) })
      .catch(function (err) {
        save(null)
        setError('Turned off on this device, but the server copy may remain: ' + (err.message || 'network error'))
      })
      .finally(function () { setBusy(false) })
  }

  /**
   * Re-upload if the schedule has changed since the last push. Safe to call
   * often — an unchanged mirror is a no-op, not a request.
   * @returns {Promise<boolean>} true if an upload happened
   */
  function sync() {
    if (!enabled) return Promise.resolve(false)
    var payload = body(record.subscription)
    var hash = mirrorHash(JSON.stringify(payload))
    if (hash === record.pushedHash) return Promise.resolve(false)
    if (inFlight[record.token] === hash) return Promise.resolve(false)
    inFlight[record.token] = hash
    return publishSubscription(record.token, payload)
      .then(function () {
        save(Object.assign({}, record, { pushedAt: new Date().toISOString(), pushedHash: hash }))
        return true
      })
      .catch(function (err) {
        // Leave pushedHash alone so the next save retries
        console.warn('[push] mirror sync failed:', err.message)
        return false
      })
      .finally(function () {
        if (inFlight[record.token] === hash) delete inFlight[record.token]
      })
  }

  return {
    enabled:    enabled,
    support:    support,
    configured: configured,
    busy:       busy,
    error:      error,
    enable:     enable,
    disable:    disable,
    sync:       sync,
  }
}
