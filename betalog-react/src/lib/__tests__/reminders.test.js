import { describe, it, expect } from 'vitest'
import { isValidRemindAt, localTimeZone, withReminder, sortByRemindAt, entryTimes, withReminderTimes, scheduleWithoutRoutine, scheduleWithRoutineName } from '../reminders'

var entry = { id: 'a', routineId: 'r1', routineName: 'Hangboard', days: [1, 3, 5] }

describe('isValidRemindAt', () => {
  it('accepts 24h HH:MM', () => {
    expect(isValidRemindAt('07:00')).toBe(true)
    expect(isValidRemindAt('00:00')).toBe(true)
    expect(isValidRemindAt('23:59')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isValidRemindAt('24:00')).toBe(false)
    expect(isValidRemindAt('7:00')).toBe(false)
    expect(isValidRemindAt('19:60')).toBe(false)
    expect(isValidRemindAt('')).toBe(false)
    expect(isValidRemindAt(null)).toBe(false)
    expect(isValidRemindAt(undefined)).toBe(false)
    expect(isValidRemindAt(700)).toBe(false)
  })
})

describe('localTimeZone', () => {
  it('returns an IANA zone string or null', () => {
    var tz = localTimeZone()
    expect(tz === null || typeof tz === 'string').toBe(true)
  })
})

describe('withReminder', () => {
  it('sets remindAt and captures a timezone', () => {
    var next = withReminder(entry, '07:00', 'Europe/London')
    expect(next.remindTimes).toEqual(['07:00'])
    expect(next.tz).toBe('Europe/London')
  })

  it('defaults tz to the device zone when not given', () => {
    var next = withReminder(entry, '18:30')
    expect(next.remindTimes).toEqual(['18:30'])
    expect(next.tz).toBe(localTimeZone() || undefined)
  })

  it('omits tz entirely when none is resolvable', () => {
    var next = withReminder(entry, '18:30', null)
    expect(next.remindTimes).toEqual(['18:30'])
    expect('tz' in next).toBe(false)
  })

  it('deletes both keys when cleared, rather than nulling them', () => {
    var timed = withReminder(entry, '07:00', 'Europe/London')
    var cleared = withReminder(timed, '')
    expect('remindTimes' in cleared).toBe(false)
    expect('tz' in cleared).toBe(false)
  })

  it('treats a malformed time as a clear', () => {
    var timed = withReminder(entry, '07:00', 'Europe/London')
    expect('remindTimes' in withReminder(timed, '25:00')).toBe(false)
    expect('remindTimes' in withReminder(timed, null)).toBe(false)
  })

  it('does not mutate the entry it is given', () => {
    var timed = withReminder(entry, '07:00', 'Europe/London')
    withReminder(timed, '')
    expect(timed.remindTimes).toEqual(['07:00'])
    expect(entry.remindTimes).toBeUndefined()
  })

  it('leaves the rest of the entry untouched', () => {
    var next = withReminder(entry, '07:00', 'Europe/London')
    expect(next.id).toBe('a')
    expect(next.routineName).toBe('Hangboard')
    expect(next.days).toEqual([1, 3, 5])
  })
})

describe('sortByRemindAt', () => {
  it('orders morning before evening', () => {
    var evening = { id: 'pm', remindAt: '18:30' }
    var morning = { id: 'am', remindAt: '07:00' }
    expect(sortByRemindAt([evening, morning]).map(e => e.id)).toEqual(['am', 'pm'])
  })

  it('puts untimed entries last, keeping their order', () => {
    var untimedA = { id: 'x' }
    var untimedB = { id: 'y' }
    var timed    = { id: 'am', remindAt: '07:00' }
    expect(sortByRemindAt([untimedA, untimedB, timed]).map(e => e.id)).toEqual(['am', 'x', 'y'])
  })

  it('treats a malformed time as untimed', () => {
    var broken = { id: 'bad', remindAt: '7am' }
    var timed  = { id: 'pm', remindAt: '18:30' }
    expect(sortByRemindAt([broken, timed]).map(e => e.id)).toEqual(['pm', 'bad'])
  })

  it('does not mutate its input and handles empty input', () => {
    var list = [{ id: 'pm', remindAt: '18:30' }, { id: 'am', remindAt: '07:00' }]
    sortByRemindAt(list)
    expect(list.map(e => e.id)).toEqual(['pm', 'am'])
    expect(sortByRemindAt([])).toEqual([])
    expect(sortByRemindAt(null)).toEqual([])
  })
})

