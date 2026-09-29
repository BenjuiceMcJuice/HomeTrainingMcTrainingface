/**
 * Venues — the places people climb, as a shared registry.
 *
 * Until 2026-09-29 a venue was a string: the text typed into the climb
 * logger's location field, with a pair of coordinates hung off it in the
 * athlete's own profile and moved to wherever the phone was on every save.
 * That is why the chips felt random — a session saved from home walked the
 * wall to the house, and the fallback list was the five most recent names,
 * reordered after every session and holding spelling twins.
 *
 * Now a venue is a document in `venues/{id}`, readable by every signed-in
 * user: a name, a position fixed once by the person who added it standing
 * there, and an `admins` list for later (comps at a venue, a setters team).
 * A session carries `venueId` and keeps `location` as the display text. The
 * athlete's profile holds a small cache of the venues they use, with their
 * positions, so the chips work offline and cost no reads. Nothing here moves
 * a venue's position: it is set when the venue is added (or placed later, once,
 * if it was added without a fix) and never by a save.
 *
 * Three things the picker offers, cheapest first:
 *   1. the athlete's own venues — from the cache and the session log;
 *   2. registry venues near the phone that the athlete has never used;
 *   3. registry venues whose name starts with what is being typed.
 *
 * A typed name that is never added stays text on the session, private, as it
 * always was. Only the *Add as a shared venue* tap puts anything in the
 * registry — the deliberate act that keeps a home wall out of a public list.
 *
 * Pure — no React, no storage. `storage.js` and the tests use it.
 *
 * @typedef {{ lat: number, lng: number, accuracy?: number }} Position
 *
 * A venue in the registry (`venues/{id}`).
 * @typedef {{
 *   id: string, name: string, nameKey: string,
 *   lat: number | null, lng: number | null, geohash: string | null,
 *   createdBy: string, createdAt: string, updatedAt: string,
 *   admins: string[], schemaVersion: number,
 * }} VenueDoc
 *
 * What the athlete's profile caches about a venue they use (`profile.venues`).
 * @typedef {{ id: string, name: string, lat: number | null, lng: number | null }} VenueRef
 *
 * A chip: a venue as the picker offers it. `id` is null for a name that only
 * exists as text on old sessions — never added to the registry.
 * @typedef {{ id: string | null, name: string, lat: number | null, lng: number | null, uses: number, lastUsed: string }} Venue
 */

export var VENUE_SCHEMA_VERSION = 1

/** A venue counts as "here" inside this radius. Bristol's walls are all a km
 *  or more apart; indoor Wi-Fi positioning is usually good to well under 100 m,
 *  so 300 m separates any two real venues and still forgives a poor fix. */
export var NEARBY_METRES = 300

/** How many of the athlete's own venues the picker offers before typing. */
export var OWN_CHIPS = 8

/** How many venues the profile caches. Nobody climbs at more places than this. */
export var MAX_CACHED = 100

/** A venue name on the registry is at most this long (the rules check it too). */
export var MAX_NAME_LENGTH = 80

/** Geohash precision stored on a venue (9 chars ≈ 5 m cells) and the shorter
 *  prefix the nearby query runs on (6 chars ≈ 1.2 km × 0.6 km cells). */
export var GEOHASH_PRECISION = 9
export var GEOHASH_QUERY_PRECISION = 6

var EARTH_RADIUS_M = 6371000

function toRad(deg) { return (deg * Math.PI) / 180 }

/**
 * Great-circle distance between two positions, in metres (haversine).
 * @param {Position} a
 * @param {Position} b
 * @returns {number}
 */
export function distanceMetres(a, b) {
  var dLat = toRad(b.lat - a.lat)
  var dLng = toRad(b.lng - a.lng)
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

/** A name as stored: trimmed, inner whitespace collapsed. */
export function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ')
}

/** Venue names match case-insensitively with the whitespace collapsed, so
 *  "redpoint  bristol" and "Redpoint Bristol" are one venue, not two. */
export function venueKey(name) {
  return cleanName(name).toLowerCase()
}

export function hasCoords(v) {
  return !!v && typeof v.lat === 'number' && typeof v.lng === 'number'
}

// ---------------------------------------------------------------------------
// Geohash — so "venues near here" is one prefix query on Firestore, which has
// no geoqueries of its own. Standard base-32 geohash; nothing clever.
// ---------------------------------------------------------------------------

var BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

/**
 * @param {number} lat
 * @param {number} lng
 * @param {number} [precision]  default GEOHASH_PRECISION
 * @returns {string}
 */
