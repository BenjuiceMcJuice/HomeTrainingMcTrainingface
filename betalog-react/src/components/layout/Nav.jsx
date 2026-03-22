import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, History, CalendarDays } from 'lucide-react'

const links = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { to: '/log',     label: 'Log',       icon: PlusCircle },
  { to: '/history', label: 'History',   icon: History },
  { to: '/plan',    label: 'Plan',      icon: CalendarDays },
]

export default function Nav() {
  return (
    <>
      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex bg-zinc-900 border-t border-zinc-800 md:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 text-xs gap-1 transition-colors ${
                isActive ? 'text-[#4f7ef8]' : 'text-zinc-500 hover:text-zinc-200'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Top nav — desktop */}
      <nav className="hidden md:flex sticky top-0 z-50 items-center gap-1 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="font-bold text-white mr-4 tracking-tight">BetaLog</span>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                isActive ? 'text-[#4f7ef8] bg-[#4f7ef8]/10' : 'text-zinc-400 hover:text-zinc-100'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
