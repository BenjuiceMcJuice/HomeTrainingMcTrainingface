import { useState, useEffect, useMemo, useRef } from 'react'
import { MapPin, LoaderCircle, Plus } from 'lucide-react'
import useVenues from '../../hooks/useVenues'
import useGeolocation from '../../hooks/useGeolocation'
import {
  nearbyVenues, suggestVenue, topVenues, matchVenues, isNewName, hasCoords,
  venueKey, cleanName, formatDistance, NEARBY_METRES,
} from '../../lib/venues'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

/** Two characters typed before the registry is asked for names. */
var SEARCH_MIN = 2
var SEARCH_DEBOUNCE_MS = 300

/**
 * The venue field: a name, and the registry venue behind it when there is one.
 *
 * The input is as it always was — typing works, and a typed name that is
 * never added stays text on the session, private. The pin asks for one fix.
 * The chips under the field come from three places, cheapest first: the
 * athlete's own venues (from the profile's cache and the session log — within
 * 300 m of the fix with a distance, else the most used), registry venues near
 * the fix the athlete has never used, and registry venues whose name starts
 * with what is being typed. Tapping a chip fills the field and links the
 * session to that venue. When the typed name matches no chip, one more chip
 * offers to add it to the shared registry — placed here if there is a fix.
 * A picked venue that was added without a position gets a *Place here* chip
 * when there is a fix. The line under the chips says what the pin found.
 *
 * `value` is the text; `venue` the registry venue it names, or null;
 * `onChange(name, venue)` reports both. `autoLocate` lets the field ask for
 * a fix on open, which it only does once a venue has been placed before.
 *
 * @param {{
 *   value: string,
 *   venue: { id: string, name: string } | null,
 *   onChange: (name: string, venue: import('../../lib/venues').VenueRef | null) => void,
 *   accent: string,
 *   autoLocate?: boolean,
 * }} props
 */
