/**
 * BetaLog — climbing log as CSV.
 *
 * ## Why CSV, when there is already a JSON export *(BTL-B24)*
 *
 * The JSON export is a **backup**: the whole `Storage.load()` dump, shaped for
 * importing back into the app. It is the right format for moving between
 * devices and the wrong one for looking at your climbing — nested sessions, one
 * object per session with an array inside it, and every other data type mixed in.
 *
 * This is the other job: **one row per climb**, flat, with the session's date
 * and location denormalised onto each row so a spreadsheet can sort, filter and
 * pivot without any unpacking. It is a read-only view for analysis, not a
 * backup, and nothing imports it back.
 *
 * The columns are deliberately the raw log and not the app's readings. No
 * pyramid tier, no credited/capped count, no consistent grade: those are
 * derived, they have changed twice in a week, and a file that mixes what you
 * logged with what the app currently concludes from it ages badly. Anyone who
 * wants the conclusions can read them on the screen that owns them.
 */

/** RFC 4180: quote anything containing a comma, quote or newline; double inner quotes. */
function cell(value) {
  if (value === null || value === undefined) return ''
  var s = String(value)
  if (s.indexOf('"') === -1 && s.indexOf(',') === -1 && s.indexOf('\n') === -1 && s.indexOf('\r') === -1) {
    return s
  }
  return '"' + s.replace(/"/g, '""') + '"'
}

/** The columns, in order. Session facts first, then the climb itself. */
var COLUMNS = [
  { key: 'date',        label: 'Date' },
  { key: 'sessionId',   label: 'Session ID' },
  { key: 'location',    label: 'Location' },
  { key: 'discipline',  label: 'Discipline' },
  { key: 'grade',       label: 'Grade' },
  { key: 'gradeSystem', label: 'Grade system' },
  { key: 'outcome',     label: 'Outcome' },
  { key: 'attempts',    label: 'Attempts' },
  { key: 'routeId',     label: 'Route ID' },
  { key: 'notes',       label: 'Session notes' },
]

/**
 * Every logged climb as a flat row.
 *
 * Sorted oldest first: a training log reads forwards, and a spreadsheet opened
 * on row 2 should be the beginning of the story rather than the end of it.
 *
 * @param {object[]} sessions
 * @returns {object[]} one row per climb
 */
export function climbRows(sessions) {
  var rows = [];
  (sessions || []).forEach(function (s) {
    if (!s || s.type !== 'climb') return
    ;(s.climbs || []).forEach(function (c) {
      if (!c) return
      rows.push({
        date:        s.date || '',
        sessionId:   s.id || '',
        // The climb's own location wins: it is denormalised from the session at
        // log time, so a session edited later keeps each climb's real gym.
        location:    c.location || s.location || '',
        discipline:  c.discipline || '',
        grade:       c.grade || '',
        gradeSystem: c.gradeSystem || '',
        outcome:     c.outcome || '',
        attempts:    c.attempts === undefined || c.attempts === null ? '' : c.attempts,
        routeId:     c.routeId || '',
        notes:       s.notes || '',
      })
    })
  })
  rows.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return 0
  })
  return rows
}

/**
 * The CSV text. CRLF line endings, because that is what Excel expects and this
 * file exists to be opened in a spreadsheet.
 *
 * @param {object[]} sessions
 * @returns {string} header row only when there is nothing logged — an empty
 *   file would look like a failure rather than an empty log.
 */
export function climbsToCsv(sessions) {
  var rows  = climbRows(sessions)
  var lines = [COLUMNS.map(function (c) { return cell(c.label) }).join(',')]
  rows.forEach(function (r) {
    lines.push(COLUMNS.map(function (c) { return cell(r[c.key]) }).join(','))
  })
  return lines.join('\r\n') + '\r\n'
}

/** `betalog-climbs-2026-09-13.csv` */
export function csvFilename(todayIso) {
  var d = todayIso || new Date().toISOString().slice(0, 10)
  return 'betalog-climbs-' + d + '.csv'
}

export { COLUMNS }
