import { useMemo } from 'react'
import useSessions from '../../hooks/useSessions'

// ---------------------------------------------------------------------------
// Grade ordinals
// ---------------------------------------------------------------------------

var V_GRADES      = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']
var FRENCH_GRADES = ['4','5','5+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b']

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

// ---------------------------------------------------------------------------
// Grade → Level mapping
// ---------------------------------------------------------------------------

var V_LEVEL = {
  V0: 'Beginner', V1: 'Beginner',
  V2: 'Intermediate', V3: 'Intermediate',
  V4: 'Advanced', V5: 'Advanced',
  V6: 'Expert', V7: 'Expert',
  V8: 'Elite', V9: 'Elite',
  V10: 'Pro', V11: 'Pro',
  V12: 'World Class', V13: 'World Class', V14: 'World Class', V15: 'World Class', V16: 'World Class', V17: 'World Class',
}

var FRENCH_LEVEL = {
  '4': 'Beginner', '5': 'Beginner', '5+': 'Beginner',
  '6a': 'Intermediate', '6a+': 'Intermediate', '6b': 'Intermediate', '6b+': 'Intermediate',
  '6c': 'Advanced', '6c+': 'Advanced', '7a': 'Advanced', '7a+': 'Advanced',
  '7b': 'Expert', '7b+': 'Expert', '7c': 'Expert', '7c+': 'Expert',
  '8a': 'Elite', '8a+': 'Elite',
  '8b': 'World Class',
}

export var LEVEL_COLOR = {
  'Beginner':     { color: '#7a8299', bg: '#f4f5f9' },
  'Intermediate': { color: '#2a9d5c', bg: '#edfaf2' },
  'Advanced':     { color: '#4f7ef8', bg: '#eef1ff' },
  'Expert':       { color: '#8b5cf6', bg: '#f5eeff' },
  'Elite':        { color: '#d4742a', bg: '#fff4ec' },
  'Pro':          { color: '#ef4444', bg: '#fef2f2' },
  'World Class':  { color: '#d97706', bg: '#fffbeb' },
}

function gradeLevel(grade, system) {
  return (system === 'v' ? V_LEVEL : FRENCH_LEVEL)[grade] || null
}

function calcConsistentGrade(gradeMap, gradeOrder, system) {
  var best = null
  gradeOrder.forEach(function (g) {
    var d = gradeMap[g]
    if (!d || d.attempts < 3) return
    if (d.sends / d.attempts >= 0.4) {
      best = { grade: g, level: gradeLevel(g, system), system: system, idx: gradeOrder.indexOf(g) }
    }
  })
  return best
}

/**
 * Build stats for a single discipline group.
 * @param {object[]} sessions
 * @param {string[]} disciplines - e.g. ['boulder'] or ['lead','toprope']
 * @param {string[]} gradeOrder
 * @param {string} system - 'v' or 'french'
 */
export function calcDisciplineStats(sessions, disciplines, gradeOrder, system) {
  var gradeMap = {}
  var total = 0, sends = 0, flashes = 0
  var highestSend = null, highestFlash = null

  sessions.forEach(function (s) {
    if (s.type !== 'climb') return
    ;(s.climbs || []).forEach(function (c) {
      if (disciplines.indexOf(c.discipline) === -1) return
      total++
      var g = c.grade
      if (!gradeMap[g]) gradeMap[g] = { attempts: 0, sends: 0, flashes: 0 }
      gradeMap[g].attempts++

      if (c.outcome === 'flashed') {
        gradeMap[g].sends++; gradeMap[g].flashes++; sends++; flashes++
      } else if (c.outcome === 'sent') {
        gradeMap[g].sends++; sends++
      }

      if (c.outcome === 'sent' || c.outcome === 'flashed') {
        var idx = gradeOrder.indexOf(g)
        if (highestSend === null || idx > highestSend.idx) highestSend = { grade: g, idx: idx }
        if (c.outcome === 'flashed') {
          if (highestFlash === null || idx > highestFlash.idx) highestFlash = { grade: g, idx: idx }
        }
      }
    })
  })

  var consistent = calcConsistentGrade(gradeMap, gradeOrder, system)

  return {
    gradeMap: gradeMap,
    total: total,
    sends: sends,
    flashes: flashes,
    sendRate: total > 0 ? Math.round(sends / total * 100) : 0,
    flashRate: total > 0 ? Math.round(flashes / total * 100) : 0,
    highestSend: highestSend,
    highestFlash: highestFlash,
    consistent: consistent,
    hasData: Object.keys(gradeMap).length > 0,
  }
}

// ---------------------------------------------------------------------------
// GradeChart — horizontal stacked bars
// ---------------------------------------------------------------------------

