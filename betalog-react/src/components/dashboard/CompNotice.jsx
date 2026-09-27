import { useNavigate } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { useData } from '../../App'
import { dashComps, fmtCompDate } from '../../lib/compUi'
import { now } from '../../lib/storage'
import { barlow } from '../../lib/utils'

/**
 * Comps on the Dashboard, as a strip beside *Due today* rather than a widget:
 * shown only while a comp is scheduled or happening, nothing otherwise.
 * Replaced the comp widget 2026-09-27 (Ben) — a card that was empty most of
 * the year was clutter.
 */
export default function CompNotice() {
  var navigate = useNavigate()
  var { data } = useData()
  var today = now().slice(0, 10)
  var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  var comps = dashComps(data.compEntries, data.sessions, today, weekAgo)
  if (!comps.length) return null

  var hasCard = {}
  ;(data.sessions || []).forEach(function (s) { if (s.comp && s.comp.code) hasCard[s.comp.code] = true })
  var label = comps.length > 1 ? 'Comps:' : comps[0].date <= today ? 'Comp today:' : 'Comp:'

  return (
    <div className="px-4">
      <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-[#c7d2fe] px-4 py-2.5">
        <Trophy size={16} style={{ color: '#4f7ef8' }} className="shrink-0" />
        <span className="text-xs font-bold text-[#1a1d2e] shrink-0" style={barlow}>{label}</span>
        <div className="flex-1 flex flex-wrap gap-1.5">
          {comps.map(function (r) {
            var live = r.date <= today
            var to = hasCard[r.code] ? '/comp/' + r.code + '/card' : '/comp/' + r.code
            return (
              <button
                key={r.code}
                onClick={function () { navigate(to) }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
                style={{ background: live ? '#2a9d5c' : '#4f7ef8', ...barlow }}
              >
                {(r.name || r.code) + ' · ' + (live ? (hasCard[r.code] ? 'open scorecard' : r.role === 'organiser' ? 'manage' : 'details') : fmtCompDate(r.date))} ›
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
