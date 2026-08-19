import { useNavigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { barlow, jsToScheduleDay } from '../../lib/utils'
import useRoutines from '../../hooks/useRoutines'
import useHangRoutines from '../../hooks/useHangRoutines'
import { sortByRemindAt } from '../../lib/reminders'

const SCHED_DAY_NAMES = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' }

export default function ScheduleNotice({ scheduleEntries }) {
  const navigate = useNavigate()
  const { routines: gymRoutines }  = useRoutines()
  const { routines: hangRoutines } = useHangRoutines()

  if (!scheduleEntries || !scheduleEntries.length) return null

  const today    = new Date()
  const todayDow = jsToScheduleDay(today.getDay())

  const dueToday = sortByRemindAt(scheduleEntries.filter(e => e.days.indexOf(todayDow) >= 0))

  const routineKind = (routineId) => {
    if (hangRoutines.some(r => r.id === routineId)) return 'hang'
    if (gymRoutines.some(r => r.id === routineId)) return 'gym'
    return null
  }

  const openRoutine = (entry) => {
    const kind = routineKind(entry.routineId)
    if (!kind) return
    navigate('/log', { state: { openRoutine: { id: entry.routineId, kind } } })
  }

  let nextEntries = null, nextDaysAway = null
  if (dueToday.length === 0) {
    for (let ahead = 1; ahead <= 7; ahead++) {
      const checkDow = ((todayDow - 1 + ahead) % 7) + 1
      const found = scheduleEntries.filter(e => e.days.indexOf(checkDow) >= 0)
      if (found.length > 0) { nextEntries = found; nextDaysAway = ahead; break }
    }
  }

  if (dueToday.length > 0) {
    return (
      <div className="px-4">
        <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-[#bae6fd] px-4 py-2.5">
          <CalendarDays size={16} style={{ color: '#0284c7' }} className="shrink-0" />
          <span className="text-xs font-bold text-[#1a1d2e] shrink-0" style={barlow}>Due today:</span>
          <div className="flex-1 flex flex-wrap gap-1.5">
            {dueToday.map(e => {
              const kind   = routineKind(e.routineId)
              const accent = kind === 'hang' ? '#8b5cf6' : '#4f7ef8'
              return (
                <button
                  key={e.id}
                  onClick={() => openRoutine(e)}
                  disabled={!kind}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: accent, fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {e.routineName || 'Routine'}{e.remindAt ? ' · ' + e.remindAt : ''} ›
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (nextEntries && nextDaysAway) {
    const dayName   = SCHED_DAY_NAMES[((todayDow - 1 + nextDaysAway) % 7) + 1]
    const nextNames = sortByRemindAt(nextEntries)
      .map(e => e.routineName + (e.remindAt ? ' ' + e.remindAt : ''))
      .join(', ')
    return (
      <div className="px-4">
        <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-[#bae6fd] px-4 py-2.5">
          <CalendarDays size={16} style={{ color: '#0284c7' }} className="shrink-0" />
          <p className="text-xs text-[#7a8299]">
            <span className="font-semibold" style={barlow}>Next:</span> {nextNames} · {dayName}{nextDaysAway === 1 ? ' (tomorrow)' : ' (' + nextDaysAway + ' days)'}
          </p>
        </div>
      </div>
    )
  }

  return null
}
