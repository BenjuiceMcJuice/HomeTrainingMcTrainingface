import { describe, it, expect } from 'vitest'
import {
  NEARBY_METRES, OWN_CHIPS, MAX_CACHED, MAX_NAME_LENGTH, GEOHASH_PRECISION, GEOHASH_QUERY_PRECISION, VENUE_SCHEMA_VERSION,
  distanceMetres, cleanName, venueKey, hasCoords,
  geohashEncode, geohashCells,
  newVenueDoc, placedFields, venueRef, nameProblem, duplicateCandidates,
  cacheVenue, migrateVenueCache, hasLocatedBefore,
  sessionLocation, venuesFromSessions, mergeVenues, legacySessionIds,
  topVenues, nearbyVenues, suggestVenue, matchVenues, isNewName, formatDistance,
} from '../venues'

// Two real Bristol walls, a couple of km apart, and a spot 80 m from one.
var REDPOINT   = { lat: 51.4557, lng: -2.5623 }
var FLASHPOINT = { lat: 51.4412, lng: -2.5942 }
var BY_REDPOINT = { lat: 51.4564, lng: -2.5626 }

var T1 = '2026-09-18T10:00:00.000Z'

describe('distanceMetres', function () {
  it('is zero for the same point', function () {
    expect(distanceMetres(REDPOINT, REDPOINT)).toBe(0)
  })

  it('is symmetric and roughly right for a known separation', function () {
    var d = distanceMetres(REDPOINT, FLASHPOINT)
    expect(d).toBeCloseTo(distanceMetres(FLASHPOINT, REDPOINT), 6)
    // ~1.6 km north-south, ~2.2 km east-west → about 2.7 km
    expect(d).toBeGreaterThan(2500)
    expect(d).toBeLessThan(3000)
  })

  it('reads a short hop in tens of metres', function () {
    var d = distanceMetres(REDPOINT, BY_REDPOINT)
    expect(d).toBeGreaterThan(60)
    expect(d).toBeLessThan(100)
  })
})

describe('names', function () {
  it('venueKey ignores case and stray whitespace', function () {
    expect(venueKey('  Redpoint   Bristol ')).toBe('redpoint bristol')
    expect(venueKey('REDPOINT bristol')).toBe(venueKey('Redpoint Bristol'))
    expect(venueKey('')).toBe('')
    expect(venueKey(null)).toBe('')
  })

  it('cleanName keeps the case and collapses the whitespace', function () {
    expect(cleanName('  Redpoint   Bristol ')).toBe('Redpoint Bristol')
    expect(cleanName(undefined)).toBe('')
  })

  it('nameProblem refuses a blank or an over-long name and nothing else', function () {
    expect(nameProblem('   ')).toBe('Type a name first')
    expect(nameProblem('x'.repeat(MAX_NAME_LENGTH + 1))).toMatch(/under 80/)
    expect(nameProblem('x'.repeat(MAX_NAME_LENGTH))).toBeNull()
    expect(nameProblem('Redpoint Bristol')).toBeNull()
  })

  it('hasCoords wants two numbers', function () {
    expect(hasCoords({ lat: 1, lng: 2 })).toBe(true)
    expect(hasCoords({ lat: null, lng: 2 })).toBe(false)
    expect(hasCoords(null)).toBe(false)
  })
})

