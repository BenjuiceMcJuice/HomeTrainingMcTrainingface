import { MapPin, LoaderCircle } from 'lucide-react'
import { formatDistance, venueKey, NEARBY_METRES } from '../../lib/venues'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

/**
 * The location field of the climb logger, with the saved venues near the
 * phone offered as chips.
 *
 * The free-text input is unchanged — typing always works, and is how a venue
 * gets into the list in the first place. The pin beside it asks for one
 * position fix; the chips under it are the saved venues within 300 m,
 * nearest first, each with its distance, and tapping one fills the field.
 * When none is within range the most recent venues are the chips instead,
 * without a distance — a wall from before location existed, or a session
 * logged after getting home, is still a tap. The line under the chips says
 * what the pin found (nothing near here, permission refused, no fix) in one
 * short sentence, so a tap on it is never silent, and never blocks the form.
 *
 * @param {{
 *   value: string,
 *   onChange: (name: string) => void,
 *   nearby: Array<import('../../lib/venues').Venue & { distance: number }>,
 *   recent: import('../../lib/venues').Venue[],
 *   status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable',
 *   supported: boolean,
 *   onLocate: () => void,
 *   accent: string,
 * }} props
 */
export default function VenuePicker({ value, onChange, nearby, recent, status, supported, onLocate, accent }) {
  var locating = status === 'locating'
  var located  = status === 'ready'
  var current  = venueKey(value)
  var near     = Array.isArray(nearby) ? nearby : []
  var fallback = near.length === 0 && Array.isArray(recent) ? recent : []
  var chips    = near.length ? near : fallback
  var range    = NEARBY_METRES + ' m'

  var note = null
  if (status === 'denied')           note = 'Location is off for BetaLog — type the venue, or tap a recent one.'
  else if (status === 'unavailable') note = supported ? 'No fix right now — type the venue, or tap a recent one.' : null
  else if (located && near.length === 0) {
    note = fallback.length
      ? 'Located — none of your venues is within ' + range + '. Your recent ones are here instead.'
      : 'Located — nothing saved within ' + range + ' yet. Type it once and it will be a tap next time.'
  }

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

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(function (v) {
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
                {typeof v.distance === 'number' && (
                  <span className="text-[10px] font-semibold" style={{ color: active ? 'rgba(255,255,255,0.8)' : '#bbbcc8' }}>
                    {formatDistance(v.distance)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {note && <p className="text-[11px] text-[#bbbcc8] px-1">{note}</p>}
    </div>
  )
}
