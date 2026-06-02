import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import useSessions from '../../hooks/useSessions'
import useWeightLog from '../../hooks/useWeightLog'
import NumericStepper from '../ui/NumericStepper'
import { getMETRange, estimateCalories, getPaceMET, SPORT_MET_VALUES } from '../../lib/stats'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var ACTIVITIES = [
  { key: 'swim',  label: 'Swim'  },
  { key: 'walk',  label: 'Walk'  },
  { key: 'run',   label: 'Run'   },
  { key: 'cycle', label: 'Cycle' },
  { key: 'sport', label: 'Sport' },
  { key: 'other', label: 'Other' },
]

var DIFFICULTY_LABELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
var DIFFICULTY_FILL   = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }

var STROKE_TYPES = [
  { key: 'general',      label: 'General' },
  { key: 'breaststroke', label: 'Breaststroke' },
  { key: 'front_crawl',  label: 'Front Crawl' },
  { key: 'backstroke',   label: 'Backstroke' },
  { key: 'butterfly',    label: 'Butterfly' },
]

var POOL_LENGTHS = [
  { value: 25,   label: '25 m' },
  { value: 33,   label: '33 m' },
  { value: 50,   label: '50 m' },
  { value: null, label: 'Other' },
]

// Default unit per activity
var DEFAULT_UNIT = {
  swim:  'lengths',
  run:   'miles',
  cycle: 'miles',
  walk:  'miles',
}

// Activities that show the quantity/unit row by default
var SHOWS_QUANTITY = { swim: true, run: true, cycle: true, walk: true }

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
 * Bottom sheet for logging or editing a cardio session.
 * Pass `initialSession` to open in edit mode.
 * @param {{ open: boolean, onClose: () => void, onSaved: () => void, initialSession?: object }} props
 */
