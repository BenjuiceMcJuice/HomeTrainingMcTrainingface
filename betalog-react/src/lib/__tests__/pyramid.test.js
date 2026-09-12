import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildPyramid, pyramidReadiness, baseGrade, pyramidForGoal, pyramidShapeFor,
  PYRAMID_SHAPE, PYRAMID_WINDOW_DAYS, MAX_SENDS_PER_SESSION, READINESS_LABEL,
} from '../pyramid'

const TODAY = '2026-09-12'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(TODAY + 'T12:00:00'))
})
afterEach(() => { vi.useRealTimers() })

const ago = (n) => new Date(new Date(TODAY + 'T00:00:00') - n * 86400000).toISOString().slice(0, 10)

/** One climbing session: `climbs` as [grade, outcome] pairs. */
const sess = (daysAgo, climbs, discipline = 'boulder') => ({
  date: ago(daysAgo), type: 'climb',
  climbs: climbs.map(([grade, outcome]) => ({ grade, outcome, discipline })),
})

/** `n` separate sessions, each with one send at `grade`. */
const sendsAcross = (n, grade, startDaysAgo = 5, stepDays = 7, discipline = 'boulder') =>
  Array.from({ length: n }, (_, i) => sess(startDaysAgo + i * stepDays, [[grade, 'sent']], discipline))

const boulder = (sessions, extra) =>
  buildPyramid(Object.assign({ sessions, disciplines: ['boulder'], system: 'v', todayIso: TODAY }, extra))

describe('pyramidShapeFor', () => {
  it('maps goal types to disciplines and ladder', () => {
    expect(pyramidShapeFor('boulder_grade')).toEqual({ disciplines: ['boulder'], system: 'v' })
    expect(pyramidShapeFor('rope_grade')).toEqual({ disciplines: ['lead', 'toprope'], system: 'french' })
    expect(pyramidShapeFor('weight')).toBe(null)
  })
})

describe('buildPyramid — counting', () => {
  it('tallies attempts, sends and flashes per grade, hardest first', () => {
    const p = boulder([
      sess(3,  [['V4', 'sent'], ['V4', 'flashed'], ['V5', 'attempt']]),
      sess(10, [['V3', 'sent'], ['V5', 'project']]),
    ])
    expect(p.tiers.map(t => t.grade)).toEqual(['V5', 'V4', 'V3'])
    expect(p.byGrade.V4.attempts).toBe(2)
    expect(p.byGrade.V4.sends).toBe(2)
    expect(p.byGrade.V4.flashes).toBe(1)
    expect(p.byGrade.V5.attempts).toBe(2)
    expect(p.byGrade.V5.sends).toBe(0)
    expect(p.totalAttempts).toBe(5)
    expect(p.totalSends).toBe(3)
    expect(p.sessionCount).toBe(2)
  })

  it('ignores the other discipline and non-climb sessions', () => {
    const p = boulder([
      sess(3, [['V4', 'sent']], 'lead'),
      { date: ago(4), type: 'gym', exercises: [] },
      sess(5, [['V4', 'sent']], 'boulder'),
    ])
    expect(p.totalSends).toBe(1)
    expect(p.sessionCount).toBe(1)
  })

  it('ignores grades that are not on the ladder', () => {
    const p = boulder([sess(3, [['V4', 'sent'], ['Font 7a', 'sent']])])
    expect(p.totalSends).toBe(1)
  })

  it('only counts the window', () => {
    const p = boulder([
      ...sendsAcross(3, 'V4', 5),
      ...sendsAcross(3, 'V6', PYRAMID_WINDOW_DAYS + 10, 7),
    ])
    expect(p.byGrade.V6).toBeUndefined()
    expect(p.project.grade).toBe('V4')
  })
})

describe('buildPyramid — one session cannot fill a tier', () => {
  it('caps what a single session contributes to a grade', () => {
    const laps = boulder([sess(3, [['V4','sent'],['V4','sent'],['V4','sent'],['V4','sent'],['V4','sent'],['V4','sent']])])
    expect(laps.byGrade.V4.sends).toBe(6)                      // honest raw count
    expect(laps.byGrade.V4.credited).toBe(MAX_SENDS_PER_SESSION) // what the pyramid counts
  })

  it('credits the same six sends fully when they are spread across sessions', () => {
    const spread = boulder(sendsAcross(6, 'V4'))
    expect(spread.byGrade.V4.credited).toBe(6)
    expect(spread.byGrade.V4.sessions).toBe(6)
  })

  it('is configurable, so the cap can be changed without touching the model', () => {
    const p = boulder([sess(3, [['V4','sent'],['V4','sent'],['V4','sent']])], { capPerSession: 1 })
    expect(p.byGrade.V4.credited).toBe(1)
  })
})

