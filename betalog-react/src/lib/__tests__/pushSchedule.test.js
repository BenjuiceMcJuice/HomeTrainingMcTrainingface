import { describe, it, expect } from 'vitest'
import {
  zonedParts, toMinutes, isDue, dueEntries, notificationFor, mirrorEntries, sentKey,
} from '../pushSchedule'
import { entryTimes } from '../reminders'

// Wed 3 September 2026, 06:00 UTC. London is BST (+1) on this date, so the same
// instant is 07:00 there — which is the whole point of the timezone handling.
var WED_0600_UTC = Date.UTC(2026, 8, 3, 6, 0)

function entry(over) {
  return Object.assign({
    id: 'e1',
    routineId: 'r1',
    routineName: 'Glutes!!!',
    days: [4], // Thursday... overridden per test
    remindAt: '07:00',
    tz: 'Europe/London',
  }, over)
}

// isDue now asks about one specific time, because an entry can have several.
// These cases each carry exactly one, so the helper supplies it — including the
// malformed values, which must still be rejected rather than skipped.
function due(e, nowMs, lastSent, grace) {
  return isDue(e, entryTimes(e)[0] || (e && e.remindAt), nowMs, lastSent, grace)
}

describe('zonedParts', () => {
  it('reads the wall clock in the given zone', () => {
    var p = zonedParts(WED_0600_UTC, 'Europe/London')
    expect(p.ymd).toBe('2026-09-03')
    expect(p.hhmm).toBe('07:00')   // BST, so one hour ahead of UTC
    expect(p.dow).toBe(4)          // Thursday
    expect(p.minutes).toBe(420)
  })

  it('gives a different wall clock for a different zone, same instant', () => {
    expect(zonedParts(WED_0600_UTC, 'UTC').hhmm).toBe('06:00')
    expect(zonedParts(WED_0600_UTC, 'Australia/Sydney').hhmm).toBe('16:00')
  })

  it('rolls the date over where the zone has', () => {
    // 23:30 UTC on the 3rd is already the 4th in Sydney
    var p = zonedParts(Date.UTC(2026, 8, 3, 23, 30), 'Australia/Sydney')
    expect(p.ymd).toBe('2026-09-04')
    expect(p.dow).toBe(5)
  })

  it('falls back to UTC rather than throwing on a bad zone', () => {
    expect(zonedParts(WED_0600_UTC, 'Not/AZone').hhmm).toBe('06:00')
    expect(zonedParts(WED_0600_UTC, null).hhmm).toBe('06:00')
  })

  it('reports midnight as 00:00, never 24:00', () => {
    var p = zonedParts(Date.UTC(2026, 8, 3, 0, 0), 'UTC')
    expect(p.hhmm).toBe('00:00')
    expect(p.minutes).toBe(0)
  })

  it('survives a DST boundary — 07:00 local stays 07:00 either side', () => {
    // BST ends 25 Oct 2026. 07:00 London is 06:00 UTC before, 07:00 UTC after.
    expect(zonedParts(Date.UTC(2026, 9, 20, 6, 0), 'Europe/London').hhmm).toBe('07:00')
    expect(zonedParts(Date.UTC(2026, 10, 3, 7, 0), 'Europe/London').hhmm).toBe('07:00')
  })
})

describe('toMinutes', () => {
  it('converts valid times', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('07:30')).toBe(450)
    expect(toMinutes('23:59')).toBe(1439)
  })

  it('rejects anything else', () => {
    expect(toMinutes('24:00')).toBeNull()
    expect(toMinutes('7:00')).toBeNull()
    expect(toMinutes('07:60')).toBeNull()
    expect(toMinutes('')).toBeNull()
    expect(toMinutes(null)).toBeNull()
    expect(toMinutes(700)).toBeNull()
  })
})

