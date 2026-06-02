import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Users } from 'lucide-react'
import Storage from '../lib/storage'
import { calcDisciplineStats, V_GRADES, FRENCH_GRADES, LEVEL_COLOR, gradeLevel } from '../lib/stats'
import { barlow } from '../lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function derivedStats(u) {
  const sessions  = u.sessions  || []
  const goals     = u.goals     || []
  const weightLog = u.weightLog || []
  const drinkLog  = u.drinkLog  || []

  const boulder = calcDisciplineStats(sessions, ['boulder'],         V_GRADES,      'v')
  const rope    = calcDisciplineStats(sessions, ['lead', 'toprope'], FRENCH_GRADES, 'french')

  const byType = { climb: 0, gym: 0, hangboard: 0, cardio: 0 }
  sessions.forEach(s => { if (byType[s.type] !== undefined) byType[s.type]++ })

  const dates = sessions.map(s => s.date).filter(Boolean).sort()
  const lastSession = dates[dates.length - 1] || null
  const lastActive  = [u.updatedAt, lastSession].filter(Boolean).sort().pop() || null

  const boulderGrade = boulder.consistent ? boulder.consistent.grade : (boulder.highestSend ? boulder.highestSend.grade : null)
  const ropeGrade    = rope.consistent    ? rope.consistent.grade    : (rope.highestSend    ? rope.highestSend.grade    : null)

  return {
    lastActive,
    totalSessions: sessions.length,
    byType,
    boulderGrade,
    ropeGrade,
    boulderLevel: boulderGrade ? gradeLevel(boulderGrade, 'v')      : null,
    ropeLevel:    ropeGrade    ? gradeLevel(ropeGrade,    'french')  : null,
    goalsCount:   goals.length,
    activeGoals:  goals.filter(g => !g.achieved).length,
    weightCount:  weightLog.length,
    drinkCount:   drinkLog.length,
    hasClimb:     byType.climb     > 0,
    hasGym:       byType.gym       > 0,
    hasHang:      byType.hangboard > 0,
    hasCardio:    byType.cardio    > 0,
  }
}

function relativeTime(isoStr) {
  if (!isoStr) return '—'
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60)  return mins  <= 1 ? 'just now' : mins + 'm ago'
  if (hours < 24)  return hours + 'h ago'
  if (days  <  7)  return days  + 'd ago'
  if (days  < 30)  return Math.floor(days / 7)  + 'w ago'
  if (days  < 365) return Math.floor(days / 30) + 'mo ago'
  return Math.floor(days / 365) + 'y ago'
}

function isActiveInDays(isoStr, days) {
  if (!isoStr) return false
  return (Date.now() - new Date(isoStr).getTime()) < days * 86400000
}

// ---------------------------------------------------------------------------
// Summary strip
// ---------------------------------------------------------------------------