export function geohashEncode(lat, lng, precision) {
  var p = typeof precision === 'number' ? precision : GEOHASH_PRECISION
  var latRange = [-90, 90], lngRange = [-180, 180]
  var hash = '', bits = 0, bit = 0, even = true
  while (hash.length < p) {
    var range = even ? lngRange : latRange
    var value = even ? lng : lat
    var mid = (range[0] + range[1]) / 2
    if (value >= mid) { bit = (bit << 1) | 1; range[0] = mid }
    else              { bit = bit << 1;       range[1] = mid }
    even = !even
    if (++bits === 5) { hash += BASE32.charAt(bit); bits = 0; bit = 0 }
  }
  return hash
}

/**
 * The prefix cells a nearby query needs: the cell the position is in, and any
 * neighbouring cell the radius reaches into. Found by encoding the centre and
 * the eight points around the bounding box — with a radius far smaller than a
 * cell that is one to four cells, never more.
 *
 * @param {Position} pos
 * @param {number} [radius]     metres, default NEARBY_METRES
 * @param {number} [precision]  default GEOHASH_QUERY_PRECISION
 * @returns {string[]}  sorted, unique
 */
export function geohashCells(pos, radius, precision) {
  var r = typeof radius === 'number' ? radius : NEARBY_METRES
  var p = typeof precision === 'number' ? precision : GEOHASH_QUERY_PRECISION
  var dLat = (r / EARTH_RADIUS_M) * (180 / Math.PI)
  var cosLat = Math.max(Math.cos(toRad(pos.lat)), 1e-6)
  var dLng = dLat / cosLat
  var cells = {}
  ;[-1, 0, 1].forEach(function (i) {
    ;[-1, 0, 1].forEach(function (j) {
      var lat = Math.max(-90, Math.min(90, pos.lat + i * dLat))
      var lng = pos.lng + j * dLng
      if (lng > 180) lng -= 360
      if (lng < -180) lng += 360
      cells[geohashEncode(lat, lng, p)] = true
    })
  })
  return Object.keys(cells).sort()
}

// ---------------------------------------------------------------------------
// Registry documents
// ---------------------------------------------------------------------------

/**
 * A new registry document. With a position the venue is placed there for
 * good; without one it is added unplaced and can be placed once, later, by
 * whoever is standing at it (`placedFields`).
 *
 * @param {{ id: string, name: string, pos: Position | null, uid: string, at: string }} f
 * @returns {VenueDoc}
 */
export function newVenueDoc(f) {
  var name = cleanName(f.name)
  var placed = !!(f.pos && typeof f.pos.lat === 'number' && typeof f.pos.lng === 'number')
  return {
    id: f.id,
    name: name,
    nameKey: venueKey(name),
    lat: placed ? f.pos.lat : null,
    lng: placed ? f.pos.lng : null,
    geohash: placed ? geohashEncode(f.pos.lat, f.pos.lng) : null,
    createdBy: f.uid,
    createdAt: f.at,
    updatedAt: f.at,
    admins: [],
    schemaVersion: VENUE_SCHEMA_VERSION,
  }
}

/**
 * The fields that place an unplaced venue — the only update anyone but an
 * admin may make, and only from null (the rules say so too).
 * @param {Position} pos
 * @param {string} at
 */
export function placedFields(pos, at) {
  return { lat: pos.lat, lng: pos.lng, geohash: geohashEncode(pos.lat, pos.lng), updatedAt: at }
}

/** What the profile caches about a venue. @param {VenueDoc | VenueRef} v @returns {VenueRef} */
export function venueRef(v) {
  return { id: v.id, name: v.name, lat: hasCoords(v) ? v.lat : null, lng: hasCoords(v) ? v.lng : null }
}

/**
 * Whether a name may go on the registry: not blank, not longer than the rules
 * allow. Returns the reason, or null.
 * @param {string} name
 * @returns {string | null}
 */
export function nameProblem(name) {
  var clean = cleanName(name)
  if (!clean) return 'Type a name first'
  if (clean.length > MAX_NAME_LENGTH) return 'Keep the name under ' + MAX_NAME_LENGTH + ' characters'
  return null
}

/**
 * Among `docs` (registry results), the ones a new venue called `name` at
 * `pos` would duplicate: the same name, or within range. The picker offers
 * these instead of adding. Nearest first when a position is known.
 *
 * @param {Array<VenueDoc | VenueRef>} docs
 * @param {string} name
 * @param {Position | null} pos
 * @returns {Array<VenueRef & { distance?: number }>}
 */
export function duplicateCandidates(docs, name, pos) {
  var key = venueKey(name)
  var out = []
  ;(docs || []).forEach(function (d) {
    if (!d || !d.id) return
    var sameName = venueKey(d.name) === key
    var dist = pos && hasCoords(d) ? distanceMetres(pos, d) : null
    if (sameName || (dist !== null && dist <= NEARBY_METRES)) {
      var ref = venueRef(d)
      if (dist !== null) ref.distance = dist
      out.push(ref)
    }
  })
  return out.sort(function (a, b) {
    var da = typeof a.distance === 'number' ? a.distance : Infinity
    var db = typeof b.distance === 'number' ? b.distance : Infinity
    return da - db
  })
}