describe('isDue', () => {
  it('fires at exactly the reminder time', () => {
    expect(due(entry({ days: [4] }), WED_0600_UTC, null)).toBe(true)
  })

  it('does not fire before the time', () => {
    expect(due(entry({ days: [4], remindAt: '07:01' }), WED_0600_UTC, null)).toBe(false)
  })

  it('fires inside the grace window', () => {
    expect(due(entry({ days: [4], remindAt: '06:30' }), WED_0600_UTC, null)).toBe(true)
  })

  it('does not fire once it is later than the grace window', () => {
    // 07:00 local now, reminder was 05:30 — 90 minutes late, past the 60 default.
    // Telling someone to train at 07:00 when it is 08:30 is worse than silence.
    expect(due(entry({ days: [4], remindAt: '05:30' }), WED_0600_UTC, null)).toBe(false)
  })

  it('honours a custom grace window', () => {
    expect(due(entry({ days: [4], remindAt: '05:30' }), WED_0600_UTC, null, 120)).toBe(true)
    expect(due(entry({ days: [4], remindAt: '06:30' }), WED_0600_UTC, null, 15)).toBe(false)
  })

  it('does not fire on a day the entry is not scheduled for', () => {
    expect(due(entry({ days: [1, 2, 3] }), WED_0600_UTC, null)).toBe(false)
  })

  it('does not fire twice on the same local day', () => {
    expect(due(entry({ days: [4] }), WED_0600_UTC, '2026-09-03')).toBe(false)
  })

  it('fires again the next day it comes round', () => {
    // Sent yesterday, due again today
    expect(due(entry({ days: [4] }), WED_0600_UTC, '2026-09-02')).toBe(true)
  })

  it('treats a missing time as the off switch', () => {
    expect(due(entry({ days: [4], remindAt: undefined }), WED_0600_UTC, null)).toBe(false)
    expect(due(entry({ days: [4], remindAt: '' }), WED_0600_UTC, null)).toBe(false)
    expect(due(entry({ days: [4], remindAt: 'lunchtime' }), WED_0600_UTC, null)).toBe(false)
  })

  it('ignores an entry with no days', () => {
    expect(due(entry({ days: [] }), WED_0600_UTC, null)).toBe(false)
  })

  it('uses the entry own timezone, not the runtime one', () => {
    // Same instant: 07:00 in London, 16:00 in Sydney. A 07:00 reminder is due
    // for the London user and long past for the Sydney one.
    expect(due(entry({ days: [4], tz: 'Europe/London' }), WED_0600_UTC, null)).toBe(true)
    expect(due(entry({ days: [4], tz: 'Australia/Sydney' }), WED_0600_UTC, null)).toBe(false)
  })

  it('is safe on rubbish input', () => {
    expect(due(null, WED_0600_UTC, null)).toBe(false)
    expect(due(undefined, WED_0600_UTC, null)).toBe(false)
  })
})

describe('dueEntries', () => {
  var entries = [
    entry({ id: 'a', days: [4], remindAt: '07:00' }),           // due
    entry({ id: 'b', days: [4], remindAt: '18:00' }),           // later today
    entry({ id: 'c', days: [1], remindAt: '07:00' }),           // wrong day
    entry({ id: 'd', days: [4], remindAt: '06:45' }),           // due, inside grace
  ]

  it('returns only what is due, in schedule order', () => {
    expect(dueEntries(entries, WED_0600_UTC).map(x => x.entry.id)).toEqual(['a', 'd'])
  })

  it('skips what has already been sent today', () => {
    var sent = { [sentKey('a', '07:00')]: '2026-09-03' }
    expect(dueEntries(entries, WED_0600_UTC, sent).map(x => x.entry.id)).toEqual(['d'])
  })

  it('handles an empty or missing schedule', () => {
    expect(dueEntries([], WED_0600_UTC)).toEqual([])
    expect(dueEntries(null, WED_0600_UTC)).toEqual([])
  })
})