export default function CardioLogSheet({ open, onClose, onSaved, initialSession, initialActivity }) {
  const { addSession, updateSession } = useSessions()
  var { entries: weightEntries } = useWeightLog()

  var isEdit = !!initialSession

  var [activity,      setActivity]      = useState(null)
  var [customLabel,   setCustomLabel]   = useState('')
  var [sportKey,      setSportKey]      = useState(null)
  var [sportSearch,   setSportSearch]   = useState('')
  var [strokeType,    setStrokeType]    = useState('general')
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

  // Reset / pre-fill form when sheet opens
  useEffect(function () {
    if (!open) return
    if (initialSession) {
      var act  = initialSession.cardioActivity || 'swim'
      var pool = initialSession.cardioPoolLength
      var knownPools = [25, 33, 50]
      setActivity(act)
      setCustomLabel(act === 'other' ? (initialSession.cardioLabel || '') : '')
      setSportKey(initialSession.cardioSportKey || null)
      setSportSearch('')
      setStrokeType(initialSession.cardioStrokeType || 'general')
      setDurationMins(initialSession.cardioDurationMins || 30)
      setQuantity(initialSession.cardioQuantity != null ? String(initialSession.cardioQuantity) : '')
      setUnit(initialSession.cardioUnit || DEFAULT_UNIT[act] || 'km')
      setShowQuantity(initialSession.cardioQuantity != null || !!SHOWS_QUANTITY[act])
      setPoolLength(knownPools.indexOf(pool) !== -1 ? pool : (pool ? null : 25))
      setCustomPool(knownPools.indexOf(pool) === -1 && pool ? String(pool) : '')
      setDifficulty(initialSession.difficulty || null)
      setNotes(initialSession.notes || '')
      setDate(initialSession.date || todayISO())
    } else {
      act = initialActivity || null
      setActivity(act)
      setCustomLabel('')
      setSportKey(null)
      setSportSearch('')
      setStrokeType('general')
      setDurationMins(30)
      setQuantity('')
      setUnit(act ? (DEFAULT_UNIT[act] || 'miles') : '')
      setShowQuantity(act ? !!SHOWS_QUANTITY[act] : false)
      setPoolLength(25)
      setCustomPool('')
      setDifficulty(null)
      setNotes('')
      setDate(todayISO())
    }
    setError(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: form resets on open only, not on prop changes

  function handleSave() {
    if (!activity) {
      setError('Select an activity')
      return
    }
    if (activity === 'sport' && !sportKey) {
      setError('Select a sport')
      return
    }
    if (!difficulty) {
      setError('Select an effort level to save')
      return
    }

    var rawQty          = quantity !== '' ? parseFloat(quantity) : null
    var parsedQty       = (rawQty !== null && !isNaN(rawQty)) ? Math.max(0, rawQty) : null
    var resolvedPool    = activity === 'swim'
      ? (poolLength !== null ? poolLength : (parseFloat(customPool) || null))
      : null

    // Calorie estimate — use pace when distance is available, else effort level
    var sessionDate = date || todayISO()
    var kcalLow = null, kcalHigh = null
    var metres = null
    if (activity === 'swim' && parsedQty && unit === 'lengths' && resolvedPool) {
      metres = Math.round(parsedQty * resolvedPool)
    } else if (activity === 'swim' && parsedQty && unit === 'm') {
      metres = parsedQty
    } else if (parsedQty && unit === 'km') {
      metres = parsedQty * 1000
    } else if (parsedQty && unit === 'm') {
      metres = parsedQty
    } else if (parsedQty && unit === 'miles') {
      metres = Math.round(parsedQty * 1609.34)
    }
    var metRange = (metres && durationMins)
      ? getPaceMET(activity, activity === 'swim' ? strokeType : null, metres, durationMins)
      : getMETRange(activity, activity === 'swim' ? strokeType : null, difficulty, activity === 'sport' ? sportKey : null)
    if (metRange && durationMins) {
      var sorted = (weightEntries || []).slice().sort(function (a, b) {
        return b.date > a.date ? 1 : -1
      })
      for (var wi = 0; wi < sorted.length; wi++) {
        if (sorted[wi].date <= sessionDate) {
          var kcalEst = estimateCalories(metRange, sorted[wi].weight, durationMins)
          kcalLow  = kcalEst.low
          kcalHigh = kcalEst.high
          break
        }
      }
    }

    var sessionData = {
      date:              sessionDate,
      type:              'cardio',
      discipline:        null,
      difficulty:        difficulty,
      notes:             notes,
      cardioActivity:    activity,
      cardioSportKey:    activity === 'sport' ? sportKey : null,
      cardioLabel:       activity === 'other' ? (customLabel.trim() || null)
                       : activity === 'sport' ? (sportKey || null)
                       : null,
      cardioDurationMins: durationMins,
      cardioQuantity:    parsedQty,
      cardioUnit:        (showQuantity && parsedQty !== null) ? unit : null,
      cardioPoolLength:  resolvedPool,
      cardioStrokeType:  activity === 'swim' ? strokeType : null,
      cardioKcalLow:     kcalLow,
      cardioKcalHigh:    kcalHigh,
    }

    if (isEdit) {
      updateSession(initialSession.id, sessionData)
    } else {
      addSession(sessionData)
    }

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
  var inPickerMode = activity === 'sport' && !sportKey

  return (
    <div className={`fixed inset-0 z-50 flex flex-col${inPickerMode ? '' : ' justify-end'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className={`relative bg-white flex flex-col${inPickerMode ? '' : ' rounded-t-2xl'}`}
        style={inPickerMode ? { flex: 1 } : { maxHeight: '100dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7ef] shrink-0">
          <p
            className="font-black text-[#1a1d2e]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}
          >
            {(isEdit ? 'Edit ' : 'Log ') + (activity === 'sport' ? (sportKey || 'Sport') : (ACTIVITIES.find(function (a) { return a.key === activity }) || {}).label || 'Cardio')}
          </p>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* "Other" label input */}
        {activity === 'other' && (
          <div className="shrink-0 px-4 pt-3 pb-3 border-b border-[#e5e7ef]">
            <input
              value={customLabel}
              onChange={function (e) { setCustomLabel(e.target.value) }}
              placeholder="Activity name…"
              className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none transition-colors"
              style={{ '--tw-ring-color': accent }}
            />
          </div>
        )}

        {/* Sport picker — takes full body when no sport chosen yet */}
        {inPickerMode && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 shrink-0">
              <input
                type="text"
                value={sportSearch}
                onChange={function (e) { setSportSearch(e.target.value) }}
                placeholder="Search sports…"
                autoFocus
                className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none transition-colors"
              />
            </div>
            <div className="overflow-y-auto flex-1 border-t border-[#f0f1f5]">
              {Object.keys(SPORT_MET_VALUES)
                .filter(function (k) {
                  return !sportSearch || k.toLowerCase().indexOf(sportSearch.toLowerCase()) !== -1
                })
                .map(function (k) {
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={function () { setSportKey(k); setSportSearch(''); setError(null) }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f4f5f9] border-b border-[#f0f1f5] last:border-0 text-left transition-colors"
                    >
                      <span
                        className="text-sm font-semibold text-[#1a1d2e]"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                      >{k}</span>
                      <span className="text-xs text-[#bbbcc8]">MET {SPORT_MET_VALUES[k]}</span>
                    </button>
                  )
                })
              }
              {Object.keys(SPORT_MET_VALUES).filter(function (k) {
                return !sportSearch || k.toLowerCase().indexOf(sportSearch.toLowerCase()) !== -1
              }).length === 0 && (
                <p className="text-sm text-[#7a8299] text-center py-8">No sports found.</p>
              )}
            </div>
          </div>
        )}

        {/* Scrollable body — shown when activity is set and not in sport-picker mode */}
        {activity && !inPickerMode && (
        <div className="overflow-y-auto px-4 py-4 flex flex-col gap-4">

          {/* Selected sport badge + Change button */}
          {activity === 'sport' && sportKey && (
            <div className="flex items-center justify-between">
              <span
                className="px-3 py-1.5 rounded-full text-sm font-bold"
                style={{ background: accent, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}
              >{sportKey}</span>
              <button
                type="button"
                onClick={function () { setSportKey(null); setSportSearch('') }}
                className="text-xs font-bold text-[#7a8299] hover:text-[#1a1d2e] transition-colors"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >Change</button>
            </div>
          )}

          {/* Duration */}
          <div>
            <p className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2"
               style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Duration (min)
            </p>
            <NumericStepper value={durationMins} min={5} max={300} step={5} onChange={setDurationMins} />
          </div>

          {/* Quantity + unit row */}
          {activity !== 'sport' && (
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
                    {activity !== 'swim'  && <option value="miles">miles</option>}
                    {activity !== 'swim'  && <option value="km">km</option>}
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

          {/* Stroke type — swim only */}
          {activity === 'swim' && (
            <div>
              <p className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2"
                 style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Stroke
              </p>
              <div className="flex flex-wrap gap-2">
                {STROKE_TYPES.map(function (s) {
                  var active = strokeType === s.key
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={function () { setStrokeType(s.key) }}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                      style={active
                        ? { background: accent, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }
                        : { background: '#f4f5f9', color: '#7a8299', fontFamily: "'Barlow Condensed', sans-serif" }
                      }
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
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
        )}

        {/* Sticky footer — hidden during sport picker */}
        {activity && !inPickerMode && <div
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
              opacity:    activity && difficulty ? 1 : 0.45,
            }}
          >
            {isEdit ? 'Save Changes' : 'Save Session'}
          </button>
        </div>}

      </div>
    </div>
  )
}
