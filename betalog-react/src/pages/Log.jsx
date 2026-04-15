import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Youtube } from 'lucide-react'
import useExercises from '../hooks/useExercises'
import useRoutines from '../hooks/useRoutines'
import useHangRoutines from '../hooks/useHangRoutines'
import GymLogSheet from '../components/log/GymLogSheet'
import ClimbLogger from '../components/log/ClimbLogger'
import HangboardTimer from '../components/log/HangboardTimer'
import { FINGERS_OPTS, GRIP_TYPE_OPTS, EDGE_OPTS, gripDisplayName, defaultGrip, HANG_WEIGHT } from '../components/routines/HangRoutineModal'
import NumericStepper from '../components/ui/NumericStepper'

// ---------------------------------------------------------------------------
// Constants
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

const PATTERN_META = {
  push:      { label: 'Push',     bg: '#eef1ff', color: '#4f7ef8' },
  pull:      { label: 'Pull',     bg: '#fff4ec', color: '#d4742a' },
  hinge:     { label: 'Hinge',    bg: '#edfaf2', color: '#2a9d5c' },
  squat:     { label: 'Squat',    bg: '#f5eeff', color: '#8b5cf6' },
  carry:     { label: 'Carry',    bg: '#fffbeb', color: '#d97706' },
  rotation:  { label: 'Rotation', bg: '#ecfeff', color: '#0891b2' },
  isometric: { label: 'Iso',      bg: '#fff1f2', color: '#e11d48' },
}

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
// Shared chip component
// ---------------------------------------------------------------------------

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors"
      style={
        active
          ? { background: '#4f7ef8', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }
          : { background: '#f4f5f9', color: '#7a8299', fontFamily: "'Barlow Condensed', sans-serif" }
      }
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Routines tab
// ---------------------------------------------------------------------------

function routineCategorySummary(routine, exerciseMap) {
  var seen = []
  routine.exercises.forEach(function (re) {
    var ex = exerciseMap[re.exerciseId]
    if (ex && ex.category && seen.indexOf(ex.category) === -1) seen.push(ex.category)
  })
  return seen
}