describe('notificationFor', () => {
  it('titles with the routine name alone', () => {
    // The .ics appends " — BetaLog" because a calendar event needs identifying
    // among everything else; a push notification is already labelled by the OS.
    var n = notificationFor(entry({}), '09:05')
    expect(n.title).toBe('Glutes!!!')
    expect(n.body).toBe('Scheduled for 09:05 · tap to log')
  })

  it('deep-links to the routine', () => {
    expect(notificationFor(entry({ routineId: 'r7' }), '07:00').url).toBe('/log?routine=r7')
  })

  it('falls back to /log with no routine', () => {
    expect(notificationFor(entry({ routineId: null }), '07:00').url).toBe('/log')
  })

  it('tags per entry AND time, so morning does not replace evening', () => {
    // With renotify:false a shared tag means the second notification of the day
    // silently never appears — the failure this key exists to prevent.
    expect(notificationFor(entry({ id: 'xyz' }), '07:00').tag).toBe('betalog-reminder-xyz-07:00')
    expect(notificationFor(entry({ id: 'xyz' }), '18:30').tag).toBe('betalog-reminder-xyz-18:30')
  })

  it('copes with a nameless or timeless entry', () => {
    expect(notificationFor({ id: 'e' }, null).title).toBe('Training')
    expect(notificationFor({ id: 'e' }, null).body).toBe('Tap to log this session')
  })
})

describe('mirrorEntries', () => {
  it('keeps only entries that could ever fire', () => {
    var out = mirrorEntries([
      entry({ id: 'a', days: [4], remindAt: '07:00' }),
      entry({ id: 'b', days: [4], remindAt: undefined }), // no time
      entry({ id: 'c', days: [], remindAt: '07:00' }),    // no days
    ])
    expect(out.map(e => e.id)).toEqual(['a'])
  })

  it('projects only what the sender needs', () => {
    var out = mirrorEntries([entry({ id: 'a', days: [4] })])
    expect(Object.keys(out[0]).sort()).toEqual(
      ['days', 'id', 'remindTimes', 'routineId', 'routineName', 'tz']
    )
  })

  it('does not carry fields the Worker has no business holding', () => {
    var out = mirrorEntries([Object.assign(entry({ days: [4] }), { remindFrom: '2026-09-03', secret: 'x' })])
    expect(out[0].remindFrom).toBeUndefined()
    expect(out[0].secret).toBeUndefined()
  })

  it('handles empty input', () => {
    expect(mirrorEntries([])).toEqual([])
    expect(mirrorEntries(null)).toEqual([])
  })
})

describe('two reminders on one entry', () => {
  // Thursday 3 September 2026 in London (BST). The entry fires 07:00 and 18:30.
  var both = entry({ id: 'sub', days: [4], remindTimes: ['07:00', '18:30'], remindAt: undefined })
  var MORNING = Date.UTC(2026, 8, 3, 6, 0)  // 07:00 BST
  var EVENING = Date.UTC(2026, 8, 3, 17, 30) // 18:30 BST

  it('fires the morning one in the morning and the evening one in the evening', () => {
    expect(dueEntries([both], MORNING).map(x => x.time)).toEqual(['07:00'])
    expect(dueEntries([both], EVENING).map(x => x.time)).toEqual(['18:30'])
  })

  it('still fires the evening one after the morning has been sent', () => {
    // The bug this guards: dedupe keyed on the entry alone would treat the
    // morning send as "done today" and silently swallow the evening reminder.
    var sent = { [sentKey('sub', '07:00')]: '2026-09-03' }
    expect(dueEntries([both], EVENING, sent).map(x => x.time)).toEqual(['18:30'])
  })

  it('does not re-fire a time already sent today', () => {
    var sent = { [sentKey('sub', '07:00')]: '2026-09-03' }
    expect(dueEntries([both], MORNING, sent)).toEqual([])
  })

  it('can return both when the grace window covers the earlier one', () => {
    // 18:35, with a grace wide enough to still cover 07:00 — both are then due,
    // and both must come back rather than the first winning.
    var late = Date.UTC(2026, 8, 3, 17, 35)
    expect(dueEntries([both], late, {}, 12 * 60).map(x => x.time)).toEqual(['07:00', '18:30'])
  })

  it('mirrors both times to the Worker', () => {
    expect(mirrorEntries([both])[0].remindTimes).toEqual(['07:00', '18:30'])
  })
})
