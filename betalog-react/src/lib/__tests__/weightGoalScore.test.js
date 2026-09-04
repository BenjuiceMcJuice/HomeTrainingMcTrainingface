import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scoreWeightGoal, estimateMaintenance, deficitForRate,
  demonstratedLossRate, recentTrend, counterOffer, topReasons, SCORE_COLOR,
} from '../weightGoalScore'

describe('deficitForRate', () => {
  it('converts kg a week into kcal a day at 7,700 kcal/kg', () => {
    expect(deficitForRate(0.5)).toBe(550)      // 0.5 * 7700 / 7
    expect(deficitForRate(1)).toBe(1100)
    expect(deficitForRate(1.33)).toBe(1463)
  })

  it('ignores direction and junk', () => {
    expect(deficitForRate(-0.5)).toBe(550)
    expect(deficitForRate(null)).toBe(null)
    expect(deficitForRate('fast')).toBe(null)
  })
})

describe('estimateMaintenance', () => {
  it('uses Mifflin-St Jeor when sex and age are known', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    const m = estimateMaintenance({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male', sessionsPerWeek: 3 })
    expect(m.rmr).toBe(1780)
    expect(m.activityFactor).toBe(1.5)
    expect(m.maintenance).toBe(2670)
    expect(m.assumptions).toEqual([])
  })

  it('declares every assumption it had to make', () => {
    const m = estimateMaintenance({ weightKg: 80, heightCm: 180 })
    expect(m.assumptions).toHaveLength(3)      // age, sex, training frequency
    expect(m.assumptions.join(' ')).toMatch(/age assumed 35/)
    expect(m.assumptions.join(' ')).toMatch(/sex not recorded/)
  })

  it('sits the unknown-sex estimate between the two formulas', () => {
    const male   = estimateMaintenance({ weightKg: 80, heightCm: 180, ageYears: 35, sex: 'male' })
    const female = estimateMaintenance({ weightKg: 80, heightCm: 180, ageYears: 35, sex: 'female' })
    const either = estimateMaintenance({ weightKg: 80, heightCm: 180, ageYears: 35 })
    expect(either.rmr).toBeLessThan(male.rmr)
    expect(either.rmr).toBeGreaterThan(female.rmr)
  })

  it('reads activity off training frequency, and stops where it stops being credible', () => {
    expect(estimateMaintenance({ weightKg: 80, heightCm: 180, sessionsPerWeek: 0 }).activityFactor).toBe(1.35)
    expect(estimateMaintenance({ weightKg: 80, heightCm: 180, sessionsPerWeek: 6 }).activityFactor).toBe(1.65)
    expect(estimateMaintenance({ weightKg: 80, heightCm: 180, sessionsPerWeek: 20 }).activityFactor).toBe(1.75)
  })

  it('says nothing without height and weight', () => {
    expect(estimateMaintenance({ weightKg: 80 }).maintenance).toBe(null)
    expect(estimateMaintenance({}).rmr).toBe(null)
  })
})

describe('demonstratedLossRate', () => {
  it('finds the best sustained month anywhere in the log', () => {
    const log = [
      { date: '2026-01-01', weight: 90 },
      { date: '2026-01-29', weight: 87 },   // 3 kg in 28 days = 0.75 kg/wk
      { date: '2026-03-01', weight: 88 },
      { date: '2026-03-29', weight: 87.5 },
    ]
    const best = demonstratedLossRate(log)
    expect(best.kgPerWeek).toBe(0.75)
    expect(best.from).toBe('2026-01-01')
  })

  it('returns a negative rate when the log only shows gain', () => {
    const best = demonstratedLossRate([
      { date: '2026-01-01', weight: 90 },
      { date: '2026-01-29', weight: 92 },
    ])
    expect(best.kgPerWeek).toBe(-0.5)
  })

  it('needs two weigh-ins roughly a month apart', () => {
    expect(demonstratedLossRate([])).toBe(null)
    expect(demonstratedLossRate([{ date: '2026-01-01', weight: 90 }])).toBe(null)
    // A week apart is not a month
    expect(demonstratedLossRate([
      { date: '2026-01-01', weight: 90 },
      { date: '2026-01-08', weight: 89 },
    ])).toBe(null)
  })
})

describe('demonstratedLossRate — the history bound', () => {
  it('ignores a good month from years ago', () => {
    const log = [
      { date: '2022-01-01', weight: 95 },
      { date: '2022-01-29', weight: 91 },   // 1 kg/wk, but four years back
      { date: '2026-08-07', weight: 90 },
      { date: '2026-09-04', weight: 89.6 }, // 0.1 kg/wk, and recent
    ]
    expect(demonstratedLossRate(log).kgPerWeek).toBe(0.1)
    // The cap is a parameter, so the old month is still reachable on request
    expect(demonstratedLossRate(log, 28, null).kgPerWeek).toBe(1)
  })

  it('keeps the scan bounded on a long daily log', () => {
    // Three years of daily weighing: unbounded this is ~1.2M comparisons on
    // every render of a Dashboard card.
    const log = []
    for (let i = 1100; i >= 0; i--) {
      const d = new Date('2026-09-04T00:00:00'); d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), weight: 90 + (i % 7) * 0.1 })
    }
    const started = Date.now()
    expect(demonstratedLossRate(log)).not.toBe(null)
    expect(Date.now() - started).toBeLessThan(120)
  })
})

