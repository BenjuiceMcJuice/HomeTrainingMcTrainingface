import useProfile from './useProfile'
import { now } from '../lib/storage'
import { recordVenue, hasLocatedBefore } from '../lib/venues'

// One shared empty list, so a profile with no venues yet does not hand every
// render a fresh array and defeat the logger's memo.
var NONE = []

/**
 * The saved-venues list, kept in `profile.venues` so it syncs with the rest
 * of the profile.
 *
 * @returns {{
 *   venues: import('../lib/venues').Venue[],
 *   locatedBefore: boolean,
 *   rememberVenue: (name: string, pos: import('../lib/venues').Position | null) => void,
 * }}
 */
export default function useVenues() {
  var { profile, saveProfile } = useProfile()
  var venues = (profile && Array.isArray(profile.venues)) ? profile.venues : NONE

  function rememberVenue(name, pos) {
    var next = recordVenue(venues, name, pos, now())
    if (next === venues) return   // blank name — nothing to record
    saveProfile({ venues: next })
  }

  return {
    venues:        venues,
    locatedBefore: hasLocatedBefore(venues),
    rememberVenue: rememberVenue,
  }
}
