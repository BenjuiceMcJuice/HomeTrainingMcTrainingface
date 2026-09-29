import { useMemo, useCallback } from 'react'
import { useData } from '../App'
import useProfile from './useProfile'
import useSessions from './useSessions'
import Storage, { uuid, now } from '../lib/storage'
import { auth } from '../lib/firebase'
import {
  hasLocatedBefore, venuesFromSessions, mergeVenues, cacheVenue, venueRef,
  newVenueDoc, placedFields, legacySessionIds, duplicateCandidates, nameProblem,
} from '../lib/venues'

// One shared empty list, so a profile with no venues yet does not hand every
// render a fresh array and defeat the picker's memo.
var NONE = []

/**
 * The venues the athlete climbs at, and the registry behind them.
 *
 * `venues` is the athlete's own list: the profile's cache of registry venues
 * (with their positions, so the chips work offline and cost no reads) merged
 * with every venue in the session log — by id, or by name for sessions from
 * before the registry. Most used first.
 *
 * Picking a venue caches it and links the old text-only sessions that carry
 * its exact name, so the log has one venue where it had two spellings of the
 * same one. Adding one writes it to the registry — after checking for a
 * venue of the same name, which is used instead of adding a twin.
 *
 * @returns {{
 *   venues: import('../lib/venues').Venue[],
 *   locatedBefore: boolean,
 *   pickVenue: (v: import('../lib/venues').VenueRef) => void,
 *   addVenue: (name: string, pos: import('../lib/venues').Position | null) => Promise<import('../lib/venues').VenueRef>,
 *   placeVenue: (v: import('../lib/venues').VenueRef, pos: import('../lib/venues').Position) => Promise<import('../lib/venues').VenueRef>,
 *   findNearby: (pos: import('../lib/venues').Position) => Promise<Array<import('../lib/venues').VenueRef & { distance: number }>>,
 *   search: (text: string) => Promise<import('../lib/venues').VenueRef[]>,
 * }}
 */
export default function useVenues() {
  var { data } = useData()
  var { profile, saveProfile } = useProfile()
  var { updateSessionsWhere } = useSessions()
  var cache    = (profile && Array.isArray(profile.venues)) ? profile.venues : NONE
  var sessions = (data && Array.isArray(data.sessions)) ? data.sessions : NONE

  var venues = useMemo(function () {
    var merged = mergeVenues(cache, venuesFromSessions(sessions))
    return merged.length ? merged : NONE
  }, [cache, sessions])

  // Cache the venue and link the sessions that carry its name as text. One
  // profile save and at most one sessions save.
  var pickVenue = useCallback(function (v) {
    if (!v || !v.id) return
    var ref = venueRef(v)
    var cur = cache.filter(function (c) { return c.id === ref.id })[0]
    if (!cur || cur.name !== ref.name || cur.lat !== ref.lat || cur.lng !== ref.lng) {
      saveProfile({ venues: cacheVenue(cache, ref) })
    }
    updateSessionsWhere(legacySessionIds(sessions, ref), { venueId: ref.id, location: ref.name })
  }, [cache, sessions, saveProfile, updateSessionsWhere])

  var addVenue = useCallback(function (name, pos) {
    var problem = nameProblem(name)
    if (problem) return Promise.reject(new Error(problem))
    var uid = auth && auth.currentUser ? auth.currentUser.uid : null
    if (!uid) return Promise.reject(new Error('Sign in to add a venue'))
    // A venue of this exact name already on the registry is that venue.
    return Storage.searchVenues(name, 10).then(function (found) {
      var twin = duplicateCandidates(found, name, null)[0]
      if (twin) { pickVenue(twin); return twin }
      var venue = newVenueDoc({ id: uuid(), name: name, pos: pos || null, uid: uid, at: now() })
      return Storage.createVenue(venue).then(function () {
        var ref = venueRef(venue)
        pickVenue(ref)
        return ref
      })
    })
  }, [pickVenue])

  // Someone else may have placed it since it was cached — the registry's
  // copy wins, and only a still-unplaced venue is placed here.
  var placeVenue = useCallback(function (v, pos) {
    if (!v || !v.id || !pos) return Promise.reject(new Error('Nothing to place'))
    return Storage.getVenue(v.id).then(function (current) {
      if (!current) throw new Error('This venue is no longer on the registry')
      if (typeof current.lat === 'number' && typeof current.lng === 'number') {
        var placed = venueRef(current)
        pickVenue(placed)
        return placed
      }
      return Storage.placeVenue(v.id, placedFields(pos, now())).then(function () {
        var ref = Object.assign(venueRef(current), { lat: pos.lat, lng: pos.lng })
        pickVenue(ref)
        return ref
      })
    })
  }, [pickVenue])

  var findNearby = useCallback(function (pos) {
    return Storage.findVenuesNear(pos).then(function (list) {
      return list.map(function (d) { return Object.assign(venueRef(d), { distance: d.distance }) })
    })
  }, [])

  var search = useCallback(function (text) {
    return Storage.searchVenues(text, 10).then(function (list) { return list.map(venueRef) })
  }, [])

  return {
    venues:        venues,
    locatedBefore: hasLocatedBefore(cache),
    pickVenue:     pickVenue,
    addVenue:      addVenue,
    placeVenue:    placeVenue,
    findNearby:    findNearby,
    search:        search,
  }
}
