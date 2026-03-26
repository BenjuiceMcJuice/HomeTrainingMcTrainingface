import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useData } from '../../App'
import useSessions from '../../hooks/useSessions'
import { now as tsNow } from '../../lib/storage'
import NumericStepper from '../ui/NumericStepper'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
const DIFFICULTY_FILL   = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }

const WEIGHT_OPTIONS = {
  assisted: [-50,-40,-30,-25,-20,-15,-10,-5],
  added:    [2.5,5,7.5,10,12.5,15,17.5,20,22.5,25,30,35,40,45,50,55,60,70,80,90,100],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
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

function ExerciseCard({ card, cardIdx, onUpdateSet }) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e7ef] overflow-hidden">
      {/* Card header */}
      <div className="px-3 py-2.5 bg-[#f8f9fc] border-b border-[#e5e7ef]">
        <p className="text-sm font-semibold text-[#1a1d2e]">{card.name}</p>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1 text-[10px] font-bold text-[#bbbcc8] uppercase tracking-wide">
        <span className="w-7 text-center shrink-0">Set</span>
        <span className="w-2/5 text-center shrink-0">{card.trackingType === 'time' ? 'Secs' : 'Reps'}</span>
        <span className="flex-1 text-center">Weight</span>
      </div>

      {/* Set rows */}
      <div className="px-3 pb-2">
        {card.sets.map(function (s, si) {
          return (
            <div key={si} className="flex items-center gap-2 py-1.5 border-t border-[#f0f1f5] first:border-0">
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
 * @param {{ source: { type: 'routine' | 'exercise', id: string } | null, open: boolean, onClose: () => void, onSaved: () => void, initialSession?: import('../../lib/types').Session | null }} props
 */
export default function GymLogSheet({ source, open, onClose, onSaved, initialSession }) {
  const { data } = useData()
  const { addSession, updateSession } = useSessions()

  const [sourceName, setSourceName] = useState('')
  const [cards, setCards]           = useState([])
  const [difficulty, setDifficulty] = useState(null)
  const [notes, setNotes]           = useState('')
  const [date, setDate]             = useState('')
  const [error, setError]           = useState(null)

  // Rebuild cards whenever the sheet opens
  useEffect(function () {
    if (!open) return

    setError(null)

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

  function updateSet(cardIdx, setIdx, field, rawValue) {
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

  function handleSave() {
    if (!difficulty) {
      setError('Select an effort level to save')
      return
    }

    const savedExercises = cards.map(function (card) {
      return {
        exerciseId:   card.exerciseId,
        name:         card.name,
        trackingType: card.trackingType,
        sets:         card.sets.map(function (s) {
          return { reps: s.reps, weight: s.weight, rir: null, done: true }
        }),
      }
    })

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
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative bg-white rounded-t-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#e5e7ef] shrink-0">
          <div>
            <p
              className="font-black text-[#1a1d2e]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}
            >
              {sourceName}
            </p>
            <p className="text-xs text-[#7a8299] mt-0.5">{todayLabel()}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Exercise cards — scrollable */}
        <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-3">
          {cards.map(function (card, ci) {
            return (
              <ExerciseCard
                key={card.exerciseId + '-' + ci}
                card={card}
                cardIdx={ci}
                onUpdateSet={updateSet}
              />
            )
          })}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-[#e5e7ef] bg-white px-4 pt-4 pb-6">

          {/* Difficulty selector */}
          <div className="mb-3">
            <p
              className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              How was it?
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(function (n) {
                const active = difficulty === n
                return (
                  <button
                    key={n}
                    onClick={function () { setDifficulty(n); setError(null) }}
                    className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition-colors"
                    style={active
                      ? { background: DIFFICULTY_FILL[n], borderColor: DIFFICULTY_FILL[n], color: '#fff' }
                      : { background: '#f8f9fc', borderColor: '#e5e7ef', color: '#7a8299' }
                    }
                  >
                    <span
                      className="text-sm font-bold leading-none"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      {n}
                    </span>
                    <span className="text-[9px] font-semibold leading-tight text-center">
                      {DIFFICULTY_LABELS[n - 1]}
                    </span>
                  </button>
                )
              })}
            </div>
            {error && (
              <p className="text-xs text-red-500 mt-1.5">{error}</p>
            )}
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={function (e) { setNotes(e.target.value) }}
            placeholder="Anything to note about this session..."
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] resize-none mb-3 transition-colors"
          />

          {/* Date */}
          <div className="flex items-center justify-between px-1 mb-3">
            <span className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Session date
            </span>
            <input
              type="date"
              value={date}
              onChange={function (e) { setDate(e.target.value) }}
              className="text-xs text-[#7a8299] border-0 bg-transparent focus:outline-none focus:text-[#1a1d2e] transition-colors"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-white font-bold transition-opacity"
            style={{
              background:  '#4f7ef8',
              fontFamily:  "'Barlow Condensed', sans-serif",
              fontSize:    '16px',
              opacity:     difficulty ? 1 : 0.45,
            }}
          >
            {initialSession ? 'Update Session' : 'Save Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