function GradeChart({ gradeMap, gradeOrder, accentColor }) {
  var grades = Object.keys(gradeMap).filter(function (g) { return gradeOrder.indexOf(g) >= 0 })
  if (!grades.length) return null

  grades.sort(function (a, b) { return gradeOrder.indexOf(a) - gradeOrder.indexOf(b) })
  var maxAttempts = Math.max.apply(null, grades.map(function (g) { return gradeMap[g].attempts })) || 1

  return (
    <div className="flex flex-col gap-1 mb-2">
      {grades.map(function (g) {
        var d = gradeMap[g]
        var attemptW = Math.round(d.attempts / maxAttempts * 100)
        var sendsOnly = d.sends - d.flashes
        var sendW    = Math.round(sendsOnly / maxAttempts * 100)
        var flashW   = Math.round(d.flashes / maxAttempts * 100)

        return (
          <div key={g} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[12px] font-black" style={{ ...barlow, color: accentColor }}>{g}</span>
            <div className="flex-1 relative h-2.5 bg-[#f4f5f9] rounded overflow-hidden">
              <div className="absolute inset-0 rounded" style={{ width: attemptW + '%', background: 'rgba(0,0,0,0.06)' }} />
              {sendW > 0 && <div className="absolute inset-0 rounded" style={{ width: sendW + '%', background: accentColor, opacity: 0.4 }} />}
              {flashW > 0 && <div className="absolute inset-0 rounded" style={{ width: flashW + '%', background: accentColor }} />}
            </div>
            <span className="w-8 shrink-0 text-[10px] font-semibold text-[#7a8299] text-right">{d.sends}/{d.attempts}</span>
          </div>
        )
      })}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <div className="w-2.5 h-1.5 rounded-sm" style={{ background: 'rgba(0,0,0,0.07)' }} />
        <span className="text-[8px] text-[#bbbcc8]">Attempts</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2.5 h-1.5 rounded-sm" style={{ background: '#c0622a', opacity: 0.4 }} />
        <span className="text-[8px] text-[#bbbcc8]">Sends</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2.5 h-1.5 rounded-sm" style={{ background: '#c0622a' }} />
        <span className="text-[8px] text-[#bbbcc8]">Flashes</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat chips
// ---------------------------------------------------------------------------

function MiniStat({ label, value, color }) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <p className="font-black text-[#1a1d2e] leading-none" style={{ ...barlow, fontSize: '16px' }}>{value}</p>
      <p className="text-[8px] font-bold uppercase tracking-wide mt-0.5" style={{ ...barlow, color: color || '#7a8299' }}>{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single discipline card
// ---------------------------------------------------------------------------

function DisciplineCard({ title, stats, gradeOrder, accentColor }) {
  if (!stats.hasData) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-4 text-center">
        <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest mb-1" style={barlow}>{title}</p>
        <p className="text-xs text-[#bbbcc8]">No {title.toLowerCase()} logged yet</p>
      </div>
    )
  }

  var lc = stats.consistent ? (LEVEL_COLOR[stats.consistent.level] || LEVEL_COLOR.Beginner) : null

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 pt-3 pb-3">
      {/* Header + level badge */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>{title}</p>
        {stats.consistent && lc ? (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ ...barlow, background: lc.bg, color: lc.color }}>
            {stats.consistent.level}
          </span>
        ) : (
          <span className="text-[9px] text-[#bbbcc8]" style={barlow}>Log more to get a level</span>
        )}
      </div>

      {/* Project / Consistent / Flash row */}
      <div className="flex gap-1 mb-2.5 py-1.5 px-1 rounded-lg bg-[#f8f9fc]">
        {stats.highestSend && <MiniStat label="Project" value={stats.highestSend.grade} color={accentColor} />}
        {stats.consistent && <MiniStat label="Consistent" value={stats.consistent.grade} color={lc ? lc.color : '#7a8299'} />}
        {stats.highestFlash && <MiniStat label="Flash" value={stats.highestFlash.grade} color="#2a9d5c" />}
        <MiniStat label="Send %" value={stats.sendRate + '%'} color="#4f7ef8" />
        <MiniStat label="Total" value={stats.total} />
      </div>

      {/* Grade chart */}
      <GradeChart gradeMap={stats.gradeMap} gradeOrder={gradeOrder} accentColor={accentColor} />
      <Legend />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ClimbingStats — two cards (Boulder + Rope)
// ---------------------------------------------------------------------------

export default function ClimbingStats() {
  var { sessions } = useSessions()

  var boulder = useMemo(function () {
    return calcDisciplineStats(sessions, ['boulder'], V_GRADES, 'v')
  }, [sessions])

  var rope = useMemo(function () {
    return calcDisciplineStats(sessions, ['lead', 'toprope'], FRENCH_GRADES, 'french')
  }, [sessions])

  if (!boulder.hasData && !rope.hasData) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-5 text-center">
        <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest mb-2" style={barlow}>Climbing</p>
        <p className="text-xs text-[#7a8299]">No climbs logged yet</p>
      </div>
    )
  }

  return (
    <>
      {boulder.hasData && (
        <DisciplineCard title="Boulder" stats={boulder} gradeOrder={V_GRADES} accentColor="#c0622a" />
      )}
      {rope.hasData && (
        <DisciplineCard title="Rope" stats={rope} gradeOrder={FRENCH_GRADES} accentColor="#4f7ef8" />
      )}
    </>
  )
}
