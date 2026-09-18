import { MapPin, LoaderCircle } from 'lucide-react'
import { formatDistance, venueKey } from '../../lib/venues'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

/**
 * The location field of the climb logger, with the saved venues near the
 * phone offered as chips.
 *
 * The free-text input is unchanged — typing always works, and is how a venue
 * gets into the list in the first place. The pin beside it asks for one
 * position fix; the chips under it are the saved venues within 300 m,
 * nearest first, and tapping one fills the field. The row says why it is
 * empty when it is (nothing saved near here yet, permission refused, no fix),
 * in one short line, and never blocks the form.
 *
 * @param {{
 *   value: string,
 *   onChange: (name: string) => void,
 *   nearby: Array<import('../../lib/venues').Venue & { distance: number }>,
 *   status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable',
 *   supported: boolean,
 *   onLocate: () => void,
 *   accent: string,
 * }} props
 */
export default function VenuePicker({ value, onChange, nearby, status, supported, onLocate, accent }) {
  var locating = status === 'locating'
  var located  = status === 'ready'
  var current  = venueKey(value)

  var note = null
  if (status === 'denied')                  note = 'Location is off for BetaLog — type the venue instead.'
  else if (status === 'unavailable')        note = supported ? 'No fix right now — type the venue instead.' : null
  else if (located && nearby.length === 0)  note = 'Nothing saved near here yet — type it once and it will be a tap next time.'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={function (e) { onChange(e.target.value) }}
          placeholder="Where did you climb? (optional)"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#c0622a] transition-colors"
        />
        {supported && (
          <button
            type="button"
            onClick={onLocate}
            disabled={locating}
            aria-label="Suggest venues near me"
            title="Suggest venues near me"
            className="shrink-0 w-10 rounded-xl border flex items-center justify-center transition-colors"
            style={
              located
                ? { background: accent, borderColor: accent, color: '#fff' }
                : { background: '#f8f9fc', borderColor: '#e5e7ef', color: locating ? '#bbbcc8' : '#7a8299' }
            }
          >
            {locating
              ? <LoaderCircle size={16} className="animate-spin" />
              : <MapPin size={16} />}
          </button>
        )}
      </div>

      {nearby.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {nearby.map(function (v) {
            var active = venueKey(v.name) === current
            return (
              <button
                key={v.name}
                type="button"
                onClick={function () { onChange(v.name) }}
                className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors border flex items-baseline gap-1.5"
                style={
                  active
                    ? Object.assign({ background: accent, borderColor: accent, color: '#fff' }, barlow)
                    : Object.assign({ background: '#fff', borderColor: '#e5e7ef', color: '#1a1d2e' }, barlow)
                }
              >
                <span>{v.name}</span>
                <span className="text-[10px] font-semibold" style={{ color: active ? 'rgba(255,255,255,0.8)' : '#bbbcc8' }}>
                  {formatDistance(v.distance)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {note && <p className="text-[11px] text-[#bbbcc8] px-1">{note}</p>}
    </div>
  )
}
