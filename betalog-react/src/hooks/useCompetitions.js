import { useState, useEffect, useCallback, useMemo } from 'react'
import { useData } from '../App'
import Storage, { now } from '../lib/storage'
import { revealGrades } from '../lib/competition'

/**
 * Competitions — the account's list, the one draft on this device, and the
 * organiser's actions. The maths is in lib/competition.js; Firestore is
 * behind Storage. Spec: docs/specs/betalog_competitions_spec.md.
 *
 * `mine` is `data.compEntries`, one row per comp entered or organised,
 * synced with the rest of the account. The draft is device-local
 * (`il_compDraft`): a comp has no Firestore document until *Open entries*
 * gives it a code, and a half-built scoresheet should survive a reload.
 */
export default function useCompetitions() {
  var { data, setData } = useData()
  var mine = useMemo(function () { return data.compEntries || [] }, [data.compEntries])
  var [draft, setDraftState] = useState(function () { return Storage.loadCompDraft() })

  var saveRefs = useCallback(function (next) {
    Storage.saveCompEntries(next)
    setData(function (prev) { return Object.assign({}, prev, { compEntries: next }) })
  }, [setData])

  var upsertRef = useCallback(function (ref) {
    var rest = (data.compEntries || []).filter(function (r) { return r.code !== ref.code })
    saveRefs(rest.concat([ref]))
  }, [data.compEntries, saveRefs])

  var removeRef = useCallback(function (code) {
    saveRefs((data.compEntries || []).filter(function (r) { return r.code !== code }))
  }, [data.compEntries, saveRefs])

  var saveDraft = useCallback(function (comp) {
    Storage.saveCompDraft(comp)
    setDraftState(comp)
  }, [])

  var clearDraft = useCallback(function () {
    Storage.clearCompDraft()
    setDraftState(null)
  }, [])

  /** *Open entries*: the draft becomes a Firestore document with a code. */
  var openEntries = useCallback(function (comp) {
    return Storage.createComp(comp).then(function (stored) {
      upsertRef(refFor(stored, 'organiser'))
      clearDraft()
      return stored
    })
  }, [upsertRef, clearDraft])

  /** Organiser saves an existing comp (hidden grades split off by Storage). */
  var save = useCallback(function (comp) {
    return Storage.saveComp(comp).then(function (stored) {
      upsertRef(refFor(stored, 'organiser'))
      return stored
    })
  }, [upsertRef])

  var setStatus = useCallback(function (code, status) {
    return Storage.setCompStatus(code, status)
  }, [])

  var remove = useCallback(function (code) {
    return Storage.deleteComp(code).then(function () { removeRef(code) })
  }, [removeRef])

  /** A comp seen for the first time (by code) is remembered on the list. */
  var remember = useCallback(function (comp, role) {
    var existing = (data.compEntries || []).filter(function (r) { return r.code === comp.code })[0]
    if (existing && existing.role === 'organiser') return
    upsertRef(refFor(comp, role || (existing ? existing.role : 'entrant')))
  }, [data.compEntries, upsertRef])

  var sorted = useMemo(function () { return sortRefs(mine, now().slice(0, 10)) }, [mine])

  return {
    mine: sorted,
    draft: draft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    openEntries: openEntries,
    save: save,
    setStatus: setStatus,
    remove: remove,
    remember: remember,
    removeRef: removeRef,
  }
}

/** @returns {import('../lib/types').CompEntryRef} */
export function refFor(comp, role) {
  return {
    code: comp.code,
    name: comp.name,
    date: comp.date,
    venueName: (comp.venue && comp.venue.name) || '',
    role: role,
  }
}

/**
 * Today and future first, soonest first; then the past, most recent first.
 * Pure, so the order can be tested.
 */
export function sortRefs(refs, today) {
  return (refs || []).slice().sort(function (a, b) {
    var aPast = a.date < today, bPast = b.date < today
    if (aPast !== bPast) return aPast ? 1 : -1
    if (a.date !== b.date) return aPast ? (a.date < b.date ? 1 : -1) : (a.date < b.date ? -1 : 1)
    return (a.name || '').localeCompare(b.name || '')
  })
}

/**
 * One comp, live while the screen shows it. For an organiser the hidden
 * grades are read once and merged back, so the editor shows what the setter
 * typed; `comp.problems` is what everyone else sees.
 *
 * @param {string|null} code
 * @param {string|null} uid
 * @returns {{ comp: object|null, editable: object|null, isOrganiser: boolean, loading: boolean, error: string|null, notFound: boolean }}
 */
export function useComp(code, uid) {
  var [comp, setComp] = useState(null)
  var [grades, setGrades] = useState(null)
  var [loading, setLoading] = useState(!!code)
  var [error, setError] = useState(null)
  var [notFound, setNotFound] = useState(false)

  useEffect(function () {
    if (!code) return undefined
    setLoading(true); setError(null); setNotFound(false); setComp(null); setGrades(null)
    var unsub = Storage.watchComp(code, function (c) {
      if (!c) { setNotFound(true); setComp(null); setLoading(false); return }
      if (typeof c.schemaVersion === 'number' && c.schemaVersion > 1) {
        setError('Update BetaLog to see this competition'); setLoading(false); return
      }
      setComp(c)
      setLoading(false)
    }, function (err) {
      setError(err.message || 'Could not load the competition')
      setLoading(false)
    })
    return unsub
  }, [code])

  var isOrganiser = !!(comp && uid && (comp.organisers || []).indexOf(uid) !== -1)
  var status = comp ? comp.status : null

  // Organisers read the private grades once per comp (and again after a
  // save, which the caller triggers by remounting the editor).
  useEffect(function () {
    if (!isOrganiser || !code || status === 'closed') return undefined
    var cancelled = false
    Storage.getCompGrades(code).then(function (g) { if (!cancelled) setGrades(g || {}) }).catch(function () {
      if (!cancelled) setGrades({})
    })
    return function () { cancelled = true }
  }, [isOrganiser, code, status])

  // Null until the private grades have arrived, so an editor never mounts on
  // a sheet with the hidden grades still blank (the first walkthrough did).
  var editable = useMemo(function () {
    if (!comp || !isOrganiser) return null
    if (comp.status === 'closed') return comp
    if (!grades) return null
    return Object.assign({}, comp, { problems: revealGrades(comp.problems, grades) })
  }, [comp, isOrganiser, grades])

  return { comp: comp, editable: editable, isOrganiser: isOrganiser, loading: loading, error: error, notFound: notFound }
}

/** Every entry of a comp, live — the leaderboard and the entrant count. */
export function useCompEntries(code, enabled) {
  var [entries, setEntries] = useState([])
  var [loading, setLoading] = useState(!!enabled)
  useEffect(function () {
    if (!code || !enabled) return undefined
    setLoading(true)
    var unsub = Storage.watchEntries(code, function (list) { setEntries(list); setLoading(false) }, function () { setLoading(false) })
    return unsub
  }, [code, enabled])
  return { entries: entries, loading: loading }
}
