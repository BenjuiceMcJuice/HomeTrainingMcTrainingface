import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCurrentValue, getCurrentValueDetail, calcGoalProgress, GRADE_WINDOW_DAYS } from '../goals'

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

describe('getCurrentValueDetail — grade goals read the last 90 days', () => {
  it('reports the recent grade, not the career high', () => {
    const sessions = [
      ...era(400, 8, 'V6'),   // a strong season, long gone
      ...era(40, 5, 'V4'),    // where things actually are
    ]
    const d = getCurrentValueDetail('boulder_grade', sessions, [])
    expect(d.value).toBe('V4')
    expect(d.basis).toBe('window')
  })

  it('falls back to all time rather than reporting nothing', () => {
    const sessions = era(200, 8, 'V6')
    const d = getCurrentValueDetail('boulder_grade', sessions, [])
    expect(d.value).toBe('V6')
    expect(d.basis).toBe('all')
  })

  it('is null when there is nothing consistent anywhere', () => {
    const sessions = [{ date: ago(5), type: 'climb', climbs: [{ grade: 'V4', discipline: 'boulder', outcome: 'sent' }] }]
    expect(getCurrentValueDetail('boulder_grade', sessions, []).value).toBe(null)
    expect(getCurrentValueDetail('boulder_grade', sessions, []).basis).toBe(null)
  })

  it('draws the line at the window edge', () => {
    const inside  = era(GRADE_WINDOW_DAYS - 2, 4, 'V5')
    const outside = era(GRADE_WINDOW_DAYS + 30, 4, 'V5')
    expect(getCurrentValueDetail('boulder_grade', inside, []).basis).toBe('window')
    expect(getCurrentValueDetail('boulder_grade', outside, []).basis).toBe('all')
  })

  it('keeps rope goals on the rope disciplines', () => {
    const sessions = [
      ...era(30, 4, 'V5', 'boulder'),
      ...era(30, 4, '6c', 'lead'),
    ]
    expect(getCurrentValueDetail('rope_grade', sessions, []).value).toBe('6c')
    expect(getCurrentValueDetail('boulder_grade', sessions, []).value).toBe('V5')
  })
})

describe('getCurrentValueDetail — a thin window is not a reading', () => {
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
    const d = getCurrentValueDetail('boulder_grade', oldForm.concat([warmUpEvening]), [])
    expect(d.value).toBe('V4')
    expect(d.basis).toBe('all')
  })

  it('reads the window once there are enough sessions in it to mean something', () => {
    const d = getCurrentValueDetail('boulder_grade', oldForm.concat(era(20, 3, 'V1')), [])
    expect(d.value).toBe('V1')
    expect(d.basis).toBe('window')
  })

  it('needs three sessions, not three climbs', () => {
    const two = getCurrentValueDetail('boulder_grade', oldForm.concat(era(20, 2, 'V1')), [])
    expect(two.basis).toBe('all')
  })
})

describe('getCurrentValueDetail — everything else is unchanged', () => {
  it('takes the latest weigh-in', () => {
    const log = [{ date: ago(30), weight: 95 }, { date: ago(1), weight: 93.25 }]
    expect(getCurrentValue('weight', [], log)).toBe(93.25)
    expect(getCurrentValueDetail('weight', [], log).basis).toBe('all')
  })

  it('takes the best cardio distance, whenever it happened', () => {
    const sessions = [
      { date: ago(300), type: 'cardio', cardioActivity: 'run', cardioQuantity: 12 },
      { date: ago(3),   type: 'cardio', cardioActivity: 'run', cardioQuantity: 5 },
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
