import { useState, useEffect, useRef } from 'react'
import { X, Check } from 'lucide-react'
import { useData } from '../../App'
import useSessions from '../../hooks/useSessions'
import { now as tsNow, uuid } from '../../lib/storage'
import { gymExercises } from '../../lib/sessions'
import NumericStepper from '../ui/NumericStepper'
import Layer from '../ui/Layer'
import { SessionFeel, SessionDateRow } from './SessionFooter'
import { FEEL_NEEDED, saveLabel } from '../../lib/sessionFeel'
import useDiscardGuard from '../../hooks/useDiscardGuard'
import ConfirmDialog from '../ui/ConfirmDialog'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


const WEIGHT_OPTIONS = {
  assisted: [-50,-40,-30,-25,-20,-15,-10,-5],
  added:    [2.5,5,7.5,10,12.5,15,17.5,20,22.5,25,30,35,40,45,50,55,60,70,80,90,100],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayLabel(date) {
  var d = date ? new Date(date + 'T12:00:00') : new Date()
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Build an array of set objects pre-filled with defaults.
 * @param {number} numSets
 * @param {number} defaultReps  — reps or seconds depending on trackingType
 * @param {number} defaultWeight
 */
function buildDefaultSets(numSets, defaultReps, defaultWeight) {
  return Array.from({ length: numSets }, function () {
    return { reps: defaultReps, weight: defaultWeight }
  })
}

// ---------------------------------------------------------------------------
// ExerciseCard
// ---------------------------------------------------------------------------

function ExerciseCard({ card, cardIdx, onUpdateSet, onToggleDone, onAddSet, onRemoveSet }) {
  var showDone = !!onToggleDone
  var done     = !!card.done
  return (
    <div
      className="bg-white rounded-xl border transition-all"
      style={{
        borderColor: done ? '#2a9d5c' : '#e5e7ef',
        opacity:     done ? 0.6 : 1,
      }}
    >
      {/* Card header */}
      <div className="px-3 py-1.5 bg-[#f8f9fc] border-b border-[#e5e7ef] flex items-center gap-2">
        {showDone && (
          <button
            type="button"
            onClick={function () { onToggleDone(cardIdx) }}
            aria-label={done ? 'Mark as not done' : 'Mark as done'}
            className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors"
            style={done
              ? { background: '#2a9d5c', borderColor: '#2a9d5c' }
              : { background: '#fff', borderColor: '#bbbcc8' }
            }
          >
            {done && <Check size={10} color="#fff" strokeWidth={3} />}
          </button>
        )}
        <p
          className="text-xs font-semibold text-[#1a1d2e]"
          style={done ? { textDecoration: 'line-through', textDecorationColor: '#2a9d5c' } : undefined}
        >
          {card.name}
        </p>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 pt-1 pb-0.5 text-[9px] font-bold text-[#bbbcc8] uppercase tracking-wide">
        <span className="w-7 text-center shrink-0">Set</span>
        <span className="w-2/5 text-center shrink-0">{card.trackingType === 'time' ? 'Secs' : 'Reps'}</span>
        <span className="flex-1 text-center">Weight</span>
      </div>

      {/* Set rows */}
      <div className="px-3 pb-1.5">
        {card.sets.map(function (s, si) {
          return (
            <div key={si} className="flex items-center gap-2 py-1 border-t border-[#f0f1f5] first:border-0">
              <span className="w-7 text-xs font-bold text-[#7a8299] text-center shrink-0">{si + 1}</span>
              <div className="w-2/5 shrink-0">
                <NumericStepper
                  value={s.reps}
                  min={0}
                  max={999}
                  step={1}
                  onChange={function (n) { onUpdateSet(cardIdx, si, 'reps', n) }}
                />
              </div>
              <div className="flex-1">
                <select
                  value={s.weight}
                  onChange={function (e) { onUpdateSet(cardIdx, si, 'weight', Number(e.target.value)) }}
                  className="w-full px-2 py-1.5 rounded-lg border border-[#e5e7ef] bg-white text-sm text-[#1a1d2e] focus:outline-none focus:border-[#4f7ef8] transition-colors appearance-none text-center"
                >
                  <optgroup label="Assisted (negative)">
                    {WEIGHT_OPTIONS.assisted.map(function (v) {
                      return <option key={v} value={v}>{v} kg</option>
                    })}
                  </optgroup>
                  <optgroup label="Bodyweight">
                    <option value={0}>BW</option>
                  </optgroup>
                  <optgroup label="Added weight">
                    {WEIGHT_OPTIONS.added.map(function (v) {
                      return <option key={v} value={v}>+{v} kg</option>
                    })}
                  </optgroup>
                </select>
              </div>
            </div>
          )
        })}

        {/* Add / remove set buttons */}
        <div className="flex gap-1.5 mt-1.5 pt-1.5 border-t border-[#f0f1f5]">
          <button
            type="button"
            onClick={function () { onAddSet(cardIdx) }}
            className="flex-1 py-1 rounded-lg text-[11px] font-bold transition-colors"
            style={{ background: '#eef2fe', color: '#4f7ef8', fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            + Set
          </button>
          {card.sets.length > 1 && (
            <button
              type="button"
              onClick={function () { onRemoveSet(cardIdx) }}
              className="flex-1 py-1 rounded-lg text-[11px] font-bold transition-colors"
              style={{ background: '#fef2f2', color: '#ef4444', fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              − Set
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GymLogSheet
// ---------------------------------------------------------------------------

/**
 * Bottom sheet for logging or editing a gym session.
 *
 * Add mode:  pass `source` — { type: 'routine' | 'exercise', id: string }
 * Edit mode: pass `initialSession` — an existing Session object; source is ignored
 *
 * `live` (Log › Train, BTL-B154 — the climb logger's model, BTL-B76): the
 * session is written on the first change and on every change after, with
 * `endedAt: null`, so it is an open session the Train tab and the Dashboard
 * offer to continue. Closing the sheet loses nothing and asks nothing. The
 * button is *Done*, which needs a feel and stamps `endedAt`. Opening and
 * closing without touching anything writes nothing. With `initialSession`
 * and `live`, the open session is continued. Without `live` (History's edit
 * sheet) it is change-then-commit as before, and closing asks before
 * discarding.
 *
 * `initialSession` must be a snapshot taken when the sheet opens, not a live
 * lookup: the sheet re-seeds whenever it changes.
 *
 * @param {{ source: { type: 'routine' | 'exercise', id: string } | null, open: boolean, onClose: () => void, onSaved: () => void, initialSession?: import('../../lib/types').Session | null, live?: boolean, askFeel?: boolean }} props
 */
export default function GymLogSheet({ source, open, onClose, onSaved, initialSession, live, askFeel }) {
  const { data } = useData()
  const { addSession, updateSession, deleteSession } = useSessions()

  const [sourceName, setSourceName] = useState('')
  const [cards, setCards]           = useState([])
  const [difficulty, setDifficulty] = useState(null)
  const [notes, setNotes]           = useState('')
  const [date, setDate]             = useState('')
  const [error, setError]           = useState(null)
  const [saved, setSaved]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Live: nothing is asked on close, because nothing is lost.
  var guard = useDiscardGuard(open, onClose)
  var requestClose = live ? onClose : guard.requestClose

  // Live saving. `savedId` is the session this sheet writes to — the one being
  // continued, or the one minted on the first change. `touched` stays false
  // until the person changes something, so seeding the cards on open is never
  // mistaken for a change and an untouched sheet writes nothing.
  var savedId = useRef(null)
  var touched = useRef(false)

  // Rebuild cards whenever the sheet opens
  useEffect(function () {
    if (!open) return

    setError(askFeel && !(initialSession && initialSession.difficulty) ? FEEL_NEEDED : null)
    savedId.current = live && initialSession ? initialSession.id : null
    touched.current = false
    setSaved(!!savedId.current)
    setConfirmDelete(false)

    // --- Edit mode: pre-populate from existing session ---
    if (initialSession) {
      setSourceName(
        initialSession.routineName ||
        (initialSession.exercises.length > 0 ? initialSession.exercises[0].name : 'Session')
      )
      setDifficulty(initialSession.difficulty || null)
      setNotes(initialSession.notes || '')
      setDate(initialSession.date || new Date().toISOString().slice(0, 10))

      var exerciseMap = {}
      data.exercises.forEach(function (e) { exerciseMap[e.id] = e })

      setCards(initialSession.exercises.map(function (se) {
        var ex           = exerciseMap[se.exerciseId]
        var trackingType = se.trackingType || (ex ? ex.trackingType : 'reps') || 'reps'
        return {
          exerciseId:   se.exerciseId,
          name:         se.name,
          trackingType: trackingType,
          sets:         se.sets.map(function (s) { return { reps: s.reps, weight: s.weight } }),
          done:         se.done !== false,  // legacy sessions default to done
        }
      }))
      return
    }

    // --- Add mode: build from source ---
    if (!source) return

    setDifficulty(null)
    setNotes('')
    setDate(new Date().toISOString().slice(0, 10))

    if (source.type === 'routine') {
      const routine = data.routines.find(function (r) { return r.id === source.id })
      if (!routine) return
      setSourceName(routine.name)

      const exerciseMap = {}
      data.exercises.forEach(function (e) { exerciseMap[e.id] = e })

      const newCards = routine.exercises.map(function (re) {
        const ex          = exerciseMap[re.exerciseId] || null
        const trackingType = re.trackingType || (ex ? ex.trackingType : 'reps') || 'reps'
        const numSets      = re.targetSets    || (ex ? ex.defaultSets     : 3)  || 3
        const defaultReps  = trackingType === 'time'
          ? (re.targetDuration || (ex ? ex.defaultDuration : 30) || 30)
          : (re.targetReps     || (ex ? ex.defaultReps     : 10) || 10)
        const defaultWeight = (re.targetWeight != null) ? re.targetWeight
                              : (ex ? (ex.defaultWeight || 0) : 0)

        return {
          exerciseId:   re.exerciseId,
          name:         re.name || (ex ? ex.name : ''),
          trackingType: trackingType,
          sets:         buildDefaultSets(numSets, defaultReps, defaultWeight),
          done:         false,
        }
      })
      setCards(newCards)

    } else if (source.type === 'exercise') {
      const ex = data.exercises.find(function (e) { return e.id === source.id })
      if (!ex) return
      setSourceName(ex.name)

      const trackingType  = ex.trackingType  || 'reps'
      const defaultReps   = trackingType === 'time'
        ? (ex.defaultDuration || 30)
        : (ex.defaultReps     || 10)
      const defaultWeight = ex.defaultWeight || 0
      const numSets       = ex.defaultSets   || 3

      setCards([{
        exerciseId:   ex.id,
        name:         ex.name,
        trackingType: trackingType,
        sets:         buildDefaultSets(numSets, defaultReps, defaultWeight),
      }])
    }
  }, [open, source, initialSession])  // eslint-disable-line react-hooks/exhaustive-deps

  var isRoutine   = !!(source && source.type === 'routine') ||
                    !!(initialSession && initialSession.routineId)

  // One effect reads the whole form and writes it (live only), the same shape
  // as the climb logger's, so a tick made while a note is typed can never be
  // overwritten by an older copy of the form.
  useEffect(function () {
    if (!live || !open || !touched.current || !cards.length) return
    var fields = {
      date:       date || tsNow().slice(0, 10),
      difficulty: difficulty || null,
      notes:      notes,
      exercises:  gymExercises(cards, isRoutine, false),
    }
    if (savedId.current) { updateSession(savedId.current, fields); return }
    var id = uuid()
    addSession(Object.assign({
      id:          id,
      type:        'gym',
      discipline:  null,
      routineId:   source && source.type === 'routine' ? source.id  : null,
      routineName: source && source.type === 'routine' ? sourceName : null,
      climbs:      [],
      hangGrips:   [],
      endedAt:     null,
    }, fields))
    savedId.current = id
    setSaved(true)
  }, [live, cards, difficulty, notes, date]) // eslint-disable-line react-hooks/exhaustive-deps -- writes on form changes only

  function touch() { touched.current = true }

  function updateSet(cardIdx, setIdx, field, rawValue) {
    touch()
    const value = typeof rawValue === 'number' ? rawValue : (rawValue === '' ? 0 : Number(rawValue))
    setCards(function (prev) {
      return prev.map(function (card, ci) {
        if (ci !== cardIdx) return card
        return Object.assign({}, card, {
          sets: card.sets.map(function (s, si) {
            if (si !== setIdx) return s
            return Object.assign({}, s, { [field]: value })
          }),
        })
      })
    })
  }

  function addSet(cardIdx) {
    touch()
    setCards(function (prev) {
      return prev.map(function (card, ci) {
        if (ci !== cardIdx) return card
        var last = card.sets[card.sets.length - 1]
        var newSet = last ? Object.assign({}, last) : { reps: 0, weight: 0 }
        return Object.assign({}, card, { sets: card.sets.concat([newSet]) })
      })
    })
  }

  function removeSet(cardIdx) {
    touch()
    setCards(function (prev) {
      return prev.map(function (card, ci) {
        if (ci !== cardIdx || card.sets.length <= 1) return card
        return Object.assign({}, card, { sets: card.sets.slice(0, -1) })
      })
    })
  }

  function toggleDone(cardIdx) {
    touch()
    setCards(function (prev) {
      return prev.map(function (card, ci) {
        if (ci !== cardIdx) return card
        return Object.assign({}, card, { done: !card.done })
      })
    })
  }

  function markAllDone() {
    touch()
    setCards(function (prev) {
      return prev.map(function (card) { return Object.assign({}, card, { done: true }) })
    })
  }

  var doneCount   = cards.filter(function (c) { return c.done }).length
  var totalCount  = cards.length
  var allDone     = totalCount > 0 && doneCount === totalCount

  // Done (live): everything is already written; this finishes the session.
  // Like a climb session, it does not close without a feel (BTL-B109) — it
  // stays open, saved, until one is picked.
  function handleDone() {
    if (!difficulty) { setError(FEEL_NEEDED); return }
    var fields = {
      date:       date || tsNow().slice(0, 10),
      difficulty: difficulty,
      notes:      notes,
      exercises:  gymExercises(cards, isRoutine, true),
      endedAt:    tsNow(),
    }
    if (savedId.current) {
      updateSession(savedId.current, fields)
    } else {
      addSession(Object.assign({
        type:        'gym',
        discipline:  null,
        routineId:   source && source.type === 'routine' ? source.id  : null,
        routineName: source && source.type === 'routine' ? sourceName : null,
        climbs:      [],
        hangGrips:   [],
      }, fields))
    }
    savedId.current = null
    onSaved()
    onClose()
  }

  // Live: the open session is in the log, so throwing it away is a delete.
  function handleDelete() {
    if (savedId.current) deleteSession(savedId.current)
    savedId.current = null
    setConfirmDelete(false)
    onClose()
  }

  function handleSave() {
    if (!difficulty) {
      setError(FEEL_NEEDED)
      return
    }

    // Non-routine (single-exercise) logs always count as done.
    // Routine logs persist the user's tick state — unticked = skipped.
    // Exception: if the user didn't tick *anything*, treat it as "just logged normally"
    // and save every exercise as done. Ticking even one exercise opts into explicit tracking.
    const savedExercises = gymExercises(cards, isRoutine, true)

    if (initialSession) {
      // Edit mode — patch the existing session
      updateSession(initialSession.id, {
        date:       date,
        difficulty: difficulty,
        notes:      notes,
        exercises:  savedExercises,
      })
    } else {
      // Add mode — create new session
      const ts = tsNow()
      addSession({
        date:        date || ts.slice(0, 10),
        type:        'gym',
        discipline:  null,
        routineId:   source && source.type === 'routine' ? source.id   : null,
        routineName: source && source.type === 'routine' ? sourceName  : null,
        difficulty:  difficulty,
        notes:       notes,
        exercises:   savedExercises,
        climbs:      [],
        hangGrips:   [],
      })
    }

    onSaved()
    guard.close()
  }

  if (!open) return null

  return (
    <Layer>
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={requestClose}
      />

      {/* Sheet — grows to fit content, caps at full height when many exercises */}
      <div
        className="relative bg-white rounded-t-2xl flex flex-col"
        style={{ maxHeight: '100dvh' }}
        {...guard.guardProps}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7ef] shrink-0">
          <div>
            <p
              className="font-black text-[#1a1d2e]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}
            >
              {sourceName}
            </p>
            <p className="text-xs text-[#7a8299] mt-0.5">
              {dayLabel(date)}
              {isRoutine && totalCount > 0 && (
                <span
                  className="ml-2 font-bold"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: doneCount === totalCount ? '#2a9d5c' : '#4f7ef8',
                  }}
                >
                  · {doneCount}/{totalCount} done
                </span>
              )}
            </p>
          </div>
          <button
            data-guard="skip"
            onClick={requestClose}
            className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Exercise cards — scrollable */}
        <div className="overflow-y-auto px-4 py-2 flex flex-col gap-2">
          {cards.map(function (card, ci) {
            return (
              <ExerciseCard
                key={card.exerciseId + '-' + ci}
                card={card}
                cardIdx={ci}
                onUpdateSet={updateSet}
                onToggleDone={isRoutine ? toggleDone : null}
                onAddSet={addSet}
                onRemoveSet={removeSet}
              />
            )
          })}

          {/* Mark all done — only when routine and not already all ticked */}
          {isRoutine && totalCount > 0 && !allDone && (
            <button
              type="button"
              onClick={markAllDone}
              className="mt-1 py-1.5 rounded-lg border border-dashed border-[#2a9d5c] text-[11px] font-bold text-[#2a9d5c] hover:bg-[#edfaf2] transition-colors"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              ✓ Mark all done
            </button>
          )}
        </div>

        {/* Sticky footer — compact to maximise scroll space for exercises */}
        <div className="shrink-0 border-t border-[#e5e7ef] bg-white px-4 pt-3 pb-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>

          <SessionFeel value={difficulty} onChange={function (n) { touch(); setDifficulty(n); setError(null) }} />
          {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}

          <input
            value={notes}
            onChange={function (e) { touch(); setNotes(e.target.value) }}
            placeholder="Anything to note about this session..."
            className="w-full mt-2 px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-xs text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors"
          />
          <div className="mt-2 mb-2">
            <SessionDateRow value={date} onChange={function (d) { touch(); setDate(d) }} />
          </div>

          {live && (
            <div className="flex items-center justify-between gap-3 mb-2 min-h-[16px]">
              <p className="text-[11px] text-[#7a8299]">
                {saved
                  ? 'Saved as you go' + (difficulty ? '' : ' · no feel yet') + ' — close any time'
                  : 'Saves as soon as you change anything'}
              </p>
              {saved && (
                <button
                  type="button"
                  onClick={function () { setConfirmDelete(true) }}
                  className="text-[11px] font-bold text-[#e11d48] shrink-0"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Delete session
                </button>
              )}
            </div>
          )}

          <button
            data-guard="skip"
            onClick={live ? handleDone : handleSave}
            className="w-full py-2.5 rounded-xl text-white font-bold transition-opacity"
            style={{
              background:  '#4f7ef8',
              fontFamily:  "'Barlow Condensed', sans-serif",
              fontSize:    '15px',
              opacity:     difficulty ? 1 : 0.45,
            }}
          >
            {live ? 'Done' : saveLabel(!!initialSession)}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={guard.asking}
        title={initialSession ? 'Discard your changes?' : 'Discard this session?'}
        message={initialSession ? 'The session stays as it was.' : 'Nothing has been saved yet.'}
        confirmLabel="Discard"
        danger
        onConfirm={guard.close}
        onCancel={guard.keepEditing}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this session?"
        message="It is already in your log — this removes it."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={function () { setConfirmDelete(false) }}
      />
    </div>
    </Layer>
  )
}
