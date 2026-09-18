/**
 * Saved venues — the places you have climbed, with where the phone was when
 * you saved the session there.
 *
 * The climb logger's location field was free text that remembered the last
 * venue on the guess that the next session is the same place. This replaces
 * the guess with a measurement: each saved climb session adds its venue name
 * to `profile.venues` with the coordinates it was saved at, and the next time
 * the logger opens it offers the venues nearest the phone as chips.
 *
 * Nothing here talks to a maps provider. The list only ever holds names the
 * athlete typed, so the first visit to a new wall is still typed; after that
 * it is a tap. Coordinates stay in the athlete's own profile and are never
 * part of the public profile (`buildPublicProfile` reads `profile.name` only).
 *
 * Pure — no React, no storage, so `storage.js` and the tests can use it.
 *
 * @typedef {{ lat: number, lng: number, accuracy?: number }} Position
 * @typedef {{ name: string, lat: number | null, lng: number | null, uses: number, lastUsed: string }} Venue
 */

/** A venue counts as "here" inside this radius. Bristol's walls are all a km
 *  or more apart; indoor Wi-Fi positioning is usually good to well under 100 m,
 *  so 300 m separates any two real venues and still forgives a poor fix. */
var NEARBY_METRES = 300

/** How many venues the profile keeps. Nobody climbs at more places than this;
 *  the cap only stops a typo-per-session log growing the profile document. */
var MAX_VENUES = 100

var EARTH_RADIUS_M = 6371000

function toRad(deg) { return (deg * Math.PI) / 180 }

/**
 * Great-circle distance between two positions, in metres (haversine).
 * @param {Position} a
 * @param {Position} b
 * @returns {number}
 */
function distanceMetres(a, b) {
  var dLat = toRad(b.lat - a.lat)
  var dLng = toRad(b.lng - a.lng)
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

/** Venue names match case-insensitively with the whitespace collapsed, so
 *  "redpoint  bristol" and "Redpoint Bristol" are one venue, not two. */
function venueKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function hasCoords(v) {
  return typeof v.lat === 'number' && typeof v.lng === 'number'
}

/**
 * Record a save at `name`. Upserts into `venues` and returns the new list —
 * the input is not mutated.
 *
 * With a position, the venue's coordinates move to it: the latest fix is
 * the best guess at where the wall is, and a first save with no position
 * (permission not asked yet) gets its coordinates from the next one. Without
 * a position the count and date still move, so the list stays a true
 * most-recent-first history whether or not location was on.
 *
 * @param {Venue[]} venues
 * @param {string} name       as typed; blank is ignored and the list returned as is
 * @param {Position | null} pos
 * @param {string} at         ISO timestamp of the save
 * @returns {Venue[]}
 */
function recordVenue(venues, name, pos, at) {
  var list = Array.isArray(venues) ? venues : []
  var clean = String(name || '').trim().replace(/\s+/g, ' ')
  if (!clean) return list

  var key = venueKey(clean)
  var existing = list.find(function (v) { return venueKey(v.name) === key })
  var next = {
    name:     existing ? existing.name : clean,
    lat:      pos ? pos.lat : (existing ? existing.lat : null),
    lng:      pos ? pos.lng : (existing ? existing.lng : null),
    uses:     (existing ? existing.uses : 0) + 1,
    lastUsed: at,
  }

  var rest = list.filter(function (v) { return venueKey(v.name) !== key })
  return [next].concat(rest)
    .sort(function (a, b) { return a.lastUsed > b.lastUsed ? -1 : a.lastUsed < b.lastUsed ? 1 : 0 })
    .slice(0, MAX_VENUES)
}

/**
 * The saved venues within `NEARBY_METRES` of `pos`, nearest first, each with
 * its `distance` in metres. Venues never saved with a position cannot be
 * near anything and are left out.
 *
 * @param {Venue[]} venues
 * @param {Position | null} pos
 * @param {number} [radius]  metres, default NEARBY_METRES
 * @returns {Array<Venue & { distance: number }>}
 */
function nearbyVenues(venues, pos, radius) {
  if (!pos || !Array.isArray(venues)) return []
  var r = typeof radius === 'number' ? radius : NEARBY_METRES
  return venues
    .filter(hasCoords)
    .map(function (v) { return Object.assign({}, v, { distance: distanceMetres(pos, v) }) })
    .filter(function (v) { return v.distance <= r })
    .sort(function (a, b) { return a.distance - b.distance })
}

/**
 * The one venue to prefill, or null. Only when exactly one saved venue is
 * within range: two within 300 m of each other is the case where a guess
 * would be wrong half the time, so the chips are offered and nothing is
 * filled in.
 *
 * @param {Array<Venue & { distance: number }>} nearby  from `nearbyVenues`
 * @returns {Venue | null}
 */
function suggestVenue(nearby) {
  return nearby && nearby.length === 1 ? nearby[0] : null
}

/**
 * "120 m" / "1.4 km" for a chip.
 * @param {number} metres
 * @returns {string}
 */
function formatDistance(metres) {
  if (metres < 1000) return Math.round(metres) + ' m'
  return (Math.round(metres / 100) / 10) + ' km'
}

/**
 * Whether the athlete has used location before — a saved venue carries
 * coordinates. The logger uses it to fetch a position on open without a tap,
 * so the chips are there before the field is reached. Until then the first
 * request only happens from the pin button, so nothing asks for permission
 * on page load.
 *
 * @param {Venue[]} venues
 * @returns {boolean}
 */
function hasLocatedBefore(venues) {
  return Array.isArray(venues) && venues.some(hasCoords)
}

export {
  NEARBY_METRES, MAX_VENUES,
  distanceMetres, venueKey, recordVenue, nearbyVenues, suggestVenue,
  formatDistance, hasLocatedBefore,
}
