import { useState, useMemo } from 'react'
import { Wine, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import WidgetShell from './WidgetShell'
import WidgetMark, { WidgetEdge } from './WidgetMark'
import { calcAlcoholFreeStreak, buildAlcoholTimeline, WINDOW_BUCKET_MODE } from '../../lib/stats'
import { barlow } from '../../lib/utils'
import useWidgetWindow from '../../hooks/useWidgetWindow'
import BarTimeline from './BarTimeline'

/**
 * Alcohol: the streak as the headline, units over time as the body.
 *
 * Until 2026-10-11 this card was a sobriety tracker — twelve milestone tiers
 * with their own gradients, a shimmer on every open, sparks on a milestone
 * day, recovery-stage copy ("sleep might be weird for a bit. totally normal.")
 * and a daily growth fact — 827 lines, the loudest card on the Dashboard, for
 * the topic least to do with climbing, and in a lowercase voice nothing else
 * used. A climber who has two pints a week was told "the worst is behind you"
 * four days later. The review of that day cut it to what the log can say: how
 * many whole days since the last drink, and the units chart. Same chrome as
 * every other widget.
 *
 * The Dashboard renders this only once a drink has been logged — with nothing
 * logged there is nothing to count.
 */

var ACCENT    = '#d97706'
var BAR_OVER  = '#e11d48'
var BAR_EMPTY = 'rgba(26,29,46,0.10)'

// Windows, not bucket sizes: the chips say how much history to summarise and
// the chart derives its bars from that (30d → daily, 90d → weekly, 12m → monthly).
var WINDOW_LABEL = {
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  '12m': 'last 12 months',
}

function AlcoholTimeline({ entries, activeWindow, windowOptions, onWindowChange }) {
  var mode = WINDOW_BUCKET_MODE[activeWindow] || 'week'
  var tl = useMemo(function () { return buildAlcoholTimeline(entries, mode) }, [entries, mode])
  var [selected, setSelected] = useState(null)

  // Bar geometry, the guideline and the peak label all come from BarTimeline —
  // the card decides what a bucket *is* and the chart draws it.
  var chartBuckets = tl.buckets.map(function (b) {
    return { key: b.key, label: b.label, fullLabel: b.fullLabel, value: b.units }
  })
  var gap = mode === 'day' ? 2 : 3

  var picked = selected !== null && tl.buckets[selected] ? tl.buckets[selected] : null
  function changeWindow(w) { setSelected(null); onWindowChange(w) }

  var delta     = Math.round((tl.totalUnits - tl.prevUnits) * 10) / 10
  // Only compare against a window the user actually has history for
  var showDelta = tl.hasPrevData
  var deltaUp   = delta > 0.05
  var deltaDown = delta < -0.05
  var deltaColor = deltaDown ? '#2a9d5c' : deltaUp ? '#c2410c' : '#7a8299'
  var DeltaIcon  = deltaDown ? ArrowDownRight : deltaUp ? ArrowUpRight : Minus

  return (
    <div>
      {/* Window chips head the body — same place they sit on every other card,
          and clear of the header now that the header row is the collapse
          control. */}
      <div className="flex items-center gap-0.5 mb-2">
        {windowOptions.map(function (w) {
          var active = w === activeWindow
          return (
            <button
              key={w}
              onClick={function () { changeWindow(w) }}
              className="rounded px-1.5 py-0.5 text-[10px] font-bold leading-none transition-colors"
              style={{
                ...barlow,
                background: active ? ACCENT : '#fff7ed',
                color:      active ? '#fff'  : '#92400e',
              }}
            >
              {w}
            </button>
          )
        })}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>
          {picked ? picked.units : tl.totalUnits}
        </span>
        <span className="text-[11px] font-bold text-[#7a8299]" style={barlow}>units</span>
        {showDelta && !picked && (
          <span className="flex items-center gap-0.5 ml-auto text-[11px] font-bold" style={{ ...barlow, color: deltaColor }}>
            <DeltaIcon size={11} />
            {deltaUp ? '+' : ''}{delta} vs prev
          </span>
        )}
      </div>

      <BarTimeline
        buckets={chartBuckets}
        accentColor={ACCENT}
        overColor={BAR_OVER}
        emptyColor={BAR_EMPTY}
        unitLabel="units"
        guideline={tl.guideline}
        guidelineLabel={tl.guideline ? tl.guideline + 'u' : null}
        cardBg="#ffffff"
        selected={selected}
        onSelect={setSelected}
        gap={gap}
        labelMode={mode === 'day' ? 'edges' : 'step'}
        labelStep={mode === 'week' ? 3 : 2}
        endLabel="today"
      />

      {/* Footer stats */}
      <div className="flex items-baseline justify-between gap-2" style={{ marginTop: 6 }}>
        {/* Selecting a bar turns this line into that bucket's readout */}
        <span className="text-[11px] truncate min-w-0" style={{ ...barlow, color: picked ? '#1a1d2e' : '#7a8299' }}>
          {picked
            ? picked.fullLabel + (picked.drinks > 0 ? ' · ' + picked.drinks + (picked.drinks === 1 ? ' drink' : ' drinks') : ' · nothing logged')
            : tl.dryDays + ' dry days of ' + tl.totalDays + ' · ' + (WINDOW_LABEL[activeWindow] || activeWindow)}
        </span>
        {(picked ? picked.kcal : tl.totalKcal) > 0 && (
          <span className="text-[11px] text-[#bbbcc8] shrink-0" style={barlow}>
            ~{(picked ? picked.kcal : tl.totalKcal).toLocaleString()} kcal
          </span>
        )}
      </div>
      <p className="text-[11px] text-[#bbbcc8]" style={{ ...barlow, marginTop: 1 }}>
        avg {tl.avgUnitsPerWeek} units/week
        {tl.guideline ? ' · UK guideline 14/week' : ''}
      </p>
    </div>
  )
}

/** "3 weeks" / "2 months" beside the day count once there is one to name. */
function longerLabel(streak) {
  if (streak.months >= 1) return streak.months + (streak.months === 1 ? ' month' : ' months')
  if (streak.weeks >= 1)  return streak.weeks + (streak.weeks === 1 ? ' week' : ' weeks')
  return null
}

export default function AlcoholFreeCard({ drinkEntries, editMode }) {
  var { window: activeWindow, options, setWindow } = useWidgetWindow('alcoholFree')
  var streak = calcAlcoholFreeStreak(drinkEntries)
  var longer = longerLabel(streak)

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 relative">
        <WidgetEdge accent={ACCENT} />
        <WidgetShell widgetKey="alcoholFree" editMode={editMode} header={
          <div className="flex items-baseline gap-1.5">
            <WidgetMark icon={Wine} accent={ACCENT} />
            <span className="text-[12px] font-bold text-[#7a8299] uppercase tracking-wide" style={barlow}>Alcohol</span>
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>
              {streak.days} {streak.days === 1 ? 'day' : 'days'}
            </span>
            <span className="text-[11px] font-bold text-[#7a8299]" style={barlow}>alcohol-free</span>
            {longer && <span className="text-[11px] text-[#bbbcc8]" style={barlow}>· {longer}</span>}
          </div>
        }>
          <div className="mt-1.5">
            <AlcoholTimeline
              entries={drinkEntries}
              activeWindow={activeWindow}
              windowOptions={options}
              onWindowChange={setWindow}
            />
          </div>
        </WidgetShell>
      </div>
    </div>
  )
}
