import { describe, it, expect } from 'vitest'
import { climbRows, climbsToCsv, csvFilename, COLUMNS } from '../climbCsv'

const climb = (grade, outcome, extra) => Object.assign({
  grade, outcome, discipline: 'boulder', gradeSystem: 'v', attempts: 1,
}, extra || {})

const sessions = [
  { id: 's2', date: '2026-09-02', type: 'climb', location: 'The Climbing Academy',
    climbs: [climb('V4', 'sent'), climb('V5', 'attempt')] },
  { id: 's1', date: '2026-09-01', type: 'climb', location: 'Redpoint',
    climbs: [climb('V3', 'flashed')] },
  { id: 'g1', date: '2026-09-03', type: 'gym', exercises: [{ name: 'squat' }] },
]

describe('climbRows — one row per climb', () => {
  it('flattens sessions into climbs', () => {
    expect(climbRows(sessions).length).toBe(3)
  })

  it('ignores sessions that are not climbing', () => {
    expect(climbRows(sessions).every((r) => r.grade)).toBe(true)
  })

  it('denormalises the session date and location onto every row', () => {
    const r = climbRows(sessions)[0]
    expect(r.date).toBe('2026-09-01')
    expect(r.location).toBe('Redpoint')
  })

  it("prefers the climb's own location, since a session can be edited later", () => {
    const s = [{ id: 'x', date: '2026-09-01', type: 'climb', location: 'Session gym',
      climbs: [climb('V2', 'sent', { location: 'Climb gym' })] }]
    expect(climbRows(s)[0].location).toBe('Climb gym')
  })

  it('reads oldest first, the way a training log reads', () => {
    const dates = climbRows(sessions).map((r) => r.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('survives missing and malformed data', () => {
    expect(climbRows(null)).toEqual([])
    expect(climbRows([null, { type: 'climb' }, { type: 'climb', climbs: [null] }])).toEqual([])
  })
})

describe('climbsToCsv — a file a spreadsheet can open', () => {
  it('starts with the header row', () => {
    const first = climbsToCsv(sessions).split('\r\n')[0]
    expect(first).toBe(COLUMNS.map((c) => c.label).join(','))
  })

  it('writes one line per climb after the header', () => {
    const lines = climbsToCsv(sessions).trim().split('\r\n')
    expect(lines.length).toBe(1 + 3)
  })

  it('uses CRLF, which is what Excel expects', () => {
    expect(climbsToCsv(sessions)).toContain('\r\n')
  })

  it('quotes a value containing a comma', () => {
    const s = [{ id: 'x', date: '2026-09-01', type: 'climb', location: 'Bristol, UK',
      climbs: [climb('V2', 'sent')] }]
    expect(climbsToCsv(s)).toContain('"Bristol, UK"')
  })

  it('doubles an inner quote rather than breaking the row', () => {
    const s = [{ id: 'x', date: '2026-09-01', type: 'climb', notes: 'Felt "easy"',
      climbs: [climb('V2', 'sent')] }]
    const csv = climbsToCsv(s)
    expect(csv).toContain('"Felt ""easy"""')
    expect(csv.trim().split('\r\n').length).toBe(2)
  })

  it('keeps a newline inside a field from becoming a new row', () => {
    const s = [{ id: 'x', date: '2026-09-01', type: 'climb', notes: 'line one\nline two',
      climbs: [climb('V2', 'sent')] }]
    // The field is quoted, so the raw text has 3 physical lines but 2 records.
    expect(climbsToCsv(s)).toContain('"line one\nline two"')
  })

  it('returns the header alone when nothing is logged', () => {
    // An empty file reads as a failed export; a header reads as an empty log.
    const csv = climbsToCsv([])
    expect(csv.trim().split('\r\n').length).toBe(1)
    expect(csv).toContain('Grade')
  })
})

describe('csvFilename', () => {
  it('is dated', () => {
    expect(csvFilename('2026-09-13')).toBe('betalog-climbs-2026-09-13.csv')
  })
})
