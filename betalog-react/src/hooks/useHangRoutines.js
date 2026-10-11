import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'
import { scheduleWithoutRoutine, scheduleWithRoutineName } from '../lib/reminders'
import { DEFAULT_ROUTINES, RETIRED_ROUTINE_IDS } from '../lib/defaultRoutines'

/**
 * CRUD hook for hangboard routines.
 * All routines share the `il_routines` key — this hook filters to type === 'hangboard'.
 */
export default function useHangRoutines() {
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
