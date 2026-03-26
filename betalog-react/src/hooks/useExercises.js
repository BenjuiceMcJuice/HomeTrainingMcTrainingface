import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'
import DEFAULT_EXERCISES, { RETIRED_EXERCISE_IDS } from '../lib/defaultExercises'

/**
 * CRUD hook for the exercise library.
 * All mutations persist to localStorage and update React context.
 *
 * @returns {{
 *   exercises: import('../lib/types').Exercise[],
 *   addExercise: (fields: object) => import('../lib/types').Exercise,
 *   updateExercise: (id: string, fields: object) => void,
 *   deleteExercise: (id: string) => void,
 * }}
 */
export default function useExercises() {
  const { data, setData } = useData()

  function save(next) {
    Storage.saveExercises(next)
    setData(function (prev) { return Object.assign({}, prev, { exercises: next }) })
  }

  function toggleFavourite(id) {
    save(data.exercises.map(function (e) {
      if (e.id !== id) return e
      return Object.assign({}, e, { isFavourite: !e.isFavourite, updatedAt: now() })
    }))
  }

  function addExercise(fields) {
    const ts = now()
    const exercise = Object.assign({
      movementPattern: null,
      equipment: null,
      muscles: '',
      notes: '',
      defaultSets: 3,
      defaultReps: 10,
      defaultRest: 60,
      ytSearch: '',
      isFavourite: false,
    }, fields, {
      id: uuid(),
      createdAt: ts,
      updatedAt: ts,
    })
    save(data.exercises.concat(exercise))
    return exercise
  }

  function updateExercise(id, fields) {
    save(data.exercises.map(function (e) {
      if (e.id !== id) return e
      return Object.assign({}, e, fields, { updatedAt: now() })
    }))
  }

  function deleteExercise(id) {
    save(data.exercises.filter(function (e) { return e.id !== id }))
  }

  function restoreDefaultExercises() {
    // Build a map of existing exercises by id so we can preserve isFavourite
    var byId = {}
    data.exercises.forEach(function (e) { byId[e.id] = e })

    // Replace / re-add every default, preserving isFavourite
    var restoredIds = new Set(DEFAULT_EXERCISES.map(function (d) { return d.id }))
    var restored = DEFAULT_EXERCISES.map(function (d) {
      return Object.assign({}, d, { isFavourite: byId[d.id] ? byId[d.id].isFavourite : false })
    })

    // Keep user-created exercises (ids not in defaults)
    var userCreated = data.exercises.filter(function (e) { return !restoredIds.has(e.id) })

    save(restored.concat(userCreated))
  }

  return {
    exercises: data.exercises,
    addExercise,
    updateExercise,
    deleteExercise,
    toggleFavourite,
    restoreDefaultExercises,
  }
}

/**
 * Called once on app startup. Merges any default exercises that are missing
 * from the current library (matched by id). This means new defaults added in
 * future releases are automatically added for existing users too.
 * User-edited or user-created exercises are never touched.
 */
export function seedDefaultExercises() {
  const raw = JSON.parse(localStorage.getItem('il_exercises') || 'null')

  if (raw === null) {
    // Brand new user — write all defaults
    Storage.saveExercises(DEFAULT_EXERCISES)
    return
  }

  const retiredSet = new Set(RETIRED_EXERCISE_IDS)

  // Purge any exercises whose IDs have been retired from the defaults
  const purged = raw.filter(function (e) { return !retiredSet.has(e.id) })

  // Add any new defaults that are missing
  const existingIds = new Set(purged.map(function (e) { return e.id }))
  const missing = DEFAULT_EXERCISES.filter(function (e) { return !existingIds.has(e.id) })

  if (purged.length !== raw.length || missing.length > 0) {
    Storage.saveExercises(purged.concat(missing))
  }
}
