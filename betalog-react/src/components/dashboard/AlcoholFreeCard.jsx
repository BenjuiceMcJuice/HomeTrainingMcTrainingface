import { Droplets } from 'lucide-react'
import { calcAlcoholFreeStreak } from '../../lib/stats'
import { barlow } from '../../lib/utils'

export default function AlcoholFreeCard({ drinkEntries }) {
  const streak = calcAlcoholFreeStreak(drinkEntries)
  const accent = '#2a9d5c'

  let primary, secondary
  if (streak.months >= 1) {
    primary   = streak.months + (streak.months === 1 ? ' month' : ' months')
    secondary = streak.days + ' days'
  } else if (streak.weeks >= 1) {
    primary   = streak.weeks + (streak.weeks === 1 ? ' week' : ' weeks')
    secondary = streak.days + ' days'
  } else {
    primary   = streak.days + (streak.days === 1 ? ' day' : ' days')
    secondary = null
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  let weekKcal = 0, hasKcal = false
  ;(drinkEntries || []).forEach(e => {
    if (e.date >= cutoffStr && e.kcal) { weekKcal += e.kcal; hasKcal = true }
  })

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#edfaf2' }}>
          <Droplets size={16} style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{primary}</span>
            {secondary && <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{secondary}</span>}
          </div>
          <p className="text-[11px] text-[#7a8299] mt-0.5">alcohol-free</p>
          {hasKcal && (
            <p className="text-[10px] text-[#bbbcc8] mt-0.5" style={barlow}>
              this week: ~{weekKcal} kcal from drinks
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
