import { useEffect, useMemo, useRef } from 'react'
import { MapPin, LoaderCircle } from 'lucide-react'
import useVenues from '../../hooks/useVenues'
import useGeolocation from '../../hooks/useGeolocation'
import {
  wallsNear, searchWalls, wallRef, suggestVenue, topVenues, matchVenues,
  venueKey, cleanName, formatDistance, NEARBY_METRES,
} from '../../lib/venues'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

/**
 * Where you climbed: a name, and the wall behind it when it is one.
 *
 * The input is free text — typing always works, and a name that is not a
 * wall is simply kept, as the athlete's own place. The pin asks for one fix;
 * once a fix has ever succeeded on this device, the field asks on open, so
 * the chips are there before it is reached.
 *
 * Chips: located, the walls within 300 m of the fix, nearest first with the
 * distance (exactly one → filled in); otherwise the athlete's most used
 * venues from their log — walls and places alike; while typing, the walls
 * table filtered by the text (name, city, other spellings) plus the athlete's
 * own places that match. The line under the chips says what the pin found.
 *
 * `value` is the text; `venue` the wall it names, or null; `onChange(name,
 * venue)` reports both. `exclude` leaves one place name out of the chips (the
 * tidy-up list's own row).
 *
 * @param {{
 *   value: string,
 *   venue: { id: string, name: string } | null,
 *   onChange: (name: string, venue: import('../../lib/venues').VenueRef | null) => void,
 *   accent: string,
 *   autoLocate?: boolean,
 *   exclude?: string,
 * }} props
 */
export default function VenuePicker({ value, venue, onChange, accent, autoLocate, exclude }) {
  var { venues, locatedBefore } = useVenues()
  var geo = useGeolocation()
  var locate = geo.locate
  var position = geo.position

  var autoLocated = useRef(false)
  useEffect(function () {
    if (!autoLocate || !locatedBefore || autoLocated.current) return
    autoLocated.current = true
    locate()
  }, [autoLocate, locatedBefore, locate])

  var near = useMemo(function () { return wallsNear(position) }, [position])

  // Prefill from the one wall in range, into an empty field only: a name
  // already typed, or carried over from the last session, is the athlete's.
  var suggested = useRef(null)
  useEffect(function () {
    var pick = suggestVenue(near)
    if (!pick || suggested.current === pick.id) return
    suggested.current = pick.id
    if (cleanName(value)) return
    onChange(pick.name, wallRef(pick))
  }, [near]) // eslint-disable-line react-hooks/exhaustive-deps -- runs when the nearby list changes, not on every keystroke

  var offered = useMemo(function () {
    var ex = venueKey(exclude || '')
    if (!ex) return venues
    return venues.filter(function (v) { return v.id || venueKey(v.name) !== ex })
  }, [venues, exclude])

  var typing = !!cleanName(value) && !(venue && venueKey(venue.name) === venueKey(value))

  var chips = useMemo(function () {
    if (typing) {
      var walls = searchWalls(value)
      var ids = {}
      walls.forEach(function (w) { ids[w.id] = true })
      return walls.map(function (w) { return { id: w.id, name: w.name, city: w.city } })
        .concat(matchVenues(offered, value).filter(function (v) { return !v.id || !ids[v.id] }))
    }
    if (near.length) return near
    return topVenues(offered)
  }, [typing, value, offered, near])

  var located  = geo.status === 'ready'
  var locating = geo.status === 'locating'
  var current  = venueKey(value)

  function choose(v) {
    onChange(v.name, v.id ? { id: v.id, name: v.name, lat: v.lat, lng: v.lng } : null)
  }

  var range = NEARBY_METRES + ' m'
  var note = null
  if (geo.status === 'denied')           note = 'Location is off for BetaLog — type where you climbed, or tap one of yours.'
  else if (geo.status === 'unavailable') note = geo.supported ? 'No fix right now — type where you climbed, or tap one of yours.' : null
  else if (located && near.length === 0 && !typing) {
    note = 'Located — no wall within ' + range + '. Type where you climbed; it is kept for next time.'
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={function (e) { onChange(e.target.value, null) }}
          placeholder="Where did you climb? (optional)"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#c0622a] transition-colors"
        />
        {geo.supported && (
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            aria-label="Suggest walls near me"
            title="Suggest walls near me"
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
            var active = venueKey(v.name) === current && (!venue || !v.id || venue.id === v.id)
            return (
              <button
                key={v.id || 'text:' + venueKey(v.name)}
                type="button"
                onClick={function () { choose(v) }}
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
