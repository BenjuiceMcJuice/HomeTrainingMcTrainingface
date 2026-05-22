import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import useSessions from '../../hooks/useSessions'
import NumericStepper from '../ui/NumericStepper'
import { now as tsNow } from '../../lib/storage'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var ACTIVITIES = [
  { key: 'swim',  label: 'Swim'  },
  { key: 'run',   label: 'Run'   },
  { key: 'cycle', label: 'Cycle' },
  { key: 'row',   label: 'Row'   },
  { key: 'walk',  label: 'Walk'  },
  { key: 'yoga',  label: 'Yoga'  },
  { key: 'other', label: 'Other' },
]

var DIFFICULTY_LABELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
var DIFFICULTY_FILL   = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }

var POOL_LENGTHS = [
  { value: 25,   label: '25 m' },
  { value: 33,   label: '33 m' },
  { value: 50,   label: '50 m' },
  { value: null, label: 'Other' },
]

// Default unit per activity
var DEFAULT_UNIT = {
  swim:  'lengths',
  run:   'km',
  cycle: 'km',
  row:   'm',
  walk:  'km',
}

// Activities that show the quantity/unit row by default
var SHOWS_QUANTITY = { swim: true, run: true, cycle: true, row: true }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// CardioLogSheet
// ---------------------------------------------------------------------------

/**
 * Bottom sheet for logging a cardio session.
 * @param {{ open: boolean, onClose: () => void, onSaved: () => void }} props
 */
