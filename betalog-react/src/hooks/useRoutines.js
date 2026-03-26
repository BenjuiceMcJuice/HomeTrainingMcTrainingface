import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'

/**
 * CRUD hook for gym routines.
 * Hangboard routines share the same Routine shape but are managed in Step 4.
 *
 * @returns {{
 *   routines: import('../lib/types').Routine[],
 *   addRoutine: (fields: object) => import('../lib/types').Routine,
 *   updateRoutine: (id: string, fields: object) => void,
 *   deleteRoutine: (id: string) => void,
 * }}
 */
export default function useRoutines() {
  const { data, setData } = useData()

  function save(next) {
    Storage.saveRoutines(next)
    setData(function (prev) { return Object.assign({}, prev, { routines: next }) })
  }

  function addRoutine(fields) {
    const ts = now()
    const routine = Object.assign({
      type: 'gym',
      exercises: [],
      grips: [],
    }, fields, {
      id: uuid(),
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

  // Gym routines only — hangboard routines handled in Step 4; favourites first
  const gymRoutines = data.routines
    .filter(function (r) { return r.type === 'gym' })
    .slice()
    .sort(function (a, b) {
      if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1
      return 0
    })

  return {
    routines: gymRoutines,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    toggleFavourite,
  }
}
