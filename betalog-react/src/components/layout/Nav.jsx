import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, History, CalendarDays, MessageCircle, Settings } from 'lucide-react'

var ALL_LINKS = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard, accent: '#4f7ef8' },
  { to: '/log',     label: 'Log',       icon: PlusCircle,      accent: '#2a9d5c' },
  { to: '/history', label: 'History',   icon: History,         accent: '#d4742a' },
  { to: '/plan',    label: 'Plan',      icon: CalendarDays,    accent: '#8b5cf6' },
  { to: '/coach',   label: 'Coach',     icon: MessageCircle,   accent: '#c0622a' },
]

var Logo = function () {
  return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '24px', letterSpacing: '-0.5px', color: '#1a1a2e' }}>
      Beta<span style={{ color: '#4f7ef8' }}>Log</span>
    </span>
  )
}

export default function Nav({ onSettingsClick }) {
  var links = ALL_LINKS

  return (
    <>
      {/* Top header — mobile */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 md:hidden"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Logo />
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
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

      {/* Top nav — desktop */}
      <nav className="hidden md:flex sticky top-0 z-50 items-center gap-1 px-4 py-2"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
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
