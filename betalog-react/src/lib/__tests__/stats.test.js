import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  estimateCalories,
  getMETRange,
  gradeLevel,
  gradeColor,
  mondayOf,
  calcBestWeekStreak,
  calcWeeklyStreak,
  calcDisciplineStats,
  calcAlcoholFreeStreak,
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
