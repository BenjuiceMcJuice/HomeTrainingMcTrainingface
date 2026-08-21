import { Scale, ArrowUpRight, ArrowDownRight, Minus, Target } from 'lucide-react'
import { barlow, daysAgo } from '../../lib/utils'
import { bmiCategory, calcBMI } from '../../lib/stats'

export default function WeightCard({ profile, weightEntries, goals }) {
  if (!profile) return null

  const h = profile.heightCm || 0
  const currentEntry = weightEntries.length > 0 ? weightEntries[0] : null
  const w = currentEntry ? currentEntry.weight : (profile.weightKg || 0)
  if (!w) return null

  const bmi    = calcBMI(w, h)
  const bmiCat = bmi ? bmiCategory(bmi) : null

  const cutoff = daysAgo(30)
  let sum = 0, count = 0
  weightEntries.forEach(e => {
    if (e.date >= cutoff) { sum += e.weight; count++ }
  })
  const avg  = count >= 2 ? sum / count : null
  const diff = avg !== null ? w - avg : null

  const weightGoal = (goals || []).find(g => g.type === 'weight' && !g.achieved) || null
  const goalDiff   = weightGoal ? (w - Number(weightGoal.target)) : null

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#edfaf2' }}>
          <Scale size={16} style={{ color: '#2a9d5c' }} />
        </div>
        <div className="flex-1 min-w-0">
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
                <ArrowDownRight size={12} style={{ color: '#2a9d5c' }} />
              ) : (
                <Minus size={12} style={{ color: '#7a8299' }} />
              )}
              <span className="text-[11px] text-[#7a8299]">
                {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg vs 30d avg ({avg.toFixed(1)})
              </span>
            </div>
          )}
          {goalDiff !== null && (() => {
            const start    = Number(weightGoal.startValue) || w
            const target   = Number(weightGoal.target)
            const losing   = target < start
            const progress = start === target ? 1
              : losing
                ? Math.min(1, Math.max(0, (start - w) / (start - target)))
                : Math.min(1, Math.max(0, (w - start) / (target - start)))
            const pct = Math.round(progress * 100)
            return (
              <div className="mt-1">
                <div className="flex items-center gap-1 mb-1">
                  <Target size={12} style={{ color: '#d4742a' }} />
                  <span className="text-[11px] text-[#7a8299]">
                    {'Goal: ' + weightGoal.target + ' kg · '}
                    {Math.abs(goalDiff) < 0.1
                      ? 'on target'
                      : goalDiff > 0
                        ? goalDiff.toFixed(1) + ' kg to lose'
                        : Math.abs(goalDiff).toFixed(1) + ' kg to gain'}
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
        </div>
      </div>
    </div>
  )
}
