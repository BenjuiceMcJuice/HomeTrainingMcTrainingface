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

/**
 * The first date on or after `fromIso` whose weekday is in `days`.
 *
 * This anchors DTSTART once, when the reminder is set. Recomputing it per request
 * would give the same UID a moving DTSTART on every refresh.
 * @param {number[]} days    - 1=Monday … 7=Sunday
 * @param {string} fromIso   - "YYYY-MM-DD"
 * @returns {string}           "YYYY-MM-DD" — `fromIso` itself when days is empty
 */
export function firstMatchingDay(days, fromIso) {
  if (!days || !days.length) return String(fromIso).slice(0, 10)
  var parts = String(fromIso).slice(0, 10).split('-')
  var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
  for (var i = 0; i < 7; i++) {
    var dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
    if (days.indexOf(dow) >= 0) return d.toISOString().slice(0, 10)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return String(fromIso).slice(0, 10)
}

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
 *
 * `remindFrom` anchors the calendar feed's DTSTART once, at the first scheduled
 * day on or after today. It is preserved if already set: recomputing it would give
 * the same event a moving start date on every refresh.
 * @param {import('./types').ScheduleEntry} entry
 * @param {string | null | undefined} remindAt  - "HH:MM" local, 24h
 * @param {string | null} [tz]                  - defaults to the device timezone
 * @param {string} [todayIso]                   - "YYYY-MM-DD", defaults to today
 * @returns {import('./types').ScheduleEntry}
 */
export function withReminder(entry, remindAt, tz, todayIso) {
  var next = Object.assign({}, entry)
  if (!isValidRemindAt(remindAt)) {
    delete next.remindAt
    delete next.tz
    return next // remindFrom is kept: it anchors the calendar entry, not the alarm
  }
  next.remindAt = remindAt
  next.tz = tz === undefined ? localTimeZone() : tz
  if (!next.tz) delete next.tz
  if (!next.remindFrom) {
    next.remindFrom = firstMatchingDay(next.days, todayIso || new Date().toISOString().slice(0, 10))
  }
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
