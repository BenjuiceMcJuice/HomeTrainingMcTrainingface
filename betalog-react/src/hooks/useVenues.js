import { useMemo } from 'react'
import { useData } from '../App'
import useProfile from './useProfile'
import { now } from '../lib/storage'
import { recordVenue, hasLocatedBefore, venuesFromSessions, mergeVenues } from '../lib/venues'

// One shared empty list, so a profile with no venues yet does not hand every
// render a fresh array and defeat the logger's memo.
var NONE = []

/**
 * The venues the athlete has climbed at: every location text in the session
 * log, merged with `profile.venues`, which holds the coordinates a session
 * was saved with and syncs with the rest of the profile. A wall from before
 * location existed is in the list from its sessions alone.
 *
 * @returns {{
 *   venues: import('../lib/venues').Venue[],
 *   locatedBefore: boolean,
 *   rememberVenue: (name: string, pos: import('../lib/venues').Position | null) => void,
 * }}
 */
export default function useVenues() {
  var { data } = useData()
  var { profile, saveProfile } = useProfile()
  var saved    = (profile && Array.isArray(profile.venues)) ? profile.venues : NONE
  var sessions = (data && Array.isArray(data.sessions)) ? data.sessions : NONE

  var venues = useMemo(function () {
    var merged = mergeVenues(saved, venuesFromSessions(sessions))
    return merged.length ? merged : NONE
  }, [saved, sessions])

  function rememberVenue(name, pos) {
    var next = recordVenue(saved, name, pos, now())
    if (next === saved) return   // blank name — nothing to record
    saveProfile({ venues: next })
  }

  return {
    venues:        venues,
    locatedBefore: hasLocatedBefore(saved),
    rememberVenue: rememberVenue,
  }
}
