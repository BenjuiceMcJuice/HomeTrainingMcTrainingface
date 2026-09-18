import { describe, it, expect } from 'vitest'
import {
  NEARBY_METRES, MAX_VENUES,
  distanceMetres, venueKey, recordVenue, nearbyVenues, suggestVenue,
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
