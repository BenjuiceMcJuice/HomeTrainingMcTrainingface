import { useState, useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  KeyboardSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { X, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import ConfirmDialog from '../ui/ConfirmDialog'

const inputCls = 'w-full rounded-lg border border-[#e5e7ef] bg-white px-3 py-2 text-sm text-[#1a1d2e] focus:outline-none focus:border-[#4f7ef8] transition-colors'

const CATEGORY_CHIPS = ['all','chest','back','shoulders','arms','legs','core','mobility','cardio','other']

const PATTERN_CHIPS = [
  { value: 'all',       label: 'All',       bg: null,       color: null },
  { value: 'push',      label: 'Push',      bg: '#eef1ff',  color: '#4f7ef8' },
  { value: 'pull',      label: 'Pull',      bg: '#fff4ec',  color: '#d4742a' },
  { value: 'hinge',     label: 'Hinge',     bg: '#edfaf2',  color: '#2a9d5c' },
  { value: 'squat',     label: 'Squat',     bg: '#f5eeff',  color: '#8b5cf6' },
  { value: 'carry',     label: 'Carry',     bg: '#fffbeb',  color: '#d97706' },
  { value: 'rotation',  label: 'Rotation',  bg: '#ecfeff',  color: '#0891b2' },
  { value: 'isometric', label: 'Iso',       bg: '#fff1f2',  color: '#e11d48' },
]

// ---------------------------------------------------------------------------
// Exercise picker — searchable list with category + movement pattern filters
// ---------------------------------------------------------------------------

function FilterChips({ items, active, onSelect, colored }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto shrink-0 px-4 py-1.5" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
      {items.map(function (item) {
        var value  = typeof item === 'string' ? item : item.value
        var label  = typeof item === 'string' ? (value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)) : item.label
        var isAll  = value === 'all'
        var isActive = active === value
        var bg     = colored && !isAll && !isActive ? item.bg  : null
        var color  = colored && !isAll && !isActive ? item.color : null
        return (
          <button
            key={value}
            onClick={function () { onSelect(value) }}
            className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors"
            style={isActive
              ? { background: '#4f7ef8', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }
              : { background: bg ?? '#f4f5f9', color: color ?? '#7a8299', fontFamily: "'Barlow Condensed', sans-serif" }
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function ExercisePicker({ exercises, onAdd, onClose }) {
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('all')
  const [pattern,  setPattern]  = useState('all')

  const filtered = exercises
    .filter(function (e) {
      if (category !== 'all' && e.category !== category) return false
      if (pattern  !== 'all' && e.movementPattern !== pattern) return false
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort(function (a, b) { return a.name.localeCompare(b.name) })

  return (
    <div className="flex flex-col gap-0 h-full min-h-0">
      {/* Search */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <input
          className={inputCls}
          placeholder="Search exercises…"
          value={search}
          onChange={function (e) { setSearch(e.target.value) }}
          autoFocus
        />
      </div>

      {/* Category filter */}
      <FilterChips items={CATEGORY_CHIPS} active={category} onSelect={setCategory} colored={false} />

      {/* Movement pattern filter */}
      <FilterChips items={PATTERN_CHIPS} active={pattern} onSelect={setPattern} colored={true} />

      {/* List */}
      <div className="overflow-y-auto flex-1 border-t border-[#f0f1f5]">
        {filtered.map(function (e) {
          var pm = PATTERN_CHIPS.find(function (p) { return p.value === e.movementPattern })
          return (
            <button
              key={e.id}
              onClick={function () { onAdd(e); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f4f5f9] transition-colors text-left border-b border-[#f0f1f5] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1a1d2e] truncate">{e.name}</p>
                {e.muscles && <p className="text-xs text-[#7a8299] truncate mt-0.5">{e.muscles}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {pm && pm.value !== 'all' && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
                )}
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[#f4f5f9] text-[#7a8299] capitalize">{e.category}</span>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-[#7a8299] text-center py-8">No exercises found.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable exercise row
// ---------------------------------------------------------------------------

function ExerciseRowContent({ item, index, onChange, onRemove, isDragOverlay }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-[#f0f1f5] last:border-0 bg-white">
      <div className="flex items-center gap-2 px-3 py-3">

        {/* Drag handle + position number */}
        <div
          className="flex flex-col items-center shrink-0 gap-0.5 py-1 px-0.5 rounded touch-none"
          style={{ cursor: isDragOverlay ? 'grabbing' : 'grab' }}
          // listeners are injected by SortableExerciseRow via data-drag-handle
          data-drag-handle
        >
          <GripVertical size={16} className="text-[#c5c9d8]" />
          <span className="text-[10px] font-bold leading-none text-[#c5c9d8]">{index + 1}</span>
        </div>

        {/* Name + summary */}
        <button
          className="flex-1 min-w-0 text-left rounded-lg px-2 py-1.5 hover:bg-[#f4f5f9] transition-colors"
          onClick={function () { setExpanded(function (p) { return !p }) }}
        >
          <p className="text-sm font-semibold text-[#1a1d2e] truncate">{item.name}</p>
          <p className="text-xs text-[#7a8299] mt-0.5">
            {item.targetSets} sets
            {' × '}
            {item.trackingType === 'time'
              ? (item.targetDuration ?? 30) + 's'
              : (item.targetReps ?? 10) + ' reps'}
            {item.targetWeight > 0 ? ' · +' + item.targetWeight + 'kg'
              : item.targetWeight < 0 ? ' · ' + item.targetWeight + 'kg'
              : ''}
            {!expanded && <span className="ml-1.5 text-[#4f7ef8] font-semibold">· edit</span>}
          </p>
        </button>

        {/* Expand chevron */}
        <button
          onClick={function () { setExpanded(function (p) { return !p }) }}
          className="p-1.5 rounded-lg text-[#7a8299] hover:bg-[#f4f5f9] transition-colors shrink-0"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-[#ccc] hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Expanded inputs */}
      {expanded && (
        <div className="px-4 pb-3 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7a8299]">Sets</label>
              <input type="number" min="1" max="20" className={inputCls}
                value={item.targetSets}
                onChange={function (e) { onChange({ targetSets: Number(e.target.value) }) }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7a8299]">
                {item.trackingType === 'time' ? 'Duration (s)' : 'Reps'}
              </label>
              {item.trackingType === 'time' ? (
                <input type="number" min="1" max="3600" step="5" className={inputCls}
                  value={item.targetDuration ?? 30}
                  onChange={function (e) { onChange({ targetDuration: Number(e.target.value) }) }} />
              ) : (
                <input type="number" min="1" max="200" className={inputCls}
                  value={item.targetReps ?? 10}
                  onChange={function (e) { onChange({ targetReps: Number(e.target.value) }) }} />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7a8299]">Rest (s)</label>
              <input type="number" min="0" max="600" step="5" className={inputCls}
                value={item.targetRest ?? 60}
                onChange={function (e) { onChange({ targetRest: Number(e.target.value) }) }} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#7a8299]">Weight (kg)</label>
            <input type="number" min="-500" max="500" step="2.5" className={inputCls}
              value={item.targetWeight ?? 0}
              placeholder="0"
              onChange={function (e) { onChange({ targetWeight: Number(e.target.value) || 0 }) }} />
            <p className="text-xs text-[#bbbcc8]">0 = bodyweight · positive = added · negative = assisted</p>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableExerciseRow({ item, index, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._uid })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Attach drag listeners only to the grip handle via a wrapper div */}
      <div
        style={{ position: 'absolute', left: 0, top: 0, width: 40, height: '100%', zIndex: 2, touchAction: 'none' }}
        {...listeners}
        {...attributes}
      />
      <ExerciseRowContent
        item={item}
        index={index}
        onChange={onChange}
        onRemove={onRemove}
        isDragOverlay={false}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

let _uidCounter = 0
function nextUid() { return 're-' + (++_uidCounter) }

export default function RoutineModal({ routine, allExercises, onSave, onDelete, onClose }) {
  const isNew = !routine
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [items,       setItems]       = useState([])
  const [picking,     setPicking]     = useState(false)
  const [activeItem,  setActiveItem]  = useState(null)  // item being dragged (for overlay)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(function () {
    if (routine) {
      setName(routine.name ?? '')
      setDescription(routine.description ?? '')
      setEditingDesc(false)
      setItems((routine.exercises ?? []).slice().sort(function (a, b) { return a.order - b.order }).map(function (ex) {
        return Object.assign({ trackingType: 'reps', targetReps: 10, targetDuration: 30, targetRest: 60, targetWeight: 0 }, ex, { _uid: nextUid() })
      }))
    } else {
      setName('')
      setDescription('')
      setEditingDesc(false)
      setItems([])
    }
  }, [routine])

  function addExercise(exercise) {
    setItems(function (prev) {
      return prev.concat({
        exerciseId:     exercise.id,
        name:           exercise.name,
        trackingType:   exercise.trackingType    ?? 'reps',
        targetSets:     exercise.defaultSets     ?? 3,
        targetReps:     exercise.defaultReps     ?? 10,
        targetDuration: exercise.defaultDuration ?? 30,
        targetRest:     exercise.defaultRest     ?? 60,
        targetWeight:   exercise.defaultWeight   ?? 0,
        order:          prev.length,
        _uid:           nextUid(),
      })
    })
  }

  function updateItem(uid, fields) {
    setItems(function (prev) {
      return prev.map(function (item) {
        return item._uid === uid ? Object.assign({}, item, fields) : item
      })
    })
  }

  function removeItem(uid) {
    setItems(function (prev) {
      return prev.filter(function (item) { return item._uid !== uid })
        .map(function (item, i) { return Object.assign({}, item, { order: i }) })
    })
  }

  function handleDragStart(event) {
    var dragged = items.find(function (item) { return item._uid === event.active.id })
    setActiveItem(dragged ?? null)
  }

  function handleDragEnd(event) {
    setActiveItem(null)
    var active = event.active, over = event.over
    if (!over || active.id === over.id) return
    setItems(function (prev) {
      var oldIndex = prev.findIndex(function (item) { return item._uid === active.id })
      var newIndex = prev.findIndex(function (item) { return item._uid === over.id })
      return arrayMove(prev, oldIndex, newIndex).map(function (item, i) {
        return Object.assign({}, item, { order: i })
      })
    })
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      description: description.trim(),
      type: 'gym',
      exercises: items.map(function (item) {
        // strip the temporary _uid before persisting
        var out = Object.assign({}, item)
        delete out._uid
        return out
      }),
      grips: [],
    })
  }

  function handleDelete() {
    setConfirmOpen(true)
  }

  if (picking) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'rgba(0,0,0,0.4)' }}
      >
        {/* Tap-to-close spacer at top */}
        <div className="shrink-0 h-12 md:flex-1" onClick={function () { setPicking(false) }} />
        <div className="flex-1 min-h-0 w-full md:max-w-lg md:mx-auto bg-white rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7ef] shrink-0">
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, color: '#1a1d2e' }}>
              Add Exercise
            </h2>
            <button onClick={function () { setPicking(false) }} className="p-1 rounded-lg hover:bg-[#f4f5f9] text-[#7a8299]">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ExercisePicker
              exercises={allExercises}
              onAdd={addExercise}
              onClose={function () { setPicking(false) }}
            />
          </div>
        </div>
      </div>
    )
  }

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
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, color: '#1a1d2e' }}>
            {isNew ? 'New Routine' : 'Edit Routine'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f4f5f9] text-[#7a8299]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* Routine name */}
          <div className="px-4 py-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#7a8299] block mb-1">
              Routine Name *
            </label>
            <input
              className={inputCls}
              value={name}
              onChange={function (e) { setName(e.target.value) }}
              placeholder="e.g. Push Day, Full Body A"

            />
          </div>

          {/* Description */}
          {isNew ? (
            <div className="px-4 pb-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#7a8299] block mb-1">
                Description <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                className={inputCls + ' resize-none'}
                rows={3}
                value={description}
                onChange={function (e) { setDescription(e.target.value) }}
                placeholder="What's this routine for?"
              />
            </div>
          ) : (
            <div className="px-4 pb-4">
              {description && !editingDesc ? (
                <div className="flex gap-2 bg-[#f4f5f9] rounded-xl p-3">
                  <p className="flex-1 text-sm text-[#4a5068] leading-relaxed whitespace-pre-wrap">{description}</p>
                  <button
                    onClick={function () { setEditingDesc(true) }}
                    className="shrink-0 p-1 rounded text-[#7a8299] hover:text-[#4f7ef8] hover:bg-white transition-colors self-start"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ) : editingDesc ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className={inputCls + ' resize-none'}
                    rows={3}
                    value={description}
                    onChange={function (e) { setDescription(e.target.value) }}
      
                  />
                  <button
                    onClick={function () { setEditingDesc(false) }}
                    className="self-end text-xs font-semibold text-[#4f7ef8]"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button
                  onClick={function () { setEditingDesc(true) }}
                  className="text-xs font-semibold text-[#4f7ef8] hover:underline"
                >
                  + Add description
                </button>
              )}
            </div>
          )}

          {/* Exercise list */}
          <div className="border-t border-[#e5e7ef]">
            {items.length === 0 ? (
              <p className="text-sm text-[#7a8299] text-center py-6">No exercises yet — tap Add to build your routine.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={items.map(function (i) { return i._uid })} strategy={verticalListSortingStrategy}>
                  {items.map(function (item, i) {
                    return (
                      <SortableExerciseRow
                        key={item._uid}
                        item={item}
                        index={i}
                        onChange={function (fields) { updateItem(item._uid, fields) }}
                        onRemove={function () { removeItem(item._uid) }}
                      />
                    )
                  })}
                </SortableContext>

                <DragOverlay modifiers={[restrictToVerticalAxis]}>
                  {activeItem && (
                    <div className="shadow-xl rounded-lg overflow-hidden border border-[#e5e7ef]">
                      <ExerciseRowContent
                        item={activeItem}
                        index={items.findIndex(function (i) { return i._uid === activeItem._uid })}
                        onChange={function () {}}
                        onRemove={function () {}}
                        isDragOverlay
                      />
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          {/* Add exercise button */}
          <div className="px-4 py-3 border-t border-[#e5e7ef]">
            <button
              onClick={function () { setPicking(true) }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-[#e5e7ef] text-sm font-semibold text-[#7a8299] hover:border-[#4f7ef8] hover:text-[#4f7ef8] transition-colors"
            >
              <Plus size={16} />
              Add Exercise
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#e5e7ef] flex gap-2">
          {!isNew && (
            <button onClick={handleDelete} className="px-3 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
              Delete
            </button>
          )}
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-[#7a8299] border border-[#e5e7ef] hover:bg-[#f4f5f9] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: '#4f7ef8' }}
          >
            {isNew ? 'Create Routine' : 'Save'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${name}"?`}
        message="This routine will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={function () { onDelete(routine.id) }}
        onCancel={function () { setConfirmOpen(false) }}
      />
    </div>
  )
}
