import { describe, it, expect } from 'vitest'
import { dashComps } from '../compUi'

var TODAY = '2026-09-27', WEEK_AGO = '2026-09-20'
var ref = (code, date) => ({ code, name: code, date, venueName: '', role: 'entrant' })
var card = (code, status) => ({ id: 'comp-' + code, comp: { code, status } })

describe('dashComps', () => {
  it('shows scheduled and today comps, soonest first', () => {
    var out = dashComps([ref('B', '2026-10-10'), ref('A', TODAY)], [], TODAY, WEEK_AGO)
    expect(out.map(r => r.code)).toEqual(['A', 'B'])
  })

  it('hides past comps with no card still open', () => {
    expect(dashComps([ref('A', '2026-09-25')], [], TODAY, WEEK_AGO)).toEqual([])
  })

  it('keeps a recent comp whose card is not final (multi-day or judging)', () => {
    expect(dashComps([ref('A', '2026-09-25')], [card('A', 'live')], TODAY, WEEK_AGO).length).toBe(1)
  })

  it('drops an unfinished comp after a week', () => {
    expect(dashComps([ref('A', '2026-09-10')], [card('A', 'live')], TODAY, WEEK_AGO)).toEqual([])
  })

  it('hides a final comp, even on the day', () => {
    expect(dashComps([ref('A', TODAY)], [card('A', 'closed')], TODAY, WEEK_AGO)).toEqual([])
  })

  it('handles nothing', () => {
    expect(dashComps(undefined, undefined, TODAY, WEEK_AGO)).toEqual([])
  })
})
