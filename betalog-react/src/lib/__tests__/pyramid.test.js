import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildPyramid, pyramidReadiness, baseGrade, pyramidForGoal, pyramidShapeFor, pyramidLadder,
  PYRAMID_SHAPE, PYRAMID_MAX_DEPTH, PYRAMID_WINDOW_DAYS,
  MAX_SENDS_PER_SESSION, READINESS_LABEL, PYRAMID_COMPLETE_LABEL,
} from '../pyramid'
import { V_GRADES, FRENCH_GRADES } from '../stats'

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

/** The default shape as actually applied — the first `PYRAMID_MAX_DEPTH` tiers. */
const ACTIVE_SHAPE = PYRAMID_SHAPE.slice(0, PYRAMID_MAX_DEPTH)
const TOTAL_NEEDED = ACTIVE_SHAPE.reduce((a, b) => a + b, 0)

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
    expect(laps.byGrade.V4.sends).toBe(6)                        // honest raw count
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

describe('pyramidReadiness — depth', () => {
  it('builds only as deep as PYRAMID_MAX_DEPTH', () => {
    const r = pyramidReadiness({ pyramid: boulder(sendsAcross(20, 'V5')), targetGrade: 'V8' })
    expect(r.depth).toBe(PYRAMID_MAX_DEPTH)
    expect(r.required).toBe(TOTAL_NEEDED)
  })

  it('covers the warm-up tier from surplus above, so skipping warm-ups costs nothing', () => {
    // Ben, 2026-09-12: the bottom tier sits in warm-up territory and does not get
    // logged. Spill is the answer rather than a shorter pyramid — real volume at
    // the grades above flows down and covers it.
    const p = boulder([
      ...sendsAcross(1, 'V5', 3),
      ...sendsAcross(2, 'V4', 12),
      ...sendsAcross(12, 'V3', 30, 5),
    ])
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V5' })
    expect(p.byGrade.V2).toBeUndefined()     // never logged a single warm-up
    expect(r.tiers[3].grade).toBe('V2')
    expect(r.tiers[3].own).toBe(0)
    expect(r.tiers[3].met).toBe(true)        // covered by the V3 surplus
    expect(r.complete).toBe(true)
  })

  it('does not flatter a far-off goal, because there is no surplus to spill', () => {
    // The same depth, a climber with no mileage: nothing above to flow down, so
    // the tiers near the target stay empty and bottom-up counting stops there.
    const log = []
    for (let i = 0; i < 10; i++) {
      const c = [['V4', 'sent'], ['V4', 'attempt']]
      if (i % 3 === 0) c.push(['V3', 'sent'])
      log.push(sess(4 + i * 14, c))
    }
    const p = boulder(log)
    expect(p.project.grade).toBe('V4')

    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V7' })
    expect(r.tiers[0].met).toBe(false)   // V7
    expect(r.tiers[1].met).toBe(false)   // V6
    expect(r.tiers[2].met).toBe(false)   // V5
    expect(r.solidTiers).toBe(1)         // only the V4 row at the very bottom
    expect(r.score).toBeLessThanOrEqual(2)
  })

  it('shrinks further at the bottom of the ladder, which is the right shape', () => {
    const p = boulder(sendsAcross(6, 'V1'))
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V1' })
    expect(r.tiers.map(t => t.grade)).toEqual(['V1', 'V0'])
    expect(r.truncated).toBe(true)
    expect(r.complete).toBe(true)    // shallow, not broken
  })
})