describe('entryTimes', () => {
  it('reads the legacy single remindAt', () => {
    expect(entryTimes({ remindAt: '07:00' })).toEqual(['07:00'])
  })

  it('sorts, de-duplicates and drops malformed times', () => {
    expect(entryTimes({ remindTimes: ['18:30', '07:00', '07:00', '25:00', ''] }))
      .toEqual(['07:00', '18:30'])
  })

  it('prefers remindTimes over a stale remindAt', () => {
    expect(entryTimes({ remindTimes: ['18:30'], remindAt: '07:00' })).toEqual(['18:30'])
  })

  it('is empty for an entry with no reminder', () => {
    expect(entryTimes({})).toEqual([])
    expect(entryTimes(null)).toEqual([])
  })
})

describe('withReminderTimes', () => {
  it('stores several times, earliest first', () => {
    var next = withReminderTimes(entry, ['18:30', '07:00'], 'Europe/London')
    expect(next.remindTimes).toEqual(['07:00', '18:30'])
  })

  it('drops the legacy remindAt on write, so an entry never carries both', () => {
    var legacy = { id: 'a', days: [1], remindAt: '07:00' }
    var next = withReminderTimes(legacy, ['18:30'], 'Europe/London')
    expect('remindAt' in next).toBe(false)
    expect(next.remindTimes).toEqual(['18:30'])
  })

  it('treats an empty or all-invalid list as a clear', () => {
    var timed = withReminderTimes(entry, ['07:00'], 'Europe/London')
    expect('remindTimes' in withReminderTimes(timed, [])).toBe(false)
    expect('remindTimes' in withReminderTimes(timed, ['25:00'])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The schedule follows a routine's rename and delete (2026-10-11). Before, a
// deleted routine's entry stayed: the Dashboard chip opened nothing, reminders
// kept firing and adherence kept scoring the day as missed.
// ---------------------------------------------------------------------------

describe('scheduleWithoutRoutine', () => {
  const sched = [
    { id: 'a', routineId: 'r1', routineName: 'Push', days: [1] },
    { id: 'b', routineId: 'r2', routineName: 'Pull', days: [3] },
  ]

  it('drops every entry for the routine and keeps the rest', () => {
    expect(scheduleWithoutRoutine(sched, 'r1')).toEqual([sched[1]])
  })

  it('leaves a schedule without the routine untouched', () => {
    expect(scheduleWithoutRoutine(sched, 'r9')).toEqual(sched)
  })

  it('passes a null or legacy non-array schedule through', () => {
    expect(scheduleWithoutRoutine(null, 'r1')).toBe(null)
    const legacy = { routineId: 'r1', days: [1] }
    expect(scheduleWithoutRoutine(legacy, 'r1')).toBe(legacy)
  })
})

describe('scheduleWithRoutineName', () => {
  const sched = [
    { id: 'a', routineId: 'r1', routineName: 'Push', days: [1] },
    { id: 'b', routineId: 'r2', routineName: 'Pull', days: [3] },
  ]

  it('renames the routine on its entries only', () => {
    const out = scheduleWithRoutineName(sched, 'r1', 'Push day')
    expect(out[0].routineName).toBe('Push day')
    expect(out[1]).toBe(sched[1])
  })

  it('returns the same entry objects when nothing changes', () => {
    const out = scheduleWithRoutineName(sched, 'r1', 'Push')
    expect(out[0]).toBe(sched[0])
  })

  it('passes a null or legacy non-array schedule through', () => {
    expect(scheduleWithRoutineName(null, 'r1', 'x')).toBe(null)
  })
})
