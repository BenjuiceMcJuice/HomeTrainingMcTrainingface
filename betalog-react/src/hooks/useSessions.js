import { useData } from '../App'
import Storage, { uuid, now } from '../lib/storage'

/**
 * CRUD hook for sessions.
 *
 * @returns {{
 *   sessions: import('../lib/types').Session[],
 *   addSession: (session: object) => import('../lib/types').Session,
 *   updateSession: (id: string, updates: object) => void,
 *   updateSessionsWhere: (ids: string[], updates: object) => void,
 *   applySessionUpdates: (list: Array<{ id: string, fields: object }>) => void,
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
      {
        exercises: [], climbs: [], hangGrips: [], notes: '', discipline: null,
        cardioActivity: null, cardioLabel: null, cardioDurationMins: null,
        cardioQuantity: null, cardioUnit: null, cardioPoolLength: null,
      },
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

  /**
   * The same fields onto several sessions in one save — one localStorage
   * write, one sync. Linking old text-only sessions to a registry venue uses
   * it (lib/venues.js `legacySessionIds`). No-op for an empty list.
   */
  function updateSessionsWhere(ids, updates) {
    if (!Array.isArray(ids) || !ids.length) return
    const ts = now()
    const next = data.sessions.map(function (s) {
      if (ids.indexOf(s.id) === -1) return s
      return Object.assign({}, s, updates, { updatedAt: ts })
    })
    save(next)
  }

  /**
   * Different fields onto different sessions, one save: `[{ id, fields }]`
   * as `lib/venues.js` `relinkSessions` returns. No-op for an empty list.
   */
  function applySessionUpdates(list) {
    if (!Array.isArray(list) || !list.length) return
    const ts = now()
    const byId = {}
    list.forEach(function (u) { if (u && u.id) byId[u.id] = u.fields || {} })
    const next = data.sessions.map(function (s) {
      if (!byId[s.id]) return s
      return Object.assign({}, s, byId[s.id], { updatedAt: ts })
    })
    save(next)
  }

  // Sorted newest-first by session date (editable), then createdAt as tiebreaker
  const sessions = data.sessions.slice().sort(function (a, b) {
    if (b.date !== a.date) return b.date > a.date ? 1 : -1
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  return { sessions, addSession, updateSession, updateSessionsWhere, applySessionUpdates, deleteSession }
}
