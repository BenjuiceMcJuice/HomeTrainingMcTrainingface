import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { todayStr } from '../../lib/stats'
import { barlow, daysAgo } from '../../lib/utils'

const LOAD_ZONES = [
  { max: 0,        label: 'Inactive',     color: '#7a8299', bg: '#f4f5f9' },
  { max: 0.8,      label: 'Easing off',   color: '#4f7ef8', bg: '#eef1ff' },
  { max: 1.3,      label: 'Sweet spot',   color: '#2a9d5c', bg: '#edfaf2' },
  { max: Infinity, label: 'Pushing hard', color: '#ef4444', bg: '#fef2f2' },
]

// Need at least this many sessions in the chronic window before a ratio is meaningful —
// otherwise a single new session balloons the ratio on a near-empty baseline.
const MIN_CHRONIC_SESSIONS = 4

const calcLoad = (sessions, fromDate, toDate) => {
  let count = 0, totalDiff = 0
  sessions.forEach(s => {
    if (s.date >= fromDate && s.date <= toDate) {
      count++
      totalDiff += (s.difficulty || 3)
    }
  })
  if (count === 0) return { count: 0, avgDiff: 0, load: 0 }
  const avgDiff = totalDiff / count
  return { count, avgDiff, load: count * avgDiff }
}

const getZone = (ratio) => {
  if (ratio === null) return { label: 'Building baseline', color: '#7a8299', bg: '#f4f5f9' }
  for (let i = 0; i < LOAD_ZONES.length; i++) {
    if (ratio <= LOAD_ZONES[i].max) return LOAD_ZONES[i]
  }
  return LOAD_ZONES[LOAD_ZONES.length - 1]
}

export default function TrainingLoad({ sessions }) {
  const today = todayStr()

  const acuteFrom = daysAgo(6)
  const acute     = calcLoad(sessions, acuteFrom, today)

  const chronicFrom = daysAgo(30)
  const chronicTo   = daysAgo(7)
  const chronic     = calcLoad(sessions, chronicFrom, chronicTo)

  const chronicPer7 = chronic.load > 0 ? (chronic.load / 23) * 7 : 0
  const hasBaseline = chronic.count >= MIN_CHRONIC_SESSIONS && chronicPer7 > 0
  const ratio = hasBaseline ? acute.load / chronicPer7 : null
  const zone  = ratio === null && acute.count === 0
    ? { label: 'No sessions yet', color: '#7a8299', bg: '#f4f5f9' }
    : getZone(ratio)

  let arrow = null, arrowLabel = ''
  if (ratio !== null) {
    if (ratio > 1.05) {
      arrow = <ArrowUpRight size={18} style={{ color: zone.color }} />
      arrowLabel = '+' + Math.round((ratio - 1) * 100) + '%'
    } else if (ratio < 0.95) {
      arrow = <ArrowDownRight size={18} style={{ color: zone.color }} />
      arrowLabel = Math.round((ratio - 1) * 100) + '%'
    } else {
      arrow = <Minus size={18} style={{ color: zone.color }} />
      arrowLabel = 'Steady'
    }
  } else if (acute.count > 0) {
    arrow = <ArrowUpRight size={18} style={{ color: '#2a9d5c' }} />
    arrowLabel = 'New'
  }

  let explainer = ''
  if (acute.count > 0) {
    if (ratio === null)    explainer = 'Keep logging — we need a few weeks of data to compare against.'
    else if (ratio <= 0.8) explainer = 'Your last 7 days are lighter than your recent average. Good if recovering, otherwise time to get after it.'
    else if (ratio <= 1.3) explainer = 'Your last 7 days are in line with your recent average. Consistent effort — keep it up.'
    else                   explainer = 'Your last 7 days are significantly above your recent average. Great for a push week, but watch for fatigue.'
  }

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: zone.bg }}>
            {arrow}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#1a1d2e] text-sm" style={barlow}>{zone.label}</p>
            <p className="text-xs text-[#7a8299]">
              {acute.count > 0 ? (
                <>
                  {acute.count} session{acute.count !== 1 ? 's' : ''} · avg effort {acute.avgDiff.toFixed(1)}
                  <span className="text-[#bbbcc8]"> · last 7 days</span>
                </>
              ) : (
                'Log sessions to track your training load'
              )}
            </p>
          </div>
          {arrowLabel && (
            <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: zone.bg, color: zone.color, ...barlow }}>
              {arrowLabel}
            </span>
          )}
        </div>
        {explainer && (
          <p className="text-[11px] text-[#7a8299] mt-2.5 pt-2.5 border-t border-[#f0f1f5] leading-relaxed">
            {explainer}
          </p>
        )}
      </div>
    </div>
  )
}
