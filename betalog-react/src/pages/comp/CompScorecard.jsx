import { useEffect, useMemo } from 'react'
import { Navigate, useParams, Link } from 'react-router-dom'
import { Minus, Plus, AlertTriangle } from 'lucide-react'
import useCompetitions, { useComp, useMySession } from '../../hooks/useCompetitions'
import { scoreCard, scoreProblem, formatScore, normaliseResult } from '../../lib/competition'
import { barlow } from '../../lib/utils'
import { Card, Eyebrow, StatusPill, CompTabs } from './CompLayout'
import { ColourDot } from './CompDetails'

/**
 * /comp/:code/card — the entrant's scorecard (spec §7).
 *
 * Every tap goes through `act`: the session in the log first, the comp's
 * mirror after. The rows read from the session, so the card is exactly what
 * History will show tonight. Controls only while the comp is live; before
 * that the card says when it will open, after the close it is the record.
 */
export default function CompScorecard({ user }) {
  var { code } = useParams()
  var uid = user ? user.uid : null
  var { comp, isOrganiser, loading, notFound, error } = useComp(code, uid)
  var comps = useCompetitions(uid)
  var session = useMySession(code)

  // The comp as now seen (a problem added, the close and its reveal) and the
  // organiser's voids both flow into the session while the card is open.
  useEffect(function () {
    if (comp && session) comps.syncFromComp(code, comp)
  }, [comp]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(function () {
    if (!session || !uid) return undefined
    return comps.watchVoids(code, uid)
  }, [code, uid, !!session]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(function () {
    if (!session) return undefined
    return comps.resyncOnReconnect(code, uid)
  }, [code, uid, !!session]) // eslint-disable-line react-hooks/exhaustive-deps

  var block = session ? session.comp : null
  var totals = useMemo(function () {
    return block ? scoreCard(block.scoring, block.problems, block.card) : null
  }, [block])

  if (loading && !session) return <p className="text-sm text-[#7a8299] text-center py-10" style={barlow}>Loading…</p>
  if (!session) {
    if (notFound || error) return <Navigate to={'/comp/' + code} replace />
    return <Navigate to={'/comp/' + code} replace />
  }

  var status = comp ? comp.status : block.status
  var live = status === 'live'
  var problems = (block.problems || []).slice().sort(function (a, b) { return a.number - b.number })
  var max = block.scoring.maxAttempts

  function act(problemId, type, value) {
    comps.act(code, uid, { type: type, problemId: problemId, value: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-[#1a1d2e] leading-tight" style={{ ...barlow, fontSize: '24px' }}>{block.name}</p>
          <p className="text-xs text-[#7a8299]">Your scorecard · {block.category}</p>
        </div>
        <StatusPill status={status} />
      </div>

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow>Score</Eyebrow>
            <p className="font-black text-[#1a1d2e] leading-none" style={{ ...barlow, fontSize: '40px' }}>{formatScore(totals.score)}</p>
          </div>
          <p className="text-xs text-[#7a8299] text-right" style={barlow}>
            <b className="text-[#1a1d2e]">{totals.tops}</b> tops · <b className="text-[#1a1d2e]">{totals.zones}</b> zones · <b className="text-[#1a1d2e]">{totals.attempts}</b> goes
          </p>
        </div>
        <p className="text-[10px] text-[#bbbcc8] mt-2">
          {status === 'open' && 'Scoring opens when the organiser starts the comp. Your card is ready.'}
          {live && 'Tap + for each go. Zone and Top mark the go you are on. Max ' + max + (max === 1 ? ' go' : ' goes') + ' per problem.'}
          {status === 'closed' && 'Final. This card is a session in your History; graded tops are sends in your log.'}
        </p>
      </Card>

      <Card className="!p-0 overflow-hidden">
        {problems.map(function (p, i) {
          var r = normaliseResult(block.card[p.id], block.scoring)
          var voided = (block.voids || []).filter(function (v) { return v.problemId === p.id })
          var lastVoid = voided[voided.length - 1]
          var sc = scoreProblem(block.scoring, p, r)
          var atMax = r.attempts >= max && !r.top
          return (
            <div key={p.id} className={'px-3 py-2.5 ' + (i > 0 ? 'border-t border-[#f0f1f6]' : '')}>
              <div className="flex items-center gap-2">
                <span className="w-7 text-base font-black text-[#1a1d2e] tabular-nums" style={barlow}>{p.number}</span>
                <ColourDot colour={p.colour} />
                <span className="flex-1 min-w-0 text-xs text-[#7a8299] truncate">
                  {p.label || ''}{p.grade ? (p.label ? ' · ' : '') + p.grade : ''}
                </span>
                <span className="text-[11px] text-[#7a8299] tabular-nums" style={barlow}>{formatScore(p.points)} pts</span>
                <span className="w-12 text-right text-sm font-black tabular-nums" style={Object.assign({}, barlow, { color: sc > 0 ? '#2a9d5c' : '#bbbcc8' })}>
                  {sc > 0 ? '+' + formatScore(sc) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center rounded-lg border border-[#e5e7ef] overflow-hidden bg-white">
                  <button disabled={!live || r.attempts <= 0} onClick={function () { act(p.id, 'dec') }} aria-label="One go fewer" className="w-9 py-2 bg-[#f8f9fc] text-[#7a8299] disabled:opacity-40 border-r border-[#e5e7ef]"><Minus size={14} className="mx-auto" /></button>
                  <span className="w-14 text-center text-sm font-black tabular-nums" style={barlow}>{r.attempts} {r.attempts === 1 ? 'go' : 'goes'}</span>
                  <button disabled={!live || r.attempts >= max} onClick={function () { act(p.id, 'inc') }} aria-label="One more go" className="w-9 py-2 bg-[#f8f9fc] text-[#7a8299] disabled:opacity-40 border-l border-[#e5e7ef]"><Plus size={14} className="mx-auto" /></button>
                </div>
                <ToggleButton on={r.zone} label={r.zone && r.zoneAttempt ? 'Zone · go ' + r.zoneAttempt : 'Zone'} colour="#4f7ef8" disabled={!live} onClick={function () { act(p.id, 'zone', !r.zone) }} />
                <ToggleButton on={r.top} label={r.top && r.topAttempt ? (r.topAttempt === 1 ? 'Flash' : 'Top · go ' + r.topAttempt) : 'Top'} colour="#2a9d5c" disabled={!live} onClick={function () { act(p.id, 'top', !r.top) }} />
              </div>
              {atMax && live && <p className="text-[10px] text-[#7a8299] mt-1.5" style={barlow}>Max goes</p>}
              {lastVoid && (
                <p className="flex items-center gap-1 text-[10px] text-[#c2410c] mt-1.5"><AlertTriangle size={11} /> Voided by the organiser{lastVoid.note ? ': ' + lastVoid.note : ''}</p>
              )}
            </div>
          )
        })}
      </Card>

      <Link to={'/comp/' + code} className="text-center text-xs font-bold text-[#4f7ef8] py-1" style={barlow}>Comp details →</Link>
      <CompTabs code={code} isOrganiser={isOrganiser} entered />
    </div>
  )
}

function ToggleButton({ on, label, colour, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className="flex-1 py-2 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50"
      style={Object.assign({}, barlow, on
        ? { background: colour, borderColor: colour, color: '#fff' }
        : { background: '#fff', borderColor: '#e5e7ef', color: '#1a1d2e' })}
    >
      {label}
    </button>
  )
}
