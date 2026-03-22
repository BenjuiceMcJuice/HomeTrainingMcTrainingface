import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, History, CalendarDays } from 'lucide-react'

const links = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { to: '/log',     label: 'Log',       icon: PlusCircle },
  { to: '/history', label: 'History',   icon: History },
  { to: '/plan',    label: 'Plan',      icon: CalendarDays },
]

const Logo = () => (
  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '24px', letterSpacing: '-0.5px', color: '#1a1a2e' }}>
    Beta<span style={{ color: '#4f7ef8' }}>Log</span>
  </span>
)

export default function Nav() {
  return (
    <>
      {/* Top header — mobile */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 md:hidden"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Logo />
      </header>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 gap-1 transition-colors border-t-2 ${
                isActive ? 'text-[#4f7ef8] border-[#4f7ef8]' : 'text-[#999] border-transparent hover:text-[#555]'
              }`
            }
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Top nav — desktop */}
      <nav className="hidden md:flex sticky top-0 z-50 items-center gap-1 px-4 py-2"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Logo />
        <div className="ml-4 flex gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                  isActive ? 'text-[#4f7ef8] bg-[#4f7ef8]/10' : 'text-[#7a8299] hover:text-[#1a1d2e]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
