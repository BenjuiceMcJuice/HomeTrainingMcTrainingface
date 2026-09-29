import { describe, it, expect } from 'vitest'
import {
  WALLS, NEARBY_METRES, OWN_CHIPS,
  distanceMetres, cleanName, venueKey, hasCoords, nameProblem,
  wallRef, wallById, findWall, wallsNear, searchWalls, migrateSessionVenue,
  sessionLocation, venuesFromSessions,
  topVenues, nearbyVenues, suggestVenue, matchVenues, formatDistance,
  sessionInRow, relinkSessions, renameSessions, venueRows,
} from '../venues'

// A small table of the same shape as walls.json. Two Bristol walls a couple
// of km apart, one in Cardiff, and a spot 80 m from Redpoint.
var REDPOINT   = { lat: 51.4557, lng: -2.5623 }
var FLASHPOINT = { lat: 51.4412, lng: -2.5942 }
var BY_REDPOINT = { lat: 51.4564, lng: -2.5626 }
var WALLS_T = [
  { id: 'redpoint-bristol',   name: 'Redpoint Bristol',   city: 'Bristol', lat: REDPOINT.lat,   lng: REDPOINT.lng,   aka: ['Redpoint', 'Redpoint bristol'] },
  { id: 'flashpoint-bristol', name: 'Flashpoint Bristol', city: 'Bristol', lat: FLASHPOINT.lat, lng: FLASHPOINT.lng, aka: ['Flashpoint'] },
  { id: 'boulders-cardiff',   name: 'Boulders',           city: 'Cardiff', lat: 51.4894,        lng: -3.1560 },
]

describe('the shipped table', function () {
  it('is a list of walls with ids, names, cities and positions', function () {
    expect(Array.isArray(WALLS)).toBe(true)
    expect(WALLS.length).toBeGreaterThan(0)
    WALLS.forEach(function (w) {
      expect(typeof w.id).toBe('string')
      expect(typeof w.name).toBe('string')
      expect(typeof w.city).toBe('string')
      expect(hasCoords(w)).toBe(true)
    })
  })

  it('has no duplicate ids, and no spelling that is also another wall\'s', function () {
    var ids = WALLS.map(function (w) { return w.id })
    expect(new Set(ids).size).toBe(ids.length)
    var keys = {}
    WALLS.forEach(function (w) {
      [w.name].concat(w.aka || []).forEach(function (n) {
        var k = venueKey(n)
        expect(keys[k] === undefined || keys[k] === w.id, n + ' is on two walls').toBe(true)
        keys[k] = w.id
      })
    })
  })

  it('keeps every pair of walls further apart than the nearby radius', function () {
    for (var i = 0; i < WALLS.length; i++) for (var j = i + 1; j < WALLS.length; j++) {
      expect(distanceMetres(WALLS[i], WALLS[j])).toBeGreaterThan(NEARBY_METRES)
    }
  })
})

describe('distanceMetres', function () {
  it('is zero for the same point, symmetric, and roughly right', function () {
    expect(distanceMetres(REDPOINT, REDPOINT)).toBe(0)
    var d = distanceMetres(REDPOINT, FLASHPOINT)
    expect(d).toBeCloseTo(distanceMetres(FLASHPOINT, REDPOINT), 6)
    expect(d).toBeGreaterThan(2500)
    expect(d).toBeLessThan(3000)
    var h = distanceMetres(REDPOINT, BY_REDPOINT)
    expect(h).toBeGreaterThan(60)
    expect(h).toBeLessThan(100)
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
    expect(nameProblem('x'.repeat(81))).toMatch(/under 80/)
    expect(nameProblem('My loft wall')).toBeNull()
  })
})

