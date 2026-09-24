import { describe, it, expect } from 'vitest'
import {
  NEARBY_METRES, MAX_VENUES, RECENT_CHIPS,
  distanceMetres, venueKey, recordVenue, nearbyVenues, suggestVenue,
  venuesFromSessions, mergeVenues, recentVenues,
  formatDistance, hasLocatedBefore,
} from '../venues'

// Two real Bristol walls, a couple of km apart, and a spot 80 m from one.
var REDPOINT   = { lat: 51.4557, lng: -2.5623 }
var FLASHPOINT = { lat: 51.4412, lng: -2.5942 }
var BY_REDPOINT = { lat: 51.4564, lng: -2.5626 }

var T1 = '2026-09-18T10:00:00.000Z'
var T2 = '2026-09-18T12:00:00.000Z'

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

describe('venueKey', function () {
  it('ignores case and stray whitespace', function () {
    expect(venueKey('  Redpoint   Bristol ')).toBe('redpoint bristol')
    expect(venueKey('REDPOINT bristol')).toBe(venueKey('Redpoint Bristol'))
  })

  it('is empty for nothing', function () {
    expect(venueKey('')).toBe('')
    expect(venueKey(null)).toBe('')
  })
})

describe('recordVenue', function () {
  it('adds a new venue with its position, one use, and the save time', function () {
    var out = recordVenue([], 'Redpoint Bristol', REDPOINT, T1)
    expect(out).toEqual([{ name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng, uses: 1, lastUsed: T1 }])
  })

  it('does not mutate the input', function () {
    var input = []
    recordVenue(input, 'Redpoint Bristol', REDPOINT, T1)
    expect(input).toEqual([])
  })

  it('ignores a blank name', function () {
    var list = [{ name: 'Flashpoint', lat: null, lng: null, uses: 1, lastUsed: T1 }]
    expect(recordVenue(list, '   ', REDPOINT, T2)).toBe(list)
    expect(recordVenue(list, '', REDPOINT, T2)).toBe(list)
  })

  it('trims and collapses the typed name', function () {
    var out = recordVenue([], '  Redpoint   Bristol ', null, T1)
    expect(out[0].name).toBe('Redpoint Bristol')
  })

  it('bumps an existing venue by case-insensitive name and keeps its first spelling', function () {
    var list = recordVenue([], 'Redpoint Bristol', REDPOINT, T1)
    var out  = recordVenue(list, 'redpoint bristol', null, T2)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Redpoint Bristol')
    expect(out[0].uses).toBe(2)
    expect(out[0].lastUsed).toBe(T2)
  })

  it('keeps the old coordinates when saved without a position', function () {
    var list = recordVenue([], 'Redpoint Bristol', REDPOINT, T1)
    var out  = recordVenue(list, 'Redpoint Bristol', null, T2)
    expect(out[0].lat).toBe(REDPOINT.lat)
    expect(out[0].lng).toBe(REDPOINT.lng)
  })

  it('fills in coordinates for a venue first saved without any', function () {
    var list = recordVenue([], 'Redpoint Bristol', null, T1)
    expect(list[0].lat).toBeNull()
    var out = recordVenue(list, 'Redpoint Bristol', REDPOINT, T2)
    expect(out[0].lat).toBe(REDPOINT.lat)
    expect(out[0].lng).toBe(REDPOINT.lng)
  })

  it('moves the coordinates to the latest fix', function () {
    var list = recordVenue([], 'Redpoint Bristol', REDPOINT, T1)
    var out  = recordVenue(list, 'Redpoint Bristol', BY_REDPOINT, T2)
    expect(out[0].lat).toBe(BY_REDPOINT.lat)
  })

  it('orders most recently used first', function () {
    var list = recordVenue([], 'Redpoint Bristol', REDPOINT, T1)
    list = recordVenue(list, 'Flashpoint', FLASHPOINT, T2)
    expect(list.map(function (v) { return v.name })).toEqual(['Flashpoint', 'Redpoint Bristol'])
    list = recordVenue(list, 'Redpoint Bristol', null, '2026-09-19T09:00:00.000Z')
    expect(list.map(function (v) { return v.name })).toEqual(['Redpoint Bristol', 'Flashpoint'])
  })

  it('caps the list at MAX_VENUES, dropping the least recently used', function () {
    var list = []
    for (var i = 0; i < MAX_VENUES + 5; i++) {
      list = recordVenue(list, 'Venue ' + i, null, new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString())
    }
    expect(list).toHaveLength(MAX_VENUES)
    expect(list[0].name).toBe('Venue ' + (MAX_VENUES + 4))
    expect(list.some(function (v) { return v.name === 'Venue 0' })).toBe(false)
  })

  it('treats a non-array as empty', function () {
    expect(recordVenue(undefined, 'Redpoint Bristol', null, T1)).toHaveLength(1)
  })
})

