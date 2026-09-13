import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Mountain, Scale, Activity, Check } from 'lucide-react'
import useGoals, { calcGoalProgress } from '../../hooks/useGoals'
import { getCurrentValueDetail, goalKindLabel } from '../../lib/goals'
import { useData } from '../../App'
import { V_GRADES, FRENCH_GRADES, filterSessionsByDays, pctOfBodyweight } from '../../lib/stats'
import { assessWeightGoalRate, describeRate, rateWarning, RATE_COLOR } from '../../lib/weightRate'
import { scoreWeightGoal } from '../../lib/weightGoalScore'
import {
  pyramidForGoal, pyramidShapeFor, pyramidLadder, pyramidReadiness,
  describePyramidBasis, describeNextUp, describeTargetEvidence,
} from '../../lib/pyramid'
import { topReasons, SCORE_COLOR } from '../../lib/goalScore'
import { gradeTimeline } from '../../lib/gradeGoalScore'
import {
  forecastReady, describeForecast, describeForecastSteps, describeForecastBasis,
  forecastAtPlannedRate, describePlan, goalScore,
} from '../../lib/pyramidForecast'
import ScoreDots from '../ui/ScoreDots'
import PyramidChart from '../ui/PyramidChart'
import GradeTargetPicker from './GradeTargetPicker'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

var GOAL_TYPES = [
  { key: 'boulder_grade', label: 'Boulder', unit: null },
  { key: 'rope_grade',    label: 'Rope',    unit: null },
  { key: 'run',           label: 'Run',     unit: 'km' },
  { key: 'swim',          label: 'Swim',    unit: 'km' },
  { key: 'cycle',         label: 'Cycle',   unit: 'km' },
  { key: 'weight',        label: 'Weight',  unit: 'kg' },
]

