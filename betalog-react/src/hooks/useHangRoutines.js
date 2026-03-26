import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'
import { DEFAULT_ROUTINES, RETIRED_ROUTINE_IDS } from '../lib/defaultRoutines'

/**
 * CRUD hook for hangboard routines.
 * All routines share the `il_routines` key — this hook filters to type === 'hangboard'.
 */
export default function useHangRoutines() {
  const { data, setData } = useData()

  function save(next) {
    Storage.saveRoutines(next)
    setData(function (prev) { return Object.assign({}, prev, { routines: next }) })
  }

  function addRoutine(fields) {
    var ts = now()
    var routine = Object.assign({ exercises: [], grips: [] }, fields, {
      id:        uuid(),
      type:      'hangboard',
      createdAt: ts,
      updatedAt: ts,
    })
    save(data.routines.concat(routine))
    return routine
  }

  function updateRoutine(id, fields) {
    save(data.routines.map(function (r) {
      if (r.id !== id) return r
      return Object.assign({}, r, fields, { updatedAt: now() })
    }))
  }

  function deleteRoutine(id) {
    save(data.routines.filter(function (r) { return r.id !== id }))
  }

  function toggleFavourite(id) {
    save(data.routines.map(function (r) {
      if (r.id !== id) return r
      return Object.assign({}, r, { isFavourite: !r.isFavourite, updatedAt: now() })
    }))
  }

  function restoreDefaultRoutines() {
    var retiredSet   = new Set(RETIRED_ROUTINE_IDS)
    var userRoutines = data.routines.filter(function (r) {
      return r.id && !r.id.startsWith('dr-') && !retiredSet.has(r.id)
    })
    save(userRoutines.concat(DEFAULT_ROUTINES))
  }

  // Favourites first, then original order
  var routines = data.routines
    .filter(function (r) { return r.type === 'hangboard' })
    .slice()
    .sort(function (a, b) {
      if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1
      return 0
    })

  return { routines, addRoutine, updateRoutine, deleteRoutine, toggleFavourite, restoreDefaultRoutines }
}
