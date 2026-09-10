import { useMemo } from 'react'
import { Gauge } from 'lucide-react'
import WidgetShell from './WidgetShell'
import WidgetMark, { WidgetEdge } from './WidgetMark'
import { buildAdherence, shameBand } from '../../lib/adherence'
import { windowDays } from '../../lib/widgetWindow'
import { daysBetween, todayStr } from '../../lib/stats'
import { barlow } from '../../lib/utils'
import useWidgetWindow from '../../hooks/useWidgetWindow'

/**
 * The Shameometer — how much of the schedule you actually did.
 *
 * The one widget that reports on the *absence* of sessions. Every other card
 * summarises what was logged, which means a routine can sit in the schedule
 * firing reminders indefinitely and never appear anywhere as a failure. This is
 * the counterweight.
 *
 * The scoring rules (today is never missed; nothing before `remindFrom` counts;
 * default routines match by family, not by versioned id) all live in
 * `lib/adherence.js` and are the part worth reading. This file draws them.
 *
 * The card renders nothing when the schedule is empty — there is nothing to be
 * ashamed of yet, and `SortableWidget` hides an empty widget's drag chrome for
 * exactly this case.
 */

const ACCENT = '#7a8299'

/** The gauge: one bar, filled to the score, tinted by the band. */
function Meter({ pct, band }) {
  return (
    <div className="mt-2">
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{ height: 8, background: 'rgba(26,29,46,0.08)' }}
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={'Schedule adherence: ' + pct + '%, ' + band.label}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: Math.max(pct, 2) + '%', background: band.color }}
        />
      </div>
      {/* Band edges, so the score reads against the scale rather than alone. */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-[#bbbcc8]" style={barlow}>shameful</span>
        <span className="text-[9px] text-[#bbbcc8]" style={barlow}>flawless</span>
      </div>
    </div>
  )
}

/** "5 weeks ago", "yesterday", "never" — how long a routine has been ignored. */
function agoLabel(lastDone, today) {
  if (!lastDone) return 'never done'
  var days = daysBetween(lastDone, today)
  if (days <= 0) return 'done today'
  if (days === 1) return 'yesterday'
  if (days < 14) return days + ' days ago'
  if (days < 60) return Math.round(days / 7) + ' weeks ago'
  return Math.round(days / 30) + ' months ago'
}

export default function ShameometerCard({ scheduleEntries, sessions, editMode }) {
  const { window: activeWindow, options, setWindow } = useWidgetWindow('shameometer')
  const today = todayStr()

  const adherence = useMemo(
    () => buildAdherence(scheduleEntries, sessions, windowDays(activeWindow) || 30, today),
    [scheduleEntries, sessions, activeWindow, today]
  )

  if (!scheduleEntries || !scheduleEntries.length) return null

  const band = shameBand(adherence.pct)

  // Worst offender first: the routine that is being ignored hardest is the one
  // the card exists to name. Ties break on the longer missed streak.
  const rows = adherence.entries.slice().sort((a, b) => {
    if (a.pct === null) return 1
    if (b.pct === null) return -1
    if (a.pct !== b.pct) return a.pct - b.pct
    return b.missedStreak - a.missedStreak
  })

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 relative">
        <WidgetEdge accent={band ? band.color : ACCENT} />
        <WidgetShell widgetKey="shameometer" editMode={editMode} header={
          <div className="flex items-baseline gap-1.5">
            <WidgetMark icon={Gauge} accent={band ? band.color : ACCENT} />
            {adherence.scored ? (
              <>
                <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{adherence.pct}%</span>
                <span className="text-[10px] font-bold" style={{ ...barlow, color: band.color }}>{band.label}</span>
                <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{activeWindow}</span>
                <span className="text-[10px] font-bold text-[#7a8299] ml-auto" style={barlow}>
                  {adherence.done}/{adherence.due}
                </span>
              </>
            ) : (
              <>
                <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>—</span>
                <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>Nothing due yet</span>
              </>
            )}
          </div>
        }>
          <div className="flex items-center gap-0.5 mt-1.5">
            {options.map((w) => {
              const active = w === activeWindow
              return (
                <button
                  key={w}
                  onClick={() => setWindow(w)}
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold leading-none transition-colors"
                  style={{
                    ...barlow,
                    background: active ? ACCENT : '#f4f5f9',
                    color:      active ? '#fff'  : ACCENT,
                  }}
                >
                  {w}
                </button>
              )
            })}
          </div>

          {adherence.scored ? (
            <>
              <Meter pct={adherence.pct} band={band} />
              <p className="text-[11px] mt-1.5" style={{ ...barlow, color: band.color }}>{band.note}</p>

              <div className="mt-2 flex flex-col gap-1.5">
                {rows.map((r) => {
                  const rBand = shameBand(r.pct)
                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#1a1d2e] truncate flex-1" style={barlow}>
                        {r.routineName}
                      </span>
                      {r.due === 0 ? (
                        <span className="text-[10px] text-[#bbbcc8]" style={barlow}>not due</span>
                      ) : (
                        <>
                          <span className="text-[10px] text-[#7a8299] shrink-0" style={barlow}>
                            {r.done}/{r.due}
                          </span>
                          <span
                            className="text-[10px] font-bold shrink-0 rounded px-1.5 py-0.5"
                            style={{ ...barlow, color: rBand.color, background: rBand.bg }}
                          >
                            {r.pct}%
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* The sting: named, and dated. A percentage alone is easy to
                  argue with; "last done 14 weeks ago" is not. */}
              {rows.length > 0 && rows[0].due > 0 && rows[0].missedStreak > 0 && (
                <p className="text-[10px] text-[#7a8299] mt-2 truncate" style={barlow}>
                  Worst: <span className="font-bold text-[#1a1d2e]">{rows[0].routineName}</span>
                  {' · '}{rows[0].missedStreak} in a row missed
                  {' · '}last {agoLabel(rows[0].lastDone, today)}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-[#7a8299] mt-1.5" style={barlow}>
              No scheduled days have come round yet. Scoring starts the day after the first one.
            </p>
          )}
        </WidgetShell>
      </div>
    </div>
  )
}
