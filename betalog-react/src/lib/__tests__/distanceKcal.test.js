import { describe, it, expect } from 'vitest'
import {
  getDistanceKcalRange, getSwimKcalRange, getPaceMET, estimateCalories, KCAL_PER_KG_KM,
} from '../stats'

// The point of this model: you log the distance and nothing else, and still get
// a calorie figure. It exists because the duration field was the one nobody
// filled in, so a model that needs it produced confident wrong answers.
describe('getDistanceKcalRange — calories without a duration', () => {
  it('costs a walk from distance and bodyweight alone', () => {
    // 5 km at 80 kg: 0.76 * 80 * 5 = 304 kcal, +/-16%.
    const k = getDistanceKcalRange('walk', 5000, 80)
    expect(k.low).toBe(255)
    expect(k.high).toBe(353)
  })

  it('agrees with the pace model it was derived from', () => {
    // The same 5 km walk, timed honestly at 60 minutes, through the other
    // model. The two must not disagree about one activity -- that disagreement
    // is what the derivation exists to prevent.
    const met  = getPaceMET('walk', null, 5000, 60)
    const pace = estimateCalories(met, 80, 60)
    const dist = getDistanceKcalRange('walk', 5000, 80)
    const mid  = (x) => (x.low + x.high) / 2
    expect(Math.abs(mid(dist) - mid(pace)) / mid(pace)).toBeLessThan(0.12)
  })

  it('costs a run about a third more than a walk of the same distance', () => {
    // NOT twice, which is the familiar claim -- and the familiar claim is about
    // NET cost, above resting metabolism. These are gross figures, like every
    // MET-derived number in this app, and a walk carries its resting burn for
    // roughly twice as long over the same distance. Getting this wrong is what
    // made the first attempt at these constants disagree with the pace model.
    const walk = getDistanceKcalRange('walk', 5000, 80)
    const run  = getDistanceKcalRange('run', 5000, 80)
    const ratio = ((run.low + run.high) / 2) / ((walk.low + walk.high) / 2)
    expect(ratio).toBeGreaterThan(1.2)
    expect(ratio).toBeLessThan(1.5)
  })

  it('scales with distance and with bodyweight', () => {
    const a = getDistanceKcalRange('run', 5000, 80)
    const b = getDistanceKcalRange('run', 10000, 80)
    const c = getDistanceKcalRange('run', 5000, 40)
    expect(b.low).toBe(a.low * 2)
    // Within a kcal: the model rounds once at the end, so halving a rounded
    // figure and rounding the halved figure can differ by one.
    expect(Math.abs(c.low - a.low / 2)).toBeLessThanOrEqual(1)
  })

  it('does not depend on how fast it was — that is the whole idea', () => {
    // No duration is taken at all, so there is no pace to disagree about.
    expect(getDistanceKcalRange('run', 10000, 70).low)
      .toBe(getDistanceKcalRange('run', 10000, 70).low)
    expect(getDistanceKcalRange.length).toBe(3)
  })
})

// The measurement that overturned the design: per-km cost for cycling is the
// FLATTEST of the three, because riding faster raises the MET and cuts the time
// by nearly the same factor. Drag rising with v-squared is about power, not
// energy per km. So no effort banding, and walking carries the widest range.
describe('getDistanceKcalRange — cycling needs no effort level', () => {
  it('costs a ride from distance alone', () => {
    const k = getDistanceKcalRange('cycle', 40000, 80)
    expect(k).not.toBe(null)
    expect(k.low).toBeGreaterThan(0)
  })

  it('states the narrowest range of the three, not the widest', () => {
    const spread = (x) => (x.high - x.low) / ((x.high + x.low) / 2)
    const cycle = spread(getDistanceKcalRange('cycle', 40000, 80))
    const run   = spread(getDistanceKcalRange('run', 40000, 80))
    const walk  = spread(getDistanceKcalRange('walk', 40000, 80))
    expect(cycle).toBeLessThan(run)
    expect(run).toBeLessThan(walk)
  })
})

describe('getDistanceKcalRange — when it declines to answer', () => {
  it('needs a distance and a weight', () => {
    expect(getDistanceKcalRange('run', null, 80)).toBe(null)
    expect(getDistanceKcalRange('run', 5000, null)).toBe(null)
    expect(getDistanceKcalRange('run', 0, 80)).toBe(null)
    expect(getDistanceKcalRange('run', 5000, 0)).toBe(null)
  })

  it('has nothing to say about activities with no distance cost', () => {
    expect(getDistanceKcalRange('sport', 5000, 80)).toBe(null)
    expect(getDistanceKcalRange('other', 5000, 80)).toBe(null)
    // Swimming has its own per-metre model and must keep using it.
    expect(getDistanceKcalRange('swim', 1500, 80)).toBe(null)
    expect(getSwimKcalRange('general', 1500, 80)).not.toBe(null)
  })
})

describe('the constants are the stated conventions, not something drifting', () => {
  it('are gross figures, matching every other MET-derived number here', () => {
    // The textbook 0.5 kcal/kg/km for walking is NET, above resting metabolism.
    // Using it made this model read 25% under the pace model for the same walk.
    expect(KCAL_PER_KG_KM.walk).toBeGreaterThan(0.65)
    expect(KCAL_PER_KG_KM.walk).toBeLessThan(0.90)
    expect(KCAL_PER_KG_KM.run).toBeGreaterThan(0.90)
    expect(KCAL_PER_KG_KM.run).toBeLessThan(1.15)
  })

  it('rank the three the way the pace tables do', () => {
    expect(KCAL_PER_KG_KM.run).toBeGreaterThan(KCAL_PER_KG_KM.walk)
    expect(KCAL_PER_KG_KM.walk).toBeGreaterThan(KCAL_PER_KG_KM.cycle)
  })
})