describe('geohash', function () {
  it('encodes a known point to the standard hash', function () {
    // The reference example from the geohash spec.
    expect(geohashEncode(42.6, -5.6, 5)).toBe('ezs42')
    expect(geohashEncode(57.64911, 10.40744, 11)).toBe('u4pruydqqvj')
  })

  it('is 9 characters by default, and the query prefix is the first 6', function () {
    var h = geohashEncode(REDPOINT.lat, REDPOINT.lng)
    expect(h).toHaveLength(GEOHASH_PRECISION)
    expect(GEOHASH_QUERY_PRECISION).toBeLessThan(GEOHASH_PRECISION)
    expect(h.slice(0, GEOHASH_QUERY_PRECISION)).toBe(geohashEncode(REDPOINT.lat, REDPOINT.lng, GEOHASH_QUERY_PRECISION))
  })

  it('two points 80 m apart share the query prefix, or are in cells the query covers', function () {
    var cells = geohashCells(BY_REDPOINT)
    var wall = geohashEncode(REDPOINT.lat, REDPOINT.lng)
    expect(cells.some(function (c) { return wall.indexOf(c) === 0 })).toBe(true)
  })

  it('a 300 m radius reaches one to four cells, sorted and unique', function () {
    var cells = geohashCells(REDPOINT)
    expect(cells.length).toBeGreaterThanOrEqual(1)
    expect(cells.length).toBeLessThanOrEqual(4)
    expect(cells.slice().sort()).toEqual(cells)
    expect(new Set(cells).size).toBe(cells.length)
    cells.forEach(function (c) { expect(c).toHaveLength(GEOHASH_QUERY_PRECISION) })
  })

  it('a wall 2.7 km away is not in the cells around the other', function () {
    var cells = geohashCells(REDPOINT)
    var flash = geohashEncode(FLASHPOINT.lat, FLASHPOINT.lng)
    expect(cells.some(function (c) { return flash.indexOf(c) === 0 })).toBe(false)
  })

  it('copes with the poles and the date line', function () {
    expect(geohashCells({ lat: 89.999, lng: 179.999 }).length).toBeGreaterThan(0)
    expect(geohashCells({ lat: -89.999, lng: -179.999 }).length).toBeGreaterThan(0)
  })
})

describe('newVenueDoc', function () {
  it('is placed when added with a position — name cleaned, key set, nobody as admin', function () {
    var d = newVenueDoc({ id: 'v1', name: '  Redpoint   Bristol ', pos: REDPOINT, uid: 'u1', at: T1 })
    expect(d).toEqual({
      id: 'v1', name: 'Redpoint Bristol', nameKey: 'redpoint bristol',
      lat: REDPOINT.lat, lng: REDPOINT.lng, geohash: geohashEncode(REDPOINT.lat, REDPOINT.lng),
      createdBy: 'u1', createdAt: T1, updatedAt: T1, admins: [], schemaVersion: VENUE_SCHEMA_VERSION,
    })
  })

  it('is unplaced when added without one', function () {
    var d = newVenueDoc({ id: 'v1', name: 'Flashpoint', pos: null, uid: 'u1', at: T1 })
    expect(d.lat).toBeNull()
    expect(d.lng).toBeNull()
    expect(d.geohash).toBeNull()
  })

  it('placedFields is the position, its hash and the time — nothing else', function () {
    expect(placedFields(REDPOINT, T1)).toEqual({ lat: REDPOINT.lat, lng: REDPOINT.lng, geohash: geohashEncode(REDPOINT.lat, REDPOINT.lng), updatedAt: T1 })
  })

  it('venueRef is what the profile caches', function () {
    var d = newVenueDoc({ id: 'v1', name: 'Redpoint Bristol', pos: REDPOINT, uid: 'u1', at: T1 })
    expect(venueRef(d)).toEqual({ id: 'v1', name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng })
    expect(venueRef({ id: 'v2', name: 'Flashpoint', lat: null, lng: null, extra: 1 })).toEqual({ id: 'v2', name: 'Flashpoint', lat: null, lng: null })
  })
})

describe('duplicateCandidates', function () {
  var docs = [
    { id: 'v1', name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng },
    { id: 'v2', name: 'Flashpoint', lat: FLASHPOINT.lat, lng: FLASHPOINT.lng },
    { id: 'v3', name: 'The Depot', lat: null, lng: null },
  ]

  it('offers a venue of the same name, wherever it is', function () {
    expect(duplicateCandidates(docs, 'redpoint  bristol', null).map(function (v) { return v.id })).toEqual(['v1'])
    expect(duplicateCandidates(docs, 'the depot', FLASHPOINT).map(function (v) { return v.id })).toEqual(['v2', 'v3'])
  })

  it('offers a venue within range of the position, nearest first, with the distance', function () {
    var out = duplicateCandidates(docs, 'Brand new wall', BY_REDPOINT)
    expect(out.map(function (v) { return v.id })).toEqual(['v1'])
    expect(out[0].distance).toBeLessThan(NEARBY_METRES)
  })

  it('offers nothing for a new name away from everything', function () {
    expect(duplicateCandidates(docs, 'Brand new wall', null)).toEqual([])
    expect(duplicateCandidates([], 'Redpoint Bristol', REDPOINT)).toEqual([])
  })
})