describe('nearbyVenues', function () {
  var venues = [
    { name: 'Flashpoint',       lat: FLASHPOINT.lat, lng: FLASHPOINT.lng, uses: 3, lastUsed: T2 },
    { name: 'Redpoint Bristol', lat: REDPOINT.lat,   lng: REDPOINT.lng,   uses: 9, lastUsed: T1 },
    { name: 'Somewhere typed',  lat: null,           lng: null,           uses: 1, lastUsed: T1 },
  ]

  it('returns only venues inside the radius, nearest first, with distances', function () {
    var out = nearbyVenues(venues, BY_REDPOINT)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Redpoint Bristol')
    expect(out[0].distance).toBeLessThan(NEARBY_METRES)
  })

  it('leaves out venues with no coordinates', function () {
    var out = nearbyVenues(venues, BY_REDPOINT, 1e9)
    expect(out.map(function (v) { return v.name })).toEqual(['Redpoint Bristol', 'Flashpoint'])
  })

  it('is empty with no position or no list', function () {
    expect(nearbyVenues(venues, null)).toEqual([])
    expect(nearbyVenues(undefined, BY_REDPOINT)).toEqual([])
  })

  it('does not attach a distance to the stored list', function () {
    nearbyVenues(venues, BY_REDPOINT)
    expect(venues[1].distance).toBeUndefined()
  })
})

