import { useState } from 'react'
import { Scale, ArrowUpRight, ArrowDownRight, Minus, Target } from 'lucide-react'
import WidgetShell from './WidgetShell'
import TrendTimeline from './TrendTimeline'
import { barlow } from '../../lib/utils'
import { bmiCategory, calcBMI, buildAverageTimeline, pctOfBodyweight, WINDOW_BUCKET_MODE } from '../../lib/stats'
import { buildTrendGeometry } from '../../lib/trendChart'
import useWidgetWindow from '../../hooks/useWidgetWindow'

const ACCENT = '#2a9d5c'

/** One decimal, but only when there is one — "78 kg", not "78.0 kg". */
function kg(v) {
  return (Math.round(v * 10) / 10).toString()
}

export default function WeightCard({ profile, weightEntries, goals, editMode }) {
  // Hooks run before the early returns below — they must run in the same order
  // on every render, and this component bails out when there is no weight.
  const { window: activeWindow, options, setWindow } = useWidgetWindow('weight')
  const [picked, setPicked] = useState(null)

  if (!profile) return null

  const h = profile.heightCm || 0
  const entries = weightEntries || []
  const currentEntry = entries.length > 0 ? entries[0] : null
  const w = currentEntry ? currentEntry.weight : (profile.weightKg || 0)
  if (!w) return null

  const bmi    = calcBMI(w, h)
  const bmiCat = bmi ? bmiCategory(bmi) : null

  // One point per bucket, averaged — three weigh-ins in a week are one reading
  // of where you are, not three, and averaging them is what stops the line
  // zigzagging through the noise.
  const mode     = WINDOW_BUCKET_MODE[activeWindow] || 'day'
  const timeline = buildAverageTimeline(entries, mode, e => e.weight)
  const buckets  = timeline.buckets.map(b => Object.assign({}, b, { value: b.avg }))

  const avg  = timeline.count >= 2 ? timeline.avg : null
  const diff = avg !== null ? w - avg : null
  const change = timeline.count >= 2 ? Math.round((timeline.last - timeline.first) * 10) / 10 : null

  const weightGoal = (goals || []).find(g => g.type === 'weight' && !g.achieved) || null
  const goalDiff   = weightGoal ? (w - Number(weightGoal.target)) : null
  const target     = weightGoal ? Number(weightGoal.target) : null
  // What is left, as a share of the body it is coming off. 1.8 kg is a
  // different ask at 60 kg than at 110 kg, and the kg figure alone never says
  // which one you are.
  const goalPct    = goalDiff !== null ? pctOfBodyweight(goalDiff, w) : null

  const pickedBucket = picked !== null && buckets[picked] ? buckets[picked] : null

  // The same geometry the chart draws, asked one question: did the goal make it
  // onto the axis? Recomputing beats re-deriving the rule here and having the
  // caption disagree with the line.
  const geo = buildTrendGeometry(buckets.map(b => b.value), { target: target })

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#edfaf2' }}>
          <Scale size={16} style={{ color: ACCENT }} />
        </div>
        <WidgetShell widgetKey="weight" editMode={editMode} className="flex-1 min-w-0" header={
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{w} kg</span>
              {bmiCat && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: bmiCat.bg, color: bmiCat.color, ...barlow }}>
                  BMI {bmi.toFixed(1)} · {bmiCat.label}
                </span>
              )}
            </div>
            {diff !== null && (
              <div className="flex items-center gap-1 mt-0.5">
                {diff > 0.2 ? (
                  <ArrowUpRight size={12} style={{ color: '#ef4444' }} />
                ) : diff < -0.2 ? (
                  <ArrowDownRight size={12} style={{ color: ACCENT }} />
                ) : (
                  <Minus size={12} style={{ color: '#7a8299' }} />
                )}
                <span className="text-[11px] text-[#7a8299]">
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg vs {activeWindow} avg ({avg.toFixed(1)})
                </span>
              </div>
            )}
            {goalDiff !== null && (() => {
              const start    = Number(weightGoal.startValue) || w
              const goalTgt  = Number(weightGoal.target)
              const losing   = goalTgt < start
              const progress = start === goalTgt ? 1
                : losing
                  ? Math.min(1, Math.max(0, (start - w) / (start - goalTgt)))
                  : Math.min(1, Math.max(0, (w - start) / (goalTgt - start)))
              const pct = Math.round(progress * 100)
              return (
                <div className="mt-1">
                  <div className="flex items-center gap-1 mb-1">
                    <Target size={12} style={{ color: '#d4742a' }} />
                    <span className="text-[11px] text-[#7a8299]">
                      {'Goal: ' + weightGoal.target + ' kg · '}
                      {Math.abs(goalDiff) < 0.1
                        ? 'on target'
                        : Math.abs(goalDiff).toFixed(1) + ' kg' + (goalPct !== null ? ' (' + goalPct + '%)' : '')
                          + (goalDiff > 0 ? ' to lose' : ' to gain')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-full overflow-hidden" style={{ height: '4px', background: '#e5e7ef' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: '#d4742a' }} />
                    </div>
                    <span className="text-[9px] font-bold shrink-0" style={{ ...barlow, color: '#d4742a' }}>{pct}%</span>
                  </div>
                </div>
              )
            })()}
          </>
        }>
          {/* Window chips head the body, because the body is what they change —
              and the header is the collapse control, which can't hold buttons. */}
          <div className="flex items-center gap-0.5 mt-1.5">
            {options.map((wOpt) => {
              const active = wOpt === activeWindow
              return (
                <button
                  key={wOpt}
                  onClick={() => { setPicked(null); setWindow(wOpt) }}
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold leading-none transition-colors"
                  style={{
                    ...barlow,
                    background: active ? ACCENT : '#edfaf2',
                    color:      active ? '#fff' : ACCENT,
                  }}
                >
                  {wOpt}
                </button>
              )
            })}
          </div>

          <TrendTimeline
            buckets={buckets}
            accentColor={ACCENT}
            unitLabel="kg"
            target={target}
            targetLabel={target !== null ? kg(target) : null}
            format={kg}
            cardBg="#ffffff"
            selected={picked}
            onSelect={setPicked}
            gap={mode === 'day' ? 2 : 3}
            labelMode={mode === 'day' ? 'edges' : 'step'}
            labelStep={mode === 'week' ? 3 : 2}
            endLabel="today"
          />

          {timeline.count === 0
            ? <p className="text-[11px] text-[#bbbcc8] mt-1" style={barlow}>No weigh-ins in the last {activeWindow} — log one on Log › Health</p>
            : pickedBucket
              // Selecting a point turns the summary line into that bucket's readout
              ? <p className="text-[11px] text-[#1a1d2e] mt-1 truncate" style={barlow}>
                  {pickedBucket.fullLabel} · {kg(pickedBucket.avg)} kg
                  {pickedBucket.count > 1 ? ' avg of ' + pickedBucket.count + ' weigh-ins' : ''}
                </p>
              : <p className="text-[11px] text-[#7a8299] mt-1 truncate" style={barlow}>
                  {timeline.count === 1
                    ? '1 weigh-in in the last ' + activeWindow
                    : timeline.count + ' weigh-ins · ' + kg(timeline.min) + '–' + kg(timeline.max) + ' kg'}
                </p>
          }
          {change !== null && !pickedBucket && (
            <p className="text-[10px] mt-0.5" style={{ ...barlow, color: change > 0.1 ? '#ef4444' : change < -0.1 ? ACCENT : '#bbbcc8' }}>
              {Math.abs(change) < 0.1
                ? 'Level over the last ' + activeWindow
                : (change > 0 ? 'Up ' : 'Down ') + kg(Math.abs(change)) + ' kg over the last ' + activeWindow}
            </p>
          )}
          {/* The goal is on the chart when it is near enough to share the scale.
              When it is not, the axis would be all empty air, so it is said in
              words instead — the header carries the progress bar either way. */}
          {target !== null && timeline.count > 0 && (
            <p className="text-[10px] text-[#bbbcc8] mt-0.5" style={barlow}>
              {geo.targetShown
                ? 'Dashed line: ' + kg(target) + ' kg goal'
                : 'Goal ' + kg(target) + ' kg is off this scale'}
            </p>
          )}
        </WidgetShell>
      </div>
    </div>
  )
}