describe('buildPyramid — the three readings', () => {
  it('project is the hardest grade sent, however rarely', () => {
    const p = boulder([...sendsAcross(8, 'V3'), sess(2, [['V6', 'flashed']])])
    expect(p.project.grade).toBe('V6')
  })

  it('working is the hardest grade genuinely being tried, sent or not', () => {
    const p = boulder([
      ...sendsAcross(8, 'V3'),
      sess(2, [['V5', 'attempt'], ['V5', 'attempt'], ['V5', 'project']]),
    ])
    expect(p.working.grade).toBe('V5')
    expect(p.project.grade).toBe('V3')   // V5 never went
  })

  it('working ignores a grade touched once or twice', () => {
    const p = boulder([...sendsAcross(8, 'V3'), sess(2, [['V6', 'attempt'], ['V6', 'attempt']])])
    expect(p.working.grade).toBe('V3')
  })

  it('reports nulls rather than guesses on an empty log', () => {
    const p = boulder([])
    expect(p.project).toBe(null)
    expect(p.working).toBe(null)
    expect(p.tiers).toEqual([])
  })
})

describe('pyramidReadiness — surplus spills downward', () => {
  it('a lone send at the target fills the top tier and nothing beneath it', () => {
    const p = boulder([sess(2, [['V6', 'flashed']])])
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V6' })
    expect(r.sentTarget).toBe(true)
    expect(r.tiers[0].met).toBe(true)       // V6: need 1
    expect(r.tiers[1].met).toBe(false)      // V5: need 2
    expect(r.complete).toBe(false)
    expect(r.credited).toBe(1)
    expect(r.required).toBe(PYRAMID_SHAPE.reduce((a, b) => a + b, 0))
  })

  it('climbing harder than a tier covers it', () => {
    // Nothing at V4 at all, but plenty at V5 — a V5 climber owns V4.
    const p = boulder(sendsAcross(10, 'V5'))
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V5' })
    expect(r.tiers[0].grade).toBe('V5')
    expect(r.tiers[1].own).toBe(0)          // no V4 sends of its own
    expect(r.tiers[1].met).toBe(true)       // covered by V5 surplus
  })

  it('fills completely when the whole pyramid is there', () => {
    const p = boulder([
      ...sendsAcross(1,  'V5', 3),
      ...sendsAcross(2,  'V4', 12),
      ...sendsAcross(4,  'V3', 30),
      ...sendsAcross(8,  'V2', 60),
    ])
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V5' })
    expect(r.complete).toBe(true)
    expect(r.filledTiers).toBe(4)
    expect(r.pct).toBe(1)
    expect(r.score).toBe(5)
    expect(r.label).toBe(READINESS_LABEL[5])
    expect(r.nextUp).toBe(null)
  })

  it('scores by completeness, with no thresholds to tune', () => {
    const empty = pyramidReadiness({ pyramid: boulder([]), targetGrade: 'V5' })
    expect(empty.pct).toBe(0)
    expect(empty.score).toBe(1)
    expect(empty.label).toBe(READINESS_LABEL[1])
  })

  it('names the tier most worth filling', () => {
    const p = boulder([...sendsAcross(1, 'V5', 3), ...sendsAcross(2, 'V4', 12)])
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V5' })
    expect(r.nextUp.grade).toBe('V2')       // the eight-wide base, entirely missing
    expect(r.nextUp.short).toBe(8)
  })

  it('stops at the bottom of the ladder and says it could not build the shape', () => {
    const p = boulder(sendsAcross(3, 'V1'))
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V1' })
    expect(r.tiers.map(t => t.grade)).toEqual(['V1', 'V0'])
    expect(r.required).toBe(PYRAMID_SHAPE[0] + PYRAMID_SHAPE[1])
    expect(r.truncated).toBe(true)
    expect(r.complete).toBe(false)
  })

  it('says nothing about a target that is not a grade', () => {
    expect(pyramidReadiness({ pyramid: boulder([]), targetGrade: 'banana' }).target).toBe(null)
  })
})

