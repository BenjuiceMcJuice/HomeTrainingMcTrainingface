import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useData } from '../App'
import Storage, { now } from '../lib/storage'
import { revealGrades, sessionForComp, compSessionId, applyCardAction, withCard, applyEntryVoids, refreshSession, compEndMs, compStartMs, catchUpStatus, placingFor, withPlacing } from '../lib/competition'

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
export default function useCompetitions(uid) {
  var { data, setData } = useData()
  var dataRef = useRef(data)
  dataRef.current = data
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

  /** A new end — *Change end time* while running, *Reopen scoring* from judging. */
  var setEnd = useCallback(function (comp, fields, reopen) {
    return Storage.setCompEnd(comp, fields, reopen)
  }, [])

  /** Organiser voids one problem on one entrant's card, with a note they see (spec §8). */
  var voidProblem = useCallback(function (code, entrantUid, problemId, note) {
    return Storage.voidProblem(code, entrantUid, problemId, { by: uid, note: note || '' })
  }, [uid])

  /** Organiser sets one problem on one entrant's card, with a note they see (BTL-B85). */
  var amendProblem = useCallback(function (code, entrantUid, problemId, result, note, scoring) {
    return Storage.amendProblem(code, entrantUid, problemId, result, { by: uid, note: note || '', scoring: scoring || null })
  }, [uid])

  var remove = useCallback(function (code) {
    return Storage.deleteComp(code).then(function () { removeRef(code) })
  }, [removeRef])

  /**
   * A comp seen for the first time (by code) is remembered on the list, and a
   * comp already on it is refreshed when its name, date or times have moved —
   * the Dashboard's *Coming up* strip reads the times from the list. An
   * organiser stays an organiser. Writes only when something changed.
   */
  var remember = useCallback(function (comp, role) {
    var existing = (data.compEntries || []).filter(function (r) { return r.code === comp.code })[0]
    var keepRole = existing && existing.role === 'organiser' ? 'organiser' : (role || (existing ? existing.role : 'entrant'))
    var next = refFor(comp, keepRole)
    if (existing && refSame(existing, next)) return
    upsertRef(next)
  }, [data.compEntries, upsertRef])

  // ---- the entrant's side: the card is a session in the log (spec §7) ----

  /** Replace or prepend one session and save, without touching the rest. */
  var upsertSession = useCallback(function (session) {
    var current = dataRef.current.sessions || []
    var found = false
    var next = current.map(function (s) { if (s.id === session.id) { found = true; return session } return s })
    if (!found) next = [session].concat(current)
    Storage.saveSessions(next)
    setData(function (prev) { return Object.assign({}, prev, { sessions: next }) })
    return session
  }, [setData])

  function currentSession(code) {
    return (dataRef.current.sessions || []).filter(function (s) { return s.id === compSessionId(code) })[0] || null
  }

  /**
   * Enter a comp: the entry document (reused if this account already has one
   * — a second device), the session in the log, the row on Mine.
   */
  var enter = useCallback(function (comp, details) {
    if (!uid) return Promise.reject(new Error('Not signed in'))
    return Storage.getEntry(comp.code, uid).then(function (existing) {
      if (existing) return existing
      return Storage.enterComp(comp.code, uid, details)
    }).then(function (entry) {
      var session = sessionForComp(comp, entry, currentSession(comp.code), now())
      upsertSession(session)
      var organiser = (comp.organisers || []).indexOf(uid) !== -1
      upsertRef(refFor(comp, organiser ? 'organiser' : 'entrant'))
      return session
    })
  }, [uid, upsertSession, upsertRef])

  var pendingPush = useRef({})

  function pushCard(code, card) {
    if (!uid) return
    pendingPush.current[code] = card
    Storage.saveEntryCard(code, uid, card).then(function () {
      if (pendingPush.current[code] === card) delete pendingPush.current[code]
    }).catch(function (err) {
      console.warn('Card mirror failed, will retry on reconnect:', err.message)
    })
  }

  /** A go, a zone, a top: the session first, the mirror after. */
  var act = useCallback(function (code, _uid, action) {
    var session = currentSession(code)
    if (!session || !session.comp) return
    var card = applyCardAction(session.comp.card, session.comp.scoring, action, now())
    if (card === session.comp.card) return
    upsertSession(withCard(session, card, now()))
    pushCard(code, card)
  }, [upsertSession]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * A closed comp → the session's final state: the organiser's last
   * amendments, the revealed grades, and the placing, worked out from every
   * entry once (step 5). Nothing to do once the placing is there.
   */
  var settleClosed = useCallback(function (code, comp) {
    var session = currentSession(code)
    if (!session || !session.comp || !comp || comp.status !== 'closed' || session.comp.placing) return Promise.resolve()
    return Storage.getEntries(code).then(function (entries) {
      var cur = currentSession(code)
      if (!cur) return
      var next = refreshSession(cur, comp, now())
      var mine = entries.filter(function (e) { return e.uid === uid })[0]
      if (mine) next = applyEntryVoids(next, mine, now())
      next = withPlacing(next, placingFor(comp, entries, uid), now())
      if (next !== cur) upsertSession(next)
    })
  }, [uid, upsertSession])

  /** The comp as now seen → the session's copy of the sheet, scoring, status. */
  var syncFromComp = useCallback(function (code, comp) {
    var session = currentSession(code)
    if (!session) return
    var next = refreshSession(session, comp, now())
    if (next !== session) upsertSession(next)
    if (comp && comp.status === 'closed') settleClosed(code, comp).catch(function () { /* next visit */ })
  }, [upsertSession, settleClosed])

  /**
   * History's catch-up: each comp session from the last 60 days that has no
   * placing yet reads its comp once per visit, and a closed one is settled.
   * So the placing lands without the climber reopening the comp.
   */
  var catchUpClosed = useCallback(function () {
    if (!uid) return
    var cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
    ;(dataRef.current.sessions || []).forEach(function (s) {
      if (!s.comp || !s.comp.code || s.comp.placing || (s.date || '') < cutoff) return
      Storage.getComp(s.comp.code).then(function (comp) {
        if (!comp) return
        var cur = currentSession(s.comp.code)
        if (!cur) return
        if (comp.status !== 'closed') {
          var next = refreshSession(cur, comp, now())
          if (next !== cur) upsertSession(next)
          return
        }
        return settleClosed(s.comp.code, comp)
      }).catch(function () { /* offline or gone: try again next visit */ })
    })
  }, [uid, upsertSession, settleClosed])

  /**
   * Watch this account's entry for the organiser's voids and amendments
   * while the card is open. Once one is applied the card is pushed back, so
   * a stale push from this phone that beat it to the mirror is put right
   * there too (refused once scoring has ended - when it cannot happen).
   */
  var watchVoids = useCallback(function (code, entrantUid) {
    return Storage.watchEntry(code, entrantUid, function (entry) {
      if (!entry) return
      var session = currentSession(code)
      if (!session) return
      var next = applyEntryVoids(session, entry, now())
      if (next === session) return
      upsertSession(next)
      if (next.comp && next.comp.status !== 'closed') pushCard(code, next.comp.card)
    })
  }, [upsertSession]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Re-push the whole card on regaining signal and on coming to the front. */
  var resyncOnReconnect = useCallback(function (code) {
    function push() {
      var session = currentSession(code)
      if (session && session.comp && session.comp.status !== 'closed') pushCard(code, session.comp.card)
    }
    function onVisible() { if (document.visibilityState === 'visible') push() }
    window.addEventListener('online', push)
    document.addEventListener('visibilitychange', onVisible)
    return function () {
      window.removeEventListener('online', push)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  var sorted = useMemo(function () { return sortRefs(mine, now().slice(0, 10)) }, [mine])

  return {
    mine: sorted,
    draft: draft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    openEntries: openEntries,
    save: save,
    setStatus: setStatus,
    setEnd: setEnd,
    voidProblem: voidProblem,
    amendProblem: amendProblem,
    remove: remove,
    remember: remember,
    removeRef: removeRef,
    enter: enter,
    act: act,
    syncFromComp: syncFromComp,
    catchUpClosed: catchUpClosed,
    watchVoids: watchVoids,
    resyncOnReconnect: resyncOnReconnect,
  }
}

/** The entrant's comp session for a code, from the log — null if not entered on this account. */
export function useMySession(code) {
  var { data } = useData()
  return useMemo(function () {
    if (!code) return null
    return (data.sessions || []).filter(function (s) { return s.id === compSessionId(code) })[0] || null
  }, [data.sessions, code])
}

/** @returns {import('../lib/types').CompEntryRef} */
export function refFor(comp, role) {
  return {
    code: comp.code,
    name: comp.name,
    date: comp.date,
    venueName: (comp.venue && comp.venue.name) || '',
    role: role,
    startMs: compStartMs(comp),
    endMs: compEndMs(comp),
  }
}

function refSame(a, b) {
  return ['name', 'date', 'venueName', 'role', 'startMs', 'endMs'].every(function (k) { return (a[k] == null ? null : a[k]) === (b[k] == null ? null : b[k]) })
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

  // The stage catches up with the clock (spec §7d, BTL-B88). There is no
  // server, so an organiser's device writes it: `live` after the start,
  // `judging` after the end — at the moment if a comp screen is open then,
  // or the moment one opens afterwards. Cards do not wait for this: the
  // rules open and lock them on the stored clock. It never closes a comp.
  var startMs = comp ? compStartMs(comp) : null
  var endMs = comp ? compEndMs(comp) : null
  var compNow = useRef(null)
  compNow.current = comp
  var pending = useRef(null)
  useEffect(function () {
    if (!isOrganiser || !code) return undefined
    function run() {
      var target = catchUpStatus(compNow.current, Date.now())
      if (!target || pending.current === target) return
      pending.current = target
      Storage.setCompStatus(code, target).catch(function (err) {
        console.warn('Stage catch-up failed:', code, err.message)
        pending.current = null
      })
    }
    run()
    var t = Date.now()
    var next = [startMs, endMs].filter(function (x) { return x !== null && x > t })
    if (!next.length) return undefined
    var id = setTimeout(run, Math.min(Math.min.apply(null, next) - t + 500, 2147483647))
    return function () { clearTimeout(id) }
  }, [isOrganiser, status, startMs, endMs, code])

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

/**
 * The comps on the Mine list as they are now — one read each, once per
 * visit, for the status on each row. A comp that cannot be read (offline,
 * deleted) is left out and its row shows no status.
 * @param {string[]} codes
 * @returns {Object<string, object>} code → comp
 */
export function useCompsNow(codes) {
  var key = (codes || []).join(',')
  var [byCode, setByCode] = useState({})
  useEffect(function () {
    if (!key) return undefined
    var cancelled = false
    Promise.all(key.split(',').map(function (c) {
      return Storage.getComp(c).catch(function () { return null })
    })).then(function (list) {
      if (cancelled) return
      var map = {}
      list.forEach(function (comp) { if (comp && comp.code) map[comp.code] = comp })
      setByCode(map)
    })
    return function () { cancelled = true }
  }, [key])
  return byCode
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
