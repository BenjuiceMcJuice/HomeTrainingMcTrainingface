import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import useSessions from '../../hooks/useSessions'
import { uuid } from '../../lib/storage'
import NumericStepper from '../ui/NumericStepper'
import {
  FINGERS_OPTS, GRIP_TYPE_OPTS, EDGE_OPTS,
  gripDisplayName, HANG_WEIGHT,
} from '../routines/HangRoutineModal'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
const DIFFICULTY_FILL   = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }

var labelCls  = 'text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5'
var selectCls = 'w-full px-2 py-2 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white focus:outline-none focus:border-[#8b5cf6] appearance-none transition-colors'

// ---------------------------------------------------------------------------
// GripRow — inline editing of a single grip
// ---------------------------------------------------------------------------

function GripRow({ grip, onUpdate, onRemove }) {
  return (
    <div className="bg-[#f8f9fc] rounded-xl border border-[#e5e7ef] px-3 py-3">
      {/* Grip name header + remove */}
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-sm font-semibold text-[#1a1d2e]">{grip.gripName || grip.grip}</p>
        <button
          onClick={onRemove}
          className="p-1 rounded-lg text-[#bbbcc8] hover:text-[#e11d48] hover:bg-[#fff5f5] transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Fingers / Grip / Edge — 3-col */}
      <div className="flex gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Fingers</p>
          <select
            value={grip.fingers || '4 Finger'}
            onChange={function (e) {
              var f = e.target.value
              onUpdate({ fingers: f, gripName: gripDisplayName(f, grip.gripType || grip.grip, grip.edgeSize) })
            }}
            className={selectCls}
          >
            {FINGERS_OPTS.map(function (f) { return <option key={f} value={f}>{f}</option> })}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Grip</p>
          <select
            value={grip.gripType || grip.grip || 'half-crimp'}
            onChange={function (e) {
              var g = e.target.value
              onUpdate({ gripType: g, grip: g, gripName: gripDisplayName(grip.fingers || '4 Finger', g, grip.edgeSize) })
            }}
            className={selectCls}
          >
            {GRIP_TYPE_OPTS.map(function (g) { return <option key={g.value} value={g.value}>{g.label}</option> })}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Edge</p>
          <select
            value={grip.edgeSize || '20mm'}
            onChange={function (e) {
              var es = e.target.value
              onUpdate({ edgeSize: es, gripName: gripDisplayName(grip.fingers || '4 Finger', grip.gripType || grip.grip, es) })
            }}
            className={selectCls}
          >
            {EDGE_OPTS.map(function (o) { return <option key={o.value} value={o.value}>{o.label}</option> })}
          </select>
        </div>
      </div>

      {/* Hang / Rest — 2-col */}
      <div className="flex gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Hang (s)</p>
          <NumericStepper value={grip.activeSecs} min={1} max={60}  step={1} onChange={function (v) { onUpdate({ activeSecs: v }) }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Rest (s)</p>
          <NumericStepper value={grip.restSecs}   min={1} max={120} step={1} onChange={function (v) { onUpdate({ restSecs: v }) }} />
        </div>
      </div>

      {/* Sets / Reps — 2-col */}
      <div className="flex gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Sets</p>
          <NumericStepper value={grip.sets} min={1} max={20} step={1} onChange={function (v) { onUpdate({ sets: v }) }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Reps</p>
          <NumericStepper value={grip.reps} min={1} max={20} step={1} onChange={function (v) { onUpdate({ reps: v }) }} />
        </div>
      </div>

      {/* Weight */}
      <div>
        <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Weight</p>
        <select
          value={grip.weightKg || 0}
          onChange={function (e) {
            var w = Number(e.target.value)
            onUpdate({ weightKg: w, weightMode: w < 0 ? 'assisted' : w > 0 ? 'added' : 'bodyweight' })
          }}
          className={selectCls + ' text-center'}
        >
          <optgroup label="Assisted (pulley)">
            {HANG_WEIGHT.assisted.map(function (v) { return <option key={v} value={v}>{v} kg</option> })}
          </optgroup>
          <optgroup label="Bodyweight">
            <option value={0}>BW</option>
          </optgroup>
          <optgroup label="Added weight">
            {HANG_WEIGHT.added.map(function (v) { return <option key={v} value={v}>+{v} kg</option> })}
          </optgroup>
        </select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HangboardEditSheet
// ---------------------------------------------------------------------------

export default function HangboardEditSheet({ session, open, onClose, onSaved }) {
  const { updateSession } = useSessions()

  const [grips,      setGrips]      = useState([])
  const [difficulty,  setDifficulty]  = useState(null)
  const [notes,       setNotes]       = useState('')
  const [date,        setDate]        = useState('')
  const [error,       setError]       = useState(null)

  useEffect(function () {
    if (!open || !session) return
    setGrips((session.hangGrips || []).map(function (g) {
      return Object.assign({}, g, { _key: g.id || uuid() })
    }))
    setDifficulty(session.difficulty || null)
    setNotes(session.notes || '')
    setDate(session.date || new Date().toISOString().slice(0, 10))
    setError(null)
  }, [open, session])  // eslint-disable-line react-hooks/exhaustive-deps

  function updateGrip(idx, patch) {
    setGrips(function (prev) {
      return prev.map(function (g, i) {
        if (i !== idx) return g
        return Object.assign({}, g, patch)
      })
    })
  }

  function removeGrip(idx) {
    setGrips(function (prev) { return prev.filter(function (_, i) { return i !== idx }) })
  }

  function addGrip() {
    setGrips(function (prev) {
      return prev.concat([{
        _key:       uuid(),
        id:         uuid(),
        fingers:    '4 Finger',
        gripType:   'half-crimp',
        grip:       'half-crimp',
        edgeSize:   '20mm',
        gripName:   gripDisplayName('4 Finger', 'half-crimp', '20mm'),
        activeSecs: 10,
        restSecs:   5,
        sets:       3,
        reps:       6,
        setRest:    120,
        weightKg:   0,
        weightMode: 'bodyweight',
      }])
    })
  }

  function handleSave() {
    if (!grips.length) { setError('Add at least one grip'); return }
    if (!difficulty)   { setError('Select a session feel'); return }

    var cleanGrips = grips.map(function (g) {
      var out = Object.assign({}, g)
      delete out._key
      return out
    })

    updateSession(session.id, {
      date:       date,
      difficulty: difficulty,
      notes:      notes,
      hangGrips:  cleanGrips,
    })
    onSaved()
    onClose()
  }

  if (!open || !session) return null

  var canSave = grips.length > 0 && !!difficulty

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#e5e7ef] shrink-0">
          <p className="font-black text-[#1a1d2e]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}>
            Edit Session
          </p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 py-4">

          {/* Grip cards */}
          <div className="flex flex-col gap-3 mb-3">
            {grips.map(function (grip, i) {
              return (
                <GripRow
                  key={grip._key}
                  grip={grip}
                  onUpdate={function (patch) { updateGrip(i, patch) }}
                  onRemove={function () { removeGrip(i) }}
                />
              )
            })}
          </div>

          {/* Add grip button */}
          <button
            onClick={addGrip}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-[#8b5cf6] border border-[#e5e7ef] hover:bg-[#f5eeff] transition-colors text-left mb-4"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            + Add grip
          </button>

          {/* Session feel */}
          <div className="mb-3">
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Session feel
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(function (n) {
                var active = difficulty === n
                return (
                  <button key={n}
                    onClick={function () { setDifficulty(n); setError(null) }}
                    className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition-colors"
                    style={active
                      ? { background: DIFFICULTY_FILL[n], borderColor: DIFFICULTY_FILL[n], color: '#fff' }
                      : { background: '#f8f9fc', borderColor: '#e5e7ef', color: '#7a8299' }
                    }
                  >
                    <span className="text-sm font-bold leading-none"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{n}</span>
                    <span className="text-[9px] font-semibold leading-tight text-center">{DIFFICULTY_LABELS[n - 1]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={function (e) { setNotes(e.target.value) }}
            placeholder="Anything to note about this session..."
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#8b5cf6] resize-none transition-colors mb-3"
          />

          {/* Date */}
          <div className="flex items-center justify-between px-1 mb-1">
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

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-white font-bold transition-opacity mb-2"
            style={{
              background: '#8b5cf6',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   '16px',
              opacity:    canSave ? 1 : 0.45,
            }}
          >
            Update Session
          </button>

        </div>
      </div>
    </div>
  )
}
