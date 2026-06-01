import { Flame, Dumbbell, TrendingUp } from 'lucide-react'
import { calcWeeklyStreak } from '../../lib/stats'
import { barlow } from '../../lib/utils'

const weekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

const calcWeekSessions = (sessions) => {
  const ws = weekStart()
  return sessions.filter(s => s.date >= ws).length
}

export default function QuickStats({ sessions }) {
  const weekStreak = calcWeeklyStreak(sessions)
  const thisWeek   = calcWeekSessions(sessions)
  const total      = sessions.length

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-3 py-2 flex items-center">
        <div className="flex-1 flex items-center gap-1.5 justify-center">
          <Flame size={13} style={{ color: '#ef4444' }} />
          <span className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '18px' }}>{weekStreak.current}</span>
          <span className="text-[9px] font-bold text-[#7a8299] uppercase" style={barlow}>wk</span>
          {weekStreak.best > 0 && (
            <span className="text-[8px] text-[#bbbcc8]" style={barlow}>best:{weekStreak.best}</span>
          )}
        </div>
        <div className="w-px h-6 bg-[#e5e7ef]" />
        <div className="flex-1 flex items-center gap-1.5 justify-center">
          <Dumbbell size={13} style={{ color: '#4f7ef8' }} />
          <span className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '18px' }}>{thisWeek}</span>
          <span className="text-[9px] font-bold text-[#7a8299] uppercase" style={barlow}>this wk</span>
        </div>
        <div className="w-px h-6 bg-[#e5e7ef]" />
        <div className="flex-1 flex items-center gap-1.5 justify-center">
          <TrendingUp size={13} style={{ color: '#2a9d5c' }} />
          <span className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '18px' }}>{total}</span>
          <span className="text-[9px] font-bold text-[#7a8299] uppercase" style={barlow}>total</span>
        </div>
      </div>
    </div>
  )
}
