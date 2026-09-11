import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scoreGradeGoal, gradeTimeline, paceReference, gradeGoalShape,
  consistentGradeAt, windowVolume, describeGradePace, describeGradeReference,
  DEFAULT_DAYS_PER_STEP, LEVEL_FACTOR,
} from '../gradeGoalScore'
import { V_GRADES } from '../stats'

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
    const sessions = [
      consistentSession(300, 'V3'),
      consistentSession(10,  'V5'),
    ]
    expect(consistentGradeAt(sessions, ['boulder'], 'v', ago(295)).grade).toBe('V3')
    expect(consistentGradeAt(sessions, ['boulder'], 'v', TODAY).grade).toBe('V5')
  })

  it('is null when the window holds nothing consistent', () => {
    const sessions = [consistentSession(300, 'V3')]
    expect(consistentGradeAt(sessions, ['boulder'], 'v', TODAY)).toBe(null)
  })

  it('ignores the other discipline', () => {
    const sessions = [consistentSession(10, 'V5', 'boulder')]
    expect(consistentGradeAt(sessions, ['lead', 'toprope'], 'french', TODAY)).toBe(null)
  })
})

describe('gradeTimeline', () => {
  it('dates a grade change and reads the days it took', () => {
    // Consistent at V3 through to ~200 days ago, then consistent at V4.
    const sessions = [
      consistentSession(400, 'V3'), consistentSession(380, 'V3'),
      consistentSession(200, 'V4'), consistentSession(180, 'V4'),
      consistentSession(20,  'V4'),
    ]
    const tl = gradeTimeline(sessions, ['boulder'], 'v', TODAY)
    expect(tl.jumps.length).toBeGreaterThanOrEqual(1)
    const jump = tl.jumps[0]
    expect(jump.from).toBe('V3')
    expect(jump.to).toBe('V4')
    expect(tl.medianDaysPerStep).toBeGreaterThan(0)
  })

  it('charges two rungs gained at once across both, not a fortnight each', () => {
    const sessions = [
      consistentSession(300, 'V2'), consistentSession(290, 'V2'),
      consistentSession(30,  'V4'), consistentSession(20, 'V4'),
    ]
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
    const sessions = [
      consistentSession(460, 'V6'), consistentSession(450, 'V6'),
      consistentSession(330, 'V3'), consistentSession(310, 'V3'),
      consistentSession(190, 'V4'), consistentSession(100, 'V4'),
      consistentSession(30,  'V4'), consistentSession(10, 'V4'),
    ]
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
    const flat = [consistentSession(60, 'V4'), consistentSession(20, 'V4')]
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

describe('windowVolume', () => {
  const sessions = [
    { date: ago(5), type: 'climb', climbs: [
      { grade: 'V4', discipline: 'boulder', outcome: 'sent' },
      { grade: 'V5', discipline: 'boulder', outcome: 'failed' },
      { grade: 'V6', discipline: 'boulder', outcome: 'sent' },
    ] },
    { date: ago(20), type: 'climb', climbs: [
      { grade: 'V4', discipline: 'boulder', outcome: 'sent' },
    ] },
    { date: ago(25), type: 'gym', exercises: [] },
  ]

  it('counts sessions, reach above the current grade, and work at the target', () => {
    const v = windowVolume(sessions, ['boulder'], 90, V_GRADES.indexOf('V4'), V_GRADES.indexOf('V5'), V_GRADES)
    expect(v.sessions).toBe(2)               // the gym session is not climbing
    expect(v.aboveCurrent).toBe(2)           // V5 and V6
    expect(v.atTarget).toBe(2)               // V5 and V6 are both ≥ V5
    expect(v.sentAtTarget).toBe(1)           // only the V6 went
    expect(v.sessionsPerWeek).toBeCloseTo(0.2, 1)
  })
})

describe('scoreGradeGoal — says nothing when it cannot say anything', () => {
  it('is null without a current grade to measure from', () => {
    const s = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2026-12-01' },
      currentGrade: null, sessions: [],
    })
    expect(s.score).toBe(null)
    expect(s.label).toBe('Not enough to say')
  })

  it('is null for a weight goal, a past date, or a target already reached', () => {
    const base = { currentGrade: 'V4', sessions: [] }
    expect(scoreGradeGoal({ ...base, goal: { type: 'weight', target: 85, targetDate: '2026-12-01' } }).score).toBe(null)
    expect(scoreGradeGoal({ ...base, goal: { type: 'boulder_grade', target: 'V5', targetDate: '2026-01-01' } }).score).toBe(null)
    expect(scoreGradeGoal({ ...base, goal: { type: 'boulder_grade', target: 'V3', targetDate: '2026-12-01' } }).score).toBe(null)
    expect(scoreGradeGoal({ ...base, goal: { type: 'boulder_grade', target: 'V5' } }).score).toBe(null)
  })
})

describe('scoreGradeGoal — the pace factor', () => {
  // Two years of steady V4, so there is volume and no grade change: the
  // reference is the default, and only the date moves between the two cases.
  const steadyV4 = Array.from({ length: 40 }, (_, i) => consistentSession(5 + i * 7, 'V4'))

  it('rates a patient goal above a rushed one', () => {
    const patient = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2027-06-01' },
      currentGrade: 'V4', sessions: steadyV4, todayIso: TODAY,
    })
    const rushed = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2026-10-01' },
      currentGrade: 'V4', sessions: steadyV4, todayIso: TODAY,
    })
    expect(patient.score).toBeGreaterThan(rushed.score)
    expect(patient.gradesToGo).toBe(1)
    expect(rushed.daysPerStepNeeded).toBeLessThan(patient.daysPerStepNeeded)
  })

  it('measures against the log once the log has a grade change in it', () => {
    const withJump = [
      consistentSession(400, 'V3'), consistentSession(380, 'V3'),
      consistentSession(300, 'V4'), consistentSession(200, 'V4'),
      consistentSession(30,  'V4'), consistentSession(10, 'V4'),
    ]
    const s = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2027-01-01' },
      currentGrade: 'V4', sessions: withJump, todayIso: TODAY,
    })
    expect(s.reference.source).toBe('log')
    expect(describeGradeReference(s, 'v')).toMatch(/Your own log/)
  })

  it('names the default as a default, so it is never passed off as measured', () => {
    const s = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2027-01-01' },
      currentGrade: 'V4', sessions: [consistentSession(10, 'V4')], todayIso: TODAY,
    })
    expect(s.reference.source).toBe('default')
    expect(describeGradeReference(s, 'v')).toMatch(/No grade change in your log yet/)
  })
})

