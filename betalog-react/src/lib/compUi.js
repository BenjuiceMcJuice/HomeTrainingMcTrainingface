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
 * The comps on the Dashboard's *Coming up* strip: starting in the next 24
 * hours, or running now. Nothing past — a comp drops off at its end time, or
 * when its card is final. Ben, 2026-09-27. Times come from the list row
 * (`startMs` / `endMs`); a row without a start time (saved before they were
 * stored, or a comp the organiser starts by hand) counts from the start of
 * its day, and without an end time it drops off when the day is over.
 * Soonest first.
 * @param {import('./types').CompEntryRef[]} refs
 * @param {import('./types').Session[]} sessions
 * @param {number} nowMs
 */
export var COMING_UP_MS = 24 * 3600000

export function dashComps(refs, sessions, nowMs) {
  var closed = {}
  ;(sessions || []).forEach(function (s) { if (s.comp && s.comp.code && s.comp.status === 'closed') closed[s.comp.code] = true })
  return (refs || []).map(function (r) {
    var dayStart = new Date(r.date + 'T00:00:00').getTime()
    var start = r.startMs != null ? r.startMs : dayStart
    var end = r.endMs != null ? r.endMs : dayStart + 24 * 3600000
    return { ref: r, start: start, end: end }
  }).filter(function (x) {
    if (closed[x.ref.code]) return false
    if (nowMs >= x.end) return false
    return x.start - nowMs <= COMING_UP_MS
  }).sort(function (a, b) { return a.start - b.start }).map(function (x) {
    return Object.assign({}, x.ref, { live: nowMs >= x.start, whenMs: x.ref.startMs != null ? x.ref.startMs : null })
  })
}