describe('the cache', function () {
  var red = { id: 'v1', name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng }

  it('cacheVenue puts the venue first, once, capped', function () {
    var c = cacheVenue([], red)
    expect(c).toEqual([red])
    c = cacheVenue(c, { id: 'v2', name: 'Flashpoint', lat: null, lng: null })
    expect(c.map(function (v) { return v.id })).toEqual(['v2', 'v1'])
    c = cacheVenue(c, Object.assign({}, red, { name: 'Redpoint' }))
    expect(c.map(function (v) { return v.name })).toEqual(['Redpoint', 'Flashpoint'])
    expect(cacheVenue(c, null)).toBe(c)
    var big = []
    for (var i = 0; i < MAX_CACHED + 5; i++) big = cacheVenue(big, { id: 'v' + i, name: 'W' + i, lat: null, lng: null })
    expect(big).toHaveLength(MAX_CACHED)
  })

  it('migrateVenueCache drops the pre-registry entries (a name with the phone\'s position) and keeps refs', function () {
    var old = [{ name: 'Redpoint', lat: 51.5, lng: -2.6, uses: 3, lastUsed: T1 }]
    expect(migrateVenueCache(old)).toEqual([])
    expect(migrateVenueCache(old.concat([red]))).toEqual([red])
    expect(migrateVenueCache(undefined)).toEqual([])
    expect(migrateVenueCache([{ id: 'v9', name: 'Unplaced', lat: null, lng: null, stray: true }])).toEqual([{ id: 'v9', name: 'Unplaced', lat: null, lng: null }])
  })

  it('hasLocatedBefore is true once any cached venue is placed', function () {
    expect(hasLocatedBefore([{ id: 'a', name: 'A', lat: null, lng: null }])).toBe(false)
    expect(hasLocatedBefore([{ id: 'a', name: 'A', lat: null, lng: null }, red])).toBe(true)
    expect(hasLocatedBefore([])).toBe(false)
    expect(hasLocatedBefore(undefined)).toBe(false)
  })
})

describe('venuesFromSessions', function () {
  var sessions = [
    { id: 's1', date: '2026-09-16', location: 'Redpoint bristol' },
    { id: 's2', date: '2026-09-10', location: 'Flashpoint', venueId: 'v2' },
    { id: 's3', date: '2026-09-02', location: 'Redpoint Bristol' },
    { id: 's4', date: '2026-08-20', location: null, climbs: [{ location: 'Flashpoint' }, { location: 'Flashpoint' }] },
    { id: 's5', date: '2026-08-15', location: '', climbs: [{}] },
    { id: 's6', date: '2026-08-10', type: 'gym' },
  ]

  it('is empty for nothing', function () {
    expect(venuesFromSessions([])).toEqual([])
    expect(venuesFromSessions(null)).toEqual([])
  })

  it('groups by venueId when linked, else by name, most used first', function () {
    var out = venuesFromSessions(sessions)
    expect(out).toEqual([
      { id: null, name: 'Redpoint bristol', lat: null, lng: null, uses: 2, lastUsed: '2026-09-16' },
      { id: 'v2', name: 'Flashpoint',       lat: null, lng: null, uses: 1, lastUsed: '2026-09-10' },
      { id: null, name: 'Flashpoint',       lat: null, lng: null, uses: 1, lastUsed: '2026-08-20' },
    ])
  })

  it('sessionLocation reads the location off the climbs for a session from before it moved up', function () {
    expect(sessionLocation({ climbs: [{ location: 'The Depot' }] })).toBe('The Depot')
    expect(sessionLocation({ location: 'Flashpoint', climbs: [{ location: 'The Depot' }] })).toBe('Flashpoint')
    expect(sessionLocation(null)).toBe('')
  })

  it('keeps the most recent spelling of a text-only venue', function () {
    var out = venuesFromSessions([
      { date: '2026-09-01', location: 'redpoint  bristol' },
      { date: '2026-09-05', location: 'Redpoint Bristol' },
    ])
    expect(out).toEqual([{ id: null, name: 'Redpoint Bristol', lat: null, lng: null, uses: 2, lastUsed: '2026-09-05' }])
  })

  it('orders by uses, then by the latest date, then by name', function () {
    var out = venuesFromSessions([
      { date: '2026-09-01', location: 'B' }, { date: '2026-09-01', location: 'A' },
      { date: '2026-09-03', location: 'C' },
    ])
    expect(out.map(function (v) { return v.name })).toEqual(['C', 'A', 'B'])
  })
})

