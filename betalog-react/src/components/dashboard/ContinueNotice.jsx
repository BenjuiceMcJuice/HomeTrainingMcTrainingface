import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play } from 'lucide-react'
import useSessions from '../../hooks/useSessions'
import { todaysClimbSession, sessionVenue, climbAccent, CONTINUE_DASHBOARD_MS } from '../../lib/sessions'

// ---------------------------------------------------------------------------
// ContinueNotice — today's climb session, at the top of the Dashboard
// ---------------------------------------------------------------------------

/**
 * The app opens on the Dashboard, so today's climb session is offered here
 * too: one tap and Log opens already continuing it, grade chips ready
 * (BTL-B75, spec §3.4; Ben, 2026-09-28: "reduce button presses as much as
 * possible"). Only while the session was changed in the last three hours —
 * a morning session is not still at the top in the evening — and *Finish*
 * ends it outright (`endedAt`, BTL-B76). Not a widget: absent when there is
 * nothing to continue.
 *
 * @param {{ sessions: import('../../lib/types').Session[] }} props
 */
export default function ContinueNotice({ sessions }) {
  var navigate = useNavigate()
  var { updateSession } = useSessions()
  // Read once per visit to the Dashboard; the window is hours, not seconds.
  var [nowMs] = useState(function () { return Date.now() })
  var today = new Date(nowMs).toISOString().slice(0, 10)
  var session = todaysClimbSession(sessions, today, { nowMs: nowMs, withinMs: CONTINUE_DASHBOARD_MS })
  if (!session) return null

  var venue  = sessionVenue(session)
  var count  = (session.climbs || []).length
  var accent = climbAccent(session)

  return (
    <div className="px-4">
      <div className="w-full flex items-center bg-white rounded-2xl border" style={{ borderColor: accent }}>
        <button
          onClick={function () { navigate('/log', { state: { continueSession: session.id } }) }}
          className="flex-1 min-w-0 flex items-center gap-2.5 pl-4 pr-2 py-2.5 text-left"
        >
          <Play size={14} className="shrink-0" style={{ color: accent, fill: accent }} />
          <span className="flex-1 min-w-0 truncate text-sm font-bold text-[#1a1d2e]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Continue{venue ? ' · ' + venue : ''} · {count} climb{count !== 1 ? 's' : ''}
          </span>
          <span className="text-sm font-bold shrink-0" style={{ color: accent }}>›</span>
        </button>
        <button
          onClick={function () { updateSession(session.id, { endedAt: new Date().toISOString() }) }}
          className="shrink-0 px-3 py-2.5 border-l border-[#e5e7ef] text-xs font-bold text-[#7a8299] hover:text-[#1a1d2e]"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Finish
        </button>
      </div>
    </div>
  )
}
