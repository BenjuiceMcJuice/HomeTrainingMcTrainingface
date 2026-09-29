import { describe, it, expect } from 'vitest'
import { climbSummaryLine, sessionVenue, openClimbSession, isOpenClimbSession, sessionDayLabel, climbSessionFields } from '../sessions'

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

describe('openClimbSession (BTL-B109)', function () {
  function s(id, extra) {
    return Object.assign({ id: id, type: 'climb', date: '2026-09-28', climbs: [], comp: null, endedAt: null,
      createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z' }, extra)
  }

  it('is null when nothing is open', function () {
    expect(openClimbSession([])).toBe(null)
    expect(openClimbSession(null)).toBe(null)
  })

  it('finds a session saved as you go and not finished', function () {
    expect(openClimbSession([s('a')]).id).toBe('a')
  })

  it('never offers a session from before B76, which has no endedAt at all', function () {
    var old = s('old'); delete old.endedAt
    expect(openClimbSession([old])).toBe(null)
  })

  it('does not offer a finished session', function () {
    expect(openClimbSession([s('a', { endedAt: '2026-09-28T10:00:00.000Z' })])).toBe(null)
  })

  it('keeps a session open across days and hours — no timer closes it', function () {
    expect(openClimbSession([s('a', { date: '2026-09-20', updatedAt: '2026-09-20T09:00:00.000Z' })]).id).toBe('a')
  })

  it('ignores comp sessions and other types', function () {
    expect(openClimbSession([s('c', { comp: { code: 'CP-ABCDE' } }), s('h', { type: 'hangboard' })])).toBe(null)
  })

  it('picks the most recently changed of several, falling back to createdAt', function () {
    var list = [
      s('early', { updatedAt: '2026-09-28T08:00:00.000Z' }),
      s('late',  { updatedAt: '2026-09-28T18:00:00.000Z' }),
      s('none',  { updatedAt: null, createdAt: '2026-09-28T12:00:00.000Z' }),
    ]
    expect(openClimbSession(list).id).toBe('late')
  })
})

describe('sessionDayLabel', function () {
  it('says Today, Yesterday, or the day and date', function () {
    expect(sessionDayLabel('2026-09-28', '2026-09-28')).toBe('Today')
    expect(sessionDayLabel('2026-09-27', '2026-09-28')).toBe('Yesterday')
    expect(sessionDayLabel('2026-09-25', '2026-09-28')).toBe('Fri 25 Sep')
    expect(sessionDayLabel('2026-02-28', '2026-03-01')).toBe('Yesterday')
    expect(sessionDayLabel('', '2026-09-28')).toBe('')
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

  it('carries the registry venue id with the name, and never without one', function () {
    var f = climbSessionFields({ climbs: [v3], difficulty: 1, notes: '', location: 'Flashpoint', venueId: 'v2', date: '2026-09-28' })
    expect(f.venueId).toBe('v2')
    expect(climbSessionFields({ climbs: [v3], difficulty: 1, notes: '', location: 'Typed', date: '2026-09-28' }).venueId).toBe(null)
    expect(climbSessionFields({ climbs: [v3], difficulty: 1, notes: '', location: '', venueId: 'v2', date: '2026-09-28' }).venueId).toBe(null)
  })

  it('does not change the form climbs', function () {
    var climbs = [v3]
    climbSessionFields({ climbs: climbs, difficulty: 1, notes: '', location: 'X', date: '2026-09-28' })
    expect(climbs[0].location).toBeUndefined()
  })
})

describe('isOpenClimbSession', function () {
  it('is true only for a climb session with endedAt exactly null, not a comp', function () {
    expect(isOpenClimbSession({ type: 'climb', endedAt: null, comp: null })).toBe(true)
    expect(isOpenClimbSession({ type: 'climb', comp: null })).toBe(false)
    expect(isOpenClimbSession({ type: 'climb', endedAt: '2026-09-28T10:00:00.000Z' })).toBe(false)
    expect(isOpenClimbSession({ type: 'climb', endedAt: null, comp: { code: 'CP-ABCDE' } })).toBe(false)
    expect(isOpenClimbSession({ type: 'hangboard', endedAt: null })).toBe(false)
    expect(isOpenClimbSession(null)).toBe(false)
  })
})
