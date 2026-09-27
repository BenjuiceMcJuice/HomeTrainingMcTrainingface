import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin, CalendarDays, Clock, EyeOff } from 'lucide-react'
import useCompetitions, { useComp } from '../../hooks/useCompetitions'
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
  var uid = user ? user.uid : null
  var { comp, isOrganiser, loading, error, notFound } = useComp(code, uid)
  var { remember } = useCompetitions()

  // An organiser opening their comp from a link on a new device gets it on
  // their list; entrants are added on entering (step 3).
  useEffect(function () {
    if (comp && isOrganiser) remember(comp, 'organiser')
  }, [comp && comp.code, comp && comp.name, comp && comp.date, isOrganiser]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-sm text-[#7a8299] text-center py-10" style={barlow}>Loading…</p>
  if (notFound) return <Missing code={code} />
  if (error) return <Card><p className="text-sm text-[#ef4444]">{error}</p></Card>
  if (!comp) return null

  return (
    <div className="flex flex-col gap-4">
      <CompCard comp={comp} />
      <ProblemList comp={comp} />
      {isOrganiser && (
        <Link to={'/comp/' + code + '/manage'} className="text-center text-sm font-bold text-[#4f7ef8] py-2" style={barlow}>
          Manage this competition →
        </Link>
      )}
      <CompTabs code={code} isOrganiser={isOrganiser} />
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
