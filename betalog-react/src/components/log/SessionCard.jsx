// ---------------------------------------------------------------------------
// SessionCard — unified card for all session types in the History feed.
// Structure: [Type badge]  Session name          ● difficulty
//            Detail summary line
// ---------------------------------------------------------------------------

import { hardestGrade, gradeLevel, LEVEL_COLOR, climbGradeSystem } from '../../lib/stats'
import { summariseCard, formatScore, placingText } from '../../lib/competition'
import { climbSummaryLine, isOpenClimbSession } from '../../lib/sessions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var TYPE_META = {
  gym:       { label: 'Train',  bg: '#eef1ff', color: '#4f7ef8' },
  climb:     { label: 'Climb',  bg: '#fff4ec', color: '#c0622a' },
  hangboard: { label: 'Hang',   bg: '#f5eeff', color: '#8b5cf6' },
  cardio:    { label: 'Cardio', bg: '#ecfdf5', color: '#0d9488' },
}

var DIFFICULTY_FILL = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }
var DIFFICULTY_LABEL = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']

var DISCIPLINE_NAME = {
  boulder: 'Bouldering',
  lead:    'Lead',
  toprope: 'Top Rope',
  mixed:   'Mixed',
}

var OUTCOME_COLOR = { flashed: '#2a9d5c', sent: '#4f7ef8', attempt: '#7a8299', project: '#d4742a' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalise(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function sessionName(session) {
  if (session.type === 'gym') {
    return session.routineName || (session.exercises.length > 0 ? session.exercises[0].name : 'Ad-hoc')
  }
  if (session.type === 'hangboard') {
    return session.routineName || 'Hangboard'
  }
  if (session.type === 'climb') {
    var discKey = climbDisciplineKey(session)
    return DISCIPLINE_NAME[discKey] || 'Climbing'
  }
  if (session.type === 'cardio') {
    return session.cardioLabel || capitalise(session.cardioActivity) || 'Cardio'
  }
  return 'Session'
}

function climbDisciplineKey(session) {
  if (session.discipline) return session.discipline
  if (!session.climbs || session.climbs.length === 0) return null
  var first   = session.climbs[0].discipline
  var allSame = session.climbs.every(function (c) { return c.discipline === first })
  return allSame ? first : 'mixed'
}

function gymDetail(exercises) {
  if (!exercises || exercises.length === 0) return 'No exercises logged'
  // Prefer the "done" exercises in the summary so the reader sees what was actually completed.
  var done = exercises.filter(function (se) { return se.done !== false })
  var listed = done.length > 0 ? done : exercises
  var parts = listed.slice(0, 3).map(function (se) {
    var topSet = se.sets && se.sets.length > 0 ? se.sets[0] : null
    if (!topSet) return se.name
    if (se.trackingType === 'time') return se.name + ' ' + se.sets.length + '×' + topSet.reps + 's'
    var w = topSet.weight === 0 ? 'BW' : topSet.weight > 0 ? '+' + topSet.weight + 'kg' : topSet.weight + 'kg'
    return se.name + ' ' + se.sets.length + '×' + topSet.reps + ' ' + w
  })
  var more = listed.length > 3 ? ' +' + (listed.length - 3) + ' more' : ''
  return parts.join(' · ') + more
}

function routineCompletion(session) {
  if (session.type !== 'gym' || !session.routineId) return null
  var total = session.exercises.length
  if (!total) return null
  var done = session.exercises.filter(function (se) { return se.done !== false }).length
  if (done === total) return null  // only surface partial completions
  return { done: done, total: total }
}

/**
 * The level a climb session reads at: the hardest *send* in it and the band
 * that grade sits in, in the band's colour — "V4 · ADVANCED" on the card.
 *
 * Sends only. The level word means the grade you can climb, and the explainer
 * says it is read from what you own, "not the hardest thing you have touched
 * once"; an attempt is a grade touched. A session with no send has no level
 * pill — the line below still names the hardest grade tried, as an attempt.
 * (2026-09-18, Ben: "we appear to have room in the history to display the
 * level also".)
 */
function climbLevel(climbs) {
  var top = hardestGrade(climbs, true)
  if (!top) return null
  var climb  = (climbs || []).filter(function (c) { return c && c.grade === top })[0]
  var system = climbGradeSystem(climb)
  var level  = gradeLevel(top, system)
  if (!level) return null
  return { grade: top, level: level, colors: LEVEL_COLOR[level] || LEVEL_COLOR.Beginner, system: system }
}

function formatSecs(secs) {
  var m = Math.floor(secs / 60)
  var s = secs % 60
  return m > 0 ? m + 'm' + (s > 0 ? ' ' + s + 's' : '') : s + 's'
}

function cardioDetail(session) {
  var activity = session.cardioLabel || capitalise(session.cardioActivity) || 'Cardio'
  var parts    = [activity]
  if (session.cardioQuantity && session.cardioUnit) {
    var qty = session.cardioQuantity
    // Show derived metres for swim lengths
    if (session.cardioActivity === 'swim' && session.cardioUnit === 'lengths' && session.cardioPoolLength) {
      var metres = Math.round(qty * session.cardioPoolLength)
      parts.push(qty + ' ' + session.cardioUnit + ' (' + (metres >= 1000 ? (metres / 1000).toFixed(1) + ' km' : metres + ' m') + ')')
    } else {
      parts.push(qty + ' ' + session.cardioUnit)
    }
  }
  if (session.cardioDurationMins) parts.push(session.cardioDurationMins + ' min')
  if (session.cardioKcalLow && session.cardioKcalHigh) {
    var mid = Math.round((session.cardioKcalLow + session.cardioKcalHigh) / 2)
    parts.push('~' + mid + ' kcal')
  }
  return parts.join(' · ')
}

function hangDetail(grips) {
  if (!grips || grips.length === 0) return 'No grips logged'
  var names     = grips.slice(0, 3).map(function (g) { return g.gripName || g.grip })
  var more      = grips.length > 3 ? ' +' + (grips.length - 3) : ''
  var totalSecs = grips.reduce(function (acc, g) { return acc + (g.activeSecs * g.reps * g.sets) }, 0)
  return names.join(' · ') + more + (totalSecs > 0 ? ' · ' + formatSecs(totalSecs) + ' hang' : '')
}

// ---------------------------------------------------------------------------
// SessionCard
// ---------------------------------------------------------------------------

var COMP_META = { label: 'Comp', bg: '#eef1ff', color: '#4f7ef8' }

/** "12 tops · 9 zones · 41 goes · 6 climbs logged" for a competition scorecard session. */
function compDetail(session) {
  var sum = summariseCard(session.comp)
  if (!sum) return climbSummaryLine(session.climbs)
  var climbs = (session.climbs || []).length
  var placed = session.comp.placing ? 'Final: ' + placingText(session.comp.placing) : null
  return [
    placed,
    formatScore(sum.score) + ' pts',
    sum.tops + (sum.tops === 1 ? ' top' : ' tops'),
    sum.zones + (sum.zones === 1 ? ' zone' : ' zones'),
    sum.attempts + (sum.attempts === 1 ? ' go' : ' goes'),
    climbs ? climbs + (climbs === 1 ? ' climb' : ' climbs') + ' in your log' : 'no graded problems yet',
  ].filter(Boolean).join(' · ')
}

export default function SessionCard({ session, onClick }) {
  var isComp   = !!session.comp
  var typeMeta = isComp ? COMP_META : (TYPE_META[session.type] || TYPE_META.gym)
  var name     = isComp ? session.comp.name : sessionName(session)
  var diff     = session.difficulty
  var diffFill = diff ? DIFFICULTY_FILL[diff] : null
  var diffLabel = diff ? DIFFICULTY_LABEL[diff - 1] : null

  var detail = isComp                       ? compDetail(session)
             : session.type === 'gym'       ? gymDetail(session.exercises)
             : session.type === 'climb'     ? climbSummaryLine(session.climbs)
             : session.type === 'hangboard' ? hangDetail(session.hangGrips)
             : session.type === 'cardio'    ? cardioDetail(session)
             : ''
  var completion = routineCompletion(session)
  var level      = session.type === 'climb' ? climbLevel(session.climbs) : null
  // Still being logged — saved as you go, not yet finished (BTL-B109).
  var isOpen     = isOpenClimbSession(session)

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 border-b border-[#f0f1f5] last:border-0 hover:bg-[#f8f9fc] active:bg-[#f0f2ff] transition-colors"
    >
      {/* Line 1: type badge · name · difficulty dot */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className="shrink-0 px-2 py-0.5 rounded-md text-xs font-bold"
          style={{ background: typeMeta.bg, color: typeMeta.color, fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {typeMeta.label}
        </span>
        <span
          className="flex-1 font-semibold text-[#1a1d2e] truncate"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px' }}
        >
          {name}
        </span>
        {level && (
          <span
            className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
            style={{ background: level.colors.bg, color: level.colors.color, fontFamily: "'Barlow Condensed', sans-serif" }}
            title={'Hardest send ' + level.grade + ' — ' + level.level}
          >
            {level.grade} · {level.level}
          </span>
        )}
        {completion && (
          <span
            className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border"
            style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa', fontFamily: "'Barlow Condensed', sans-serif" }}
            title="Routine partially completed"
          >
            {completion.done}/{completion.total}
          </span>
        )}
        {diffFill && (
          <span
            className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: diffFill, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {diffLabel}
          </span>
        )}
        {isOpen && (
          <span
            className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide"
            style={{ background: '#fff', color: '#c0622a', borderColor: '#c0622a', fontFamily: "'Barlow Condensed', sans-serif" }}
            title="Still being logged — finish it with a session feel"
          >
            Open
          </span>
        )}
      </div>

      {/* Line 2: detail summary */}
      <p className="text-xs text-[#7a8299] truncate">{detail}</p>

      {/* Notes excerpt */}
      {session.notes ? (
        <p className="text-xs text-[#bbbcc8] truncate italic mt-0.5">{session.notes}</p>
      ) : null}
    </button>
  )
}
