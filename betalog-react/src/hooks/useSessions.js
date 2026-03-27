import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'

/**
 * CRUD hook for sessions.
 *
 * @returns {{
 *   sessions: import('../lib/types').Session[],
 *   addSession: (session: object) => import('../lib/types').Session,
 *   deleteSession: (id: string) => void,
 * }}
 */
export default function useSessions() {
  const { data, setData } = useData()

  function save(next) {
    Storage.saveSessions(next)
    setData(function (prev) { return Object.assign({}, prev, { sessions: next }) })
  }

  function addSession(sessionObj) {
    const ts = now()
    const session = Object.assign(
      { exercises: [], climbs: [], hangGrips: [], notes: '', discipline: null },
      sessionObj,
      {
        id: sessionObj.id || uuid(),
        createdAt: sessionObj.createdAt || ts,
        updatedAt: ts,
      }
    )
    save([session].concat(data.sessions))
    return session
  }

  function deleteSession(id) {
    save(data.sessions.filter(function (s) { return s.id !== id }))
  }

  function updateSession(id, updates) {
    const ts   = now()
    const next = data.sessions.map(function (s) {
      if (s.id !== id) return s
      return Object.assign({}, s, updates, { updatedAt: ts })
    })
    save(next)
  }

  // Sorted newest-first by session date (editable), then createdAt as tiebreaker
  const sessions = data.sessions.slice().sort(function (a, b) {
    if (b.date !== a.date) return b.date > a.date ? 1 : -1
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  return { sessions, addSession, updateSession, deleteSession }
}
