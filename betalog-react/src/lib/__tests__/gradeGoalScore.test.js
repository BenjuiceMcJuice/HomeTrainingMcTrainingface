import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  gradeTimeline, paceReference, gradeGoalShape, consistentGradeAt,
  DEFAULT_DAYS_PER_STEP, LEVEL_FACTOR,
} from '../gradeGoalScore'
import { V_GRADES } from '../stats'

// Covers what survived the pyramid rewrite: the time side — how long a grade has
// actually taken this athlete. `scoreGradeGoal` and its tests were deleted on
// 2026-09-12; the cases they guarded now live in `pyramid.test.js`.
//
// Every date-sensitive test runs against a fixed today, so "90 days ago" means
// the same thing in June as it does in December.
const TODAY = '2026-09-11'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(TODAY + 'T12:00:00'))
})
afterEach(() => { vi.useRealTimers() })

/** n days before TODAY, as an ISO date. */
const ago = (n) => new Date(new Date(TODAY + 'T00:00:00') - n * 86400000).toISOString().slice(0, 10)

/**
 * A climb session that makes `grade` consistent on its own: 4 attempts, 3 sent,
 * which clears both the ≥3 attempts and the ≥40% send-rate rule.
 */
const consistentSession = (daysAgo, grade, discipline = 'boulder') => ({
  date: ago(daysAgo), type: 'climb',
  climbs: [
    { grade, discipline, outcome: 'sent' },
    { grade, discipline, outcome: 'sent' },
    { grade, discipline, outcome: 'sent' },
    { grade, discipline, outcome: 'failed' },
  ],
})

/**
 * A stretch of weekly sessions at one grade, oldest first — what a grade era
 * actually looks like in a log.
 *
 * Single sessions will not do: a window is only read once it holds
 * `MIN_WINDOW_SESSIONS` of them, because three warm-ups on one evening would
 * otherwise redefine an athlete's grade. Fixtures that skip that are fixtures
 * of a log nobody has.
 */
const era = (startDaysAgo, weeks, grade, discipline = 'boulder') =>
  Array.from({ length: weeks }, (_, i) => consistentSession(startDaysAgo - i * 7, grade, discipline))

describe('gradeGoalShape', () => {
  it('maps each grade goal to its disciplines and ladder', () => {
    expect(gradeGoalShape('boulder_grade')).toEqual({
      disciplines: ['boulder'], system: 'v', gradeOrder: V_GRADES,
    })
    expect(gradeGoalShape('rope_grade').disciplines).toEqual(['lead', 'toprope'])
    expect(gradeGoalShape('rope_grade').system).toBe('french')
  })

  it('is null for everything that is not a grade', () => {
    expect(gradeGoalShape('weight')).toBe(null)
    expect(gradeGoalShape('run')).toBe(null)
    expect(gradeGoalShape(undefined)).toBe(null)
  })
})

describe('consistentGradeAt', () => {
  it('reads the grade as it stood on a past date, not as it stands now', () => {
    const sessions = [...era(320, 4, 'V3'), ...era(30, 4, 'V5')]
    expect(consistentGradeAt(sessions, ['boulder'], 'v', ago(295)).grade).toBe('V3')
    expect(consistentGradeAt(sessions, ['boulder'], 'v', TODAY).grade).toBe('V5')
  })

  it('is null when the window holds nothing consistent', () => {
    const sessions = era(320, 4, 'V3')
    expect(consistentGradeAt(sessions, ['boulder'], 'v', TODAY)).toBe(null)
  })

  it('refuses to read a window holding fewer than three sessions', () => {
    // The warm-up trap: three V1s in one evening satisfy the per-grade attempt
    // rule on their own, and used to report "consistent at V1".
    const oneEvening = [{
      date: ago(2), type: 'climb',
      climbs: [
        { grade: 'V1', discipline: 'boulder', outcome: 'sent' },
        { grade: 'V1', discipline: 'boulder', outcome: 'sent' },
        { grade: 'V1', discipline: 'boulder', outcome: 'sent' },
      ],
    }]
    expect(consistentGradeAt(oneEvening, ['boulder'], 'v', TODAY)).toBe(null)
    expect(consistentGradeAt(oneEvening.concat(era(20, 3, 'V1')), ['boulder'], 'v', TODAY).grade).toBe('V1')
  })

  it('ignores the other discipline', () => {
    const sessions = [consistentSession(10, 'V5', 'boulder')]
    expect(consistentGradeAt(sessions, ['lead', 'toprope'], 'french', TODAY)).toBe(null)
  })
})