describe('the walls table', function () {
  it('wallById finds a wall, and nothing for a registry-era uuid', function () {
    expect(wallById('redpoint-bristol', WALLS_T).name).toBe('Redpoint Bristol')
    expect(wallById('6e4fe94d-225c-492c-8919-273fbb70b3dc', WALLS_T)).toBeNull()
    expect(wallById(null, WALLS_T)).toBeNull()
  })

  it('findWall matches the name or a spelling the table lists, by key — never a prefix', function () {
    expect(findWall('redpoint bristol', WALLS_T).id).toBe('redpoint-bristol')
    expect(findWall('  REDPOINT ', WALLS_T).id).toBe('redpoint-bristol')
    expect(findWall('Flashpoint', WALLS_T).id).toBe('flashpoint-bristol')
    expect(findWall('Flashpoint bristol', WALLS_T).id).toBe('flashpoint-bristol')   // the name itself, by key
    expect(findWall('Flash', WALLS_T)).toBeNull()
    expect(findWall('My loft wall', WALLS_T)).toBeNull()
    expect(findWall('', WALLS_T)).toBeNull()
  })

  it('wallsNear is the walls inside the radius, nearest first, with distances', function () {
    var out = wallsNear(BY_REDPOINT, WALLS_T)
    expect(out.map(function (w) { return w.id })).toEqual(['redpoint-bristol'])
    expect(out[0].distance).toBeLessThan(NEARBY_METRES)
    expect(wallsNear({ lat: 51.50, lng: -2.60 }, WALLS_T)).toEqual([])
    expect(wallsNear(null, WALLS_T)).toEqual([])
  })

  it('searchWalls matches any part of the name, the city or a spelling', function () {
    expect(searchWalls('point', WALLS_T).map(function (w) { return w.id })).toEqual(['redpoint-bristol', 'flashpoint-bristol'])
    expect(searchWalls('cardiff', WALLS_T).map(function (w) { return w.id })).toEqual(['boulders-cardiff'])
    expect(searchWalls('fla', WALLS_T).map(function (w) { return w.id })).toEqual(['flashpoint-bristol'])
    expect(searchWalls('  ', WALLS_T)).toEqual([])
  })

  it('wallRef is what a session and the picker get', function () {
    expect(wallRef(WALLS_T[0])).toEqual({ id: 'redpoint-bristol', name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng })
  })
})

describe('migrateSessionVenue', function () {
  var climb = { id: 'c1', grade: 'V3', location: 'Redpoint bristol' }

  it('links a text-only session whose name is a wall\'s spelling, on the session and its climbs', function () {
    var out = migrateSessionVenue({ id: 's1', location: 'Redpoint bristol', climbs: [climb] }, WALLS_T)
    expect(out).toEqual({ id: 's1', venueId: 'redpoint-bristol', location: 'Redpoint Bristol', climbs: [{ id: 'c1', grade: 'V3', location: 'Redpoint Bristol' }] })
  })

  it('reads the name off the climbs for a session from before it moved up', function () {
    var out = migrateSessionVenue({ id: 's1', location: null, climbs: [climb] }, WALLS_T)
    expect(out.venueId).toBe('redpoint-bristol')
    expect(out.location).toBe('Redpoint Bristol')
  })

  it('drops a registry-era id that is not a wall, keeping the text; links it if the text is a wall\'s', function () {
    var kept = migrateSessionVenue({ id: 's1', venueId: '6e4fe94d-225c-492c-8919-273fbb70b3dc', location: 'The Depot', climbs: [] }, WALLS_T)
    expect(kept).toEqual({ id: 's1', venueId: null, location: 'The Depot', climbs: [] })
    var linked = migrateSessionVenue({ id: 's1', venueId: '6e4fe94d-225c-492c-8919-273fbb70b3dc', location: 'Redpoint', climbs: [] }, WALLS_T)
    expect(linked.venueId).toBe('redpoint-bristol')
  })

  it('leaves a linked session, a place, a blank and a non-object alone — the same object back', function () {
    var linked = { id: 's1', venueId: 'redpoint-bristol', location: 'Redpoint Bristol', climbs: [] }
    expect(migrateSessionVenue(linked, WALLS_T)).toBe(linked)
    var place = { id: 's2', location: 'My loft wall', climbs: [] }
    expect(migrateSessionVenue(place, WALLS_T)).toBe(place)
    var blank = { id: 's3', location: null, climbs: [] }
    expect(migrateSessionVenue(blank, WALLS_T)).toBe(blank)
    expect(migrateSessionVenue(null, WALLS_T)).toBeNull()
  })

  it('does not stamp a climb that never carried a location', function () {
    var out = migrateSessionVenue({ id: 's1', location: 'Redpoint', climbs: [{ id: 'c1', grade: 'V3' }] }, WALLS_T)
    expect(out.climbs[0]).toEqual({ id: 'c1', grade: 'V3' })
  })
})

