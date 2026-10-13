import { climbSummaryLine, sessionVenue, sessionDayLabel, sessionAccent, gymSessionName, gymProgressLine } from '../../lib/sessions'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

// ---------------------------------------------------------------------------
// ContinueSessionCard — the open session, one tap from the Log page
// ---------------------------------------------------------------------------

/**
 * Shown on Log › Climb while the form is empty and a climb session is open —
 * saved as you go and not yet finished, whatever day it is from (BTL-B75,
 * B109). *Continue session* reopens it in the logging form; *Finish* ends it
 * (`endedAt`), or, with no feel yet, opens it asking for one. Tapping a climb
 * in the form below starts a new session and the card steps aside.
 *
 * The same card sits on Log › Train for an open gym session (BTL-B154):
 * the routine's name in place of the venue, how far it has got in place of
 * the climbs.
 *
 * @param {{
 *   session: import('../../lib/types').Session,
 *   today: string,
 *   onContinue: () => void,
 *   onFinish: () => void,
 * }} props
 */
export default function ContinueSessionCard({ session, today, onContinue, onFinish }) {
  var gym    = session.type === 'gym'
  var where  = gym ? gymSessionName(session) : sessionVenue(session)
  var accent = sessionAccent(session)

  return (
    <div className="mx-4 mb-4 bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3">
      <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>
        {sessionDayLabel(session.date, today)}{where ? ' · ' + where : ''}
      </p>
      <p className="text-sm text-[#1a1d2e] mt-0.5">{gym ? gymProgressLine(session) : climbSummaryLine(session.climbs)}</p>
      {!session.difficulty && <p className="text-[11px] text-[#7a8299] mt-0.5">Feel not set</p>}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={onContinue}
          className="flex-1 py-2.5 rounded-xl text-white font-bold"
          style={Object.assign({ background: accent, fontSize: '15px' }, barlow)}
        >
          Continue session
        </button>
        <button
          onClick={onFinish}
          className="px-4 py-2.5 rounded-xl border-2 border-[#e5e7ef] bg-[#f8f9fc] text-sm font-bold text-[#7a8299] hover:text-[#1a1d2e] transition-colors"
          style={barlow}
        >
          Finish
        </button>
      </div>
    </div>
  )
}