describe('mergeVenues', function () {
  var cache = [{ id: 'v1', name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng }]
  var fromLog = [
    { id: null, name: 'Redpoint bristol', lat: null, lng: null, uses: 4, lastUsed: '2026-09-16' },
    { id: null, name: 'Flashpoint',       lat: null, lng: null, uses: 3, lastUsed: '2026-09-10' },
  ]

  it('folds a text-only venue into the cached venue of the same name, keeping the cache\'s spelling and position', function () {
    var out = mergeVenues(cache, fromLog)
    expect(out).toEqual([
      { id: 'v1', name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng, uses: 4, lastUsed: '2026-09-16' },
      { id: null, name: 'Flashpoint', lat: null, lng: null, uses: 3, lastUsed: '2026-09-10' },
    ])
  })

  it('a linked session adds its uses to the cached venue by id', function () {
    var out = mergeVenues(cache, [{ id: 'v1', name: 'Redpoint', lat: null, lng: null, uses: 2, lastUsed: '2026-09-20' }])
    expect(out).toEqual([{ id: 'v1', name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng, uses: 2, lastUsed: '2026-09-20' }])
  })

  it('a venue linked on a session but not cached — picked on another device — is offered by name without a position', function () {
    var out = mergeVenues([], [{ id: 'v7', name: 'The Depot', lat: null, lng: null, uses: 1, lastUsed: '2026-09-20' }])
    expect(out).toEqual([{ id: 'v7', name: 'The Depot', lat: null, lng: null, uses: 1, lastUsed: '2026-09-20' }])
  })

  it('a cached venue with no sessions yet is still offered', function () {
    expect(mergeVenues(cache, [])).toEqual([{ id: 'v1', name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng, uses: 0, lastUsed: '' }])
  })

  it('copes with either side missing and does not mutate', function () {
    expect(mergeVenues(null, fromLog).map(function (v) { return v.name })).toEqual(['Redpoint bristol', 'Flashpoint'])
    expect(mergeVenues(null, null)).toEqual([])
    var a = JSON.parse(JSON.stringify(cache)), b = JSON.parse(JSON.stringify(fromLog))
    mergeVenues(cache, fromLog)
    expect(cache).toEqual(a)
    expect(fromLog).toEqual(b)
  })

  it('a text-only wall becomes a nearby chip once it is on the registry and cached', function () {
    expect(nearbyVenues(mergeVenues(cache, fromLog), FLASHPOINT)).toEqual([])
    var after = mergeVenues(cacheVenue(cache, { id: 'v2', name: 'Flashpoint', lat: FLASHPOINT.lat, lng: FLASHPOINT.lng }), fromLog)
    expect(nearbyVenues(after, FLASHPOINT).map(function (v) { return v.id })).toEqual(['v2'])
  })
})

