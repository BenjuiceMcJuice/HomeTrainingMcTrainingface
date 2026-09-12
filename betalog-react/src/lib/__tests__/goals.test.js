import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getCurrentValue, getCurrentValueDetail, getAchievementValueDetail, currentReading,
  calcGoalProgress, GRADE_WINDOW_DAYS, ACHIEVE_WINDOW_DAYS,
} from '../goals'

const TODAY = '2026-09-11'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(TODAY + 'T12:00:00'))
})
afterEach(() => { vi.useRealTimers() })

const ago = (n) => new Date(new Date(TODAY + 'T00:00:00') - n * 86400000).toISOString().slice(0, 10)

/** 4 attempts, 3 sent — consistent at `grade` on the app's own rule. */
const consistentSession = (daysAgo, grade, discipline = 'boulder') => ({
  date: ago(daysAgo), type: 'climb',
  climbs: [
    { grade, discipline, outcome: 'sent' },
    { grade, discipline, outcome: 'sent' },
    { grade, discipline, outcome: 'sent' },
    { grade, discipline, outcome: 'failed' },
  ],
})

/** A run of weekly sessions at one grade — a window is only read once it holds
 *  at least MIN_WINDOW_SESSIONS of them. */
const era = (startDaysAgo, weeks, grade, discipline = 'boulder') =>
  Array.from({ length: weeks }, (_, i) => consistentSession(startDaysAgo - i * 7, grade, discipline))

// Auto-achieve kept the pre-pyramid reading when the goal card moved to the
// base grade (spec Q1), so these tests followed it rather than being deleted:
// they are the guard that answering Q1 did not silently answer Q2 too.
describe('getAchievementValueDetail — auto-achieve still reads the last 90 days', () => {
  it('reports the recent grade, not the career high', () => {
    const sessions = [
      ...era(400, 8, 'V6'),   // a strong season, long gone
      ...era(40, 5, 'V4'),    // where things actually are
    ]
    const d = getAchievementValueDetail('boulder_grade', sessions, [])
    expect(d.value).toBe('V4')
    expect(d.basis).toBe('window')
  })

  it('falls back to all time rather than reporting nothing', () => {
    const sessions = era(200, 8, 'V6')
    const d = getAchievementValueDetail('boulder_grade', sessions, [])
    expect(d.value).toBe('V6')
    expect(d.basis).toBe('all')
  })

  it('is null when there is nothing consistent anywhere', () => {
    const sessions = [{ date: ago(5), type: 'climb', climbs: [{ grade: 'V4', discipline: 'boulder', outcome: 'sent' }] }]
    expect(getAchievementValueDetail('boulder_grade', sessions, []).value).toBe(null)
    expect(getAchievementValueDetail('boulder_grade', sessions, []).basis).toBe(null)
  })

  it('draws the line at the window edge', () => {
    const inside  = era(ACHIEVE_WINDOW_DAYS - 2, 4, 'V5')
    const outside = era(ACHIEVE_WINDOW_DAYS + 30, 4, 'V5')
    expect(getAchievementValueDetail('boulder_grade', inside, []).basis).toBe('window')
    expect(getAchievementValueDetail('boulder_grade', outside, []).basis).toBe('all')
  })

  it('keeps rope goals on the rope disciplines', () => {
    const sessions = [
      ...era(30, 4, 'V5', 'boulder'),
      ...era(30, 4, '6c', 'lead'),
    ]
    expect(getAchievementValueDetail('rope_grade', sessions, []).value).toBe('6c')
    expect(getAchievementValueDetail('boulder_grade', sessions, []).value).toBe('V5')
  })
})

describe('getAchievementValueDetail — a thin window is not a reading', () => {
  // Ben, 2026-09-11: "I did one V1 Wednesday." One session — correctly ignored.
  // But three V1s in that one evening satisfy the per-grade attempt rule on
  // their own, and used to rewrite a V4 climber as "Currently V1 · 4 grades to
  // go", labelled `basis: 'window'` as though it were a live measurement.
  const oldForm = era(200, 8, 'V4')
  const warmUpEvening = {
    date: ago(2), type: 'climb',
    climbs: [
      { grade: 'V1', discipline: 'boulder', outcome: 'sent' },
      { grade: 'V1', discipline: 'boulder', outcome: 'sent' },
      { grade: 'V1', discipline: 'boulder', outcome: 'sent' },
    ],
  }

  it('does not let one evening of warm-ups redefine your grade', () => {
    const d = getAchievementValueDetail('boulder_grade', oldForm.concat([warmUpEvening]), [])
    expect(d.value).toBe('V4')
    expect(d.basis).toBe('all')
  })

  it('reads the window once there are enough sessions in it to mean something', () => {
    const d = getAchievementValueDetail('boulder_grade', oldForm.concat(era(20, 3, 'V1')), [])
    expect(d.value).toBe('V1')
    expect(d.basis).toBe('window')
  })

  it('needs three sessions, not three climbs', () => {
    const two = getAchievementValueDetail('boulder_grade', oldForm.concat(era(20, 2, 'V1')), [])
    expect(two.basis).toBe('all')
  })
})

