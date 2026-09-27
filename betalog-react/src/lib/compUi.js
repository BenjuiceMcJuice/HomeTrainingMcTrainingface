/**
 * Small shared bits for the /comp pages that are not components — kept out
 * of the component files so Fast Refresh keeps working there.
 */
import { compPhase } from './competition'

/**
 * The stages a comp goes through, as the app says them — the same words as
 * the guide's *How a comp runs* (help.html#comp-flow) and spec §7d. Keyed by
 * `compPhase`, which reads the clock as well as the stored status.
 */
export var STAGES = ['draft', 'open', 'live', 'judging', 'closed']
export var STATUS_LABEL = { draft: 'Draft', open: 'Pending start', live: 'Running', judging: 'Judging', closed: 'Final' }
export var STATUS_COLOUR = { draft: '#7a8299', open: '#4f7ef8', live: '#2a9d5c', judging: '#d97706', closed: '#1a1d2e' }

export { compPhase }

/** The guide's section on how comps work. */
export var COMP_GUIDE_URL = '/help.html#comp-flow'

/** "Sat 18 Oct 2026" from an ISO date. */
export function fmtCompDate(iso) {
  if (!iso) return ''
  var d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The comps the Dashboard's top strip shows: scheduled (today or later) or
 * still happening. There is no comp widget any more — outside a comp the
 * Dashboard says nothing about comps at all. "Still happening" is a comp
 * dated before today whose card is not final yet (a multi-day comp, or one
 * being judged), capped at a week so an organiser who never taps Close does
 * not leave it there for ever. A card marked final hides the comp even on
 * the day. Soonest first.
 * @param {import('./types').CompEntryRef[]} refs
 * @param {import('./types').Session[]} sessions
 * @param {string} today  "YYYY-MM-DD"
 * @param {string} weekAgo  "YYYY-MM-DD"
 */
export function dashComps(refs, sessions, today, weekAgo) {
  var blocks = {}
  ;(sessions || []).forEach(function (s) { if (s.comp && s.comp.code) blocks[s.comp.code] = s.comp })
  return (refs || []).filter(function (r) {
    var block = blocks[r.code]
    if (block && block.status === 'closed') return false
    if (r.date >= today) return true
    return !!block && r.date >= weekAgo
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0 })
}
