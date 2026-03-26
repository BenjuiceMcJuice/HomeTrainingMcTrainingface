import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'

/**
 * CRUD hook for the bodyweight log.
 *
 * @returns {{
 *   entries: import('../lib/types').WeightEntry[],
 *   addEntry: (date: string, weight: number, note?: string) => void,
 *   updateEntry: (id: string, updates: object) => void,
 *   deleteEntry: (id: string) => void,
 * }}
 */
export default function useWeightLog() {
  var { data, setData } = useData()

  function save(next) {
    Storage.saveWeightLog(next)
    setData(function (prev) { return Object.assign({}, prev, { weightLog: next }) })
  }

  function addEntry(date, weight, note) {
    var entry = {
      id:     uuid(),
      date:   date,
      weight: weight,
      note:   note || null,
    }
    // Newest-first
    save([entry].concat(data.weightLog || []))
  }

  function updateEntry(id, updates) {
    save((data.weightLog || []).map(function (e) {
      if (e.id !== id) return e
      return Object.assign({}, e, updates)
    }))
  }

  function deleteEntry(id) {
    save((data.weightLog || []).filter(function (e) { return e.id !== id }))
  }

  // Sorted newest-first by date
  var entries = (data.weightLog || []).slice().sort(function (a, b) {
    return b.date > a.date ? 1 : b.date < a.date ? -1 : 0
  })

  return { entries: entries, addEntry: addEntry, updateEntry: updateEntry, deleteEntry: deleteEntry }
}