// Ben's call on spec Q1, 2026-09-12: "Currently" is the grade you own.
//
// A base needs the widest tier of the pyramid filled — 8 credited sends at the
// grade, capped at 2 per session — so it takes four separate sessions and cannot
// be bought with one good evening. These tests exist mostly to pin the two ways
// it is allowed to read low: an absent base stays absent, and a hard single send
// does not lift it.
describe('getCurrentValueDetail — a grade goal reads the base grade', () => {
  it('reports the grade the log actually owns', () => {
    // 4 sessions x 2 credited = the 8 the widest tier asks for.
    const d = getCurrentValueDetail('boulder_grade', era(40, 4, 'V4'), [])
    expect(d.value).toBe('V4')
    expect(d.basis).toBe('base')
  })

  it('will not call a grade owned one session short', () => {
    const d = getCurrentValueDetail('boulder_grade', era(40, 3, 'V4'), [])
    expect(d.value).toBe(null)
    expect(d.basis).toBe(null)
  })

  it('a single hard send is a project, never a base', () => {
    const sessions = era(40, 4, 'V4').concat([{
      date: ago(10), type: 'climb',
      climbs: [{ grade: 'V6', discipline: 'boulder', outcome: 'sent' }],
    }])
    const d = getCurrentValueDetail('boulder_grade', sessions, [])
    expect(d.value).toBe('V4')
    expect(d.reading.project).toBe('V6')
  })

  it('says nothing rather than falling back to a career high', () => {
    // The old reading answered V6 here, labelled "(all time)". A base is a
    // statement about the window or it is not a statement.
    const d = getCurrentValueDetail('boulder_grade', era(400, 8, 'V6'), [])
    expect(d.value).toBe(null)
    expect(d.basis).toBe(null)
  })

  it('measures over the pyramid window, not the old 90 days', () => {
    expect(GRADE_WINDOW_DAYS).toBe(180)
    const inside = era(150, 4, 'V4')
    expect(getCurrentValueDetail('boulder_grade', inside, []).value).toBe('V4')
    expect(getAchievementValueDetail('boulder_grade', inside, []).basis).toBe('all')
  })

  it('keeps rope goals on the rope disciplines', () => {
    const sessions = era(30, 4, 'V5', 'boulder').concat(era(30, 4, '6c', 'lead'))
    expect(getCurrentValueDetail('rope_grade', sessions, []).value).toBe('6c')
    expect(getCurrentValueDetail('boulder_grade', sessions, []).value).toBe('V5')
  })
})

describe('currentReading — the one reader', () => {
  it('returns all three readings so a caller can show context', () => {
    const sessions = era(40, 4, 'V4').concat([{
      date: ago(10), type: 'climb',
      climbs: [
        { grade: 'V6', discipline: 'boulder', outcome: 'sent' },
        { grade: 'V5', discipline: 'boulder', outcome: 'failed' },
        { grade: 'V5', discipline: 'boulder', outcome: 'failed' },
        { grade: 'V5', discipline: 'boulder', outcome: 'failed' },
      ],
    }])
    const r = currentReading('boulder_grade', sessions)
    expect(r.base).toBe('V4')
    expect(r.working).toBe('V5')
    expect(r.project).toBe('V6')
    expect(r.windowDays).toBe(GRADE_WINDOW_DAYS)
  })

  it('is null for a goal type with no pyramid', () => {
    expect(currentReading('weight', [])).toBe(null)
  })
})

