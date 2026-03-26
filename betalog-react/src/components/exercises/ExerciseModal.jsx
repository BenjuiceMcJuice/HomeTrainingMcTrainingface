import { useState, useEffect } from 'react'
import { X, Youtube, RotateCcw, Pencil } from 'lucide-react'
import DEFAULT_EXERCISES from '../../lib/defaultExercises'
import NumericStepper from '../ui/NumericStepper'
import ConfirmDialog from '../ui/ConfirmDialog'

const CATEGORIES = [
  { value: 'chest',     label: 'Chest',     color: '#4f7ef8' },
  { value: 'back',      label: 'Back',      color: '#d4742a' },
  { value: 'shoulders', label: 'Shoulders', color: '#8b5cf6' },
  { value: 'arms',      label: 'Arms',      color: '#2a9d5c' },
  { value: 'legs',      label: 'Legs',      color: '#e11d48' },
  { value: 'core',      label: 'Core',      color: '#0891b2' },
  { value: 'mobility',  label: 'Mobility',  color: '#d97706' },
  { value: 'cardio',    label: 'Cardio',    color: '#dc2626' },
  { value: 'other',     label: 'Other',     color: '#7a8299' },
]

const MOVEMENT_PATTERNS = [
  { value: '',           label: 'None',     bg: '#f4f5f9', color: '#7a8299' },
  { value: 'push',       label: 'Push',     bg: '#eef1ff', color: '#4f7ef8' },
  { value: 'pull',       label: 'Pull',     bg: '#fff4ec', color: '#d4742a' },
  { value: 'hinge',      label: 'Hinge',    bg: '#edfaf2', color: '#2a9d5c' },
  { value: 'squat',      label: 'Squat',    bg: '#f5eeff', color: '#8b5cf6' },
  { value: 'carry',      label: 'Carry',    bg: '#fffbeb', color: '#d97706' },
  { value: 'rotation',   label: 'Rotation', bg: '#ecfeff', color: '#0891b2' },
  { value: 'isometric',  label: 'Iso',      bg: '#fff1f2', color: '#e11d48' },
  { value: 'stretch',    label: 'Stretch',  bg: '#f0fdfa', color: '#0d9488' },
]

const EQUIPMENT = [
  { value: '',        label: 'None' },
  { value: 'bw',      label: 'Bodyweight' },
  { value: 'db',      label: 'Dumbbells' },
  { value: 'bb',      label: 'Barbell' },
  { value: 'kb',      label: 'Kettlebell' },
  { value: 'band',    label: 'Band' },
  { value: 'cable',   label: 'Cable' },
  { value: 'machine', label: 'Machine' },
  { value: 'other',   label: 'Other' },
]

