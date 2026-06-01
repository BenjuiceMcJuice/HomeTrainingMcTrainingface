import { Target, Mountain, Activity, Scale } from 'lucide-react'
import { barlow } from '../../lib/utils'
import { getCurrentValue, calcGoalProgress } from '../../hooks/useGoals'

const GOAL_META = {
  boulder_grade: { label: 'Boulder', color: '#c0622a', Icon: Mountain },
  rope_grade:    { label: 'Rope',    color: '#4f7ef8', Icon: Mountain },
  run:           { label: 'Run',     color: '#2a9d5c', Icon: Activity },
  swim:          { label: 'Swim',    color: '#0891b2', Icon: Activity },
  cycle:         { label: 'Cycle',   color: '#8b5cf6', Icon: Activity },
  weight:        { label: 'Weight',  color: '#d4742a', Icon: Scale    },
}

export default function GoalsWidget({ goals, sessions, weightLog, onNavigate }) {
  const active = (goals || []).filter(g => !g.achieved)
  if (active.length === 0) return null

  return (
    <div className="px-4">
      <div
        className="bg-white rounded-2xl border border-[#ddd6fe] px-4 py-3 cursor-pointer hover:bg-[#f8f9fc] transition-colors"
        onClick={onNavigate}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#ede9fe' }}>
            <Target size={16} style={{ color: '#7c3aed' }} />
          </div>
          <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>Goals</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {active.map(g => {
            const meta     = GOAL_META[g.type] || GOAL_META.boulder_grade
            const Icon     = meta.Icon
            const current  = getCurrentValue(g.type, sessions, weightLog)
            const progress = calcGoalProgress(g, current)
            const today    = new Date(); today.setHours(0, 0, 0, 0)
            const target   = new Date(g.targetDate + 'T00:00:00')
            const days     = Math.round((target - today) / 86400000)
            const dc       = days <= 7 ? '#ef4444' : days <= 30 ? '#d97706' : '#7a8299'

            return (
              <div key={g.id} className="flex items-center gap-2">
                <Icon size={11} style={{ color: meta.color }} className="shrink-0" />
                <span className="text-[11px] font-bold text-[#1a1d2e] shrink-0 w-28 truncate" style={barlow}>
                  {meta.label} {String(g.target)}{g.unit ? ' ' + g.unit : ''}
                </span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: '5px', background: '#e5e7ef' }}>
                  <div className="h-full rounded-full" style={{ width: Math.round(Math.min(1, progress) * 100) + '%', background: meta.color }} />
                </div>
                <span className="text-[9px] font-bold w-14 text-right shrink-0" style={{ ...barlow, color: dc }}>
                  {days < 0 ? 'Overdue' : days === 0 ? 'Today!' : days + 'd left'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
