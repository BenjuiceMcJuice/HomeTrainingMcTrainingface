import { describe, it, expect } from 'vitest'
import {
  assessWeightGoalRate, weeklyLossLimit, daysUntil, describeRate, rateWarning,
} from '../weightRate'

describe('weeklyLossLimit', () => {
  it('binds on the percentage below 100 kg and on the kg above it', () => {
    expect(weeklyLossLimit(60)).toBe(0.6)     // 1% of 60
    expect(weeklyLossLimit(80)).toBe(0.8)
    expect(weeklyLossLimit(100)).toBe(1)      // the two ceilings meet
    expect(weeklyLossLimit(140)).toBe(1)      // NHS 1 kg/week caps it
  })

  it('falls back to the absolute ceiling with no bodyweight to go on', () => {
    expect(weeklyLossLimit(null)).toBe(1)
    expect(weeklyLossLimit(0)).toBe(1)
    expect(weeklyLossLimit('heavy')).toBe(1)
  })
})

describe('daysUntil', () => {
  it('counts whole days forward, and negatives for a date gone by', () => {
    expect(daysUntil('2026-09-11', '2026-09-04')).toBe(7)
    expect(daysUntil('2026-09-04', '2026-09-04')).toBe(0)
    expect(daysUntil('2026-09-01', '2026-09-04')).toBe(-3)
  })

  it('returns null rather than NaN for junk', () => {
    expect(daysUntil(null, '2026-09-04')).toBe(null)
    expect(daysUntil('not-a-date', '2026-09-04')).toBe(null)
  })
})

