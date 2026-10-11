import { useMemo } from 'react'
import { Gauge } from 'lucide-react'
import WidgetShell from './WidgetShell'
import WidgetMark, { WidgetEdge } from './WidgetMark'
import ScoreDial from './ScoreDial'
import { buildWeeklyScore, biggestGain } from '../../lib/weeklyScore'
import { todayStr } from '../../lib/stats'
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
 * Unlike every other widget this one renders for an empty week — that is
 * exactly the week it has something to say about. An empty *log* is different:
 * the Dashboard leaves the card out until anything has been logged (2026-10-11).
 *
 * The body is the dial, the day strip, the three-row breakdown and the biggest
 * gain. The band legend under the dial, the per-routine "last done" rows and
 * the sealed-weeks strip went on 2026-10-11: the band is already named in the
 * header, the schedule is on two other surfaces, and the week log is sealed
 * and kept whether or not it is charted here.
 */

var DAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** One line of the component breakdown. */
function Row({ label, detail, value, max, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold text-[#1a1d2e] shrink-0" style={barlow}>{label}</span>
      <span className="text-[10px] text-[#7a8299] truncate flex-1" style={barlow}>{detail}</span>
      <span className="text-[10px] font-bold shrink-0" style={{ ...barlow, color: color }}>
        {value === null ? '—' : (value > 0 ? '+' : '') + value + (max !== null && max !== undefined ? '/' + max : '')}
      </span>
    </div>
  )
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
 * 76px wide, which makes it 44px tall — the full height of the header row it
 * sits in, so it fills the gap between the headline and the chevron instead of
 * floating in it as a glyph. It started at 38px and read as a dot on a phone.
 * Everything else stays behind the chevron.
 */
function Preview({ week, prevScore, band }) {
  return (
    <span className="block" style={{ width: 76 }}>
      <ScoreDial
        score={week.score} band={band}
        ghostScore={prevScore} ghostLabel="Last week"
        compact
      />
    </span>
  )
}

export default function ShameometerCard({ sessions, scheduleEntries, drinkEntries, editMode }) {
  var today = todayStr()

  var input = useMemo(function () {
    return { sessions: sessions, scheduleEntries: scheduleEntries, drinkLog: drinkEntries }
  }, [sessions, scheduleEntries, drinkEntries])

  var week = useMemo(function () { return buildWeeklyScore(input, today, 0)  }, [input, today])
  var prev = useMemo(function () { return buildWeeklyScore(input, today, -1) }, [input, today])

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
          <ScoreDial score={week.score} band={band} ghostScore={prev.score} ghostLabel="Last week" legend={false} />

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
              <Row label="Schedule" detail="nothing scheduled — folded into training" value={null} max={null} color="#bbbcc8" />
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