describe('scoreGradeGoal — volume and reach', () => {
  it('marks down a goal set by someone who has not climbed', () => {
    const s = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2027-06-01' },
      currentGrade: 'V4', sessions: [consistentSession(200, 'V4')], todayIso: TODAY,
    })
    const factors = s.reasons.map(r => r.factor)
    expect(factors).toContain('volume')
    expect(s.reasons.find(r => r.factor === 'volume').verdict).toBe('bad')
  })

  it('marks down a log with nothing harder than the current grade in it', () => {
    const sessions = Array.from({ length: 26 }, (_, i) => consistentSession(3 + i * 3, 'V4'))
    const s = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2027-06-01' },
      currentGrade: 'V4', sessions, todayIso: TODAY,
    })
    const reach = s.reasons.find(r => r.factor === 'reach')
    expect(reach.verdict).toBe('bad')
    expect(reach.detail).toMatch(/Nothing harder than V4/)
  })

  it('credits sends already at the target', () => {
    const sessions = Array.from({ length: 26 }, (_, i) => ({
      date: ago(3 + i * 3), type: 'climb',
      climbs: [
        { grade: 'V4', discipline: 'boulder', outcome: 'sent' },
        { grade: 'V4', discipline: 'boulder', outcome: 'sent' },
        { grade: 'V4', discipline: 'boulder', outcome: 'sent' },
        { grade: 'V5', discipline: 'boulder', outcome: i % 5 === 0 ? 'sent' : 'failed' },
      ],
    }))
    const s = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2027-06-01' },
      currentGrade: 'V4', sessions, todayIso: TODAY,
    })
    const reach = s.reasons.find(r => r.factor === 'reach')
    expect(reach.verdict).toBe('ok')
    expect(reach.penalty).toBe(0)
    expect(s.score).toBeGreaterThanOrEqual(4)
  })
})

