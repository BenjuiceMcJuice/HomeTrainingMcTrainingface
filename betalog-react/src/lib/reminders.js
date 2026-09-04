/**
 * Pure helpers for schedule reminders.
 *
 * An entry carries a list of reminder times (`remindTimes`), so one routine can
 * nudge morning and evening without occupying two of the three schedule slots.
 * Entries written before this shipped carry a single `remindAt` string instead;
 * `entryTimes` reads both, which is what lets a Worker keep sending from a KV
 * mirror written by the old code until the app next syncs.
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
 * Every valid reminder time on an entry, earliest first, de-duplicated.
 *
 * The single source of truth for "when does this entry fire". Reads the legacy
 * `remindAt` string when `remindTimes` is absent, so old data and old mirrors
 * keep working without a migration having to run first.
 * @param {import('./types').ScheduleEntry} entry
 * @returns {string[]} "HH:MM" times, sorted (lexicographic order is chronological)
 */
export function entryTimes(entry) {
  if (!entry) return []
  var raw = Array.isArray(entry.remindTimes) ? entry.remindTimes : []
  if (!raw.length && entry.remindAt) raw = [entry.remindAt]
  var seen = {}
  var out = []
  for (var i = 0; i < raw.length; i++) {
    if (!isValidRemindAt(raw[i]) || seen[raw[i]]) continue
    seen[raw[i]] = true
    out.push(raw[i])
  }
  return out.sort()
}

/**
 * Set or clear an entry's reminder times, returning a new entry.
 *
 * An empty or all-invalid list clears the reminder: the keys are deleted rather
 * than set to null, so "no reminder" stays the absence the .ics builder tests for.
 * The legacy `remindAt` is dropped on every write, so an entry is never carrying
 * both representations at once.
 *
 * `remindFrom` anchors the calendar feed's DTSTART once, at the first scheduled
 * day on or after today. It is preserved if already set: recomputing it would give
 * the same event a moving start date on every refresh.
 * @param {import('./types').ScheduleEntry} entry
 * @param {string[] | null | undefined} times - "HH:MM" local, 24h
 * @param {string | null} [tz]                - defaults to the device timezone
 * @param {string} [todayIso]                 - "YYYY-MM-DD", defaults to today
 * @returns {import('./types').ScheduleEntry}
 */
export function withReminderTimes(entry, times, tz, todayIso) {
  var next = Object.assign({}, entry)
  delete next.remindAt
  var valid = entryTimes({ remindTimes: Array.isArray(times) ? times : [] })
  if (!valid.length) {
    delete next.remindTimes
    delete next.tz
    return next // remindFrom is kept: it anchors the calendar entry, not the alarm
  }
  next.remindTimes = valid
  next.tz = tz === undefined ? localTimeZone() : tz
  if (!next.tz) delete next.tz
  if (!next.remindFrom) {
    next.remindFrom = firstMatchingDay(next.days, todayIso || new Date().toISOString().slice(0, 10))
  }
  return next
}

/**
 * Set or clear a single reminder time. Thin wrapper over `withReminderTimes`,
 * kept because most callers still set one time.
 * @param {import('./types').ScheduleEntry} entry
 * @param {string | null | undefined} remindAt
 * @param {string | null} [tz]
 * @param {string} [todayIso]
 * @returns {import('./types').ScheduleEntry}
 */
export function withReminder(entry, remindAt, tz, todayIso) {
  return withReminderTimes(entry, remindAt ? [remindAt] : [], tz, todayIso)
}

/**
 * Entries ordered by their earliest reminder time, first first. Entries with no
 * reminder keep their relative order and sit at the end.
 * @param {import('./types').ScheduleEntry[]} entries
 * @returns {import('./types').ScheduleEntry[]}
 */
export function sortByRemindAt(entries) {
  return (entries || []).slice().sort(function (a, b) {
    var at = entryTimes(a)[0] || null
    var bt = entryTimes(b)[0] || null
    if (at === bt) return 0
    if (at === null) return 1
    if (bt === null) return -1
    return at < bt ? -1 : 1
  })
}
