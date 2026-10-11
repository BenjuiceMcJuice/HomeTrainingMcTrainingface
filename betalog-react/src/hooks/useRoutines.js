import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'
import { scheduleWithoutRoutine, scheduleWithRoutineName } from '../lib/reminders'

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

  // `schedule`, when given, is the schedule to save alongside: the entries
  // carry the routine's id and a copy of its name, so a rename follows it there
  // and a delete takes its entries with it (lib/reminders.js).
  function save(next, schedule) {
    Storage.saveRoutines(next)
    if (schedule !== undefined) Storage.saveSchedule(schedule)
    setData(function (prev) {
      var out = Object.assign({}, prev, { routines: next })
      if (schedule !== undefined) out.schedule = schedule
      return out
    })
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
    var next = data.routines.map(function (r) {
      if (r.id !== id) return r
      return Object.assign({}, r, fields, { updatedAt: now() })
    })
    save(next, typeof fields.name === 'string' ? scheduleWithRoutineName(data.schedule, id, fields.name) : undefined)
  }

  function deleteRoutine(id) {
    save(data.routines.filter(function (r) { return r.id !== id }), scheduleWithoutRoutine(data.schedule, id))
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
