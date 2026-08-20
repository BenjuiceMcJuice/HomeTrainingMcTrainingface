import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import { Mountain, GripVertical, Check } from 'lucide-react'
import {
  DndContext, closestCenter,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useSessions from '../hooks/useSessions'
import useProfile from '../hooks/useProfile'
import useWeightLog from '../hooks/useWeightLog'
import useSchedule from '../hooks/useSchedule'
import useGoals from '../hooks/useGoals'
import useDrinkLog from '../hooks/useDrinkLog'
import { useData } from '../App'
import { calcDisciplineStats, filterSessionsByDays } from '../lib/stats'
import { barlow } from '../lib/utils'
import QuickStats        from '../components/dashboard/QuickStats'
import TrainingLoad      from '../components/dashboard/TrainingLoad'
import ActivityCalendar  from '../components/dashboard/ActivityCalendar'
import WeightCard        from '../components/dashboard/WeightCard'
import ScheduleNotice    from '../components/dashboard/ScheduleNotice'
import CoachTip          from '../components/dashboard/CoachTip'
import LevelCard, { V_GRADES_DASH, FRENCH_GRADES_DASH } from '../components/dashboard/LevelCard'
import AlcoholFreeCard   from '../components/dashboard/AlcoholFreeCard'
import CardioStatsCard   from '../components/dashboard/CardioStatsCard'
import GymStatsCard      from '../components/dashboard/GymStatsCard'
import WidgetPicker from '../components/dashboard/WidgetPicker'

const DEFAULT_ORDER = ['trainingLoad', 'gymStats', 'cardioStats', 'boulderLevel', 'ropeLevel', 'alcoholFree', 'coachTip', 'weight']

function SortableWidget({ id, editMode, children }) {
  const {
    attributes, listeners,
    setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id })

  // Several widgets render nothing when they have no data to show — no gym
  // sessions, no Groq key, no logged weight, no climbs at a grade. The sortable
  // chrome around them doesn't know that, so it used to leave a blank card in
  // edit mode carrying a drag handle and nothing else. Measure the rendered
  // output instead of predicting it: CoachTip can also come back empty after an
  // async fetch, which no data check in Dashboard could anticipate.
  const contentRef = useRef(null)
  const [isEmpty, setIsEmpty] = useState(false)
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const check = () => setIsEmpty(el.childElementCount === 0)
    check()
    // CoachTip fills in after an async fetch, so a mount-time check alone would
    // leave it hidden once its tip arrives.
    const observer = new MutationObserver(check)
    observer.observe(el, { childList: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={setNodeRef}
      style={{
        // Translate, not Transform: CSS.Transform includes dnd-kit's scaleX/scaleY,
        // which stretches a dragged card toward its neighbours' dimensions. With
        // cards this different in height (the alcohol card against the gym card)
        // that reads as the widget changing shape while you slide it.
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        position: 'relative',
        display: isEmpty ? 'none' : undefined,
      }}
    >
      <div ref={contentRef}>{children}</div>
      {editMode && (
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-10 p-2"
          style={{ touchAction: 'none', cursor: 'grab' }}
        >
          <GripVertical size={16} style={{ color: '#bbbcc8' }} />
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { data }     = useData()
  const { sessions } = useSessions()
  const { profile, saveProfile }  = useProfile()
  const { entries: weightEntries }   = useWeightLog()
  const { entries: scheduleEntries } = useSchedule()
  const { goals }    = useGoals()
  const { entries: drinkEntries } = useDrinkLog()
  const apiKey   = data.groqKey || ''
  const [editMode, setEditMode] = useState(false)

  const prefs      = (profile && profile.dashWidgets) || {}
  const showWidget = (key) => prefs[key] !== false

  const orderedKeys = useMemo(() => {
    const stored = profile && profile.widgetOrder
    if (!stored || !Array.isArray(stored)) return DEFAULT_ORDER
    const filtered = stored.filter(k => DEFAULT_ORDER.includes(k))
    const missing  = DEFAULT_ORDER.filter(k => !filtered.includes(k))
    return [...filtered, ...missing]
  }, [profile])

  const visibleKeys = orderedKeys.filter(key => showWidget(key))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const recent90 = useMemo(() => filterSessionsByDays(sessions, 90), [sessions])

  const boulderPeak    = useMemo(() => calcDisciplineStats(sessions, ['boulder'],         V_GRADES_DASH,      'v'),      [sessions])
  const boulderCurrent = useMemo(() => calcDisciplineStats(recent90, ['boulder'],         V_GRADES_DASH,      'v'),      [recent90])
  const ropePeak       = useMemo(() => calcDisciplineStats(sessions, ['lead', 'toprope'], FRENCH_GRADES_DASH, 'french'), [sessions])
  const ropeCurrent    = useMemo(() => calcDisciplineStats(recent90, ['lead', 'toprope'], FRENCH_GRADES_DASH, 'french'), [recent90])

  const profileWeight = profile?.weightKg || null

  const boulderGoal = (goals || []).find(g => !g.achieved && g.type === 'boulder_grade') || null
  const ropeGoal    = (goals || []).find(g => !g.achieved && g.type === 'rope_grade')    || null

  const boulderGoalSends = useMemo(() => {
    if (!boulderGoal) return 0
    return recent90.reduce((n, s) =>
      n + (s.climbs || []).filter(c =>
        c.discipline === 'boulder' && c.grade === boulderGoal.target &&
        (c.outcome === 'sent' || c.outcome === 'flashed')
      ).length, 0)
  }, [recent90, boulderGoal?.target])

  const ropeGoalSends = useMemo(() => {
    if (!ropeGoal) return 0
    return recent90.reduce((n, s) =>
      n + (s.climbs || []).filter(c =>
        (c.discipline === 'lead' || c.discipline === 'toprope') && c.grade === ropeGoal.target &&
        (c.outcome === 'sent' || c.outcome === 'flashed')
      ).length, 0)
  }, [recent90, ropeGoal?.target])

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldVis = visibleKeys.indexOf(active.id)
    const newVis = visibleKeys.indexOf(over.id)
    if (oldVis === -1 || newVis === -1) return
    const newVisOrder = arrayMove(visibleKeys, oldVis, newVis)
    // Rebuild full order, preserving hidden widget positions
    var vi = 0
    var newOrder = orderedKeys.map(k => showWidget(k) ? newVisOrder[vi++] : k)
    saveProfile({ widgetOrder: newOrder })
  }

  function renderWidget(key, editMode) {
    switch (key) {
      case 'trainingLoad': return <TrainingLoad sessions={sessions} />
      case 'gymStats':     return <GymStatsCard sessions={sessions} />
      case 'cardioStats':  return <CardioStatsCard sessions={sessions} weightEntries={weightEntries} profileWeight={profileWeight} goals={goals} editMode={editMode} />
      case 'boulderLevel': return (
        <LevelCard label="Boulder" peakStats={boulderPeak} currentStats={boulderCurrent} gradeSystem="v"
          icon={<Mountain size={14} style={{ color: '#c0622a' }} />}
          goal={boulderGoal} goalSends={boulderGoalSends}
          widgetKey="boulderLevel" editMode={editMode}
        />
      )
      case 'ropeLevel': return (
        <LevelCard label="Rope" peakStats={ropePeak} currentStats={ropeCurrent} gradeSystem="french"
          icon={<Mountain size={14} style={{ color: '#4f7ef8' }} />}
          goal={ropeGoal} goalSends={ropeGoalSends}
          widgetKey="ropeLevel" editMode={editMode}
        />
      )
      case 'alcoholFree': return <AlcoholFreeCard drinkEntries={drinkEntries} editMode={editMode} />
      case 'coachTip':    return <CoachTip sessions={sessions} profile={profile} apiKey={apiKey} goals={goals} weightLog={weightEntries} />
      case 'weight':      return <WeightCard profile={profile} weightEntries={weightEntries} goals={goals} />
      default: return null
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-8 gap-4 pt-4">
      <QuickStats sessions={sessions} />
      <ScheduleNotice scheduleEntries={scheduleEntries} />

      <div className="flex flex-col gap-4">
        {editMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
              {visibleKeys.map(key => (
                <SortableWidget key={key} id={key} editMode={true}>
                  {renderWidget(key, true)}
                </SortableWidget>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          visibleKeys.map(key => <div key={key}>{renderWidget(key, false)}</div>)
        )}
      </div>

      {editMode && <WidgetPicker />}

      <div className="flex justify-center">
        <button
          onClick={() => setEditMode(e => !e)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors"
          style={{ background: editMode ? '#edfaf2' : '#f4f5f9', color: editMode ? '#2a9d5c' : '#7a8299', ...barlow }}
        >
          {editMode ? <><Check size={12} /> Done</> : <><GripVertical size={12} /> Edit layout</>}
        </button>
      </div>

      <ActivityCalendar
        sessions={sessions}
        scheduleEntries={scheduleEntries}
        drinkLog={drinkEntries}
        editMode={editMode}
      />

      {sessions.length === 0 && (
        <div className="px-4 text-center pt-4">
          <p className="text-sm text-[#7a8299]">Start logging sessions to see your stats here.</p>
        </div>
      )}

      <p className="text-[9px] text-[#bbbcc8] text-center pb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        Choose and reorder widgets with Edit layout
      </p>
    </div>
  )
}
