/**
 * BetaLog — when a push reminder is due.
 *
 * The cron Worker wakes every few minutes with no idea what time it is for the
 * user, so this answers one question: given the schedule, the instant now, and
 * what has already been sent today, which entries should fire?
 *
 * No React imports and no DOM: the Worker imports this file directly
 * (see workers/betalog-push/src/index.js) so there is one tested implementation
 * of the rule rather than one here and a second, subtly different one there.
 * `reminders.js` is written to the same constraint for the same reason.
 *
 * All comparisons are done in the user's own wall-clock time via their stored
 * IANA `tz`. That is what makes 07:00 mean 07:00 through a DST change: we never
 * do arithmetic on UTC offsets, we ask Intl what the clock on their wall says.
 */

import { entryTimes } from './reminders.js'

/** Minutes a reminder may be late before it is dropped rather than fired. */
export var DEFAULT_GRACE_MINS = 60

var WEEKDAY_TO_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/**
 * The wall-clock reading in `tz` at instant `nowMs`.
 *
 * An unknown or malformed zone falls back to UTC rather than throwing — a bad
 * `tz` should cost one user a correct reminder, not take the whole cron down.
 * @param {number} nowMs   - epoch milliseconds
 * @param {string | null} tz - IANA zone, e.g. "Europe/London"
 * @returns {{ymd: string, hhmm: string, dow: number, minutes: number}}
 */
export function zonedParts(nowMs, tz) {
  var opts = {
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }
  var parts
  try {
    parts = new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: tz || 'UTC' }, opts))
      .formatToParts(new Date(nowMs))
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: 'UTC' }, opts))
      .formatToParts(new Date(nowMs))
  }
  var got = {}
  for (var i = 0; i < parts.length; i++) got[parts[i].type] = parts[i].value

  var hour = got.hour === '24' ? '00' : got.hour // some ICU builds report midnight as 24
  var hhmm = hour + ':' + got.minute
  return {
    ymd: got.year + '-' + got.month + '-' + got.day,
    hhmm: hhmm,
    dow: WEEKDAY_TO_ISO[got.weekday] || 0,
    minutes: (+hour) * 60 + (+got.minute),
  }
}

/**
 * "HH:MM" as minutes since midnight, or null if it isn't a valid time.
 * @param {unknown} hhmm
 * @returns {number | null}
 */
export function toMinutes(hhmm) {
  if (typeof hhmm !== 'string') return null
  var m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  return m ? (+m[1]) * 60 + (+m[2]) : null
}

/**
 * Should this entry fire for this particular time right now?
 *
 * True when all of: the time is valid, today is one of the entry's days, the time
 * has arrived, it is not more than `graceMins` late, and *that time* has not
 * already been sent today.
 *
 * The grace window is the interesting part. Without it, a Worker that was down
 * from 06:00 to 11:00 would come back and fire every morning reminder at once —
 * a 07:00 nudge arriving at 11:04 is worse than no nudge, because it tells you
 * to do something you have already missed.
 *
 * @param {import('./types').ScheduleEntry} entry
 * @param {string} time             - one of the entry's "HH:MM" times
 * @param {number} nowMs
 * @param {string | null} lastSentYmd - the local date this entry+time last fired on
 * @param {number} [graceMins]
 * @returns {boolean}
 */
export function isDue(entry, time, nowMs, lastSentYmd, graceMins) {
  if (!entry) return false
  var due = toMinutes(time)
  if (due === null) return false // no time set is the off switch

  var days = entry.days || []
  if (!days.length) return false

  var now = zonedParts(nowMs, entry.tz)
  if (days.indexOf(now.dow) < 0) return false
  if (lastSentYmd === now.ymd) return false

  var late = now.minutes - due
  var grace = typeof graceMins === 'number' ? graceMins : DEFAULT_GRACE_MINS
  return late >= 0 && late <= grace
}

/**
 * The dedupe key for one reminder on one entry.
 *
 * Keyed on entry *and* time, not entry alone. With one time per entry those were
 * the same thing; with two, keying on the entry would let the morning reminder
 * suppress the evening one for the rest of the day — silently, since a suppressed
 * reminder logs nothing.
 * @param {string} entryId
 * @param {string} time
 * @returns {string}
 */
export function sentKey(entryId, time) {
  return entryId + '@' + time
}

/**
 * Every reminder due right now, as {entry, time} pairs, in schedule order and
 * then time order. One entry can appear more than once — that is the point.
 * @param {import('./types').ScheduleEntry[]} entries
 * @param {number} nowMs
 * @param {Record<string, string>} [sent] - sentKey() -> local date it last fired
 * @param {number} [graceMins]
 * @returns {Array<{entry: import('./types').ScheduleEntry, time: string}>}
 */
export function dueEntries(entries, nowMs, sent, graceMins) {
  var map = sent || {}
  var out = []
  ;(entries || []).forEach(function (e) {
    entryTimes(e).forEach(function (t) {
      if (isDue(e, t, nowMs, map[sentKey(e.id, t)] || null, graceMins)) {
        out.push({ entry: e, time: t })
      }
    })
  })
  return out
}

/**
 * The notification an entry becomes.
 *
 * The title is the routine name alone. The .ics builder appends " — BetaLog"
 * because a calendar event sits among everything else in the Calendar app and
 * needs identifying; a push notification is already labelled with the app name
 * by the OS, so the suffix would read as "Glutes — BetaLog / BetaLog".
 *
 * `tag` collapses a repeat of the *same reminder* onto the existing notification
 * rather than stacking a second copy. It carries the time as well as the entry:
 * with `renotify: false`, a tag shared by an entry's morning and evening reminders
 * would mean the second one silently never appears.
 * @param {import('./types').ScheduleEntry} entry
 * @param {string} time - which of the entry's times this notification is for
 * @returns {{title: string, body: string, tag: string, url: string, entryId: string}}
 */
export function notificationFor(entry, time) {
  var name = (entry && entry.routineName) || 'Training'
  var at = toMinutes(time) !== null ? time : null
  return {
    title: name,
    body: at ? 'Scheduled for ' + at + ' · tap to log' : 'Tap to log this session',
    tag: 'betalog-reminder-' + ((entry && entry.id) || 'unknown') + (at ? '-' + at : ''),
    url: entry && entry.routineId ? '/log?routine=' + entry.routineId : '/log',
    entryId: (entry && entry.id) || '',
  }
}

/**
 * The subset of the schedule the Worker needs, and nothing else.
 *
 * The Worker never reads Firestore — authenticating it there is fiddly and the
 * sender only needs this much. Keeping the projection explicit also keeps the
 * blast radius of a leaked mirror to routine names and times.
 * @param {import('./types').ScheduleEntry[]} entries
 * @returns {Array<object>}
 */
export function mirrorEntries(entries) {
  return (entries || [])
    .filter(function (e) { return entryTimes(e).length && (e.days || []).length })
    .map(function (e) {
      return {
        id: e.id,
        routineId: e.routineId || null,
        routineName: e.routineName || '',
        days: e.days,
        remindTimes: entryTimes(e),
        tz: e.tz || null,
      }
    })
}