describe('pyramidReadiness — the base beneath the target, at its weakest tier', () => {
  it('a lone send at the target fills the top tier and nothing beneath it', () => {
    const p = boulder([sess(2, [['V6', 'flashed']])])
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V6' })
    expect(r.sentTarget).toBe(true)
    expect(r.topTierMet).toBe(true)
    expect(r.tiers[1].met).toBe(false)
    expect(r.complete).toBe(false)
    // The send is real and is reported, but it is not a base: readiness reads the
    // rows underneath, and they are empty.
    expect(r.solidTiers).toBe(0)
    expect(r.pct).toBe(0)
    expect(r.credited).toBe(1)
    expect(r.required).toBe(TOTAL_NEEDED)
  })

  it('does not call a full bottom row progress while the top is empty', () => {
    // A climber whose hardest send is V4 has a full V4 row inside a V6 pyramid,
    // and counting total material read that as more than half ready for V6.
    // The weakest link answers it outright: the V5 row is empty, so the base is
    // empty, however much V3 and V4 sits under it.
    const p = boulder(sendsAcross(12, 'V4'))
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V6' })
    expect(r.tiers[2].met).toBe(true)     // V4 row is full
    expect(r.tiers[1].met).toBe(false)    // V5 row is empty
    expect(r.solidTiers).toBe(2)          // V3 (from spill) and V4 are there
    expect(r.pct).toBe(0)                 // but V5 is the link, and it is zero
    expect(r.score).toBe(1)
    expect(r.fillPct).toBeGreaterThan(r.pct)  // material exists; structure does not
  })

  it('does not call a base one send short of complete "no base yet"', () => {
    // Ben's export, 2026-09-12, and the case that retired bottom-up counting. The
    // rope log built 6b+ 1/1, 6b 2/2, 6a+ 4/4 and 6a 7/8 — every row but the
    // widest, and that one a single send short. Counting whole tiers from the
    // bottom stopped at the 6a gap and scored it 1, "No base yet", which is the
    // same mark as a climber who has never tied in.
    const p = pyramidReadiness({
      pyramid: buildPyramid({
        sessions: [
          sess(2,  [['6b+', 'flashed'], ['6b', 'flashed'], ['6a+', 'flashed'], ['6a', 'flashed']], 'toprope'),
          sess(9,  [['6b', 'flashed'], ['6a+', 'flashed'], ['6a', 'flashed']], 'toprope'),
          sess(16, [['6b', 'flashed'], ['6b', 'flashed'], ['6a+', 'flashed']], 'toprope'),
          sess(23, [['6a+', 'flashed'], ['6a+', 'flashed'], ['6a', 'flashed'], ['6a', 'flashed']], 'toprope'),
        ],
        disciplines: ['lead', 'toprope'], system: 'french', todayIso: TODAY,
      }),
      targetGrade: '6b+',
    })
    expect(p.tiers.map(t => t.met)).toEqual([true, true, true, false])
    expect(p.tiers[3].short).toBe(1)
    expect(p.pct).toBeCloseTo(7 / 8, 3)
    expect(p.score).toBe(4)
    expect(p.complete).toBe(false)
    // Capped below the top mark: "nearly there" must never read as "there".
    expect(p.label).toBe(READINESS_LABEL[4])
  })

  it('climbing harder than a tier covers it', () => {
    const p = boulder(sendsAcross(20, 'V5'))
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V5' })
    expect(r.tiers[1].own).toBe(0)   // no V4 sends of its own
    expect(r.tiers[1].met).toBe(true)  // covered by V5 surplus
    expect(r.complete).toBe(true)
  })

  it('fills completely when the whole pyramid is there', () => {
    const p = boulder([
      ...sendsAcross(1, 'V5', 3),
      ...sendsAcross(2, 'V4', 12),
      ...sendsAcross(4, 'V3', 30, 5),
      ...sendsAcross(8, 'V2', 60, 5),
    ])
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V5' })
    expect(r.complete).toBe(true)
    // The base rows only — the target is not part of its own base.
    expect(r.solidTiers).toBe(PYRAMID_MAX_DEPTH - 1)
    expect(r.baseDepth).toBe(PYRAMID_MAX_DEPTH - 1)
    expect(r.pct).toBe(1)
    expect(r.score).toBe(5)
    expect(r.nextUp).toBe(null)
  })

  it('calls it a finished pyramid only when the target has been sent too', () => {
    const base = [
      ...sendsAcross(2, 'V4', 12),
      ...sendsAcross(4, 'V3', 30, 5),
      ...sendsAcross(8, 'V2', 60, 5),
    ]
    const unsent = pyramidReadiness({ pyramid: boulder(base), targetGrade: 'V5' })
    expect(unsent.complete).toBe(true)
    expect(unsent.sentTarget).toBe(false)
    expect(unsent.score).toBe(5)
    expect(unsent.label).toBe(READINESS_LABEL[5])   // "Base complete"

    const sent = pyramidReadiness({
      pyramid: boulder([...sendsAcross(1, 'V5', 3), ...base]), targetGrade: 'V5',
    })
    expect(sent.sentTarget).toBe(true)
    expect(sent.label).toBe(PYRAMID_COMPLETE_LABEL)
  })

  it('scores by completeness, with no thresholds to tune', () => {
    const empty = pyramidReadiness({ pyramid: boulder([]), targetGrade: 'V5' })
    expect(empty.pct).toBe(0)
    expect(empty.score).toBe(1)
    expect(empty.label).toBe(READINESS_LABEL[1])
  })

  it('names the weakest tier, so the sentence and the mark mean the same row', () => {
    const p = boulder([...sendsAcross(1, 'V5', 3), ...sendsAcross(2, 'V4', 12)])
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V5' })
    expect(r.nextUp.grade).toBe('V2')   // the eight-wide base, entirely missing
    expect(r.nextUp.short).toBe(8)
  })

  it('prefers a thin tier to a merely large shortfall', () => {
    // V4 2/2 exactly (so nothing spills), V3 1/4 — a quarter — and V2 3/8. The
    // biggest *shortfall* is V2's five, but V3 is the thinner row and the one
    // capping the score, so that is the row to name.
    const p = boulder([
      ...sendsAcross(2, 'V4', 5),
      ...sendsAcross(1, 'V3', 40),
      ...sendsAcross(3, 'V2', 60, 5),
    ])
    const r = pyramidReadiness({ pyramid: p, targetGrade: 'V5' })
    expect(r.tiers[2].have).toBe(1)     // V3, short 3
    expect(r.tiers[3].have).toBe(3)     // V2, short 5
    expect(r.nextUp.grade).toBe('V3')
    expect(r.nextUp.short).toBe(3)
    expect(r.pct).toBeCloseTo(0.25, 3)
  })

  it('says nothing about a target that is not a grade', () => {
    expect(pyramidReadiness({ pyramid: boulder([]), targetGrade: 'banana' }).target).toBe(null)
  })
})

