import { useEffect, useState } from 'react'

/**
 * The time now, re-read every `everyMs` (default 30 s) — for a countdown
 * that has to move while the screen is open. Also re-reads on coming back to
 * the front, since a phone in a pocket throttles timers.
 * @param {number} [everyMs]
 * @returns {number} epoch ms
 */
export default function useNow(everyMs) {
  var [nowMs, setNowMs] = useState(function () { return Date.now() })
  useEffect(function () {
    function tick() { setNowMs(Date.now()) }
    var id = setInterval(tick, everyMs || 30000)
    function onVisible() { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return function () { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [everyMs])
  return nowMs
}
