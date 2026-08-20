import { gradeColor } from '../../lib/stats'
import { barlow } from '../../lib/utils'

/**
 * Grade distribution bars — one row per grade, attempts/sends/flashes stacked.
 *
 * Lifted out of `ClimbingStats` when the declutter folded it into `LevelCard`'s
 * collapsible body (phase 3). `ClimbingStats` duplicated what `LevelCard`
 * already showed, so it was deleted rather than left importing this.
 */
export function GradeChart({ gradeMap, gradeOrder, accentColor, gradeSystem }) {
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

export function Legend({ accentColor }) {
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