describe('suggestVenue', function () {
  it('offers the only nearby venue', function () {
    var v = { name: 'Redpoint Bristol', distance: 80 }
    expect(suggestVenue([v])).toBe(v)
  })

  it('offers nothing when two venues are both near — the chips decide', function () {
    expect(suggestVenue([{ name: 'A', distance: 50 }, { name: 'B', distance: 120 }])).toBeNull()
  })

  it('offers nothing with nothing near', function () {
    expect(suggestVenue([])).toBeNull()
    expect(suggestVenue(null)).toBeNull()
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

describe('hasLocatedBefore', function () {
  it('is true once any venue carries coordinates', function () {
    expect(hasLocatedBefore([{ name: 'A', lat: null, lng: null }])).toBe(false)
    expect(hasLocatedBefore([{ name: 'A', lat: null, lng: null }, { name: 'B', lat: 1, lng: 2 }])).toBe(true)
  })

  it('is false for nothing', function () {
    expect(hasLocatedBefore([])).toBe(false)
    expect(hasLocatedBefore(undefined)).toBe(false)
  })
})

describe('venuesFromSessions', function () {
  var sessions = [
    { date: '2026-09-16', location: 'Redpoint bristol' },
    { date: '2026-09-10', location: 'Flashpoint' },
    { date: '2026-09-02', location: 'Redpoint Bristol' },
    { date: '2026-08-20', location: null, climbs: [{ location: 'Flashpoint' }, { location: 'Flashpoint' }] },
    { date: '2026-08-15', location: '', climbs: [{}] },
    { date: '2026-08-10', type: 'gym' },
  ]

  it('is empty for nothing', function () {
    expect(venuesFromSessions([])).toEqual([])
    expect(venuesFromSessions(null)).toEqual([])
  })

  it('counts one venue per distinct name, most recent first, with no coordinates', function () {
    var out = venuesFromSessions(sessions)
    expect(out.map(function (v) { return v.name })).toEqual(['Redpoint bristol', 'Flashpoint'])
    expect(out[0]).toEqual({ name: 'Redpoint bristol', lat: null, lng: null, uses: 2, lastUsed: '2026-09-16' })
    expect(out[1]).toEqual({ name: 'Flashpoint', lat: null, lng: null, uses: 2, lastUsed: '2026-09-10' })
  })

  it('reads the location off the climbs for a session from before it moved up', function () {
    var out = venuesFromSessions([{ date: '2026-08-20', climbs: [{ location: 'The Depot' }] }])
    expect(out).toEqual([{ name: 'The Depot', lat: null, lng: null, uses: 1, lastUsed: '2026-08-20' }])
  })

  it('keeps the most recent spelling', function () {
    var out = venuesFromSessions([
      { date: '2026-09-01', location: 'redpoint  bristol' },
      { date: '2026-09-05', location: 'Redpoint Bristol' },
    ])
    expect(out).toEqual([{ name: 'Redpoint Bristol', lat: null, lng: null, uses: 2, lastUsed: '2026-09-05' }])
  })
})

describe('mergeVenues', function () {
  var saved = [{ name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng, uses: 1, lastUsed: T2 }]
  var fromLog = [
    { name: 'Redpoint bristol', lat: null, lng: null, uses: 4, lastUsed: '2026-09-16' },
    { name: 'Flashpoint',       lat: null, lng: null, uses: 3, lastUsed: '2026-09-10' },
  ]

  it('offers a wall from before location existed, without coordinates', function () {
    var out = mergeVenues(saved, fromLog)
    var flash = out.find(function (v) { return v.name === 'Flashpoint' })
    expect(flash).toEqual({ name: 'Flashpoint', lat: null, lng: null, uses: 3, lastUsed: '2026-09-10' })
  })

  it('keeps the saved coordinates and spelling, the larger count and the later date', function () {
    var out = mergeVenues(saved, fromLog)
    var red = out.find(function (v) { return venueKey(v.name) === 'redpoint bristol' })
    expect(red).toEqual({ name: 'Redpoint Bristol', lat: REDPOINT.lat, lng: REDPOINT.lng, uses: 4, lastUsed: T2 })
    expect(out.length).toBe(2)
  })

  it('keeps a saved venue whose sessions are gone', function () {
    var out = mergeVenues(saved, [])
    expect(out).toEqual(saved)
  })

  it('is most recent first and copes with either side missing', function () {
    expect(mergeVenues(null, fromLog).map(function (v) { return v.name })).toEqual(['Redpoint bristol', 'Flashpoint'])
    expect(mergeVenues(saved, null)).toEqual(saved)
    expect(mergeVenues(null, null)).toEqual([])
  })

  it('does not mutate either input', function () {
    var a = JSON.parse(JSON.stringify(saved))
    var b = JSON.parse(JSON.stringify(fromLog))
    mergeVenues(saved, fromLog)
    expect(saved).toEqual(a)
    expect(fromLog).toEqual(b)
  })

  it('a wall from the log becomes a nearby chip once saved with a fix', function () {
    var merged = mergeVenues(saved, fromLog)
    expect(nearbyVenues(merged, FLASHPOINT)).toEqual([])
    var after = mergeVenues(recordVenue(saved, 'Flashpoint', FLASHPOINT, T2), fromLog)
    expect(nearbyVenues(after, FLASHPOINT).map(function (v) { return v.name })).toEqual(['Flashpoint'])
  })
})

describe('recentVenues', function () {
  it('is the first few, coordinates or not', function () {
    var list = []
    for (var i = 0; i < RECENT_CHIPS + 3; i++) list.push({ name: 'Wall ' + i, lat: null, lng: null, uses: 1, lastUsed: '2026-09-0' + i })
    expect(recentVenues(list).length).toBe(RECENT_CHIPS)
    expect(recentVenues(list)[0].name).toBe('Wall 0')
    expect(recentVenues(list, 2).length).toBe(2)
  })

  it('is empty for nothing', function () {
    expect(recentVenues([])).toEqual([])
    expect(recentVenues(null)).toEqual([])
  })
})
