import { useState } from 'react'
import { CalendarPlus, Copy, Check } from 'lucide-react'
import { barlow } from '../../lib/utils'
import useCalendarFeed from '../../hooks/useCalendarFeed'
import useSchedule from '../../hooks/useSchedule'

/**
 * Calendar reminder setup — generate the feed, subscribe, copy the link, revoke.
 *
 * Lives beside the schedule it publishes (Plan > Schedule) rather than in the
 * Settings sheet, so the thing and its delivery mechanism are in one place.
 */
export default function CalendarReminders() {
  const { enabled, busy, error, url, webcal, enable, disable } = useCalendarFeed()
  const { entries } = useSchedule()
  const [copied,  setCopied]  = useState(false)
  const [confirm, setConfirm] = useState(false)

  const timed = entries.filter(e => e.remindAt).length

  const copy = () => {
    if (!url || !navigator.clipboard) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-2xl mx-4 border border-[#e5e7ef] p-4">

      {!enabled && (
        <>
          <p className="text-[10px] text-[#7a8299] mb-2 leading-relaxed">
            Subscribe your phone's calendar to your schedule. Alerts come from the Calendar app,
            so they work even if you haven't opened BetaLog in weeks. Off until you turn it on.
          </p>
          <button
            onClick={enable}
            disabled={busy}
            className="w-full py-2 rounded-lg text-xs font-semibold border border-[#e5e7ef] text-[#7a8299] hover:bg-[#f8f9fc] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={barlow}
          >
            <CalendarPlus size={13} />
            {busy ? 'Setting up…' : 'Set up calendar reminders'}
          </button>
        </>
      )}

      {enabled && (
        <>
          <p className="text-[10px] text-[#7a8299] mb-2 leading-relaxed">
            {timed === 0
              ? 'On. No routine has a reminder time yet — set one in Plan → Routines → Schedule and it will appear in your calendar.'
              : timed + (timed === 1 ? ' routine has' : ' routines have') + ' a reminder time. Subscribe on each device you want alerts on.'}
          </p>
          <a
            href={webcal}
            className="block w-full py-2 mb-1.5 rounded-lg text-xs font-bold text-white text-center transition-colors"
            style={{ background: '#4f7ef8', ...barlow }}
          >
            Subscribe on this device
          </a>
          <div className="mb-1.5 p-2 rounded-lg border" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <p className="text-[10px] font-bold mb-0.5" style={{ color: '#b45309', ...barlow }}>
              On iPhone, one setting has to be changed
            </p>
            <p className="text-[9px] leading-relaxed" style={{ color: '#b45309', ...barlow }}>
              iOS turns <strong>Remove Alerts</strong> on by default for subscribed calendars, which
              deletes every reminder as the feed arrives — the sessions still show up, they just never
              alert. After subscribing: Calendar app → tap <strong>Calendars</strong> → tap the ⓘ next to
              <strong> BetaLog Training</strong> → <strong>Subscription Details</strong> → turn{' '}
              <strong>Remove Alerts</strong> off.
            </p>
          </div>
          <button
            onClick={copy}
            className="w-full py-2 mb-1.5 rounded-lg text-xs font-semibold border border-[#e5e7ef] text-[#7a8299] hover:bg-[#f8f9fc] transition-colors flex items-center justify-center gap-1.5"
            style={barlow}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Link copied' : 'Copy feed link'}
          </button>
          <p className="text-[9px] text-[#bbbcc8] mb-1.5 leading-relaxed">
            Anyone with that link can see your routine names and times — treat it like a password.
            Revoking stops every subscribed device at once.
          </p>
          <button
            onClick={() => { if (!confirm) { setConfirm(true); return } setConfirm(false); disable() }}
            disabled={busy}
            className="w-full py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50"
            style={confirm
              ? { background: '#fff5f5', borderColor: '#fecaca', color: '#e11d48', ...barlow }
              : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }}
          >
            {busy ? 'Working…' : confirm ? 'Tap again to revoke' : 'Turn off and revoke link'}
          </button>
        </>
      )}

      {error && <p className="text-[9px] text-[#e11d48] mt-1" style={barlow}>{error}</p>}
    </div>
  )
}
