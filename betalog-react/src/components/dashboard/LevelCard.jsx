import { LEVEL_COLOR, gradeColor, gradeGoalProgress } from '../../lib/stats'
import { barlow } from '../../lib/utils'
import WidgetShell from './WidgetShell'
import useWidgetWindow from '../../hooks/useWidgetWindow'
import { GradeChart, Legend } from './GradeChart'

const V_GRADES_DASH      = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']
const FRENCH_GRADES_DASH = ['4','5','5+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c']

export { V_GRADES_DASH, FRENCH_GRADES_DASH }

// Shared by the grade bars and their legend
const ACCENT = '#c0622a'

function GradeChip({ grade, gradeSystem }) {
  if (!grade) return null
  return <span className="font-bold" style={{ ...barlow, color: gradeColor(grade, gradeSystem) }}>{grade}</span>
}

export default function LevelCard({ label, icon, peakStats, currentStats, gradeSystem, goal, goalSends, widgetKey, editMode }) {
  // The bars carry their own window, defaulting to 90 days, and it persists
  // per card in the profile like every other widget window — flipping to all
  // time used to be undone by the next reload.
  const { window: view, options: viewOptions, setWindow: setView } = useWidgetWindow(widgetKey)

  // Declared before the early return below — hooks must run in the same order
  // on every render, and this component bails out when there is no data.
  if (!peakStats || !peakStats.hasData) return null

  const lc        = peakStats.consistent ? (LEVEL_COLOR[peakStats.consistent.level] || LEVEL_COLOR.Beginner) : null
  const currentLc = currentStats?.consistent ? (LEVEL_COLOR[currentStats.consistent.level] || LEVEL_COLOR.Beginner) : null
  const samePeak  = peakStats.consistent && currentStats?.consistent && peakStats.consistent.grade === currentStats.consistent.grade

  const s = (currentStats?.hasData) ? currentStats : peakStats


  const shown = (view === '90d' ? currentStats : peakStats) || { hasData: false, gradeMap: {} }

  // 90d consistent if available, else all-time fallback
  const currentGrade  = currentStats?.consistent?.grade || peakStats?.consistent?.grade || null
  const gradeIs90d    = !!currentStats?.consistent?.grade

  // Declared after currentGrade on purpose — it reads it, and `const` in the
  // temporal dead zone throws rather than reading undefined.
  const sendCount    = goalSends || 0
  const reached      = sendCount > 0
  const goalProgress = goal
    ? (reached ? 1 : gradeGoalProgress(goal.startValue, currentGrade, goal.target, gradeSystem))
    : 0

  // Days remaining on goal
  const goalDays = (() => {
    if (!goal?.targetDate) return null
    const today  = new Date(); today.setHours(0, 0, 0, 0)
    const target = new Date(goal.targetDate + 'T00:00:00')
    return Math.round((target - today) / 86400000)
  })()

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: lc ? lc.bg : '#fff4ec' }}>
          {icon}
        </div>
        <WidgetShell widgetKey={widgetKey} editMode={editMode} className="flex-1 min-w-0" header={
          <>
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
            <div className="mt-2 pt-2 border-t border-[#f0f1f5]">
              <div className="flex items-baseline gap-1.5 flex-wrap" style={barlow}>
                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#bbbcc8' }}>Goal</span>
                {currentGrade ? (
                  <span className="text-[10px] font-bold" style={{ color: gradeIs90d ? gradeColor(currentGrade, gradeSystem) : '#bbbcc8' }}>
                    {currentGrade}{!gradeIs90d ? ' (all time)' : ''}
                  </span>
                ) : (
                  <span className="text-[10px]" style={{ color: '#bbbcc8' }}>no recent data</span>
                )}
                <span style={{ color: '#bbbcc8' }}>→</span>
                <span className="text-xs font-black" style={{ color: '#d97706' }}>{goal.target}</span>
                {goalDays !== null && (
                  <span className="text-[9px] font-bold ml-auto" style={{ color: goalDays < 0 ? '#ef4444' : goalDays <= 7 ? '#ef4444' : goalDays <= 30 ? '#d97706' : '#7a8299' }}>
                    {goalDays < 0 ? 'overdue' : goalDays === 0 ? 'due today!' : goalDays + 'd left'}
                  </span>
                )}
              </div>

              <div className="rounded-full overflow-hidden mt-1.5" style={{ height: '4px', background: '#f0f1f5' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: Math.round(goalProgress * 100) + '%', background: reached ? '#2a9d5c' : '#d97706' }}
                />
              </div>

              {/* Spelling out what the count measures — "0 sends" alone read as a
                  judgement rather than a counter, and never said at what grade. */}
              <p className="text-[9px] mt-1" style={{ ...barlow, color: reached ? '#2a9d5c' : '#7a8299' }}>
                {sendCount > 0
                  ? sendCount + (sendCount === 1 ? ' send' : ' sends') + ' at ' + goal.target + ' or harder in the last 90 days'
                  : 'No sends at ' + goal.target + ' or harder in the last 90 days'}
              </p>
            </div>
          )}
          </>
        }>
          <div className="mt-2">
            {/* The toggle is what tells you which window the bars cover, so it
                stays visible even when the selected one is empty. */}
            <div className="flex items-center gap-0.5 mb-1.5">
              {viewOptions.map(function (key) {
                var active = view === key
                return (
                  <button
                    key={key}
                    onClick={function () { setView(key) }}
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold leading-none transition-colors"
                    style={{
                      ...barlow,
                      background: active ? ACCENT : '#fdf3ec',
                      color:      active ? '#fff' : ACCENT,
                    }}
                  >
                    {key === 'all' ? 'All time' : key}
                  </button>
                )
              })}
            </div>
            {shown.hasData ? (
              <>
                <GradeChart
                  gradeMap={shown.gradeMap}
                  gradeOrder={gradeSystem === 'v' ? V_GRADES_DASH : FRENCH_GRADES_DASH}
                  accentColor={ACCENT}
                  gradeSystem={gradeSystem}
                />
                <Legend accentColor={ACCENT} />
              </>
            ) : (
              <p className="text-[11px] text-[#bbbcc8]" style={barlow}>
                {view === '90d' ? 'No climbs in the last 90 days' : 'No climbs logged'}
              </p>
            )}
          </div>
        </WidgetShell>
      </div>
    </div>
  )
}
