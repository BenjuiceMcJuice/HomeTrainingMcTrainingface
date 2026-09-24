import { describe, it, expect } from 'vitest'
import { buildPyramid, pyramidReadiness } from '../pyramid'
import {
  baseShortfall, fillRate, forecastReady, describeForecast, describeForecastSteps, describeForecastBasis, looseDate,
  goalScore, forecastAtPlannedRate, describePlan, readGradeGoal, targetRatio,
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

  it('falls back to the whole window without a first date', () => {
    // 6 credited sends over 180 days ~ 1.01 a month.
    const sessions = Array.from({ length: 3 }, (_, i) => sess(10 + i * 7, 'V4', 2))
    const { pyramid, readiness } = read(sessions, 'V5')
    const r = fillRate({ readiness, windowDays: pyramid.windowDays })
    expect(r.credited).toBe(6)
    expect(r.spanDays).toBe(180)
    expect(r.perMonth).toBeCloseTo(1.01, 1)
  })

  it('measures from the first climb in the window, not the start of it', () => {
    // Ben's 6c card: four sessions divided by all 180 days read as a fraction of
    // how often he climbs. Sends spread over 60 days are a 60-day rate.
    const sessions = [sess(60, 'V4', 2), sess(40, 'V4', 2), sess(20, 'V4', 2), sess(5, 'V4', 2)]
    const { pyramid, readiness } = read(sessions, 'V5')
    expect(pyramid.firstDate).toBe(ago(60))
    const r = fillRate({
      readiness, windowDays: pyramid.windowDays, firstDate: pyramid.firstDate, todayIso: TODAY,
    })
    // `ago` can land a calendar day early in summer time, so compare with the
    // span between the actual dates rather than a literal 60.
    const span = Math.round((Date.parse(TODAY) - Date.parse(ago(60))) / 86400000)
    expect(span).toBeGreaterThanOrEqual(60)
    expect(span).toBeLessThanOrEqual(61)
    expect(r.spanDays).toBe(span)
    expect(r.perDay).toBeCloseTo(8 / span, 5)
  })

  it('never measures over less than four weeks', () => {
    // One session three days ago is not a monthly pace.
    const { pyramid, readiness } = read([sess(3, 'V4', 2)], 'V5')
    const r = fillRate({
      readiness, windowDays: pyramid.windowDays, firstDate: pyramid.firstDate, todayIso: TODAY,
    })
    expect(r.spanDays).toBe(28)
  })

  it('never measures over more than the window', () => {
    const { pyramid, readiness } = read([sess(170, 'V4', 2)], 'V5')
    const r = fillRate({
      readiness, windowDays: 90, firstDate: ago(400), todayIso: TODAY,
    })
    expect(r.spanDays).toBe(90)
    expect(pyramid.firstDate).toBe(ago(170))
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
    expect(s).toMatch(/^Ready for V5 around/)
    expect(s).toMatch(/deadline/)
    expect(s).not.toMatch(/%|chance|probability|likely to succeed/i)
  })

  it('does not call the date the base -- it includes moving up a grade', () => {
    // The old words put the base months later than the arithmetic did.
    expect(describeForecast(forecast(sessions, 'V5'))).not.toMatch(/Base built/)
  })

  it('says when no projection is possible, rather than inventing one', () => {
    expect(describeForecast(forecast([sess(10, 'V5', 2)], 'V5'))).toMatch(/^No projection/)
  })

  it('splits the date into filling the base and moving up a grade', () => {
    const f = forecast(sessions, 'V5')
    const s = describeForecastSteps(f)
    expect(s).toMatch(/^Pyramid full in /)
    expect(s).toMatch(/then about \d+ weeks? to move up a grade/)
    expect(f.daysToReady).toBe(f.fillDays + f.conversionDays)
  })

  it('flags a conventional pace rather than passing it off as measured', () => {
    const f = forecast(sessions, 'V5')
    expect(f.basis.pace).toBe('default')
    expect(describeForecastSteps(f)).toContain('a typical time')
  })

  it('says the base is already full when it is', () => {
    const full = [
      ...Array.from({ length: 4 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
      ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
      sess(80, 'V2', 2),
    ]
    expect(describeForecastSteps(forecast(full, 'V5'))).toMatch(/^Pyramid already full, then/)
  })

  it('has no steps line when there is no projection', () => {
    expect(describeForecastSteps(forecast([sess(10, 'V5', 2)], 'V5'))).toBe(null)
  })

  it('states the sample the rate was measured on', () => {
    // Sessions 10, 17 and 24 days ago: the span is the four-week floor.
    const s = describeForecastBasis(forecast(sessions, 'V5'))
    expect(s).toMatch(/a month at those grades/)
    expect(s).toMatch(/in 28 days/)
  })

  it('is loose about the date on purpose', () => {
    expect(looseDate('2027-03-15', '2027-01-01')).toBe('mid-March')
    expect(looseDate('2027-03-04', '2027-01-01')).toBe('early March')
    expect(looseDate('2027-03-28', '2027-01-01')).toBe('late March')
  })

  it('names the year when it is not this year', () => {
    // Ben, 2026-09-18: "late October ... 48 weeks past your deadline" — the
    // October was 2027's, and without the year the sentence contradicted itself.
    expect(looseDate('2027-10-29', '2026-09-18')).toBe('late October 2027')
    expect(looseDate('2026-10-29', '2026-09-18')).toBe('late October')
    expect(looseDate('2027-01-05', '2026-12-20')).toBe('early January 2027')
  })

  it('says now, not a month, when nothing is left to build', () => {
    // Base complete and the target sent: the date is today, and "around
    // mid-September" on the eighteenth reads as a forecast of the past.
    const done = [
      ...Array.from({ length: 4 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
      ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
      sess(80, 'V2', 2), sess(6, 'V5', 1),
    ]
    const f = forecast(done, 'V5')
    expect(f.daysToReady).toBe(0)
    expect(describeForecast(f)).toBe('Ready for V5 now.')
    expect(describeForecast(forecast(done, 'V5', '2026-10-01'))).toBe('Ready for V5 now. That is 3 weeks inside your deadline.')
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

  it('reads 5 with time to spare, whatever the base looks like', () => {
    // Ben: "if I set 'do a 6c' for months and months in the future it never
    // goes past 3/5". A forming base with a year in hand is not a 3.
    const thin = [sess(10, 'V4', 2), sess(20, 'V4', 2)]
    const { pyramid, readiness } = read(thin, 'V5')
    expect(readiness.score).toBeLessThan(5)
    const f = forecastReady({
      pyramid, readiness, system: 'v', targetGrade: 'V5', todayIso: TODAY, deadlineIso: '2030-01-01',
    })
    expect(f.onTrack).toBe(true)
    expect(goalScore({ readiness, forecast: f }).score).toBe(5)
  })

  it('reads 4 when it lands inside the deadline but not by much', () => {
    expect(at('2029-01-01').score.basis).toBe('deadline')
    // A deadline three days after the projected date: ratio just under 1.
    const { pyramid, readiness } = read(sessions, 'V5')
    const proj  = forecastReady({ pyramid, readiness, system: 'v', targetGrade: 'V5', todayIso: TODAY })
    const tight = forecastReady({
      pyramid, readiness, system: 'v', targetGrade: 'V5', todayIso: TODAY,
      deadlineIso: new Date(Date.parse(proj.readyIso + 'T00:00:00') + 3 * 86400000).toISOString().slice(0, 10),
    })
    expect(goalScore({ readiness, forecast: tight }).score).toBe(4)
  })

  it('scores lower the further past the deadline it lands', () => {
    const near = at('2026-09-19').score
    const mid  = at('2026-12-01').score
    expect(near.score).toBeLessThanOrEqual(mid.score)
    expect(near.reason).toMatch(/past the deadline/)
  })

  it('never goes below 1', () => {
    expect(at('2026-09-13').score.score).toBeGreaterThanOrEqual(1)
  })

  it('leaves the base label alone — that is about the climbing, not the date', () => {
    expect(at('2026-09-19').readiness.label).toBe(at('2029-01-01').readiness.label)
  })

  it('falls back to readiness when there is no deadline to measure against', () => {
    const { pyramid, readiness } = read(sessions, 'V5')
    const f = forecastReady({ pyramid, readiness, system: 'v', targetGrade: 'V5', todayIso: TODAY })
    const m = goalScore({ readiness, forecast: f })
    expect(m.score).toBe(readiness.score)
    expect(m.basis).toBe('readiness')
  })

  it('falls back to readiness when the rate is too thin to project from', () => {
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

// Ben's 6a, 2026-09-13: base complete, the grade sent the week before, deadline
// 17 days out — and the card read 2/5, because the forecast still charged 48
// days to "move up" to a grade already climbed.
describe('a target already sent has nothing left to convert', () => {
  const base = [
    ...Array.from({ length: 4 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
    ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
    sess(80, 'V2', 2),
  ]
  const withSend = base.concat([sess(6, 'V5', 1)])

  it('charges no grade-change time once the target is sent', () => {
    const f = forecast(withSend, 'V5')
    expect(f.sentTarget).toBe(true)
    expect(f.conversionDays).toBe(0)
    expect(f.basis.pace).toBe('sent')
    expect(f.daysToReady).toBe(f.fillDays)
  })

  it('still charges it when the target has not been sent', () => {
    expect(forecast(base, 'V5').conversionDays).toBeGreaterThan(0)
  })

  it('scores a complete base with the target sent 5/5 against a near deadline', () => {
    const { readiness } = read(withSend, 'V5')
    const f = forecast(withSend, 'V5', ago(-17))
    expect(readiness.score).toBe(5)
    expect(goalScore({ readiness, forecast: f }).score).toBe(5)
  })

  it('says so in the steps line instead of quoting a conversion time', () => {
    const s = describeForecastSteps(forecast(withSend, 'V5'))
    expect(s).toMatch(/V5 is already sent/)
    expect(s).not.toMatch(/move up a grade/)
  })
})

// BTL-B33: an own goal is done when the base *reaches* the target, so the
// target's own row is a third step in its projection.
describe('an own goal projects the target row too', () => {
  const base = [
    ...Array.from({ length: 4 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
    ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
    sess(80, 'V2', 2),
  ]
  const oneV5 = base.concat([sess(6, 'V5', 1)])
  const twoV5 = base.concat([sess(6, 'V5', 1), sess(20, 'V5', 1)])
  const at = (sessions, kind, deadline) => {
    const { pyramid, readiness } = read(sessions, 'V5')
    return forecastReady({
      pyramid, readiness, system: 'v', targetGrade: 'V5', kind, todayIso: TODAY, deadlineIso: deadline || null,
    })
  }

  it('lands later than the send goal on the same log', () => {
    const send = at(oneV5, 'send')
    const own  = at(oneV5, 'become')
    expect(own.daysToReady).toBeGreaterThan(send.daysToReady)
    expect(own.own.need).toBe(8)
    expect(own.own.credited).toBe(1)
    expect(own.own.shortfall).toBe(7)
    expect(own.daysToReady).toBe(own.fillDays + own.conversionDays + own.own.days)
  })

  // BTL-B49, 2026-09-24: the rate at the target is a blend — an assumption
  // worth two sends (the base rate halved, the pyramid's own ratio) plus the
  // real sends since the first of them. A send should always bring the date
  // nearer; before this the second send leapt it out by five months.
  it('assumes the target comes about half as often as the rows below until it is sent, and says so', () => {
    const own = at(base, 'become')
    expect(own.own.source).toBe('assumed')
    expect(own.own.shortfall).toBe(8)
    expect(own.own.credited).toBe(0)
    // This fixture is top-heavy (8 V4 over 4 V3 over 2 V2), so its ratio
    // reads at the clamp, not the default.
    expect(own.own.ratio).toBe(0.8)
    expect(own.own.perDay).toBeCloseTo(own.rate.perDay * 0.8, 10)
    expect(describeForecastSteps(own)).toMatch(/8 more V5 sends \(.*, assuming V5 comes about three-quarters as often as the rows below until you have sent it\)/)
  })

  it('reads the ratio from the base rows when they are thick enough', () => {
    // A pyramid-shaped log: 4 V4 over 8 V3 over 12 V2 → 0.5 and 0.67, median 0.58.
    const shaped = [sess(10, 'V4', 4), sess(20, 'V3', 4), sess(30, 'V3', 4), sess(40, 'V2', 4), sess(50, 'V2', 4), sess(60, 'V2', 4)]
    expect(targetRatio(read(shaped, 'V5').readiness)).toBeCloseTo(0.583, 2)
    // Top-heavy rows are clamped at the top of the range.
    expect(targetRatio(read(base, 'V5').readiness)).toBe(0.8)
    // Thin rows read as the default rather than as nothing.
    expect(targetRatio(read([sess(10, 'V4', 1)], 'V5').readiness)).toBe(0.5)
    // A flat log — as many V3 as V4 — is clamped, not believed.
    const steep = [sess(10, 'V4', 1), sess(20, 'V3', 8)]
    expect(targetRatio(read(steep, 'V5').readiness)).toBe(0.3)
  })

  it('blends the real sends in, weighted by how many there are, and says so', () => {
    const one = at(oneV5, 'become')
    const two = at(twoV5, 'become')
    expect(one.own.source).toBe('blend')
    expect(one.own.spanDays).toBe(28)      // one send six days ago, floored
    expect(two.own.spanDays).toBe(28)
    expect(describeForecastSteps(two)).toMatch(/6 more V5 sends \(.*, from your 2 in 28 days, steadied by assuming V5 comes about three-quarters as often as the rows below\)/)
  })

  it('brings the date nearer with every send — never a leap', () => {
    const none  = at(base, 'become', '2026-11-30')
    const one   = at(oneV5, 'become', '2026-11-30')
    const two   = at(twoV5, 'become', '2026-11-30')
    const three = at(twoV5.concat([sess(34, 'V5', 1)]), 'become', '2026-11-30')
    expect(one.daysToReady).toBeLessThan(none.daysToReady)
    expect(two.daysToReady).toBeLessThan(one.daysToReady)
    expect(three.daysToReady).toBeLessThan(two.daysToReady)
    // The second send used to move the date out by five months; now no
    // single send moves it by more than six weeks.
    expect(Math.abs(two.daysToReady - one.daysToReady)).toBeLessThan(42)
  })

  it('does not treat a flurry as a pace — the span is floored at four weeks', () => {
    const flurry = base.concat([sess(1, 'V5', 2), sess(2, 'V5', 2)])
    const own = at(flurry, 'become')
    expect(own.own.credited).toBe(4)
    expect(own.own.spanDays).toBe(28)
    expect(own.own.perDay).toBeLessThan(4 / 2)
  })

  it('names the year when the date is not this year', () => {
    // A thin base and one V5: the rows fill slowly, the row slower, and the
    // date is next year, so the sentence says so.
    const thin = [sess(80, 'V4', 2), sess(85, 'V3', 2), sess(88, 'V2', 2), sess(6, 'V5', 1)]
    const own = at(thin, 'become', '2026-11-30')
    expect(own.readyIso.slice(0, 4)).toBe('2027')
    expect(describeForecast(own)).toMatch(/^Own V5 around .* 2027 at your current rate\. That is \d+ weeks past your deadline\.$/)
  })

  it('names the goal in the headline', () => {
    expect(describeForecast(at(oneV5, 'become'))).toMatch(/^Own V5 around/)
    expect(describeForecast(at(oneV5, 'send'))).toMatch(/^Ready for V5 now/)
  })

  it('leaves a send goal untouched', () => {
    const send = at(oneV5, 'send')
    expect(send.own).toBe(null)
    expect(send.kind).toBe('send')
  })

  it('has nothing left once the target row is full', () => {
    const owned = base.concat(Array.from({ length: 4 }, (_, i) => sess(3 + i * 2, 'V5', 2)))
    const own = at(owned, 'become')
    expect(own.own.shortfall).toBe(0)
    expect(own.own.days).toBe(0)
    expect(describeForecastSteps(own)).toMatch(/V5 row is full/)
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

// Ben, 2026-09-13: the goal sheet showed the raw readiness dots while the goal
// card and Dashboard showed the deadline-docked mark. Every screen now calls
// readGradeGoal, so these pin that it IS the docked mark.
describe('readGradeGoal — one mark for every screen', () => {
  // The complete base under V5 from the goalScore tests: high enough readiness
  // that a deadline has something to dock.
  const full = [
    ...Array.from({ length: 4 }, (_, i) => sess(10 + i * 7, 'V4', 2)),
    ...Array.from({ length: 2 }, (_, i) => sess(50 + i * 7, 'V3', 2)),
    sess(80, 'V2', 2),
  ]
  const reading = (deadline) => {
    const { pyramid, readiness } = read(full, 'V5')
    const g = readGradeGoal({
      pyramid, readiness, sessions: full, system: 'v', disciplines: ['boulder'],
      targetGrade: 'V5', todayIso: TODAY, deadlineIso: deadline,
    })
    return { readiness, g }
  }

  it('is the deadline-docked mark, not the raw readiness', () => {
    const tight    = reading('2026-09-19')
    const generous = reading('2029-01-01')
    expect(tight.g.mark.score).toBeLessThan(tight.readiness.score)
    expect(tight.g.mark.score).toBe(goalScore({ readiness: tight.readiness, forecast: tight.g.forecast }).score)
    expect(generous.g.mark.score).toBe(generous.readiness.score)
  })

  it('carries the sentences the cards show', () => {
    const { g } = reading('2026-09-19')
    expect(g.forecastLine).toBe(describeForecast(g.forecast))
    expect(g.stepsLine).toBe(describeForecastSteps(g.forecast))
  })

  it('is empty rather than throwing when there is no readiness', () => {
    const g = readGradeGoal({})
    expect(g.mark).toBe(null)
    expect(g.forecastLine).toBe(null)
  })
})
