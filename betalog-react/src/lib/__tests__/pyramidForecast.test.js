import { describe, it, expect } from 'vitest'
import { buildPyramid, pyramidReadiness } from '../pyramid'
import {
  baseShortfall, fillRate, forecastReady, describeForecast, describeForecastBasis, looseDate,
  goalScore, forecastAtPlannedRate, describePlan,
} from '../pyramidForecast'

const TODAY = '2026-09-12'
const ago = (n) => new Date(Date.parse(TODAY + 'T00:00:00') - n * 86400000).toISOString().slice(0, 10)

/** One session with `count` sends at `grade`. */
const sess = (daysAgo, grade, count) => ({
  date: ago(daysAgo), type: 'climb',
  climbs: Array.from({ length: count }, () => ({ grade, discipline: 'boulder', outcome: 'sent' })),
})

function read(sessions, target) {
  const pyramid = buildPyramid({
    sessions, disciplines: ['boulder'], system: 'v', todayIso: TODAY,
  })
  return { pyramid, readiness: pyramidReadiness({ pyramid, targetGrade: target }) }
}

const forecast = (sessions, target, deadline) => {
  const { pyramid, readiness } = read(sessions, target)
  return forecastReady({
    pyramid, readiness, system: 'v', targetGrade: target,
    todayIso: TODAY, deadlineIso: deadline || null,
  })
}