describe('venuesFromSessions', function () {
  var sessions = [
    { id: 's1', date: '2026-09-16', location: 'Redpoint Bristol', venueId: 'redpoint-bristol' },
    { id: 's2', date: '2026-09-10', location: 'My loft wall' },
    { id: 's3', date: '2026-09-02', location: 'Redpoint Bristol', venueId: 'redpoint-bristol' },
    { id: 's4', date: '2026-08-20', location: null, climbs: [{ location: 'my  loft wall' }] },
    { id: 's5', date: '2026-08-15', location: '', climbs: [{}] },
    { id: 's6', date: '2026-08-10', type: 'gym' },
  ]

  it('is empty for nothing', function () {
    expect(venuesFromSessions([], WALLS_T)).toEqual([])
    expect(venuesFromSessions(null, WALLS_T)).toEqual([])
  })

  it('one row per wall with the table\'s name and position, one per place with its latest spelling, most used first', function () {
    expect(venuesFromSessions(sessions, WALLS_T)).toEqual([
      { id: 'redpoint-bristol', name: 'Redpoint Bristol', city: 'Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng, uses: 2, lastUsed: '2026-09-16' },
      { id: null, name: 'My loft wall', lat: null, lng: null, uses: 2, lastUsed: '2026-09-10' },
    ])
  })

  it('sessionLocation reads the location off the climbs for a session from before it moved up', function () {
    expect(sessionLocation({ climbs: [{ location: 'The Depot' }] })).toBe('The Depot')
    expect(sessionLocation({ location: 'Flashpoint', climbs: [{ location: 'The Depot' }] })).toBe('Flashpoint')
    expect(sessionLocation(null)).toBe('')
  })

  it('orders by uses, then by the latest date, then by name', function () {
    var out = venuesFromSessions([
      { date: '2026-09-01', location: 'B' }, { date: '2026-09-01', location: 'A' },
      { date: '2026-09-03', location: 'C' },
    ], WALLS_T)
    expect(out.map(function (v) { return v.name })).toEqual(['C', 'A', 'B'])
  })
})

describe('what the picker offers', function () {
  var venues = [
    { id: 'redpoint-bristol',   name: 'Redpoint Bristol',   lat: REDPOINT.lat,   lng: REDPOINT.lng,   uses: 9, lastUsed: '2026-09-16' },
    { id: 'flashpoint-bristol', name: 'Flashpoint Bristol', lat: FLASHPOINT.lat, lng: FLASHPOINT.lng, uses: 3, lastUsed: '2026-09-10' },
    { id: null, name: 'My loft wall', lat: null, lng: null, uses: 1, lastUsed: '2026-09-01' },
  ]

  it('nearbyVenues is the entries with a position inside the radius, nearest first', function () {
    var out = nearbyVenues(venues, BY_REDPOINT)
    expect(out.map(function (v) { return v.id })).toEqual(['redpoint-bristol'])
    expect(out[0].distance).toBeLessThan(NEARBY_METRES)
    expect(nearbyVenues(venues, BY_REDPOINT, 1e9).map(function (v) { return v.id })).toEqual(['redpoint-bristol', 'flashpoint-bristol'])
    expect(nearbyVenues(venues, null)).toEqual([])
    expect(venues[0].distance).toBeUndefined()
  })

  it('suggestVenue offers the only nearby wall, nothing when two are near', function () {
    var v = { id: 'a', name: 'A', distance: 80 }
    expect(suggestVenue([v])).toBe(v)
    expect(suggestVenue([v, { id: 'b', name: 'B', distance: 120 }])).toBeNull()
    expect(suggestVenue([])).toBeNull()
    expect(suggestVenue(null)).toBeNull()
  })

  it('topVenues is the first few — the most used', function () {
    var list = []
    for (var i = 0; i < OWN_CHIPS + 3; i++) list.push({ id: null, name: 'Place ' + i })
    expect(topVenues(list).length).toBe(OWN_CHIPS)
    expect(topVenues(list)[0].name).toBe('Place 0')
    expect(topVenues(list, 2).length).toBe(2)
    expect(topVenues(null)).toEqual([])
  })

  it('matchVenues finds the athlete\'s venues by any part of the name', function () {
    expect(matchVenues(venues, 'point').map(function (v) { return v.name })).toEqual(['Redpoint Bristol', 'Flashpoint Bristol'])
    expect(matchVenues(venues, 'LOFT').map(function (v) { return v.name })).toEqual(['My loft wall'])
    expect(matchVenues(venues, '  ')).toEqual([])
  })

  it('formatDistance reads metres under a kilometre and kilometres to one decimal from 1 km', function () {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(84.6)).toBe('85 m')
    expect(formatDistance(999)).toBe('999 m')
    expect(formatDistance(1000)).toBe('1 km')
    expect(formatDistance(1449)).toBe('1.4 km')
  })
})

// ---------------------------------------------------------------------------
// Settings › Locations — the tidy-up list, on the shape of Ben's export:
// two spellings for one wall, a place, two venue-less climb sessions, a comp.
// ---------------------------------------------------------------------------