describe('topReasons', () => {
  it('gives the two worst, worst first', () => {
    const s = {
      score: 2,
      reasons: [
        { factor: 'a', penalty: 0.5, detail: 'mild' },
        { factor: 'b', penalty: 1.5, detail: 'worst' },
        { factor: 'c', penalty: 0,   detail: 'fine' },
        { factor: 'd', penalty: 1,   detail: 'bad' },
      ],
    }
    expect(topReasons(s)).toEqual(['worst', 'bad'])
    expect(topReasons(s, 1)).toEqual(['worst'])
  })

  it('says nothing at 4 or 5 — there is nothing to say', () => {
    const s = { score: 4, reasons: [{ factor: 'a', penalty: 0.75, detail: 'meh' }] }
    expect(topReasons(s)).toEqual([])
    expect(topReasons({ score: 5, reasons: [] })).toEqual([])
    expect(topReasons(null)).toEqual([])
  })
})

describe('SCORE_COLOR', () => {
  it('covers every score on the scale', () => {
    [1, 2, 3, 4, 5].forEach(n => expect(SCORE_COLOR[n]).toMatch(/^#[0-9a-f]{6}$/))
  })
})

describe('recentTrend', () => {
  it('reads direction over the last 30 days', () => {
    expect(recentTrend([
      { date: '2026-08-08', weight: 95 },
      { date: '2026-09-04', weight: 96 },
    ], 30, '2026-09-04')).toBeCloseTo(0.26, 2)
  })

  it('ignores entries outside the window and thin logs', () => {
    expect(recentTrend([{ date: '2020-01-01', weight: 90 }], 30, '2026-09-04')).toBe(null)
    expect(recentTrend([], 30, '2026-09-04')).toBe(null)
  })
})

describe('counterOffer', () => {
  it('compounds the rate rather than multiplying it', () => {
    // 0.7% *of a falling bodyweight*: the last week takes off less than the
    // first, so 8 weeks lands at 90.5 rather than the 91.0 a flat 0.67 kg/wk
    // subtraction would give.
    const c = counterOffer({ currentKg: 95.8, targetKg: 85, days: 57, pctPerWeek: 0.7 })
    expect(c.targetForDate).toBe(90.5)
  })

  it('says how long the original target would actually take', () => {
    const c = counterOffer({ currentKg: 95.8, targetKg: 85, days: 57, pctPerWeek: 0.7 })
    expect(c.weeksForTarget).toBe(17)
    expect(c.daysForTarget).toBe(119)
  })

  it('handles a target at or above current weight', () => {
    expect(counterOffer({ currentKg: 80, targetKg: 85, days: 30 }).weeksForTarget).toBe(null)
    expect(counterOffer({}).targetForDate).toBe(null)
  })
})

// ---------------------------------------------------------------------------
// The worked example — real numbers off a real phone, 2026-09-04
// ---------------------------------------------------------------------------

describe('scoreWeightGoal — 95.8 kg, 186 cm, 85 kg in 57 days', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-04T12:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  // 11 weigh-ins over 90 days, drifting up from 93.8 to 95.8
  const LOG = [
    { date: '2026-06-08', weight: 93.8 }, { date: '2026-06-16', weight: 95.3 },
    { date: '2026-06-24', weight: 93.9 }, { date: '2026-07-02', weight: 95.1 },
    { date: '2026-07-10', weight: 94.8 }, { date: '2026-07-18', weight: 94.8 },
    { date: '2026-07-26', weight: 94.5 }, { date: '2026-08-03', weight: 94.0 },
    { date: '2026-08-11', weight: 93.7 }, { date: '2026-08-19', weight: 95.2 },
    { date: '2026-09-04', weight: 95.8 },
  ]
  const GOAL = { target: 85, startValue: 94.3, targetDate: '2026-10-31', createdAt: '2026-08-05' }
  const OPTS = { goal: GOAL, currentKg: 95.8, heightCm: 186, weightEntries: LOG, sessionsPerWeek: 3 }

  it('scores it 1 — not achievable as set', () => {
    const s = scoreWeightGoal(OPTS)
    expect(s.score).toBe(1)
    expect(s.label).toBe('Not achievable as set')
  })

  it('gets the rate and the deficit right', () => {
    const s = scoreWeightGoal(OPTS)
    expect(s.rate.remainingKg).toBe(10.8)
    expect(s.rate.days).toBe(57)
    expect(s.rate.kgPerWeek).toBe(1.33)
    expect(s.rate.pctPerWeek).toBe(1.39)
    expect(s.rate.blocked).toBe(true)
    expect(s.deficitKcalPerDay).toBe(1463)
  })

  it('puts the deficit at about half of maintenance, under resting need', () => {
    const s = scoreWeightGoal(OPTS)
    expect(s.maintenance.rmr).toBe(1868)
    expect(s.maintenance.maintenance).toBe(2801)
    expect(s.deficitPctOfMaintenance).toBeGreaterThan(50)
    expect(s.impliedIntake).toBe(1338)
    expect(s.belowRmr).toBe(true)
  })

  it('reads the log: no sustained loss, and the trend is upward', () => {
    const s = scoreWeightGoal(OPTS)
    expect(s.demonstrated.kgPerWeek).toBeLessThan(0.4)
    expect(s.trendKgPerWeek).toBeGreaterThan(0)
  })

  it('names every reason rather than just producing a number', () => {
    const s = scoreWeightGoal(OPTS)
    const bad = s.reasons.filter(r => r.verdict === 'bad').map(r => r.factor)
    expect(bad).toContain('headroom')
    expect(bad).toContain('trend')
    expect(bad).toContain('calories')
    expect(bad).toContain('intake floor')
  })

  it('offers the two ways out: a later date, or a nearer target', () => {
    const c = counterOffer({ currentKg: 95.8, targetKg: 85, days: 57, pctPerWeek: 0.7 })
    expect(c.targetForDate).toBe(90.5)     // same date, reachable target
    expect(c.daysForTarget).toBe(119)      // same target, honest date
  })

  it('scores the counter-offer far better than the original', () => {
    // Same athlete, same log, same date — target moved to what 0.7%/wk reaches
    const softer = scoreWeightGoal(Object.assign({}, OPTS, {
      goal: Object.assign({}, GOAL, { target: 90.5 }),
      currentKg: 95.8,
    }))
    expect(softer.rate.blocked).toBe(false)
    expect(softer.score).toBeGreaterThan(scoreWeightGoal(OPTS).score)
  })
})

describe('scoreWeightGoal — the good case', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-04T12:00:00')) })
  afterEach(() => { vi.useRealTimers() })

  it('scores a modest goal on a falling trend at the top of the scale', () => {
    const log = []
    for (let i = 90; i >= 0; i -= 7) {
      const d = new Date('2026-09-04T00:00:00'); d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), weight: Math.round((82 - (90 - i) * 0.008) * 10) / 10 })
    }
    const s = scoreWeightGoal({
      goal: { target: 79, startValue: 82, targetDate: '2026-12-13', createdAt: '2026-06-06' },
      currentKg: 81.3, heightCm: 180, weightEntries: log, sessionsPerWeek: 4,
      ageYears: 35, sex: 'male',
    })
    expect(s.rate.kgPerWeek).toBeLessThan(0.3)
    expect(s.score).toBeGreaterThanOrEqual(4)
    expect(s.reasons.every(r => r.verdict !== 'bad')).toBe(true)
  })

  it('says nothing for a gain goal or a missing date', () => {
    expect(scoreWeightGoal({ goal: { target: 90, targetDate: '2026-12-01' }, currentKg: 85 }).score).toBe(null)
    expect(scoreWeightGoal({ goal: { target: 80 }, currentKg: 85 }).score).toBe(null)
    expect(scoreWeightGoal({}).score).toBe(null)
  })
})
