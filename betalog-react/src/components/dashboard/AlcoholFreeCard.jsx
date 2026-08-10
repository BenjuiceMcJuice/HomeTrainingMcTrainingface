import { useState, useMemo } from 'react'
import { Droplets, Flame, Star, Trophy, Zap, Crown, Clock, TrendingUp, Target, ArrowDownRight, ArrowUpRight, Minus, Wine } from 'lucide-react'
import { calcAlcoholFreeStreak, buildAlcoholTimeline } from '../../lib/stats'
import { barlow } from '../../lib/utils'

// Timeline colours are fixed (not tier-tinted) so the chart reads the same at every streak length
var CHART_H     = 46
var BAR_COLOR   = '#d97706'
var BAR_OVER    = '#e11d48'
var BAR_EMPTY   = 'rgba(26,29,46,0.10)'

var TIMEFRAMES = [
  { mode: 'day',   label: '30d', window: 'last 30 days' },
  { mode: 'week',  label: '12w', window: 'last 12 weeks' },
  { mode: 'month', label: '12m', window: 'last 12 months' },
]

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
    grindNote: null,
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
    grindNote: null,
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
    grindNote: null,
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
    grindNote: null,
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
    grindNote: null,
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
    grindNote: [
      { maxDays: 9,  text: 'second week is sneaky hard. but you already know that.' },
      { maxDays: 13, text: 'so close to a fortnight. don\'t even think about it.' },
    ],
  },
]

// Days 1–6: grind phases
var GRIND_PHASES = [
  {
    maxDays: 1,
    bg: '#fff0ee',
    border: '#fca5a5',
    accent: '#dc2626',
    iconBg: '#fee2e2',
    Icon: Flame,
    label: 'day one. hardest of all.',
    message: 'your body is being very dramatic about this. completely understandably.',
  },
  {
    maxDays: 3,
    bg: '#fff4ed',
    border: '#fdba74',
    accent: '#c2410c',
    iconBg: '#ffedd5',
    Icon: Clock,
    label: 'first 72 hours — you\'re in it.',
    message: '72 hours is where the chemistry actually shifts. you\'re right at the turn.',
  },
  {
    maxDays: 5,
    bg: '#f7fee7',
    border: '#86efac',
    accent: '#15803d',
    iconBg: '#dcfce7',
    Icon: TrendingUp,
    label: 'through the sharpest bit.',
    message: 'sleep might be weird for a bit. totally normal. the worst is behind you.',
  },
  {
    maxDays: 6,
    bg: '#fdf4ff',
    border: '#e879f9',
    accent: '#a21caf',
    iconBg: '#fae8ff',
    Icon: Target,
    label: 'one day from your first milestone.',
    message: 'tomorrow the widget changes. just saying.',
  },
]

// Body/growth facts keyed by minimum streak days — shown as the daily-changing insight
var GROWTH_FACTS = [
  { minDays: 0,   text: 'your liver starts clearing alcohol within hours of stopping.' },
  { minDays: 1,   text: 'liver cell regeneration begins within 24 hours.' },
  { minDays: 2,   text: 'blood pressure measurably drops within 48 hours.' },
  { minDays: 3,   text: 'the toughest chemistry shift — the 72-hour window — is behind you.' },
  { minDays: 4,   text: 'sleep cycles are deepening. the body repairs itself at night.' },
  { minDays: 5,   text: 'dopamine receptors are recalibrating. things will feel more even soon.' },
  { minDays: 6,   text: 'alcohol is a diuretic — that dehydration pressure is easing.' },
  { minDays: 7,   text: 'one week done. liver function has meaningfully improved.' },
  { minDays: 8,   text: 'skin is more hydrated around now. others may notice before you do.' },
  { minDays: 9,   text: 'immune response is strengthening — you\'re less vulnerable to illness.' },
  { minDays: 10,  text: 'acetaldehyde is fully cleared. mental clarity sharpens.' },
  { minDays: 11,  text: 'anxiety that felt like "just you" often starts to lift around here.' },
  { minDays: 12,  text: 'gut microbiome diversity is actively recovering.' },
  { minDays: 13,  text: 'inflammation markers are measurably lower than two weeks ago.' },
  { minDays: 14,  text: 'deep sleep increases and growth hormone surges at night around week two.' },
  { minDays: 15,  text: 'brain fog that felt permanent is clearing. this is the new baseline.' },
  { minDays: 16,  text: 'cardiovascular system is already under less strain.' },
  { minDays: 17,  text: 'liver is producing fewer stress enzymes. it\'s visibly recovering.' },
  { minDays: 18,  text: 'resting heart rate tends to drop noticeably around now.' },
  { minDays: 19,  text: 'reaction times and coordination have improved.' },
  { minDays: 20,  text: 'weight and metabolic rate are stabilising without alcohol calories.' },
  { minDays: 21,  text: 'three weeks. immune system is genuinely rebuilding in earnest.' },
  { minDays: 24,  text: 'energy levels are more consistent across the day — no more dips.' },
  { minDays: 28,  text: 'liver fat has reduced by up to 15%. a month makes a real difference.' },
  { minDays: 30,  text: 'one month. your brain is producing dopamine naturally again.' },
  { minDays: 45,  text: 'six weeks. GI tract has largely recovered and gut health is improving.' },
  { minDays: 60,  text: 'two months. cardiovascular disease risk is measurably lower.' },
  { minDays: 75,  text: 'skin tone, texture, and elasticity have all improved significantly.' },
  { minDays: 90,  text: 'three months. liver function tests often return to the normal range.' },
  { minDays: 120, text: 'four months. bone density loss from alcohol has halted and is reversing.' },
  { minDays: 150, text: 'five months. your kidneys are operating at significantly higher efficiency.' },
  { minDays: 180, text: 'six months. long-term cancer risk is measurably and genuinely reduced.' },
]