export var GOAL_META = {
  boulder_grade: { label: 'Boulder Grade', color: '#c0622a', Icon: Mountain },
  rope_grade:    { label: 'Rope Grade',    color: '#4f7ef8', Icon: Mountain },
  run:           { label: 'Run',           color: '#2a9d5c', Icon: Activity },
  swim:          { label: 'Swim',          color: '#0891b2', Icon: Activity },
  cycle:         { label: 'Cycle',         color: '#8b5cf6', Icon: Activity },
  weight:        { label: 'Bodyweight',    color: '#d4742a', Icon: Scale    },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysLeft(targetDate) {
  var today = new Date(); today.setHours(0, 0, 0, 0)
  var target = new Date(targetDate + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}

function daysColor(days) {
  if (days <= 7)  return '#ef4444'
  if (days <= 30) return '#d97706'
  return '#7a8299'
}

function toGoLabel(goal, currentValue) {
  if (currentValue === null || currentValue === undefined) return null
  var diff
  if (goal.type === 'boulder_grade') {
    diff = V_GRADES.indexOf(String(goal.target)) - V_GRADES.indexOf(String(currentValue))
    if (diff <= 0) return 'At target!'
    return diff + ' grade' + (diff !== 1 ? 's' : '') + ' to go'
  }
  if (goal.type === 'rope_grade') {
    diff = FRENCH_GRADES.indexOf(String(goal.target)) - FRENCH_GRADES.indexOf(String(currentValue))
    if (diff <= 0) return 'At target!'
    return diff + ' grade' + (diff !== 1 ? 's' : '') + ' to go'
  }
  diff = goal.type === 'weight' && Number(goal.target) < Number(goal.startValue)
    ? Number(currentValue) - Number(goal.target)
    : Number(goal.target) - Number(currentValue)
  if (diff <= 0) return 'Target reached!'
  var u = goal.unit ? ' ' + goal.unit : ''
  // Distances round to whole units past 10 — nobody needs 12.3 km to go. Weight
  // is the exception: it keeps the decimal at every size, because the Dashboard
  // card quotes the same figure and "10.8 kg" there against "11 kg" here reads
  // as two different numbers.
  var str = diff < 10 || goal.type === 'weight'
    ? diff.toFixed(1).replace(/\.0$/, '')
    : Math.round(diff).toString()
  // Bodyweight also in percent: the same kg is a different ask at 60 kg than at
  // 110, and the percentage is the half of the pair that stays comparable.
  if (goal.type === 'weight') {
    var pct = pctOfBodyweight(diff, currentValue)
    if (pct !== null) return str + u + ' (' + pct + '%) to go'
  }
  return str + u + ' to go'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({ progress, color }) {
  return (
    <div className="flex-1 rounded-full overflow-hidden" style={{ height: '6px', background: '#e5e7ef' }}>
      <div
        className="h-full rounded-full"
        style={{ width: Math.round(Math.max(0, Math.min(1, progress)) * 100) + '%', background: color }}
      />
    </div>
  )
}

function ActiveGoalCard({ goal, currentValue, sessions, heightCm, weightEntries, sessionsPerWeek, onEdit, onDelete }) {
  var meta     = GOAL_META[goal.type] || GOAL_META.boulder_grade
  var Icon     = meta.Icon
  var progress = calcGoalProgress(goal, currentValue)
  var days     = daysLeft(goal.targetDate)

  var fromStr = String(goal.startValue) + (goal.unit ? ' ' + goal.unit : '')
  var toStr   = String(goal.target)    + (goal.unit ? ' ' + goal.unit : '')
  var curStr  = currentValue !== null && currentValue !== undefined
    ? String(currentValue) + (goal.unit ? ' ' + goal.unit : '')
    : null
  var distStr = toGoLabel(goal, currentValue)
  var kindLabel = goalKindLabel(goal)

  // How big the goal is, as a share of the weight it starts from — fixed for
  // the life of the goal, unlike the remaining percentage in the status row.
  // It rides the title row rather than the status row, which already carries
  // the current weight, the distance left and the days, and would wrap.
  var cutStr = null
  if (goal.type === 'weight') {
    var cutPct = pctOfBodyweight(Number(goal.target) - Number(goal.startValue), goal.startValue)
    if (cutPct) cutStr = cutPct + '% ' + (Number(goal.target) < Number(goal.startValue) ? 'cut' : 'gain')
  }

  // The pace, and what a healthy pace would be. This is the goal itself, so
  // this is where the reasoning lives — the Dashboard card shows the rate and
  // leaves the argument here.
  var rate = goal.type === 'weight'
    ? assessWeightGoalRate({ currentKg: currentValue, targetKg: goal.target, targetDate: goal.targetDate })
    : null
  var showRate = rate && rate.kgPerWeek !== null && rate.direction !== 'hold'

  // The score, and the reasons behind it. The Dashboard card shows the mark
  // alone; this is where it is explained (goals spec, "putting the achievability
  // score on screen").
  var score = goal.type === 'weight'
    ? scoreWeightGoal({
        goal: goal, currentKg: currentValue, heightCm: heightCm,
        weightEntries: weightEntries, sessionsPerWeek: sessionsPerWeek,
      })
    : null
  // Headroom is excluded: the healthy-rate sentence a few lines down says
  // exactly that, and repeating it costs the slot a new reason would take.
  var why = score ? topReasons(score, 2, ['headroom']) : []

  // The same question for a climbing goal, answered from the shape of the log
  // rather than inferred from a pace (grade pyramid spec §4). Memoised because
  // building the pyramid walks the climb log, and this card re-renders on every
  // keystroke in the sheet above it.
  var gradeShape = pyramidShapeFor(goal.type)
  var pyr = useMemo(function () {
    if (!pyramidShapeFor(goal.type)) return null
    return pyramidForGoal({ goalType: goal.type, targetGrade: goal.target, sessions: sessions })
  }, [goal.type, goal.target, sessions])

  // Shown beside "Currently" so moving to the base grade hides nothing: the
  // number people were attached to is still on the card, correctly labelled as
  // the hardest single send rather than as what they climb.
  var projectStr = pyr && pyr.pyramid && pyr.pyramid.project
    ? pyr.pyramid.project.grade
    : null

  var readiness = pyr ? pyr.readiness : null
  // Provenance, the gap, and what the log says about the target grade itself —
  // the three sentences the data-honesty spec asks for. All describe the log.
  var pyrBasis    = pyr ? describePyramidBasis(pyr.pyramid) : null
  var pyrNextUp   = readiness ? describeNextUp(readiness) : null
  var pyrEvidence = pyr ? describeTargetEvidence(pyr.pyramid, goal.target) : null

  // Phase 3 — when the base is likely to be built, and how that sits against
  // the deadline. A date and a margin, never a chance of success: spec §7.1 is
  // the argument, and the same pyramid against two deadlines gives two margins
  // without any extra machinery. Memoised with the pyramid because the timeline
  // replays the log at fortnightly steps.
  var forecast = useMemo(function () {
    if (!gradeShape || !pyr) return null
    return forecastReady({
      pyramid:     pyr.pyramid,
      readiness:   pyr.readiness,
      system:      gradeShape.system,
      targetGrade: goal.target,
      todayIso:    new Date().toISOString().slice(0, 10),
      deadlineIso: goal.targetDate || null,
      timeline:    gradeTimeline(sessions, gradeShape.disciplines, gradeShape.system),
    })
  }, [gradeShape, pyr, goal.target, goal.targetDate, sessions])

  var forecastLine  = describeForecast(forecast)
  var forecastSteps = describeForecastSteps(forecast)
  var forecastBasis = forecast && !forecast.reason ? describeForecastBasis(forecast) : null

  // What a weekly habit would buy, and the mark that takes the deadline into
  // account — the same thing the weight goal's dots have always done.
  var planLine = describePlan(forecastAtPlannedRate({
    readiness:      pyr ? pyr.readiness : null,
    conversionDays: forecast ? forecast.conversionDays : 0,
    measuredPerDay: forecast && forecast.rate ? forecast.rate.perDay : 0,
    deadlineIso:    goal.targetDate || null,
  }))
  var gradeMark = pyr ? goalScore({ readiness: pyr.readiness, forecast: forecast }) : null

  return (
    <div className="bg-white rounded-xl border border-[#e5e7ef] px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color: meta.color }} className="shrink-0" />
        <span className="text-sm font-bold text-[#1a1d2e]" style={barlow}>
          {meta.label}{kindLabel ? ' · ' + kindLabel : ''}
        </span>
        {cutStr && (
          <span className="text-[9px] text-[#7a8299] shrink-0" style={barlow}>{cutStr}</span>
        )}
        <span className="flex-1" />
        <button
          onClick={onEdit}
          className="text-[10px] text-[#7a8299] hover:text-[#1a1d2e] transition-colors px-1"
          style={barlow}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="text-[#bbbcc8] hover:text-[#ef4444] transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Progress bar with start / target labels — weight and cardio only.
          A grade goal shows the pyramid instead (BTL-B4): a bar counting ladder
          rungs from a fixed `startValue` says progress toward a grade is linear
          in rungs, and the tiers below say it is about how much of the base
          exists. Two answers to one question on one card, and the bar was the
          worse one. The target still shows, on the status row. */}
      {!gradeShape && (
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] text-[#7a8299] shrink-0" style={barlow}>{fromStr}</span>
          <ProgressBar progress={progress} color={meta.color} />
          <span className="text-[10px] font-bold shrink-0" style={{ ...barlow, color: meta.color }}>{toStr}</span>
        </div>
      )}

      {/* Status row. "Currently" on a grade goal is the pyramid's *base* — the
          grade you own — which reads lower than the old number and can be absent
          altogether. Project is shown beside it so the change hides nothing, and
          an absent base says so rather than falling back to a career high. */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[#7a8299]" style={barlow}>
          {gradeShape && !curStr
            ? 'No base yet'
            : curStr ? ('Currently ' + curStr) : 'No data yet'}
          {gradeShape && projectStr && projectStr !== curStr
            ? (' · project ' + projectStr) : ''}
          {distStr ? (' · ' + distStr) : ''}
        </span>
        <span
          className="text-[9px] font-bold shrink-0 ml-2"
          style={{ ...barlow, color: daysColor(days) }}
        >
          {days < 0 ? 'Overdue' : days === 0 ? 'Today!' : days + 'd left'}
        </span>
      </div>

      {/* Rate row — weight goals only. Always states what a healthy rate would
          be, not only when this goal exceeds it: this is the goal itself, so
          this is where the reasoning belongs, and the Dashboard card is free to
          show the pace and nothing else. */}
      {showRate && (
        <div className="mt-1.5 pt-1.5 border-t border-[#f0f1f5]">
          {score && score.score !== null && (
            <div className="flex items-center gap-1.5 mb-1">
              <ScoreDots score={score.score} />
              <span className="text-[10px] font-bold" style={{ ...barlow, color: SCORE_COLOR[score.score] }}>
                {score.label}
              </span>
            </div>
          )}
          <p className="text-[10px] font-bold" style={{ ...barlow, color: RATE_COLOR[rate.band] }}>
            {(rate.direction === 'lose' ? 'Lose ' : 'Gain ') + describeRate(rate)}
          </p>
          <p className="text-[9px] mt-0.5" style={{ ...barlow, color: rate.band === 'steady' ? '#7a8299' : RATE_COLOR[rate.band] }}>
            {rateWarning(rate)
              || rate.pctPerWeek + '% of bodyweight a week · healthy '
                 + (rate.direction === 'lose' ? 'loss' : 'gain') + ' tops out around '
                 + rate.limitKgPerWeek + ' kg a week for you'}
          </p>
          {/* Two at most, worst first, and only when the score is 3 or below —
              at 4-5 there is nothing to say and a card should not manufacture
              concern. */}
          {why.length > 0 && (
            <p className="text-[9px] mt-0.5" style={{ ...barlow, color: '#7a8299' }}>
              {why.join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Pyramid row — climbing goals. The mark, then the tiers, then three
          sentences that all describe the log rather than the climber: where the
          reading came from, what the log says about the target grade, and what
          would fill the base next (docs/specs/betalog_data_honesty_spec.md). */}
      {readiness && readiness.target && (
        <div className="mt-1.5 pt-1.5 border-t border-[#f0f1f5]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ScoreDots score={gradeMark ? gradeMark.score : readiness.score} />
            <span className="text-[10px] font-bold" style={{ ...barlow, color: SCORE_COLOR[readiness.score] }}>
              {readiness.label}
            </span>
            {pyrBasis && (
              <span className="text-[9px] text-[#bbbcc8] ml-auto" style={barlow}>{pyrBasis}</span>
            )}
          </div>

          {/* One row per tier, widest at the top, narrowing down to the target. */}
          <div className="mb-1.5">
            <PyramidChart tiers={readiness.tiers} color={meta.color} />
          </div>

          {pyrEvidence && (
            <p className="text-[9px]" style={{ ...barlow, color: readiness.sentTarget ? '#2a9d5c' : '#7a8299' }}>
              {pyrEvidence}
            </p>
          )}
          {pyrNextUp && (
            <p className="text-[9px] mt-0.5" style={{ ...barlow, color: '#7a8299' }}>
              {pyrNextUp}
            </p>
          )}

          {/* The projection. Deliberately last: it is the softest thing on the
              card, and it reads as a consequence of the tiers above it rather
              than as a headline. */}
          {forecastLine && (
            <div className="mt-1.5 pt-1.5 border-t border-[#f4f5f9]">
              <p className="text-[9px] font-bold" style={{
                ...barlow,
                color: forecast.onTrack === false ? '#d97706' : '#7a8299',
              }}>
                {forecastLine}
              </p>
              {forecastSteps && (
                <p className="text-[9px] mt-0.5" style={{ ...barlow, color: '#7a8299' }}>
                  {forecastSteps}
                </p>
              )}
              {planLine && (
                <p className="text-[9px] mt-0.5" style={{ ...barlow, color: '#7a8299' }}>
                  {planLine}
                </p>
              )}
              {forecastBasis && (
                <p className="text-[9px] mt-0.5" style={{ ...barlow, color: '#bbbcc8' }}>
                  {forecastBasis}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AchievedGoalCard({ goal, onDelete }) {
  var meta = GOAL_META[goal.type] || GOAL_META.boulder_grade
  var Icon = meta.Icon
  var dateStr = ''
  if (goal.achievedDate) {
    try {
      dateStr = new Date(goal.achievedDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    } catch { dateStr = goal.achievedDate }
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#edfaf2] border border-[#d1f5e0]">
      <Check size={12} style={{ color: '#2a9d5c' }} className="shrink-0" />
      <Icon size={12} style={{ color: meta.color }} className="shrink-0" />
      <span className="text-xs font-bold text-[#1a1d2e] flex-1 min-w-0 truncate" style={barlow}>
        {meta.label} — {goalKindLabel(goal) || (String(goal.target) + (goal.unit ? ' ' + goal.unit : ''))}
      </span>
      {dateStr && (
        <span className="text-[9px] text-[#2a9d5c] shrink-0" style={barlow}>{dateStr}</span>
      )}
      <button
        onClick={onDelete}
        className="text-[#bbbcc8] hover:text-[#ef4444] transition-colors shrink-0"
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit sheet
// ---------------------------------------------------------------------------

function GoalSheet({ open, onClose, editGoal, onSave, currentWeight, heightCm, weightEntries, sessionsPerWeek, sessions }) {
  var [type,       setType]       = useState('boulder_grade')
  var [target,     setTarget]     = useState('')
  var [targetDate, setTargetDate] = useState('')
  var [kind,       setKind]       = useState('send')

  useEffect(function () {
    if (!open) return
    if (editGoal) {
      setType(editGoal.type)
      setTarget(String(editGoal.target))
      setTargetDate(editGoal.targetDate)
      setKind(editGoal.kind === 'become' ? 'become' : 'send')
    } else {
      setType('boulder_grade')
      setTarget('')
      setKind('send')
      var d = new Date(); d.setMonth(d.getMonth() + 3)
      setTargetDate(d.toISOString().slice(0, 10))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  var typeConfig = GOAL_TYPES.find(function (t) { return t.key === type }) || GOAL_TYPES[0]
  var gradeList  = type === 'boulder_grade' ? V_GRADES : type === 'rope_grade' ? FRENCH_GRADES : null

  // What this weight goal would ask for per week, live as the target and date
  // are typed. A loss beyond the healthy limit is refused outright; everything
  // else is shown and left to the user.
  var rate = type === 'weight'
    ? assessWeightGoalRate({ currentKg: currentWeight, targetKg: target, targetDate: targetDate })
    : null
  var rateNote = rate ? rateWarning(rate) : null

  // Scored live as the target and the date change, which is what turns this
  // sheet from a form into a tuner. Never gates Save — weightRate owns blocking,
  // on health grounds; a poor bet inside the healthy rate is the user's call.
  var score = type === 'weight' && target !== '' && targetDate !== ''
    ? scoreWeightGoal({
        goal: { target: target, targetDate: targetDate, startValue: currentWeight, createdAt: null },
        currentKg: currentWeight, heightCm: heightCm,
        weightEntries: weightEntries, sessionsPerWeek: sessionsPerWeek,
      })
    : null
  var scoreWhy = score ? topReasons(score, 2, ['headroom']) : []

  // The climbing half of the same tuner: pick a grade and the base under it is
  // read straight from the log. It never gates Save — a weight goal is blocked on
  // health grounds and nothing about aiming at a grade is a health risk.
  //
  // The ladder is scored for *every* grade, so the picker itself can say which
  // targets the log already supports. It depends only on the discipline and the
  // log — not on which grade is currently selected — so tapping through targets
  // re-reads a pyramid that is already built rather than walking the log again.
  var sheetLadder = useMemo(function () {
    if (!pyramidShapeFor(type)) return null
    return pyramidLadder({ goalType: type, sessions: sessions })
  }, [type, sessions])

  var sheetPyr = useMemo(function () {
    if (!sheetLadder || target === '') return null
    return {
      pyramid:   sheetLadder.pyramid,
      readiness: pyramidReadiness({ pyramid: sheetLadder.pyramid, targetGrade: target }),
    }
  }, [sheetLadder, target])
  var sheetReadiness = sheetPyr ? sheetPyr.readiness : null
  var sheetBasis     = sheetPyr ? describePyramidBasis(sheetPyr.pyramid) : null
  var sheetEvidence  = sheetPyr ? describeTargetEvidence(sheetPyr.pyramid, target) : null
  var sheetNextUp    = sheetReadiness ? describeNextUp(sheetReadiness) : null

  var canSave = target !== '' && targetDate !== '' && !(rate && rate.blocked)

  function handleSave() {
    if (!canSave) return
    var finalTarget = (type === 'boulder_grade' || type === 'rope_grade') ? target : (Number(target) || 0)
    onSave({
      type: type, target: finalTarget, unit: typeConfig.unit, targetDate: targetDate,
      kind: gradeList ? kind : null,
    })
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '20px' }}>
            {editGoal ? 'Edit Goal' : 'New Goal'}
          </p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">

          {/* Type selector — locked when editing */}
          {!editGoal ? (
            <div>
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5" style={barlow}>Type</p>
              <div className="flex flex-wrap gap-1.5">
                {GOAL_TYPES.map(function (t) {
                  var active = t.key === type
                  return (
                    <button
                      key={t.key}
                      onClick={function () { setType(t.key); setTarget('') }}
                      className="px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-colors"
                      style={active
                        ? { borderColor: '#4f7ef8', background: '#eef1ff', color: '#4f7ef8', ...barlow }
                        : { borderColor: '#e5e7ef', background: '#fff', color: '#7a8299', ...barlow }
                      }
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-0.5" style={barlow}>Type</p>
              <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>
                {(GOAL_META[type] || {}).label || type}
              </p>
            </div>
          )}

          {/* Target */}
          <div>
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5" style={barlow}>
              Target{typeConfig.unit ? ' (' + typeConfig.unit + ')' : ''}
            </p>
            {gradeList ? (
              <GradeTargetPicker
                grades={gradeList}
                value={target}
                onChange={setTarget}
                rungs={sheetLadder ? sheetLadder.rungs : null}
                ready={sheetLadder ? sheetLadder.ready : null}
              />
            ) : (
              <input
                type="number"
                inputMode="decimal"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white focus:outline-none focus:border-[#4f7ef8] transition-colors"
                value={target}
                onChange={function (e) { setTarget(e.target.value) }}
                placeholder={type === 'weight' ? 'e.g. 75' : 'e.g. 10'}
              />
            )}
          </div>

          {/* Which kind of grade goal (spec Q2). Send is the default: the first
              7a is the one people remember, and it is what every goal set
              before this choice existed meant. */}
          {gradeList && (
            <div>
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5" style={barlow}>Kind</p>
              <div className="flex gap-1.5">
                {[
                  { key: 'send',   short: 'Send it', hint: 'Done on one send at the grade' },
                  { key: 'become', short: 'Own it',  hint: 'Done when your base reaches the grade' },
                ].map(function (k) {
                  var active = k.key === kind
                  return (
                    <button
                      key={k.key}
                      onClick={function () { setKind(k.key) }}
                      className="flex-1 px-3 py-1.5 rounded-xl border-2 text-left transition-colors"
                      style={active
                        ? { borderColor: '#4f7ef8', background: '#eef1ff', ...barlow }
                        : { borderColor: '#e5e7ef', background: '#fff', ...barlow }
                      }
                    >
                      <span className="block text-xs font-bold" style={{ color: active ? '#4f7ef8' : '#1a1d2e' }}>
                        {target ? goalKindLabel({ type: type, kind: k.key, target: target }) : k.short}
                      </span>
                      <span className="block text-[9px]" style={{ color: '#7a8299' }}>{k.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Target date */}
          <div>
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5" style={barlow}>Target date</p>
            <input
              type="date"
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white focus:outline-none focus:border-[#4f7ef8] transition-colors"
              value={targetDate}
              onChange={function (e) { setTargetDate(e.target.value) }}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* What the goal asks for per week. Shown as soon as there is enough
              to work it out, so the pace is visible while the date is still
              being chosen rather than as a refusal at the end. */}
          {rate && rate.band !== 'unknown' && rate.direction !== 'hold' && (
            <div
              className="rounded-xl px-3 py-2"
              style={{
                background: rate.blocked ? '#fef2f2' : rate.band === 'steady' ? '#f4f5f9' : '#fffbeb',
                border: '1px solid ' + (rate.blocked ? '#fecaca' : rate.band === 'steady' ? '#e5e7ef' : '#fde68a'),
              }}
            >
              {rate.band === 'past' ? (
                <p className="text-[11px] text-[#ef4444]" style={barlow}>That date has already passed.</p>
              ) : (
                <>
                  {score && score.score !== null && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <ScoreDots score={score.score} size={6} />
                      <span className="text-[10px] font-bold" style={{ ...barlow, color: SCORE_COLOR[score.score] }}>
                        {score.label}
                      </span>
                    </div>
                  )}
                  <p className="text-xs font-bold" style={{ ...barlow, color: rate.blocked ? '#ef4444' : '#1a1d2e' }}>
                    {(rate.direction === 'lose' ? 'Lose ' : 'Gain ') + describeRate(rate)}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ ...barlow, color: rate.blocked ? '#ef4444' : '#7a8299' }}>
                    {rateNote || rate.pctPerWeek + '% of bodyweight a week over ' + rate.days + ' days'}
                  </p>
                  {scoreWhy.length > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ ...barlow, color: '#7a8299' }}>
                      {scoreWhy.join(' · ')}
                    </p>
                  )}
                  {!currentWeight && (
                    <p className="text-[10px] mt-0.5 text-[#bbbcc8]" style={barlow}>
                      Based on a 1 kg/week limit — log a weigh-in for a figure scaled to you.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* The same panel for a climbing goal: what the base under this target
              looks like right now, read from the log. Never a refusal. */}
          {sheetReadiness && sheetReadiness.target && (
            <div className="rounded-xl px-3 py-2" style={{ background: '#f4f5f9', border: '1px solid #e5e7ef' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ScoreDots score={sheetReadiness.score} size={6} />
                <span className="text-[10px] font-bold" style={{ ...barlow, color: SCORE_COLOR[sheetReadiness.score] }}>
                  {sheetReadiness.label}
                </span>
                {sheetBasis && (
                  <span className="text-[9px] text-[#bbbcc8] ml-auto" style={barlow}>{sheetBasis}</span>
                )}
              </div>
              <PyramidChart tiers={sheetReadiness.tiers} color="#4f7ef8" trackColor="#e2e5ee" />
              {sheetEvidence && (
                <p className="text-[10px] mt-1.5" style={{ ...barlow, color: sheetReadiness.sentTarget ? '#2a9d5c' : '#7a8299' }}>
                  {sheetEvidence}
                </p>
              )}
              {sheetNextUp && (
                <p className="text-[10px] mt-0.5 text-[#7a8299]" style={barlow}>{sheetNextUp}</p>
              )}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-2.5 rounded-xl text-white font-bold text-sm transition-colors"
            style={{
              background: canSave ? '#4f7ef8' : '#bbbcc8',
              cursor: canSave ? 'pointer' : 'default',
              ...barlow,
            }}
          >
            {editGoal ? 'Update Goal' : 'Set Goal'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GoalsSection — main export
// ---------------------------------------------------------------------------

export default function GoalsSection() {
  var { data }                            = useData()
  var { goals, addGoal, updateGoal, deleteGoal } = useGoals()
  // Stable identities: `data.sessions || []` mints a fresh array on every render
  // when the key is missing, which would defeat every memo downstream — and the
  // grade scorer's timeline replay is the one thing here worth memoising.
  var sessions  = useMemo(function () { return data.sessions  || [] }, [data.sessions])
  var weightLog = useMemo(function () { return data.weightLog || [] }, [data.weightLog])

  var [sheetOpen,   setSheetOpen]   = useState(false)
  var [editingGoal, setEditingGoal] = useState(null)
  var [confirmId,   setConfirmId]   = useState(null)

  // Measured, not asked — feeds the maintenance estimate behind the score.
  var recent30 = filterSessionsByDays(sessions, 30)
  var sessionsPerWeek = Math.round((recent30.length / (30 / 7)) * 10) / 10

  var activeGoals   = goals.filter(function (g) { return !g.achieved })
  var achievedGoals = goals.filter(function (g) { return g.achieved })

  function handleSave(params) {
    if (editingGoal) {
      var updates = { target: params.target, targetDate: params.targetDate, unit: params.unit }
      // Switching kind changes how the goal is judged, not what it is aiming at,
      // so it keeps the baseline below.
      if (params.kind) updates.kind = params.kind
      // A new target is a new goal (goals spec, decision 2). Without this the
      // progress bar keeps measuring from a value the athlete may be nowhere
      // near, and the achievability score carries schedule debt earned against
      // a target that no longer exists. Moving only the date keeps the baseline,
      // because the goal itself has not changed.
      if (String(params.target) !== String(editingGoal.target)) {
        var now = getCurrentValueDetail(editingGoal.type, sessions, weightLog).value
        if (now !== null && now !== undefined) {
          updates.startValue = now
          updates.createdAt  = new Date().toISOString()
        }
      }
      updateGoal(editingGoal.id, updates)
    } else {
      addGoal(params)
    }
  }

  function openEdit(goal) {
    setEditingGoal(goal)
    setSheetOpen(true)
  }

  function openAdd() {
    setEditingGoal(null)
    setSheetOpen(true)
  }

  function handleDelete(id) {
    if (confirmId === id) {
      deleteGoal(id)
      setConfirmId(null)
    } else {
      setConfirmId(id)
      setTimeout(function () { setConfirmId(null) }, 3000)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>Goals</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-[#4f7ef8] border border-[#4f7ef8] hover:bg-[#eef1ff] transition-colors"
          style={barlow}
        >
          <Plus size={11} /> Add
        </button>
      </div>

      {/* Empty state */}
      {activeGoals.length === 0 && achievedGoals.length === 0 && (
        <div className="py-4 text-center">
          <p className="text-xs text-[#bbbcc8]">No goals yet — tap Add to set one</p>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.map(function (g) {
        var current = getCurrentValueDetail(g.type, sessions, weightLog)
        return (
          <ActiveGoalCard
            key={g.id}
            goal={g}
            currentValue={current.value}
            sessions={sessions}
            heightCm={(data.athleteProfile || {}).heightCm || null}
            weightEntries={weightLog}
            sessionsPerWeek={sessionsPerWeek}
            onEdit={function () { openEdit(g) }}
            onDelete={function () { handleDelete(g.id) }}
          />
        )
      })}

      {/* Achieved goals */}
      {achievedGoals.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-[9px] font-bold text-[#bbbcc8] uppercase tracking-widest" style={barlow}>Achieved</p>
          {achievedGoals.map(function (g) {
            return (
              <AchievedGoalCard
                key={g.id}
                goal={g}
                onDelete={function () { handleDelete(g.id) }}
              />
            )
          })}
        </div>
      )}

      <GoalSheet
        open={sheetOpen}
        onClose={function () { setSheetOpen(false); setEditingGoal(null) }}
        editGoal={editingGoal}
        onSave={handleSave}
        // The sheet gates a weight goal on the pace it implies, which it cannot
        // work out without knowing what you weigh now. Latest weigh-in first,
        // the profile's figure when there is no log yet.
        currentWeight={getCurrentValueDetail('weight', sessions, weightLog).value
          || ((data.athleteProfile || {}).weightKg || null)}
        heightCm={(data.athleteProfile || {}).heightCm || null}
        weightEntries={weightLog}
        sessionsPerWeek={sessionsPerWeek}
        sessions={sessions}
      />
    </div>
  )
}
