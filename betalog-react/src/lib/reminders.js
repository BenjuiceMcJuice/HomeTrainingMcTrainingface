/**
 * Pure helpers for schedule reminders.
 *
 * A reminder belongs to a single ScheduleEntry: one entry, one time. Two entries
 * with different times is how a morning and an evening reminder are expressed —
 * there is deliberately no daily digest.
 *
 * No React imports here: this is safe to use from storage.js and, later, from the
 * Worker that builds the calendar feed.
 */

var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * True if `value` is a "HH:MM" 24h local time.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidRemindAt(value) {
  return typeof value === 'string' && TIME_RE.test(value)
}

/**
 * The device's IANA timezone, e.g. "Europe/London".
 *
 * Stored alongside remindAt because a Worker runs in UTC: without it a reminder
 * is an hour out for half the year.
 * @returns {string | null}
 */
export function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/**
 * Set or clear the reminder on an entry, returning a new entry.
 *
 * A falsy or malformed `remindAt` clears it — the keys are deleted rather than
 * set to null, so "no reminder" is the absence the spec describes.
 * @param {import('./types').ScheduleEntry} entry
 * @param {string | null | undefined} remindAt  - "HH:MM" local, 24h
 * @param {string | null} [tz]                  - defaults to the device timezone
 * @returns {import('./types').ScheduleEntry}
 */
export function withReminder(entry, remindAt, tz) {
  var next = Object.assign({}, entry)
  if (!isValidRemindAt(remindAt)) {
    delete next.remindAt
    delete next.tz
    return next
  }
  next.remindAt = remindAt
  next.tz = tz === undefined ? localTimeZone() : tz
  if (!next.tz) delete next.tz
  return next
}

/**
 * Entries ordered by reminder time, earliest first. Entries with no reminder
 * keep their relative order and sit at the end.
 * @param {import('./types').ScheduleEntry[]} entries
 * @returns {import('./types').ScheduleEntry[]}
 */
export function sortByRemindAt(entries) {
  return (entries || []).slice().sort(function (a, b) {
    var at = isValidRemindAt(a.remindAt) ? a.remindAt : null
    var bt = isValidRemindAt(b.remindAt) ? b.remindAt : null
    if (at === bt) return 0
    if (at === null) return 1
    if (bt === null) return -1
    return at < bt ? -1 : 1
  })
}
