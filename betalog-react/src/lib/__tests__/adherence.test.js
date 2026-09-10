import { describe, it, expect } from 'vitest'
import {
  routineFamily, dueDates, entryAdherence, buildAdherence, shameBand, SHAME_BANDS,
} from '../adherence'

// 2026-09-10 is a Thursday, so "yesterday" in these tests is Wed 2026-09-09.
var TODAY = '2026-09-10'

function entry(fields) {
  return Object.assign({ id: 'e1', routineId: 'r1', routineName: 'Test', days: [1, 3, 5] }, fields)
}

describe('routineFamily', () => {
  it('strips the version suffix from seeded routine ids', () => {
    expect(routineFamily('dr-submaxrepeaters-v4')).toBe('dr-submaxrepeaters')
    expect(routineFamily('dr-submaxrepeaters-v5')).toBe('dr-submaxrepeaters')
    expect(routineFamily('dr-max-hangs-v5')).toBe('dr-max-hangs')
    expect(routineFamily('dr-7-3-repeaters-v4')).toBe('dr-7-3-repeaters')
  })

  it('leaves user routine uuids alone', () => {
    var id = 'a393c2bd-de68-4ed8-8907-ffd84a8a76d8'
    expect(routineFamily(id)).toBe(id)
  })

  it('only strips a trailing -vN, and only on dr- ids', () => {
    expect(routineFamily('dr-thing-v10')).toBe('dr-thing')
    expect(routineFamily('dr-thing-v4-extra')).toBe('dr-thing-v4-extra')
    expect(routineFamily('custom-v4')).toBe('custom-v4')
  })

  it('has no family for a missing id', () => {
    expect(routineFamily(null)).toBe(null)
    expect(routineFamily(undefined)).toBe(null)
    expect(routineFamily('')).toBe(null)
  })
})

describe('dueDates', () => {
  it('returns only the scheduled weekdays in range', () => {
    // Mon 2026-09-07 .. Sun 2026-09-13, scheduled Mon/Wed/Fri
    expect(dueDates(entry(), '2026-09-07', '2026-09-13'))
      .toEqual(['2026-09-07', '2026-09-09', '2026-09-11'])
  })

  it('handles Sunday as day 7, not day 0', () => {
    expect(dueDates(entry({ days: [7] }), '2026-09-07', '2026-09-13')).toEqual(['2026-09-13'])
  })

  it('never counts days before remindFrom', () => {
    // Rule 2: adding a routine today must not open with retroactive failure.
    var e = entry({ remindFrom: '2026-09-09' })
    expect(dueDates(e, '2026-09-01', '2026-09-13')).toEqual(['2026-09-09', '2026-09-11'])
  })

  it('returns nothing when remindFrom is past the window', () => {
    expect(dueDates(entry({ remindFrom: '2026-10-01' }), '2026-09-01', '2026-09-13')).toEqual([])
  })

  it('returns nothing for an entry with no days', () => {
    expect(dueDates(entry({ days: [] }), '2026-09-01', '2026-09-13')).toEqual([])
    expect(dueDates(null, '2026-09-01', '2026-09-13')).toEqual([])
  })

  it('includes both endpoints', () => {
    expect(dueDates(entry({ days: [1, 2, 3, 4, 5, 6, 7] }), '2026-09-07', '2026-09-08'))
      .toEqual(['2026-09-07', '2026-09-08'])
  })
})

describe('entryAdherence', () => {
  var index = { r1: { '2026-09-07': true, '2026-09-09': true } }

  it('counts hits on due days only', () => {
    var a = entryAdherence(entry(), index, '2026-09-07', '2026-09-11')
    expect(a.due).toBe(3)          // Mon, Wed, Fri
    expect(a.done).toBe(2)         // Mon, Wed
    expect(a.missed).toBe(1)       // Fri
    expect(a.pct).toBe(67)
  })

  it('ignores sessions logged on days the routine was not due', () => {
    var offDay = { r1: { '2026-09-08': true } }   // a Tuesday, not scheduled
    var a = entryAdherence(entry(), offDay, '2026-09-07', '2026-09-11')
    expect(a.done).toBe(0)
    expect(a.pct).toBe(0)
  })

  it('credits a session logged under an older default-routine version', () => {
    // The regression this guards: the schedule points at v5 while every
    // historical session carries v4, so a strict id match scores a real
    // streak as zero.
    var e   = entry({ routineId: 'dr-submaxrepeaters-v5', days: [1] })
    var idx = { 'dr-submaxrepeaters': { '2026-09-07': true } }
    expect(entryAdherence(e, idx, '2026-09-07', '2026-09-07').done).toBe(1)
  })

  it('counts the missed streak back from the most recent due day', () => {
    var idx = { r1: { '2026-09-07': true } }      // Mon done, Wed and Fri missed
    var a = entryAdherence(entry(), idx, '2026-09-07', '2026-09-11')
    expect(a.missedStreak).toBe(2)
  })

  it('resets the missed streak when the last due day was done', () => {
    var idx = { r1: { '2026-09-11': true } }      // only the last one
    var a = entryAdherence(entry(), idx, '2026-09-07', '2026-09-11')
    expect(a.missedStreak).toBe(0)
    expect(a.done).toBe(1)
  })

  it('reports lastDone from outside the window', () => {
    // A card showing 0% is exactly where "last done in June" is the useful fact.
    var idx = { r1: { '2026-06-05': true } }
    var a = entryAdherence(entry(), idx, '2026-09-07', '2026-09-11')
    expect(a.pct).toBe(0)
    expect(a.lastDone).toBe('2026-06-05')
  })

  it('has a null pct when nothing was due', () => {
    var a = entryAdherence(entry({ days: [] }), index, '2026-09-07', '2026-09-11')
    expect(a.due).toBe(0)
    expect(a.pct).toBe(null)
    expect(a.missedStreak).toBe(0)
  })
})

