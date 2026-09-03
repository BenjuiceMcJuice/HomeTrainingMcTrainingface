import { useEffect } from 'react'
import { useData } from '../App'
import usePush from '../hooks/usePush'

/**
 * Keeps the push Worker's copy of the schedule matching the app's.
 *
 * Mounted at the app root for the same reason as CalendarFeedSync: the schedule
 * is editable from more than one screen, so a mirror scoped to a single screen
 * would miss most real edits and the reminders would quietly go stale. No-ops
 * entirely when push is off.
 */
export default function PushSync() {
  var { data } = useData()
  var { enabled, sync } = usePush()
  var schedule = data.schedule

  useEffect(function () {
    if (!enabled) return
    sync()
    // sync() fingerprints the mirror and only uploads when it differs from the
    // last successful push, so calling it on every schedule change is cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, schedule])

  return null
}
