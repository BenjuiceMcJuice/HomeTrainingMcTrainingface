import { describe, it, expect } from 'vitest'
import { climbSummaryLine, sessionVenue, todaysClimbSession, climbSessionFields, CONTINUE_DASHBOARD_MS } from '../sessions'

function climb(grade, outcome) {
  return { id: grade + outcome, grade: grade, gradeSystem: 'v', discipline: 'boulder', outcome: outcome, attempts: 1 }
}

describe('climbSummaryLine', function () {
  it('says no climbs for an empty session', function () {
    expect(climbSummaryLine([])).toBe('No climbs logged')
    expect(climbSummaryLine(null)).toBe('No climbs logged')
  })

  it('shows the best send and a harder try — Ben\'s 28 Sept session', function () {
    var climbs = []
    for (var i = 0; i < 8; i++) climbs.push(climb('V3', 'flashed'))
    climbs.push(climb('V4', 'sent'), climb('V4', 'attempt'), climb('V5', 'project'))
    expect(climbSummaryLine(climbs)).toBe('11 climbs · Best V4 · Tried V5')
  })

  it('reads a lone attempt above the sends as tried, never as the best (BTL-B70)', function () {
    var climbs = []
    for (var i = 0; i < 9; i++) climbs.push(climb('V3', 'flashed'))
    climbs.push(climb('V4', 'attempt'))
    expect(climbSummaryLine(climbs)).toBe('10 climbs · Best V3 · Tried V4')
  })

  it('leaves out a try at or below the best send', function () {
    expect(climbSummaryLine([climb('V4', 'sent'), climb('V4', 'attempt'), climb('V2', 'project')])).toBe('3 climbs · Best V4')
  })

  it('shows only the try when nothing was sent', function () {
    expect(climbSummaryLine([climb('V5', 'attempt'), climb('V4', 'project'), climb('V5', 'attempt')])).toBe('3 climbs · Tried V5')
  })

  it('ranks V10 above V2 and says climb for one', function () {
    expect(climbSummaryLine([climb('V2', 'sent'), climb('V10', 'sent')])).toBe('2 climbs · Best V10')
    expect(climbSummaryLine([climb('V5', 'sent')])).toBe('1 climb · Best V5')
  })
})

describe('sessionVenue', function () {
  it('prefers the session location, else the first climb that has one', function () {
    expect(sessionVenue({ location: 'Flashpoint', climbs: [] })).toBe('Flashpoint')
    expect(sessionVenue({ location: null, climbs: [{}, { location: 'Redpoint' }] })).toBe('Redpoint')
    expect(sessionVenue({ location: null, climbs: [] })).toBe('')
    expect(sessionVenue(null)).toBe('')
  })
})

describe('todaysClimbSession', function () {
  var today = '2026-09-28'
  function s(id, extra) {
    return Object.assign({ id: id, type: 'climb', date: today, climbs: [], comp: null,
      createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z' }, extra)
  }

  it('is null with no sessions today', function () {
    expect(todaysClimbSession([], today)).toBe(null)
    expect(todaysClimbSession([s('a', { date: '2026-09-27' })], today)).toBe(null)
  })

  it('finds the one climb session today', function () {
    expect(todaysClimbSession([s('a')], today).id).toBe('a')
  })

  it('picks the most recently changed of several', function () {
    var list = [
      s('early', { updatedAt: '2026-09-28T08:00:00.000Z' }),
      s('late',  { updatedAt: '2026-09-28T18:00:00.000Z' }),
      s('mid',   { updatedAt: '2026-09-28T12:00:00.000Z' }),
    ]
    expect(todaysClimbSession(list, today).id).toBe('late')
  })

  it('falls back to createdAt when updatedAt is missing', function () {
    var list = [s('a', { updatedAt: null, createdAt: '2026-09-28T07:00:00.000Z' }), s('b')]
    expect(todaysClimbSession(list, today).id).toBe('b')
  })

  it('ignores comp sessions, other types and other days', function () {
    var list = [
      s('comp', { comp: { code: 'CP-ABCDE' }, updatedAt: '2026-09-28T20:00:00.000Z' }),
      s('hang', { type: 'hangboard', updatedAt: '2026-09-28T20:00:00.000Z' }),
      s('yday', { date: '2026-09-27', updatedAt: '2026-09-28T20:00:00.000Z' }),
    ]
    expect(todaysClimbSession(list, today)).toBe(null)
    expect(todaysClimbSession(list.concat([s('real')]), today).id).toBe('real')
  })

  it('keeps to the Dashboard window when one is given', function () {
    var changed = Date.parse('2026-09-28T09:00:00.000Z')
    var list = [s('a')]
    var at = function (ms) { return todaysClimbSession(list, today, { nowMs: changed + ms, withinMs: CONTINUE_DASHBOARD_MS }) }
    expect(at(2 * 3600e3 + 59 * 60e3).id).toBe('a')
    expect(at(3 * 3600e3 + 60e3)).toBe(null)
    // No window → the Log card shows it all day.
    expect(todaysClimbSession(list, today).id).toBe('a')
  })
})

describe('todaysClimbSession — finished sessions (BTL-B76)', function () {
  it('does not offer a session once it has endedAt', function () {
    var base = { type: 'climb', date: '2026-09-28', climbs: [], comp: null, updatedAt: '2026-09-28T09:00:00.000Z' }
    var ended = Object.assign({ id: 'ended', endedAt: '2026-09-28T10:00:00.000Z' }, base, { updatedAt: '2026-09-28T10:00:00.000Z' })
    var open  = Object.assign({ id: 'open' }, base)
    expect(todaysClimbSession([ended], '2026-09-28')).toBe(null)
    expect(todaysClimbSession([ended, open], '2026-09-28').id).toBe('open')
  })
})

describe('climbSessionFields', function () {
  var v3 = climb('V3', 'flashed'), l6 = Object.assign(climb('6a', 'sent'), { discipline: 'lead', gradeSystem: 'french' })

  it('reverses the form order and stamps the venue on each climb', function () {
    var f = climbSessionFields({ climbs: [l6, v3], difficulty: 2, notes: 'n', location: ' Flashpoint ', date: '2026-09-28' })
    expect(f.climbs.map(function (c) { return c.grade })).toEqual(['V3', '6a'])
    expect(f.climbs.every(function (c) { return c.location === 'Flashpoint' })).toBe(true)
    expect(f.location).toBe('Flashpoint')
    expect(f.discipline).toBe(null)
    expect(f.difficulty).toBe(2)
  })

  it('keeps the feel empty until one is picked, and a blank venue as null', function () {
    var f = climbSessionFields({ climbs: [v3], difficulty: null, notes: '', location: '  ', date: '2026-09-28' })
    expect(f.difficulty).toBe(null)
    expect(f.location).toBe(null)
    expect(f.discipline).toBe('boulder')
    expect(f.climbs[0].location).toBe(null)
  })

  it('does not change the form climbs', function () {
    var climbs = [v3]
    climbSessionFields({ climbs: climbs, difficulty: 1, notes: '', location: 'X', date: '2026-09-28' })
    expect(climbs[0].location).toBeUndefined()
  })
})