// ---------------------------------------------------------------------------
// The cache — `profile.venues`
// ---------------------------------------------------------------------------

/**
 * The cache with `v` in it, first. A venue already there is refreshed (a
 * rename, a placing) rather than added twice. Capped. Input not mutated.
 * @param {VenueRef[]} cache
 * @param {VenueDoc | VenueRef} v
 * @returns {VenueRef[]}
 */
export function cacheVenue(cache, v) {
  var list = Array.isArray(cache) ? cache : []
  if (!v || !v.id) return list
  var ref = venueRef(v)
  return [ref].concat(list.filter(function (c) { return c && c.id !== ref.id })).slice(0, MAX_CACHED)
}

/**
 * The cache as the profile should hold it. Entries from before the registry
 * (a name with coordinates and no id — the position the phone had at some
 * save, which is exactly the data that went wrong) are dropped; the names
 * are still in the session log. Idempotent.
 * @param {any} cache
 * @returns {VenueRef[]}
 */
export function migrateVenueCache(cache) {
  if (!Array.isArray(cache)) return []
  return cache.filter(function (v) { return v && typeof v.id === 'string' && v.id && typeof v.name === 'string' })
    .map(venueRef).slice(0, MAX_CACHED)
}

/**
 * Whether the athlete has a placed venue — the logger asks for a fix on open
 * only then, so no page ever asks for permission before the pin was tapped.
 * @param {VenueRef[]} cache
 * @returns {boolean}
 */
export function hasLocatedBefore(cache) {
  return Array.isArray(cache) && cache.some(hasCoords)
}

// ---------------------------------------------------------------------------
// The athlete's own venues — from the session log
// ---------------------------------------------------------------------------

/** The venue text a session was logged at: on the session, or on its climbs
 *  for sessions from before it moved up. */
export function sessionLocation(s) {
  if (!s) return ''
  if (s.location) return String(s.location)
  var withLoc = (s.climbs || []).filter(function (c) { return c && c.location })
  return withLoc.length ? String(withLoc[0].location) : ''
}

/**
 * The venues in the session log: one per `venueId`, and one per distinct
 * location text among sessions with no `venueId` (logged before the registry,
 * or typed and never added), with how many sessions and the latest date.
 * The name kept for a text-only venue is its most recent spelling; for a
 * registry venue the cache's, else the latest session's. Most used first,
 * then most recent.
 *
 * @param {Array<{ date?: string, venueId?: string | null, location?: string | null, climbs?: Array<{ location?: string | null }> }>} sessions
 * @returns {Venue[]}
 */
export function venuesFromSessions(sessions) {
  if (!Array.isArray(sessions)) return []
  var byKey = {}
  sessions.forEach(function (s) {
    if (!s) return
    var clean = cleanName(sessionLocation(s))
    var id = typeof s.venueId === 'string' && s.venueId ? s.venueId : null
    if (!id && !clean) return
    var key  = id ? 'id:' + id : 'name:' + venueKey(clean)
    var date = String(s.date || '')
    var cur  = byKey[key]
    if (!cur) {
      byKey[key] = { id: id, name: clean, lat: null, lng: null, uses: 1, lastUsed: date }
      return
    }
    cur.uses += 1
    if (date > cur.lastUsed) { cur.lastUsed = date; if (clean) cur.name = clean }
  })
  return sortVenues(Object.keys(byKey).map(function (k) { return byKey[k] }))
}

