import { describe, it, expect } from 'vitest'
import { dashComps } from '../compUi'

var H = 3600000
var NOW = new Date('2026-09-27T12:00:00').getTime()
var ref = (code, extra) => Object.assign({ code, name: code, date: '2026-09-27', venueName: '', role: 'entrant' }, extra)
var closedCard = (code) => ({ id: 'comp-' + code, comp: { code, status: 'closed' } })

describe('dashComps', () => {
  it('shows a comp starting within 24 hours, not one further off', () => {
    var soon = ref('SOON', { date: '2026-09-28', startMs: NOW + 20 * H, endMs: NOW + 23 * H })
    var far  = ref('FAR',  { date: '2026-09-28', startMs: NOW + 25 * H, endMs: NOW + 28 * H })
    expect(dashComps([far, soon], [], NOW).map(c => c.code)).toEqual(['SOON'])
  })

  it('shows a running comp as live, soonest first', () => {
    var live = ref('LIVE', { startMs: NOW - H, endMs: NOW + H })
    var next = ref('NEXT', { startMs: NOW + 2 * H, endMs: NOW + 4 * H })
    var out = dashComps([next, live], [], NOW)
    expect(out.map(c => [c.code, c.live])).toEqual([['LIVE', true], ['NEXT', false]])
  })

  it('drops a comp at its end time — nothing past', () => {
    expect(dashComps([ref('DONE', { startMs: NOW - 3 * H, endMs: NOW - H })], [], NOW)).toEqual([])
  })

  it('drops a comp whose card is final, even before its end time', () => {
    expect(dashComps([ref('A', { startMs: NOW - H, endMs: NOW + H })], [closedCard('A')], NOW)).toEqual([])
  })

  it('reads a row without times by its day: today shows, tomorrow shows, yesterday does not', () => {
    var out = dashComps([ref('T'), ref('TMRW', { date: '2026-09-28' }), ref('Y', { date: '2026-09-26' }), ref('LATER', { date: '2026-09-29' })], [], NOW)
    expect(out.map(c => c.code)).toEqual(['T', 'TMRW'])
    expect(out[0].whenMs).toBe(null)
  })

  it('handles nothing', () => {
    expect(dashComps(undefined, undefined, NOW)).toEqual([])
  })
})