describe('legacySessionIds', function () {
  var sessions = [
    { id: 's1', location: 'Redpoint bristol' },
    { id: 's2', location: 'Redpoint Bristol', venueId: 'v1' },
    { id: 's3', location: null, climbs: [{ location: 'redpoint  bristol' }] },
    { id: 's4', location: 'Redpoint' },
    { id: 's5', type: 'gym' },
  ]

  it('is the unlinked sessions carrying the exact name — not a prefix', function () {
    expect(legacySessionIds(sessions, { id: 'v1', name: 'Redpoint Bristol' })).toEqual(['s1', 's3'])
    expect(legacySessionIds(sessions, { id: 'v9', name: 'Redpoint' })).toEqual(['s4'])
  })

  it('is empty for nothing', function () {
    expect(legacySessionIds(sessions, { name: '' })).toEqual([])
    expect(legacySessionIds(null, { name: 'Redpoint' })).toEqual([])
  })
})

describe('what the picker offers', function () {
  var venues = [
    { id: 'v1', name: 'Redpoint Bristol', lat: REDPOINT.lat,   lng: REDPOINT.lng,   uses: 9, lastUsed: T1 },
    { id: 'v2', name: 'Flashpoint',       lat: FLASHPOINT.lat, lng: FLASHPOINT.lng, uses: 3, lastUsed: T1 },
    { id: null, name: 'Somewhere typed',  lat: null,           lng: null,           uses: 1, lastUsed: T1 },
  ]

  it('nearbyVenues is the placed venues inside the radius, nearest first, with distances', function () {
    var out = nearbyVenues(venues, BY_REDPOINT)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('v1')
    expect(out[0].distance).toBeLessThan(NEARBY_METRES)
    expect(nearbyVenues(venues, BY_REDPOINT, 1e9).map(function (v) { return v.id })).toEqual(['v1', 'v2'])
    expect(nearbyVenues(venues, null)).toEqual([])
    expect(nearbyVenues(undefined, BY_REDPOINT)).toEqual([])
    expect(venues[0].distance).toBeUndefined()
  })

  it('suggestVenue offers the only nearby venue, nothing when two are near', function () {
    var v = { id: 'v1', name: 'Redpoint Bristol', distance: 80 }
    expect(suggestVenue([v])).toBe(v)
    expect(suggestVenue([v, { id: 'v2', name: 'B', distance: 120 }])).toBeNull()
    expect(suggestVenue([])).toBeNull()
    expect(suggestVenue(null)).toBeNull()
  })

  it('topVenues is the first few — the most used', function () {
    var list = []
    for (var i = 0; i < OWN_CHIPS + 3; i++) list.push({ id: 'v' + i, name: 'Wall ' + i })
    expect(topVenues(list).length).toBe(OWN_CHIPS)
    expect(topVenues(list)[0].name).toBe('Wall 0')
    expect(topVenues(list, 2).length).toBe(2)
    expect(topVenues(null)).toEqual([])
  })

  it('matchVenues finds the athlete\'s venues by any part of the name', function () {
    expect(matchVenues(venues, 'point').map(function (v) { return v.name })).toEqual(['Redpoint Bristol', 'Flashpoint'])
    expect(matchVenues(venues, 'TYPED').map(function (v) { return v.name })).toEqual(['Somewhere typed'])
    expect(matchVenues(venues, '  ')).toEqual([])
  })

  it('isNewName is true for a typed name that is not a registry chip — a text-only chip of that name still gets the Add', function () {
    expect(isNewName('The Depot', venues)).toBe(true)
    expect(isNewName('flashpoint', venues)).toBe(false)
    expect(isNewName('somewhere typed', venues)).toBe(true)
    expect(isNewName('  ', venues)).toBe(false)
    expect(isNewName('X', [])).toBe(true)
  })
})

describe('formatDistance', function () {
  it('rounds metres under a kilometre', function () {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(84.6)).toBe('85 m')
    expect(formatDistance(999)).toBe('999 m')
  })

  it('reads kilometres to one decimal from 1 km', function () {
    expect(formatDistance(1000)).toBe('1 km')
    expect(formatDistance(1449)).toBe('1.4 km')
    expect(formatDistance(2680)).toBe('2.7 km')
  })
})
