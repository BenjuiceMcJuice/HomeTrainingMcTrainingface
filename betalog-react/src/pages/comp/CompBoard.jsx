import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { X, AlertTriangle, EyeOff } from 'lucide-react'
import useCompetitions, { useComp, useMySession, useCompEntries } from '../../hooks/useCompetitions'
import {
  rankEntries, boardViews, canSeeBoard, formatScore, scoreProblem, normaliseResult, resultLabel,
  fmtAgo, compPhase,
} from '../../lib/competition'
import useNow from '../../hooks/useNow'
import { barlow } from '../../lib/utils'
import { Card, Eyebrow, StatusPill, CompTabs, HowCompsWork } from './CompLayout'
import { ColourDot } from './CompDetails'

/**
 * /comp/:code/board — the leaderboard (spec §8, §11 step 4).
 *
 * One board per category, plus Overall when there is more than one. Scores
 * are computed here from the cards, never stored. Entrants' boards redraw at
 * most every 30 s (spec §10 — reads on the free plan); organisers see every
 * change as it lands, and tap a row to open that card and void a problem.
 */
var ENTRANT_REFRESH_MS = 30000

export default function CompBoard({ user }) {
  var { code } = useParams()
  var uid = user ? user.uid : null
  var { comp, isOrganiser, loading, notFound, error } = useComp(code, uid)
  var session = useMySession(code)
  var entered = !!session
  var allowed = canSeeBoard(comp, isOrganiser, entered)
  var { entries: liveEntries, loading: entriesLoading } = useCompEntries(code, allowed)
  var comps = useCompetitions(uid)
  var nowMs = useNow(5000)
  var [view, setView] = useState('')
  var [openUid, setOpenUid] = useState(null)

  // The entrant's board holds a snapshot and takes a new one every 30 s; the
  // organiser's follows every change.
  var [shown, setShown] = useState({ entries: [], at: null })
  var latest = useRef(liveEntries)
  latest.current = liveEntries
  useEffect(function () {
    if (!allowed || !isOrganiser || entriesLoading) return
    setShown({ entries: liveEntries, at: Date.now() })
  }, [allowed, entriesLoading, isOrganiser, liveEntries])
  useEffect(function () {
    if (!allowed || isOrganiser || entriesLoading) return undefined
    setShown({ entries: latest.current, at: Date.now() })
    var id = setInterval(function () { setShown({ entries: latest.current, at: Date.now() }) }, ENTRANT_REFRESH_MS)
    return function () { clearInterval(id) }
  }, [allowed, isOrganiser, entriesLoading])

  var rows = useMemo(function () {
    return comp ? rankEntries(comp, shown.entries, view || undefined) : []
  }, [comp, shown.entries, view])

  if (loading) return <p className="text-sm text-[#7a8299] text-center py-10" style={barlow}>Loading…</p>
  if (notFound || error) return <Navigate to={'/comp/' + code} replace />
  if (!comp) return null

  var phase = compPhase(comp, nowMs)
  var views = boardViews(comp)
  var mine = rows.filter(function (r) { return r.uid === uid })[0] || null
  var caption = comp.status === 'closed'
    ? 'Final · closed at ' + (comp.closedAt ? new Date(comp.closedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
    : 'Scores as entered by climbers' + (shown.at ? ' · updated ' + fmtAgo(nowMs - shown.at) : '')
  var openEntry = openUid ? shown.entries.filter(function (e) { return e.uid === openUid })[0] || liveEntries.filter(function (e) { return e.uid === openUid })[0] : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-[#1a1d2e] leading-tight" style={{ ...barlow, fontSize: '24px' }}>{comp.name}</p>
          <p className="text-xs text-[#7a8299]">Leaderboard</p>
          <HowCompsWork className="mt-1" />
        </div>
        <StatusPill comp={comp} />
      </div>

      {!allowed ? (
        <Card>
          <p className="flex items-center gap-2 text-sm text-[#1a1d2e]"><EyeOff size={15} className="text-[#7a8299]" />
            {entered ? 'The organiser has hidden the board until the comp is final.' : 'Enter the comp to see the board.'}
          </p>
        </Card>
      ) : (
        <>
          {isOrganiser && phase === 'judging' && (
            <p className="text-xs text-[#c2410c] px-1">Judging: tap a climber to check their card and void anything wrong, then close from Manage.</p>
          )}
          {isOrganiser && phase !== 'judging' && comp.status !== 'closed' && (
            <p className="text-xs text-[#7a8299] px-1">Tap a climber to see their card and void a problem.</p>
          )}
          {isOrganiser && comp.boardVisibleToEntrants === false && comp.status !== 'closed' && (
            <p className="flex items-center gap-1.5 text-[11px] text-[#7a8299] px-1"><EyeOff size={12} /> Hidden from entrants until the close — you see it as organiser.</p>
          )}

          {views.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
              {views.map(function (v) {
                var on = v.key === view
                return (
                  <button
                    key={v.key || 'overall'} onClick={function () { setView(v.key) }}
                    className="px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap"
                    style={Object.assign({}, barlow, on ? { background: '#4f7ef8', borderColor: '#4f7ef8', color: '#fff' } : { background: '#fff', borderColor: '#e5e7ef', color: '#1a1d2e' })}
                  >
                    {v.label}
                  </button>
                )
              })}
            </div>
          )}

          {mine && (
            <Card className="!py-3">
              <Eyebrow>You</Eyebrow>
              <Row row={mine} own showCategory={!view && views.length > 1} />
            </Card>
          )}

          <Card className="!p-0 overflow-hidden">
            {entriesLoading && !shown.at ? (
              <p className="text-sm text-[#7a8299] text-center py-8" style={barlow}>Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-xs text-[#bbbcc8] text-center py-8">No one on this board yet.</p>
            ) : rows.map(function (r, i) {
              return (
                <div key={r.uid} className={i > 0 ? 'border-t border-[#f0f1f6]' : ''}>
                  {isOrganiser ? (
                    <button onClick={function () { setOpenUid(r.uid) }} className="w-full text-left px-3 py-2.5 hover:bg-[#f8f9fc]">
                      <Row row={r} own={r.uid === uid} showCategory={!view && views.length > 1} />
                    </button>
                  ) : (
                    <div className="px-3 py-2.5"><Row row={r} own={r.uid === uid} showCategory={!view && views.length > 1} /></div>
                  )}
                </div>
              )
            })}
          </Card>
          <p className="text-[10px] text-[#bbbcc8] text-center -mt-2">{caption}. Ties go to more tops, then more zones, then fewer goes.</p>
        </>
      )}

      {openEntry && (
        <CardSheet
          comp={comp} entry={openEntry}
          onClose={function () { setOpenUid(null) }}
          onVoid={function (problemId, note) { return comps.voidProblem(code, openEntry.uid, problemId, note) }}
        />
      )}

      <CompTabs code={code} isOrganiser={isOrganiser} entered={entered} board={allowed} />
    </div>
  )
}

function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')) }

function Row({ row, own, showCategory }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 text-center text-base font-black tabular-nums" style={{ ...barlow, color: row.rank <= 3 ? '#4f7ef8' : '#1a1d2e' }}>{row.rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1a1d2e] truncate" style={barlow}>
          {row.displayName}{own ? <span className="text-[#4f7ef8]"> · you</span> : null}
        </p>
        <p className="text-[11px] text-[#7a8299] truncate" style={barlow}>
          {showCategory && row.category ? row.category + ' · ' : ''}{plural(row.tops, 'top')} · {plural(row.zones, 'zone')} · {plural(row.attempts, 'go', 'goes')}
        </p>
      </div>
      <span className="text-lg font-black tabular-nums text-[#1a1d2e]" style={barlow}>{formatScore(row.score)}</span>
    </div>
  )
}

/**
 * The organiser's view of one entrant's card: every problem with its result
 * and points, and *Void* on anything with goes. A void resets that problem
 * to no goes and keeps what it was, with a note the entrant sees (spec §8).
 */
function CardSheet({ comp, entry, onClose, onVoid }) {
  var [voiding, setVoiding] = useState(null)
  var [note, setNote] = useState('')
  var [busy, setBusy] = useState(false)
  var [error, setError] = useState(null)
  var problems = (comp.problems || []).slice().sort(function (a, b) { return a.number - b.number })
  var voids = entry.voids || []

  function confirmVoid() {
    setBusy(true); setError(null)
    onVoid(voiding, note.trim()).then(function () {
      setVoiding(null); setNote(''); setBusy(false)
    }).catch(function (err) { setError(err.message || 'Could not void'); setBusy(false) })
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto px-4 pt-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-black text-[#1a1d2e] truncate" style={{ ...barlow, fontSize: '20px' }}>{entry.displayName}</p>
            <p className="text-xs text-[#7a8299]">{entry.category}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-xl text-[#7a8299]" style={{ background: 'rgba(0,0,0,0.05)' }}><X size={18} /></button>
        </div>

        <div className="flex flex-col">
          {problems.map(function (p, i) {
            var r = normaliseResult((entry.card || {})[p.id], comp.scoring)
            var sc = scoreProblem(comp.scoring, p, r)
            var label = resultLabel(r, comp.scoring)
            var theseVoids = voids.filter(function (v) { return v.problemId === p.id })
            var lastVoid = theseVoids[theseVoids.length - 1]
            return (
              <div key={p.id} className={'py-2 ' + (i > 0 ? 'border-t border-[#f0f1f6]' : '')}>
                <div className="flex items-center gap-2">
                  <span className="w-7 text-base font-black text-[#1a1d2e] tabular-nums" style={barlow}>{p.number}</span>
                  <ColourDot colour={p.colour} />
                  <span className="flex-1 min-w-0 text-xs text-[#1a1d2e] truncate" style={barlow}>{label || <span className="text-[#bbbcc8]">—</span>}</span>
                  <span className="w-10 text-right text-sm font-black tabular-nums" style={Object.assign({}, barlow, { color: sc > 0 ? '#2a9d5c' : '#bbbcc8' })}>{sc > 0 ? '+' + formatScore(sc) : ''}</span>
                  {r.attempts > 0 && voiding !== p.id && (
                    <button onClick={function () { setVoiding(p.id); setNote(''); setError(null) }} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#c2410c] bg-[#fff7ed] border border-[#fed7aa]" style={barlow}>
                      Void
                    </button>
                  )}
                </div>
                {lastVoid && (
                  <p className="flex items-center gap-1 text-[10px] text-[#c2410c] mt-1 ml-9"><AlertTriangle size={11} /> Voided{lastVoid.note ? ': ' + lastVoid.note : ''} (was {resultLabel(lastVoid.before, comp.scoring) || 'no goes'})</p>
                )}
                {voiding === p.id && (
                  <div className="mt-2 ml-9 flex flex-col gap-2">
                    <input
                      autoFocus value={note} onChange={function (e) { setNote(e.target.value) }}
                      placeholder="Why — the climber sees this" maxLength={140}
                      className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] outline-none focus:border-[#c2410c]"
                    />
                    {error && <p className="text-xs text-[#ef4444]">{error}</p>}
                    <div className="flex gap-2">
                      <button onClick={function () { setVoiding(null) }} className="flex-1 py-2 rounded-xl text-xs font-bold text-[#7a8299] bg-white border border-[#e5e7ef]" style={barlow}>Cancel</button>
                      <button disabled={busy || !note.trim()} onClick={confirmVoid} className="flex-1 py-2 rounded-xl text-xs font-bold text-white" style={{ ...barlow, background: busy || !note.trim() ? '#7a8299' : '#c2410c' }}>
                        {busy ? 'Voiding…' : 'Void problem ' + p.number}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-[#bbbcc8] mt-3">A void puts the problem back to no goes. What it was is kept, and the climber sees your note on their card.</p>
      </div>
    </div>
  )
}
