import { useData } from '../App'
import Storage, { now } from '../lib/storage'

/**
 * CRUD hook for the athlete profile.
 *
 * @returns {{
 *   profile: import('../lib/types').AthleteProfile | null,
 *   saveProfile: (fields: object) => void,
 * }}
 */
export default function useProfile() {
  var { data, setData } = useData()

  function saveProfile(fields) {
    var updated = Object.assign({}, data.athleteProfile || {}, fields, { updatedAt: now() })
    Storage.saveAthleteProfile(updated)
    setData(function (prev) { return Object.assign({}, prev, { athleteProfile: updated }) })
  }

  return { profile: data.athleteProfile, saveProfile: saveProfile }
}
