import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mountain } from 'lucide-react'
import useSessions from '../hooks/useSessions'
import useProfile from '../hooks/useProfile'
import useWeightLog from '../hooks/useWeightLog'
import useSchedule from '../hooks/useSchedule'
import useGoals from '../hooks/useGoals'
import useDrinkLog from '../hooks/useDrinkLog'
import { useData } from '../App'
import { calcDisciplineStats, filterSessionsByDays } from '../lib/stats'
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

export default function Dashboard() {
  const { data }     = useData()
  const { sessions } = useSessions()
  const { profile }  = useProfile()
  const { entries: weightEntries }   = useWeightLog()
  const { entries: scheduleEntries } = useSchedule()
  const { goals }    = useGoals()
  const { entries: drinkEntries } = useDrinkLog()
  const navigate = useNavigate()
  const apiKey   = data.groqKey || ''

  const prefs      = (profile && profile.dashWidgets) || {}
  const showWidget = (key) => prefs[key] !== false

  const recent90 = useMemo(() => filterSessionsByDays(sessions, 90), [sessions])

  const boulderPeak    = useMemo(() => calcDisciplineStats(sessions,  ['boulder'],             V_GRADES_DASH,      'v'),      [sessions])
  const boulderCurrent = useMemo(() => calcDisciplineStats(recent90,  ['boulder'],             V_GRADES_DASH,      'v'),      [recent90])
  const ropePeak       = useMemo(() => calcDisciplineStats(sessions,  ['lead', 'toprope'],     FRENCH_GRADES_DASH, 'french'), [sessions])
  const ropeCurrent    = useMemo(() => calcDisciplineStats(recent90,  ['lead', 'toprope'],     FRENCH_GRADES_DASH, 'french'), [recent90])

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

  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-8 gap-4 pt-4">
      <QuickStats sessions={sessions} />
      <ScheduleNotice scheduleEntries={scheduleEntries} sessions={sessions} />

      {showWidget('trainingLoad') && <TrainingLoad sessions={sessions} />}
      {showWidget('gymStats')     && <GymStatsCard sessions={sessions} />}
      {showWidget('cardioStats')  && <CardioStatsCard sessions={sessions} weightEntries={weightEntries} profileWeight={profileWeight} goals={goals} />}

      {showWidget('boulderLevel') && (
        <LevelCard label="Boulder" peakStats={boulderPeak} currentStats={boulderCurrent} gradeSystem="v"
          icon={<Mountain size={14} style={{ color: '#c0622a' }} />}
          goal={boulderGoal} goalSends={boulderGoalSends}
        />
      )}
      {showWidget('ropeLevel') && (
        <LevelCard label="Rope" peakStats={ropePeak} currentStats={ropeCurrent} gradeSystem="french"
          icon={<Mountain size={14} style={{ color: '#4f7ef8' }} />}
          goal={ropeGoal} goalSends={ropeGoalSends}
        />
      )}

      {showWidget('alcoholFree')     && <AlcoholFreeCard drinkEntries={drinkEntries} />}
      {showWidget('coachTip')        && <CoachTip sessions={sessions} profile={profile} apiKey={apiKey} goals={goals} weightLog={weightEntries} />}
      {showWidget('weight')          && <WeightCard profile={profile} weightEntries={weightEntries} goals={goals} />}

      <ActivityCalendar
        sessions={sessions}
        scheduleEntries={scheduleEntries}
        defaultExpanded={!showWidget('trainingLoad') && !showWidget('boulderLevel') && !showWidget('ropeLevel') && !showWidget('coachTip') && !showWidget('weight') && !showWidget('alcoholFree')}
      />

      {sessions.length === 0 && (
        <div className="px-4 text-center pt-4">
          <p className="text-sm text-[#7a8299]">Start logging sessions to see your stats here.</p>
        </div>
      )}

      <p className="text-[9px] text-[#bbbcc8] text-center pb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        Customise widgets in Plan → Profile
      </p>
    </div>
  )
}
