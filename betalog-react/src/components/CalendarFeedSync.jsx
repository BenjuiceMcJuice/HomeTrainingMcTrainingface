import { useEffect } from 'react'
import { useData } from '../App'
import useCalendarFeed from '../hooks/useCalendarFeed'

/**
 * Keeps the published .ics matching the schedule.
 *
 * Mounted at the app root rather than inside any one screen, because the schedule
 * can be edited from more than one — a mirror scoped to a single screen would miss
 * every real edit. No-ops entirely when the feed is disabled.
 */
export default function CalendarFeedSync() {
  var { data } = useData()
  var { enabled, sync } = useCalendarFeed()
  var schedule = data.schedule

  useEffect(function () {
    if (!enabled) return
    sync()
    // sync() is cheap and idempotent: it fingerprints the rendered feed and only
    // uploads when it differs from the last successful push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, schedule])

  return null
}
