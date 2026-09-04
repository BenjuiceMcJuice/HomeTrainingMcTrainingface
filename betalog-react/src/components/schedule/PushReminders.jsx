import { useState } from 'react'
import { Bell, BellOff, Smartphone } from 'lucide-react'
import { barlow } from '../../lib/utils'
import { detectEnv, shouldOfferPush } from '../../lib/push'
import usePush from '../../hooks/usePush'
import useSchedule from '../../hooks/useSchedule'
import { entryTimes } from '../../lib/reminders'

/**
 * Push reminder setup — the switch, and the three support states.
 *
 * Sits beside CalendarReminders in Plan > Schedule: two ways to be reminded of
 * the same schedule, both next to the schedule they deliver.
 *
 * The failure mode throughout is silence, not breakage. A browser that cannot
 * do push renders nothing at all here rather than a switch that does nothing.
 */
export default function PushReminders() {
  const { enabled, support, configured, busy, error, enable, disable } = usePush()
  const { entries } = useSchedule()
  const [confirm, setConfirm] = useState(false)

  // Counts routines with at least one reminder time, not reminders: an entry can
  // carry several, and the copy below is about how many routines are covered.
  const timed = entries.filter(e => entryTimes(e).length).length

  // Nothing to offer and nothing to explain — say nothing. A dead switch is
  // worse than an absent one. Same rule the section header above uses.
  if (!shouldOfferPush(detectEnv(), configured)) return null

  return (
    <div className="bg-white rounded-2xl mx-4 border border-[#e5e7ef] p-4">

      {support === 'needs-install' && (
        <div className="flex gap-2">
          <Smartphone size={13} className="text-[#7a8299] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-[#4a5168] mb-0.5" style={barlow}>
              Reminders in the app
            </p>
            <p className="text-[10px] text-[#7a8299] leading-relaxed">
              Add BetaLog to your Home Screen and notifications become available — iPhone only
              allows them for installed apps. Share → Add to Home Screen, then open it from there.
            </p>
          </div>
        </div>
      )}

      {support === 'supported' && !enabled && (
        <>
          <p className="text-[10px] text-[#7a8299] mb-2 leading-relaxed">
            Get a BetaLog notification at each reminder time — tapping it opens the session ready
            to log. Unlike the calendar route these arrive on time and need no setup on the phone.
            Off until you turn it on.
          </p>
          <button
            onClick={enable}
            disabled={busy}
            className="w-full py-2 rounded-lg text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{ background: '#4f7ef8', ...barlow }}
          >
            <Bell size={13} />
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
          <p className="text-[9px] text-[#bbbcc8] mt-1.5 leading-relaxed">
            Your device will ask once. If you decline, it can only be undone in your device
            settings — BetaLog cannot ask again.
          </p>
        </>
      )}

      {support === 'supported' && enabled && (
        <>
          <p className="text-[10px] text-[#7a8299] mb-2 leading-relaxed">
            {timed === 0
              ? 'On for this device. No routine has a reminder time yet — set one above and the notification will follow.'
              : 'On for this device. ' + timed + (timed === 1 ? ' routine has' : ' routines have') +
                ' a reminder time. Turn it on separately on each device you want notified.'}
          </p>
          <button
            onClick={() => { if (!confirm) { setConfirm(true); return } setConfirm(false); disable() }}
            disabled={busy}
            className="w-full py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={confirm
              ? { background: '#fff5f5', borderColor: '#fecaca', color: '#e11d48', ...barlow }
              : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }}
          >
            <BellOff size={13} />
            {busy ? 'Working…' : confirm ? 'Tap again to turn off' : 'Turn off on this device'}
          </button>
        </>
      )}

      {error && <p className="text-[9px] text-[#e11d48] mt-1.5 leading-relaxed" style={barlow}>{error}</p>}
    </div>
  )
}
