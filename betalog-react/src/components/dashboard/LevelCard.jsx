import { LEVEL_COLOR, gradeColor } from '../../lib/stats'
import { barlow } from '../../lib/utils'

const V_GRADES_DASH      = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']
const FRENCH_GRADES_DASH = ['4','5','5+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c']

export { V_GRADES_DASH, FRENCH_GRADES_DASH }

function GradeChip({ grade, gradeSystem }) {
  if (!grade) return null
  return <span className="font-bold" style={{ ...barlow, color: gradeColor(grade, gradeSystem) }}>{grade}</span>
}

export default function LevelCard({ label, icon, peakStats, currentStats, gradeSystem, goal, goalSends }) {
  if (!peakStats || !peakStats.hasData) return null

  const lc        = peakStats.consistent ? (LEVEL_COLOR[peakStats.consistent.level] || LEVEL_COLOR.Beginner) : null
  const currentLc = currentStats?.consistent ? (LEVEL_COLOR[currentStats.consistent.level] || LEVEL_COLOR.Beginner) : null
  const samePeak  = peakStats.consistent && currentStats?.consistent && peakStats.consistent.grade === currentStats.consistent.grade

  const s = (currentStats?.hasData) ? currentStats : peakStats

  // 90d consistent if available, else all-time fallback
  const currentGrade  = currentStats?.consistent?.grade || peakStats?.consistent?.grade || null
  const gradeIs90d    = !!currentStats?.consistent?.grade

  // Days remaining on goal
  const goalDays = (() => {
    if (!goal?.targetDate) return null
    const today  = new Date(); today.setHours(0, 0, 0, 0)
    const target = new Date(goal.targetDate + 'T00:00:00')
    return Math.round((target - today) / 86400000)
  })()

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#f5c9a8] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: lc ? lc.bg : '#fff4ec' }}>
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
          {goal && (
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0 mt-1.5 text-[9px]" style={barlow}>
              {currentGrade ? (
                <span className="font-bold" style={{ color: gradeIs90d ? gradeColor(currentGrade, gradeSystem) : '#bbbcc8' }}>
                  {currentGrade}{!gradeIs90d ? ' (all time)' : ''}
                </span>
              ) : (
                <span style={{ color: '#bbbcc8' }}>no recent data</span>
              )}
              <span style={{ color: '#bbbcc8' }}>→</span>
              <span className="font-bold" style={{ color: '#d97706' }}>{goal.target}</span>
              <span style={{ color: '#bbbcc8' }}>·</span>
              <span style={{ color: '#7a8299' }}>{goalSends || 0} {(goalSends || 0) === 1 ? 'send' : 'sends'} (90d)</span>
              {goalDays !== null && (
                <>
                  <span style={{ color: '#bbbcc8' }}>·</span>
                  <span className="font-bold" style={{ color: goalDays < 0 ? '#ef4444' : goalDays <= 7 ? '#ef4444' : goalDays <= 30 ? '#d97706' : '#7a8299' }}>
                    {goalDays < 0 ? 'overdue' : goalDays === 0 ? 'today!' : goalDays + 'd'}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