const EMPTY = {
  name: '',
  category: 'chest',
  movementPattern: '',
  equipment: '',
  muscles: '',
  notes: '',
  trackingType: 'reps',
  defaultSets: 3,
  defaultReps: 10,
  defaultDuration: 30,
  defaultRest: 60,
  defaultWeight: 0,
  ytSearch: '',
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-[#7a8299]">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-[#e5e7ef] bg-white px-3 py-2 text-sm text-[#1a1d2e] focus:outline-none focus:border-[#4f7ef8] transition-colors'
const selectCls = 'w-full rounded-md border px-2 py-1 text-[11px] font-bold appearance-none focus:outline-none transition-colors'
const plainSelectCls = 'w-full rounded-md border px-2 py-1 text-[11px] font-bold appearance-none focus:outline-none transition-colors'

function toFormValues(ex) {
  return {
    name:            ex.name            ?? '',
    category:        ex.category        ?? 'chest',
    movementPattern: ex.movementPattern ?? '',
    equipment:       ex.equipment       ?? '',
    muscles:         ex.muscles         ?? '',
    notes:           ex.notes           ?? '',
    trackingType:    ex.trackingType    ?? 'reps',
    defaultSets:     ex.defaultSets     ?? 3,
    defaultReps:     ex.defaultReps     ?? 10,
    defaultDuration: ex.defaultDuration ?? 30,
    defaultRest:     ex.defaultRest     ?? 60,
    defaultWeight:   ex.defaultWeight   ?? 0,
    ytSearch:        ex.ytSearch        ?? '',
  }
}

// Small coloured badge — same style as the list rows
function Badge({ children, style }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
      style={style}
    >
      {children}
    </span>
  )
}

export default function ExerciseModal({ exercise, onSave, onDelete, onClose }) {
  const isNew = !exercise
  const defaultVersion = exercise
    ? DEFAULT_EXERCISES.find(function (d) { return d.id === exercise.id }) ?? null
    : null

  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(isNew)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setForm(exercise ? toFormValues(exercise) : EMPTY)
    setEditing(!exercise)  // new = straight to edit; existing = read-only first
  }, [exercise])

  function set(field, value) {
    setForm(function (prev) { return Object.assign({}, prev, { [field]: value }) })
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave({
      ...form,
      name:              form.name.trim(),
      movementPattern:   form.movementPattern || null,
      equipment:         form.equipment       || null,
      defaultSets:       Number(form.defaultSets),
      defaultReps:       Number(form.defaultReps),
      defaultDuration:   Number(form.defaultDuration),
      defaultRest:       Number(form.defaultRest),
      defaultWeight:     Number(form.defaultWeight) || 0,
    })
  }

  function handleDelete() {
    setConfirmOpen(true)
  }

  function handleReset() {
    setForm(toFormValues(defaultVersion))
  }

  // Derived display values
  var cat     = CATEGORIES.find(function (c) { return c.value === form.category }) || CATEGORIES[CATEGORIES.length - 1]
  var pat     = form.movementPattern ? MOVEMENT_PATTERNS.find(function (p) { return p.value === form.movementPattern }) : null
  var equip   = form.equipment ? EQUIPMENT.find(function (e) { return e.value === form.equipment }) : null
  var trackSummary = form.trackingType === 'time'
    ? form.defaultSets + '×' + form.defaultDuration + 's · rest ' + form.defaultRest + 's'
    : form.defaultSets + '×' + form.defaultReps + ' · rest ' + form.defaultRest + 's'
  var ytUrl = 'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(form.ytSearch || ('how to ' + form.name.trim() + ' form tutorial'))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={function (e) { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7ef]">
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '30px', fontWeight: 700, color: '#1a1d2e' }}>
            {isNew ? 'New Exercise' : form.name}
          </h2>
          <div className="flex items-center gap-2">
            {!isNew && !editing && (
              <button
                onClick={function () { setEditing(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: '#eef1ff', color: '#4f7ef8' }}
              >
                <Pencil size={12} />
                Edit
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f4f5f9] text-[#7a8299]">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-4">

          {/* ── READ-ONLY VIEW ── */}
          {!editing && (
            <>
              {/* Badges row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge style={{ background: cat.color + '18', color: cat.color }}>{cat.label}</Badge>
                {equip && (
                  <Badge style={{ background: '#f0f1f5', color: '#7a8299' }}>{equip.label}</Badge>
                )}
                {pat && (
                  <Badge style={{ background: pat.bg, color: pat.color }}>{pat.label}</Badge>
                )}
                {form.muscles && (
                  <span className="text-[10px] text-[#aab0c0]">{form.muscles}</span>
                )}
              </div>

              {/* Tracking summary */}
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px', fontWeight: 700, color: '#1a1d2e', letterSpacing: '0.3px' }}>{trackSummary}</p>

              {/* Notes */}
              {form.notes && (
                <p className="text-sm text-[#4a5068] leading-relaxed">{form.notes}</p>
              )}

              {/* How to */}
              {form.name.trim() && (
                <a
                  href={ytUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold"
                  style={{ background: 'rgba(204,0,0,0.07)', color: '#cc0000', border: '1px solid rgba(204,0,0,0.15)' }}
                >
                  <Youtube size={15} />
                  How to: {form.ytSearch || 'how to ' + form.name.trim() + ' form tutorial'}
                </a>
              )}
            </>
          )}

          {/* ── EDIT VIEW ── */}
          {editing && (
            <>
              <Field label="Name *">
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={function (e) { set('name', e.target.value) }}
                  placeholder="e.g. Pull-ups"
                />
              </Field>

              {/* Reps / Time toggle */}
              <Field label="Tracking">
                <div className="flex rounded-lg overflow-hidden border border-[#e5e7ef]">
                  {['reps', 'time'].map(function (t) {
                    var active = form.trackingType === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={function () { set('trackingType', t) }}
                        className={'flex-1 py-2 text-sm font-semibold transition-colors capitalize ' + (active ? 'text-white' : 'text-[#7a8299] hover:bg-[#f4f5f9]')}
                        style={active ? { background: '#4f7ef8' } : {}}
                      >
                        {t === 'reps' ? 'Reps' : 'Time'}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Sets">
                  <NumericStepper value={form.defaultSets} min={1} max={20} step={1}
                    onChange={function (n) { set('defaultSets', n) }} />
                </Field>
                {form.trackingType === 'reps' ? (
                  <Field label="Reps">
                    <NumericStepper value={form.defaultReps} min={1} max={200} step={1}
                      onChange={function (n) { set('defaultReps', n) }} />
                  </Field>
                ) : (
                  <Field label="Duration (s)">
                    <NumericStepper value={form.defaultDuration} min={5} max={3600} step={5}
                      onChange={function (n) { set('defaultDuration', n) }} />
                  </Field>
                )}
                <Field label="Rest (s)">
                  <NumericStepper value={form.defaultRest} min={0} max={600} step={5}
                    onChange={function (n) { set('defaultRest', n) }} />
                </Field>
              </div>

              <Field label="Default Weight (kg)">
                <select
                  className={inputCls}
                  value={form.defaultWeight}
                  onChange={function (e) { set('defaultWeight', Number(e.target.value)) }}
                >
                  <optgroup label="Assisted (negative)">
                    {[-50,-40,-30,-25,-20,-15,-10,-5].map(function (v) {
                      return <option key={v} value={v}>{v} kg</option>
                    })}
                  </optgroup>
                  <optgroup label="Bodyweight">
                    <option value={0}>0 kg (bodyweight)</option>
                  </optgroup>
                  <optgroup label="Added weight">
                    {[2.5,5,7.5,10,12.5,15,17.5,20,22.5,25,30,35,40,45,50,55,60,70,80,90,100].map(function (v) {
                      return <option key={v} value={v}>+{v} kg</option>
                    })}
                  </optgroup>
                </select>
                <p className="text-xs text-[#bbbcc8] mt-1">0 = bodyweight · positive = added · negative = assisted</p>
              </Field>

              <Field label="Coaching Notes">
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={3}
                  value={form.notes}
                  onChange={function (e) { set('notes', e.target.value) }}
                  placeholder="Form cues, tips…"
                />
              </Field>

              {/* ── Metadata — compact, bottom of form ── */}
              <div className="pt-1 border-t border-[#f0f1f5]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#bbbcc8] mb-2">Classification</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-[#bbbcc8]">Category</span>
                    {(function () {
                      var c = CATEGORIES.find(function (x) { return x.value === form.category }) || CATEGORIES[0]
                      return (
                        <select className={selectCls} value={form.category}
                          onChange={function (e) { set('category', e.target.value) }}
                          style={{ background: c.color + '18', color: c.color, borderColor: c.color + '44' }}>
                          {CATEGORIES.map(function (x) { return <option key={x.value} value={x.value}>{x.label}</option> })}
                        </select>
                      )
                    })()}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-[#bbbcc8]">Movement</span>
                    {(function () {
                      var p = MOVEMENT_PATTERNS.find(function (x) { return x.value === form.movementPattern }) || MOVEMENT_PATTERNS[0]
                      return (
                        <select className={selectCls} value={form.movementPattern}
                          onChange={function (e) { set('movementPattern', e.target.value) }}
                          style={{ background: p.bg, color: p.color, borderColor: p.color + '44' }}>
                          {MOVEMENT_PATTERNS.map(function (x) { return <option key={x.value} value={x.value}>{x.label}</option> })}
                        </select>
                      )
                    })()}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-[#bbbcc8]">Equipment</span>
                    <select className={plainSelectCls} value={form.equipment}
                      onChange={function (e) { set('equipment', e.target.value) }}
                      style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}>
                      {EQUIPMENT.map(function (x) { return <option key={x.value} value={x.value}>{x.label}</option> })}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-[#bbbcc8]">Muscles</span>
                    <input
                      className="w-full rounded-md border px-2 py-1 text-xs focus:outline-none transition-colors"
                      style={{ background: '#fff', color: '#4a5068', borderColor: '#d0d3df' }}
                      value={form.muscles}
                      onChange={function (e) { set('muscles', e.target.value) }}
                      placeholder="Biceps, lats…"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#e5e7ef] flex gap-2">
          {editing && !isNew && !defaultVersion && (
            <button onClick={handleDelete}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
              Delete
            </button>
          )}
          {editing && defaultVersion && (
            <button onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
              <RotateCcw size={13} />
              Reset
            </button>
          )}
          {editing ? (
            <>
              <button onClick={function () { isNew ? onClose() : setEditing(false) }}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-[#7a8299] border border-[#e5e7ef] hover:bg-[#f4f5f9] transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={!form.name.trim()}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40"
                style={{ background: '#4f7ef8' }}>
                {isNew ? 'Add Exercise' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-[#7a8299] border border-[#e5e7ef] hover:bg-[#f4f5f9] transition-colors">
              Close
            </button>
          )}
        </div>

      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${form.name}"?`}
        message="This exercise will be removed from your library."
        confirmLabel="Delete"
        danger
        onConfirm={function () { onDelete(exercise.id) }}
        onCancel={function () { setConfirmOpen(false) }}
      />
    </div>
  )
}
