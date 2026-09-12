import { LEVEL_COLOR, gradeColor } from '../../lib/stats'
import { barlow } from '../../lib/utils'
import WidgetShell from './WidgetShell'
import WidgetMark, { WidgetEdge } from './WidgetMark'
import useWidgetWindow from '../../hooks/useWidgetWindow'
import { GradeChart, Legend } from './GradeChart'
import ScoreDots from '../ui/ScoreDots'
import PyramidChart from '../ui/PyramidChart'

const V_GRADES_DASH      = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']
const FRENCH_GRADES_DASH = ['4','5','5+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c']

export { V_GRADES_DASH, FRENCH_GRADES_DASH }

// Shared by the grade bars and their legend
const ACCENT = '#c0622a'

function GradeChip({ grade, gradeSystem }) {
  if (!grade) return null
  return <span className="font-bold" style={{ ...barlow, color: gradeColor(grade, gradeSystem) }}>{grade}</span>
}

export default function LevelCard({ label, icon, accent, peakStats, currentStats, gradeSystem, goal, goalSends, achievability, reading, widgetKey, editMode }) {
  const Icon = icon
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

  // The pyramid reading for this card's goal, built in Dashboard.jsx so it
  // memoises against the log rather than rebuilding on every widget render.
  const readiness = achievability?.readiness || null


  const shown = (view === '90d' ? currentStats : peakStats) || { hasData: false, gradeMap: {} }

  // "Currently" is the pyramid's base grade — the grade you own — read through
  // the one reader in lib/goals.js, the same call Plan › Goals makes. This card
  // used to reimplement a 90d-consistent-else-all-time fallback of its own,
  // which is exactly the two-readings-of-one-log problem the pyramid spec
  // exists to remove; it also skipped MIN_WINDOW_SESSIONS, so three warm-up V1s
  // could report a V4 climber as V1.
  const currentGrade  = reading?.base || null
  const projectGrade  = reading?.project || null

  // Declared after currentGrade on purpose — it reads it, and `const` in the
  // temporal dead zone throws rather than reading undefined.
  const sendCount    = goalSends || 0
  const reached      = sendCount > 0

  // Days remaining on goal
  const goalDays = (() => {
    if (!goal?.targetDate) return null
    const today  = new Date(); today.setHours(0, 0, 0, 0)
    const target = new Date(goal.targetDate + 'T00:00:00')
    return Math.round((target - today) / 86400000)
  })()

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 relative">
        {/* The discipline's colour, not the level's — orange for boulder, blue
            for rope, matching the icon inside it, so the two climbing cards
            read apart at a glance. The level colour would fight the icon and
            is already spelled out in the word beside it. */}
        <WidgetEdge accent={accent} />
        <WidgetShell widgetKey={widgetKey} editMode={editMode} header={
          <>
          <div className="flex items-center gap-1.5">
            <WidgetMark icon={Icon} accent={accent} />
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
                  <span className="text-[10px] font-bold" style={{ color: gradeColor(currentGrade, gradeSystem) }}>
                    {currentGrade}
                  </span>
                ) : (
                  <span className="text-[10px]" style={{ color: '#bbbcc8' }}>
                    no base yet{projectGrade ? ' · project ' + projectGrade : ''}
                  </span>
                )}
                <span style={{ color: '#bbbcc8' }}>→</span>
                <span className="text-xs font-black" style={{ color: '#d97706' }}>{goal.target}</span>
                {goalDays !== null && (
                  <span className="text-[9px] font-bold ml-auto" style={{ color: goalDays < 0 ? '#ef4444' : goalDays <= 7 ? '#ef4444' : goalDays <= 30 ? '#d97706' : '#7a8299' }}>
                    {goalDays < 0 ? 'overdue' : goalDays === 0 ? 'due today!' : goalDays + 'd left'}
                  </span>
                )}
              </div>

              {/* No percentage bar on a grade goal (2026-09-13, BTL-B4). It
                  counted ladder rungs from a `startValue` typed in once and
                  never updated, which assumes progress toward a grade is linear
                  in rungs — the thing the pyramid exists to argue against. It
                  also contradicted the card it sat on: 0% directly above a
                  pyramid reading "Base forming" with three rows populated, which
                  is two readings of one log on one card. The tiers, the
                  readiness label and "log N more X" below say more and are
                  actionable. Weight goals keep their bar; kilograms really are
                  linear. */}

              {/* Spelling out what the count measures — "0 sends" alone read as a
                  judgement rather than a counter, and never said at what grade.
                  The mark rides the end of this line exactly as it rides the
                  weight card's pace line: dots only, no label and no reasons.
                  The words live on the goal, in Plan › Goals (goals spec,
                  "putting the achievability score on screen"). */}
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[9px] min-w-0" style={{ ...barlow, color: reached ? '#2a9d5c' : '#7a8299' }}>
                  {sendCount > 0
                    ? sendCount + (sendCount === 1 ? ' send' : ' sends') + ' at ' + goal.target + ' or harder in the last 90 days'
                    : 'No sends at ' + goal.target + ' or harder in the last 90 days'}
                </p>
                {readiness && (
                  <span className="ml-auto shrink-0">
                    <ScoreDots
                      score={readiness.score}
                      title={readiness.label + ' — open the card for the pyramid'}
                    />
                  </span>
                )}
              </div>
            </div>
          )}
          </>
        }>
          <div className="mt-2">
            {/* The goal's pyramid, above the grade bars. Same component and the
                same call as Plan › Goals, so a goal cannot read one way here and
                another there, and the sentences under it all describe the log
                rather than the climber (docs/specs/betalog_data_honesty_spec.md).

                In the body rather than the header because it is a chart, and the
                shell's contract puts charts in the body — the mark on the goal
                line is what a folded card says. */}
            {readiness && readiness.target && (
              <div className="mb-3 pb-3 border-b border-[#f0f1f5]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-bold tracking-widest uppercase" style={{ ...barlow, color: '#bbbcc8' }}>
                    Base for {readiness.target}
                  </span>
                  <span className="text-[10px] font-bold" style={{ ...barlow, color: accent }}>
                    {readiness.label}
                  </span>
                  {achievability.basis && (
                    <span className="text-[9px] text-[#bbbcc8] ml-auto" style={barlow}>{achievability.basis}</span>
                  )}
                </div>
                <PyramidChart tiers={readiness.tiers} color={accent} />
                {achievability.evidence && (
                  <p className="text-[9px] mt-1.5" style={{ ...barlow, color: readiness.sentTarget ? '#2a9d5c' : '#7a8299' }}>
                    {achievability.evidence}
                  </p>
                )}
                {achievability.nextUp && (
                  <p className="text-[9px] mt-0.5" style={{ ...barlow, color: '#7a8299' }}>
                    {achievability.nextUp}
                  </p>
                )}
                {/* The only thing on this card that knows the deadline. */}
                {achievability.forecastLine && (
                  <p className="text-[9px] font-bold mt-1" style={{
                    ...barlow,
                    color: achievability.forecast && achievability.forecast.onTrack === false
                      ? '#d97706' : '#7a8299',
                  }}>
                    {achievability.forecastLine}
                  </p>
                )}
              </div>
            )}

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
