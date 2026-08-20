import { useState, useMemo } from 'react'
import WidgetShell from './WidgetShell'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { todayStr } from '../../lib/stats'
import { barlow, jsToScheduleDay } from '../../lib/utils'

const TYPE_COLOR = {
  gym:       { bg: '#d5e4d8', text: '#2a6e3f' },
  climb:     { bg: '#f0d9c8', text: '#b05a1a' },
  hangboard: { bg: '#e4d8f0', text: '#6b3fa0' },
}

const DOT_COLOR = {
  gym:       '#2a6e3f',
  climb:     '#b05a1a',
  hangboard: '#6b3fa0',
}

const DAY_LABELS  = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const buildMonthGrid = (year, month) => {
  const first   = new Date(year, month, 1)
  let firstDow  = first.getDay()
  firstDow = firstDow === 0 ? 6 : firstDow - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const rows = []
  let row = []
  for (let b = 0; b < firstDow; b++) row.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    row.push(ds)
    if (row.length === 7) { rows.push(row); row = [] }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null)
    rows.push(row)
  }
  return rows
}

export default function ActivityCalendar({ sessions, scheduleEntries, drinkLog, editMode }) {
  const now = new Date()
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const dateTypes = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      if (!map[s.date]) map[s.date] = {}
      map[s.date][s.type] = true
    })
    return map
  }, [sessions])

  const scheduledDays = useMemo(() => {
    const set = {}
    ;(scheduleEntries || []).forEach(e => e.days.forEach(d => { set[d] = true }))
    return set
  }, [scheduleEntries])

  const drinkDays = useMemo(() => {
    var set = new Set()
    ;(drinkLog || []).forEach(function(e) { if (e.date) set.add(e.date) })
    return set
  }, [drinkLog])

  const grid  = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])
  const today = todayStr()

  const isScheduled = (dateStr) => {
    if (!dateStr) return false
    const d = new Date(dateStr + 'T12:00:00')
    return !!scheduledDays[jsToScheduleDay(d.getDay())]
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else setViewMonth(viewMonth - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else setViewMonth(viewMonth + 1)
  }

  const cellStyle = (dateStr) => {
    if (!dateStr) return {}
    const types = dateTypes[dateStr]
    if (!types) return {}
    const keys = Object.keys(types)
    if (keys.length === 1) {
      const tc = TYPE_COLOR[keys[0]]
      return tc ? { background: tc.bg, color: tc.text } : {}
    }
    return { background: '#e8ddd4', color: '#5a4a3a' }
  }

  const typeDots = (dateStr) => {
    if (!dateStr) return null
    const types = dateTypes[dateStr]
    if (!types) return null
    return Object.keys(types).map(k => DOT_COLOR[k] || '#7a8299')
  }

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] overflow-hidden">

        <WidgetShell
          widgetKey="activityCalendar"
          editMode={editMode}
          headerClassName="px-4 py-3"
          header={
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>
              Activity calendar
            </p>
          }
        >
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="w-9 h-9 rounded-xl border border-[#e5e7ef] flex items-center justify-center text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
                <ChevronLeft size={18} />
              </button>
              <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '20px' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </p>
              <button onClick={nextMonth} className="w-9 h-9 rounded-xl border border-[#e5e7ef] flex items-center justify-center text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((label, i) => (
                <div key={i} className="flex items-center justify-center py-1">
                  <span className="text-xs font-bold text-[#7a8299]" style={barlow}>{label}</span>
                </div>
              ))}
            </div>

            {grid.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 gap-1 mb-1">
                {row.map((ds, ci) => {
                  if (!ds) return <div key={ci} />
                  const dayNum    = parseInt(ds.slice(8), 10)
                  const isToday   = ds === today
                  const style     = cellStyle(ds)
                  const hasData   = !!dateTypes[ds]
                  const scheduled = !hasData && isScheduled(ds)
                  const dots      = typeDots(ds)

                  return (
                    <div
                      key={ci}
                      className="flex flex-col items-center justify-center rounded-xl aspect-square"
                      style={{
                        position: 'relative',
                        ...(hasData ? style : scheduled ? { background: '#f0f1f5' } : {}),
                        ...(isToday ? { border: '2px dashed #7a8299' } : {}),
                      }}
                    >
                      {drinkDays.has(ds) && (
                        <div style={{ position: 'absolute', top: '4px', right: '4px', width: '5px', height: '5px', borderRadius: '50%', background: '#b05080' }} />
                      )}
                      <span
                        className="font-bold leading-none"
                        style={{ ...barlow, fontSize: '15px', color: hasData ? (style.color || '#1a1d2e') : scheduled ? '#7a8299' : '#1a1d2e' }}
                      >
                        {dayNum}
                      </span>
                      {dots && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {dots.map((c, di) => (
                            <div key={di} className="rounded-full" style={{ width: '4px', height: '4px', background: c }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            <div className="flex items-center gap-3 mt-2 pt-2.5 border-t border-[#f0f1f5] flex-wrap">
              {[
                { label: 'Gym',       bg: TYPE_COLOR.gym.bg },
                { label: 'Climb',     bg: TYPE_COLOR.climb.bg },
                { label: 'Hang',      bg: TYPE_COLOR.hangboard.bg },
                { label: 'Scheduled', bg: '#f0f1f5' },
                { label: 'Alcohol',   bg: '#b05080', round: true },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div style={{ width: '10px', height: '10px', background: item.bg, borderRadius: item.round ? '50%' : '3px', flexShrink: 0 }} />
                  <span className="text-[10px] font-semibold text-[#7a8299]" style={barlow}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </WidgetShell>
      </div>
    </div>
  )
}
