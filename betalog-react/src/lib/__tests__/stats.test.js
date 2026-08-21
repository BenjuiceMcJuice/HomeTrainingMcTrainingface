import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  estimateCalories,
  getMETRange,
  getPaceMET,
  getSwimKcalRange,
  deriveSessionMetres,
  gradeLevel,
  gradeColor,
  mondayOf,
  calcBestWeekStreak,
  calcWeeklyStreak,
  calcDisciplineStats,
  calcAlcoholFreeStreak,
  buildAlcoholTimeline,
  buildValueTimeline,
  describeDay,
  estimateSessionKcalMid,
  sortWeightsDesc,
  isGradeAtLeast,
  gradeGoalProgress,
  filterSessionsByDays,
} from '../stats.js'

// ---------------------------------------------------------------------------
// estimateCalories
// ---------------------------------------------------------------------------

describe('estimateCalories', () => {
  it('calculates low and high from MET × weight × hours', () => {
    const r = estimateCalories({ low: 7.0, high: 9.0 }, 70, 60)
    expect(r.low).toBe(490)
    expect(r.high).toBe(630)
  })

  it('handles 30-minute sessions', () => {
    const r = estimateCalories({ low: 7.0, high: 9.0 }, 70, 30)
    expect(r.low).toBe(245)
    expect(r.high).toBe(315)
  })

  it('rounds to integer', () => {
    const r = estimateCalories({ low: 5.3, high: 7.1 }, 68, 45)
    expect(Number.isInteger(r.low)).toBe(true)
    expect(Number.isInteger(r.high)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getMETRange
// ---------------------------------------------------------------------------

describe('getMETRange', () => {
  it('returns null when activity is missing', () => {
    expect(getMETRange(null, null, 2, null)).toBeNull()
  })

  it('returns null when effort is missing', () => {
    expect(getMETRange('run', null, null, null)).toBeNull()
  })

  it('returns correct range for running effort 2', () => {
    expect(getMETRange('run', null, 2, null)).toEqual({ low: 7.0, high: 9.0 })
  })

  it('returns harder range for running effort 3', () => {
    expect(getMETRange('run', null, 3, null)).toEqual({ low: 9.0, high: 12.0 })
  })

  it('uses stroke type for swim (butterfly effort 2)', () => {
    // MET_SWIM.butterfly = { 1: 8.0, 2: 10.5, 3: 13.8 }
    // effort 2: low=table[1]=8.0, high=table[2]=10.5
    expect(getMETRange('swim', 'butterfly', 2, null)).toEqual({ low: 8.0, high: 10.5 })
  })

  it('falls back to generic swim when no strokeType', () => {
    // MET_CARDIO.swim = { 1: 5.0, 2: 6.0, 3: 8.0 }
    // effort 2: low=5.0, high=6.0
    expect(getMETRange('swim', null, 2, null)).toEqual({ low: 5.0, high: 6.0 })
  })

  it('returns sport range using SPORT_MET_VALUES × effort mods', () => {
    // Squash base MET = 12.0, effort 3 mods = [1.1, 1.35]
    const r = getMETRange('sport', null, 3, 'Squash')
    expect(r.low).toBeCloseTo(13.2)
    expect(r.high).toBeCloseTo(16.2)
  })

  it('returns null for unknown sport key', () => {
    expect(getMETRange('sport', null, 3, 'Quidditch')).toBeNull()
  })

  it('returns null for unknown activity', () => {
    expect(getMETRange('horse_riding', null, 2, null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getPaceMET
// ---------------------------------------------------------------------------

describe('getPaceMET', () => {
  it('returns null when metres or durationMins are missing', () => {
    expect(getPaceMET('run', null, null, 30)).toBeNull()
    expect(getPaceMET('run', null, 5000, null)).toBeNull()
  })

  it('returns null for unknown activity', () => {
    expect(getPaceMET('yoga', null, 5000, 60)).toBeNull()
  })

  it('run: 10 km/h (167 m/min) → MET 10.5 band, ±10%', () => {
    const r = getPaceMET('run', null, 10000, 60) // 10km in 60min = 10 km/h
    expect(r.low).toBeCloseTo(10.5 * 0.9, 1)
    expect(r.high).toBeCloseTo(10.5 * 1.1, 1)
  })

  it('swim breaststroke: 33 m/min → MET 6.0 band', () => {
    const r = getPaceMET('swim', 'breaststroke', 660, 20) // 660m in 20min
    expect(r.low).toBeCloseTo(6.0 * 0.9, 1)
    expect(r.high).toBeCloseTo(6.0 * 1.1, 1)
  })

  it('swim breaststroke: 16.5 m/min → MET 4.0 band (slow)', () => {
    const r = getPaceMET('swim', 'breaststroke', 660, 40) // 660m in 40min
    expect(r.low).toBeCloseTo(4.0 * 0.9, 1)
    expect(r.high).toBeCloseTo(4.0 * 1.1, 1)
  })

  it('slow session burns less per minute than fast session of same distance', () => {
    const fast = getPaceMET('swim', 'breaststroke', 660, 20)
    const slow = getPaceMET('swim', 'breaststroke', 660, 40)
    const fastMidMet = (fast.low + fast.high) / 2
    const slowMidMet = (slow.low + slow.high) / 2
    expect(fastMidMet).toBeGreaterThan(slowMidMet)
  })
})

// ---------------------------------------------------------------------------
// deriveSessionMetres
// ---------------------------------------------------------------------------

describe('deriveSessionMetres', () => {
  it('returns null when no quantity', () => {
    expect(deriveSessionMetres({ cardioActivity: 'run', cardioQuantity: null, cardioUnit: 'km' })).toBeNull()
  })

  it('converts km to metres for run', () => {
    expect(deriveSessionMetres({ cardioActivity: 'run', cardioQuantity: 5, cardioUnit: 'km' })).toBe(5000)
  })

  it('converts swim lengths to metres', () => {
    const s = { cardioActivity: 'swim', cardioQuantity: 20, cardioUnit: 'lengths', cardioPoolLength: 33 }
    expect(deriveSessionMetres(s)).toBe(660)
  })

  it('returns null for swim lengths without pool length', () => {
    const s = { cardioActivity: 'swim', cardioQuantity: 20, cardioUnit: 'lengths', cardioPoolLength: null }
    expect(deriveSessionMetres(s)).toBeNull()
  })

  it('converts miles to metres', () => {
    const m = deriveSessionMetres({ cardioActivity: 'run', cardioQuantity: 1, cardioUnit: 'miles' })
    expect(m).toBe(1609)
  })
})

// ---------------------------------------------------------------------------
// getSwimKcalRange
// ---------------------------------------------------------------------------

describe('getSwimKcalRange', () => {
  it('returns null for missing inputs', () => {
    expect(getSwimKcalRange('breaststroke', null, 70)).toBeNull()
    expect(getSwimKcalRange('breaststroke', 660, null)).toBeNull()
  })

  it('breaststroke 660m at 70 kg → ~178–218 kcal (0.30 × 660 × ±10%)', () => {
    const r = getSwimKcalRange('breaststroke', 660, 70)
    expect(r.low).toBe(Math.round(0.30 * 660 * 0.9))
    expect(r.high).toBe(Math.round(0.30 * 660 * 1.1))
  })

  it('same distance, different durations → same calories (duration-independent)', () => {
    // 660m breaststroke at 95.4 kg — 20 min vs 40 min should give identical result
    const fast = getSwimKcalRange('breaststroke', 660, 95.4)
    const slow = getSwimKcalRange('breaststroke', 660, 95.4)
    expect(fast).toEqual(slow)
  })

  it('heavier person burns more for same distance and stroke', () => {
    const light = getSwimKcalRange('breaststroke', 1000, 60)
    const heavy = getSwimKcalRange('breaststroke', 1000, 100)
    expect(heavy.low).toBeGreaterThan(light.low)
  })

  it('longer distance burns more than shorter for same stroke and weight', () => {
    const short = getSwimKcalRange('front_crawl', 500, 70)
    const long  = getSwimKcalRange('front_crawl', 1000, 70)
    expect(long.low).toBeGreaterThan(short.low)
  })

  it('falls back to general for unknown stroke', () => {
    const r = getSwimKcalRange('sidestroke', 1000, 70)
    const g = getSwimKcalRange('general', 1000, 70)
    expect(r).toEqual(g)
  })

  it('butterfly costs more per metre than front crawl', () => {
    const fly   = getSwimKcalRange('butterfly',  1000, 70)
    const crawl = getSwimKcalRange('front_crawl', 1000, 70)
    expect(fly.low).toBeGreaterThan(crawl.low)
  })
})

// ---------------------------------------------------------------------------
// gradeLevel / gradeColor
// ---------------------------------------------------------------------------

describe('gradeLevel', () => {
  it('maps V-grades to levels', () => {
    expect(gradeLevel('V0', 'v')).toBe('Beginner')
    expect(gradeLevel('V4', 'v')).toBe('Advanced')
    expect(gradeLevel('V8', 'v')).toBe('Elite')
  })

  it('maps French grades to levels', () => {
    expect(gradeLevel('6a', 'french')).toBe('Intermediate')
    expect(gradeLevel('7b', 'french')).toBe('Expert')
    expect(gradeLevel('8a', 'french')).toBe('Elite')
  })

  it('returns null for unknown grade', () => {
    expect(gradeLevel('V99', 'v')).toBeNull()
    expect(gradeLevel('11a', 'french')).toBeNull()
  })
})

describe('gradeColor', () => {
  it('returns the level colour for a known grade', () => {
    expect(gradeColor('V0', 'v')).toBe('#8892a4')   // Beginner
    expect(gradeColor('V8', 'v')).toBe('#ea580c')   // Elite
  })

  it('returns grey for an unknown grade', () => {
    expect(gradeColor('V99', 'v')).toBe('#7a8299')
  })
})

// ---------------------------------------------------------------------------
// mondayOf
// ---------------------------------------------------------------------------

describe('mondayOf', () => {
  it('returns the same date when input is already a Monday', () => {
    expect(mondayOf('2026-06-01')).toBe('2026-06-01') // June 1 2026 is Monday
  })

  it('returns the preceding Monday for a Wednesday', () => {
    expect(mondayOf('2026-06-03')).toBe('2026-06-01')
  })

  it('returns the preceding Monday for a Sunday', () => {
    expect(mondayOf('2026-06-07')).toBe('2026-06-01')
  })
})

// ---------------------------------------------------------------------------
// calcBestWeekStreak
// ---------------------------------------------------------------------------

describe('calcBestWeekStreak', () => {
  it('returns 0 for empty set', () => {
    expect(calcBestWeekStreak({})).toBe(0)
  })

  it('returns 1 for a single week', () => {
    expect(calcBestWeekStreak({ '2026-06-01': true })).toBe(1)
  })

  it('counts consecutive weeks', () => {
    const weeks = {
      '2026-05-18': true,
      '2026-05-25': true,
      '2026-06-01': true,
    }
    expect(calcBestWeekStreak(weeks)).toBe(3)
  })

  it('ignores gaps and finds the best run', () => {
    const weeks = {
      '2026-04-27': true, // isolated
      '2026-05-18': true,
      '2026-05-25': true,
      '2026-06-01': true, // run of 3
    }
    expect(calcBestWeekStreak(weeks)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// calcWeeklyStreak  (date-sensitive — mock to 2026-06-01, a Monday)
// ---------------------------------------------------------------------------

describe('calcWeeklyStreak', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-01T12:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  const session = (date) => ({ date, type: 'climb', climbs: [] })

  it('returns zeros with no sessions', () => {
    expect(calcWeeklyStreak([])).toEqual({ current: 0, best: 0 })
  })

  it('returns current=1 for a session this week only', () => {
    const result = calcWeeklyStreak([session('2026-06-01')])
    expect(result.current).toBe(1)
    expect(result.best).toBeGreaterThanOrEqual(1)
  })

  it('returns current=2 for sessions this week and last week', () => {
    const result = calcWeeklyStreak([session('2026-06-01'), session('2026-05-25')])
    expect(result.current).toBe(2)
    expect(result.best).toBe(2)
  })

  it('breaks streak on a gap week', () => {
    // Last week (2026-05-25) and three weeks ago (2026-05-11) — gap at 2026-05-18
    const result = calcWeeklyStreak([session('2026-06-01'), session('2026-05-11')])
    expect(result.current).toBe(1)
    expect(result.best).toBe(1)
  })

  it('returns current=0 when no session this week or last week', () => {
    const result = calcWeeklyStreak([session('2026-05-10')])
    expect(result.current).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// calcDisciplineStats
// ---------------------------------------------------------------------------

describe('calcDisciplineStats', () => {
  const V_GRADES = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10']

  const climbSession = (climbs) => ({ date: '2026-06-01', type: 'climb', climbs })
  const climb = (grade, outcome) => ({ discipline: 'boulder', grade, outcome })

  it('returns hasData=false with no sessions', () => {
    const r = calcDisciplineStats([], ['boulder'], V_GRADES, 'v')
    expect(r.hasData).toBe(false)
    expect(r.total).toBe(0)
  })

  it('counts total climbs and sends', () => {
    const sessions = [
      climbSession([
        climb('V3', 'sent'),
        climb('V3', 'attempted'),
        climb('V4', 'flashed'),
      ])
    ]
    const r = calcDisciplineStats(sessions, ['boulder'], V_GRADES, 'v')
    expect(r.total).toBe(3)
    expect(r.sends).toBe(2)
    expect(r.flashes).toBe(1)
  })

  it('reports the highest send grade', () => {
    const sessions = [
      climbSession([climb('V3', 'sent'), climb('V5', 'sent')])
    ]
    const r = calcDisciplineStats(sessions, ['boulder'], V_GRADES, 'v')
    expect(r.highestSend.grade).toBe('V5')
  })

  it('calculates consistent grade (≥40% send rate, ≥3 attempts)', () => {
    // 4 attempts at V4, 3 sent (75%) → consistent at V4
    const sessions = [
      climbSession([
        climb('V4', 'sent'),
        climb('V4', 'sent'),
        climb('V4', 'sent'),
        climb('V4', 'attempted'),
      ])
    ]
    const r = calcDisciplineStats(sessions, ['boulder'], V_GRADES, 'v')
    expect(r.consistent).not.toBeNull()
    expect(r.consistent.grade).toBe('V4')
    expect(r.consistent.level).toBe('Advanced')
  })

  it('does not set consistent grade with fewer than 3 attempts', () => {
    const sessions = [
      climbSession([climb('V8', 'sent'), climb('V8', 'sent')])
    ]
    const r = calcDisciplineStats(sessions, ['boulder'], V_GRADES, 'v')
    expect(r.consistent).toBeNull()
  })

  it('ignores climbs outside the specified disciplines', () => {
    const sessions = [
      climbSession([
        { discipline: 'lead', grade: 'V3', outcome: 'sent' }, // wrong discipline
      ])
    ]
    const r = calcDisciplineStats(sessions, ['boulder'], V_GRADES, 'v')
    expect(r.total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// calcAlcoholFreeStreak  (date-sensitive — mock to 2026-06-01)
// ---------------------------------------------------------------------------

describe('calcAlcoholFreeStreak', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-01T12:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  it('returns 0 days when today has a drink entry', () => {
    const r = calcAlcoholFreeStreak([{ date: '2026-06-01' }])
    expect(r.days).toBe(0)
  })

  it('counts consecutive free days', () => {
    // Drank 4 days ago (2026-05-28), free since 2026-05-29 → 4 days free
    const r = calcAlcoholFreeStreak([{ date: '2026-05-28' }])
    expect(r.days).toBe(4)
    expect(r.weeks).toBe(0)
  })

  it('computes weeks from days', () => {
    // Drank 15 days ago → 15 free days → 2 weeks
    const r = calcAlcoholFreeStreak([{ date: '2026-05-17' }])
    expect(r.days).toBe(15)
    expect(r.weeks).toBe(2)
  })

  it('handles empty log (hits safety cap)', () => {
    const r = calcAlcoholFreeStreak([])
    expect(r.days).toBeGreaterThan(3649)
  })
})

// ---------------------------------------------------------------------------
// filterSessionsByDays  (date-sensitive — mock to 2026-06-01)
// ---------------------------------------------------------------------------

describe('filterSessionsByDays', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-01T12:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  const sessions = [
    { date: '2026-06-01', type: 'climb' }, // today
    { date: '2026-05-25', type: 'climb' }, // 7 days ago
    { date: '2026-05-01', type: 'climb' }, // 31 days ago
    { date: '2026-01-01', type: 'climb' }, // very old
  ]

  it('returns all sessions within the window', () => {
    expect(filterSessionsByDays(sessions, 30).length).toBe(2)
  })

  it('includes sessions exactly at the cutoff boundary', () => {
    const result = filterSessionsByDays(sessions, 7)
    expect(result.map(s => s.date)).toContain('2026-05-25')
  })

  it('returns all when window is large', () => {
    expect(filterSessionsByDays(sessions, 365).length).toBe(4)
  })

  it('returns empty array when all sessions are old', () => {
    expect(filterSessionsByDays([{ date: '2020-01-01' }], 7).length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildAlcoholTimeline  (date-sensitive — mock to 2026-06-01, a Monday)
// ---------------------------------------------------------------------------

describe('buildAlcoholTimeline', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-01T12:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  const entry = (date, units, kcal) => ({ id: date + units, date, units, kcal: kcal || 0 })

  it('builds 30 daily buckets ending today', () => {
    const r = buildAlcoholTimeline([], 'day')
    expect(r.buckets.length).toBe(30)
    expect(r.buckets[0].start).toBe('2026-05-03')
    expect(r.buckets[29].start).toBe('2026-06-01')
    expect(r.totalDays).toBe(30)
  })

  it('builds 13 weekly buckets aligned to Mondays', () => {
    // 13, not 12: the chip that selects this mode says 90d, and 12 Monday-aligned
    // weeks only cover 84 days.
    const r = buildAlcoholTimeline([], 'week')
    expect(r.buckets.length).toBe(13)
    expect(r.buckets[12].start).toBe('2026-06-01')
    expect(r.buckets[0].start).toBe('2026-03-09')
    expect(r.buckets[12].end).toBe('2026-06-07')
  })

  it('builds 12 monthly buckets keyed by YYYY-MM', () => {
    const r = buildAlcoholTimeline([], 'month')
    expect(r.buckets.length).toBe(12)
    expect(r.buckets[11].key).toBe('2026-06')
    expect(r.buckets[0].key).toBe('2025-07')
  })

  it('counts servings, not log entries', () => {
    // The bug this guards: one entry logged as "4x Beer/Cider" reported as
    // "1 drink", because the bucket counted records rather than quantity.
    const r = buildAlcoholTimeline([
      { id: 'a', date: '2026-06-01', units: 10.2, kcal: 800, quantity: 4 },
    ], 'week')
    expect(r.buckets[12].drinks).toBe(4)
  })

  it('adds quantities across entries in the same bucket', () => {
    const r = buildAlcoholTimeline([
      { id: 'a', date: '2026-06-01', units: 5, kcal: 400, quantity: 2 },
      { id: 'b', date: '2026-06-01', units: 2.5, kcal: 200, quantity: 1 },
    ], 'week')
    expect(r.buckets[12].drinks).toBe(3)
  })

  it('ignores entries outside the window when counting drinks', () => {
    // Today is mocked to 2026-06-01, so a later date is in the future.
    const r = buildAlcoholTimeline([
      { id: 'a', date: '2026-06-01', units: 5, kcal: 400, quantity: 2 },
      { id: 'b', date: '2026-06-02', units: 99, kcal: 999, quantity: 9 },
    ], 'week')
    expect(r.buckets[12].drinks).toBe(2)
  })

  it('counts an entry with no usable quantity as one drink', () => {
    // Entries predating the quantity field, or carrying junk, must not vanish.
    const r = buildAlcoholTimeline([
      { id: 'a', date: '2026-06-01', units: 2, kcal: 100 },
      { id: 'b', date: '2026-06-01', units: 2, kcal: 100, quantity: 0 },
      { id: 'c', date: '2026-06-01', units: 2, kcal: 100, quantity: -3 },
    ], 'week')
    expect(r.buckets[12].drinks).toBe(3)
  })

  it('sums units and kcal into the right weekly bucket', () => {
    const r = buildAlcoholTimeline([
      entry('2026-06-01', 2.5, 140),
      entry('2026-06-01', 1.5, 90),
      entry('2026-05-26', 3, 170),
    ], 'week')
    expect(r.buckets[12].units).toBe(4)
    expect(r.buckets[12].kcal).toBe(230)
    expect(r.buckets[11].units).toBe(3)
    expect(r.totalUnits).toBe(7)
    expect(r.totalKcal).toBe(400)
    expect(r.maxUnits).toBe(4)
  })

  it('counts dry days across the window, not per entry', () => {
    const r = buildAlcoholTimeline([
      entry('2026-06-01', 2),
      entry('2026-06-01', 2),
      entry('2026-05-28', 1),
    ], 'day')
    expect(r.drinkingDays).toBe(2)
    expect(r.dryDays).toBe(28)
  })

  it('totals the previous equal-length window separately', () => {
    const r = buildAlcoholTimeline([
      entry('2026-05-20', 4),   // in window
      entry('2026-04-20', 6),   // previous 30-day window
      entry('2026-01-01', 9),   // older than both
    ], 'day')
    expect(r.totalUnits).toBe(4)
    expect(r.prevUnits).toBe(6)
  })

  it('flags whether there is history behind the window to compare against', () => {
    expect(buildAlcoholTimeline([entry('2026-05-20', 4)], 'day').hasPrevData).toBe(false)
    expect(buildAlcoholTimeline([entry('2026-04-20', 4)], 'day').hasPrevData).toBe(true)
  })

  it('averages units per week and exposes the UK guideline', () => {
    const r = buildAlcoholTimeline([entry('2026-05-25', 12)], 'week')
    expect(r.guideline).toBe(14)
    expect(r.avgUnitsPerWeek).toBe(1)  // 12 units over an 85-day window
    expect(buildAlcoholTimeline([], 'day').guideline).toBe(null)
  })

  it('handles an empty log', () => {
    const r = buildAlcoholTimeline([], 'week')
    expect(r.totalUnits).toBe(0)
    expect(r.maxUnits).toBe(0)
    expect(r.dryDays).toBe(r.totalDays)
  })

  it('falls back to week mode for an unknown mode', () => {
    expect(buildAlcoholTimeline([], 'decade').mode).toBe('week')
  })
})

// ---------------------------------------------------------------------------
// isGradeAtLeast
// ---------------------------------------------------------------------------

describe('isGradeAtLeast', () => {
  it('counts a harder grade towards an easier goal', () => {
    // The bug this guards: goal progress tested grade === target, so sending
    // 7a+ scored nothing against a 7a goal.
    expect(isGradeAtLeast('7a+', '7a', 'french')).toBe(true)
    expect(isGradeAtLeast('V6', 'V5', 'v')).toBe(true)
    expect(isGradeAtLeast('9a', '6a', 'french')).toBe(true)
  })

  it('counts an exact match', () => {
    expect(isGradeAtLeast('7a', '7a', 'french')).toBe(true)
    expect(isGradeAtLeast('V5', 'V5', 'v')).toBe(true)
  })

  it('rejects an easier grade', () => {
    expect(isGradeAtLeast('6c+', '7a', 'french')).toBe(false)
    expect(isGradeAtLeast('V4', 'V5', 'v')).toBe(false)
  })

  it('orders French plus-grades correctly', () => {
    expect(isGradeAtLeast('6a+', '6a', 'french')).toBe(true)
    expect(isGradeAtLeast('6a', '6a+', 'french')).toBe(false)
    expect(isGradeAtLeast('6b', '6a+', 'french')).toBe(true)
  })

  it('rejects grades the system does not know, rather than guessing', () => {
    expect(isGradeAtLeast('V5', '7a', 'french')).toBe(false)   // wrong system
    expect(isGradeAtLeast('7a', 'V5', 'v')).toBe(false)
    expect(isGradeAtLeast('', '7a', 'french')).toBe(false)
    expect(isGradeAtLeast(null, '7a', 'french')).toBe(false)
    expect(isGradeAtLeast('7a', undefined, 'french')).toBe(false)
    expect(isGradeAtLeast('banana', '7a', 'french')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// gradeGoalProgress
// ---------------------------------------------------------------------------

describe('gradeGoalProgress', () => {
  it('measures from the goal\'s start value, not from zero', () => {
    // 6a+ -> 7a is five steps (6b, 6b+, 6c, 6c+, 7a). Standing on 6c is 3 of 5.
    expect(gradeGoalProgress('6a+', '6c', '7a', 'french')).toBeCloseTo(0.6, 5)
    expect(gradeGoalProgress('6a+', '6a+', '7a', 'french')).toBe(0)
  })

  it('is complete at or beyond the target', () => {
    expect(gradeGoalProgress('V2', 'V5', 'V5', 'v')).toBe(1)
    expect(gradeGoalProgress('V2', 'V7', 'V5', 'v')).toBe(1)
  })

  it('returns 0 rather than guessing when a grade is unplaceable', () => {
    expect(gradeGoalProgress('6a+', 'banana', '7a', 'french')).toBe(0)
    expect(gradeGoalProgress('6a+', '6c', 'banana', 'french')).toBe(0)
    expect(gradeGoalProgress('V2', '6c', '7a', 'french')).toBe(0)   // start from wrong system
    expect(gradeGoalProgress(null, '6c', '7a', 'french')).toBe(0)
  })

  it('returns 0 when the goal was set at or above where you already were', () => {
    // No span to measure across — reporting a fraction would be invention.
    expect(gradeGoalProgress('7a', '6c', '7a', 'french')).toBe(0)
    expect(gradeGoalProgress('7b', '6c', '7a', 'french')).toBe(0)
  })

  it('never leaves the 0..1 range', () => {
    expect(gradeGoalProgress('6c', '6a', '7a', 'french')).toBe(0)   // slipped below the start
    expect(gradeGoalProgress('V1', 'V3', 'V5', 'v')).toBeCloseTo(0.5, 5)
  })
})

// ---------------------------------------------------------------------------
// buildValueTimeline  (date-sensitive — mock to 2026-06-01, a Monday)
// ---------------------------------------------------------------------------

describe('buildValueTimeline', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-01T12:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  const mins = s => s.cardioDurationMins || 0

  it('shares its buckets with the alcohol timeline', () => {
    // The point of the extraction: cardio, gym and alcohol cover the same span
    // and label their axes the same way.
    const v = buildValueTimeline([], 'week', mins)
    const a = buildAlcoholTimeline([], 'week')
    expect(v.buckets.map(b => b.key)).toEqual(a.buckets.map(b => b.key))
    expect(v.buckets.map(b => b.label)).toEqual(a.buckets.map(b => b.label))
    expect(v.totalDays).toBe(a.totalDays)
  })

  it('sums values into the right bucket and counts the records', () => {
    const r = buildValueTimeline([
      { date: '2026-06-01', cardioDurationMins: 30 },
      { date: '2026-06-01', cardioDurationMins: 45 },
      { date: '2026-05-26', cardioDurationMins: 20 },
    ], 'week', mins)
    expect(r.buckets[12].value).toBe(75)
    expect(r.buckets[12].count).toBe(2)
    expect(r.buckets[11].value).toBe(20)
    expect(r.total).toBe(95)
    expect(r.maxValue).toBe(75)
  })

  it('counts a record with no value, so an empty session still registers', () => {
    // A gym session with every exercise skipped is still a session that
    // happened — the bar is zero, the readout is not "no sessions".
    const r = buildValueTimeline([{ date: '2026-06-01' }], 'week', mins)
    expect(r.buckets[12].value).toBe(0)
    expect(r.buckets[12].count).toBe(1)
  })

  it('ignores records outside the window, in both directions', () => {
    const r = buildValueTimeline([
      { date: '2026-06-02', cardioDurationMins: 99 },   // future
      { date: '2025-01-01', cardioDurationMins: 99 },   // before the window
      { date: '2026-06-01', cardioDurationMins: 10 },
    ], 'week', mins)
    expect(r.total).toBe(10)
  })

  it('buckets by day and by month too', () => {
    const day = buildValueTimeline([{ date: '2026-06-01', cardioDurationMins: 10 }], 'day', mins)
    expect(day.buckets.length).toBe(30)
    expect(day.buckets[29].value).toBe(10)

    const month = buildValueTimeline([{ date: '2026-05-04', cardioDurationMins: 10 }], 'month', mins)
    expect(month.buckets.length).toBe(12)
    expect(month.buckets[10].key).toBe('2026-05')
    expect(month.buckets[10].value).toBe(10)
  })

  it('handles an empty log, junk records and a missing accessor', () => {
    expect(buildValueTimeline([], 'week', mins).total).toBe(0)
    expect(buildValueTimeline(null, 'week', mins).maxValue).toBe(0)
    expect(buildValueTimeline([null, {}, { date: '2026-06-01' }], 'week', mins).total).toBe(0)
    expect(buildValueTimeline([{ date: '2026-06-01' }], 'week').total).toBe(0)
  })

  it('falls back to week mode for an unknown mode', () => {
    expect(buildValueTimeline([], 'fortnight', mins).mode).toBe('week')
  })
})


// ---------------------------------------------------------------------------
// describeDay
// ---------------------------------------------------------------------------

describe('describeDay', () => {
  const D = '2026-06-04'   // a Thursday

  it('names the day, short and dated', () => {
    expect(describeDay(D, [], []).label).toBe('Thu 4')
  })

  it('says nothing happened when nothing did', () => {
    const r = describeDay(D, [{ type: 'gym', date: '2026-06-03' }], [])
    expect(r.isEmpty).toBe(true)
    expect(r.parts).toEqual([])
  })

  it('counts gym sets, skipping exercises marked not done', () => {
    const r = describeDay(D, [{
      type: 'gym', date: D, exercises: [
        { sets: [{}, {}, {}] },
        { done: false, sets: [{}, {}] },
      ],
    }], [])
    expect(r.parts).toEqual(['Gym 3 sets'])
  })

  it('summarises climbs by count and hardest send', () => {
    const r = describeDay(D, [{
      type: 'climb', date: D, climbs: [
        { grade: 'V2', discipline: 'boulder', outcome: 'sent' },
        { grade: 'V5', discipline: 'boulder', outcome: 'flashed' },
        { grade: 'V7', discipline: 'boulder', outcome: 'failed' },
      ],
    }], [])
    // V7 was not sent, so it is not the day's grade.
    expect(r.parts).toEqual(['3 climbs to V5'])
  })

  it('reads french grades on rope climbs, not the V scale', () => {
    const r = describeDay(D, [{
      type: 'climb', date: D, climbs: [
        { grade: '6a', discipline: 'lead', outcome: 'sent' },
        { grade: '6c+', discipline: 'toprope', outcome: 'sent' },
      ],
    }], [])
    expect(r.parts).toEqual(['2 climbs to 6c+'])
  })

  it('names each cardio session with its duration', () => {
    const r = describeDay(D, [
      { type: 'cardio', date: D, cardioActivity: 'swim', cardioDurationMins: 40 },
      { type: 'cardio', date: D, cardioActivity: 'run',  cardioDurationMins: 30 },
    ], [])
    expect(r.parts).toEqual(['Swim 40m', 'Run 30m'])
  })

  it("adds hangboard and the day's units", () => {
    const r = describeDay(D, [{ type: 'hangboard', date: D }], [
      { date: D, units: 2.5 },
      { date: D, units: 1 },
      { date: '2026-06-03', units: 9 },
    ])
    expect(r.parts).toEqual(['Hangboard', '3.5 units'])
  })

  it('names a session type it has never heard of', () => {
    // The calendar's dots fall back to neutral for an unknown type; the readout
    // must not silently drop it either.
    const r = describeDay(D, [{ type: 'yoga', date: D }], [])
    expect(r.parts).toEqual(['Yoga'])
  })

  it('builds a full day in a stable order', () => {
    const r = describeDay(D, [
      { type: 'cardio', date: D, cardioActivity: 'run', cardioDurationMins: 30 },
      { type: 'gym', date: D, exercises: [{ sets: [{}, {}] }] },
      { type: 'climb', date: D, climbs: [{ grade: 'V4', discipline: 'boulder', outcome: 'sent' }] },
    ], [{ date: D, units: 2 }])
    expect(r.parts).toEqual(['Gym 2 sets', '1 climb to V4', 'Run 30m', '2 units'])
  })

  it('survives missing sessions, drinks and climb lists', () => {
    expect(describeDay(D, null, null).isEmpty).toBe(true)
    expect(describeDay(D, [{ type: 'climb', date: D }], []).parts).toEqual(['Climbing'])
  })
})


// ---------------------------------------------------------------------------
// estimateSessionKcalMid
// ---------------------------------------------------------------------------

describe('estimateSessionKcalMid', () => {
  const weights = sortWeightsDesc([
    { date: '2026-01-01', weight: 90 },
    { date: '2026-06-01', weight: 80 },
  ])

  it('prefers the calories logged on the session', () => {
    const r = estimateSessionKcalMid(
      { date: '2026-06-10', type: 'cardio', cardioKcalLow: 300, cardioKcalHigh: 400 },
      weights, 80,
    )
    expect(r).toBe(350)
  })

  it('estimates a run from its pace', () => {
    const r = estimateSessionKcalMid(
      { date: '2026-06-10', type: 'cardio', cardioActivity: 'run', cardioDurationMins: 30, cardioQuantity: 5, cardioUnit: 'km' },
      weights, 80,
    )
    expect(r).toBeGreaterThan(0)
  })

  it('falls back to the effort slider with no distance', () => {
    const r = estimateSessionKcalMid(
      { date: '2026-06-10', type: 'cardio', cardioActivity: 'row', cardioDurationMins: 45, difficulty: 3 },
      weights, 80,
    )
    expect(r).toBeGreaterThan(0)
  })

  it('costs a session at the weight recorded on or before it, not today\'s', () => {
    const old = estimateSessionKcalMid(
      { date: '2026-03-01', type: 'cardio', cardioActivity: 'row', cardioDurationMins: 45, difficulty: 3 },
      weights, 80,
    )
    const recent = estimateSessionKcalMid(
      { date: '2026-06-10', type: 'cardio', cardioActivity: 'row', cardioDurationMins: 45, difficulty: 3 },
      weights, 80,
    )
    // March is costed at 90kg, June at 80kg — heavier body, more calories.
    expect(old).toBeGreaterThan(recent)
  })

  it('uses the profile weight when no entry predates the session', () => {
    const r = estimateSessionKcalMid(
      { date: '2025-01-01', type: 'cardio', cardioActivity: 'row', cardioDurationMins: 45, difficulty: 3 },
      weights, 75,
    )
    expect(r).toBeGreaterThan(0)
  })

  it('returns null when there is nothing to go on', () => {
    expect(estimateSessionKcalMid(null, weights, 80)).toBe(null)
    // No weight anywhere, so no estimate is possible.
    expect(estimateSessionKcalMid(
      { date: '2026-06-10', type: 'cardio', cardioActivity: 'row', cardioDurationMins: 45, difficulty: 3 },
      [], null,
    )).toBe(null)
    // No duration, no distance, no logged calories.
    expect(estimateSessionKcalMid({ date: '2026-06-10', type: 'cardio', cardioActivity: 'run' }, weights, 80)).toBe(null)
  })
})