describe('scoreGradeGoal — schedule debt', () => {
  const sessions = Array.from({ length: 26 }, (_, i) => consistentSession(3 + i * 3, 'V4'))

  it('charges a goal that has burned its time without moving', () => {
    const s = scoreGradeGoal({
      goal: {
        type: 'boulder_grade', target: 'V5', targetDate: '2026-10-11',
        startValue: 'V4', createdAt: ago(300),
      },
      currentGrade: 'V4', sessions, todayIso: TODAY,
    })
    const sched = s.reasons.find(r => r.factor === 'schedule')
    expect(sched.verdict).toBe('bad')
    expect(s.scheduleDebt).toBeGreaterThan(0.25)
  })

  it('charges half when the grade has gone backwards, because reach already paid', () => {
    const s = scoreGradeGoal({
      goal: {
        type: 'boulder_grade', target: 'V6', targetDate: '2027-01-01',
        startValue: 'V5', createdAt: ago(120),
      },
      currentGrade: 'V4', sessions, todayIso: TODAY,
    })
    const sched = s.reasons.find(r => r.factor === 'schedule')
    expect(sched.penalty).toBe(0.5)
    expect(sched.detail).toMatch(/dropped/)
  })

  it('says nothing about schedule on a goal set today', () => {
    const s = scoreGradeGoal({
      goal: {
        type: 'boulder_grade', target: 'V5', targetDate: '2027-01-01',
        startValue: 'V4', createdAt: TODAY,
      },
      currentGrade: 'V4', sessions, todayIso: TODAY,
    })
    expect(s.reasons.find(r => r.factor === 'schedule')).toBeUndefined()
    expect(s.scheduleDebt).toBe(null)
  })
})

describe('scoreGradeGoal — the score itself', () => {
  it('stays inside 1–5 however bad the goal is', () => {
    const s = scoreGradeGoal({
      goal: {
        type: 'boulder_grade', target: 'V10', targetDate: '2026-10-01',
        startValue: 'V5', createdAt: ago(300),
      },
      currentGrade: 'V4', sessions: [], todayIso: TODAY,
    })
    expect(s.score).toBe(1)
    expect(s.label).toBe('Not achievable as set')
  })

  it('never blocks — there is no blocked flag to find', () => {
    const s = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V12', targetDate: '2026-09-20' },
      currentGrade: 'V4', sessions: [], todayIso: TODAY,
    })
    expect(s.blocked).toBeUndefined()
    expect(s.score).toBeLessThanOrEqual(2)
  })
})

describe('describeGradePace', () => {
  it('states one grade as a span, and several as a span plus a per-grade figure', () => {
    const one = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2027-01-01' },
      currentGrade: 'V4', sessions: [], todayIso: TODAY,
    })
    expect(describeGradePace(one, 'v')).toMatch(/^1 grade in \d+ days$/)

    const two = scoreGradeGoal({
      goal: { type: 'rope_grade', target: '7a', targetDate: '2027-01-01' },
      currentGrade: '6c', sessions: [], todayIso: TODAY,
    })
    expect(describeGradePace(two, 'french')).toMatch(/2 grade steps in \d+ days · \d+ days each/)
  })

  it('is null without a score to describe', () => {
    expect(describeGradePace(null, 'v')).toBe(null)
    expect(describeGradeReference(null, 'v')).toBe(null)
  })
})
