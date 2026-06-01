import { Activity } from 'lucide-react'
import { getMETRange, estimateCalories } from '../../lib/stats'
import { barlow, daysAgo, capitalise, fmtDuration, fmtDist, sessionDistKm } from '../../lib/utils'

const ACTIVITY_LABEL = {
  swim: 'Swim', run: 'Run', cycle: 'Cycle', row: 'Row',
  walk: 'Walk', sport: 'Sport', other: 'Other',
}

const CARDIO_GOAL_TYPES = ['run', 'swim', 'cycle']

export default function CardioStatsCard({ sessions, weightEntries, profileWeight, goals }) {
  const cutoff = daysAgo(89)
  const cardio = sessions.filter(s => s.type === 'cardio' && s.date >= cutoff)
  if (cardio.length === 0) return null

  let totalMins = 0
  const byType  = {}

  cardio.forEach(s => {
    const act = s.cardioActivity || 'other'
    if (!byType[act]) byType[act] = { count: 0, distKm: 0, hasKm: false }
    byType[act].count++
    totalMins += s.cardioDurationMins || 0
    const km = sessionDistKm(s)
    if (km !== null) { byType[act].distKm += km; byType[act].hasKm = true }
  })

  const types  = Object.keys(byType).sort((a, b) => byType[b].count - byType[a].count)
  const detail = types.map(act => {
    const t    = byType[act]
    let part = (ACTIVITY_LABEL[act] || capitalise(act)) + ' ' + t.count
    if (t.hasKm) part += ' · ' + fmtDist(t.distKm)
    return part
  }).join('  ·  ')

  const sortedWeights = (weightEntries || []).slice().sort((a, b) => b.date > a.date ? 1 : -1)
  let totalKcalMid = 0, hasKcal = false
  cardio.forEach(s => {
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
    if (low && high) { totalKcalMid += Math.round((low + high) / 2); hasKcal = true }
  })

  const activeCardioGoals = (goals || []).filter(g => !g.achieved && CARDIO_GOAL_TYPES.includes(g.type))
  const goalRows = activeCardioGoals.map(g => {
    let best = null
    sessions.forEach(s => {
      if (s.type === 'cardio' && s.cardioActivity === g.type && s.cardioQuantity) {
        if (best === null || s.cardioQuantity > best) best = s.cardioQuantity
      }
    })
    const start    = Number(g.startValue) || 0
    const target   = Number(g.target)
    const current  = best !== null ? best : start
    const progress = start >= target ? (current >= target ? 1 : 0)
      : Math.min(1, Math.max(0, (current - start) / (target - start)))
    const pct = Math.round(progress * 100)
    const label = (ACTIVITY_LABEL[g.type] || capitalise(g.type)) + ' goal'
    const color = g.type === 'run' ? '#2a9d5c' : g.type === 'cycle' ? '#8b5cf6' : '#0891b2'
    return { g, label, pct, current, color }
  })

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#ecfdf5' }}>
          <Activity size={16} style={{ color: '#0d9488' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{cardio.length}</span>
            <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>sessions</span>
            <span className="text-[9px] text-[#bbbcc8]" style={barlow}>· last 90 days</span>
            {totalMins > 0 && (
              <span className="text-[10px] font-bold ml-auto" style={{ ...barlow, color: '#0d9488' }}>
                {fmtDuration(totalMins)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#7a8299] mt-0.5 truncate" style={barlow}>{detail}</p>
          {hasKcal && (
            <p className="text-[10px] text-[#bbbcc8] mt-0.5" style={barlow}>~{totalKcalMid.toLocaleString()} kcal burned</p>
          )}
          {goalRows.map(({ g, label, pct, current, color }) => (
            <div key={g.id} className="mt-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>{label}</span>
                <span className="text-[9px] font-bold" style={{ ...barlow, color }}>
                  {fmtDist(current)} / {fmtDist(Number(g.target))} · {pct}%
                </span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: '4px', background: '#e5e7ef' }}>
                <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