export default function CardioLogSheet({ open, onClose, onSaved }) {
  const { addSession } = useSessions()

  var [activity,      setActivity]      = useState('swim')
  var [customLabel,   setCustomLabel]   = useState('')
  var [durationMins,  setDurationMins]  = useState(30)
  var [quantity,      setQuantity]      = useState('')
  var [unit,          setUnit]          = useState('lengths')
  var [showQuantity,  setShowQuantity]  = useState(true)
  var [poolLength,    setPoolLength]    = useState(25)
  var [customPool,    setCustomPool]    = useState('')
  var [difficulty,    setDifficulty]    = useState(null)
  var [notes,         setNotes]         = useState('')
  var [date,          setDate]          = useState(todayISO)
  var [error,         setError]         = useState(null)

  // Reset form when sheet opens
  useEffect(function () {
    if (!open) return
    setActivity('swim')
    setCustomLabel('')
    setDurationMins(30)
    setQuantity('')
    setUnit('lengths')
    setShowQuantity(true)
    setPoolLength(25)
    setCustomPool('')
    setDifficulty(null)
    setNotes('')
    setDate(todayISO())
    setError(null)
  }, [open])

  // When activity changes, update unit default and quantity visibility
  function handleActivityChange(key) {
    setActivity(key)
    setUnit(DEFAULT_UNIT[key] || 'km')
    setShowQuantity(!!SHOWS_QUANTITY[key])
    setQuantity('')
    setError(null)
  }

  function handleSave() {
    if (!difficulty) {
      setError('Select an effort level to save')
      return
    }

    var parsedQty       = quantity !== '' ? parseFloat(quantity) : null
    var resolvedPool    = activity === 'swim'
      ? (poolLength !== null ? poolLength : (parseFloat(customPool) || null))
      : null

    addSession({
      date:              date || todayISO(),
      type:              'cardio',
      discipline:        null,
      difficulty:        difficulty,
      notes:             notes,
      cardioActivity:    activity,
      cardioLabel:       activity === 'other' ? (customLabel.trim() || null) : null,
      cardioDurationMins: durationMins,
      cardioQuantity:    parsedQty,
      cardioUnit:        (showQuantity && parsedQty !== null) ? unit : null,
      cardioPoolLength:  resolvedPool,
    })

    onSaved()
    onClose()
  }

  if (!open) return null

  var resolvedPoolLength = poolLength !== null ? poolLength : (parseFloat(customPool) || null)
  var derivedMetres = (
    activity === 'swim' &&
    quantity !== '' &&
    unit === 'lengths' &&
    resolvedPoolLength
  ) ? Math.round(parseFloat(quantity) * resolvedPoolLength) : null

  var accent = '#0d9488'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className="relative bg-white rounded-t-2xl flex flex-col"
        style={{ maxHeight: '100dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7ef] shrink-0">
          <p
            className="font-black text-[#1a1d2e]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}
          >
            Log Cardio
          </p>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-4 py-4 flex flex-col gap-4">

          {/* Activity chips */}
          <div>
            <p className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2"
               style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Activity
            </p>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map(function (a) {
                var active = activity === a.key
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={function () { handleActivityChange(a.key) }}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                    style={active
                      ? { background: accent, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }
                      : { background: '#f4f5f9', color: '#7a8299', fontFamily: "'Barlow Condensed', sans-serif" }
                    }
                  >
                    {a.label}
                  </button>
                )
              })}
            </div>
            {activity === 'other' && (
              <input
                value={customLabel}
                onChange={function (e) { setCustomLabel(e.target.value) }}
                placeholder="Activity name…"
                className="mt-2 w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none transition-colors"
                style={{ '--tw-ring-color': accent }}
              />
            )}
          </div>

          {/* Duration */}
          <div>
            <p className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2"
               style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Duration (min)
            </p>
            <NumericStepper value={durationMins} min={5} max={300} step={5} onChange={setDurationMins} />
          </div>

          {/* Quantity + unit row */}
          {activity !== 'yoga' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest"
                   style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {activity === 'swim' ? 'Lengths' : 'Distance'} <span className="normal-case font-normal">(optional)</span>
                </p>
                {!SHOWS_QUANTITY[activity] && (
                  <button
                    type="button"
                    onClick={function () { setShowQuantity(!showQuantity) }}
                    className="text-[10px] font-bold transition-colors"
                    style={{ color: showQuantity ? accent : '#bbbcc8', fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {showQuantity ? 'Hide' : '+ Add'}
                  </button>
                )}
              </div>
              {showQuantity && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={quantity}
                    onChange={function (e) { setQuantity(e.target.value) }}
                    placeholder="0"
                    min="0"
                    step={activity === 'run' || activity === 'cycle' ? '0.1' : '1'}
                    className="w-24 px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] text-center placeholder:text-[#bbbcc8] focus:outline-none transition-colors"
                  />
                  <select
                    value={unit}
                    onChange={function (e) { setUnit(e.target.value) }}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white focus:outline-none appearance-none transition-colors"
                  >
                    {activity === 'swim'  && <option value="lengths">lengths</option>}
                    {activity !== 'swim'  && <option value="km">km</option>}
                    {activity !== 'swim'  && <option value="miles">miles</option>}
                    {activity === 'row'   && <option value="m">m</option>}
                    <option value="laps">laps</option>
                  </select>
                  {/* Derived distance badge */}
                  {derivedMetres !== null && (
                    <span
                      className="shrink-0 flex items-center px-2.5 rounded-xl text-xs font-bold"
                      style={{ background: '#ecfdf5', color: accent, fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      {derivedMetres >= 1000
                        ? (derivedMetres / 1000).toFixed(1) + ' km'
                        : derivedMetres + ' m'}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pool length — swim only */}
          {activity === 'swim' && (
            <div>
              <p className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2"
                 style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Pool length
              </p>
              <div className="flex gap-2">
                {POOL_LENGTHS.map(function (pl) {
                  var active = poolLength === pl.value
                  return (
                    <button
                      key={pl.label}
                      type="button"
                      onClick={function () { setPoolLength(pl.value) }}
                      className="flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-colors"
                      style={active
                        ? { background: accent, borderColor: accent, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }
                        : { background: '#f8f9fc', borderColor: '#e5e7ef', color: '#7a8299', fontFamily: "'Barlow Condensed', sans-serif" }
                      }
                    >
                      {pl.label}
                    </button>
                  )
                })}
              </div>
              {poolLength === null && (
                <input
                  type="number"
                  value={customPool}
                  onChange={function (e) { setCustomPool(e.target.value) }}
                  placeholder="Pool length in metres"
                  min="1"
                  className="mt-2 w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none transition-colors"
                />
              )}
            </div>
          )}

        </div>

        {/* Sticky footer */}
        <div
          className="shrink-0 border-t border-[#e5e7ef] bg-white px-4 pt-3 pb-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {/* Difficulty */}
          <div className="mb-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(function (n) {
                var active = difficulty === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={function () { setDifficulty(n); setError(null) }}
                    className="flex-1 py-1.5 rounded-lg border-2 transition-colors"
                    style={active
                      ? { background: DIFFICULTY_FILL[n], borderColor: DIFFICULTY_FILL[n], color: '#fff' }
                      : { background: '#f8f9fc', borderColor: '#e5e7ef', color: '#7a8299' }
                    }
                  >
                    <span
                      className="text-[11px] font-bold leading-none"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      {DIFFICULTY_LABELS[n - 1]}
                    </span>
                  </button>
                )
              })}
            </div>
            {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
          </div>

          {/* Notes + Date */}
          <div className="flex gap-2 mb-2">
            <input
              value={notes}
              onChange={function (e) { setNotes(e.target.value) }}
              placeholder="Notes… (stroke, route, conditions)"
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-xs text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#0d9488] transition-colors"
            />
            <input
              type="date"
              value={date}
              onChange={function (e) { setDate(e.target.value) }}
              className="shrink-0 px-2 py-1.5 rounded-lg border border-[#e5e7ef] text-xs text-[#7a8299] focus:outline-none focus:border-[#0d9488] transition-colors"
            />
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-2.5 rounded-xl text-white font-bold transition-opacity"
            style={{
              background: accent,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   '15px',
              opacity:    difficulty ? 1 : 0.45,
            }}
          >
            Save Session
          </button>
        </div>
      </div>
    </div>
  )
}