describe('assessWeightGoalRate', () => {
  it('works out the weekly and monthly rate a goal implies', () => {
    // 4 kg over 70 days is 0.4 kg/week
    const a = assessWeightGoalRate({ currentKg: 80, targetKg: 76, days: 70 })
    expect(a.direction).toBe('lose')
    expect(a.remainingKg).toBe(4)
    expect(a.kgPerWeek).toBe(0.4)
    expect(a.kgPerMonth).toBe(1.7)
    expect(a.pctPerWeek).toBe(0.5)
    expect(a.band).toBe('steady')
    expect(a.ok).toBe(true)
    expect(a.blocked).toBe(false)
  })

  it('calls 0.7-1% of bodyweight a week brisk, and allows it', () => {
    const a = assessWeightGoalRate({ currentKg: 80, targetKg: 76, days: 42 })
    expect(a.kgPerWeek).toBeCloseTo(0.67, 2)
    // Derived from the rounded kg figure, so the two numbers on screen agree
    expect(a.pctPerWeek).toBe(0.84)
    expect(a.band).toBe('brisk')
    expect(a.ok).toBe(true)
    expect(a.blocked).toBe(false)
  })

  it('leaves the 0.7% recommendation itself in the steady band', () => {
    // Flagging the rate the evidence recommends would be telling someone off
    // for hitting it.
    const a = assessWeightGoalRate({ currentKg: 80, targetKg: 76, days: 50 })
    expect(a.pctPerWeek).toBe(0.7)
    expect(a.band).toBe('steady')
  })

  it('blocks a loss faster than 1% of bodyweight a week', () => {
    // 5 kg in a month off 80 kg is ~1.5%/week
    const a = assessWeightGoalRate({ currentKg: 80, targetKg: 75, days: 30 })
    expect(a.band).toBe('too_fast')
    expect(a.ok).toBe(false)
    expect(a.blocked).toBe(true)
    expect(a.limitKgPerWeek).toBe(0.8)
  })

  it('holds the same rate to a different standard at a different size', () => {
    // 0.7 kg/week is the recommended rate at 100 kg and too fast at 55 kg —
    // the point of scaling the limit rather than quoting one number to
    // everybody.
    const big   = assessWeightGoalRate({ currentKg: 100, targetKg: 97, days: 30 })
    const small = assessWeightGoalRate({ currentKg: 55,  targetKg: 52, days: 30 })
    expect(big.kgPerWeek).toBe(small.kgPerWeek)
    expect(big.pctPerWeek).toBe(0.7)
    expect(big.band).toBe('steady')
    expect(small.pctPerWeek).toBe(1.27)
    expect(small.band).toBe('too_fast')
  })

  it('keeps the absolute 1 kg/week ceiling for a big body', () => {
    // 1.4%/week would be under nothing but the percentage rule at 150 kg;
    // the NHS ceiling is what stops it.
    const a = assessWeightGoalRate({ currentKg: 150, targetKg: 143, days: 35 })
    expect(a.kgPerWeek).toBe(1.4)
    expect(a.limitKgPerWeek).toBe(1)
    expect(a.blocked).toBe(true)
  })

  it('flags a fast gain but never blocks it', () => {
    const a = assessWeightGoalRate({ currentKg: 60, targetKg: 66, days: 30 })
    expect(a.direction).toBe('gain')
    expect(a.band).toBe('too_fast')
    expect(a.ok).toBe(false)
    expect(a.blocked).toBe(false)      // unrealistic, not unsafe
  })

  it('treats a gentle gain as steady', () => {
    const a = assessWeightGoalRate({ currentKg: 60, targetKg: 61, days: 90 })
    expect(a.direction).toBe('gain')
    expect(a.band).toBe('steady')
    expect(a.ok).toBe(true)
  })

  it('takes a target date instead of a day count', () => {
    const a = assessWeightGoalRate({ currentKg: 80, targetKg: 76, targetDate: '2026-11-13', todayIso: '2026-09-04' })
    expect(a.days).toBe(70)
    expect(a.kgPerWeek).toBe(0.4)
  })

  it('reports a date already gone by without dividing by zero', () => {
    const a = assessWeightGoalRate({ currentKg: 80, targetKg: 76, days: 0 })
    expect(a.band).toBe('past')
    expect(a.kgPerWeek).toBe(null)
    expect(a.blocked).toBe(false)
    expect(assessWeightGoalRate({ currentKg: 80, targetKg: 76, days: -5 }).band).toBe('past')
  })

  it('says nothing rather than guessing when an input is missing', () => {
    expect(assessWeightGoalRate({ currentKg: null, targetKg: 76, days: 70 }).band).toBe('unknown')
    expect(assessWeightGoalRate({ currentKg: 80, targetKg: null, days: 70 }).band).toBe('unknown')
    expect(assessWeightGoalRate({ currentKg: 80, targetKg: 76 }).kgPerWeek).toBe(null)
    expect(assessWeightGoalRate({}).blocked).toBe(false)
    expect(assessWeightGoalRate().ok).toBe(true)
  })

  it('treats a target equal to the current weight as nothing to do', () => {
    const a = assessWeightGoalRate({ currentKg: 80, targetKg: 80, days: 30 })
    expect(a.direction).toBe('hold')
    expect(a.blocked).toBe(false)
  })
})

describe('describeRate and rateWarning', () => {
  it('phrases the rate once, for both screens to quote', () => {
    const a = assessWeightGoalRate({ currentKg: 80, targetKg: 76, days: 70 })
    expect(describeRate(a)).toBe('0.4 kg/wk · 1.7 kg/month')
    expect(describeRate(assessWeightGoalRate({}))).toBe(null)
  })

  it('stays quiet on a steady rate and speaks up past it', () => {
    expect(rateWarning(assessWeightGoalRate({ currentKg: 80, targetKg: 76, days: 70 }))).toBe(null)
    expect(rateWarning(assessWeightGoalRate({ currentKg: 80, targetKg: 76, days: 42 }))).toMatch(/lean mass and strength/i)
    expect(rateWarning(assessWeightGoalRate({ currentKg: 80, targetKg: 75, days: 30 }))).toMatch(/0\.8 kg a week/)
    expect(rateWarning(assessWeightGoalRate({ currentKg: 60, targetKg: 66, days: 30 }))).toMatch(/lean gain/i)
  })
})
