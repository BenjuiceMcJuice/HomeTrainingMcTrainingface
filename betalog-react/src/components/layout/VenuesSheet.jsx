import { useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import useVenues from '../../hooks/useVenues'
import VenuePicker from '../log/VenuePicker'
import { barlow } from '../../lib/utils'
import { venueKey, cleanName, nameProblem, relinkSessions, renameSessions, findWall, wallRef } from '../../lib/venues'
import { useData } from '../../App'

var ACCENT = '#4f7ef8'

var STATUS = {
  wall:  { dot: '#2a9d5c', text: 'Wall — suggested by the pin when you are there' },
  place: { dot: '#bbbcc8', text: 'Your place — tap to say which wall this is, or rename it' },
  none:  { dot: '#bbbcc8', text: 'Climb sessions with no location' },
}

function fmtDay(iso) {
  if (!iso) return ''
  var d = new Date(iso.slice(0, 10) + 'T00:00:00')
  if (isNaN(d)) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's') }

/**
 * Settings › Locations — every place in the log, and what it is: the tidy-up
 * list (betalog_venue_manager_spec.md, on the walls table of
 * betalog_walls_spec.md).
 *
 * One row per venue, the same list the logger's chips come from, most used
 * first: a *wall* from the table, or *your place* — text you typed. Tapping
 * a row opens its actions under it. A place's *This is …* (and *Rename*)
 * opens the logger's own picker, prefilled with the name, so the sessions
 * carrying that text can be linked to a wall, or given a new name. A wall's
 * *Move sessions to …* does the same for a mislink. The *No location* row's
 * *Set to …* gives the venue-less climb sessions one.
 *
 * Every action is one save; the button states the count, and comp sessions
 * are counted but never rewritten (the comp owns their venue).
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function VenuesSheet({ open, onClose }) {
  var { rows, relink, rename } = useVenues()
  var { data } = useData()
  var sessions = (data && data.sessions) || []

  var [openKey,   setOpenKey]   = useState(null)      // the expanded row
  var [mode,      setMode]      = useState(null)      // 'this' | 'move' | 'set' | null
  var [value,     setValue]     = useState('')
  var [picked,    setPicked]    = useState(null)
  var [done,      setDone]      = useState(null)      // one line after an action

  if (!open) return null

  function rowKey(r) { return r.status === 'none' ? 'none' : (r.id ? 'id:' + r.id : 'name:' + venueKey(r.name)) }

  function toggle(r) {
    var k = rowKey(r)
    setMode(null); setPicked(null); setDone(null)
    setOpenKey(openKey === k ? null : k)
  }

  function start(r, m) {
    setMode(m)
    setValue(m === 'set' ? '' : r.name)
    setPicked(null)
    setDone(null)
  }

  function close() { setOpenKey(null); setMode(null); setPicked(null); setDone(null); onClose() }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-6 max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-[#1a1d2e]" style={barlow}>Your locations</h2>
          <button onClick={close} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <p className="text-[11px] text-[#7a8299] mb-3">
          Everywhere in your log. Tap a place to say which wall it is, rename it, or move its sessions.
        </p>

        {rows.length === 0 && (
          <p className="text-xs text-[#bbbcc8] text-center py-6">Nothing yet — type where you climbed on a climb session.</p>
        )}

        <div className="flex flex-col gap-2">
          {rows.map(function (r) {
            var k = rowKey(r)
            var isOpen = openKey === k
            var st = STATUS[r.status]
            var name = r.status === 'none' ? 'No location' : r.name
            var meta = plural(r.uses, 'session') + (r.lastUsed ? ' · last ' + fmtDay(r.lastUsed) : '')
            return (
              <div key={k} className="rounded-xl border border-[#e5e7ef] bg-white">
                <button
                  type="button"
                  onClick={function () { toggle(r) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.dot }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-[#1a1d2e] truncate" style={barlow}>{name}</span>
                    <span className="block text-[11px] text-[#7a8299]">{meta}</span>
                    <span className="block text-[10px] text-[#bbbcc8]">{st.text}</span>
                  </span>
                  {isOpen ? <ChevronUp size={16} className="text-[#bbbcc8] shrink-0" /> : <ChevronDown size={16} className="text-[#bbbcc8] shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 border-t border-[#f0f1f6] pt-2 flex flex-col gap-2">
                    {done && <p className="text-[11px] text-[#2a9d5c]">{done}</p>}

                    {!mode && (
                      <div className="flex flex-wrap gap-2">
                        {r.status === 'place' && (
                          <>
                            <Action onClick={function () { start(r, 'this') }} primary>This is …</Action>
                            <Action onClick={function () { start(r, 'rename') }}>Rename</Action>
                          </>
                        )}
                        {r.status === 'wall' && (
                          <Action onClick={function () { start(r, 'move') }} primary>Move sessions to …</Action>
                        )}
                        {r.status === 'none' && (
                          <Action onClick={function () { start(r, 'set') }} primary>Set to …</Action>
                        )}
                      </div>
                    )}

                    {mode && (
                      <Panel
                        row={r}
                        mode={mode}
                        value={value}
                        picked={picked}
                        sessions={sessions}
                        onChange={function (name, ref) { setValue(name); setPicked(ref) }}
                        onCancel={function () { setMode(null); setPicked(null) }}
                        onApply={function (what) {
                          if (what.kind === 'link') { relink(r.from, what.to); setDone('Linked ' + plural(what.count, 'session') + ' to ' + what.to.name) }
                          else { rename(r.from.key, what.name); setDone('Renamed on ' + plural(what.count, 'session')) }
                          setMode(null); setPicked(null); setOpenKey(null)
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Action({ onClick, primary, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm font-bold border transition-colors"
      style={Object.assign({}, barlow, primary
        ? { background: ACCENT, borderColor: ACCENT, color: '#fff' }
        : { background: '#fff', borderColor: '#e5e7ef', color: '#1a1d2e' })}
    >
      {children}
    </button>
  )
}

/**
 * The picker panel under a row. What Apply does follows from what was
 * picked: a shared venue → link; a plain new name on a text-only row →
 * rename; otherwise nothing to apply.
 */
