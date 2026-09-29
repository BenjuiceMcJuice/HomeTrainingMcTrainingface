import { useMemo, useCallback } from 'react'
import { useData } from '../App'
import useSessions from './useSessions'
import Storage from '../lib/storage'
import { venuesFromSessions, venueRows, relinkSessions, renameSessions } from '../lib/venues'

// One shared empty list, so a log with no venues yet does not hand every
// render a fresh array and defeat the picker's memo.
var NONE = []

/**
 * Where the athlete climbs: the walls from the table their log uses, and
 * their own places, from the session log alone. Most used first. The walls
 * table itself is `lib/venues.js` (`WALLS`, `wallsNear`, `searchWalls`).
 *
 * `locatedBefore` is the device flag set by the first successful fix; the
 * picker asks on open only then.
 *
 * The tidy-up list (Settings › Locations) uses `rows`, `relink` and
 * `rename`: link every session of a place to a wall, or rename a place.
 *
 * @returns {{
 *   venues: import('../lib/venues').Venue[],
 *   locatedBefore: boolean,
 *   rows: ReturnType<typeof venueRows>,
 *   relink: (from: { id?: string | null, key?: string }, to: import('../lib/venues').VenueRef) => void,
 *   rename: (key: string, name: string) => void,
 * }}
 */
export default function useVenues() {
  var { data } = useData()
  var { applySessionUpdates } = useSessions()
  var sessions = (data && Array.isArray(data.sessions)) ? data.sessions : NONE

  var venues = useMemo(function () {
    var list = venuesFromSessions(sessions)
    return list.length ? list : NONE
  }, [sessions])

  var rows = useMemo(function () { return venueRows(sessions) }, [sessions])

  /** Every session in row `from` → the wall `to`. One save. */
  var relink = useCallback(function (from, to) {
    if (!to || !to.id) return
    applySessionUpdates(relinkSessions(sessions, from, to))
  }, [sessions, applySessionUpdates])

  /** The place sessions with `key` → `name`, still a place. One save. */
  var rename = useCallback(function (key, name) {
    applySessionUpdates(renameSessions(sessions, key, name))
  }, [sessions, applySessionUpdates])

  return {
    venues:        venues,
    locatedBefore: Storage.locationOn(),
    rows:          rows,
    relink:        relink,
    rename:        rename,
  }
}
