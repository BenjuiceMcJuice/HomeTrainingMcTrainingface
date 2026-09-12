import { describe, it, expect } from 'vitest'
import { impliedSpeed, checkPace, describePace, IMPLAUSIBLE_ABOVE } from '../cardioPace'

describe('impliedSpeed', () => {
  it('is metres per minute', () => {
    expect(impliedSpeed(5000, 50)).toBe(100)
  })

  it('is unanswerable, not fast, when an input is missing', () => {
    expect(impliedSpeed(null, 30)).toBe(null)
    expect(impliedSpeed(5000, null)).toBe(null)
    expect(impliedSpeed(0, 30)).toBe(null)
    expect(impliedSpeed(5000, 0)).toBe(null)
  })
})

describe('checkPace — the case this was written for', () => {
  // Ben's export: 24 of 36 walks logged at exactly 30 minutes whatever the
  // distance, one of them implying 10.6 mph.
  it('catches a 5 km walk logged as 30 minutes', () => {
    const c = checkPace({ activity: 'walk', metres: 5000, durationMins: 30 })
    expect(c).not.toBe(null)
    expect(c.kmh).toBe(10)
    expect(c.mph).toBeCloseTo(6.2, 1)
  })

  it('leaves an ordinary walk alone', () => {
    // 5 km in 60 minutes — 5 km/h, a normal walking pace.
    expect(checkPace({ activity: 'walk', metres: 5000, durationMins: 60 })).toBe(null)
  })

  it('leaves a brisk walk alone', () => {
    // 5 km in 40 minutes — 7.5 km/h, fast but a walk.
    expect(checkPace({ activity: 'walk', metres: 5000, durationMins: 40 })).toBe(null)
  })
})

describe('checkPace — the ceilings are generous on purpose', () => {
  it('does not flag a very fast but real 10k', () => {
    // 10 km in 30 minutes is near the world record and must not warn.
    expect(checkPace({ activity: 'run', metres: 10000, durationMins: 30 })).toBe(null)
  })

  it('flags a run only when nothing could sustain it', () => {
    // 10 km in 25 minutes — 24 km/h, faster than anyone runs.
    expect(checkPace({ activity: 'run', metres: 10000, durationMins: 25 })).not.toBe(null)
  })

  it('does not flag a fast club ride', () => {
    // 40 km in 60 minutes — 40 km/h, quick but real.
    expect(checkPace({ activity: 'cycle', metres: 40000, durationMins: 60 })).toBe(null)
  })

  it('flags a ride nothing sustains', () => {
    // 40 km in 30 minutes — 80 km/h.
    expect(checkPace({ activity: 'cycle', metres: 40000, durationMins: 30 })).not.toBe(null)
  })

  it('does not flag a hard swim set', () => {
    // 1500 m in 20 minutes — 75 m/min, quick but plausible.
    expect(checkPace({ activity: 'swim', metres: 1500, durationMins: 20 })).toBe(null)
  })

  it('flags a swim past world-record pace', () => {
    // 1500 m in 10 minutes — 150 m/min.
    expect(checkPace({ activity: 'swim', metres: 1500, durationMins: 10 })).not.toBe(null)
  })
})

describe('checkPace — when it declines to answer', () => {
  it('says nothing without a distance', () => {
    expect(checkPace({ activity: 'walk', metres: null, durationMins: 30 })).toBe(null)
  })

  it('says nothing for an activity with no distance', () => {
    expect(checkPace({ activity: 'sport', metres: 5000, durationMins: 30 })).toBe(null)
    expect(checkPace({ activity: 'other', metres: 5000, durationMins: 30 })).toBe(null)
  })

  it('says nothing for junk input', () => {
    expect(checkPace(null)).toBe(null)
    expect(checkPace({})).toBe(null)
  })

  it('every ceiling sits above its own PACE_MET top band', () => {
    // The calorie model has a number for paces up to these; the warning must
    // never fire on a pace the model itself considers ordinary.
    expect(IMPLAUSIBLE_ABOVE.walk).toBeGreaterThan(108)
    expect(IMPLAUSIBLE_ABOVE.run).toBeGreaterThan(233)
    expect(IMPLAUSIBLE_ABOVE.cycle).toBeGreaterThan(433)
    expect(IMPLAUSIBLE_ABOVE.row).toBeGreaterThan(285)
    expect(IMPLAUSIBLE_ABOVE.swim).toBeGreaterThan(55)
  })
})

describe('describePace', () => {
  it('describes the arithmetic and asks, rather than accusing', () => {
    const c = checkPace({ activity: 'walk', metres: 5000, durationMins: 30 })
    const msg = describePace(c, 'walk')
    expect(msg).toContain('10 km/h')
    expect(msg).toContain('Check the duration and distance')
    expect(msg).not.toMatch(/wrong|error|invalid/i)
  })

  it('says ride for a cycle, not cycle', () => {
    const c = checkPace({ activity: 'cycle', metres: 40000, durationMins: 20 })
    expect(describePace(c, 'cycle')).toContain('than a ride goes')
  })

  it('is null when there is nothing to warn about', () => {
    expect(describePace(null, 'walk')).toBe(null)
  })
})
