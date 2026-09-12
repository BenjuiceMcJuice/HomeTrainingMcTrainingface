import { describe, it, expect } from 'vitest'
import {
  sessionPoints, weekDates, trainingPoints, scheduleDays, weeklyUnits,
  buildWeeklyScore, scoreBand, biggestGain, SCORE_BANDS, SESSION_POINTS,
} from '../weeklyScore'

// 2026-09-10 is a Thursday. Its week runs Mon 2026-09-07 .. Sun 2026-09-13.
var THU = '2026-09-10'
var MON = '2026-09-07'
// A date inside the *previous* week (Mon 2026-08-31 .. Sun 2026-09-06).
var LAST_WK = '2026-09-01'

function climb(date)  { return { date: date, type: 'climb' } }
function walk(date)   { return { date: date, type: 'cardio', cardioActivity: 'walk' } }

// BTL-B10: a flat 2 for any gym session scored five days of ankle rehab as a
// 100/EXCELLENT week. The fix reads session content, which is the one thing that
// actually separates rehab from training.
describe('sessionPoints — a gym session scores by what was in it', () => {
  const gym = (n) => ({
    type: 'gym', date: '2026-04-13',
    exercises: Array.from({ length: n }, (_, i) => ({ name: 'ex' + i })),
  })

  it('scores rehab below an ordinary session', () => {
    expect(sessionPoints(gym(2))).toBe(1)
    expect(sessionPoints(gym(4))).toBe(2)
  })

  it('leaves the ordinary gym session exactly where it was', () => {
    // The middle band is the old flat value, so only the extremes move.
    expect(sessionPoints(gym(3))).toBe(SESSION_POINTS.gym)
    expect(sessionPoints(gym(5))).toBe(SESSION_POINTS.gym)
  })

  it('scores a full session like a climb', () => {
    expect(sessionPoints(gym(6))).toBe(SESSION_POINTS.climb)
    expect(sessionPoints(gym(12))).toBe(SESSION_POINTS.climb)
  })

  it('does not score down a session whose exercises were never recorded', () => {
    // An empty list is missing detail, not a small session. Inferring "rehab"
    // from it would be reading something the log does not say, so the old flat
    // value stands.
    expect(sessionPoints(gym(0))).toBe(SESSION_POINTS.gym)
    expect(sessionPoints({ type: 'gym', date: '2026-04-13' })).toBe(SESSION_POINTS.gym)
  })

  it('fixes the week that prompted this', () => {
    // Five consecutive days of two-exercise rehab: 10 points before, 5 now,
    // against a weekly target of 9.
    const week = Array.from({ length: 5 }, () => gym(2))
    const before = week.length * SESSION_POINTS.gym
    const after  = week.reduce((n, s) => n + sessionPoints(s), 0)
    expect(before).toBe(10)
    expect(after).toBe(5)
  })

  it('does not touch other session types', () => {
    expect(sessionPoints({ type: 'climb' })).toBe(3)
    expect(sessionPoints({ type: 'hangboard' })).toBe(3)
    expect(sessionPoints({ type: 'cardio', cardioActivity: 'swim' })).toBe(2)
    expect(sessionPoints({ type: 'cardio', cardioActivity: 'walk' })).toBe(1)
  })
})

describe('sessionPoints', () => {
  it('scores by type, with walks cheapest', () => {
    expect(sessionPoints({ type: 'climb' })).toBe(3)
    expect(sessionPoints({ type: 'hangboard' })).toBe(3)
    expect(sessionPoints({ type: 'gym' })).toBe(2)
    expect(sessionPoints({ type: 'cardio', cardioActivity: 'swim' })).toBe(2)
    expect(sessionPoints({ type: 'cardio', cardioActivity: 'sport' })).toBe(2)
    expect(sessionPoints({ type: 'cardio', cardioActivity: 'walk' })).toBe(1)
  })

  it('ignores duration and distance entirely', () => {
    // The point of scoring by type: the 30-minute default on most walks makes
    // every duration-derived figure unreliable.
    var short = { type: 'cardio', cardioActivity: 'walk', cardioDurationMins: 30, cardioQuantity: 1 }
    var long  = { type: 'cardio', cardioActivity: 'walk', cardioDurationMins: 130, cardioQuantity: 7.5 }
    expect(sessionPoints(short)).toBe(sessionPoints(long))
  })

  it('scores nothing for junk', () => {
    expect(sessionPoints(null)).toBe(0)
    expect(sessionPoints({ type: 'nonsense' })).toBe(0)
  })
})

