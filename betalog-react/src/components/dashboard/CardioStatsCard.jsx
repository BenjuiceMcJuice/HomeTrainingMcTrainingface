import { useState } from 'react'
import WidgetShell from './WidgetShell'
import BarTimeline from './BarTimeline'
import { Activity } from 'lucide-react'
import { filterSessionsByDays, buildValueTimeline, WINDOW_BUCKET_MODE, estimateSessionKcalMid, sortWeightsDesc } from '../../lib/stats'
import { barlow, capitalise, fmtDuration, fmtDist, sessionDistKm } from '../../lib/utils'
import useWidgetWindow from '../../hooks/useWidgetWindow'
import { windowDays } from '../../lib/widgetWindow'

const ACTIVITY_LABEL = {
  swim: 'Swim', run: 'Run', cycle: 'Cycle', row: 'Row',
  walk: 'Walk', sport: 'Sport', other: 'Other',
}

const CARDIO_GOAL_TYPES = ['run', 'swim', 'cycle']

const ACCENT = '#0d9488'

function buildStats(sessions, days, weightEntries, profileWeight) {
  const cardio = filterSessionsByDays(sessions.filter(s => s.type === 'cardio'), days)

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

  const sortedWeights = sortWeightsDesc(weightEntries)
  let totalKcalMid = 0, hasKcal = false
  cardio.forEach(s => {
    const kcal = estimateSessionKcalMid(s, sortedWeights, profileWeight)
    if (kcal !== null) { totalKcalMid += kcal; hasKcal = true }
  })

  return { cardio, totalMins, detail, totalKcalMid, hasKcal, sortedWeights }
}

export default function CardioStatsCard({ sessions, weightEntries, profileWeight, goals, editMode }) {
  // Hooks run before the early return below — they must run in the same order
  // on every render, and this component bails out when there is no data.
  const { window: activeWindow, options, setWindow } = useWidgetWindow('cardioStats')
  const [picked, setPicked] = useState(null)

  // The card offers a 12-month window, so it has to appear for anyone with a
  // year of history — gating on 90 days hid the card from exactly the people
  // the longest chip is for.
  const cardioSessions = sessions.filter(s => s.type === 'cardio')
  const hasIn = {}
  options.forEach(function (w) { hasIn[w] = filterSessionsByDays(cardioSessions, windowDays(w)).length > 0 })
  if (!hasIn['12m']) return null

  const { cardio, totalMins, detail, totalKcalMid, hasKcal, sortedWeights } = buildStats(sessions, windowDays(activeWindow), weightEntries, profileWeight)

  // Minutes trained per bucket — the card answers "am I doing more or less than
  // I was", which a session count on its own never did.
  const mode     = WINDOW_BUCKET_MODE[activeWindow] || 'week'
  const timeline = buildValueTimeline(cardio, mode, function (s) { return s.cardioDurationMins || 0 })
  const pickedBucket = picked !== null && timeline.buckets[picked] ? timeline.buckets[picked] : null

  // Calories bucket the same way the bars do, so selecting a week reports that
  // week's burn. The line used to show the whole window's total whatever was
  // selected, which read as a number that never moved.
  const kcalTimeline = buildValueTimeline(cardio, mode, function (s) {
    return estimateSessionKcalMid(s, sortedWeights, profileWeight) || 0
  })
  const pickedKcal = pickedBucket && kcalTimeline.buckets[picked] ? Math.round(kcalTimeline.buckets[picked].value) : null

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
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#ecfdf5' }}>
          <Activity size={16} style={{ color: '#0d9488' }} />
        </div>
        <WidgetShell widgetKey="cardioStats" editMode={editMode} header={
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{cardio.length}</span>
            <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>sessions</span>
            <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{activeWindow}</span>
            {totalMins > 0 && (
              <span className="text-[10px] font-bold ml-auto" style={{ ...barlow, color: '#0d9488' }}>
                {fmtDuration(totalMins)}
              </span>
            )}
          </div>
        } className="flex-1 min-w-0">
          {/* Window chips head the body, because the body is what they change —
              and the header is now the collapse control, which can't hold
              buttons of its own. */}
          <div className="flex items-center gap-0.5 mt-1.5">
            {options.map((w) => {
              const active = w === activeWindow
              // An empty window is still worth showing as a chip — it is how you
              // find out there is nothing there — but it is not worth a tap.
              const disabled = !hasIn[w]
              return (
                <button
                  key={w}
                  onClick={() => { if (!disabled) { setPicked(null); setWindow(w) } }}
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold leading-none transition-colors"
                  style={{
                    ...barlow,
                    background: active ? '#0d9488' : '#f0fdfb',
                    color:      active ? '#fff'    : disabled ? '#d1d5db' : '#0d9488',
                    cursor:     disabled ? 'default' : 'pointer',
                  }}
                >
                  {w}
                </button>
              )
            })}
          </div>
          {cardio.length > 0 && (
            <BarTimeline
              buckets={timeline.buckets}
              accentColor={ACCENT}
              unitLabel="mins"
              cardBg="#ffffff"
              selected={picked}
              onSelect={setPicked}
              gap={mode === 'day' ? 2 : 3}
              labelMode={mode === 'day' ? 'edges' : 'step'}
              labelStep={mode === 'week' ? 3 : 2}
              endLabel="today"
            />
          )}
          {cardio.length === 0
            ? <p className="text-[11px] text-[#bbbcc8] mt-0.5" style={barlow}>No sessions in the last {activeWindow}</p>
            : pickedBucket
              // Selecting a bar turns the summary line into that bucket's readout
              ? <p className="text-[11px] text-[#1a1d2e] mt-1 truncate" style={barlow}>
                  {pickedBucket.fullLabel} · {pickedBucket.count === 1 ? '1 session' : pickedBucket.count + ' sessions'}
                  {pickedBucket.value > 0 ? ' · ' + fmtDuration(pickedBucket.value) : ''}
                </p>
              : <p className="text-[11px] text-[#7a8299] mt-1 truncate" style={barlow}>{detail}</p>
          }
          {hasKcal && (
            <p className="text-[10px] text-[#bbbcc8] mt-0.5" style={barlow}>
              {pickedBucket
                ? (pickedKcal > 0 ? '~' + pickedKcal.toLocaleString() + ' kcal burned' : 'No calorie estimate for this bucket')
                : '~' + totalKcalMid.toLocaleString() + ' kcal burned'}
            </p>
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
        </WidgetShell>
      </div>
    </div>
  )
}
