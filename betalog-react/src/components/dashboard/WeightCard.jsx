import { Scale, ArrowUpRight, ArrowDownRight, Minus, Target } from 'lucide-react'
import { barlow, daysAgo } from '../../lib/utils'

const BMI_CATS = [
  { max: 18.5,     label: 'Underweight', color: '#4f7ef8', bg: '#eef1ff' },
  { max: 25,       label: 'Healthy',     color: '#2a9d5c', bg: '#edfaf2' },
  { max: 30,       label: 'Overweight',  color: '#d97706', bg: '#fffbeb' },
  { max: Infinity, label: 'Obese',       color: '#ef4444', bg: '#fef2f2' },
]

const bmiCategory = (bmi) => {
  for (let i = 0; i < BMI_CATS.length; i++) {
    if (bmi < BMI_CATS[i].max) return BMI_CATS[i]
  }
  return BMI_CATS[BMI_CATS.length - 1]
}

export default function WeightCard({ profile, weightEntries, goals }) {
  if (!profile) return null

  const h = profile.heightCm || 0
  const currentEntry = weightEntries.length > 0 ? weightEntries[0] : null
  const w = currentEntry ? currentEntry.weight : (profile.weightKg || 0)
  if (!w) return null

  const bmi    = h > 0 && w > 0 ? w / ((h / 100) * (h / 100)) : null
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
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#f4f5f9' }}>
          <Scale size={16} style={{ color: '#7a8299' }} />
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
          {goalDiff !== null && (
            <div className="flex items-center gap-1 mt-0.5">
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
          )}
        </div>
      </div>
    </div>
  )
}