export default function VenuePicker({ value, venue, onChange, accent, autoLocate }) {
  var { venues, locatedBefore, pickVenue, addVenue, placeVenue, findNearby, search } = useVenues()
  var geo = useGeolocation()
  var locate = geo.locate
  var position = geo.position

  var [registryNear, setRegistryNear] = useState([])   // near the fix, not yet the athlete's
  var [results,      setResults]      = useState([])   // registry names matching the typed text
  var [busy,         setBusy]         = useState(false)
  var [problem,      setProblem]      = useState(null)

  // One fix on open, once a venue has been placed before — so the chips are
  // there before the field is reached, and no page asks for permission
  // before the pin was tapped.
  var autoLocated = useRef(false)
  useEffect(function () {
    if (!autoLocate || !locatedBefore || autoLocated.current) return
    autoLocated.current = true
    locate()
  }, [autoLocate, locatedBefore, locate])

  var ownNear = useMemo(function () { return nearbyVenues(venues, position) }, [venues, position])

  // Nothing of the athlete's is near the fix: ask the registry once per fix.
  var askedFor = useRef(null)
  useEffect(function () {
    if (!position || askedFor.current === position) return
    askedFor.current = position
    if (ownNear.length) { setRegistryNear([]); return }
    var ownIds = {}
    venues.forEach(function (v) { if (v.id) ownIds[v.id] = true })
    findNearby(position).then(function (list) {
      if (askedFor.current !== position) return
      setRegistryNear(list.filter(function (v) { return !ownIds[v.id] }))
    }).catch(function () { /* offline, or refused: the own list is enough */ })
  }, [position, ownNear.length, venues, findNearby])

  // A registry venue just picked is now the athlete's too: one chip, not two.
  var near = useMemo(function () {
    var ownIds = {}
    ownNear.forEach(function (v) { if (v.id) ownIds[v.id] = true })
    return ownNear.concat(registryNear.filter(function (v) { return !ownIds[v.id] }))
      .sort(function (a, b) { return a.distance - b.distance })
  }, [ownNear, registryNear])

  // Prefill from the one venue in range, into an empty field only: a name
  // already typed, or carried over from the last session, is the athlete's.
  var suggested = useRef(null)
  useEffect(function () {
    var pick = suggestVenue(near)
    if (!pick || suggested.current === pick.id) return
    suggested.current = pick.id
    if (cleanName(value)) return
    if (pick.id) pickVenue(pick)
    onChange(pick.name, pick.id ? pick : null)
  }, [near]) // eslint-disable-line react-hooks/exhaustive-deps -- runs when the nearby list changes, not on every keystroke

  // Typing a name nobody has picked yet: the registry's names, debounced.
  var typing = !!cleanName(value) && !(venue && venueKey(venue.name) === venueKey(value))
  var searchSeq = useRef(0)
  useEffect(function () {
    if (!typing || venueKey(value).length < SEARCH_MIN) { setResults([]); return }
    var seq = ++searchSeq.current
    var t = setTimeout(function () {
      search(value).then(function (list) {
        if (seq === searchSeq.current) setResults(list)
      }).catch(function () { /* offline: own venues only */ })
    }, SEARCH_DEBOUNCE_MS)
    return function () { clearTimeout(t) }
  }, [typing, value, search])

  var chips = useMemo(function () {
    if (typing) {
      var own = matchVenues(venues, value)
      var ownIds = {}
      own.forEach(function (v) { if (v.id) ownIds[v.id] = true })
      return own.concat(results.filter(function (r) { return !ownIds[r.id] }))
    }
    if (near.length) return near
    return topVenues(venues)
  }, [typing, venues, value, results, near])

  var located = geo.status === 'ready'
  var locating = geo.status === 'locating'
  var current = venueKey(value)
  var canAdd = typing && isNewName(value, chips) && !busy

  // The picked venue with what the athlete's list knows of it — the session
  // only carries the id and name.
  var picked = venue && venue.id ? (venues.filter(function (v) { return v.id === venue.id })[0] || venue) : null
  var canPlace = !!(picked && !hasCoords(picked) && position && !typing && !busy)

  function choose(v) {
    setProblem(null)
    if (v.id) pickVenue(v)
    onChange(v.name, v.id ? v : null)
  }

  function add() {
    setBusy(true); setProblem(null)
    addVenue(value, position).then(function (ref) {
      onChange(ref.name, ref)
    }).catch(function (err) {
      setProblem(err && err.message ? err.message : 'Could not add the venue — check the signal and try again')
    }).then(function () { setBusy(false) })
  }

  function place() {
    setBusy(true); setProblem(null)
    placeVenue(picked, position).then(function (ref) {
      onChange(ref.name, ref)
    }).catch(function () {
      setProblem('Could not place the venue — check the signal and try again')
    }).then(function () { setBusy(false) })
  }

  var range = NEARBY_METRES + ' m'
  var note = null
  if (problem)                           note = problem
  else if (geo.status === 'denied')      note = 'Location is off for BetaLog — type the venue, or tap one of yours.'
  else if (geo.status === 'unavailable') note = geo.supported ? 'No fix right now — type the venue, or tap one of yours.' : null
  else if (canAdd)                       note = position
    ? 'A shared venue is a public place every climber on BetaLog can pick — add a wall, not your house.'
    : 'Added without a position until someone places it from the wall.'
  else if (located && near.length === 0 && !typing) {
    note = chips.length
      ? 'Located — no venue within ' + range + ' yet. Your usual ones are here; type a new one to add it.'
      : 'Located — no venue within ' + range + ' yet. Type it once and add it, and it is a tap next time.'
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={function (e) { setProblem(null); onChange(e.target.value, null) }}
          placeholder="Where did you climb? (optional)"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#c0622a] transition-colors"
        />
        {geo.supported && (
          <button
            type="button"
            onClick={locate}
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

      {(chips.length > 0 || canAdd || canPlace) && (
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
          {canAdd && (
            <button
              type="button"
              onClick={add}
              className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors border border-dashed flex items-center gap-1"
              style={Object.assign({ background: '#fff', borderColor: accent, color: accent }, barlow)}
            >
              <Plus size={13} />
              <span>Add “{cleanName(value)}” as a shared venue{position ? ' here' : ''}</span>
            </button>
          )}
          {canPlace && (
            <button
              type="button"
              onClick={place}
              className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors border border-dashed flex items-center gap-1"
              style={Object.assign({ background: '#fff', borderColor: accent, color: accent }, barlow)}
            >
              <MapPin size={13} />
              <span>Place {picked.name} here</span>
            </button>
          )}
          {busy && <LoaderCircle size={16} className="animate-spin self-center" style={{ color: '#bbbcc8' }} />}
        </div>
      )}

      {note && <p className="text-[11px] px-1" style={{ color: problem ? '#e11d48' : '#bbbcc8' }}>{note}</p>}
    </div>
  )
}
