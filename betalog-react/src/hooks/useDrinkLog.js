import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'

/**
 * CRUD hook for the alcohol drink log.
 *
 * @returns {{
 *   entries: import('../lib/types').DrinkEntry[],
 *   addEntry: (date: string, type: string, label: string|null, volumeMl: number, abv: number, quantity: number, note: string|null) => void,
 *   deleteEntry: (id: string) => void,
 * }}
 */
export default function useDrinkLog() {
  var { data, setData } = useData()

  function save(next) {
    Storage.saveDrinkLog(next)
    setData(function (prev) { return Object.assign({}, prev, { drinkLog: next }) })
  }

  var KCAL_MULTIPLIER = { beer_cider: 1.4, wine: 1.15, spirit: 1.0, other: 1.0 }

  function addEntry(date, type, label, volumeMl, abv, quantity, note) {
    var units = Math.round((volumeMl * abv * quantity) / 1000 * 10) / 10
    var kcal  = Math.round(units * 56 * (KCAL_MULTIPLIER[type] || 1.0))
    var entry = {
      id:        uuid(),
      date:      date,
      type:      type,
      label:     label || null,
      volumeMl:  volumeMl,
      abv:       abv,
      quantity:  quantity,
      units:     units,
      kcal:      kcal,
      note:      note || null,
      createdAt: now(),
    }
    save([entry].concat(data.drinkLog || []))
  }

  function deleteEntry(id) {
    save((data.drinkLog || []).filter(function (e) { return e.id !== id }))
  }

  var entries = (data.drinkLog || []).slice().sort(function (a, b) {
    return b.date > a.date ? 1 : b.date < a.date ? -1 : 0
  })

  return { entries: entries, addEntry: addEntry, deleteEntry: deleteEntry }
}
