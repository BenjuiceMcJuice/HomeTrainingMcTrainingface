/**
 * Where you climbed — the walls table, and your own places.
 *
 * A **wall** is a row in `walls.json`, shipped with the app: a name, a city,
 * a position, and the other spellings people use for it (`aka`). Nobody adds
 * to it from the app; a missing wall is feedback and a commit. Because the
 * positions come from the data, the pin suggests a wall on the first visit,
 * for everyone, and nothing is ever placed or moved from a phone.
 *
 * A **place** is anything typed that is not a wall — *my loft wall*, *Avon
 * Gorge*. It is text on the session, private, and offered back as a chip
 * from the athlete's own log. There is no add step: typing it once is enough.
 *
 * A session carries `venueId` (a wall's id, or null) and `location` (the
 * wall's name, or the typed place). Old sessions carrying one of a wall's
 * spellings are linked to it on load (`migrateSessionVenue`), so the
 * athlete's history joins the table without a tap.
 *
 * History: 2026-09-18 a per-user list with coordinates moved on every save;
 * 2026-09-29 a shared registry anyone could add to and place; the same
 * evening, this — Ben: *"I just want it to be super simple for people. No
 * pins and shared locations."* (`docs/specs/betalog_walls_spec.md`).
 *
 * Pure — no React, no storage. `storage.js` and the tests use it.
 *
 * @typedef {{ lat: number, lng: number, accuracy?: number }} Position
 *
 * A row of the walls table.
 * @typedef {{ id: string, name: string, city: string, lat: number, lng: number, source?: string, aka?: string[] }} Wall
 *
 * A chip: a wall or a place as the picker offers it. `id` is null for a place.
 * @typedef {{ id: string | null, name: string, city?: string, lat: number | null, lng: number | null, uses: number, lastUsed: string }} Venue
 *
 * What a picked venue hands back: a wall's id and name, or a place's name alone.
 * @typedef {{ id: string | null, name: string, lat?: number | null, lng?: number | null }} VenueRef
 */

import WALLS_JSON from './walls.json'

/** The walls table, as shipped. Tests pass their own. @type {Wall[]} */
export var WALLS = Array.isArray(WALLS_JSON) ? WALLS_JSON : []

/** A wall counts as "here" inside this radius. Bristol's walls are all a km
 *  or more apart; indoor Wi-Fi positioning is usually good to well under 100 m,
 *  so 300 m separates any two real walls and still forgives a poor fix. */
export var NEARBY_METRES = 300

/** How many of the athlete's own venues the picker offers before typing. */
export var OWN_CHIPS = 8

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

/** Names match case-insensitively with the whitespace collapsed, so
 *  "redpoint  bristol" and "Redpoint Bristol" are one place, not two. */
export function venueKey(name) {
  return cleanName(name).toLowerCase()
}

export function hasCoords(v) {
  return !!v && typeof v.lat === 'number' && typeof v.lng === 'number'
}

/**
 * Whether a name may be kept on a session: not blank, not absurdly long.
 * Returns the reason, or null.
 * @param {string} name
 * @returns {string | null}
 */
export function nameProblem(name) {
  var clean = cleanName(name)
  if (!clean) return 'Type a name first'
  if (clean.length > 80) return 'Keep the name under 80 characters'
  return null
}

// ---------------------------------------------------------------------------
// The walls table
// ---------------------------------------------------------------------------

/** What a wall hands the session and the picker. @param {Wall} w @returns {VenueRef} */
export function wallRef(w) {
  return { id: w.id, name: w.name, lat: w.lat, lng: w.lng }
}

/**
 * The wall with this id, or null.
 * @param {string | null | undefined} id
 * @param {Wall[]} [walls]
 * @returns {Wall | null}
 */
export function wallById(id, walls) {
  if (!id) return null
  var list = walls || WALLS
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]
  return null
}

/**
 * The wall a name means — its own name or one of its `aka` spellings, by
 * key. The table says which spellings are the same wall; nothing guesses.
 * @param {string} name
 * @param {Wall[]} [walls]
 * @returns {Wall | null}
 */
export function findWall(name, walls) {
  var key = venueKey(name)
  if (!key) return null
  var list = walls || WALLS
  for (var i = 0; i < list.length; i++) {
    var w = list[i]
    if (venueKey(w.name) === key) return w
    if ((w.aka || []).some(function (a) { return venueKey(a) === key })) return w
  }
  return null
}

