import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scoreGradeGoal, gradeTimeline, paceReference, gradeGoalShape,
  consistentGradeAt, windowVolume, describeGradePace, describeGradeReference,
  DEFAULT_DAYS_PER_STEP, LEVEL_FACTOR, IDLE_PENALTY, SENT_AT_TARGET_FLOOR,
  describeGradeEvidence,
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
    const withJump = [...era(400, 10, 'V3'), ...era(260, 34, 'V4')]
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
      currentGrade: 'V4', sessions: era(60, 8, 'V4'), todayIso: TODAY,
    })
    expect(s.reference.source).toBe('default')
    expect(describeGradeReference(s, 'v')).toMatch(/No grade change in your log yet/)
  })
})

describe('scoreGradeGoal — volume and reach', () => {
  it('marks down a goal set by someone who has not climbed', () => {
    const s = scoreGradeGoal({
      goal: { type: 'boulder_grade', target: 'V5', targetDate: '2027-06-01' },
      currentGrade: 'V4', sessions: era(200, 4, 'V4'), todayIso: TODAY,
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

describe('scoreGradeGoal — climbing more must never score worse', () => {
  // The bug this guards: volume and reach both charged for inactivity, and only
  // the zero-session case was protected against the double-count. An empty log
  // scored 3 and a single session scored 2 — the app told an athlete that going
  // bouldering had made their goal less achievable.
  const goal = {
    type: 'boulder_grade', target: 'V5', targetDate: '2027-01-31',
    startValue: 'V4', createdAt: ago(60),
  }

  /** `n` sessions spread across the window, all at V4 — no reaching, by design. */
  const sessionsOf = (n) =>
    Array.from({ length: n }, (_, i) => consistentSession(3 + i * Math.floor(85 / Math.max(n, 1)), 'V4'))

  it('does not score an empty log above a log with one session in it', () => {
    const none = scoreGradeGoal({ goal, currentGrade: 'V4', sessions: [], todayIso: TODAY })
    const one  = scoreGradeGoal({ goal, currentGrade: 'V4', sessions: sessionsOf(1), todayIso: TODAY })
    expect(one.score).toBeGreaterThanOrEqual(none.score)
  })

  it('never lowers the score as sessions are added, all else equal', () => {
    const scores = [0, 1, 2, 3, 5, 8, 13, 20, 30].map(n =>
      scoreGradeGoal({ goal, currentGrade: 'V4', sessions: sessionsOf(n), todayIso: TODAY }).score
    )
    scores.forEach((s, i) => {
      if (i === 0) return
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
    })
  })

  it('charges inactivity once, not twice — reach stays silent in the bottom band', () => {
    const one = scoreGradeGoal({ goal, currentGrade: 'V4', sessions: sessionsOf(1), todayIso: TODAY })
    const reach = one.reasons.find(r => r.factor === 'reach')
    expect(reach.penalty).toBe(0)
    expect(one.reasons.find(r => r.factor === 'volume').penalty).toBe(IDLE_PENALTY)
  })

  it('keeps the idle penalty above anything a busier log can total', () => {
    // Volume's next band up (0.75) plus the worst reach (1) is 1.75. If the idle
    // penalty ever drops to or below that, the monotonicity above breaks.
    expect(IDLE_PENALTY).toBeGreaterThan(1.75)
  })

  it('still marks down a log with plenty of climbing but no reaching', () => {
    const busy = scoreGradeGoal({ goal, currentGrade: 'V4', sessions: sessionsOf(30), todayIso: TODAY })
    const reach = busy.reasons.find(r => r.factor === 'reach')
    expect(reach.verdict).toBe('bad')
    expect(reach.detail).toMatch(/Nothing harder than V4/)
  })
})

describe('scoreGradeGoal — a send at the target beats every inference', () => {
  // Ben, 2026-09-11: "How is 6b+ a stretch when I flashed one today???" The
  // idle rule from that morning was written as a leading `if (idle)`, so at
  // 0.3 sessions a week it gagged the reach factor entirely — including the
  // branch holding `sentAtTarget: 1`. The card said "too little logged to judge
  // what you are trying" about a log containing a flash of the target grade.
  const thin = [25, 50, 75].map(d => ({
    date: ago(d), type: 'climb',
    climbs: [
      { grade: '6b', discipline: 'lead', outcome: 'sent' },
      { grade: '6b', discipline: 'lead', outcome: 'sent' },
      { grade: '6b', discipline: 'lead', outcome: 'failed' },
    ],
  }))
  const flashToday = {
    date: ago(0), type: 'climb',
    climbs: [{ grade: '6b+', discipline: 'lead', outcome: 'flashed' }],
  }
  const goal = {
    type: 'rope_grade', target: '6b+', targetDate: '2026-10-31',
    startValue: '6b', createdAt: ago(10),
  }
  const score = (sessions) => scoreGradeGoal({ goal, currentGrade: '6b', sessions, todayIso: TODAY })

  it('lets reach speak on a send however thin the mileage', () => {
    const reach = score(thin.concat([flashToday])).reasons.find(r => r.factor === 'reach')
    expect(reach.verdict).toBe('ok')
    expect(reach.detail).toMatch(/1 send at 6b\+ or harder already/)
  })

  it('never calls a grade you have already sent unlikely', () => {
    const before = score(thin)
    const after  = score(thin.concat([flashToday]))
    expect(before.score).toBeLessThan(SENT_AT_TARGET_FLOOR)
    expect(after.score).toBeGreaterThanOrEqual(SENT_AT_TARGET_FLOOR)
    expect(after.label).not.toMatch(/Unlikely|Not achievable|stretch/)
  })

  it('floors rather than fixes — thin mileage still costs the fifth dot', () => {
    expect(score(thin.concat([flashToday])).score).toBe(SENT_AT_TARGET_FLOOR)
  })

  it('gives the card a line saying what changed', () => {
    expect(describeGradeEvidence(score(thin))).toBe(null)
    expect(describeGradeEvidence(score(thin.concat([flashToday])))).toMatch(/1 send at 6b\+/)
  })

  it('keeps the idle gag for the case it was written for', () => {
    // No send, thin mileage: reach must still stay silent rather than charge
    // for the same absence volume already charged for.
    const reach = score(thin).reasons.find(r => r.factor === 'reach')
    expect(reach.penalty).toBe(0)
    expect(reach.detail).toMatch(/Too little logged/)
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
