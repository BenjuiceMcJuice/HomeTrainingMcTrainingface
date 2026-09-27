import { Link, NavLink, Outlet } from 'react-router-dom'
import { ArrowLeft, Info, Check } from 'lucide-react'
import { barlow } from '../../lib/utils'
import useNow from '../../hooks/useNow'
import { STATUS_LABEL, STATUS_COLOUR, COMP_GUIDE_URL, STAGES, compPhase } from '../../lib/compUi'

/**
 * The shell for everything under /comp — spec §9.
 *
 * Same app, same sign-in, same data; a header of its own. The main app's
 * bottom tabs are hidden on these routes (App.jsx), so a phone at the wall
 * sees the comp and nothing else, and a QR code on a poster lands here.
 */
export default function CompLayout() {
  return (
    <div className="min-h-screen bg-[#f8f9fc] text-[#1a1d2e]">
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}
      >
        <Link to="/" className="flex items-center gap-1 text-[#7a8299] text-xs font-bold uppercase tracking-wide" style={barlow}>
          <ArrowLeft size={14} /> BetaLog
        </Link>
        <Link to="/comp" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '22px', letterSpacing: '-0.5px', color: '#1a1a2e' }}>
          Beta<span style={{ color: '#4f7ef8' }}>Comp</span>
        </Link>
        <span className="w-16" />
      </header>
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * The comp's own tabs, pinned to the bottom like the main app's. Only the
 * tabs that exist are shown: Details for everyone, Scorecard once entered,
 * Manage for organisers; Board arrives with step 4.
 * @param {{ code: string, isOrganiser: boolean, entered?: boolean }} props
 */
export function CompTabs({ code, isOrganiser, entered }) {
  var tabs = [{ to: '/comp/' + code, label: 'Details', end: true }]
  if (entered) tabs.push({ to: '/comp/' + code + '/card', label: 'Scorecard', end: false })
  if (isOrganiser) tabs.push({ to: '/comp/' + code + '/manage', label: 'Manage', end: false })
  if (tabs.length < 2) return null
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)', transform: 'translateZ(0)',
      }}
    >
      <div className="flex flex-1 max-w-2xl mx-auto">
        {tabs.map(function (t) {
          return (
            <NavLink key={t.to} to={t.to} end={t.end} className="flex-1 flex items-center justify-center py-3">
              {function (props) {
                return (
                  <span
                    className="px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide"
                    style={Object.assign({}, barlow, props.isActive ? { background: '#4f7ef8', color: '#fff' } : { color: '#7a8299' })}
                  >
                    {t.label}
                  </span>
                )
              }}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * The five stages as a stepper — done ones ticked, the current one filled in
 * its colour, later ones grey (spec §7d). `phase` from `compPhase`.
 */
export function CompStepper({ phase }) {
  var at = STAGES.indexOf(phase)
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Competition stages">
      {STAGES.map(function (s, i) {
        var done = i < at, current = i === at
        var colour = current ? STATUS_COLOUR[s] : done ? '#1a1d2e' : '#d5d8e3'
        return (
          <li key={s} className="flex flex-col items-center gap-1 min-w-0 relative" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span className="absolute top-[11px] right-1/2 w-full h-0.5 -z-0" style={{ background: i <= at ? '#1a1d2e' : '#e5e7ef', marginRight: '12px' }} />}
            <span
              className="relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
              style={{ background: current || done ? colour : '#fff', border: '2px solid ' + colour, color: '#fff', ...barlow }}
            >
              {done ? <Check size={12} strokeWidth={3} /> : current ? i + 1 : <span style={{ color: '#bbbcc8' }}>{i + 1}</span>}
            </span>
            <span className="text-[9px] leading-tight text-center font-bold uppercase tracking-wide" style={{ ...barlow, color: current ? STATUS_COLOUR[s] : done ? '#1a1d2e' : '#bbbcc8' }}>
              {STATUS_LABEL[s]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The stepper with a line of what happens next for an entrant — Details and
 * the scorecard (spec §7d). No buttons: the stage is the organiser's to move.
 */
export function EntrantStages({ comp, phase }) {
  if (!comp || phase === 'draft') return null
  var end = comp.endAt ? (comp.endDate && comp.endDate !== comp.date ? comp.endDate + ' ' + comp.endAt : comp.endAt) : null
  var line = {
    open: comp.startAt ? 'Scoring opens by itself at ' + comp.startAt + '.' : 'Scoring opens when the organiser starts it.',
    live: end && comp.autoClose !== false ? 'Scoring is open — it ends at ' + end + '.' : 'Scoring is open until the organiser ends it.',
    judging: 'Scoring has ended. Results are final once the judges have checked the cards.',
    closed: 'Final — the results stand, and your climbs are in your log.',
  }[phase]
  return (
    <div className="px-4 py-3 rounded-2xl bg-white border border-[#e5e7ef]">
      <CompStepper phase={phase} />
      {line && <p className="text-xs text-[#7a8299] mt-3 text-center">{line}</p>}
    </div>
  )
}

/** A quick link to the guide's *How a comp runs*, from the pages that need it. */
export function HowCompsWork({ className }) {
  return (
    <a
      href={COMP_GUIDE_URL} target="_blank" rel="noopener"
      className={'inline-flex items-center gap-1 text-[11px] font-bold text-[#4f7ef8] ' + (className || '')}
      style={barlow}
    >
      <Info size={12} /> How comps work
    </a>
  )
}

export function StatusPill({ status, comp }) {
  var nowMs = useNow(30000)
  if (comp) status = compPhase(comp, nowMs)
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white"
      style={Object.assign({}, barlow, { background: STATUS_COLOUR[status] || '#7a8299' })}
    >
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export function Card({ children, className }) {
  return <div className={'bg-white rounded-2xl border border-[#e5e7ef] p-4 ' + (className || '')}>{children}</div>
}

export function Eyebrow({ children }) {
  return <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-2" style={barlow}>{children}</p>
}