function SummaryStrip({ users }) {
  const stats = useMemo(() => {
    const total   = users.length
    const active30 = users.filter(u => isActiveInDays(derivedStats(u).lastActive, 30)).length
    const active7  = users.filter(u => isActiveInDays(derivedStats(u).lastActive, 7)).length
    const withSessions = users.filter(u => (u.sessions || []).length > 0).length
    const withClimb    = users.filter(u => derivedStats(u).hasClimb).length
    const withGym      = users.filter(u => derivedStats(u).hasGym).length
    const withHang     = users.filter(u => derivedStats(u).hasHang).length
    const withGoals    = users.filter(u => (u.goals || []).length > 0).length
    const withHealth   = users.filter(u => (u.drinkLog || []).length > 0).length
    const pct = n => total > 0 ? Math.round(n / total * 100) : 0
    return { total, active30, active7, withSessions, withClimb, withGym, withHang, withGoals, withHealth, pct }
  }, [users])

  const chip = (label, value, color) => (
    <div key={label} className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: color + '20' }}>
      <span className="font-black text-xl leading-none" style={{ ...barlow, color }}>{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{ color }}>{label}</span>
    </div>
  )

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] p-4">
        <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest mb-3" style={barlow}>Platform overview</p>
        <div className="flex gap-2 flex-wrap mb-3">
          {chip('Total users',   stats.total,    '#4f7ef8')}
          {chip('Active 30d',   stats.active30,  '#2a9d5c')}
          {chip('Active 7d',    stats.active7,   '#8b5cf6')}
          {chip('With sessions', stats.withSessions, '#d4742a')}
        </div>
        <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest mb-2" style={barlow}>Feature adoption</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            ['Climb',  stats.withClimb,  '#3b82f6'],
            ['Gym',    stats.withGym,    '#8b5cf6'],
            ['Hang',   stats.withHang,   '#c0622a'],
            ['Goals',  stats.withGoals,  '#2a9d5c'],
            ['Health', stats.withHealth, '#ef4444'],
          ].map(([label, n, color]) => (
            <span key={label} className="text-[11px]" style={{ color: '#7a8299' }}>
              <span className="font-bold" style={{ color }}>{stats.pct(n)}%</span>
              {' '}{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grade chip
// ---------------------------------------------------------------------------

function GradeChip({ grade, level }) {
  if (!grade) return null
  const colors = LEVEL_COLOR[level] || { color: '#7a8299', bg: '#f1f2f6' }
  return (
    <span
      className="text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none"
      style={{ background: colors.bg, color: colors.color, ...barlow }}
    >
      {grade}
    </span>
  )
}

// ---------------------------------------------------------------------------
// User row
// ---------------------------------------------------------------------------

function UserRow({ user: u }) {
  const [expanded, setExpanded] = useState(false)
  const s = useMemo(() => derivedStats(u), [u])
  const displayName = u.authDisplayName || u.email || (u.athleteProfile && u.athleteProfile.name) || 'Unknown'
  const email       = u.email || null
  const initial     = (displayName || '?').charAt(0).toUpperCase()

  return (
    <div className="border-t border-[#f0f1f5] first:border-t-0">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f8f9fc] transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#4f7ef8] flex items-center justify-center shrink-0">
          <span className="text-white font-black text-sm" style={barlow}>{initial}</span>
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1a1d2e] truncate" style={barlow}>{displayName}</p>
          {email && displayName !== email && (
            <p className="text-[9px] text-[#bbbcc8] truncate">{email}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0">
          <GradeChip grade={s.boulderGrade} level={s.boulderLevel} />
          <GradeChip grade={s.ropeGrade}    level={s.ropeLevel} />
          <div className="text-right">
            <p className="text-xs font-black text-[#1a1d2e]" style={barlow}>{s.totalSessions}</p>
            <p className="text-[8px] text-[#bbbcc8]">sessions</p>
          </div>
          <div className="text-right w-14">
            <p className="text-[10px] text-[#7a8299]">{relativeTime(s.lastActive)}</p>
          </div>
          {expanded ? <ChevronUp size={14} className="text-[#bbbcc8]" /> : <ChevronDown size={14} className="text-[#bbbcc8]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 bg-[#f8f9fc]">
          <div className="grid grid-cols-2 gap-2 pt-2">
            {/* Session breakdown */}
            <div className="bg-white rounded-xl border border-[#e5e7ef] p-2.5">
              <p className="text-[9px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5" style={barlow}>Sessions by type</p>
              <div className="flex flex-col gap-1">
                {[
                  ['Climb',    s.byType.climb,     '#3b82f6'],
                  ['Gym',      s.byType.gym,       '#8b5cf6'],
                  ['Hangboard',s.byType.hangboard, '#c0622a'],
                  ['Cardio',   s.byType.cardio,    '#2a9d5c'],
                ].map(([label, count, color]) => count > 0 && (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[10px] text-[#7a8299]">{label}</span>
                    <span className="text-[10px] font-bold" style={{ color }}>{count}</span>
                  </div>
                ))}
                {s.totalSessions === 0 && <p className="text-[10px] text-[#bbbcc8]">No sessions</p>}
              </div>
            </div>

            {/* Feature usage */}
            <div className="bg-white rounded-xl border border-[#e5e7ef] p-2.5">
              <p className="text-[9px] font-bold text-[#7a8299] uppercase tracking-wide mb-1.5" style={barlow}>Features used</p>
              <div className="flex flex-col gap-1">
                {[
                  ['Goals',       s.activeGoals + (s.goalsCount - s.activeGoals > 0 ? ` (${s.goalsCount - s.activeGoals} done)` : ''), s.goalsCount > 0,   '#2a9d5c'],
                  ['Weight log',  s.weightCount + ' entries',  s.weightCount > 0, '#4f7ef8'],
                  ['Health log',  s.drinkCount  + ' entries',  s.drinkCount  > 0, '#ef4444'],
                ].map(([label, detail, active, color]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: active ? '#1a1d2e' : '#bbbcc8' }}>{label}</span>
                    <span className="text-[10px] font-bold" style={{ color: active ? color : '#bbbcc8' }}>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* UID (for debugging) */}
          <p className="text-[8px] text-[#bbbcc8] mt-2 font-mono truncate">uid: {u.uid}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin page
// ---------------------------------------------------------------------------

export default function Admin() {
  const [users,   setUsers]   = useState(null)  // null = loading
  const [error,   setError]   = useState(null)
  const [sortBy,  setSortBy]  = useState('lastActive') // 'lastActive' | 'sessions' | 'name'

  useEffect(() => {
    Storage.getAllUsersForAdmin()
      .then(setUsers)
      .catch(err => setError(err.message))
  }, [])

  const sorted = useMemo(() => {
    if (!users) return []
    return [...users].sort((a, b) => {
      if (sortBy === 'sessions') return (b.sessions || []).length - (a.sessions || []).length
      if (sortBy === 'name') {
        const na = a.authDisplayName || a.email || ''
        const nb = b.authDisplayName || b.email || ''
        return na.localeCompare(nb)
      }
      // lastActive (default)
      const la = derivedStats(a).lastActive || ''
      const lb = derivedStats(b).lastActive || ''
      return lb > la ? 1 : lb < la ? -1 : 0
    })
  }, [users, sortBy])

  return (
    <div className="flex flex-col min-h-screen bg-white pb-24 md:pb-8 pt-4 gap-4">

      {/* Header */}
      <div className="px-4 flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg hover:bg-[#f4f5f9] transition-colors text-[#7a8299]">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1a1d2e] flex items-center justify-center">
            <Users size={16} className="text-white" />
          </div>
          <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '22px' }}>Admin Panel</p>
        </div>
      </div>

      {/* Loading */}
      {users === null && !error && (
        <div className="px-4">
          <p className="text-sm text-[#7a8299]" style={barlow}>Loading users…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4">
          <div className="bg-[#fef2f2] rounded-2xl border border-[#fee2e2] px-4 py-3">
            <p className="text-sm font-bold text-[#ef4444]" style={barlow}>Failed to load users</p>
            <p className="text-xs text-[#ef4444] mt-0.5">{error}</p>
            <p className="text-[10px] text-[#7a8299] mt-1">Check that your Firebase UID is set correctly in App.jsx and firestore.rules has been deployed.</p>
          </div>
        </div>
      )}

      {/* Content */}
      {users !== null && !error && (
        <>
          <SummaryStrip users={users} />

          {/* User list */}
          <div className="px-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>
                Users ({users.length})
              </p>
              <div className="flex gap-1">
                {[['lastActive', 'Recent'], ['sessions', 'Sessions'], ['name', 'Name']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className="px-2 py-1 rounded-lg text-[9px] font-bold transition-colors"
                    style={sortBy === key
                      ? { background: '#1a1d2e', color: '#fff', ...barlow }
                      : { background: '#f4f5f9', color: '#7a8299', ...barlow }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#e5e7ef] overflow-hidden">
              {sorted.length === 0
                ? <p className="px-4 py-6 text-sm text-[#bbbcc8] text-center" style={barlow}>No users found</p>
                : sorted.map(u => <UserRow key={u.uid} user={u} />)
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}
