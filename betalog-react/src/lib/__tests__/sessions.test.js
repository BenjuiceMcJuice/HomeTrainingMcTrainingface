import { describe, it, expect } from 'vitest'
import { climbSummaryLine, sessionVenue, todaysClimbSession, CONTINUE_DASHBOARD_MS } from '../sessions'

function climb(grade, outcome) {
  return { id: grade + outcome, grade: grade, gradeSystem: 'v', discipline: 'boulder', outcome: outcome, attempts: 1 }
}

describe('climbSummaryLine', function () {
  it('says no climbs for an empty session', function () {
    expect(climbSummaryLine([])).toBe('No climbs logged')
    expect(climbSummaryLine(null)).toBe('No climbs logged')
  })

  it('reads a lone attempt above the sends as an attempt (BTL-B70)', function () {
    var climbs = []
    for (var i = 0; i < 9; i++) climbs.push(climb('V3', 'flashed'))
    climbs.push(climb('V4', 'attempt'))
    expect(climbSummaryLine(climbs)).toBe('10 climbs · 9 Flash to V3 · 1 Att at V4')
  })

  it('orders outcomes Flash, Send, Att, Proj and ranks V10 above V2', function () {
    var line = climbSummaryLine([climb('V2', 'project'), climb('V10', 'sent'), climb('V2', 'sent'), climb('V1', 'flashed')])
    expect(line).toBe('4 climbs · 1 Flash at V1 · 2 Send to V10 · 1 Proj at V2')
  })

  it('says climb for one', function () {
    expect(climbSummaryLine([climb('V5', 'sent')])).toBe('1 climb · 1 Send at V5')
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