describe('buildAdherence', () => {
  var schedule = [
    entry({ id: 'a', routineId: 'r1', routineName: 'Prehab', days: [1, 3, 5], remindFrom: '2026-08-19' }),
    entry({ id: 'b', routineId: 'r2', routineName: 'Glutes', days: [1, 2, 3, 4, 5, 6, 7], remindFrom: '2026-08-20' }),
  ]

  it('ends the window yesterday, never today', () => {
    // Rule 1: a routine due today is still in play.
    var a = buildAdherence(schedule, [], 7, TODAY)
    expect(a.end).toBe('2026-09-09')
    expect(a.start).toBe('2026-09-03')
    expect(a.entries[0].dueDates.indexOf(TODAY)).toBe(-1)
  })

  it('pools due days rather than averaging per-routine percentages', () => {
    // Window is Thu 03 .. Wed 09 (7 days ending yesterday).
    // Prehab (Mon/Wed/Fri): Fri 04, Mon 07, Wed 09 -> 3 due, 2 done.
    // Glutes (every day): 7 due, 0 done.
    // Pooled = 2/10 = 20%. Averaging the two rates would give a flattering 33%.
    var sessions = [
      { date: '2026-09-07', routineId: 'r1' },
      { date: '2026-09-09', routineId: 'r1' },
    ]
    var a = buildAdherence(schedule, sessions, 7, TODAY)
    expect(a.due).toBe(10)
    expect(a.done).toBe(2)
    expect(a.pct).toBe(20)
  })

  it('marks itself unscored when nothing was due in the window', () => {
    var future = [entry({ remindFrom: '2026-12-01' })]
    var a = buildAdherence(future, [], 30, TODAY)
    expect(a.scored).toBe(false)
    expect(a.pct).toBe(null)
  })

  it('handles an empty schedule', () => {
    var a = buildAdherence([], [], 30, TODAY)
    expect(a.entries).toEqual([])
    expect(a.scored).toBe(false)
    expect(a.pct).toBe(null)
  })

  it('ignores sessions with no routineId', () => {
    // Ad-hoc gym and climbing sessions carry routineId: null and must not be
    // credited against a scheduled routine they were never linked to.
    var sessions = [{ date: '2026-09-07', routineId: null }, { date: '2026-09-08' }]
    var a = buildAdherence(schedule, sessions, 7, TODAY)
    expect(a.done).toBe(0)
  })

  it('treats a missing schedule or session list as empty', () => {
    expect(buildAdherence(null, null, 30, TODAY).scored).toBe(false)
  })
})

describe('shameBand', () => {
  it('picks the band by inclusive minimum', () => {
    expect(shameBand(100).label).toBe('Flawless')
    expect(shameBand(95).label).toBe('Flawless')
    expect(shameBand(94).label).toBe('Locked in')
    expect(shameBand(85).label).toBe('Locked in')
    expect(shameBand(70).label).toBe('Solid')
    expect(shameBand(55).label).toBe('Wobbly')
    expect(shameBand(40).label).toBe('Patchy')
    expect(shameBand(20).label).toBe('Shaky')
    expect(shameBand(1).label).toBe('Ghosting it')
    expect(shameBand(0).label).toBe('Total shame')
  })

  it('has no band when nothing was due', () => {
    expect(shameBand(null)).toBe(null)
    expect(shameBand(undefined)).toBe(null)
  })

  it('is ordered best-first and covers zero', () => {
    for (var i = 1; i < SHAME_BANDS.length; i++) {
      expect(SHAME_BANDS[i].min).toBeLessThan(SHAME_BANDS[i - 1].min)
    }
    expect(SHAME_BANDS[SHAME_BANDS.length - 1].min).toBe(0)
  })
})
