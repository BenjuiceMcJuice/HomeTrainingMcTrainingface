import { useState } from 'react'
import { Plus, Search, Youtube, Star } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import useExercises from '../hooks/useExercises'
import useRoutines from '../hooks/useRoutines'
import useHangRoutines from '../hooks/useHangRoutines'
import ExerciseModal from '../components/exercises/ExerciseModal'
import RoutineModal from '../components/routines/RoutineModal'
import HangRoutineModal from '../components/routines/HangRoutineModal'
import ScheduleCard from '../components/routines/ScheduleCard'
import ProfileTab from '../components/profile/ProfileTab'

// ---------------------------------------------------------------------------
// Category filter config
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: 'all',       label: 'All' },
  { value: 'chest',     label: 'Chest' },
  { value: 'back',      label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms',      label: 'Arms' },
  { value: 'legs',      label: 'Legs' },
  { value: 'core',      label: 'Core' },
  { value: 'mobility',  label: 'Mobility' },
  { value: 'cardio',    label: 'Cardio' },
  { value: 'other',     label: 'Other' },
]

const EQUIPMENT_LABEL = {
  bw:      'BW',
  db:      'DB',
  bb:      'Bar',
  kb:      'KB',
  band:    'Band',
  cable:   'Cable',
  machine: 'Machine',
  other:   'Other',
}

// Movement pattern → colour
const PATTERN_META = {
  push:      { label: 'Push',     bg: '#eef1ff', color: '#4f7ef8' },
  pull:      { label: 'Pull',     bg: '#fff4ec', color: '#d4742a' },
  hinge:     { label: 'Hinge',    bg: '#edfaf2', color: '#2a9d5c' },
  squat:     { label: 'Squat',    bg: '#f5eeff', color: '#8b5cf6' },
  carry:     { label: 'Carry',    bg: '#fffbeb', color: '#d97706' },
  rotation:  { label: 'Rotation', bg: '#ecfeff', color: '#0891b2' },
  isometric: { label: 'Iso',      bg: '#fff1f2', color: '#e11d48' },
}

