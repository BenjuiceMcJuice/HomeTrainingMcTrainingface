import { useState, useRef, useCallback } from 'react'

/**
 * One position fix on request, via the Geolocation API.
 *
 * Nothing is asked for until `locate()` is called, so the permission prompt
 * appears from a tap the athlete made — the same rule as push notifications
 * (`usePush.enable`). Every failure is silent to the caller beyond `status`:
 * a denied prompt, a phone with no fix, a timeout, or a browser with no API
 * all leave the form working exactly as before, typed.
 *
 * Indoors the phone rarely has GPS; Wi-Fi and cell positioning are what it
 * gets, which is why `enableHighAccuracy` is off (it only makes the wait
 * longer) and a fix up to five minutes old is accepted (`maximumAge`) — the
 * athlete has not left the building in that time.
 *
 * @returns {{
 *   position: { lat: number, lng: number, accuracy: number } | null,
 *   status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable',
 *   supported: boolean,
 *   locate: () => void,
 * }}
 */
export default function useGeolocation() {
  var supported = typeof navigator !== 'undefined' && !!navigator.geolocation
  var [position, setPosition] = useState(null)
  var [status,   setStatus]   = useState('idle')
  var inFlight = useRef(false)

  var locate = useCallback(function () {
    if (!supported) { setStatus('unavailable'); return }
    if (inFlight.current) return
    inFlight.current = true
    setStatus('locating')

    navigator.geolocation.getCurrentPosition(
      function (fix) {
        inFlight.current = false
        setPosition({
          lat:      fix.coords.latitude,
          lng:      fix.coords.longitude,
          accuracy: fix.coords.accuracy,
        })
        setStatus('ready')
      },
      function (err) {
        inFlight.current = false
        // 1 = PERMISSION_DENIED; 2 and 3 are no fix and timeout.
        setStatus(err && err.code === 1 ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }, [supported])

  return { position: position, status: status, supported: supported, locate: locate }
}
