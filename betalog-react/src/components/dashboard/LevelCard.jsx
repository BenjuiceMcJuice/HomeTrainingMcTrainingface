import { LEVEL_COLOR, gradeColor } from '../../lib/stats'
import { barlow } from '../../lib/utils'

const V_GRADES_DASH      = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']
const FRENCH_GRADES_DASH = ['4','5','5+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c']

export { V_GRADES_DASH, FRENCH_GRADES_DASH }

function GradeChip({ grade, gradeSystem }) {
  if (!grade) return null
  return <span className="font-bold" style={{ ...barlow, color: gradeColor(grade, gradeSystem) }}>{grade}</span>
}

function goalProgressForGrades(goal, currentGrade, grades) {
  if (!goal || !goal.target) return null
  const ti = grades.indexOf(String(goal.target))
  if (ti === -1) return null
  const ci = grades.indexOf(String(currentGrade || ''))
  const si = grades.indexOf(String(goal.startValue || ''))
  // If no valid start, treat as starting from index 0
  const startIdx = si >= 0 ? si : 0
  if (ti <= startIdx) return ci >= ti ? 1 : 0
  return Math.min(1, Math.max(0, ((ci >= 0 ? ci : 0) - startIdx) / (ti - startIdx)))
}

export default function LevelCard({ label, icon, peakStats, currentStats, gradeSystem, goal }) {
  if (!peakStats || !peakStats.hasData) return null

  const lc        = peakStats.consistent ? (LEVEL_COLOR[peakStats.consistent.level] || LEVEL_COLOR.Beginner) : null
  const currentLc = currentStats?.consistent ? (LEVEL_COLOR[currentStats.consistent.level] || LEVEL_COLOR.Beginner) : null
  const samePeak  = peakStats.consistent && currentStats?.consistent && peakStats.consistent.grade === currentStats.consistent.grade

  const s = (currentStats?.hasData) ? currentStats : peakStats

  const grades       = gradeSystem === 'v' ? V_GRADES_DASH : FRENCH_GRADES_DASH
  const goalProgress = goal ? goalProgressForGrades(goal, peakStats.consistent?.grade, grades) : null
  const goalPct      = goalProgress !== null ? Math.round(goalProgress * 100) : null

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-3 py-2 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: lc ? lc.bg : '#f4f5f9' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#7a8299] uppercase" style={barlow}>{label}</span>
            {peakStats.consistent ? (
              <span className="font-black text-sm leading-none" style={{ ...barlow, color: lc.color }}>{peakStats.consistent.level}</span>
            ) : (
              <span className="text-[9px] text-[#bbbcc8]" style={barlow}>Log more to get a level</span>
            )}
            {!samePeak && currentStats?.consistent && currentLc && (
              <>
                <span className="text-[8px] text-[#bbbcc8]">|</span>
                <span className="text-[8px] text-[#7a8299]" style={barlow}>90d</span>
                <span className="font-black text-xs leading-none" style={{ ...barlow, color: currentLc.color }}>{currentStats.consistent.level}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-[#7a8299]">
            {s.highestSend  && <span>Project <GradeChip grade={s.highestSend.grade} gradeSystem={gradeSystem} /></span>}
            {s.consistent   && <span>Consistent <GradeChip grade={s.consistent.grade} gradeSystem={gradeSystem} /></span>}
            {s.highestFlash && <span>Flash <GradeChip grade={s.highestFlash.grade} gradeSystem={gradeSystem} /></span>}
            {!s.consistent && !s.highestSend && (
              <span className="text-[#bbbcc8]">{s.total} climbs logged</span>
            )}
          </div>
          {goalProgress !== null && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: '4px', background: '#e5e7ef' }}>
                <div className="h-full rounded-full transition-all" style={{ width: goalPct + '%', background: '#d97706' }} />
              </div>
              <span className="text-[9px] font-bold shrink-0" style={{ ...barlow, color: '#d97706' }}>
                Goal {goal.target} · {goalPct}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
