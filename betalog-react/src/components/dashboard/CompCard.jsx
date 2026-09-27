import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { useData } from '../../App'
import { compSessionId, summariseCard, formatScore } from '../../lib/competition'
import { fmtCompDate } from '../../lib/compUi'
import { now } from '../../lib/storage'
import WidgetShell from './WidgetShell'
import { barlow } from '../../lib/utils'

/**
 * The Dashboard's comp card (spec §9): the next comp, *open scorecard* on
 * the day, the final card for a week after. Renders nothing until the
 * account has entered or organised a comp — the picker still lists it, but
 * an empty card would be clutter for everyone else.
 */
export default function CompCard({ editMode }) {
  var { data } = useData()
  var refs = data.compEntries || []
  if (!refs.length) return null

  var today = now().slice(0, 10)
  var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  var byDate = refs.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0 })
  var upcoming = byDate.filter(function (r) { return r.date >= today })
  var recent = byDate.filter(function (r) { return r.date < today && r.date >= weekAgo })
  var pick = upcoming[0] || recent[recent.length - 1]
  if (!pick) return null

  var session = (data.sessions || []).filter(function (s) { return s.id === compSessionId(pick.code) })[0]
  var block = session ? session.comp : null
  var isToday = pick.date === today
  var closed = block && block.status === 'closed'
  var sum = block ? summariseCard(block) : null

  var headline = closed ? 'Final' : isToday ? 'Today' : fmtCompDate(pick.date)
  var line = closed && sum
    ? formatScore(sum.score) + ' pts · ' + sum.tops + ' tops · ' + sum.zones + ' zones'
    : pick.venueName || ''
  var to = block ? '/comp/' + pick.code + '/card' : '/comp/' + pick.code
  var cta = block ? (closed ? 'See your card' : isToday ? 'Open scorecard' : 'Your scorecard') : pick.role === 'organiser' ? 'Manage' : 'Comp details'

  return (
    <div className="mx-4 rounded-2xl border border-[#e5e7ef] bg-white px-4 py-3">
      <WidgetShell
        widgetKey="competition"
        editMode={editMode}
        header={
          <div className="flex items-center gap-2 min-w-0">
            <Trophy size={16} style={{ color: '#4f7ef8' }} className="shrink-0" />
            <span className="font-black text-[#1a1d2e] truncate" style={{ ...barlow, fontSize: '16px' }}>{pick.name || pick.code}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ ...barlow, background: isToday && !closed ? '#edfaf2' : '#eef1ff', color: isToday && !closed ? '#2a9d5c' : '#4f7ef8' }}>{headline}</span>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-3 mt-2">
          <p className="text-xs text-[#7a8299] truncate">{line}</p>
          {!editMode && (
            <Link to={to} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ ...barlow, background: '#4f7ef8' }}>{cta} →</Link>
          )}
        </div>
      </WidgetShell>
    </div>
  )
}