describe('weekDates', () => {
  it('runs Monday to Sunday around any day in the week', () => {
    expect(weekDates(THU)[0]).toBe('2026-09-07')
    expect(weekDates(THU)[6]).toBe('2026-09-13')
    expect(weekDates('2026-09-13')).toEqual(weekDates('2026-09-07'))
  })
})

describe('trainingPoints', () => {
  var dates = weekDates(THU)

  it('sums points inside the week and ignores everything outside it', () => {
    var s = [climb(MON), walk('2026-09-08'), climb('2026-08-01')]
    expect(trainingPoints(s, dates).points).toBe(4)
  })

  it('caps one day at 4 so a big Saturday cannot carry a week', () => {
    var s = [climb(MON), climb(MON), climb(MON)]   // 9 raw
    expect(trainingPoints(s, dates).points).toBe(4)
  })

  it('caps per day, not per week', () => {
    var s = [climb(MON), climb(MON), climb('2026-09-08'), climb('2026-09-08')]
    expect(trainingPoints(s, dates).points).toBe(8)
  })
})

describe('scheduleDays', () => {
  var dates = weekDates(THU)
  var daily = [{ id: 'a', routineId: 'r1', days: [1, 2, 3, 4, 5, 6, 7] }]

  it('counts days, not routine instances', () => {
    // Three routines all due Monday is still one due day. Scoring each one
    // separately makes the component unwinnable for a busy schedule.
    var three = [
      { id: 'a', routineId: 'r1', days: [1] },
      { id: 'b', routineId: 'r2', days: [1] },
      { id: 'c', routineId: 'r3', days: [1] },
    ]
    expect(scheduleDays(three, {}, dates, THU).due).toBe(1)
  })

  it('marks a day done when any routine due that day was logged', () => {
    var three = [
      { id: 'a', routineId: 'r1', days: [1] },
      { id: 'b', routineId: 'r2', days: [1] },
    ]
    var done = scheduleDays(three, { r2: { [MON]: true } }, dates, THU)
    expect(done.done).toBe(1)
  })

  it('excludes today and the rest of the week', () => {
    var r = scheduleDays(daily, {}, dates, THU)
    expect(r.due).toBe(3)                       // Mon, Tue, Wed
    expect(r.dueDates).toEqual(['2026-09-07', '2026-09-08', '2026-09-09'])
  })

  it('respects remindFrom', () => {
    var late = [{ id: 'a', routineId: 'r1', days: [1, 2, 3, 4, 5, 6, 7], remindFrom: '2026-09-09' }]
    expect(scheduleDays(late, {}, dates, THU).due).toBe(1)
  })

  it('credits an older default-routine version', () => {
    var e = [{ id: 'a', routineId: 'dr-submaxrepeaters-v5', days: [1] }]
    var idx = { 'dr-submaxrepeaters': { [MON]: true } }
    expect(scheduleDays(e, idx, dates, THU).done).toBe(1)
  })

  it('has nothing due with no schedule', () => {
    expect(scheduleDays([], {}, dates, THU).due).toBe(0)
    expect(scheduleDays(null, {}, dates, THU).due).toBe(0)
  })
})