// Category → colour (same palette)
const CATEGORY_COLOR = {
  chest:     '#4f7ef8',
  back:      '#d4742a',
  shoulders: '#8b5cf6',
  arms:      '#2a9d5c',
  legs:      '#e11d48',
  core:      '#0891b2',
  mobility:  '#d97706',
  cardio:    '#dc2626',
  other:     '#7a8299',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
        active
          ? 'text-white'
          : 'text-[#7a8299] bg-[#f4f5f9] hover:bg-[#e8eaf2]'
      }`}
      style={active ? { background: '#4f7ef8', fontFamily: "'Barlow Condensed', sans-serif" } : { fontFamily: "'Barlow Condensed', sans-serif" }}
    >
      {children}
    </button>
  )
}

function ExerciseRow({ exercise, onEdit, onToggleFav }) {
  const equip        = EQUIPMENT_LABEL[exercise.equipment] || null
  const pattern      = exercise.movementPattern ? PATTERN_META[exercise.movementPattern] : null
  const catColor     = CATEGORY_COLOR[exercise.category] || '#7a8299'
  const catLabel     = exercise.category ? exercise.category.charAt(0).toUpperCase() + exercise.category.slice(1) : null
  const ytUrl        = 'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(exercise.ytSearch || ('how to ' + exercise.name + ' form tutorial'))

  return (
    <div
      className="flex items-center gap-2 px-4 py-3 border-b border-[#f0f1f5] last:border-0"
      style={{ borderLeft: `3px solid ${catColor}` }}
    >
      {/* Main info — tappable to edit */}
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-[#1a1d2e] truncate">
          {exercise.isFavourite && <span className="text-yellow-400 mr-1">★</span>}
          {exercise.name}
        </p>
        {/* Badges row */}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {catLabel && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: catColor + '18', color: catColor }}
            >
              {catLabel}
            </span>
          )}
          {equip && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#f0f1f5] text-[#7a8299]">
              {equip === 'BW' ? 'Bodyweight' : equip}
            </span>
          )}
          {pattern && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: pattern.bg, color: pattern.color }}
            >
              {pattern.label}
            </span>
          )}
          {exercise.muscles && (
            <span className="text-[10px] text-[#aab0c0] truncate">{exercise.muscles}</span>
          )}
        </div>
      </button>

      {/* Sets × reps */}
      <span className="text-xs text-[#bbbcc8] shrink-0">
        {exercise.trackingType === 'time'
          ? `${exercise.defaultSets}×${exercise.defaultDuration}s`
          : `${exercise.defaultSets}×${exercise.defaultReps}`}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={ytUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={function (e) { e.stopPropagation() }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
          style={{ background: 'rgba(204,0,0,0.07)', color: '#cc0000', border: '1px solid rgba(204,0,0,0.15)' }}
        >
          <Youtube size={12} />
          How to
        </a>
        <button
          onClick={function (e) { e.stopPropagation(); onToggleFav(exercise.id) }}
          className={`p-1.5 rounded-lg transition-colors ${exercise.isFavourite ? 'text-yellow-400' : 'text-[#ccc] hover:text-yellow-400'}`}
          title={exercise.isFavourite ? 'Unfavourite' : 'Favourite'}
        >
          <Star size={15} fill={exercise.isFavourite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exercises tab
// ---------------------------------------------------------------------------

function ExercisesTab() {
  const { exercises, addExercise, updateExercise, deleteExercise, toggleFavourite } = useExercises()
  const [category,     setCategory]     = useState('all')
  const [search,       setSearch]       = useState('')
  const [modal,        setModal]        = useState(null)  // null | 'new' | Exercise object

  const filtered = exercises.filter(function (e) {
    const matchCat  = category === 'all' || e.category === category
    const q = search.toLowerCase()
    const matchSearch = !search ||
      e.name.toLowerCase().includes(q) ||
      (e.movementPattern && e.movementPattern.toLowerCase().includes(q)) ||
      (e.muscles && e.muscles.toLowerCase().includes(q))
    return matchCat && matchSearch
  })

  // Favourites first, then alphabetical
  const sorted = filtered.slice().sort(function (a, b) {
    if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  function handleSave(fields) {
    if (modal === 'new') {
      addExercise(fields)
    } else {
      updateExercise(modal.id, fields)
    }
    setModal(null)
  }

  function handleDelete(id) {
    deleteExercise(id)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-0">

      {/* Tab hint */}
      <p className="px-4 pb-3 text-xs text-[#7a8299]">
        Your exercise library. Tap an exercise to view or edit it — set default sets, reps, and weight so the log sheet fills itself in.
      </p>

      {/* Search */}
      <div className="px-4 pt-3 pb-2 sticky top-[57px] md:top-[41px] bg-white z-20" style={{ borderBottom: '1px solid #f0f1f5' }}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbbcc8]" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e5e7ef] bg-[#f8f9fc] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors"
            placeholder="Search exercises…"
            value={search}
            onChange={function (e) { setSearch(e.target.value) }}
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-3">
        {CATEGORIES.map(function (c) {
          return (
            <CategoryChip key={c.value} active={category === c.value} onClick={function () { setCategory(c.value) }}>
              {c.label}
            </CategoryChip>
          )
        })}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl mx-4 overflow-hidden border border-[#e5e7ef]">
        {sorted.length === 0 ? (
          <p className="text-sm text-[#7a8299] text-center py-8">
            {search ? 'No exercises match your search.' : 'No exercises in this category.'}
          </p>
        ) : (
          sorted.map(function (e) {
            return (
              <ExerciseRow
                key={e.id}
                exercise={e}
                onEdit={function () { setModal(e) }}
                onToggleFav={toggleFavourite}
              />
            )
          })
        )}
      </div>

      <p className="text-xs text-center text-[#bbbcc8] pt-3 pb-1">{sorted.length} exercise{sorted.length !== 1 ? 's' : ''}</p>

      {/* FAB — add exercise */}
      <button
        onClick={function () { setModal('new') }}
        className="fixed bottom-28 right-4 md:bottom-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-semibold shadow-lg transition-transform active:scale-95"
        style={{ background: '#4f7ef8', fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        <Plus size={18} />
        Add Exercise
      </button>

      {/* Modal */}
      {modal !== null && (
        <ExerciseModal
          exercise={modal === 'new' ? null : modal}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={function () { setModal(null) }}
        />
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Routines tab
// ---------------------------------------------------------------------------

function routineCategorySummary(routine, exerciseMap) {
  // Walk routine exercises, look up category from library, dedupe, preserve encounter order
  var seen = []
  routine.exercises.forEach(function (re) {
    var ex = exerciseMap[re.exerciseId]
    if (ex && ex.category && seen.indexOf(ex.category) === -1) seen.push(ex.category)
  })
  return seen
}

// ---------------------------------------------------------------------------
// Shared section header
// ---------------------------------------------------------------------------

function SectionHeader({ label, color, onNew, newLabel }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-2">
      <p
        className="text-[11px] font-black uppercase tracking-widest"
        style={{ color: color, fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        {label}
      </p>
      {onNew && (
        <button
          onClick={onNew}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
          style={{ background: color + '15', color: color, fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          <Plus size={12} />
          {newLabel}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Routines tab — grouped: Training · Hanging · Climbing
// ---------------------------------------------------------------------------

function RoutinesTab() {
  const { exercises }                                                              = useExercises()
  const { routines: gymRoutines,  addRoutine: addGym,
          updateRoutine: updateGym,  deleteRoutine: deleteGym,
          toggleFavourite: toggleGymFav }                                          = useRoutines()
  const { routines: hangRoutines, addRoutine: addHang,
          updateRoutine: updateHang, deleteRoutine: deleteHang,
          toggleFavourite: toggleHangFav }                                          = useHangRoutines()

  const [gymModal,     setGymModal]     = useState(null)
  const [hangModal,    setHangModal]    = useState(null)

  var exerciseMap = {}
  exercises.forEach(function (e) { exerciseMap[e.id] = e })

  // ── gym handlers ──
  function handleGymSave(fields) {
    if (gymModal === 'new') addGym(fields); else updateGym(gymModal.id, fields)
    setGymModal(null)
  }
  function handleGymDelete(id) { deleteGym(id); setGymModal(null) }

  // ── hang handlers ──
  function handleHangSave(fields) {
    if (hangModal === 'new') addHang(fields); else updateHang(hangModal.id, fields)
    setHangModal(null)
  }
  function handleHangDelete(id) { deleteHang(id); setHangModal(null) }

  return (
    <div className="flex flex-col pb-24">

      {/* ── Schedule ── */}
      <SectionHeader label="Schedule" color="#7a8299" />
      <ScheduleCard />

      {/* ── Training ── */}
      <SectionHeader
        label="Training"
        color="#4f7ef8"
        onNew={function () { setGymModal('new') }}
        newLabel="New"
      />
      <div className="bg-white rounded-2xl mx-4 overflow-hidden border border-[#e5e7ef]">
        {gymRoutines.length === 0 ? (
          <p className="text-sm text-[#7a8299] text-center py-6">
            No training routines yet.
          </p>
        ) : (
          gymRoutines.map(function (r) {
            var categories = routineCategorySummary(r, exerciseMap)
            return (
              <div key={r.id} className="flex items-center border-b border-[#f0f1f5] last:border-0">
                <button
                  onClick={function () { setGymModal(r) }}
                  className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 hover:bg-[#f8f9fc] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1d2e] truncate">{r.name}</p>
                    {categories.length > 0 ? (
                      <p className="text-xs mt-0.5 truncate">
                        {categories.map(function (cat, i) {
                          return (
                            <span key={cat}>
                              {i > 0 && <span className="text-[#d8dae4]"> · </span>}
                              <span style={{ color: CATEGORY_COLOR[cat] ?? '#7a8299' }} className="font-semibold capitalize">{cat}</span>
                            </span>
                          )
                        })}
                        <span className="text-[#bbbcc8]"> · {r.exercises.length} ex</span>
                      </p>
                    ) : (
                      <p className="text-xs text-[#7a8299] mt-0.5">
                        {r.exercises.length} exercise{r.exercises.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  onClick={function (e) { e.stopPropagation(); toggleGymFav(r.id) }}
                  className="p-3 transition-colors"
                  style={{ color: r.isFavourite ? '#f59e0b' : '#d1d5db' }}
                >
                  <Star size={16} fill={r.isFavourite ? 'currentColor' : 'none'} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* ── Hanging ── */}
      <SectionHeader
        label="Hanging"
        color="#8b5cf6"
        onNew={function () { setHangModal('new') }}
        newLabel="New"
      />
      <div className="bg-white rounded-2xl mx-4 overflow-hidden border border-[#e5e7ef]">
        {hangRoutines.length === 0 ? (
          <p className="text-sm text-[#7a8299] text-center py-6">
            No hang routines yet.
          </p>
        ) : (
          hangRoutines.map(function (r) {
            var grips     = r.grips || []
            var totalSecs = grips.reduce(function (acc, g) {
              return acc + g.activeSecs * g.reps * g.sets
            }, 0)
            var totalMins = Math.round(totalSecs / 60)
            return (
              <div key={r.id} className="flex items-center border-b border-[#f0f1f5] last:border-0">
                <button
                  onClick={function () { setHangModal(r) }}
                  className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 hover:bg-[#f8f9fc] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1d2e] truncate">{r.name}</p>
                    <p className="text-xs text-[#7a8299] mt-0.5">
                      {grips.length} grip{grips.length !== 1 ? 's' : ''}
                      {totalMins > 0 && (' · ~' + totalMins + ' min')}
                    </p>
                    {r.description && (
                      <p className="text-xs text-[#bbbcc8] mt-0.5 truncate">{r.description}</p>
                    )}
                  </div>
                </button>
                <button
                  onClick={function (e) { e.stopPropagation(); toggleHangFav(r.id) }}
                  className="p-3 transition-colors"
                  style={{ color: r.isFavourite ? '#f59e0b' : '#d1d5db' }}
                >
                  <Star size={16} fill={r.isFavourite ? 'currentColor' : 'none'} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Modals */}
      {gymModal !== null && (
        <RoutineModal
          routine={gymModal === 'new' ? null : gymModal}
          allExercises={exercises}
          onSave={handleGymSave}
          onDelete={handleGymDelete}
          onClose={function () { setGymModal(null) }}
        />
      )}
      {hangModal !== null && (
        <HangRoutineModal
          routine={hangModal === 'new' ? null : hangModal}
          onSave={handleHangSave}
          onDelete={handleHangDelete}
          onClose={function () { setHangModal(null) }}
        />
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan page — tabbed shell
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'profile',   label: 'Profile' },
  { key: 'exercises', label: 'Exercises' },
  { key: 'routines',  label: 'Routines' },
]

// ---------------------------------------------------------------------------
// Plan page — tabbed shell
// ---------------------------------------------------------------------------

export default function Plan() {
  var [tab, setTab] = useState('profile')

  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-8">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-[#e5e7ef]">
        {TABS.map(function (t) {
          var active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={function () { setTab(t.key) }}
              className={'px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ' + (
                active
                  ? 'border-[#4f7ef8] text-[#4f7ef8]'
                  : 'border-transparent text-[#7a8299] hover:text-[#1a1d2e]'
              )}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px' }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="pt-4">
        {tab === 'exercises' && <ExercisesTab />}
        {tab === 'routines'  && <RoutinesTab />}
        {tab === 'profile'   && <ProfileTab />}
      </div>
    </div>
  )
}
