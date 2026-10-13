import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import useSessions from '../../hooks/useSessions'
import { openClimbSession, openGymSession, finishPatch, sessionVenue, sessionDayLabel, sessionAccent, gymSessionName, gymProgressLine } from '../../lib/sessions'

// ---------------------------------------------------------------------------
// ContinueNotice — the open sessions, at the top of the Dashboard
// ---------------------------------------------------------------------------

/**
 * The app opens on the Dashboard, so the open climb session is offered here
 * too: one tap and Log opens already continuing it, grade chips ready
 * (BTL-B75; Ben, 2026-09-28: "reduce button presses as much as possible").
 * It stays until it is finished — no timer (BTL-B109). *Finish* ends it, or,
 * with no feel yet, opens it on Log asking for one. Not a widget: absent when
 * nothing is open.
 *
 * An open gym session gets its own row the same way (BTL-B154), opening its
 * sheet on Log › Train — a climb and a gym session can both be open.
 *
 * @param {{ sessions: import('../../lib/types').Session[] }} props
 */
export default function ContinueNotice({ sessions }) {
  var rows = [openClimbSession(sessions), openGymSession(sessions)].filter(Boolean)
  if (!rows.length) return null
  return (
    <div className="px-4 flex flex-col gap-2">
      {rows.map(function (s) { return <ContinueRow key={s.id} session={s} /> })}
    </div>
  )
}

function ContinueRow({ session }) {
  var navigate = useNavigate()
  var { updateSession } = useSessions()

  var today = new Date().toISOString().slice(0, 10)
  // A session left open from another day says which day in place of the
  // venue — both do not fit on a phone.
  var gym    = session.type === 'gym'
  var count  = (session.climbs || []).length
  var what   = gym
    ? gymSessionName(session) + ' · ' + gymProgressLine(session)
    : count + ' climb' + (count !== 1 ? 's' : '')
  var where  = session.date !== today ? sessionDayLabel(session.date, today) : gym ? '' : sessionVenue(session)
  var accent = sessionAccent(session)

  return (
    <div className="w-full flex items-center bg-white rounded-2xl border" style={{ borderColor: accent }}>
      <button
        onClick={function () { navigate('/log', { state: { continueSession: session.id } }) }}
        className="flex-1 min-w-0 flex items-center gap-2.5 pl-4 pr-2 py-2.5 text-left"
      >
        <Play size={14} className="shrink-0" style={{ color: accent, fill: accent }} />
        <span className="flex-1 min-w-0 truncate text-sm font-bold text-[#1a1d2e]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          Continue{where ? ' · ' + where : ''} · {what}
        </span>
        <span className="text-sm font-bold shrink-0" style={{ color: accent }}>›</span>
      </button>
      <button
        onClick={function () {
          if (!session.difficulty) navigate('/log', { state: { continueSession: session.id, askFeel: true } })
          else updateSession(session.id, finishPatch(session, new Date().toISOString()))
        }}
        className="shrink-0 px-3 py-2.5 border-l border-[#e5e7ef] text-xs font-bold text-[#7a8299] hover:text-[#1a1d2e]"
        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        Finish
      </button>
    </div>
  )
}