function RoutinesTab({ onLog }) {
  const { exercises } = useExercises()
  const { routines }  = useRoutines()

  var exerciseMap = {}
  exercises.forEach(function (e) { exerciseMap[e.id] = e })

  if (routines.length === 0) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-sm text-[#7a8299]">No routines yet.</p>
        <p className="text-xs text-[#bbbcc8] mt-1">Build one in the Plan tab first.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl mx-4 overflow-hidden border border-[#e5e7ef]">
      {routines.map(function (r) {
        var categories = routineCategorySummary(r, exerciseMap)
        return (
          <button
            key={r.id}
            onClick={function () { onLog({ type: 'routine', id: r.id }) }}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#f0f1f5] last:border-0 hover:bg-[#f8f9fc] active:bg-[#f0f2ff] transition-colors text-left"
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
              {r.description ? (
                <p className="text-xs text-[#7a8299] mt-0.5 truncate">{r.description}</p>
              ) : null}
            </div>
            <span
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold text-white"
              style={{ background: '#4f7ef8', fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Log
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exercises tab
// ---------------------------------------------------------------------------

function ExercisesTab({ onLog }) {
  const { exercises } = useExercises()
  const [category, setCategory] = useState('all')
  const [search, setSearch]     = useState('')

  const filtered = exercises.filter(function (e) {
    const matchCat    = category === 'all' || e.category === category
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const sorted = filtered.slice().sort(function (a, b) {
    if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex flex-col gap-0">
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
            <FilterChip key={c.value} active={category === c.value} onClick={function () { setCategory(c.value) }}>
              {c.label}
            </FilterChip>
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
            var pattern = e.movementPattern ? PATTERN_META[e.movementPattern] : null
            var ytUrl = 'https://www.youtube.com/results?search_query=' +
              encodeURIComponent(e.ytSearch || ('how to ' + e.name + ' form tutorial'))
            return (
              <div
                key={e.id}
                className="flex items-center gap-2 px-4 py-3 border-b border-[#f0f1f5] last:border-0"
              >
                {/* Name — tappable to log */}
                <button
                  onClick={function () { onLog({ type: 'exercise', id: e.id }) }}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-[#1a1d2e] truncate">
                    {e.isFavourite && <span className="text-yellow-400 mr-1">★</span>}
                    {e.name}
                  </p>
                  {e.muscles && (
                    <p className="text-xs text-[#7a8299] truncate mt-0.5">{e.muscles}</p>
                  )}
                </button>

                {/* Meta */}
                <div className="flex items-center gap-1.5 shrink-0 text-xs">
                  {pattern && (
                    <span
                      className="font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: pattern.bg, color: pattern.color }}
                    >
                      {pattern.label}
                    </span>
                  )}
                  <span className="text-[#bbbcc8]">
                    {e.trackingType === 'time'
                      ? e.defaultSets + '×' + e.defaultDuration + 's'
                      : e.defaultSets + '×' + e.defaultReps}
                  </span>
                </div>

                {/* How to — YouTube search */}
                <a
                  href={ytUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={function (ev) { ev.stopPropagation() }}
                  className="shrink-0 p-1.5 rounded-lg transition-colors"
                  style={{ color: '#cc0000' }}
                  title="How to"
                >
                  <Youtube size={16} />
                </a>

                {/* Log badge */}
                <button
                  onClick={function () { onLog({ type: 'exercise', id: e.id }) }}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                  style={{ background: '#4f7ef8', fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Log
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HangMode — Routines sub-tab + Free Hang sub-tab
// ---------------------------------------------------------------------------

const HANG_TABS = [
  { key: 'free-hang', label: 'Free Hang' },
  { key: 'routines',  label: 'Routines' },
]

function FreeHangSetup({ onStart }) {
  const [fingers,    setFingers]    = useState('4 Finger')
  const [gripType,   setGripType]   = useState('half-crimp')
  const [edgeSize,   setEdgeSize]   = useState('20mm')
  const [activeSecs, setActiveSecs] = useState(10)
  const [restSecs,   setRestSecs]   = useState(5)
  const [sets,       setSets]       = useState(3)
  const [reps,       setReps]       = useState(6)
  const [weight,     setWeight]     = useState(0)

  var inputCls = 'w-full px-2 py-2 rounded-xl border border-[#e5e7ef] text-sm text-center text-[#1a1d2e] focus:outline-none focus:border-[#8b5cf6] transition-colors bg-white'
  var selectCls = 'w-full px-2 py-2.5 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white focus:outline-none focus:border-[#8b5cf6] appearance-none transition-colors'
  var labelCls = 'text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5'

  function handleGo() {
    var grip = defaultGrip()
    grip.fingers    = fingers
    grip.gripType   = gripType
    grip.grip       = gripType
    grip.edgeSize   = edgeSize
    grip.gripName   = gripDisplayName(fingers, gripType, edgeSize)
    grip.activeSecs = activeSecs
    grip.restSecs   = restSecs
    grip.sets       = sets
    grip.reps       = reps
    grip.weightKg   = weight
    grip.weightMode = weight < 0 ? 'assisted' : weight > 0 ? 'added' : 'bodyweight'

    var freeRoutine = {
      id:        null,
      name:      'Free Hang',
      type:      'hangboard',
      exercises: [],
      grips:     [grip],
    }
    onStart(freeRoutine)
  }

  return (
    <div className="mx-4 bg-white rounded-2xl border border-[#e5e7ef] px-4 pt-4 pb-5 flex flex-col gap-4">

      {/* Fingers + Grip + Edge */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Fingers</p>
          <select
            value={fingers}
            onChange={function (e) { setFingers(e.target.value) }}
            className={selectCls}
          >
            {FINGERS_OPTS.map(function (f) {
              return <option key={f} value={f}>{f}</option>
            })}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Grip</p>
          <select
            value={gripType}
            onChange={function (e) { setGripType(e.target.value) }}
            className={selectCls}
          >
            {GRIP_TYPE_OPTS.map(function (g) {
              return <option key={g.value} value={g.value}>{g.label}</option>
            })}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Edge</p>
          <select
            value={edgeSize}
            onChange={function (e) { setEdgeSize(e.target.value) }}
            className={selectCls}
          >
            {EDGE_OPTS.map(function (o) {
              return <option key={o.value} value={o.value}>{o.label}</option>
            })}
          </select>
        </div>
      </div>

      {/* Hang / Rest */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Hang (s)</p>
          <NumericStepper value={activeSecs} min={1} max={60}  step={1} onChange={setActiveSecs} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Rest (s)</p>
          <NumericStepper value={restSecs}   min={1} max={120} step={1} onChange={setRestSecs} />
        </div>
      </div>

      {/* Sets / Reps */}
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Sets</p>
          <NumericStepper value={sets} min={1} max={20} step={1} onChange={setSets} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Reps</p>
          <NumericStepper value={reps} min={1} max={20} step={1} onChange={setReps} />
        </div>
      </div>

      {/* Weight */}
      <div>
        <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Weight</p>
        <select
          value={weight}
          onChange={function (e) { setWeight(Number(e.target.value)) }}
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

      <button
        onClick={handleGo}
        className="w-full py-3.5 rounded-xl text-white font-black text-lg shadow-sm transition-transform active:scale-95"
        style={{ background: '#8b5cf6', fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        Go
      </button>
    </div>
  )
}

function HangMode({ hangRoutines, hangTimer, setHangTimer, onSaved }) {
  const [hangTab, setHangTab] = useState('free-hang')

  return (
    <div className="flex flex-col gap-0">
      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 pb-0 border-b border-[#e5e7ef]">
        {HANG_TABS.map(function (t) {
          var active = hangTab === t.key
          return (
            <button
              key={t.key}
              onClick={function () { setHangTab(t.key) }}
              className={'px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ' + (
                active
                  ? 'border-[#8b5cf6] text-[#8b5cf6]'
                  : 'border-transparent text-[#7a8299] hover:text-[#1a1d2e]'
              )}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px' }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="pt-4">
        {/* Routines sub-tab */}
        {hangTab === 'routines' && (
          <>
            {hangRoutines.length === 0 ? (
              <div className="px-4 pt-2 text-center">
                <p className="text-sm text-[#7a8299]">No hang routines yet.</p>
                <p className="text-xs text-[#bbbcc8] mt-1">Build one in Plan → Hang.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl mx-4 overflow-hidden border border-[#e5e7ef]">
                {hangRoutines.map(function (r) {
                  var grips     = r.grips || []
                  var totalSecs = grips.reduce(function (acc, g) {
                    return acc + g.activeSecs * g.reps * g.sets
                  }, 0)
                  var totalMins = Math.round(totalSecs / 60)
                  return (
                    <button
                      key={r.id}
                      onClick={function () { setHangTimer({ open: true, routine: r }) }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#f0f1f5] last:border-0 hover:bg-[#f8f9fc] active:bg-[#f5eeff] transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1a1d2e] truncate">{r.name}</p>
                        <p className="text-xs text-[#7a8299] mt-0.5">
                          {grips.length} grip{grips.length !== 1 ? 's' : ''}
                          {totalMins > 0 && (' · ~' + totalMins + ' min')}
                        </p>
                        {r.description ? (
                          <p className="text-xs text-[#7a8299] mt-0.5 truncate">{r.description}</p>
                        ) : null}
                      </div>
                      <span
                        className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ background: '#8b5cf6', fontFamily: "'Barlow Condensed', sans-serif" }}
                      >
                        Start
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Free Hang sub-tab */}
        {hangTab === 'free-hang' && (
          <FreeHangSetup
            onStart={function (routine) { setHangTimer({ open: true, routine: routine }) }}
          />
        )}
      </div>

      <HangboardTimer
        routine={hangTimer.routine}
        open={hangTimer.open}
        onClose={function () { setHangTimer({ open: false, routine: null }) }}
        onSaved={onSaved}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mode constants
// ---------------------------------------------------------------------------

const MODES = [
  { key: 'train', label: 'Train', accent: '#4f7ef8' },
  { key: 'climb', label: 'Climb', accent: '#c0622a' },
  { key: 'hang',  label: 'Hang',  accent: '#8b5cf6' },
]

const TRAIN_TABS = [
  { key: 'exercises', label: 'Exercises' },
  { key: 'routines',  label: 'Routines' },
]

// ---------------------------------------------------------------------------
// Log page
// ---------------------------------------------------------------------------

export default function Log() {
  const { routines: hangRoutines } = useHangRoutines()
  const location = useLocation()
  const navigate = useNavigate()

  const [mode, setMode]               = useState('train')
  const [tab, setTab]                 = useState('exercises')
  const [gymLogSheet, setGymLogSheet] = useState({ open: false, source: null })
  const [hangTimer, setHangTimer]     = useState({ open: false, routine: null })
  const [toast, setToast]             = useState(null)

  var modeAccent = (MODES.find(function (m) { return m.key === mode }) || MODES[0]).accent

  function openLogSheet(source) {
    setGymLogSheet({ open: true, source: source })
  }

  // Handle deep-link from Dashboard "Due today" chip: auto-open the right sheet
  useEffect(function () {
    var req = location.state && location.state.openRoutine
    if (!req) return
    if (req.kind === 'hang') {
      var hr = hangRoutines.find(function (r) { return r.id === req.id })
      if (hr) {
        setMode('hang')
        setHangTimer({ open: true, routine: hr })
      }
    } else if (req.kind === 'gym') {
      setMode('train')
      setTab('routines')
      setGymLogSheet({ open: true, source: { type: 'routine', id: req.id } })
    }
    // Clear the router state so tab changes or remounts don't reopen
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, hangRoutines])  // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setGymLogSheet({ open: false, source: null })
  }

  function handleSaved() {
    setToast('Session saved')
    setTimeout(function () { setToast(null) }, 2500)
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-8">

      {/* Mode switcher */}
      <div className="px-4 pt-4 pb-4">
        <div className="flex gap-2 p-1 bg-[#f4f5f9] rounded-xl">
          {MODES.map(function (m) {
            var active = mode === m.key
            return (
              <button
                key={m.key}
                onClick={function () { setMode(m.key) }}
                className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                style={
                  active
                    ? { background: m.accent, color: '#fff',    fontFamily: "'Barlow Condensed', sans-serif", boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                    : { background: 'transparent', color: '#7a8299', fontFamily: "'Barlow Condensed', sans-serif" }
                }
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── TRAIN mode ── */}
      {mode === 'train' && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 px-4 pb-0 border-b border-[#e5e7ef]">
            {TRAIN_TABS.map(function (t) {
              var active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={function () { setTab(t.key) }}
                  className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                    active
                      ? 'border-[#4f7ef8] text-[#4f7ef8]'
                      : 'border-transparent text-[#7a8299] hover:text-[#1a1d2e]'
                  }`}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px' }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="pt-4">
            {tab === 'routines'  && <RoutinesTab  onLog={openLogSheet} />}
            {tab === 'exercises' && <ExercisesTab onLog={openLogSheet} />}
          </div>

          <GymLogSheet
            source={gymLogSheet.source}
            open={gymLogSheet.open}
            onClose={handleClose}
            onSaved={handleSaved}
          />
        </>
      )}

      {/* ── CLIMB mode ── */}
      {mode === 'climb' && (
        <ClimbLogger onSaved={handleSaved} />
      )}

      {/* ── HANG mode ── */}
      {mode === 'hang' && (
        <HangMode
          hangRoutines={hangRoutines}
          hangTimer={hangTimer}
          setHangTimer={setHangTimer}
          onSaved={handleSaved}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-10 z-50 px-4 py-2 rounded-full text-white text-sm font-semibold shadow-lg pointer-events-none"
          style={{ background: '#1a1d2e', fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
