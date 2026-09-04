import { useData } from '../App'
import Storage, { uuid } from '../lib/storage'
import { withReminder, withReminderTimes, entryTimes, firstMatchingDay } from '../lib/reminders'

var MAX_ENTRIES = 3

// Times per entry. The 3-entry cap is a cap on *routines* — a routine wanting a
// morning and an evening nudge must not spend two of the three slots — so the
// second dimension is bounded here instead of there.
var MAX_TIMES = 4

/**
 * CRUD hook for the training schedule (up to 3 routines, each with up to 4 times).
 */
export default function useSchedule() {
  var { data, setData } = useData()

  // Migrate old singleton format to array
  var entries = data.schedule
  if (entries && !Array.isArray(entries)) {
    // Old format: { routineId, days, updatedAt }
    entries = entries.routineId
      ? [{ id: uuid(), routineId: entries.routineId, routineName: '', days: entries.days || [] }]
      : []
  }
  entries = entries || []

  function save(next) {
    Storage.saveSchedule(next)
    setData(function (prev) { return Object.assign({}, prev, { schedule: next }) })
  }

  function addEntry(routineId, routineName, days, remindAt) {
    if (entries.length >= MAX_ENTRIES) return
    var entry = {
      id: uuid(),
      routineId: routineId,
      routineName: routineName,
      days: days,
      remindFrom: firstMatchingDay(days, new Date().toISOString().slice(0, 10)),
    }
    save(entries.concat([withReminder(entry, remindAt)]))
  }

  function updateEntry(id, updates) {
    save(entries.map(function (e) {
      if (e.id !== id) return e
      return Object.assign({}, e, updates)
    }))
  }

  /**
   * Set one entry's whole list of reminder times. Sorting, de-duplication and
   * dropping malformed values all happen in `withReminderTimes`.
   * @param {string} id
   * @param {string[]} times - "HH:MM" local, 24h. Empty clears the reminder.
   */
  function setReminderTimes(id, times) {
    save(entries.map(function (e) {
      return e.id === id ? withReminderTimes(e, (times || []).slice(0, MAX_TIMES)) : e
    }))
  }

  /**
   * Add one more reminder time to an entry, up to MAX_TIMES.
   * @param {string} id
   * @param {string} time - "HH:MM" local, 24h
   */
  function addReminderTime(id, time) {
    save(entries.map(function (e) {
      if (e.id !== id) return e
      var times = entryTimes(e)
      if (times.length >= MAX_TIMES) return e
      return withReminderTimes(e, times.concat([time]))
    }))
  }

  /**
   * Remove one reminder time. Removing the last one clears the reminder entirely.
   * @param {string} id
   * @param {string} time
   */
  function removeReminderTime(id, time) {
    save(entries.map(function (e) {
      if (e.id !== id) return e
      return withReminderTimes(e, entryTimes(e).filter(function (t) { return t !== time }))
    }))
  }

  function removeEntry(id) {
    save(entries.filter(function (e) { return e.id !== id }))
  }

  return {
    entries: entries,
    canAdd: entries.length < MAX_ENTRIES,
    addEntry: addEntry,
    updateEntry: updateEntry,
    setReminderTimes: setReminderTimes,
    addReminderTime: addReminderTime,
    removeReminderTime: removeReminderTime,
    maxTimes: MAX_TIMES,
    removeEntry: removeEntry,
  }
}