function Panel({ row, mode, value, picked, sessions, onChange, onCancel, onApply }) {
  var heading = mode === 'rename' ? 'Rename “' + row.name + '”'
    : mode === 'move' ? 'Move the sessions at ' + row.name + ' to…'
    : mode === 'set' ? 'Which venue were these sessions at?'
    : 'Which venue is “' + row.name + '”?'

  // A typed name that is a wall's (or one of its spellings) is a link, not
  // a rename — the table says so.
  var typedWall = !picked && cleanName(value) && row.status !== 'wall' ? findWall(value) : null
  var target = picked && picked.id ? picked : (typedWall ? wallRef(typedWall) : null)

  var apply = null
  if (target) {
    var n = relinkSessions(sessions, row.from, target).length
    apply = { kind: 'link', to: target, count: n, label: 'Link ' + plural(n, 'session') + ' to ' + target.name }
  } else if (row.status === 'place' && cleanName(value) && venueKey(value) !== venueKey(row.name) && !nameProblem(value)) {
    var m = renameSessions(sessions, row.from.key, value).length
    apply = { kind: 'rename', name: cleanName(value), count: m, label: 'Rename on ' + plural(m, 'session') }
  }
  var compNote = row.comps > 0
    ? ' (' + plural(row.comps, 'session') + ' from a competition ' + (row.comps === 1 ? 'stays' : 'stay') + ' as ' + (row.comps === 1 ? 'it is' : 'they are') + ')'
    : ''

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-[#1a1d2e]" style={barlow}>{heading}</p>
      <VenuePicker
        value={value}
        venue={picked}
        onChange={onChange}
        accent={ACCENT}
        autoLocate={false}
        exclude={row.status === 'place' ? row.name : ''}
      />
      {!apply && mode !== 'rename' && (
        <p className="text-[11px] text-[#bbbcc8]">Tap a wall to link these sessions to it{row.status === 'place' ? ', or type a new name to rename' : ''}.</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!apply || apply.count === 0}
          onClick={function () { if (apply) onApply(apply) }}
          className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm"
          style={Object.assign({}, barlow, { background: apply && apply.count > 0 ? ACCENT : '#bbbcc8' })}
        >
          {apply ? apply.label + compNote : 'Nothing to apply yet'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#7a8299] border border-[#e5e7ef]" style={barlow}>
          Cancel
        </button>
      </div>
    </div>
  )
}
