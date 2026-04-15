// ---------------------------------------------------------------------------
// SessionCard — unified card for all session types in the History feed.
// Structure: [Type badge]  Session name          ● difficulty
//            Detail summary line
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var TYPE_META = {
  gym:       { label: 'Train', bg: '#eef1ff', color: '#4f7ef8' },
  climb:     { label: 'Climb', bg: '#fff4ec', color: '#c0622a' },
  hangboard: { label: 'Hang',  bg: '#f5eeff', color: '#8b5cf6' },
}

var DIFFICULTY_FILL = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }
var DIFFICULTY_LABEL = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']

var DISCIPLINE_NAME = {
  boulder: 'Bouldering',
  lead:    'Lead',
  toprope: 'Top Rope',
  mixed:   'Mixed',
}

var OUTCOME_LABEL = { flashed: 'Flash', sent: 'Send', attempt: 'Att', project: 'Proj' }
var OUTCOME_COLOR = { flashed: '#2a9d5c', sent: '#4f7ef8', attempt: '#7a8299', project: '#d4742a' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function climbDetail(climbs) {
  if (!climbs || climbs.length === 0) return 'No climbs logged'
  var counts = { flashed: 0, sent: 0, attempt: 0, project: 0 }
  climbs.forEach(function (c) { if (counts[c.outcome] !== undefined) counts[c.outcome]++ })
  var grades   = climbs.map(function (c) { return c.grade }).filter(Boolean).sort()
  var topGrade = grades.length > 0 ? grades[grades.length - 1] : null
  var pills    = Object.entries(counts)
    .filter(function (kv) { return kv[1] > 0 })
    .map(function (kv) { return kv[1] + ' ' + OUTCOME_LABEL[kv[0]] })
    .join(' · ')
  return climbs.length + ' climb' + (climbs.length !== 1 ? 's' : '') +
    (topGrade ? ' · Top: ' + topGrade : '') +
    (pills ? ' · ' + pills : '')
}

function formatSecs(secs) {
  var m = Math.floor(secs / 60)
  var s = secs % 60
  return m > 0 ? m + 'm' + (s > 0 ? ' ' + s + 's' : '') : s + 's'
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

export default function SessionCard({ session, onClick }) {
  var typeMeta = TYPE_META[session.type] || TYPE_META.gym
  var name     = sessionName(session)
  var diff     = session.difficulty
  var diffFill = diff ? DIFFICULTY_FILL[diff] : null
  var diffLabel = diff ? DIFFICULTY_LABEL[diff - 1] : null

  var detail = session.type === 'gym'       ? gymDetail(session.exercises)
             : session.type === 'climb'     ? climbDetail(session.climbs)
             : session.type === 'hangboard' ? hangDetail(session.hangGrips)
             : ''
  var completion = routineCompletion(session)

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