describe('the tidy-up list', function () {
  var RED = wallRef(WALLS_T[0])
  function climb(loc) { return { id: 'c', grade: 'V3', location: loc } }
  var sessions = [
    { id: 's1', type: 'climb', date: '2026-09-16', location: 'Redpoint Bristol', venueId: 'redpoint-bristol', climbs: [climb('Redpoint Bristol')] },
    { id: 's2', type: 'climb', date: '2026-09-12', location: 'Red Point', climbs: [climb('Red Point')] },
    { id: 's3', type: 'climb', date: '2026-09-10', location: 'red point', climbs: [climb('red point')] },
    { id: 's4', type: 'climb', date: '2026-09-08', location: 'My loft wall', climbs: [climb('My loft wall')] },
    { id: 's5', type: 'climb', date: '2026-09-06', location: null, climbs: [climb(null)] },
    { id: 's6', type: 'climb', date: '2026-09-05', location: '', climbs: [] },
    { id: 's7', type: 'gym', date: '2026-09-04', location: null, climbs: [] },
    { id: 's8', type: 'climb', date: '2026-09-02', location: 'Red Point', venueId: null, comp: { code: 'CP-1' }, climbs: [climb('Red Point')] },
  ]

  it('sessionInRow — by place key, by wall id, the venue-less climb sessions; never a comp session', function () {
    expect(sessions.filter(function (s) { return sessionInRow(s, { key: 'red point' }) }).map(function (s) { return s.id })).toEqual(['s2', 's3'])
    expect(sessions.filter(function (s) { return sessionInRow(s, { id: 'redpoint-bristol' }) }).map(function (s) { return s.id })).toEqual(['s1'])
    expect(sessions.filter(function (s) { return sessionInRow(s, { key: '' }) }).map(function (s) { return s.id })).toEqual(['s5', 's6'])
    expect(sessionInRow(sessions[7], { key: 'red point' })).toBe(false)
    expect(sessionInRow(null, { key: 'red point' })).toBe(false)
  })

  it('relinkSessions links a place to a wall: the id, the wall\'s name on the session and on every climb', function () {
    var out = relinkSessions(sessions, { key: 'red point' }, RED)
    expect(out.map(function (u) { return u.id })).toEqual(['s2', 's3'])
    expect(out[0].fields).toEqual({ venueId: 'redpoint-bristol', location: 'Redpoint Bristol', climbs: [{ id: 'c', grade: 'V3', location: 'Redpoint Bristol' }] })
  })

  it('relinkSessions moves a wall\'s sessions to another, skips ones already there, and gives the venue-less ones a wall', function () {
    var FLASH = wallRef(WALLS_T[1])
    expect(relinkSessions(sessions, { id: 'redpoint-bristol' }, FLASH).map(function (u) { return u.id })).toEqual(['s1'])
    expect(relinkSessions(sessions, { id: 'redpoint-bristol' }, RED)).toEqual([])
    expect(relinkSessions(sessions, { key: '' }, RED).map(function (u) { return u.id })).toEqual(['s5', 's6'])
    expect(relinkSessions(sessions, { key: 'red point' }, { id: null, name: 'x' })).toEqual([])
    expect(relinkSessions(null, { key: 'red point' }, RED)).toEqual([])
  })

  it('renameSessions renames the place sessions and their climbs, still a place; refuses blank', function () {
    var out = renameSessions(sessions, 'red point', '  Redpoint  Wall ')
    expect(out.map(function (u) { return u.id })).toEqual(['s2', 's3'])
    expect(out[1].fields).toEqual({ venueId: null, location: 'Redpoint Wall', climbs: [{ id: 'c', grade: 'V3', location: 'Redpoint Wall' }] })
    expect(renameSessions(sessions, 'red point', '  ')).toEqual([])
  })

  it('venueRows: one row per venue with status, counts and the comp count; a No location row last', function () {
    var rows = venueRows(sessions, WALLS_T)
    expect(rows.map(function (r) { return [r.name, r.status, r.uses, r.comps] })).toEqual([
      ['Red Point', 'place', 3, 1],           // s2, s3 and the comp session s8 — most used first
      ['Redpoint Bristol', 'wall', 1, 0],
      ['My loft wall', 'place', 1, 0],
      ['', 'none', 2, 0],
    ])
    expect(rows[0].from).toEqual({ key: 'red point' })
    expect(rows[1].from).toEqual({ id: 'redpoint-bristol' })
    expect(rows[3].from).toEqual({ key: '' })
    expect(venueRows([], WALLS_T)).toEqual([])
  })
})
