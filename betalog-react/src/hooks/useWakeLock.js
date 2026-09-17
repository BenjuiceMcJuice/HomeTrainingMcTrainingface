import { useEffect, useRef } from 'react'

/**
 * Keeps the screen awake while `active` is true, via the Screen Wake Lock API.
 *
 * Meant for timed activities the climber is watching — the hangboard timer —
 * where the phone locking mid-set silences the cues and stalls the countdown.
 *
 * Silent no-op where the API is missing (iOS before 16.4, Firefox). iOS also
 * refuses the lock in Low Power Mode and drops it whenever the app leaves the
 * foreground, so the request is retried on every return to visibility.
 *
 * @param {boolean} active  hold the lock while true, release when false
 */
export default function useWakeLock(active) {
  var lockRef = useRef(null)

  useEffect(function () {
    if (!active) return undefined
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return undefined

    var cancelled = false

    function request() {
      if (cancelled || document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(function (lock) {
        if (cancelled) { lock.release().catch(function () {}); return }
        lockRef.current = lock
      }).catch(function () {
        // Refused — Low Power Mode, or the page is not allowed to. Nothing to do;
        // the timer still works, the screen just follows the normal auto-lock.
      })
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') request()
    }

    request()
    document.addEventListener('visibilitychange', onVisibility)

    return function () {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (lockRef.current) {
        lockRef.current.release().catch(function () {})
        lockRef.current = null
      }
    }
  }, [active])
}
