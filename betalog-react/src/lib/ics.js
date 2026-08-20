/**
 * BetaLog — iCalendar (.ics) feed builder
 *
 * Turns schedule entries into a subscribable calendar. Pure: no React, no
 * network, no Date.now() unless one is passed in, so the same input always
 * produces byte-identical output. That matters — a subscribed calendar refetches
 * this file repeatedly, and a feed that churns makes clients duplicate or drop
 * events.
 *
 * Rules (see docs/specs/betalog_reminders_spec.md):
 *   - A timed entry (remindAt set) becomes a recurring timed event with a VALARM
 *     that fires at the time chosen.
 *   - An untimed entry becomes a recurring all-day event with NO alarm — visible
 *     in the calendar, never buzzes. Clearing a time is how a user says "stop
 *     reminding me", so it must not produce a different nag.
 *   - Times are FLOATING (no TZID, no Z): "07:00 wherever you are". This sidesteps
 *     shipping a VTIMEZONE per IANA zone — which is hard to get right — and is the
 *     behaviour you want for a training reminder anyway. The stored `tz` is kept
 *     for Route B, where a server must resolve an absolute instant.
 *
 * @see docs/specs/betalog_reminders_spec.md
 */

import { isValidRemindAt, firstMatchingDay } from './reminders'

var BYDAY = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU' }
var CRLF = '\r\n'

/**
 * Escape a text value per RFC 5545 §3.3.11: backslash, semicolon, comma and
 * newlines are special inside SUMMARY/DESCRIPTION.
 * @param {string} value
 * @returns {string}
 */
