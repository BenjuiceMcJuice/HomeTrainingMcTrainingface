import { useNavigate } from 'react-router-dom'
import { CalendarDays, Trophy } from 'lucide-react'
import { useData } from '../../App'
import { dashComps } from '../../lib/compUi'
import { barlow, jsToScheduleDay } from '../../lib/utils'
import useRoutines from '../../hooks/useRoutines'
import useHangRoutines from '../../hooks/useHangRoutines'
import { sortByRemindAt, entryTimes } from '../../lib/reminders'

const SCHED_DAY_NAMES = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' }

export default function ScheduleNotice({ scheduleEntries }) {
  const navigate = useNavigate()
  const { routines: gymRoutines }  = useRoutines()
  const { routines: hangRoutines } = useHangRoutines()
  const { data } = useData()

  // Comps sit on this strip beside the routines — starting within 24 hours or
  // running now, never anything past (Ben, 2026-09-27; there is no comp
  // widget). `dashComps` decides which.
  const today    = new Date()
  const comps    = dashComps(data.compEntries, data.sessions, today.getTime())
  const compCards = {}
  ;(data.sessions || []).forEach(s => { if (s.comp && s.comp.code) compCards[s.comp.code] = true })

  if ((!scheduleEntries || !scheduleEntries.length) && !comps.length) return null
  const entries = scheduleEntries || []

  const todayDow = jsToScheduleDay(today.getDay())

  const dueToday = sortByRemindAt(entries.filter(e => e.days.indexOf(todayDow) >= 0))

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
      const found = entries.filter(e => e.days.indexOf(checkDow) >= 0)
      if (found.length > 0) { nextEntries = found; nextDaysAway = ahead; break }
    }
  }

  const nextText = () => {
    const dayName   = SCHED_DAY_NAMES[((todayDow - 1 + nextDaysAway) % 7) + 1]
    const nextNames = sortByRemindAt(nextEntries)
      .map(e => e.routineName + (entryTimes(e).length ? ' ' + entryTimes(e).join('/') : ''))
      .join(', ')
    return (
      <p className="text-xs text-[#7a8299]">
        <span className="font-semibold" style={barlow}>Next:</span> {nextNames} · {dayName}{nextDaysAway === 1 ? ' (tomorrow)' : ' (' + nextDaysAway + ' days)'}
      </p>
    )
  }
  // Under the comps, when no routine is due today: the next routine, as the
  // strip says when there are no comps.
  const nextLine = () => (nextEntries && nextDaysAway
    ? <div className="mt-1.5 pl-[26px]">{nextText()}</div>
    : null)

  const compWhen = (c) => {
    if (c.live) return 'on now'
    if (c.whenMs == null) return 'today'
    const t = new Date(c.whenMs)
    const hhmm = t.toTimeString().slice(0, 5)
    return t.toDateString() === today.toDateString() ? hhmm : 'tomorrow ' + hhmm
  }

  const compChips = comps.map(c => (
    <button
      key={'comp-' + c.code}
      onClick={() => navigate(compCards[c.code] ? '/comp/' + c.code + '/card' : '/comp/' + c.code)}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
      style={{ background: c.live ? '#2a9d5c' : '#0f766e', fontFamily: "'Barlow Condensed', sans-serif" }}
    >
      <Trophy size={11} className="shrink-0" />{(c.name || c.code) + ' · ' + compWhen(c)} ›
    </button>
  ))
  const allToday = comps.every(c => c.live || c.whenMs == null || new Date(c.whenMs).toDateString() === today.toDateString())

  if (dueToday.length > 0 || comps.length > 0) {
    return (
      <div className="px-4">
        <div className="bg-white rounded-2xl border border-[#bae6fd] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <CalendarDays size={16} style={{ color: '#0284c7' }} className="shrink-0" />
          <span className="text-xs font-bold text-[#1a1d2e] shrink-0" style={barlow}>{allToday ? 'Due today:' : 'Coming up:'}</span>
          <div className="flex-1 flex flex-wrap gap-1.5">
            {compChips}
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
                  {e.routineName || 'Routine'}{entryTimes(e).length ? ' · ' + entryTimes(e).join(' · ') : ''} ›
                </button>
              )
            })}
          </div>
        </div>
        {dueToday.length === 0 && nextLine()}
        </div>
      </div>
    )
  }

  if (nextEntries && nextDaysAway) {
    return (
      <div className="px-4">
        <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-[#bae6fd] px-4 py-2.5">
          <CalendarDays size={16} style={{ color: '#0284c7' }} className="shrink-0" />
          {nextText()}
        </div>
      </div>
    )
  }

  return null
}
