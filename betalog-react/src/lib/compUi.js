/**
 * Small shared bits for the /comp pages that are not components — kept out
 * of the component files so Fast Refresh keeps working there.
 */
export var STATUS_LABEL = { draft: 'Draft', open: 'Entries open', live: 'Live', closed: 'Final' }
export var STATUS_COLOUR = { draft: '#7a8299', open: '#4f7ef8', live: '#2a9d5c', closed: '#1a1d2e' }

/** "Sat 18 Oct 2026" from an ISO date. */
export function fmtCompDate(iso) {
  if (!iso) return ''
  var d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