describe('baseGrade — the grade you own', () => {
  it('is the hardest grade whose own pyramid is complete', () => {
    const p = boulder([
      ...sendsAcross(1, 'V5', 3),
      ...sendsAcross(2, 'V4', 12),
      ...sendsAcross(4, 'V3', 30),
      ...sendsAcross(8, 'V2', 60),
      ...sendsAcross(8, 'V1', 130, 6),
    ])
    expect(baseGrade(p).grade).toBe('V5')
  })

  it('is not the project grade when the project is a one-off', () => {
    // A textbook 2/4/8 at V4/V3/V2 with a V8 flash on top. The V8 owns nothing.
    // Nor, strictly, does V4: its pyramid also wants eight sends at V1, and this
    // log has none — it lands one short at 14/15. The model says so rather than
    // rounding up, which is the behaviour that makes `base` mean something.
    const p = boulder([
      sess(2, [['V8', 'flashed']]),
      ...sendsAcross(2, 'V4', 12),
      ...sendsAcross(4, 'V3', 40, 5),
      ...sendsAcross(8, 'V2', 80, 5),
    ])
    expect(p.project.grade).toBe('V8')
    const v4 = pyramidReadiness({ pyramid: p, targetGrade: 'V4' })
    expect(v4.complete).toBe(false)
    expect(v4.credited).toBe(14)
    expect(v4.required).toBe(15)
    expect(baseGrade(p)).toBe(null)
  })

  it('does not let the bottom of the ladder be owned on a short pyramid', () => {
    // V2 has only V1 and V0 beneath it, so the four-tier shape cannot be built.
    // Before this rule V2 completed on three tiers and `base` dropped to V2 for
    // a climber working V4 — a lower bar for lower grades, which made the whole
    // reading incomparable.
    const p = boulder(sendsAcross(12, 'V2'))
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V2' })
    expect(r.truncated).toBe(true)
    expect(r.complete).toBe(false)
    expect(baseGrade(p)).toBe(null)
  })

  it('is null when nothing is owned', () => {
    expect(baseGrade(boulder([sess(2, [['V6', 'flashed']])]))).toBe(null)
    expect(baseGrade(boulder([]))).toBe(null)
  })
})

// ---------------------------------------------------------------------------
// The four cases that each needed a special-case constant in gradeGoalScore.
// The point of the model is that none of them needs one here.
// ---------------------------------------------------------------------------

describe('the cases that broke the single-number model', () => {
  it('a flashed target reads as progress, with no floor constant', () => {
    // 2026-09-11: "How is 6b+ a stretch when I flashed one today???"
    const rope = buildPyramid({
      sessions: [
        sess(0, [['6b+', 'flashed'], ['6b', 'sent']], 'lead'),
        ...sendsAcross(3, '6b', 25, 25, 'lead'),
      ],
      disciplines: ['lead', 'toprope'], system: 'french', todayIso: TODAY,
    })
    const r = pyramidReadiness({ pyramid: rope, targetGrade: '6b+' })
    expect(r.sentTarget).toBe(true)
    expect(r.tiers[0].met).toBe(true)
    expect(r.score).toBeGreaterThan(1)
    // and it still says honestly what is missing, rather than just "Achievable"
    expect(r.complete).toBe(false)
    expect(r.nextUp).not.toBe(null)
  })

  it('one evening of warm-ups moves nothing above it, with no session guard', () => {
    // 2026-09-11: three V1s in one evening used to rewrite a V4 climber as V1.
    const p = boulder([
      ...sendsAcross(6, 'V4', 20),
      sess(2, [['V1', 'sent'], ['V1', 'sent'], ['V1', 'sent']]),
    ])
    expect(p.project.grade).toBe('V4')
    expect(p.byGrade.V1.credited).toBe(MAX_SENDS_PER_SESSION)
    // The warm-ups fill two V1 slots and change nothing about V4.
    expect(p.byGrade.V4.credited).toBe(6)
  })

  it('climbing more never lowers readiness, with no idle penalty', () => {
    // 2026-09-11: an empty log scored better than a log with one session in it.
    const scores = [0, 1, 2, 3, 5, 8, 13].map(n =>
      pyramidReadiness({ pyramid: boulder(sendsAcross(n, 'V4', 5)), targetGrade: 'V5' }).score
    )
    scores.forEach((s, i) => { if (i) expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]) })
  })

  it('a strong season long ago does not erase what was built since', () => {
    // 2026-09-11: running-max tracking reported "no grade change" for V3 -> V4.
    // Inside the window a pyramid simply carries both; outside it, neither.
    const p = boulder([...sendsAcross(4, 'V6', 150, 7), ...sendsAcross(6, 'V4', 20)])
    expect(p.byGrade.V6.credited).toBe(4)
    expect(p.byGrade.V4.credited).toBe(6)
    expect(p.project.grade).toBe('V6')
  })
})

describe('pyramidForGoal', () => {
  it('returns the pyramid, readiness and base in one call', () => {
    const out = pyramidForGoal({
      goalType: 'boulder_grade', targetGrade: 'V5', todayIso: TODAY,
      sessions: [
        ...sendsAcross(1, 'V5', 3),
        ...sendsAcross(2, 'V4', 12),
        ...sendsAcross(4, 'V3', 30),
        ...sendsAcross(8, 'V2', 60),
      ],
    })
    expect(out.readiness.complete).toBe(true)
    expect(out.base.grade).toBe('V5')
    expect(out.pyramid.project.grade).toBe('V5')
  })

  it('is null for a goal that is not a grade', () => {
    expect(pyramidForGoal({ goalType: 'weight', targetGrade: '80', sessions: [] })).toBe(null)
  })
})
