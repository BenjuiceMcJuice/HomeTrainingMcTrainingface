import { climbSummaryLine, sessionVenue, climbAccent } from '../../lib/sessions'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

// ---------------------------------------------------------------------------
// ContinueSessionCard — today's climb session, one tap from the Log page
// ---------------------------------------------------------------------------

/**
 * Shown on Log › Climb while the form is empty and a climb session exists for
 * today (BTL-B75, logging-as-you-go spec §3). *Continue session* reopens it in
 * the logging form; *New session* puts the card away for this visit.
 *
 * @param {{
 *   session: import('../../lib/types').Session,
 *   onContinue: () => void,
 *   onNew: () => void,
 * }} props
 */
export default function ContinueSessionCard({ session, onContinue, onNew }) {
  var venue  = sessionVenue(session)
  var accent = climbAccent(session)

  return (
    <div className="mx-4 mb-4 bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3">
      <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>
        Today{venue ? ' · ' + venue : ''}
      </p>
      <p className="text-sm text-[#1a1d2e] mt-0.5">{climbSummaryLine(session.climbs)}</p>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={onContinue}
          className="flex-1 py-2.5 rounded-xl text-white font-bold"
          style={Object.assign({ background: accent, fontSize: '15px' }, barlow)}
        >
          Continue session
        </button>
        <button
          onClick={onNew}
          className="px-2 py-2.5 text-sm font-bold text-[#7a8299] hover:text-[#1a1d2e] transition-colors"
          style={barlow}
        >
          New session →
        </button>
      </div>
    </div>
  )
}
