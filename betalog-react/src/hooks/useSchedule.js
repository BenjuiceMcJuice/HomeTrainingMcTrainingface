import { useData } from '../App'
import Storage, { uuid } from '../lib/storage'

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

  function addEntry(routineId, routineName, days) {
    if (entries.length >= MAX_ENTRIES) return
    var entry = { id: uuid(), routineId: routineId, routineName: routineName, days: days }
    save(entries.concat([entry]))
  }

  function updateEntry(id, updates) {
    save(entries.map(function (e) {
      if (e.id !== id) return e
      return Object.assign({}, e, updates)
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
    removeEntry: removeEntry,
  }
}
