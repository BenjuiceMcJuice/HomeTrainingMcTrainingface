import { useMemo } from 'react'
import { Gauge } from 'lucide-react'
import WidgetShell from './WidgetShell'
import WidgetMark, { WidgetEdge } from './WidgetMark'
import ScoreDial from './ScoreDial'
import { buildWeeklyScore, biggestGain, scoreBand } from '../../lib/weeklyScore'
import { recentWeeks, averageScore } from '../../lib/weekLog'
import { buildAdherence } from '../../lib/adherence'
import { daysBetween, todayStr } from '../../lib/stats'
import { barlow } from '../../lib/utils'

/**
 * The weekly Shameometer.
 *
 * One dial for the current week, scored from three inputs — training done,
 * scheduled days honoured, and drinking. Spec:
 * `docs/specs/betalog_shameometer_spec.md`; the arithmetic is all in
 * `lib/weeklyScore.js` and is the part worth reading.
 *
 * This replaced an adherence-only card that read 0% every week for anyone whose
 * schedule was aspirational. Training is the backbone now; the schedule is a
 * top-up worth 25.
 *
 * Unlike every other widget this one always renders — an empty week is exactly
 * the week it has something to say about.
 */

var DAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** "5 weeks ago", "yesterday", "never" — how long a routine has gone ignored. */
function agoLabel(lastDone, today) {
  if (!lastDone) return 'never'
  var days = daysBetween(lastDone, today)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return days + ' days ago'
  if (days < 60) return Math.round(days / 7) + ' weeks ago'
  return Math.round(days / 30) + ' months ago'
}