export function escapeText(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Fold a content line to 75 octets per RFC 5545 §3.1, continuing with a leading
 * space. Folds on octet count, not characters, so a multi-byte name can't be
 * split mid-character.
 * @param {string} line
 * @returns {string}
 */
var encoder = new TextEncoder()

export function foldLine(line) {
  var bytes = []
  for (var i = 0; i < line.length; i++) {
    var ch = line[i]
    bytes.push({ ch: ch, size: encoder.encode(ch).length })
  }
  var out = ''
  var used = 0
  var first = true
  for (var j = 0; j < bytes.length; j++) {
    var limit = first ? 75 : 74 // continuation lines carry a leading space
    if (used + bytes[j].size > limit) {
      out += CRLF + ' '
      used = 1
      first = false
    }
    out += bytes[j].ch
    used += bytes[j].size
  }
  return out
}

/**
 * "YYYY-MM-DD" → "YYYYMMDD".
 * @param {string} isoDate
 * @returns {string}
 */
export function toIcsDate(isoDate) {
  return String(isoDate).slice(0, 10).replace(/-/g, '')
}

/**
 * The day after an ISO date, as "YYYY-MM-DD". All-day events need a DTEND one
 * day past DTSTART.
 * @param {string} isoDate
 * @returns {string}
 */
export function nextIsoDate(isoDate) {
  var parts = String(isoDate).slice(0, 10).split('-')
  var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function rrule(days) {
  var byday = (days || [])
    .slice()
    .sort(function (a, b) { return a - b })
    .map(function (d) { return BYDAY[d] })
    .filter(Boolean)
  if (!byday.length) return null
  return 'RRULE:FREQ=WEEKLY;BYDAY=' + byday.join(',')
}

/**
 * Alarm offset from event start, as an iCalendar duration.
 *
 * `-PT0S` means "at the time of the event" — the same instant as `PT0S`, but
 * written the way Apple's own exports do. If iOS still refuses to fire, the
 * next thing to try is a small non-zero lead such as `-PT1M`, which would tell
 * us whether the zero duration itself is what the parser rejects.
 */
var ALARM_TRIGGER = '-PT0S'

/**
 * One VEVENT for one schedule entry, or null if the entry can't produce one.
 * @param {import('./types').ScheduleEntry} entry
 * @param {{ dtstamp: string, domain: string, url: string, durationMins: number }} opts
 * @returns {string[] | null} content lines, unfolded
 */
function buildEvent(entry, opts) {
  var rule = rrule(entry.days)
  if (!rule) return null // no days = nothing to repeat

  var anchor  = entry.remindFrom || firstMatchingDay(entry.days, opts.anchorFrom)
  var summary = escapeText((entry.routineName || 'Training') + ' — BetaLog')
  var timed   = isValidRemindAt(entry.remindAt)

  var lines = ['BEGIN:VEVENT']
  lines.push('UID:betalog-' + entry.id + '@' + opts.domain)
  lines.push('DTSTAMP:' + opts.dtstamp)

  if (timed) {
    // Floating local time — deliberately no TZID and no trailing Z
    lines.push('DTSTART:' + toIcsDate(anchor) + 'T' + entry.remindAt.replace(':', '') + '00')
    lines.push('DURATION:PT' + opts.durationMins + 'M')
  } else {
    lines.push('DTSTART;VALUE=DATE:' + toIcsDate(anchor))
    lines.push('DTEND;VALUE=DATE:' + toIcsDate(nextIsoDate(anchor)))
  }

  lines.push(rule)
  lines.push('SUMMARY:' + summary)
  lines.push('URL:' + opts.url)
  lines.push('TRANSP:TRANSPARENT')

  if (timed) {
    // Fires at the time chosen, not before it. Written as Apple writes it:
    // the negative zero-duration form, and no explicit RELATED=START, which is
    // the default anyway. `TRIGGER;RELATED=START:PT0S` is equally valid per
    // RFC 5545 and renders the same instant, but iOS did not fire alarms from
    // a subscribed feed using that form (verified on device 2026-08-20).
    lines.push('BEGIN:VALARM')
    lines.push('ACTION:DISPLAY')
    lines.push('TRIGGER:' + ALARM_TRIGGER)
    lines.push('DESCRIPTION:' + summary)
    // Apple emits a UID per alarm; RFC 9074 sanctions it. Stable per entry so
    // an edit updates the alarm rather than orphaning it.
    lines.push('UID:betalog-alarm-' + entry.id + '@' + opts.domain)
    lines.push('END:VALARM')
  }

  lines.push('END:VEVENT')
  return lines
}

/**
 * Build the whole calendar.
 *
 * @param {import('./types').ScheduleEntry[]} entries
 * @param {object} [options]
 * @param {string} [options.dtstamp]      - ISO instant stamped on every event. Pass a
 *                                          stable value (e.g. the schedule's save time)
 *                                          so refetches see an unchanged file.
 * @param {string} [options.domain]       - UID domain
 * @param {string} [options.url]          - URL property on each event
 * @param {string} [options.name]         - calendar display name
 * @param {number} [options.durationMins] - length of a timed event
 * @param {string} [options.anchorFrom]   - "YYYY-MM-DD" used to anchor entries that
 *                                          predate `remindFrom`. Pass a fixed date
 *                                          (the feed's creation day), never today,
 *                                          or their DTSTART drifts on every rebuild.
 * @returns {string} .ics text with CRLF line endings
 */
export function buildFeed(entries, options) {
  var opts = options || {}
  // "2026-08-19T17:50:08.123Z" -> "20260819T175008Z"
  var stamp = new Date(opts.dtstamp || Date.now())
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+/, '')

  var cfg = {
    dtstamp:      stamp,
    domain:       opts.domain || 'betalog.co.uk',
    url:          opts.url || 'https://betalog.co.uk',
    durationMins: opts.durationMins || 30,
    anchorFrom:   opts.anchorFrom || stamp.slice(0, 4) + '-' + stamp.slice(4, 6) + '-' + stamp.slice(6, 8),
  }

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BetaLog//Training Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + escapeText(opts.name || 'BetaLog Training'),
    // Refresh hints — clients may honour them, none are obliged to
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  ;(entries || []).forEach(function (entry) {
    var event = buildEvent(entry, cfg)
    if (event) lines = lines.concat(event)
  })

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join(CRLF) + CRLF
}

export default buildFeed