describe('baseGrade — the grade you have actually done a lot of', () => {
  /** A well-logged V4/V5 season with one V6 send in it. */
  const season = () => {
    const log = []
    for (let i = 0; i < 24; i++) {
      const c = [['V3', 'sent'], ['V4', 'sent'], ['V4', 'attempt']]
      if (i % 6 === 0) c.push(['V5', 'sent'])
      if (i === 4)     c.push(['V6', 'sent'])
      log.push(sess(3 + i * 7, c))
    }
    return boulder(log)
  }

  it('is not moved by a single hard send sitting on a broad base', () => {
    // This is the conflation the old definition had: readiness asks "can I get
    // there", and one V6 on a full base answers yes — which made `base` V6.
    const p = season()
    expect(p.project.grade).toBe('V6')
    expect(baseGrade(p).grade).toBe('V4')
  })

  it('follows the widest requirement in the shape', () => {
    const p = season()
    expect(baseGrade(p, [1, 2, 4]).grade).toBe('V5')   // 4 sends at V5 is enough
    expect(baseGrade(p, [1, 2, 4, 8]).grade).toBe('V4') // 8 is not
  })

  it('is null when nothing has been done repeatedly', () => {
    expect(baseGrade(boulder([sess(2, [['V6', 'flashed']])]))).toBe(null)
    expect(baseGrade(boulder([]))).toBe(null)
  })
})