/** One line of the component breakdown. */
function Row({ label, detail, value, max, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold text-[#1a1d2e] shrink-0" style={barlow}>{label}</span>
      <span className="text-[10px] text-[#7a8299] truncate flex-1" style={barlow}>{detail}</span>
      <span className="text-[10px] font-bold shrink-0" style={{ ...barlow, color: color }}>
        {value > 0 ? '+' : ''}{value}{max !== null && max !== undefined ? '/' + max : ''}
      </span>
    </div>
  )
}

/**
 * One bar per week, oldest left.
 *
 * Heights are relative to 100, not to the best week in view: the question is
 * "how good was that week", and rescaling to the local maximum would make a run
 * of bad weeks look like a good one.
 *
 * A bar marked `live` is the week being lived in. It is drawn as an outline,
 * because a solid bar would claim a score the week has not finished earning.
 */
function ScoreBars({ bars, height, showScores }) {
  return (
    <div className="flex items-end gap-1" style={{ height: height + (showScores ? 12 : 0) }}>
      {bars.map(function (bar) {
        var b = scoreBand(bar.score)
        return (
          <div key={bar.key} className="flex-1 flex flex-col justify-end items-center gap-0.5" title={bar.title}>
            {showScores && (
              <span className="text-[8px] font-bold leading-none" style={{ ...barlow, color: b.color }}>{bar.score}</span>
            )}
            <div
              className="w-full"
              style={{
                borderRadius: 2,
                height: Math.max(3, (bar.score / 100) * height),
                background: bar.live ? 'transparent' : b.color,
                border:     bar.live ? '1.5px solid ' + b.color : 'none',
                opacity:    bar.faded ? 0.55 : 1,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

/** Sealed week records → bars. Backfilled weeks are faded, as provenance. */
function weekBars(records) {
  return records.map(function (r) {
    return {
      key:   r.weekStart,
      score: r.score,
      faded: r.backfilled,
      title: r.weekStart + ' · ' + r.score + ' ' + r.band,
    }
  })
}

/**
 * This week, a square per day, points inside.
 *
 * `showPoints` off shrinks it to a shape — trained or not — which is all that
 * survives being read at 14px in the collapsed preview.
 */
function DayStrip({ dates, week, today, band, size, showPoints, className }) {
  var s = size || 20
  return (
    <div className={'flex gap-1 ' + (className || 'justify-center')}>
      {dates.map(function (d, i) {
        var pts     = week.training.perDay[d]
        var future  = d > today
        var isToday = d === today
        return (
          <div key={d} className="flex flex-col items-center gap-0.5">
            <span
              className="font-bold leading-none"
              style={{ ...barlow, fontSize: showPoints ? 8 : 7, color: isToday ? '#1a1d2e' : '#bbbcc8' }}
            >
              {DAY_NAMES[i]}
            </span>
            <span
              className="rounded font-bold flex items-center justify-center"
              style={{
                ...barlow,
                width: s, height: s, fontSize: 9,
                background: future ? '#f8f9fc' : pts > 0 ? band.color : '#f4f5f9',
                color:      pts > 0 && !future ? '#fff' : '#bbbcc8',
                border:     isToday ? '1.5px dashed #bbbcc8' : 'none',
              }}
            >
              {showPoints && !future ? pts || '·' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * What the card says while folded away: the dial itself, shrunk to sit in the
 * header row beside the score.
 *
 * The header gives the number and names the band in words. What it cannot say
 * is *where in the range* the needle sits and which way it moved — the whole
 * reason this card is a dial and not a stat. Last week stays on it as the grey
 * ghost mark, unlabelled, as in the expanded body.
 *
 * 38px wide — a glyph on the end of the row, not a chart in it. Everything else
 * stays behind the chevron.
 */
function Preview({ week, prevScore, band }) {
  return (
    <span className="block" style={{ width: 38 }}>
      <ScoreDial
        score={week.score} band={band}
        ghostScore={prevScore} ghostLabel="Last week"
        compact
      />
    </span>
  )
}

/**
 * The sealed history strip — one bar per completed week, most recent last.
 */
function History({ records }) {
  if (!records.length) return null
  var avg = averageScore(records)
  return (
    <div className="mt-2.5 pt-2 border-t border-[#f0f1f5]">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[9px] font-bold text-[#7a8299] uppercase tracking-wide" style={barlow}>
          Sealed weeks
        </span>
        <span className="text-[9px] text-[#bbbcc8]" style={barlow}>
          avg {avg} over {records.length}
        </span>
      </div>
      <ScoreBars bars={weekBars(records)} height={26} showScores />
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px] text-[#bbbcc8]" style={barlow}>{records[0].weekStart.slice(8) + '/' + records[0].weekStart.slice(5, 7)}</span>
        <span className="text-[8px] text-[#bbbcc8]" style={barlow}>last week</span>
      </div>
    </div>
  )
}

export default function ShameometerCard({ sessions, scheduleEntries, drinkEntries, weekScores, editMode }) {
  var today = todayStr()

  var input = useMemo(function () {
    return { sessions: sessions, scheduleEntries: scheduleEntries, drinkLog: drinkEntries }
  }, [sessions, scheduleEntries, drinkEntries])

  var week = useMemo(function () { return buildWeeklyScore(input, today, 0)  }, [input, today])
  var prev = useMemo(function () { return buildWeeklyScore(input, today, -1) }, [input, today])

  // Per-routine detail for the expanded body. The old card's most useful part,
  // kept: a percentage is arguable, "last done 14 weeks ago" is not.
  var perRoutine = useMemo(function () {
    if (!scheduleEntries || !scheduleEntries.length) return []
    var a = buildAdherence(scheduleEntries, sessions, 7, today)
    return a.entries.slice().sort(function (x, y) {
      if (x.pct === null) return 1
      if (y.pct === null) return -1
      return x.pct - y.pct
    })
  }, [scheduleEntries, sessions, today])

  var history = useMemo(function () { return recentWeeks(weekScores, 10) }, [weekScores])

  var band  = week.band
  var delta = week.score - prev.score
  var gain  = biggestGain(week)
  var dates = Object.keys(week.training.perDay).sort()

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 relative">
        <WidgetEdge accent={band.color} />
        <WidgetShell widgetKey="shameometer" editMode={editMode} preview={
          <Preview week={week} prevScore={prev.score} band={band} />
        } header={function (collapsed) { return (
          <div className="flex items-baseline gap-1.5">
            <WidgetMark icon={Gauge} accent={band.color} />
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{week.score}</span>
            <span className="text-[10px] font-bold" style={{ ...barlow, color: band.color }}>{band.label}</span>
            <span className="text-[10px] text-[#bbbcc8] whitespace-nowrap" style={barlow}>
              {week.complete ? 'this week' : 'day ' + week.dayOfWeek + '/7'}
            </span>
            {/* Folded, the dial to the right of this row carries last week as a
                ghost mark, so the words would say it twice — and at 320px the
                two together wrap the row onto three lines. */}
            {prev.score > 0 && !collapsed && (
              <span
                className="text-[10px] font-bold ml-auto whitespace-nowrap"
                style={{ ...barlow, color: delta >= 0 ? '#2a9d5c' : '#e11d48' }}
              >
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} vs last wk
              </span>
            )}
          </div>
        ) }}>
          <ScoreDial score={week.score} band={band} ghostScore={prev.score} ghostLabel="Last week" />

          <p className="text-[11px] mt-1 text-center" style={{ ...barlow, color: band.color }}>{band.note}</p>

          {/* Which days had anything in them. The score is one number; this is
              where it came from. */}
          <div className="mt-2">
            <DayStrip dates={dates} week={week} today={today} band={band} size={20} showPoints />
          </div>

          <div className="mt-2.5 flex flex-col gap-1 pt-2 border-t border-[#f0f1f5]">
            <Row
              label="Training"
              detail={week.training.points + ' of ' + week.training.target + ' pts'}
              value={week.training.earned} max={week.training.max} color="#4f7ef8"
            />
            {week.schedule.active ? (
              <Row
                label="Schedule"
                detail={week.schedule.done + ' of ' + week.schedule.due + ' scheduled days'}
                value={week.schedule.earned} max={week.schedule.max} color="#8b5cf6"
              />
            ) : (
              <Row label="Schedule" detail="nothing scheduled — folded into training" value={0} max={null} color="#bbbcc8" />
            )}
            <Row
              label="Alcohol"
              detail={
                week.alcohol.dry
                  ? 'dry week so far'
                  : week.alcohol.units + ' units vs ' + week.alcohol.allowance + ' allowed' + (week.alcohol.capped ? ' (capped)' : '')
              }
              value={week.alcohol.delta} max={null}
              color={week.alcohol.delta >= 0 ? '#2a9d5c' : '#e11d48'}
            />
          </div>

          {perRoutine.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 pt-2 border-t border-[#f0f1f5]">
              {perRoutine.map(function (r) {
                return (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#1a1d2e] truncate flex-1" style={barlow}>{r.routineName}</span>
                    <span className="text-[9px] text-[#bbbcc8] shrink-0" style={barlow}>
                      last {agoLabel(r.lastDone, today)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <History records={history} />

          {gain && (
            <p className="text-[10px] text-[#7a8299] mt-2 pt-2 border-t border-[#f0f1f5]" style={barlow}>
              <span className="font-bold text-[#1a1d2e]">Biggest gain:</span> {gain}
            </p>
          )}
        </WidgetShell>
      </div>
    </div>
  )
}
