import { describe, it, expect } from 'vitest'
import { isValidRemindAt, localTimeZone, withReminder, sortByRemindAt } from '../reminders'

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
    expect(next.remindAt).toBe('07:00')
    expect(next.tz).toBe('Europe/London')
  })

  it('defaults tz to the device zone when not given', () => {
    var next = withReminder(entry, '18:30')
    expect(next.remindAt).toBe('18:30')
    expect(next.tz).toBe(localTimeZone() || undefined)
  })

  it('omits tz entirely when none is resolvable', () => {
    var next = withReminder(entry, '18:30', null)
    expect(next.remindAt).toBe('18:30')
    expect('tz' in next).toBe(false)
  })

  it('deletes both keys when cleared, rather than nulling them', () => {
    var timed = withReminder(entry, '07:00', 'Europe/London')
    var cleared = withReminder(timed, '')
    expect('remindAt' in cleared).toBe(false)
    expect('tz' in cleared).toBe(false)
  })

  it('treats a malformed time as a clear', () => {
    var timed = withReminder(entry, '07:00', 'Europe/London')
    expect('remindAt' in withReminder(timed, '25:00')).toBe(false)
    expect('remindAt' in withReminder(timed, null)).toBe(false)
  })

  it('does not mutate the entry it is given', () => {
    var timed = withReminder(entry, '07:00', 'Europe/London')
    withReminder(timed, '')
    expect(timed.remindAt).toBe('07:00')
    expect(entry.remindAt).toBeUndefined()
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
