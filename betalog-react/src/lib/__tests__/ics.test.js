import { describe, it, expect } from 'vitest'
import { buildFeed, escapeText, foldLine, toIcsDate, nextIsoDate } from '../ics'
import { firstMatchingDay } from '../reminders'

var STAMP = '2026-08-19T09:00:00.000Z'
var opts  = { dtstamp: STAMP, anchorFrom: '2026-08-19' }

// Wednesday 19 Aug 2026 is the anchor date used throughout
var timed = {
  id: 'e1', routineId: 'r1', routineName: 'Max Hangs',
  days: [1, 3, 5], remindAt: '07:00', tz: 'Europe/London', remindFrom: '2026-08-19',
}
var evening = {
  id: 'e2', routineId: 'r2', routineName: 'Gym',
  days: [2, 4], remindAt: '18:30', tz: 'Europe/London', remindFrom: '2026-08-20',
}
var untimed = {
  id: 'e3', routineId: 'r3', routineName: 'Core', days: [6], remindFrom: '2026-08-22',
}

const lines = (text) => text.split('\r\n')

describe('escapeText', () => {
  it('escapes the RFC 5545 specials', () => {
    expect(escapeText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d')
    expect(escapeText('one\ntwo')).toBe('one\\ntwo')
  })

  it('handles null and undefined', () => {
    expect(escapeText(null)).toBe('')
    expect(escapeText(undefined)).toBe('')
  })
})

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:Gym')).toBe('SUMMARY:Gym')
  })

  it('folds past 75 octets with a leading space', () => {
    const folded = foldLine('SUMMARY:' + 'x'.repeat(100))
    expect(folded).toContain('\r\n ')
    folded.split('\r\n').forEach(part => {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    })
  })

  it('folds on octets, so multi-byte characters survive', () => {
    const folded = foldLine('SUMMARY:' + 'é'.repeat(60))
    folded.split('\r\n').forEach(part => {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    })
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'é'.repeat(60))
  })
})

describe('date helpers', () => {
  it('formats and advances ISO dates', () => {
    expect(toIcsDate('2026-08-19')).toBe('20260819')
    expect(nextIsoDate('2026-08-19')).toBe('2026-08-20')
    expect(nextIsoDate('2026-08-31')).toBe('2026-09-01')
    expect(nextIsoDate('2026-12-31')).toBe('2027-01-01')
  })

  it('finds the first matching weekday on or after a date', () => {
    // 2026-08-19 is a Wednesday (day 3)
    expect(firstMatchingDay([3], '2026-08-19')).toBe('2026-08-19') // today counts
    expect(firstMatchingDay([5], '2026-08-19')).toBe('2026-08-21') // Friday
    expect(firstMatchingDay([1], '2026-08-19')).toBe('2026-08-24') // next Monday
    expect(firstMatchingDay([], '2026-08-19')).toBe('2026-08-19')  // no days
  })
})

describe('buildFeed', () => {
  it('wraps events in a valid calendar envelope', () => {
    const out = lines(buildFeed([timed], opts))
    expect(out[0]).toBe('BEGIN:VCALENDAR')
    expect(out).toContain('VERSION:2.0')
    expect(out).toContain('PRODID:-//BetaLog//Training Schedule//EN')
    expect(out.filter(l => l === 'END:VCALENDAR')).toHaveLength(1)
  })

  it('uses CRLF line endings and ends with one', () => {
    const text = buildFeed([timed], opts)
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.includes('\n\n')).toBe(false)
  })

  it('renders a timed entry as a floating recurring event', () => {
    const out = lines(buildFeed([timed], opts))
    expect(out).toContain('DTSTART:20260819T070000') // no TZID, no trailing Z
    expect(out).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR')
    expect(out).toContain('DURATION:PT30M')
    expect(out).toContain('SUMMARY:Max Hangs — BetaLog')
  })

  it('alarms a timed entry at the time chosen, not before it', () => {
    const out = lines(buildFeed([timed], opts))
    expect(out).toContain('BEGIN:VALARM')
    // Apple's own form for "at the time of the event". iOS did not fire alarms
    // from a subscribed feed written as `TRIGGER;RELATED=START:PT0S`.
    expect(out).toContain('TRIGGER:-PT0S')
    expect(out).not.toContain('RELATED=START')
    expect(out).toContain('UID:betalog-alarm-e1@betalog.co.uk')
  })

  it('renders an untimed entry as a SILENT all-day event', () => {
    const out = lines(buildFeed([untimed], opts))
    expect(out).toContain('DTSTART;VALUE=DATE:20260822')
    expect(out).toContain('DTEND;VALUE=DATE:20260823')
    expect(out).toContain('RRULE:FREQ=WEEKLY;BYDAY=SA')
    // clearing a time must not swap one nag for another
    expect(out).not.toContain('BEGIN:VALARM')
  })

  it('gives each entry its own event and its own time', () => {
    const out = buildFeed([timed, evening], opts)
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(lines(out)).toContain('DTSTART:20260819T070000')
    expect(lines(out)).toContain('DTSTART:20260820T183000')
  })

  it('gives each entry a stable UID derived from its id', () => {
    const out = lines(buildFeed([timed], opts))
    expect(out).toContain('UID:betalog-e1@betalog.co.uk')
  })

  it('drops an entry with no days — there is nothing to repeat', () => {
    const out = buildFeed([{ id: 'x', routineName: 'Nothing', days: [] }], opts)
    expect(out).not.toContain('BEGIN:VEVENT')
  })

  it('produces an empty but valid calendar for an empty schedule', () => {
    const out = buildFeed([], opts)
    expect(out).toContain('BEGIN:VCALENDAR')
    expect(out).toContain('END:VCALENDAR')
    expect(out).not.toContain('BEGIN:VEVENT')
    expect(buildFeed(null, opts)).toContain('END:VCALENDAR')
  })

  it('is byte-identical for identical input — a churning feed breaks clients', () => {
    expect(buildFeed([timed, untimed], opts)).toBe(buildFeed([timed, untimed], opts))
  })

  it('changes when the schedule changes', () => {
    const moved = Object.assign({}, timed, { remindAt: '08:00' })
    expect(buildFeed([moved], opts)).not.toBe(buildFeed([timed], opts))
  })

  it('honours a stored remindFrom over the anchorFrom fallback', () => {
    const out = lines(buildFeed([timed], { dtstamp: STAMP, anchorFrom: '2027-01-01' }))
    expect(out).toContain('DTSTART:20260819T070000')
  })

  it('falls back to anchorFrom for entries predating remindFrom', () => {
    const legacy = { id: 'old', routineName: 'Legacy', days: [1], remindAt: '07:00' }
    const out = lines(buildFeed([legacy], opts))
    // first Monday on or after 2026-08-19
    expect(out).toContain('DTSTART:20260824T070000')
  })

  it('escapes routine names that would otherwise break the format', () => {
    const nasty = Object.assign({}, timed, { routineName: 'Pull, push; hard\\core' })
    const out = buildFeed([nasty], opts)
    expect(out).toContain('SUMMARY:Pull\\, push\\; hard\\\\core — BetaLog')
  })

  it('stamps every event with the dtstamp it was given', () => {
    const out = lines(buildFeed([timed], opts))
    expect(out).toContain('DTSTAMP:20260819T090000Z')
  })
})
