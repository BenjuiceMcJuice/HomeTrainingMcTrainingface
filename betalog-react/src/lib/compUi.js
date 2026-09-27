/**
 * Small shared bits for the /comp pages that are not components — kept out
 * of the component files so Fast Refresh keeps working there.
 */
import { scoringEnded } from './competition'

/**
 * The stages a comp goes through, as the app says them — the same words as
 * the guide's *How a comp runs* (help.html#comp-flow). `checking` is not a
 * stored status: it is a live comp past its automatic end that an
 * organiser's device has not closed yet.
 */
export var STATUS_LABEL = { draft: 'Draft', open: 'Entries open', live: 'Running', checking: 'Checking results', closed: 'Final' }
export var STATUS_COLOUR = { draft: '#7a8299', open: '#4f7ef8', live: '#2a9d5c', checking: '#d97706', closed: '#1a1d2e' }

/** The comp's stage now — its status, with `checking` for a live comp past its end. */
export function compPhase(comp, nowMs) {
  if (!comp) return null
  if (comp.status === 'live' && scoringEnded(comp, nowMs)) return 'checking'
  return comp.status
}

/** The guide's section on how comps work. */
export var COMP_GUIDE_URL = '/help.html#comp-flow'

/** "Sat 18 Oct 2026" from an ISO date. */
export function fmtCompDate(iso) {
  if (!iso) return ''
  var d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