describe('weeklyUnits', () => {
  it('totals only what falls inside the week', () => {
    var log = [
      { date: MON, units: 4 }, { date: '2026-09-09', units: 2.5 },
      { date: '2026-08-30', units: 12 },
    ]
    expect(weeklyUnits(log, weekDates(THU))).toBe(6.5)
  })

  it('is zero for an empty log', () => {
    expect(weeklyUnits([], weekDates(THU))).toBe(0)
    expect(weeklyUnits(null, weekDates(THU))).toBe(0)
  })
})

describe('buildWeeklyScore', () => {
  var noSchedule = { sessions: [], scheduleEntries: [], drinkLog: [] }

  it('folds the schedule weight into training when nothing is scheduled', () => {
    // A schedule is an opportunity to score, never a tax for having one — so a
    // hard week with no schedule must still be able to reach 100.
    var data = {
      sessions: [climb(MON), climb('2026-09-08'), climb('2026-09-09'), climb('2026-09-10')],
      scheduleEntries: [], drinkLog: [],
    }
    var r = buildWeeklyScore(data, THU)
    expect(r.training.max).toBe(100)
    expect(r.schedule.active).toBe(false)
    expect(r.score).toBe(100)     // target met, plus the dry bonus, clamped
  })

  it('splits 75/25 once a schedule is in play', () => {
    var data = {
      sessions: [], drinkLog: [],
      scheduleEntries: [{ id: 'a', routineId: 'r1', days: [1, 2, 3, 4, 5, 6, 7] }],
    }
    var r = buildWeeklyScore(data, THU)
    expect(r.training.max).toBe(75)
    expect(r.schedule.max).toBe(25)
    expect(r.schedule.due).toBe(3)
  })

  it('pro-rates the target, with a floor of three days', () => {
    // Monday: the floor means the target is 3/7 of a week, not 1/7 — otherwise
    // a single walk on day one reads EXCELLENT.
    var r = buildWeeklyScore({ ...noSchedule, sessions: [walk(MON)] }, MON)
    expect(r.training.target).toBeCloseTo(9 * 3 / 7, 1)
    expect(r.dayOfWeek).toBe(1)
    expect(r.score).toBeLessThan(88)
  })

  it('scores a complete past week over all seven days', () => {
    var r = buildWeeklyScore(noSchedule, THU, -1)
    expect(r.complete).toBe(true)
    expect(r.dayOfWeek).toBe(7)
    expect(r.weekStart).toBe('2026-08-31')
    expect(r.weekEnd).toBe('2026-09-06')
  })

  it('gives the dry bonus and applies no penalty inside the guideline', () => {
    var dry  = buildWeeklyScore(noSchedule, THU)
    expect(dry.alcohol.dry).toBe(true)
    expect(dry.alcohol.delta).toBe(10)

    // 5 units against a Thursday allowance of 14 * 4/7 = 8 -> no penalty
    var some = buildWeeklyScore({ ...noSchedule, drinkLog: [{ date: MON, units: 5 }] }, THU)
    expect(some.alcohol.delta).toBe(0)
  })

  it('penalises a unit per unit over, capped at 25', () => {
    var heavy = buildWeeklyScore({ ...noSchedule, drinkLog: [{ date: LAST_WK, units: 80 }] }, THU, -1)
    expect(heavy.alcohol.delta).toBe(-25)
    expect(heavy.alcohol.capped).toBe(true)
  })

  it('never leaves the 0-100 range', () => {
    var awful = buildWeeklyScore({ ...noSchedule, drinkLog: [{ date: LAST_WK, units: 200 }] }, THU, -1)
    expect(awful.score).toBe(0)

    var great = {
      sessions: [climb(MON), climb('2026-09-08'), climb('2026-09-09')],
      scheduleEntries: [], drinkLog: [],
    }
    expect(buildWeeklyScore(great, THU).score).toBe(100)
  })

  it('lets hard training survive a heavy week', () => {
    // The -25 cap exists so a score never tells someone who trained hard that
    // the week was worthless.
    var data = {
      sessions: [climb(MON), climb('2026-09-08'), climb('2026-09-09')],
      scheduleEntries: [], drinkLog: [{ date: MON, units: 70 }],
    }
    expect(buildWeeklyScore(data, THU).score).toBeGreaterThanOrEqual(70)
  })

  it('handles a totally empty dataset', () => {
    var r = buildWeeklyScore({ sessions: [], scheduleEntries: [], drinkLog: [] }, THU, -1)
    expect(r.score).toBe(10)      // nothing done, but nothing drunk either
    expect(r.training.points).toBe(0)
  })
})

