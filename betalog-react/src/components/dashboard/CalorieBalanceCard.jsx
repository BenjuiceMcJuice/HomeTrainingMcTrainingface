import { Flame, Droplets, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { getMETRange, estimateCalories } from '../../lib/stats'
import { barlow, daysAgo } from '../../lib/utils'

export default function CalorieBalanceCard({ sessions, drinkEntries, weightEntries, profileWeight }) {
  const cutoff = daysAgo(6)

  const sortedWeights = (weightEntries || []).slice().sort((a, b) => b.date > a.date ? 1 : -1)

  let burnedKcal = 0, hasBurned = false
  sessions.filter(s => s.type === 'cardio' && s.date >= cutoff).forEach(s => {
    let low = s.cardioKcalLow, high = s.cardioKcalHigh
    if (!(low && high) && s.cardioDurationMins && s.difficulty) {
      const metRange = getMETRange(s.cardioActivity, s.cardioStrokeType || null, s.difficulty, s.cardioSportKey || null)
      if (metRange) {
        let wkg = null
        for (let i = 0; i < sortedWeights.length; i++) {
          if (sortedWeights[i].date <= s.date) { wkg = sortedWeights[i].weight; break }
        }
        if (!wkg && profileWeight) wkg = profileWeight
        if (wkg) { const kcal = estimateCalories(metRange, wkg, s.cardioDurationMins); low = kcal.low; high = kcal.high }
      }
    }
    if (low && high) { burnedKcal += Math.round((low + high) / 2); hasBurned = true }
  })

  let consumedKcal = 0, hasConsumed = false
  ;(drinkEntries || []).filter(e => e.date >= cutoff && e.kcal).forEach(e => {
    consumedKcal += e.kcal; hasConsumed = true
  })

  if (!hasBurned && !hasConsumed) return null

  const net      = burnedKcal - consumedKcal
  const netColor = net > 0 ? '#2a9d5c' : net < 0 ? '#ef4444' : '#7a8299'
  const NetIcon  = net > 0 ? ArrowUpRight : net < 0 ? ArrowDownRight : Minus
  const netLabel = net > 0 ? '+' + net.toLocaleString() + ' kcal' : net < 0 ? '−' + Math.abs(net).toLocaleString() + ' kcal' : 'balanced'

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flame size={12} style={{ color: '#2a9d5c' }} className="shrink-0" />
            <span className="text-sm font-black text-[#1a1d2e]" style={barlow}>{hasBurned ? burnedKcal.toLocaleString() : '—'}</span>
            <span className="text-[9px] text-[#7a8299]" style={barlow}>burned</span>
          </div>
          <span className="text-[#e5e7ef] text-xs">·</span>
          <div className="flex items-center gap-1.5">
            <Droplets size={12} style={{ color: '#f97316' }} className="shrink-0" />
            <span className="text-sm font-black text-[#1a1d2e]" style={barlow}>{hasConsumed ? consumedKcal.toLocaleString() : '—'}</span>
            <span className="text-[9px] text-[#7a8299]" style={barlow}>drank</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <NetIcon size={12} style={{ color: netColor }} />
            <span className="text-[10px] font-bold" style={{ ...barlow, color: netColor }}>{netLabel}</span>
          </div>
        </div>
        <p className="text-[9px] text-[#bbbcc8] mt-0.5" style={barlow}>last 7 days</p>
      </div>
    </div>
  )
}
