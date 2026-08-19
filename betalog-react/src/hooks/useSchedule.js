import { useData } from '../App'
import Storage, { uuid } from '../lib/storage'
import { withReminder } from '../lib/reminders'

var MAX_ENTRIES = 3

/**
 * CRUD hook for the training schedule (up to 3 entries).
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
    var entry = { id: uuid(), routineId: routineId, routineName: routineName, days: days }
    save(entries.concat([withReminder(entry, remindAt)]))
  }

  function updateEntry(id, updates) {
    save(entries.map(function (e) {
      if (e.id !== id) return e
      return Object.assign({}, e, updates)
    }))
  }

  /**
   * Set or clear one entry's reminder time. Each entry carries its own time, so a
   * morning and an evening reminder are simply two entries.
   * @param {string} id
   * @param {string | null} remindAt - "HH:MM" local, 24h. Falsy clears the reminder.
   */
  function setReminder(id, remindAt) {
    save(entries.map(function (e) {
      return e.id === id ? withReminder(e, remindAt) : e
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
    setReminder: setReminder,
    removeEntry: removeEntry,
  }
}