describe('gradeTimeline', () => {
  it('dates a grade change and reads the days it took', () => {
    // Consistent at V3 through to ~200 days ago, then consistent at V4.
    const sessions = [...era(400, 10, 'V3'), ...era(250, 10, 'V4'), ...era(100, 12, 'V4')]
    const tl = gradeTimeline(sessions, ['boulder'], 'v', TODAY)
    expect(tl.jumps.length).toBeGreaterThanOrEqual(1)
    const jump = tl.jumps[0]
    expect(jump.from).toBe('V3')
    expect(jump.to).toBe('V4')
    expect(tl.medianDaysPerStep).toBeGreaterThan(0)
  })

  it('charges two rungs gained at once across both, not a fortnight each', () => {
    const sessions = [...era(300, 10, 'V2'), ...era(140, 18, 'V4')]
    const tl = gradeTimeline(sessions, ['boulder'], 'v', TODAY)
    const jump = tl.jumps[0]
    expect(jump.to).toBe('V4')
    // Two rungs over the elapsed days — not one step's worth of calendar.
    expect(jump.daysPerStep).toBe(Math.round(jump.days / 2))
    expect(jump.daysPerStep).toBeGreaterThan(50)
  })

  it('counts a regained grade — a strong season long ago must not erase it', () => {
    // This is the case that broke the first version: running-max tracking meant
    // the V6 season swallowed the V3 → V4 climb back, and the athlete was told
    // they had never moved a grade.
    const sessions = [...era(520, 10, 'V6'), ...era(390, 10, 'V3'), ...era(240, 30, 'V4')]
    const tl = gradeTimeline(sessions, ['boulder'], 'v', TODAY)
    expect(tl.jumps.length).toBe(1)
    expect(tl.jumps[0].from).toBe('V3')
    expect(tl.jumps[0].to).toBe('V4')
    expect(tl.medianDaysPerStep).toBeGreaterThan(60)
  })

  it('ignores a rise that does not stick', () => {
    // One fortnight at V5 in the middle of a long V4 run is a good session, not
    // a grade. Sampling is fortnightly, so a single spike shows up as one point.
    const sessions = []
    for (let i = 0; i < 40; i++) sessions.push(consistentSession(10 + i * 7, 'V4'))
    sessions.push({
      date: ago(150), type: 'climb',
      climbs: Array.from({ length: 20 }, () => ({ grade: 'V5', discipline: 'boulder', outcome: 'sent' })),
    })
    const tl = gradeTimeline(sessions, ['boulder'], 'v', TODAY)
    expect(tl.jumps.every(j => j.to !== 'V5' || j.days > 30)).toBe(true)
  })

  it('says nothing from an empty or one-grade log', () => {
    expect(gradeTimeline([], ['boulder'], 'v', TODAY).medianDaysPerStep).toBe(null)
    const flat = era(60, 8, 'V4')
    expect(gradeTimeline(flat, ['boulder'], 'v', TODAY).medianDaysPerStep).toBe(null)
  })
})

describe('paceReference', () => {
  it('prefers the athlete\'s own log when it has a grade change in it', () => {
    const ref = paceReference({
      timeline: { jumps: [{}], medianDaysPerStep: 84 }, system: 'v', targetGrade: 'V5',
    })
    expect(ref).toEqual({ daysPerStep: 84, source: 'log', jumps: 1 })
  })

  it('falls back to the stated default, scaled by how hard the target is', () => {
    const easy = paceReference({ timeline: {}, system: 'v', targetGrade: 'V1' })
    const hard = paceReference({ timeline: {}, system: 'v', targetGrade: 'V8' })
    expect(easy.source).toBe('default')
    expect(easy.daysPerStep).toBe(Math.round(DEFAULT_DAYS_PER_STEP.v * LEVEL_FACTOR.Beginner))
    expect(hard.daysPerStep).toBeGreaterThan(easy.daysPerStep)
  })

  it('treats a French rung as roughly half a V-grade', () => {
    expect(DEFAULT_DAYS_PER_STEP.french).toBeLessThan(DEFAULT_DAYS_PER_STEP.v)
  })
})

