import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapPin, CalendarDays, Clock, EyeOff, X } from 'lucide-react'
import useCompetitions, { useComp, useMySession } from '../../hooks/useCompetitions'
import useProfile from '../../hooks/useProfile'
import { scoringSentence, formatScore } from '../../lib/competition'
import { barlow } from '../../lib/utils'
import { Card, Eyebrow, StatusPill, CompTabs } from './CompLayout'
import { fmtCompDate } from '../../lib/compUi'

/**
 * /comp/:code — the comp card and the problem list, for anyone with the
 * code. Entering and the scorecard arrive with step 3.
 */
export default function CompDetails({ user }) {
  var { code } = useParams()
  var navigate = useNavigate()
  var uid = user ? user.uid : null
  var { comp, isOrganiser, loading, error, notFound } = useComp(code, uid)
  var comps = useCompetitions(uid)
  var remember = comps.remember
  var session = useMySession(code)
  var [entering, setEntering] = useState(false)

  // An organiser opening their comp from a link on a new device gets it on
  // their list; entrants are added on entering (step 3).
  useEffect(function () {
    if (comp && isOrganiser) remember(comp, 'organiser')
  }, [comp && comp.code, comp && comp.name, comp && comp.date, isOrganiser]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-sm text-[#7a8299] text-center py-10" style={barlow}>Loading…</p>
  if (notFound) return <Missing code={code} />
  if (error) return <Card><p className="text-sm text-[#ef4444]">{error}</p></Card>
  if (!comp) return null

  var canEnter = !session && (comp.status === 'open' || comp.status === 'live')

  return (
    <div className="flex flex-col gap-4">
      <CompCard comp={comp} />
      {session && (
        <Link to={'/comp/' + code + '/card'} className="block w-full text-center py-3.5 rounded-xl text-white font-bold text-sm" style={{ background: '#2a9d5c', ...barlow }}>
          {comp.status === 'closed' ? 'See your card' : "You're entered — open your scorecard"}
        </Link>
      )}
      {canEnter && (
        <button onClick={function () { setEntering(true) }} className="w-full py-3.5 rounded-xl text-white font-bold text-sm" style={{ background: '#4f7ef8', ...barlow }}>
          Enter this competition
        </button>
      )}
      {!session && comp.status === 'draft' && <p className="text-xs text-[#7a8299] text-center">Entries are not open yet.</p>}
      {!session && comp.status === 'closed' && <p className="text-xs text-[#7a8299] text-center">This competition has finished.</p>}
      <ProblemList comp={comp} />
      {isOrganiser && (
        <Link to={'/comp/' + code + '/manage'} className="text-center text-sm font-bold text-[#4f7ef8] py-2" style={barlow}>
          Manage this competition →
        </Link>
      )}
      <CompTabs code={code} isOrganiser={isOrganiser} entered={!!session} />
      {entering && (
        <EntrySheet
          comp={comp}
          user={user}
          onClose={function () { setEntering(false) }}
          onEnter={function (details) {
            return comps.enter(comp, details).then(function () {
              setEntering(false)
              navigate('/comp/' + code + '/card')
            })
          }}
        />
      )}
    </div>
  )
}

/**
 * Name and category, then Enter (spec §2, §5). The name is prefilled from
 * the profile and required — a board of eight "Climber"s is not a board.
 */
function EntrySheet({ comp, user, onClose, onEnter }) {
  var { profile } = useProfile()
  var [name, setName] = useState((profile && profile.name) || (user && user.displayName) || '')
  var [category, setCategory] = useState((comp.categories || [])[0] || 'Open')
  var [busy, setBusy] = useState(false)
  var [error, setError] = useState(null)
  var ok = name.trim().length > 0 && !!category

  function submit(e) {
    if (e) e.preventDefault()
    if (!ok) return
    setBusy(true); setError(null)
    onEnter({ displayName: name.trim(), category: category }).catch(function (err) {
      setError(err.message || 'Could not enter'); setBusy(false)
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-t-2xl px-4 pt-4 pb-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '20px' }}>Enter {comp.name}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-xl text-[#7a8299]" style={{ background: 'rgba(0,0,0,0.05)' }}><X size={18} /></button>
        </div>
        <label className="flex flex-col gap-1 mb-3">
          <span className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide" style={barlow}>Name on the board</span>
          <input value={name} onChange={function (e) { setName(e.target.value) }} autoFocus className="w-full px-3 py-2.5 rounded-xl border border-[#e5e7ef] bg-white text-sm outline-none focus:border-[#4f7ef8]" placeholder="Your name" />
        </label>
        <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5" style={barlow}>Category</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(comp.categories || []).map(function (c) {
            var on = c === category
            return (
              <button type="button" key={c} onClick={function () { setCategory(c) }} className="px-3 py-1.5 rounded-full text-xs font-bold border" style={Object.assign({}, barlow, on ? { background: '#4f7ef8', borderColor: '#4f7ef8', color: '#fff' } : { background: '#fff', borderColor: '#e5e7ef', color: '#1a1d2e' })}>{c}</button>
            )
          })}
        </div>
        <p className="text-[10px] text-[#bbbcc8] mb-3">Categories are labels, not rules — pick the one you are entering. The organiser sees your name, category and card; other entrants see your name and score.</p>
        {error && <p className="text-xs text-[#ef4444] mb-2">{error}</p>}
        <button type="submit" disabled={!ok || busy} className="w-full py-3 rounded-xl text-white font-bold text-sm" style={{ background: !ok || busy ? '#7a8299' : '#4f7ef8', ...barlow }}>
          {busy ? 'Entering…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}

function Missing({ code }) {
  return (
    <Card>
      <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>No competition with the code {code}</p>
      <p className="text-xs text-[#7a8299] mt-1">Check the poster — codes look like CP-K7M2Q — or ask the organiser. A deleted comp gives this too.</p>
      <Link to="/comp" className="inline-block mt-3 text-sm font-bold text-[#4f7ef8]" style={barlow}>← Competitions</Link>
    </Card>
  )
}

export function CompCard({ comp }) {
  var organiserNames = Object.keys(comp.organiserNames || {}).map(function (k) { return comp.organiserNames[k] }).filter(Boolean)
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="font-black text-[#1a1d2e] leading-tight" style={{ ...barlow, fontSize: '24px' }}>{comp.name}</p>
        <StatusPill status={comp.status} />
      </div>
      <div className="flex flex-col gap-1 mt-3 text-sm text-[#1a1d2e]">
        <p className="flex items-center gap-2"><CalendarDays size={14} className="text-[#7a8299]" />{fmtCompDate(comp.date)}</p>
        {(comp.startAt || comp.endAt) && (
          <p className="flex items-center gap-2"><Clock size={14} className="text-[#7a8299]" />{[comp.startAt, comp.endAt].filter(Boolean).join(' – ')}</p>
        )}
        {comp.venue && comp.venue.name && (
          <p className="flex items-center gap-2"><MapPin size={14} className="text-[#7a8299]" />{comp.venue.name}</p>
        )}
      </div>
      {comp.notes && <p className="text-xs text-[#7a8299] mt-3 whitespace-pre-wrap">{comp.notes}</p>}
      <div className="mt-4 pt-3 border-t border-[#f0f1f6]">
        <Eyebrow>Scoring</Eyebrow>
        <p className="text-xs text-[#1a1d2e]">{scoringSentence(comp.scoring)}</p>
      </div>
      {comp.categories && comp.categories.length > 0 && (
        <div className="mt-3">
          <Eyebrow>Categories</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {comp.categories.map(function (c) {
              return <span key={c} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f4f5f9] text-[#1a1d2e]" style={barlow}>{c}</span>
            })}
          </div>
        </div>
      )}
      {organiserNames.length > 0 && (
        <p className="text-[10px] text-[#bbbcc8] mt-3">Organised by {organiserNames.join(', ')}</p>
      )}
    </Card>
  )
}

export function ColourDot({ colour }) {
  if (!colour) return <span className="w-3 h-3 rounded-full border border-dashed border-[#c9cfe3] inline-block" />
  return <span className="w-3 h-3 rounded-full inline-block border border-black/10" style={{ background: colour }} title={colour} />
}

function ProblemList({ comp }) {
  var problems = (comp.problems || []).slice().sort(function (a, b) { return a.number - b.number })
  var anyHidden = problems.some(function (p) { return p.showGrade === false && !p.grade })
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <Eyebrow>Scoresheet · {problems.length} problems</Eyebrow>
        {anyHidden && comp.status !== 'closed' && (
          <span className="flex items-center gap-1 text-[10px] text-[#7a8299]"><EyeOff size={11} /> some grades hidden until the close</span>
        )}
      </div>
      <div className="grid gap-y-1" style={{ gridTemplateColumns: 'auto auto 1fr auto auto' }}>
        {problems.map(function (p) {
          return [
            <span key={p.id + 'n'} className="text-sm font-black text-[#1a1d2e] pr-3 tabular-nums" style={barlow}>{p.number}</span>,
            <span key={p.id + 'c'} className="pr-3 flex items-center"><ColourDot colour={p.colour} /></span>,
            <span key={p.id + 'l'} className="text-xs text-[#7a8299] truncate pr-3">{p.label || (p.colour ? capitalise(p.colour) : '')}</span>,
            <span key={p.id + 'g'} className="text-xs text-[#1a1d2e] pr-3 text-right">
              {p.grade ? p.grade : (p.showGrade === false ? <EyeOff size={11} className="inline text-[#bbbcc8]" /> : '')}
            </span>,
            <span key={p.id + 'p'} className="text-xs font-bold text-[#1a1d2e] text-right tabular-nums" style={barlow}>{formatScore(p.points)} pts</span>,
          ]
        })}
      </div>
    </Card>
  )
}

function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
