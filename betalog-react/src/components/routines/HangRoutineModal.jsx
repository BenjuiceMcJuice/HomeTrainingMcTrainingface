import { useState, useEffect } from 'react'
import { X, Pencil } from 'lucide-react'
import { uuid } from '../../lib/storage'
import NumericStepper from '../ui/NumericStepper'
import ConfirmDialog from '../ui/ConfirmDialog'

// ---------------------------------------------------------------------------
// Constants — mirrored from original index.html
// ---------------------------------------------------------------------------

export const FINGERS_OPTS = [
  '4 Finger',
  'Front 3',
  'Back 3',
  'Front 2',
  'Middle 2',
  'Ring/Pinky 2',
  'Mono Index',
  'Mono Middle',
  'Mono Ring',
  'Pinch',
]

export const GRIP_TYPE_OPTS = [
  { value: 'open-hand',  label: 'Open Hand' },
  { value: 'half-crimp', label: 'Half Crimp' },
  { value: 'full-crimp', label: 'Full Crimp' },
  { value: 'drag',       label: 'Drag' },
]

export const EDGE_OPTS = [
  { value: '',             label: '—' },
  { value: '8mm',          label: '8mm' },
  { value: '10mm',         label: '10mm' },
  { value: '12mm',         label: '12mm' },
  { value: '15mm',         label: '15mm' },
  { value: '18mm',         label: '18mm' },
  { value: '20mm',         label: '20mm' },
  { value: '25mm',         label: '25mm' },
  { value: '35mm',         label: '35mm' },
  { value: '40mm',         label: '40mm' },
  { value: 'Sloper',       label: 'Sloper' },
  { value: 'Jug',          label: 'Jug' },
  { value: 'Pinch',        label: 'Pinch' },
  { value: 'Campus rung',  label: 'Campus rung' },
]

const inputCls  = 'w-full px-2 py-1.5 rounded-lg border border-[#e5e7ef] text-sm text-center text-[#1a1d2e] focus:outline-none focus:border-[#8b5cf6] transition-colors'
const selectCls = 'w-full px-2 py-2 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white focus:outline-none focus:border-[#8b5cf6] appearance-none transition-colors'

