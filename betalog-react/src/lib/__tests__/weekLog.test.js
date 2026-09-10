import { describe, it, expect } from 'vitest'
import {
  lastSealableWeek, sealWeeks, recentWeeks, averageScore, scoreRange, SCORE_VERSION,
} from '../weekLog'

// Thursday 2026-09-10. Its week starts Mon 2026-09-07, so the last sealable
// week is Mon 2026-08-31 .. Sun 2026-09-06.
var THU = '2026-09-10'
var NOW = '2026-09-10T18:00:00.000Z'

function data(overrides) {
  return Object.assign({ sessions: [], scheduleEntries: [], drinkLog: [] }, overrides)
}

describe('lastSealableWeek', () => {
  it('is the week before the current one, from any day', () => {
    expect(lastSealableWeek(THU)).toBe('2026-08-31')
    expect(lastSealableWeek('2026-09-07')).toBe('2026-08-31')   // Monday
    expect(lastSealableWeek('2026-09-13')).toBe('2026-08-31')   // Sunday
  })

  it('never seals the week in progress', () => {
    expect(lastSealableWeek(THU) < '2026-09-07').toBe(true)
  })
})

describe('sealWeeks', () => {
  it('seals a completed week that has sessions in it', () => {
    var d = data({ sessions: [{ date: '2026-09-01', type: 'climb' }] })
    var r = sealWeeks(d, [], THU, NOW)
    expect(r.added.length).toBe(1)
    expect(r.added[0].weekStart).toBe('2026-08-31')
    expect(r.added[0].weekEnd).toBe('2026-09-06')
    expect(r.added[0].scoreVersion).toBe(SCORE_VERSION)
    expect(r.added[0].sealedAt).toBe(NOW)
  })

  it('never seals the current week', () => {
    var d = data({ sessions: [{ date: '2026-09-09', type: 'climb' }] })
    var r = sealWeeks(d, [], THU, NOW)
    expect(r.added.every(x => x.weekStart !== '2026-09-07')).toBe(true)
  })

  it('is idempotent — a sealed week is never rescored', () => {
    // The whole point of sealing. Even if the data now says otherwise.
    var d = data({ sessions: [{ date: '2026-09-01', type: 'climb' }] })
    var first = sealWeeks(d, [], THU, NOW)
    var again = sealWeeks(d, first.records, THU, NOW)
    expect(again.added.length).toBe(0)
    expect(again.records.length).toBe(first.records.length)
  })

  it('keeps the original record when the inputs change afterwards', () => {
    // Pruning a routine from 7 days a week to 3 must not retroactively improve
    // a week that was already sealed.
    var busy = data({
      sessions: [{ date: '2026-09-01', type: 'climb' }],
      scheduleEntries: [{ id: 'a', routineId: 'r1', days: [1, 2, 3, 4, 5, 6, 7], remindFrom: '2026-08-01' }],
    })
    var sealed = sealWeeks(busy, [], THU, NOW)
    var before = sealed.records[0].score

    var pruned = data({
      sessions: [{ date: '2026-09-01', type: 'climb' }],
      scheduleEntries: [{ id: 'a', routineId: 'r1', days: [1], remindFrom: '2026-08-01' }],
    })
    var after = sealWeeks(pruned, sealed.records, THU, NOW)
    expect(after.added.length).toBe(0)
    expect(after.records[0].score).toBe(before)
  })

  it('backfills every completed week with data, oldest first', () => {
    var d = data({
      sessions: [
        { date: '2026-08-18', type: 'climb' },   // w/c 17 Aug
        { date: '2026-08-26', type: 'gym' },     // w/c 24 Aug
        { date: '2026-09-01', type: 'climb' },   // w/c 31 Aug
      ],
    })
    var r = sealWeeks(d, [], THU, NOW)
    expect(r.added.map(x => x.weekStart)).toEqual(['2026-08-17', '2026-08-24', '2026-08-31'])
  })

  it('marks backfilled weeks as such, but not the one sealed on time', () => {
    var d = data({
      sessions: [{ date: '2026-08-18', type: 'climb' }, { date: '2026-09-01', type: 'climb' }],
    })
    var r = sealWeeks(d, [], THU, NOW)
    expect(r.added[0].backfilled).toBe(true)             // w/c 17 Aug
    expect(r.added[r.added.length - 1].backfilled).toBe(false)  // w/c 31 Aug
  })

  it('skips weeks with nothing in them at all', () => {
    // A gap when the app was not being used should not fill the history with
    // "10 — nothing done, nothing drunk" records that look like real data.
    var d = data({
      sessions: [{ date: '2026-08-18', type: 'climb' }, { date: '2026-09-01', type: 'climb' }],
    })
    var r = sealWeeks(d, [], THU, NOW)
    expect(r.added.map(x => x.weekStart)).not.toContain('2026-08-24')
  })

  it('does seal an empty week once a schedule makes days due', () => {
    var d = data({
      scheduleEntries: [{ id: 'a', routineId: 'r1', days: [1, 2, 3, 4, 5, 6, 7], remindFrom: '2026-08-01' }],
    })
    var r = sealWeeks(d, [], THU, NOW)
    expect(r.added.map(x => x.weekStart)).toContain('2026-08-31')
  })

  it('counts drinks alone as something worth sealing', () => {
    var d = data({ drinkLog: [{ date: '2026-09-01', units: 12 }] })
    var r = sealWeeks(d, [], THU, NOW)
    expect(r.added.map(x => x.weekStart)).toContain('2026-08-31')
  })

  it('fills a gap without touching what is already stored', () => {
    var d = data({
      sessions: [{ date: '2026-08-18', type: 'climb' }, { date: '2026-09-01', type: 'climb' }],
    })
    var existing = [{ weekStart: '2026-08-17', score: 99, band: 'EXCELLENT', sealedAt: '2026-08-24T00:00:00.000Z' }]
    var r = sealWeeks(d, existing, THU, NOW)
    expect(r.added.map(x => x.weekStart)).toEqual(['2026-08-31'])
    expect(r.records.find(x => x.weekStart === '2026-08-17').score).toBe(99)
  })

  it('returns records sorted oldest first', () => {
    var d = data({
      sessions: [{ date: '2026-08-18', type: 'climb' }, { date: '2026-09-01', type: 'climb' }],
    })
    var r = sealWeeks(d, [], THU, NOW)
    var weeks = r.records.map(x => x.weekStart)
    expect(weeks).toEqual(weeks.slice().sort())
  })

  it('handles an empty dataset without inventing weeks', () => {
    expect(sealWeeks(data(), [], THU, NOW).added).toEqual([])
  })

  it('stores the components, not just the number', () => {
    var d = data({
      sessions: [{ date: '2026-09-01', type: 'climb' }],
      drinkLog: [{ date: '2026-09-02', units: 30 }],
    })
    var rec = sealWeeks(d, [], THU, NOW).added[0]
    expect(rec.training.points).toBe(3)
    expect(rec.alcohol.units).toBe(30)
    expect(rec.alcohol.delta).toBe(-16)
    expect(typeof rec.band).toBe('string')
  })
})

describe('recentWeeks / averageScore / scoreRange', () => {
  var recs = [
    { weekStart: '2026-08-17', score: 40 },
    { weekStart: '2026-08-24', score: 10 },
    { weekStart: '2026-08-31', score: 70 },
  ]

  it('takes the most recent n, oldest first', () => {
    expect(recentWeeks(recs, 2).map(r => r.weekStart)).toEqual(['2026-08-24', '2026-08-31'])
  })

  it('returns everything when there are fewer than n', () => {
    expect(recentWeeks(recs, 10).length).toBe(3)
  })

  it('averages and ranges', () => {
    expect(averageScore(recs)).toBe(40)
    expect(scoreRange(recs).best.score).toBe(70)
    expect(scoreRange(recs).worst.score).toBe(10)
  })

  it('copes with nothing stored', () => {
    expect(recentWeeks([], 8)).toEqual([])
    expect(averageScore([])).toBe(null)
    expect(scoreRange([]).best).toBe(null)
  })
})