// A distance goal is in km; `cardioQuantity` is a bare number in whatever unit
// the logger was set to, and the defaults are miles for run/cycle and lengths
// for swim. These are the readings that used to come out wrong (BTL-B28).
describe('getCurrentValueDetail — cardio goals normalise the unit', () => {
  const cardio = (act, qty, unit, extra) => Object.assign({
    date: ago(3), type: 'cardio', cardioActivity: act, cardioQuantity: qty, cardioUnit: unit,
  }, extra || {})

  it('reads miles as miles, not as km', () => {
    // 6 miles = 9.66 km. Used to read 6.
    const d = getCurrentValueDetail('run', [cardio('run', 6, 'miles')], [])
    expect(d.value).toBeCloseTo(9.66, 1)
    expect(d.basis).toBe('all')
  })

  it('reads a swim in metres as metres', () => {
    // Used to read 1500 "km" and auto-achieve any sane goal.
    expect(getCurrentValueDetail('swim', [cardio('swim', 1500, 'm')], []).value).toBe(1.5)
  })

  it('reads lengths through the pool length', () => {
    const d = getCurrentValueDetail('swim',
      [cardio('swim', 40, 'lengths', { cardioPoolLength: 25 })], [])
    expect(d.value).toBe(1)
  })

  it('takes the longest distance, not the biggest number', () => {
    // 5 km beats 2 miles (3.2 km) even though 5 < ... well, 5 > 2 here, so use
    // the case that actually used to break: 1500 m vs 5 km.
    const sessions = [cardio('swim', 1500, 'm'), cardio('swim', 5, 'km')]
    expect(getCurrentValueDetail('swim', sessions, []).value).toBe(5)
  })

  it('ignores a session whose distance cannot be known', () => {
    // Lengths with no pool length: how far that was is genuinely unknown.
    const d = getCurrentValueDetail('swim', [cardio('swim', 40, 'lengths')], [])
    expect(d.value).toBe(null)
    expect(d.basis).toBe(null)
  })

  it('keeps activities apart', () => {
    const sessions = [cardio('run', 10, 'km'), cardio('cycle', 40, 'km')]
    expect(getCurrentValueDetail('run', sessions, []).value).toBe(10)
    expect(getCurrentValueDetail('cycle', sessions, []).value).toBe(40)
  })

  it('progress against a km goal is measured in km', () => {
    const goal = { type: 'run', startValue: 0, target: 10, unit: 'km' }
    const v = getCurrentValueDetail('run', [cardio('run', 6, 'miles')], []).value
    expect(Math.round(calcGoalProgress(goal, v) * 100)).toBe(97)
  })
})

describe('getCurrentValueDetail — everything else is unchanged', () => {
  it('takes the latest weigh-in', () => {
    const log = [{ date: ago(30), weight: 95 }, { date: ago(1), weight: 93.25 }]
    expect(getCurrentValue('weight', [], log)).toBe(93.25)
    expect(getCurrentValueDetail('weight', [], log).basis).toBe('all')
  })

  it('takes the best cardio distance, whenever it happened', () => {
    // `cardioUnit` shipped in the same commit as `cardioQuantity` (8e2a056,
    // 2026-05-22), so no real session carries one without the other. This
    // fixture used to omit it, which only passed because the reading ignored
    // the unit — the defect fixed in BTL-B28.
    const sessions = [
      { date: ago(300), type: 'cardio', cardioActivity: 'run', cardioQuantity: 12, cardioUnit: 'km' },
      { date: ago(3),   type: 'cardio', cardioActivity: 'run', cardioQuantity: 5,  cardioUnit: 'km' },
    ]
    expect(getCurrentValue('run', sessions, [])).toBe(12)
  })

  it('reports null, not a basis, when there is nothing to report', () => {
    expect(getCurrentValueDetail('weight', [], []).value).toBe(null)
    expect(getCurrentValueDetail('run', [], []).basis).toBe(null)
    expect(getCurrentValueDetail('nonsense', [], []).value).toBe(null)
  })
})

describe('calcGoalProgress', () => {
  it('measures a grade goal from its own baseline', () => {
    const goal = { type: 'boulder_grade', startValue: 'V3', target: 'V6' }
    expect(calcGoalProgress(goal, 'V3')).toBe(0)
    expect(calcGoalProgress(goal, 'V4')).toBeCloseTo(1 / 3, 5)
    expect(calcGoalProgress(goal, 'V7')).toBe(1)
  })

  it('inverts for weight loss', () => {
    const goal = { type: 'weight', startValue: 100, target: 90 }
    expect(calcGoalProgress(goal, 95)).toBeCloseTo(0.5, 5)
    expect(calcGoalProgress(goal, 88)).toBe(1)
  })

  it('is zero with nothing to measure', () => {
    expect(calcGoalProgress({ type: 'boulder_grade', startValue: 'V3', target: 'V6' }, null)).toBe(0)
  })
})