function getGrowthFact(days) {
  var best = GROWTH_FACTS[0]
  for (var i = 0; i < GROWTH_FACTS.length; i++) {
    if (days >= GROWTH_FACTS[i].minDays) best = GROWTH_FACTS[i]
    else break
  }
  return best.text
}

function getGrindPhase(days) {
  if (days < 1 || days > 6) return null
  for (var i = 0; i < GRIND_PHASES.length; i++) {
    if (days <= GRIND_PHASES[i].maxDays) return GRIND_PHASES[i]
  }
  return null
}

function getTier(days) {
  for (var i = 0; i < TIERS.length; i++) {
    if (days >= TIERS[i].minDays) return TIERS[i]
  }
  return null
}

/** Which bucket indices get an x-axis label — day mode is handled separately. */
function labelledIndices(mode, count) {
  var step = mode === 'week' ? 3 : 2
  var out  = {}
  for (var i = count - 1; i >= 0; i -= step) out[i] = true
  return out
}

function AlcoholTimeline({ entries, mode, onModeChange, cardBg }) {
  var tl = useMemo(function () { return buildAlcoholTimeline(entries, mode) }, [entries, mode])
  var tf = TIMEFRAMES.filter(function (t) { return t.mode === mode })[0] || TIMEFRAMES[1]
  var [selected, setSelected] = useState(null)

  // A fully dry window has nothing to scale — collapse the chart rather than show empty air
  var isDryWindow = tl.totalUnits === 0
  var chartH      = isDryWindow ? 14 : CHART_H
  var showLine    = !isDryWindow && tl.guideline
  // Extra headroom above the tallest bar so its value label has somewhere to sit
  var scaleMax    = Math.max(tl.maxUnits, tl.guideline || 0, 1) * (isDryWindow ? 1.15 : 1.3)
  var labelled    = labelledIndices(mode, tl.buckets.length)
  var gap         = mode === 'day' ? 2 : 3

  // Peak bar carries a value label — it anchors the top of the scale
  var peakIdx = -1
  if (!isDryWindow) {
    tl.buckets.forEach(function (b, i) { if (b.units === tl.maxUnits) peakIdx = i })
  }

  var picked = selected !== null && tl.buckets[selected] ? tl.buckets[selected] : null
  function toggle(i) { setSelected(function (prev) { return prev === i ? null : i }) }
  function changeMode(m) { setSelected(null); onModeChange(m) }

  var delta     = Math.round((tl.totalUnits - tl.prevUnits) * 10) / 10
  // Only compare against a window the user actually has history for
  var showDelta = tl.hasPrevData
  var deltaUp   = delta > 0.05
  var deltaDown = delta < -0.05
  var deltaColor = deltaDown ? '#2a9d5c' : deltaUp ? '#c2410c' : '#7a8299'
  var DeltaIcon  = deltaDown ? ArrowDownRight : deltaUp ? ArrowUpRight : Minus

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <Wine size={13} style={{ color: BAR_COLOR, alignSelf: 'center' }} />
        <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>
          {picked ? picked.units : tl.totalUnits}
        </span>
        <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>units</span>
        <div className="flex items-center gap-0.5 ml-1">
          {TIMEFRAMES.map(function (t) {
            var active = t.mode === mode
            return (
              <button
                key={t.mode}
                onClick={function () { changeMode(t.mode) }}
                className="rounded px-1 py-0.5 text-[9px] font-bold leading-none transition-colors"
                style={{
                  ...barlow,
                  background: active ? BAR_COLOR : 'rgba(255,255,255,0.65)',
                  color:      active ? '#fff'    : '#92400e',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        {showDelta && !picked && (
          <span className="flex items-center gap-0.5 ml-auto text-[10px] font-bold" style={{ ...barlow, color: deltaColor }}>
            <DeltaIcon size={11} />
            {deltaUp ? '+' : ''}{delta} vs prev
          </span>
        )}
      </div>

      {/* Bars */}
      <div style={{ position: 'relative', marginTop: 8, height: chartH }}>
        {showLine && tl.guideline < scaleMax && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0,
              bottom: (tl.guideline / scaleMax) * chartH,
              borderTop: '1px dashed rgba(26,29,46,0.22)',
              pointerEvents: 'none',
            }}
          >
            {/* Labelling the guideline turns it into the chart's y reference */}
            <span
              className="tabular-nums"
              style={{
                ...barlow,
                position: 'absolute', right: 0, top: 0, transform: 'translateY(-50%)',
                fontSize: 8, lineHeight: 1, color: 'rgba(26,29,46,0.38)',
                background: cardBg, paddingLeft: 3, paddingRight: 1,
              }}
            >
              {tl.guideline}u
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: gap, height: '100%' }}>
          {tl.buckets.map(function (b, i) {
            var isLast   = i === tl.buckets.length - 1
            var over     = tl.guideline && b.units > tl.guideline
            var h        = b.units > 0 ? Math.max(3, (b.units / scaleMax) * chartH) : 2
            var isPicked = selected === i
            var dimmed   = picked && !isPicked
            return (
              <button
                key={b.key}
                type="button"
                onClick={function () { toggle(i) }}
                aria-label={b.fullLabel + ' · ' + b.units + ' units'}
                title={b.fullLabel + ' · ' + b.units + ' units'}
                style={{
                  flex: 1, height: '100%', position: 'relative',
                  display: 'flex', alignItems: 'flex-end',
                  background: 'none', border: 0, padding: 0, cursor: 'pointer',
                }}
              >
                {i === peakIdx && (
                  <span
                    className="tabular-nums"
                    style={{
                      ...barlow,
                      position: 'absolute', bottom: h + 2, left: '50%', transform: 'translateX(-50%)',
                      fontSize: 8, lineHeight: 1, whiteSpace: 'nowrap', pointerEvents: 'none',
                      color: over ? BAR_OVER : BAR_COLOR, opacity: dimmed ? 0.3 : 0.85,
                    }}
                  >
                    {b.units}
                  </span>
                )}
                <div
                  style={{
                    width: '100%', height: h, borderRadius: 2,
                    background: b.units > 0 ? (over ? BAR_OVER : BAR_COLOR) : BAR_EMPTY,
                    opacity: dimmed ? 0.3 : b.units > 0 ? (isPicked || isLast ? 1 : 0.82) : 1,
                    boxShadow: isPicked ? '0 0 0 1.5px rgba(26,29,46,0.35)' : 'none',
                    transition: 'height 0.3s ease, opacity 0.2s ease',
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* X labels */}
      {mode === 'day' ? (
        <div className="flex justify-between" style={{ marginTop: 4 }}>
          <span className="text-[9px] text-[#bbbcc8] tabular-nums" style={barlow}>{tl.buckets[0].label}</span>
          <span className="text-[9px] text-[#bbbcc8] tabular-nums" style={barlow}>{tl.buckets[Math.floor(tl.buckets.length / 2)].label}</span>
          <span className="text-[9px] text-[#bbbcc8]" style={barlow}>today</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: gap, marginTop: 4 }}>
          {tl.buckets.map(function (b, i) {
            return (
              <span
                key={b.key}
                className="text-[9px] text-[#bbbcc8] tabular-nums"
                style={{ ...barlow, flex: 1, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                {labelled[i] ? b.label : ''}
              </span>
            )
          })}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-baseline justify-between gap-2" style={{ marginTop: 6 }}>
        {/* Selecting a bar turns this line into that bucket's readout */}
        <span className="text-[10px] truncate min-w-0" style={{ ...barlow, color: picked ? '#1a1d2e' : '#7a8299' }}>
          {picked
            ? picked.fullLabel + (picked.entries > 0 ? ' · ' + picked.entries + (picked.entries === 1 ? ' drink' : ' drinks') : ' · nothing logged')
            : tl.dryDays + ' dry days of ' + tl.totalDays + ' · ' + tf.window}
        </span>
        {(picked ? picked.kcal : tl.totalKcal) > 0 && (
          <span className="text-[10px] text-[#bbbcc8] shrink-0" style={barlow}>
            ~{(picked ? picked.kcal : tl.totalKcal).toLocaleString()} kcal
          </span>
        )}
      </div>
      <p className="text-[10px] text-[#bbbcc8]" style={{ ...barlow, marginTop: 1 }}>
        avg {tl.avgUnitsPerWeek} units/week
        {tl.guideline ? ' · UK guideline 14/week' : ''}
      </p>
    </div>
  )
}

export default function AlcoholFreeCard({ drinkEntries }) {
  var [mode, setMode] = useState('week')
  var hasHistory = (drinkEntries || []).length > 0
  var streak = calcAlcoholFreeStreak(drinkEntries)
  var grindPhase = getGrindPhase(streak.days)
  var tier = grindPhase ? null : getTier(streak.days)

  // Resolve the active visual config
  var active = grindPhase || tier || {
    bg: '#ffffff', border: '#e5e7ef', accent: '#2a9d5c',
    iconBg: '#edfaf2', Icon: Droplets, shimmer: null, label: 'alcohol-free',
  }
  var isMilestone = !!tier
  var isGrind = !!grindPhase

  // Grind note for days 7–13 (inside the first milestone tier)
  var milestoneGrindNote = null
  if (isMilestone && tier.grindNote) {
    for (var i = 0; i < tier.grindNote.length; i++) {
      if (streak.days <= tier.grindNote[i].maxDays) {
        milestoneGrindNote = tier.grindNote[i].text
        break
      }
    }
  }

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

  // Weekly 7-bar progress: how many days into the current 7-day cycle
  var weekBarFill = streak.days > 0 ? (streak.days % 7 || 7) : 0
  var weekNum = streak.days > 0 ? Math.ceil(streak.days / 7) : 0

  // Daily growth fact (changes each day based on streak length)
  var growthFact = streak.days > 0 ? getGrowthFact(streak.days) : null

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
        @keyframes al-grind-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.12); opacity: 0.8; }
        }
        @keyframes al-bar-glow {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.7; }
        }
      `}</style>
      <div
        className="rounded-2xl relative overflow-hidden"
        style={{
          background: active.bg,
          border: '1px solid ' + active.border,
        }}
      >
        {isMilestone && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 16 }}>
            <div
              style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, width: '55%',
                background: active.shimmer,
                animation: 'al-shimmer 1.1s cubic-bezier(0.4,0,0.2,1) forwards',
              }}
            />
          </div>
        )}

        {/* Alcohol over time */}
        {hasHistory && (
          <>
            <div className="px-4 pt-3 pb-2 relative">
              <AlcoholTimeline entries={drinkEntries} mode={mode} onModeChange={setMode} cardBg={active.bg} />
            </div>
            <div style={{ height: 1, background: active.border, opacity: 0.55 }} />
          </>
        )}

        {/* Alcohol-free streak */}
        <div className="px-4 py-3 flex items-center gap-3 relative">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: active.iconBg,
              animation: isMilestone
                ? 'al-icon-pop 0.55s ease-out both'
                : isGrind
                  ? 'al-grind-pulse 2.4s ease-in-out infinite'
                  : 'none',
              animationDelay: isMilestone ? '0.15s' : '0s',
            }}
          >
            <active.Icon size={16} style={{ color: active.accent }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{primary}</span>
              {secondary && <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{secondary}</span>}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: active.accent, opacity: 0.85 }}>
              {active.label}
            </p>
            {isGrind && grindPhase.message && (
              <p className="text-[10px] mt-0.5" style={{ color: active.accent, opacity: 0.6, fontStyle: 'italic' }}>
                {grindPhase.message}
              </p>
            )}
            {milestoneGrindNote && (
              <p className="text-[10px] mt-0.5" style={{ color: active.accent, opacity: 0.55, fontStyle: 'italic' }}>
                {milestoneGrindNote}
              </p>
            )}

            {/* Weekly 7-bar progress strip */}
            {streak.days > 0 && (
              <div style={{ marginTop: 9 }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1, 2, 3, 4, 5, 6, 7].map(function(d) {
                    var filled = d <= weekBarFill
                    var isToday = d === weekBarFill
                    return (
                      <div
                        key={d}
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 4,
                          background: filled ? active.accent : active.border,
                          opacity: isToday ? 1 : filled ? 0.6 : 0.18,
                          animation: isToday ? 'al-bar-glow 2s ease-in-out infinite' : 'none',
                          transition: 'opacity 0.4s ease',
                        }}
                      />
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: 9, color: active.accent, opacity: 0.4 }} className="tabular-nums">
                    week {weekNum}
                  </span>
                  <span style={{ fontSize: 9, color: active.accent, opacity: 0.4 }} className="tabular-nums">
                    {weekBarFill}/7
                  </span>
                </div>
              </div>
            )}

            {/* Daily growth fact */}
            {growthFact && (
              <p style={{ fontSize: 10, color: active.accent, opacity: 0.58, marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
                {growthFact}
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
