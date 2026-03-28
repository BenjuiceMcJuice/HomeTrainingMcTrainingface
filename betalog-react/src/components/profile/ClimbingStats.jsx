import { useState, useMemo } from 'react'
import useSessions from '../../hooks/useSessions'
import { V_GRADES, FRENCH_GRADES, LEVEL_COLOR, calcDisciplineStats, gradeColor, filterSessionsByDays } from '../../lib/stats'

// Re-export for consumers that import from here
export { LEVEL_COLOR, calcDisciplineStats }

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

// ---------------------------------------------------------------------------
// GradeChart — horizontal stacked bars
// ---------------------------------------------------------------------------

function GradeChart({ gradeMap, gradeOrder, accentColor, gradeSystem }) {
  var grades = Object.keys(gradeMap).filter(function (g) { return gradeOrder.indexOf(g) >= 0 })
  if (!grades.length) return null

  grades.sort(function (a, b) { return gradeOrder.indexOf(a) - gradeOrder.indexOf(b) })
  var maxAttempts = Math.max.apply(null, grades.map(function (g) { return gradeMap[g].attempts })) || 1

  return (
    <div className="flex flex-col gap-1 mb-2">
      {grades.map(function (g) {
        var d = gradeMap[g]
        var attemptW = Math.round(d.attempts / maxAttempts * 100)
        var flashW   = Math.round(d.flashes / maxAttempts * 100)
        var sendsOnly = d.sends - d.flashes
        var sendW    = Math.round(sendsOnly / maxAttempts * 100)
        var gc = gradeSystem ? gradeColor(g, gradeSystem) : accentColor

        return (
          <div key={g} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[12px] font-black" style={{ ...barlow, color: gc }}>{g}</span>
            <div className="flex-1 relative h-2.5 bg-[#f4f5f9] rounded overflow-hidden">
              {/* Attempts — full width background */}
              <div className="absolute top-0 left-0 h-full rounded" style={{ width: attemptW + '%', background: 'rgba(0,0,0,0.06)' }} />
              {/* Flashes — solid accent, leftmost */}
              {flashW > 0 && <div className="absolute top-0 left-0 h-full rounded-l" style={{ width: flashW + '%', background: accentColor }} />}
              {/* Sends (non-flash) — 40% accent, starts after flashes */}
              {sendW > 0 && <div className="absolute top-0 h-full" style={{ left: flashW + '%', width: sendW + '%', background: accentColor, opacity: 0.4 }} />}
            </div>
            <span className="w-8 shrink-0 text-[10px] font-semibold text-[#7a8299] text-right">{d.sends}/{d.attempts}</span>
          </div>
        )
      })}
    </div>
  )
}

function Legend({ accentColor }) {
  var c = accentColor || '#c0622a'
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <div className="w-2.5 h-1.5 rounded-sm" style={{ background: 'rgba(0,0,0,0.07)' }} />
        <span className="text-[8px] text-[#bbbcc8]">Attempts</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2.5 h-1.5 rounded-sm" style={{ background: c, opacity: 0.4 }} />
        <span className="text-[8px] text-[#bbbcc8]">Sends</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2.5 h-1.5 rounded-sm" style={{ background: c }} />
        <span className="text-[8px] text-[#bbbcc8]">Flashes</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat chips
// ---------------------------------------------------------------------------

function MiniStat({ label, value, color, gradeSystem }) {
  // If gradeSystem is provided, colour the value by its level tier
  var valueColor = gradeSystem ? gradeColor(value, gradeSystem) : '#1a1d2e'
  return (
    <div className="flex-1 min-w-0 text-center">
      <p className="font-black leading-none" style={{ ...barlow, fontSize: '16px', color: valueColor }}>{value}</p>
      <p className="text-[8px] font-bold uppercase tracking-wide mt-0.5" style={{ ...barlow, color: color || '#7a8299' }}>{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single discipline card
// ---------------------------------------------------------------------------

function DisciplineCard({ title, stats, gradeOrder, accentColor, gradeSystem }) {
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
        {stats.highestSend && <MiniStat label="Project" value={stats.highestSend.grade} gradeSystem={gradeSystem} />}
        {stats.consistent && <MiniStat label="Consistent" value={stats.consistent.grade} gradeSystem={gradeSystem} />}
        {stats.highestFlash && <MiniStat label="Flash" value={stats.highestFlash.grade} gradeSystem={gradeSystem} />}
        <MiniStat label="Send %" value={stats.sendRate + '%'} color="#4f7ef8" />
        <MiniStat label="Total" value={stats.total} />
      </div>

      {/* Grade chart */}
      <GradeChart gradeMap={stats.gradeMap} gradeOrder={gradeOrder} accentColor={accentColor} gradeSystem={gradeSystem} />
      <Legend accentColor={accentColor} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ClimbingStats — two cards (Boulder + Rope)
// ---------------------------------------------------------------------------

export default function ClimbingStats() {
  var { sessions } = useSessions()
  var [view, setView] = useState('all') // 'all' | '90d'

  var recent90 = useMemo(function () {
    return filterSessionsByDays(sessions, 90)
  }, [sessions])

  var activeSessions = view === '90d' ? recent90 : sessions

  var boulder = useMemo(function () {
    return calcDisciplineStats(activeSessions, ['boulder'], V_GRADES, 'v')
  }, [activeSessions])

  var rope = useMemo(function () {
    return calcDisciplineStats(activeSessions, ['lead', 'toprope'], FRENCH_GRADES, 'french')
  }, [activeSessions])

  if (!boulder.hasData && !rope.hasData && view === 'all') {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-5 text-center">
        <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest mb-2" style={barlow}>Climbing</p>
        <p className="text-xs text-[#7a8299]">No climbs logged yet</p>
      </div>
    )
  }

  return (
    <>
      {/* Toggle: All Time / Last 90 Days */}
      <div className="flex items-center justify-center gap-1 mb-1">
        <button
          onClick={function () { setView('all') }}
          className="px-3 py-1 rounded-lg text-[10px] font-bold transition-colors"
          style={view === 'all'
            ? { background: '#1a1d2e', color: '#fff', ...barlow }
            : { background: '#f4f5f9', color: '#7a8299', ...barlow }
          }
        >
          All Time
        </button>
        <button
          onClick={function () { setView('90d') }}
          className="px-3 py-1 rounded-lg text-[10px] font-bold transition-colors"
          style={view === '90d'
            ? { background: '#1a1d2e', color: '#fff', ...barlow }
            : { background: '#f4f5f9', color: '#7a8299', ...barlow }
          }
        >
          Last 90 Days
        </button>
      </div>

      {boulder.hasData && (
        <DisciplineCard title="Boulder" stats={boulder} gradeOrder={V_GRADES} accentColor="#c0622a" gradeSystem="v" />
      )}
      {rope.hasData && (
        <DisciplineCard title="Rope" stats={rope} gradeOrder={FRENCH_GRADES} accentColor="#4f7ef8" gradeSystem="french" />
      )}

      {!boulder.hasData && !rope.hasData && view === '90d' && (
        <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-4 text-center">
          <p className="text-xs text-[#bbbcc8]">No climbs in the last 90 days</p>
        </div>
      )}
    </>
  )
}