/**
 * The walls within `NEARBY_METRES` of `pos`, nearest first, each with its
 * `distance` in metres.
 * @param {Position | null} pos
 * @param {Wall[]} [walls]
 * @param {number} [radius]
 * @returns {Array<Wall & { distance: number }>}
 */
export function wallsNear(pos, walls, radius) {
  return nearbyVenues(walls || WALLS, pos, radius)
}

/**
 * The walls whose name, city or a spelling contains the typed text.
 * @param {string} text
 * @param {Wall[]} [walls]
 * @returns {Wall[]}
 */
export function searchWalls(text, walls) {
  var key = venueKey(text)
  if (!key) return []
  return (walls || WALLS).filter(function (w) {
    if (venueKey(w.name).indexOf(key) !== -1) return true
    if (venueKey(w.city).indexOf(key) !== -1) return true
    return (w.aka || []).some(function (a) { return venueKey(a).indexOf(key) !== -1 })
  })
}

/**
 * A session's venue fields as the table would have them. A `venueId` that
 * is a wall keeps it; one that is not (the 2026-09-29 registry's uuids) is
 * dropped; and a text-only session whose name is a wall's, or one of its
 * spellings, is linked to it and takes the wall's name — on the session and
 * on each climb. Returns the session itself when nothing changes, so
 * `Storage.load` can run it on every session, every time.
 *
 * @template T
 * @param {T & { venueId?: string | null, location?: string | null, climbs?: Array }} s
 * @param {Wall[]} [walls]
 * @returns {T}
 */
