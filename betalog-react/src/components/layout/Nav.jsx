import { NavLink, Link } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, History, CalendarDays, MessageCircle, Settings, Users, HelpCircle, Trophy } from 'lucide-react'

var ALL_LINKS = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard, accent: '#4f7ef8' },
  { to: '/log',     label: 'Log',       icon: PlusCircle,      accent: '#2a9d5c' },
  { to: '/history', label: 'History',   icon: History,         accent: '#d4742a' },
  { to: '/plan',    label: 'Plan',      icon: CalendarDays,    accent: '#8b5cf6' },
  { to: '/coach',   label: 'Coach',     icon: MessageCircle,   accent: '#c0622a' },
]

// The one call to action in the header, so the one thing in colour: a labelled chip,
// brand blue on the blue tint, on both header variants. Friends and Settings stay grey.
// Ben's pick from four rendered treatments, 2026-09-24 (help & feedback spec §3.1).
var HelpChip = function ({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Help"
      className="flex items-center gap-1.5 rounded-full transition-colors shrink-0"
      style={{
        background: '#eef1ff', color: '#4f7ef8', padding: '7px 11px 7px 9px',
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '14px',
        letterSpacing: '0.02em', textTransform: 'uppercase',
      }}
    >
      <HelpCircle size={18} strokeWidth={2.2} />
      Help
    </button>
  )
}

var Logo = function () {
  return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '24px', letterSpacing: '-0.5px', color: '#1a1a2e' }}>
      Beta<span style={{ color: '#4f7ef8' }}>Log</span>
    </span>
  )
}

/**
 * The header (mobile) and the top nav (desktop). Both are plain children of the
 * app shell in `App.jsx` — a full-height column in which only `<main>` scrolls
 * — so neither needs `sticky`: the page moves underneath them, they stay put.
 * The bottom tabs are `BottomTabs`, rendered by the shell *after* `<main>`.
 *
 * No z-index on any shell row (BTL-B128). A flex item with a z-index is a
 * stacking context, and the sheets (`fixed inset-0 z-50`, rendered inside
 * `<main>`) sit at the same level — so a `z-50` row painted over them, in
 * tree order: the header over a sheet's title and close button, the tabs over
 * its Edit / Save / Delete footer. Nothing can be under a row but an overlay,
 * and an overlay must win, so the rows take no z-index at all.
 */
export default function Nav({ onSettingsClick, onFriendsClick, onHelpClick }) {
  var links = ALL_LINKS

  return (
    <>
      {/* Top header — mobile */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 md:hidden"
        style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <Logo />
        <div className="flex items-center gap-1">
          <HelpChip onClick={onHelpClick} />
          <Link
            to="/comp"
            aria-label="Competitions"
            className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
          >
            <Trophy size={18} />
          </Link>
          <button
            onClick={onFriendsClick}
            aria-label="Friends"
            className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
          >
            <Users size={18} />
          </button>
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Top nav — desktop */}
      <nav className="hidden md:flex shrink-0 items-center gap-1 px-4 py-2"
        style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Logo />
        <div className="ml-4 flex gap-1 flex-1">
          {links.map(function (l) {
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors"
                style={function (props) {
                  return props.isActive
                    ? { color: l.accent, background: l.accent + '15' }
                    : { color: '#7a8299' }
                }}
              >
                <l.icon size={16} />
                {l.label}
              </NavLink>
            )
          })}
        </div>
        <HelpChip onClick={onHelpClick} />
        <Link
          to="/comp"
          aria-label="Competitions"
          className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors shrink-0"
        >
          <Trophy size={18} />
        </Link>
        <button
          onClick={onFriendsClick}
          aria-label="Friends"
          className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors shrink-0"
        >
          <Users size={18} />
        </button>
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors shrink-0"
        >
          <Settings size={18} />
        </button>
      </nav>
    </>
  )
}

/**
 * Bottom tabs — mobile. The app shell renders this after `<main>`, as the last
 * row of a full-height flex column, so it is laid out under the scroller rather
 * than floated over the page. That is the whole fix for BTL-B127: the tabs were
 * `position: fixed` over a scrolling document, and iOS WebKit paints a fixed
 * element at a stale offset whenever the document's height changes under it —
 * a widget collapsing (BTL-B44), the keyboard going (BTL-B101), a timeframe
 * toggle (BTL-B127). Each fix covered one trigger; with the document no longer
 * scrolling at all there is nothing to drift. Keep this out of `fixed`, and
 * keep it without a z-index — see `Nav` above: with one it painted over the
 * footer of every z-50 sheet (BTL-B128).
 */
export function BottomTabs() {
  var links = ALL_LINKS
  return (
      <nav className="shrink-0 flex md:hidden"
        style={{
          background: '#ffffff',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft:   'env(safe-area-inset-left)',
          paddingRight:  'env(safe-area-inset-right)',
        }}>
        {links.map(function (l) {
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className="flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors"
            >
              {function (props) {
                return (
                  <div
                    className="flex flex-col items-center gap-0.5 w-full px-1 py-1 rounded-xl transition-colors"
                    style={props.isActive ? { background: l.accent, color: '#fff' } : { color: '#bbbcc8' }}
                  >
                    <l.icon size={20} />
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      {l.label}
                    </span>
                  </div>
                )
              }}
            </NavLink>
          )
        })}
      </nav>
  )
}
