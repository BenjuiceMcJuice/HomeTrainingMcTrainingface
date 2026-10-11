/**
 * The session feel — the 1–5 effort rating every logger asks for — and the
 * save button's words, in one place (review of 2026-10-11). Pure, so the
 * components file (`components/log/SessionFooter.jsx`) exports components only.
 */

export var FEEL_LABELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
export var FEEL_FILL   = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }
export var FEEL_NEEDED = 'Pick a session feel to save'

/** "Save" for a new record, "Save changes" for an edit. */
export function saveLabel(editing) {
  return editing ? 'Save changes' : 'Save'
}