// ---------------------------------------------------------------------------
// The four cases that each needed a special-case constant in gradeGoalScore.
// The point of the model is that none of them needs one here.
// ---------------------------------------------------------------------------

describe('the cases that broke the single-number model', () => {
  it('a flashed target is recorded as a send, with no floor constant', () => {
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
    expect(r.topTierMet).toBe(true)
    // and it still says honestly what is missing rather than declaring victory
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
        ...sendsAcross(8, 'V3', 30, 5),
        ...sendsAcross(8, 'V2', 100, 5),
      ],
    })
    expect(out.readiness.complete).toBe(true)
    expect(out.pyramid.project.grade).toBe('V5')
    expect(out.base.grade).toBe('V3')   // the grade with the volume behind it
  })

  it('is null for a goal that is not a grade', () => {
    expect(pyramidForGoal({ goalType: 'weight', targetGrade: '80', sessions: [] })).toBe(null)
  })
})

describe('pyramidLadder — every grade scored, for the goal picker', () => {
  /** A V4/V5 season: enough volume to complete the base under V5. */
  const season = () => [
    ...sendsAcross(1, 'V5', 3),
    ...sendsAcross(2, 'V4', 12),
    ...sendsAcross(8, 'V3', 30, 5),
    ...sendsAcross(8, 'V2', 100, 5),
  ]

  it('scores the whole ladder off one pass over the log', () => {
    const l = pyramidLadder({ goalType: 'boulder_grade', sessions: season(), todayIso: TODAY })
    expect(l.rungs.length).toBe(V_GRADES.length)
    expect(l.rungs.map(r => r.grade)).toEqual(V_GRADES)
    // Every rung agrees with reading that grade on its own.
    const v6 = l.rungs.find(r => r.grade === 'V6')
    const direct = pyramidReadiness({ pyramid: l.pyramid, targetGrade: 'V6' })
    expect(v6.score).toBe(direct.score)
    expect(v6.label).toBe(direct.label)
  })

  it('names the hardest grade whose base is complete', () => {
    const l = pyramidLadder({ goalType: 'boulder_grade', sessions: season(), todayIso: TODAY })
    expect(l.ready).toBe('V5')
    expect(l.rungs.find(r => r.grade === 'V5').complete).toBe(true)
    expect(l.rungs.find(r => r.grade === 'V6').complete).toBe(false)
  })

  it('has nothing to suggest from a log with nothing in it', () => {
    const l = pyramidLadder({ goalType: 'boulder_grade', sessions: [], todayIso: TODAY })
    expect(l.ready).toBe(null)
    // Every rung still present and still selectable — an empty base is the log
    // saying nothing, not a grade being ruled out.
    expect(l.rungs.length).toBe(V_GRADES.length)
    expect(l.rungs.every(r => r.score === 1)).toBe(true)
  })

  it('reads the rope ladder off the French grades', () => {
    const l = pyramidLadder({
      goalType: 'rope_grade', todayIso: TODAY,
      sessions: [
        ...sendsAcross(2, '6b', 3, 7, 'toprope'),
        ...sendsAcross(4, '6a+', 20, 7, 'lead'),
        ...sendsAcross(8, '6a', 50, 5, 'toprope'),
      ],
    })
    expect(l.rungs.map(r => r.grade)).toEqual(FRENCH_GRADES)
    expect(l.ready).not.toBe(null)
    // Both rope disciplines feed one ladder.
    expect(l.pyramid.byGrade['6a+'].sends).toBe(4)
  })

  it('is null for a goal that is not a grade', () => {
    expect(pyramidLadder({ goalType: 'weight', sessions: [] })).toBe(null)
  })
})