export const HANG_WEIGHT = {
  assisted: [-40, -30, -20, -15, -10, -7.5, -5, -2.5],
  added:    [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 25, 30, 40, 50],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function gripDisplayName(fingers, gripType, edgeSize) {
  var gt = GRIP_TYPE_OPTS.find(function (g) { return g.value === gripType })
  var gtLabel = gt ? gt.label : gripType
  var parts = []
  if (fingers)  parts.push(fingers)
  if (gripType) parts.push(gtLabel)
  if (edgeSize) parts.push(edgeSize)
  return parts.join(' · ') || ''
}

export function defaultGrip() {
  return {
    id:         uuid(),
    fingers:    '4 Finger',
    gripType:   'half-crimp',
    grip:       'half-crimp',           // legacy field — kept for storage compat
    edgeSize:   '30mm',
    gripName:   '4 Finger · Half Crimp · 30mm',
    activeSecs: 7,
    restSecs:   3,
    setRest:    180,
    reps:       6,
    sets:       3,
    weightMode: 'bodyweight',
    weightKg:   0,
  }
}

// ---------------------------------------------------------------------------
// GripCard — single grip row with expandable editor
// ---------------------------------------------------------------------------

function GripCard({ grip, expanded, onToggle, onChange, onRemove }) {
  var displayName = grip.gripName || gripDisplayName(grip.fingers, grip.gripType, grip.edgeSize)
  var wkg         = grip.weightKg || 0
  var weightStr   = wkg === 0 ? '' : wkg > 0 ? ' · +' + wkg + 'kg' : ' · ' + wkg + 'kg'
  var summary     = grip.sets + '×' + grip.reps + ' · ' + grip.activeSecs + 's on / ' + grip.restSecs + 's rest' + weightStr + (grip.edgeSize ? ' · ' + grip.edgeSize : '')

  function update(field, val) {
    if (field === 'fingers' || field === 'gripType' || field === 'edgeSize') {
      var fingers  = field === 'fingers'  ? val : grip.fingers
      var gripType = field === 'gripType' ? val : grip.gripType
      var edgeSize = field === 'edgeSize' ? val : (grip.edgeSize || '')
      var name     = gripDisplayName(fingers, gripType, edgeSize)
      onChange('fingers',  fingers)
      onChange('gripType', gripType)
      onChange('grip',     gripType)   // legacy
      onChange('edgeSize', edgeSize)
      onChange('gripName', name)
    } else {
      onChange(field, val)
    }
  }

  return (
    <div className="border-b border-[#f0f1f5] last:border-0">
      {/* Summary row */}
      <div className="flex items-center gap-2 px-3 py-3">
        <button onClick={onToggle} className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-[#1a1d2e] truncate">{displayName}</p>
          <p className="text-xs text-[#7a8299] mt-0.5">{summary}</p>
        </button>
        <button
          onClick={onRemove}
          className="p-1 rounded-lg text-[#bbbcc8] hover:text-[#e11d48] hover:bg-[#fff5f5] transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2">

          {/* Fingers + Grip type */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Fingers</p>
              <select
                value={grip.fingers || '4 Finger'}
                onChange={function (e) { update('fingers', e.target.value) }}
                className={selectCls}
              >
                {FINGERS_OPTS.map(function (f) {
                  return <option key={f} value={f}>{f}</option>
                })}
              </select>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Grip</p>
              <select
                value={grip.gripType || 'half-crimp'}
                onChange={function (e) { update('gripType', e.target.value) }}
                className={selectCls}
              >
                {GRIP_TYPE_OPTS.map(function (g) {
                  return <option key={g.value} value={g.value}>{g.label}</option>
                })}
              </select>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Edge</p>
              <select
                value={grip.edgeSize || ''}
                onChange={function (e) { update('edgeSize', e.target.value) }}
                className={selectCls}
              >
                {EDGE_OPTS.map(function (e) {
                  return <option key={e.value} value={e.value}>{e.label}</option>
                })}
              </select>
            </div>
          </div>

          {/* Hang / Rest */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Hang (s)</p>
              <NumericStepper value={grip.activeSecs} min={1} max={60}  step={1}
                onChange={function (n) { onChange('activeSecs', n) }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Rest (s)</p>
              <NumericStepper value={grip.restSecs}   min={1} max={120} step={1}
                onChange={function (n) { onChange('restSecs', n) }} />
            </div>
          </div>

          {/* Sets / Reps / Set rest */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Sets</p>
              <NumericStepper value={grip.sets}    min={1} max={20}  step={1}
                onChange={function (n) { onChange('sets', n) }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Reps</p>
              <NumericStepper value={grip.reps}    min={1} max={20}  step={1}
                onChange={function (n) { onChange('reps', n) }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Set rest</p>
              <NumericStepper value={grip.setRest} min={15} max={600} step={15}
                onChange={function (n) { onChange('setRest', n) }} />
            </div>
          </div>

          {/* Weight */}
          <div>
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Weight</p>
            <select
              value={grip.weightKg || 0}
              onChange={function (e) { onChange('weightKg', Number(e.target.value)) }}
              className={selectCls + ' text-center'}
            >
              <optgroup label="Assisted (pulley)">
                {HANG_WEIGHT.assisted.map(function (v) {
                  return <option key={v} value={v}>{v} kg</option>
                })}
              </optgroup>
              <optgroup label="Bodyweight">
                <option value={0}>BW</option>
              </optgroup>
              <optgroup label="Added weight">
                {HANG_WEIGHT.added.map(function (v) {
                  return <option key={v} value={v}>+{v} kg</option>
                })}
              </optgroup>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HangRoutineModal
// ---------------------------------------------------------------------------

export default function HangRoutineModal({ routine, onSave, onDelete, onClose }) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [grips,       setGrips]       = useState([])
  const [expanded,    setExpanded]    = useState(null)
  const [error,       setError]       = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  var isNew      = !routine
  var isDefault  = !isNew && routine.id && routine.id.startsWith('dr-')

  useEffect(function () {
    if (routine) {
      setName(routine.name || '')
      setDescription(routine.description || '')
      setEditingDesc(false)
      setGrips((routine.grips || []).map(function (g) { return Object.assign({}, g) }))
      setExpanded(null)
    } else {
      var g = defaultGrip()
      setName('')
      setDescription('')
      setEditingDesc(false)
      setGrips([g])
      setExpanded(g.id)
    }
    setError(null)
  }, [routine])

  function addGrip() {
    var g = defaultGrip()
    setGrips(function (prev) { return prev.concat([g]) })
    setExpanded(g.id)
  }

  function updateGrip(id, field, val) {
    setGrips(function (prev) {
      return prev.map(function (g) {
        if (g.id !== id) return g
        return Object.assign({}, g, { [field]: val })
      })
    })
  }

  function removeGrip(id) {
    setGrips(function (prev) { return prev.filter(function (g) { return g.id !== id }) })
    if (expanded === id) setExpanded(null)
  }

  function handleSave() {
    if (!name.trim())  { setError('Give this routine a name'); return }
    if (!grips.length) { setError('Add at least one grip'); return }
    onSave({ name: name.trim(), description: description.trim(), type: 'hangboard', grips: grips, exercises: [] })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#e5e7ef] shrink-0">
          <p className="font-black text-[#1a1d2e]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}>
            {isNew ? 'New Hang Routine' : 'Edit Hang Routine'}
          </p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-4">
          {/* Name */}
          <input
            value={name}
            onChange={function (e) { setName(e.target.value) }}
            placeholder="Routine name"
            className="w-full px-3 py-2.5 rounded-xl border border-[#e5e7ef] text-sm font-semibold text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#8b5cf6] mb-2 transition-colors"
          />
          {/* Description — shown for existing routines above grips */}
          {!isNew && (
            editingDesc ? (
              <div className="mb-4">
                <textarea
                  value={description}
                  onChange={function (e) { setDescription(e.target.value) }}
                  placeholder="What is this routine for?"
                  rows={3}
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl border border-[#8b5cf6] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none resize-none"
                />
                <button
                  onClick={function () { setEditingDesc(false) }}
                  className="mt-1 text-xs font-semibold"
                  style={{ color: '#8b5cf6' }}
                >Done</button>
              </div>
            ) : description ? (
              <div className="relative mb-4 px-3 py-3 rounded-xl border-l-4" style={{ background: '#f5eeff', borderLeftColor: '#8b5cf6' }}>
                <p className="text-xs leading-relaxed pr-6" style={{ color: '#6d28d9' }}>{description}</p>
                <button
                  onClick={function () { setEditingDesc(true) }}
                  className="absolute top-2 right-2 p-1 rounded-lg transition-colors hover:bg-[#ede0ff]"
                  style={{ color: '#8b5cf6' }}
                >
                  <Pencil size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={function () { setEditingDesc(true) }}
                className="w-full text-left text-xs mb-4 transition-colors"
                style={{ color: '#bbbcc8' }}
                onMouseOver={function (e) { e.currentTarget.style.color = '#8b5cf6' }}
                onMouseOut={function  (e) { e.currentTarget.style.color = '#bbbcc8' }}
              >+ Add description</button>
            )
          )}

          <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Grips
          </p>

          <div className="bg-white rounded-2xl border border-[#e5e7ef] overflow-hidden mb-3">
            {grips.length === 0 && (
              <div className="px-4 py-3 text-sm text-[#bbbcc8] text-center">No grips yet</div>
            )}
            {grips.map(function (g) {
              return (
                <GripCard
                  key={g.id}
                  grip={g}
                  expanded={expanded === g.id}
                  onToggle={function () {
                    setExpanded(function (prev) { return prev === g.id ? null : g.id })
                  }}
                  onChange={function (field, val) { updateGrip(g.id, field, val) }}
                  onRemove={function () { removeGrip(g.id) }}
                />
              )
            })}
            <button
              onClick={addGrip}
              className="w-full px-4 py-3 text-sm font-semibold text-[#8b5cf6] hover:bg-[#f5eeff] transition-colors text-left border-t border-[#e5e7ef]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              + Add grip
            </button>
          </div>

          {/* Description — shown at bottom for new routines */}
          {isNew && (
            <div>
              <p className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-wide mb-1"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Description (optional)</p>
              <textarea
                value={description}
                onChange={function (e) { setDescription(e.target.value) }}
                placeholder="What is this routine for?"
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#8b5cf6] resize-none transition-colors"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-white font-bold mb-3"
            style={{ background: '#8b5cf6', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px' }}
          >
            {isNew ? 'Create Routine' : 'Save Routine'}
          </button>

          {!isNew && !isDefault && (
            <button
              onClick={function () { setConfirmOpen(true) }}
              className="w-full py-2 rounded-xl text-[#e11d48] text-sm font-semibold border border-[#fee2e2] hover:bg-[#fff5f5] transition-colors"
            >
              Delete routine
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete routine?"
        message="This hang routine will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={function () { onDelete(routine.id) }}
        onCancel={function () { setConfirmOpen(false) }}
      />
    </div>
  )
}