describe('scoreBand', () => {
  it('bands on inclusive minimums', () => {
    expect(scoreBand(100).label).toBe('EXCELLENT')
    expect(scoreBand(88).label).toBe('EXCELLENT')
    expect(scoreBand(87).label).toBe('GOOD')
    expect(scoreBand(70).label).toBe('GOOD')
    expect(scoreBand(69).label).toBe('FAIR')
    expect(scoreBand(50).label).toBe('FAIR')
    expect(scoreBand(49).label).toBe('POOR')
    expect(scoreBand(30).label).toBe('POOR')
    expect(scoreBand(29).label).toBe('VERY POOR')
    expect(scoreBand(0).label).toBe('VERY POOR')
  })

  it('is ordered best-first and reaches zero', () => {
    for (var i = 1; i < SCORE_BANDS.length; i++) {
      expect(SCORE_BANDS[i].min).toBeLessThan(SCORE_BANDS[i - 1].min)
    }
    expect(SCORE_BANDS[SCORE_BANDS.length - 1].min).toBe(0)
  })
})

describe('biggestGain', () => {
  it('names the largest available swing', () => {
    var r = buildWeeklyScore({
      sessions: [], scheduleEntries: [], drinkLog: [{ date: LAST_WK, units: 60 }],
    }, THU, -1)
    expect(biggestGain(r)).toMatch(/dry week/)
  })

  it('is null when there is nothing left to gain', () => {
    var r = buildWeeklyScore({
      sessions: [{ date: MON, type: 'climb' }, { date: '2026-09-08', type: 'climb' },
                 { date: '2026-09-09', type: 'climb' }],
      scheduleEntries: [], drinkLog: [],
    }, THU)
    expect(biggestGain(r)).toBe(null)
  })
})

describe('the schedule must be able to change the top band', () => {
  it('caps a fully ignored schedule below EXCELLENT', () => {
    // Perfect training + a dry week is 85. If EXCELLENT started at 85, the
    // schedule could never affect the verdict at the top of the scale.
    var data = {
      sessions: [
        { date: '2026-09-07', type: 'climb' }, { date: '2026-09-08', type: 'climb' },
        { date: '2026-09-09', type: 'climb' },
      ],
      scheduleEntries: [{ id: 'a', routineId: 'r1', days: [1, 2, 3, 4, 5, 6, 7] }],
      drinkLog: [],
    }
    var r = buildWeeklyScore(data, '2026-09-10')
    expect(r.training.earned).toBe(75)
    expect(r.schedule.done).toBe(0)
    expect(r.score).toBe(85)
    expect(r.band.label).toBe('GOOD')
  })

  it('reaches EXCELLENT once the scheduled days are honoured', () => {
    var data = {
      sessions: [
        { date: '2026-09-07', type: 'climb', routineId: 'r1' },
        { date: '2026-09-08', type: 'climb', routineId: 'r1' },
        { date: '2026-09-09', type: 'climb', routineId: 'r1' },
      ],
      scheduleEntries: [{ id: 'a', routineId: 'r1', days: [1, 2, 3, 4, 5, 6, 7] }],
      drinkLog: [],
    }
    var r = buildWeeklyScore(data, '2026-09-10')
    expect(r.schedule.done).toBe(3)
    expect(r.band.label).toBe('EXCELLENT')
  })
})
