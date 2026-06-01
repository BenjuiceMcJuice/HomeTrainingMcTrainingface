import { Droplets, Flame, Star, Trophy, Zap, Crown } from 'lucide-react'
import { calcAlcoholFreeStreak } from '../../lib/stats'
import { barlow } from '../../lib/utils'

var TIERS = [
  {
    minDays: 180,
    bg: 'linear-gradient(135deg, #fdf4ff 0%, #eff6ff 45%, #ecfdf5 100%)',
    border: '#a78bfa',
    accent: '#6d28d9',
    iconBg: 'linear-gradient(135deg, #ede9fe, #dbeafe, #d1fae5)',
    Icon: Crown,
    shimmer: 'linear-gradient(90deg, transparent 0%, rgba(167,139,250,0.25) 25%, rgba(96,165,250,0.25) 50%, rgba(74,222,128,0.2) 75%, transparent 100%)',
    label: 'six months · alcohol-free',
  },
  {
    minDays: 90,
    bg: '#fff7ed',
    border: '#fb923c',
    accent: '#c2410c',
    iconBg: '#ffedd5',
    Icon: Flame,
    shimmer: 'linear-gradient(90deg, transparent 0%, rgba(251,146,60,0.35) 50%, transparent 100%)',
    label: 'three months · alcohol-free',
  },
  {
    minDays: 60,
    bg: '#fff1f2',
    border: '#fb7185',
    accent: '#be123c',
    iconBg: '#ffe4e6',
    Icon: Trophy,
    shimmer: 'linear-gradient(90deg, transparent 0%, rgba(251,113,133,0.4) 50%, transparent 100%)',
    label: 'two months · alcohol-free',
  },
  {
    minDays: 30,
    bg: '#fffbeb',
    border: '#fbbf24',
    accent: '#b45309',
    iconBg: '#fef3c7',
    Icon: Star,
    shimmer: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.45) 50%, transparent 100%)',
    label: 'one month · alcohol-free',
  },
  {
    minDays: 14,
    bg: '#f5f3ff',
    border: '#c4b5fd',
    accent: '#6d28d9',
    iconBg: '#ede9fe',
    Icon: Zap,
    shimmer: 'linear-gradient(90deg, transparent 0%, rgba(196,181,253,0.4) 50%, transparent 100%)',
    label: 'fortnight · alcohol-free',
  },
  {
    minDays: 7,
    bg: '#eff6ff',
    border: '#93c5fd',
    accent: '#1d4ed8',
    iconBg: '#dbeafe',
    Icon: Droplets,
    shimmer: 'linear-gradient(90deg, transparent 0%, rgba(147,197,253,0.4) 50%, transparent 100%)',
    label: 'one week · alcohol-free',
  },
]

var DEFAULT_TIER = {
  bg: '#ffffff',
  border: '#e5e7ef',
  accent: '#2a9d5c',
  iconBg: '#edfaf2',
  Icon: Droplets,
  shimmer: null,
  label: 'alcohol-free',
}

function getTier(days) {
  for (var i = 0; i < TIERS.length; i++) {
    if (days >= TIERS[i].minDays) return TIERS[i]
  }
  return DEFAULT_TIER
}

export default function AlcoholFreeCard({ drinkEntries }) {
  var streak = calcAlcoholFreeStreak(drinkEntries)
  var tier = getTier(streak.days)
  var isMilestone = tier !== DEFAULT_TIER

  var primary, secondary
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

  var cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  var cutoffStr = cutoff.toISOString().slice(0, 10)
  var weekKcal = 0, hasKcal = false
  ;(drinkEntries || []).forEach(function(e) {
    if (e.date >= cutoffStr && e.kcal) { weekKcal += e.kcal; hasKcal = true }
  })

  return (
    <div className="px-4">
      <style>{`
        @keyframes al-shimmer {
          0%   { transform: translateX(-110%); }
          100% { transform: translateX(210%); }
        }
        @keyframes al-icon-pop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.28); }
          65%  { transform: scale(0.93); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3 relative overflow-hidden"
        style={{
          background: tier.bg,
          border: '1px solid ' + tier.border,
        }}
      >
        {isMilestone && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              borderRadius: 16,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '55%',
                background: tier.shimmer,
                animation: 'al-shimmer 1.1s cubic-bezier(0.4,0,0.2,1) forwards',
              }}
            />
          </div>
        )}

        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: tier.iconBg,
            animation: isMilestone ? 'al-icon-pop 0.55s ease-out' : 'none',
            animationDelay: isMilestone ? '0.15s' : '0s',
            animationFillMode: 'both',
          }}
        >
          <tier.Icon size={16} style={{ color: tier.accent }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{primary}</span>
            {secondary && <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{secondary}</span>}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: isMilestone ? tier.accent : '#7a8299', opacity: isMilestone ? 0.85 : 1 }}>
            {tier.label}
          </p>
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