describe('baseShortfall — what the base is still missing', () => {
  it('is zero when the base is complete', () => {
    // V5 target: needs 8 V4, 4 V3, 2 V2 beneath it (the target tier is excluded).
    const sessions = [
      ...Array.from({ length: 4 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
      ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
      sess(80, 'V2', 2),
    ]
    const { readiness } = read(sessions, 'V5')
    expect(baseShortfall(readiness)).toBe(0)
  })

  it('counts every missing send, not every missing tier', () => {
    // One V4 short of the 8 the widest row wants.
    const sessions = [
      ...Array.from({ length: 3 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
      sess(40, 'V4', 1),
      ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
      sess(80, 'V2', 2),
    ]
    const { readiness } = read(sessions, 'V5')
    expect(baseShortfall(readiness)).toBe(1)
  })

  it('is the whole base when nothing has been logged', () => {
    const { readiness } = read([], 'V5')
    expect(baseShortfall(readiness)).toBeGreaterThan(0)
  })
})

describe('fillRate — counted the way the base is counted', () => {
  it('counts sends exactly as the base counts them', () => {
    // The point is not the number but the agreement: whatever rule credits a
    // send toward the base must credit it toward the rate, or the projection
    // measures a different thing from the shortfall it divides into.
    // (The per-session cap was removed on 2026-09-13 — BTL-B30.)
    const { pyramid, readiness } = read([sess(10, 'V4', 10)], 'V5')
    const credited = fillRate({ readiness, windowDays: pyramid.windowDays }).credited
    const ownInBase = readiness.tiers.slice(1).reduce((n, t) => n + t.own, 0)
    expect(credited).toBe(ownInBase)
    expect(credited).toBe(10)
  })

  it('is per month over the pyramid window', () => {
    // 6 credited sends over 180 days ~ 1.01 a month.
    const sessions = Array.from({ length: 3 }, (_, i) => sess(10 + i * 7, 'V4', 2))
    const { pyramid, readiness } = read(sessions, 'V5')
    const r = fillRate({ readiness, windowDays: pyramid.windowDays })
    expect(r.credited).toBe(6)
    expect(r.perMonth).toBeCloseTo(1.01, 1)
  })

  it('ignores the target tier', () => {
    // Sends at V5 itself are not base-building, so they must not flatter the rate.
    const { pyramid, readiness } = read([sess(10, 'V5', 2)], 'V5')
    expect(fillRate({ readiness, windowDays: pyramid.windowDays }).credited).toBe(0)
  })
})

describe('forecastReady — a date, never a probability', () => {
  it('projects from shortfall, rate and conversion time', () => {
    const sessions = Array.from({ length: 3 }, (_, i) => sess(10 + i * 7, 'V4', 2))
    const f = forecast(sessions, 'V5')
    expect(f.shortfall).toBeGreaterThan(0)
    expect(f.rate.perDay).toBeGreaterThan(0)
    expect(f.fillDays).toBe(Math.round(f.shortfall / f.rate.perDay))
    expect(f.daysToReady).toBe(f.fillDays + f.conversionDays)
    expect(f.readyIso > TODAY).toBe(true)
  })

  it('reports no chance of success anywhere in the result', () => {
    const f = forecast(Array.from({ length: 3 }, (_, i) => sess(10 + i * 7, 'V4', 2)), 'V5')
    expect(Object.keys(f)).not.toContain('probability')
    expect(Object.keys(f)).not.toContain('chance')
    expect(Object.keys(f)).not.toContain('pct')
  })

  it('needs only conversion time when the base is already built', () => {
    const sessions = [
      ...Array.from({ length: 4 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
      ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
      sess(80, 'V2', 2),
    ]
    const f = forecast(sessions, 'V5')
    expect(f.shortfall).toBe(0)
    expect(f.fillDays).toBe(0)
    expect(f.daysToReady).toBe(f.conversionDays)
  })

  it('refuses to answer rather than projecting off a rate of zero', () => {
    // Nothing at the base grades: shortfall / 0 is not a distant date, it is
    // an unanswerable question.
    const f = forecast([sess(10, 'V5', 2)], 'V5')
    expect(f.readyIso).toBe(null)
    expect(f.daysToReady).toBe(null)
    expect(f.reason).toContain('nothing logged at those grades')
  })

  it('declines a projection that runs absurdly far out', () => {
    // One credited send at a grade that IS in V6's base (V5/V4/V3), against the
    // 14 that base wants — a real but tiny rate, so the sum is finite and silly
    // rather than undefined. V1 would not do: it is below the pyramid entirely
    // and lands in the no-rate branch above instead.
    const f = forecast([sess(170, 'V3', 1)], 'V6')
    expect(f.readyIso).toBe(null)
    expect(f.reason).toContain('worth projecting')
  })

  it('says whether the pace came from the log or a convention', () => {
    const f = forecast(Array.from({ length: 3 }, (_, i) => sess(10 + i * 7, 'V4', 2)), 'V5')
    expect(['log', 'default']).toContain(f.basis.pace)
  })
})

describe('forecastReady — the margin against a deadline', () => {
  const sessions = Array.from({ length: 3 }, (_, i) => sess(10 + i * 7, 'V4', 2))

  it('is positive when the date lands before the deadline', () => {
    const f = forecast(sessions, 'V5', '2029-01-01')
    expect(f.onTrack).toBe(true)
    expect(f.marginWeeks).toBeGreaterThan(0)
  })

  it('is negative when it lands after', () => {
    const f = forecast(sessions, 'V5', '2026-10-01')
    expect(f.onTrack).toBe(false)
    expect(f.marginDays).toBeLessThan(0)
  })

  it('answers the deadline-sensitivity question with no extra machinery', () => {
    // The same pyramid against two deadlines gives two margins.
    const near = forecast(sessions, 'V5', '2026-10-01')
    const far  = forecast(sessions, 'V5', '2029-01-01')
    expect(near.readyIso).toBe(far.readyIso)
    expect(near.onTrack).toBe(false)
    expect(far.onTrack).toBe(true)
  })

  it('has no margin when there is no deadline', () => {
    const f = forecast(sessions, 'V5')
    expect(f.marginWeeks).toBe(null)
    expect(f.onTrack).toBe(null)
  })
})

describe('the words', () => {
  const sessions = Array.from({ length: 3 }, (_, i) => sess(10 + i * 7, 'V4', 2))

  it('leads with the date and the margin', () => {
    const s = describeForecast(forecast(sessions, 'V5', '2029-01-01'))
    expect(s).toMatch(/Base built around/)
    expect(s).toMatch(/deadline/)
    expect(s).not.toMatch(/%|chance|probability|likely to succeed/i)
  })

  it('says when no projection is possible, rather than inventing one', () => {
    expect(describeForecast(forecast([sess(10, 'V5', 2)], 'V5'))).toMatch(/^No projection/)
  })

  it('flags a conventional pace rather than passing it off as measured', () => {
    const f = forecast(sessions, 'V5')
    if (f.basis.pace === 'default') {
      expect(describeForecast(f)).toContain('typical time per grade')
    }
  })

  it('states the sample the rate was measured on', () => {
    const s = describeForecastBasis(forecast(sessions, 'V5'))
    expect(s).toMatch(/a month at those grades/)
    expect(s).toMatch(/in 180 days/)
  })

  it('is loose about the date on purpose', () => {
    expect(looseDate('2027-03-15')).toBe('mid-March')
    expect(looseDate('2027-03-04')).toBe('early March')
    expect(looseDate('2027-03-28')).toBe('late March')
  })
})

// ---------------------------------------------------------------------------
// The deadline-aware mark, and the weekly what-if (2026-09-13)
// ---------------------------------------------------------------------------

describe('goalScore — the dots answer "will you make it", like the weight card', () => {
  // A complete base under V5: 8 x V4, 4 x V3, 2 x V2. Starting from a high
  // readiness score is the point -- a base already at 1 has nothing to dock, so
  // it could not show the deadline mattering either way.
  const sessions = [
    ...Array.from({ length: 4 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
    ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
    sess(80, 'V2', 2),
  ]
  const at = (deadline) => {
    const { pyramid, readiness } = read(sessions, 'V5')
    const f = forecastReady({
      pyramid, readiness, system: 'v', targetGrade: 'V5',
      todayIso: TODAY, deadlineIso: deadline,
    })
    return { readiness, score: goalScore({ readiness, forecast: f }) }
  }

  it('scores lower for a tight deadline than a generous one', () => {
    // Ben's question: a week should not read the same as a month.
    expect(at('2026-09-19').score.score).toBeLessThan(at('2029-01-01').score.score)
  })

  it('does not dock a goal that is on track', () => {
    const { readiness, score } = at('2029-01-01')
    expect(score.score).toBe(readiness.score)
    expect(score.docked).toBe(0)
  })

  it('docks harder the further past the deadline it lands', () => {
    const near = at('2026-09-19').score
    const mid  = at('2026-12-01').score
    expect(near.score).toBeLessThanOrEqual(mid.score)
  })

  it('never goes below 1', () => {
    expect(at('2026-09-13').score.score).toBeGreaterThanOrEqual(1)
  })

  it('leaves the base label alone — that is about the climbing, not the date', () => {
    expect(at('2026-09-19').readiness.label).toBe(at('2029-01-01').readiness.label)
  })

  it('does not dock when there is no deadline to miss', () => {
    const { pyramid, readiness } = read(sessions, 'V5')
    const f = forecastReady({ pyramid, readiness, system: 'v', targetGrade: 'V5', todayIso: TODAY })
    expect(goalScore({ readiness, forecast: f }).score).toBe(readiness.score)
  })

  it('does not dock when the rate is too thin to project from', () => {
    // An unanswerable question must not read as a bad answer.
    const { pyramid, readiness } = read([sess(10, 'V5', 2)], 'V5')
    const f = forecastReady({
      pyramid, readiness, system: 'v', targetGrade: 'V5',
      todayIso: TODAY, deadlineIso: '2026-09-19',
    })
    expect(f.reason).toBeTruthy()
    expect(goalScore({ readiness, forecast: f }).score).toBe(readiness.score)
  })
})

describe('forecastAtPlannedRate — the lever, clearly labelled as one', () => {
  const thin = [sess(10, 'V4', 2), sess(80, 'V4', 2)]

  it('offers a nearer date than a thin measured rate', () => {
    const { pyramid, readiness } = read(thin, 'V5')
    const f = forecastReady({ pyramid, readiness, system: 'v', targetGrade: 'V5', todayIso: TODAY })
    const p = forecastAtPlannedRate({
      readiness, conversionDays: f.conversionDays,
      measuredPerDay: f.rate.perDay, todayIso: TODAY,
    })
    expect(p).not.toBe(null)
    expect(p.daysToReady).toBeLessThan(f.daysToReady)
  })

  it('offers nothing to someone already climbing more than weekly', () => {
    // A "what if you climbed less" line helps nobody.
    const busy = Array.from({ length: 20 }, (_, i) => sess(5 + i * 8, 'V4', 3))
    const { pyramid, readiness } = read(busy, 'V5')
    const f = forecastReady({ pyramid, readiness, system: 'v', targetGrade: 'V5', todayIso: TODAY })
    expect(forecastAtPlannedRate({
      readiness, conversionDays: f.conversionDays,
      measuredPerDay: f.rate.perDay, todayIso: TODAY,
    })).toBe(null)
  })

  it('says it is a plan, not a reading', () => {
    const { pyramid, readiness } = read(thin, 'V5')
    const f = forecastReady({ pyramid, readiness, system: 'v', targetGrade: 'V5', todayIso: TODAY })
    const p = forecastAtPlannedRate({
      readiness, conversionDays: f.conversionDays,
      measuredPerDay: f.rate.perDay, todayIso: TODAY, deadlineIso: '2029-01-01',
    })
    expect(describePlan(p)).toMatch(/^Climbing weekly:/)
  })
})