export function migrateSessionVenue(s, walls) {
  if (!s || typeof s !== 'object') return s
  var list = walls || WALLS
  var current = s.venueId ? wallById(s.venueId, list) : null
  if (current) return s
  var wall = findWall(sessionLocation(s), list)
  if (!wall) {
    if (!s.venueId) return s
    return Object.assign({}, s, { venueId: null })
  }
  if (s.venueId === wall.id && s.location === wall.name) return s
  return Object.assign({}, s, {
    venueId:  wall.id,
    location: wall.name,
    climbs:   Array.isArray(s.climbs) ? s.climbs.map(function (c) { return c && c.location != null ? Object.assign({}, c, { location: wall.name }) : c }) : s.climbs,
  })
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
 * The venues in the session log: one per wall (`venueId`), and one per
 * distinct place text among sessions with no `venueId`, with how many
 * sessions and the latest date. A wall carries the table's name and
 * position; a place its most recent spelling. Most used first, then most
 * recent.
 *
 * @param {Array<{ date?: string, venueId?: string | null, location?: string | null, climbs?: Array }>} sessions
 * @param {Wall[]} [walls]
 * @returns {Venue[]}
 */
export function venuesFromSessions(sessions, walls) {
  if (!Array.isArray(sessions)) return []
  var byKey = {}
  sessions.forEach(function (s) {
    if (!s) return
    var wall = s.venueId ? wallById(s.venueId, walls) : null
    var clean = cleanName(sessionLocation(s))
    if (!wall && !clean) return
    var key  = wall ? 'id:' + wall.id : 'name:' + venueKey(clean)
    var date = String(s.date || '')
    var cur  = byKey[key]
    if (!cur) {
      byKey[key] = wall
        ? { id: wall.id, name: wall.name, city: wall.city, lat: wall.lat, lng: wall.lng, uses: 1, lastUsed: date }
        : { id: null, name: clean, lat: null, lng: null, uses: 1, lastUsed: date }
      return
    }
    cur.uses += 1
    if (date > cur.lastUsed) { cur.lastUsed = date; if (!wall && clean) cur.name = clean }
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

// ---------------------------------------------------------------------------
// What the picker offers
// ---------------------------------------------------------------------------

/**
 * The first few of the athlete's own venues — the chips before anything is
 * typed or located. Most used first, as `venuesFromSessions` orders them.
 * @param {Venue[]} venues
 * @param {number} [limit]  default OWN_CHIPS
 * @returns {Venue[]}
 */
export function topVenues(venues, limit) {
  if (!Array.isArray(venues)) return []
  return venues.slice(0, typeof limit === 'number' ? limit : OWN_CHIPS)
}

/**
 * The entries within `NEARBY_METRES` of `pos`, nearest first, each with its
 * `distance` in metres. Entries with no position cannot be near anything.
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
 * "120 m" / "1.4 km" for a chip.
 * @param {number} metres
 * @returns {string}
 */
export function formatDistance(metres) {
  if (metres < 1000) return Math.round(metres) + ' m'
  return (Math.round(metres / 100) / 10) + ' km'
}

// ---------------------------------------------------------------------------
// Settings › Locations — the tidy-up list (betalog_venue_manager_spec.md)
// ---------------------------------------------------------------------------

/**
 * Whether a session belongs to the list row `from`: `{ id }` a wall's
 * sessions; `{ key }` a place's (sessions with no venueId whose text has that
 * key); `{ key: '' }` the climb sessions with no venue at all. Comp sessions
 * never belong — the comp owns their venue.
 * @param {Object} s
 * @param {{ id?: string | null, key?: string }} from
 * @returns {boolean}
 */
export function sessionInRow(s, from) {
  if (!s || s.comp) return false
  if (from && from.id) return s.venueId === from.id
  var key = from ? (from.key || '') : ''
  if (s.venueId) return false
  var loc = venueKey(sessionLocation(s))
  if (!key) return s.type === 'climb' && !loc
  return loc === key
}

function stamped(s, venueId, name) {
  return {
    venueId:  venueId,
    location: name,
    climbs:   (s.climbs || []).map(function (c) { return Object.assign({}, c, { location: name }) }),
  }
}

/**
 * Link every session in row `from` to the wall `to`: the id, the wall's
 * name as the text, and the same name on each climb. Returns the updates to
 * apply, one per session — `useSessions.applySessionUpdates` writes them in
 * one save.
 *
 * @param {Object[]} sessions
 * @param {{ id?: string | null, key?: string }} from
 * @param {VenueRef} to
 * @returns {Array<{ id: string, fields: Object }>}
 */
export function relinkSessions(sessions, from, to) {
  if (!Array.isArray(sessions) || !to || !to.id) return []
  var name = cleanName(to.name)
  return sessions.filter(function (s) { return sessionInRow(s, from) && !(s.venueId === to.id && s.location === name) })
    .map(function (s) { return { id: s.id, fields: stamped(s, to.id, name) } })
}

/**
 * Give the place sessions with `key` a new name — still a place. A new name
 * that is a wall's is a link instead (`findWall` first; the sheet does).
 * Blank is refused (`nameProblem`).
 *
 * @param {Object[]} sessions
 * @param {string} key
 * @param {string} newName
 * @returns {Array<{ id: string, fields: Object }>}
 */
export function renameSessions(sessions, key, newName) {
  if (!Array.isArray(sessions) || nameProblem(newName)) return []
  var name = cleanName(newName)
  return sessions.filter(function (s) { return sessionInRow(s, { key: key }) && s.location !== name })
    .map(function (s) { return { id: s.id, fields: stamped(s, null, name) } })
}

/**
 * The list's rows: the athlete's venues as `venuesFromSessions` orders them,
 * each with a status — `wall` (in the table) or `place` (your own text) —
 * how many of its sessions are comp sessions (counted, never rewritten), and
 * a `from` for the actions; plus a `none` row when any climb session has no
 * venue.
 *
 * @param {Object[]} sessions
 * @param {Wall[]} [walls]
 * @returns {Array<Venue & { status: 'wall' | 'place' | 'none', comps: number, from: { id?: string | null, key?: string } }>}
 */
export function venueRows(sessions, walls) {
  var list = Array.isArray(sessions) ? sessions : []
  var comps = {}
  var none = 0, noneComps = 0
  list.forEach(function (s) {
    if (!s) return
    var wall = s.venueId ? wallById(s.venueId, walls) : null
    var loc = venueKey(sessionLocation(s))
    if (!wall && !loc) {
      if (s.type === 'climb') { none += 1; if (s.comp) noneComps += 1 }
      return
    }
    if (!s.comp) return
    var k = wall ? 'id:' + wall.id : 'name:' + loc
    comps[k] = (comps[k] || 0) + 1
  })
  var rows = venuesFromSessions(list, walls).map(function (v) {
    return Object.assign({}, v, {
      status: v.id ? 'wall' : 'place',
      comps:  comps[v.id ? 'id:' + v.id : 'name:' + venueKey(v.name)] || 0,
      from:   v.id ? { id: v.id } : { key: venueKey(v.name) },
    })
  })
  if (none) {
    rows.push({ id: null, name: '', lat: null, lng: null, uses: none, lastUsed: '', status: 'none', comps: noneComps, from: { key: '' } })
  }
  return rows
}
