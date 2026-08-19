import { useEffect } from 'react'
import { useData } from '../App'
import useCalendarFeed from '../hooks/useCalendarFeed'

/**
 * Keeps the published .ics matching the schedule.
 *
 * Mounted at the app root rather than in Settings, because the schedule is edited
 * in Plan — a mirror that only ran while Settings was open would silently miss
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