function sortVenues(list) {
  return list.sort(function (a, b) {
    if (b.uses !== a.uses) return b.uses - a.uses
    if (a.lastUsed !== b.lastUsed) return a.lastUsed > b.lastUsed ? -1 : 1
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
}

/**
 * The cache and the session log's venues as one list of chips. A registry
 * venue takes its name and position from the cache; a text-only venue whose
 * name matches a cached venue is folded into it (its sessions are linked on
 * the next pick — `legacySessionIds`); a cached venue with no sessions yet
 * is still offered. Most used first.
 *
 * @param {VenueRef[]} cache          `profile.venues`
 * @param {Venue[]} fromSessions      from `venuesFromSessions`
 * @returns {Venue[]}
 */
export function mergeVenues(cache, fromSessions) {
  var byId = {}, byName = {}
  var out = []
  ;(Array.isArray(cache) ? cache : []).forEach(function (c) {
    if (!c || !c.id) return
    var v = { id: c.id, name: c.name, lat: hasCoords(c) ? c.lat : null, lng: hasCoords(c) ? c.lng : null, uses: 0, lastUsed: '' }
    byId[c.id] = v
    byName[venueKey(c.name)] = v
    out.push(v)
  })
  var textOnly = []
  ;(Array.isArray(fromSessions) ? fromSessions : []).forEach(function (s) {
    if (!s) return
    var target = s.id ? byId[s.id] : byName[venueKey(s.name)]
    if (target) {
      target.uses += s.uses || 0
      if ((s.lastUsed || '') > target.lastUsed) target.lastUsed = s.lastUsed
      return
    }
    if (s.id) {
      // Linked on a session but not cached — another device picked it. Offer
      // it by name; the position arrives when it is picked again.
      var v = { id: s.id, name: s.name, lat: null, lng: null, uses: s.uses || 0, lastUsed: s.lastUsed || '' }
      byId[s.id] = v
      out.push(v)
      return
    }
    textOnly.push({ id: null, name: s.name, lat: null, lng: null, uses: s.uses || 0, lastUsed: s.lastUsed || '' })
  })
  return sortVenues(out.concat(textOnly))
}

/**
 * The ids of the sessions that carry `venue`'s name as text and no venueId —
 * logged before the registry, or typed and not yet added. Picking or adding
 * the venue links them, so the log has one venue where it had two spellings
 * of the same one. Exact name match only: *Redpoint* is not linked to
 * *Redpoint Bristol* by guesswork (BTL-B60 is where a person says so).
 *
 * @param {Array<{ id: string, venueId?: string | null, location?: string | null, climbs?: Array }>} sessions
 * @param {{ name: string }} venue
 * @returns {string[]}
 */
export function legacySessionIds(sessions, venue) {
  if (!Array.isArray(sessions) || !venue) return []
  var key = venueKey(venue.name)
  if (!key) return []
  return sessions.filter(function (s) {
    return s && !s.venueId && venueKey(sessionLocation(s)) === key
  }).map(function (s) { return s.id })
}

// ---------------------------------------------------------------------------
// What the picker offers
// ---------------------------------------------------------------------------

/**
 * The first few of the athlete's own venues — the chips before anything is
 * typed or located. Most used first, as `mergeVenues` orders them.
 * @param {Venue[]} venues
 * @param {number} [limit]  default OWN_CHIPS
 * @returns {Venue[]}
 */
export function topVenues(venues, limit) {
  if (!Array.isArray(venues)) return []
  return venues.slice(0, typeof limit === 'number' ? limit : OWN_CHIPS)
}

/**
 * The venues within `NEARBY_METRES` of `pos`, nearest first, each with its
 * `distance` in metres. Unplaced venues cannot be near anything.
 * @template {{ lat: number | null, lng: number | null }} T
 * @param {T[]} venues
 * @param {Position | null} pos
 * @param {number} [radius]  metres, default NEARBY_METRES
 * @returns {Array<T & { distance: number }>}
 */
export function nearbyVenues(venues, pos, radius) {
  if (!pos || !Array.isArray(venues)) return []
  var r = typeof radius === 'number' ? radius : NEARBY_METRES
  return venues
    .filter(hasCoords)
    .map(function (v) { return Object.assign({}, v, { distance: distanceMetres(pos, v) }) })
    .filter(function (v) { return v.distance <= r })
    .sort(function (a, b) { return a.distance - b.distance })
}

/**
 * The one venue to prefill, or null. Only when exactly one is within range:
 * two within 300 m of each other is the case where a guess would be wrong
 * half the time, so the chips are offered and nothing is filled in.
 * @template T
 * @param {T[]} nearby  from `nearbyVenues`
 * @returns {T | null}
 */
export function suggestVenue(nearby) {
  return nearby && nearby.length === 1 ? nearby[0] : null
}

/**
 * The athlete's own venues whose name contains what is being typed.
 * @param {Venue[]} venues
 * @param {string} text
 * @returns {Venue[]}
 */
export function matchVenues(venues, text) {
  var key = venueKey(text)
  if (!key || !Array.isArray(venues)) return []
  return venues.filter(function (v) { return venueKey(v.name).indexOf(key) !== -1 })
}

/**
 * Whether the typed text names a venue not on the registry among `chips`,
 * so the picker should offer to add it. Blank, or an exact match for a
 * registry chip, means no. A match for a text-only chip (a name from old
 * sessions, never added) still means yes: adding it is how those sessions
 * get linked.
 * @param {string} text
 * @param {Array<{ id: string | null, name: string }>} chips
 * @returns {boolean}
 */
export function isNewName(text, chips) {
  var key = venueKey(text)
  if (!key) return false
  return !(chips || []).some(function (c) { return c && c.id && venueKey(c.name) === key })
}

/**
 * "120 m" / "1.4 km" for a chip.
 * @param {number} metres
 * @returns {string}
 */
export function formatDistance(metres) {
  if (metres < 1000) return Math.round(metres) + ' m'
  return (Math.round(metres / 100) / 10) + ' km'
}
