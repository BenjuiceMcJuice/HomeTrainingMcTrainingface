import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useSessions from '../hooks/useSessions'
import useProfile from '../hooks/useProfile'
import useWeightLog from '../hooks/useWeightLog'
import useSchedule from '../hooks/useSchedule'
import useRoutines from '../hooks/useRoutines'
import useHangRoutines from '../hooks/useHangRoutines'
import { useData } from '../App'
import { PERSONAS, buildContext, callGroq } from './Coach'
import { Flame, Dumbbell, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus, Scale, CalendarDays, MessageCircle, Mountain, Activity, Target, Droplets } from 'lucide-react'
import { calcDisciplineStats, LEVEL_COLOR, calcWeeklyStreak, mondayOf, todayStr, gradeColor, filterSessionsByDays, calcAlcoholFreeStreak, getMETRange, estimateCalories } from '../lib/stats'
import useGoals, { getCurrentValue, calcGoalProgress } from '../hooks/useGoals'
import useDrinkLog from '../hooks/useDrinkLog'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function daysAgo(n) {
  var d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function weekStart() {
  var d = new Date()
  var day = d.getDay()           // 0=Sun
  var diff = day === 0 ? 6 : day - 1  // shift to Mon=0
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Stats calculations
// ---------------------------------------------------------------------------

function calcWeekSessions(sessions) {
  var ws = weekStart()
  return sessions.filter(function (s) { return s.date >= ws }).length
}

// ---------------------------------------------------------------------------
// Quick stats strip
// ---------------------------------------------------------------------------

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

function QuickStats({ sessions }) {
  var weekStreak  = calcWeeklyStreak(sessions)
  var thisWeek    = calcWeekSessions(sessions)
  var total       = sessions.length

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-3 py-2 flex items-center">
        <div className="flex-1 flex items-center gap-1.5 justify-center">
          <Flame size={13} style={{ color: '#ef4444' }} />
          <span className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '18px' }}>{weekStreak.current}</span>
          <span className="text-[9px] font-bold text-[#7a8299] uppercase" style={barlow}>wk</span>
          {weekStreak.best > 0 && (
            <span className="text-[8px] text-[#bbbcc8]" style={barlow}>best:{weekStreak.best}</span>
          )}
        </div>
        <div className="w-px h-6 bg-[#e5e7ef]" />
        <div className="flex-1 flex items-center gap-1.5 justify-center">
          <Dumbbell size={13} style={{ color: '#4f7ef8' }} />
          <span className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '18px' }}>{thisWeek}</span>
          <span className="text-[9px] font-bold text-[#7a8299] uppercase" style={barlow}>this wk</span>
        </div>
        <div className="w-px h-6 bg-[#e5e7ef]" />
        <div className="flex-1 flex items-center gap-1.5 justify-center">
          <TrendingUp size={13} style={{ color: '#2a9d5c' }} />
          <span className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '18px' }}>{total}</span>
          <span className="text-[9px] font-bold text-[#7a8299] uppercase" style={barlow}>total</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalise(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function fmtDuration(mins) {
  var h = Math.floor(mins / 60)
  var m = mins % 60
  if (h > 0 && m > 0) return h + 'h ' + m + 'm'
  if (h > 0) return h + 'h'
  return m + 'm'
}

function fmtDist(km) {
  if (km >= 1) return km.toFixed(1) + ' km'
  return Math.round(km * 1000) + ' m'
}

function sessionDistKm(s) {
  if (!s.cardioQuantity || !s.cardioUnit) return null
  if (s.cardioUnit === 'km')    return s.cardioQuantity
  if (s.cardioUnit === 'miles') return +(s.cardioQuantity * 1.609).toFixed(2)
  if (s.cardioUnit === 'm')     return +(s.cardioQuantity / 1000).toFixed(2)
  if (s.cardioUnit === 'lengths' && s.cardioPoolLength)
    return +((s.cardioQuantity * s.cardioPoolLength) / 1000).toFixed(2)
  return null
}

// ---------------------------------------------------------------------------
// Training load — acute vs chronic comparison
// ---------------------------------------------------------------------------

var LOAD_ZONES = [
  { max: 0,    label: 'Inactive',     color: '#7a8299', bg: '#f4f5f9' },
  { max: 0.8,  label: 'Easing off',   color: '#4f7ef8', bg: '#eef1ff' },
  { max: 1.3,  label: 'Sweet spot',   color: '#2a9d5c', bg: '#edfaf2' },
  { max: Infinity, label: 'Pushing hard', color: '#ef4444', bg: '#fef2f2' },
]

function calcLoad(sessions, fromDate, toDate) {
  var count = 0
  var totalDiff = 0
  sessions.forEach(function (s) {
    if (s.date >= fromDate && s.date <= toDate) {
      count++
      totalDiff += (s.difficulty || 3)
    }
  })
  if (count === 0) return { count: 0, avgDiff: 0, load: 0 }
  var avgDiff = totalDiff / count
  return { count: count, avgDiff: avgDiff, load: count * avgDiff }
}

function getZone(ratio) {
  if (ratio === null) return { label: 'Building baseline', color: '#7a8299', bg: '#f4f5f9' }
  for (var i = 0; i < LOAD_ZONES.length; i++) {
    if (ratio <= LOAD_ZONES[i].max) return LOAD_ZONES[i]
  }
  return LOAD_ZONES[LOAD_ZONES.length - 1]
}

// Need at least this many sessions in the chronic window before a ratio is meaningful —
// otherwise a single new session balloons the ratio (e.g. +229%) on a near-empty baseline.
var MIN_CHRONIC_SESSIONS = 4

function TrainingLoad({ sessions }) {
  var today = todayStr()

  // Acute: last 7 days (today inclusive)
  var acuteFrom = daysAgo(6)
  var acute     = calcLoad(sessions, acuteFrom, today)

  // Chronic: days 8–30 (23-day window before the acute week)
  var chronicFrom = daysAgo(30)
  var chronicTo   = daysAgo(7)
  var chronic     = calcLoad(sessions, chronicFrom, chronicTo)

  // Normalise chronic to a 7-day equivalent for fair comparison
  var chronicPer7 = chronic.load > 0 ? (chronic.load / 23) * 7 : 0

  var hasBaseline = chronic.count >= MIN_CHRONIC_SESSIONS && chronicPer7 > 0
  var ratio = hasBaseline ? acute.load / chronicPer7 : null
  var zone  = ratio === null && acute.count === 0
    ? { label: 'No sessions yet', color: '#7a8299', bg: '#f4f5f9' }
    : getZone(ratio)

  // Arrow direction
  var arrow = null
  var arrowLabel = ''
  if (ratio !== null) {
    if (ratio > 1.05) {
      arrow = <ArrowUpRight size={18} style={{ color: zone.color }} />
      arrowLabel = '+' + Math.round((ratio - 1) * 100) + '%'
    } else if (ratio < 0.95) {
      arrow = <ArrowDownRight size={18} style={{ color: zone.color }} />
      arrowLabel = Math.round((ratio - 1) * 100) + '%'
    } else {
      arrow = <Minus size={18} style={{ color: zone.color }} />
      arrowLabel = 'Steady'
    }
  } else if (acute.count > 0) {
    // Have acute data but no chronic baseline yet
    arrow = <ArrowUpRight size={18} style={{ color: '#2a9d5c' }} />
    arrowLabel = 'New'
  }

  // Contextual explainer
  var explainer = ''
  if (acute.count === 0) {
    explainer = ''
  } else if (ratio === null) {
    explainer = 'Keep logging — we need a few weeks of data to compare against.'
  } else if (ratio <= 0.8) {
    explainer = 'Your last 7 days are lighter than your recent average. Good if recovering, otherwise time to get after it.'
  } else if (ratio <= 1.3) {
    explainer = 'Your last 7 days are in line with your recent average. Consistent effort — keep it up.'
  } else {
    explainer = 'Your last 7 days are significantly above your recent average. Great for a push week, but watch for fatigue.'
  }

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3.5">
        <div className="flex items-center gap-3">
          {/* Zone indicator */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: zone.bg }}
          >
            {arrow}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#1a1d2e] text-sm" style={barlow}>
              {zone.label}
            </p>
            <p className="text-xs text-[#7a8299]">
              {acute.count > 0 ? (
                <>
                  {acute.count} session{acute.count !== 1 ? 's' : ''} · avg effort {acute.avgDiff.toFixed(1)}
                  <span className="text-[#bbbcc8]"> · last 7 days</span>
                </>
              ) : (
                'Log sessions to track your training load'
              )}
            </p>
          </div>

          {/* Trend badge */}
          {arrowLabel && (
            <span
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{ background: zone.bg, color: zone.color, ...barlow }}
            >
              {arrowLabel}
            </span>
          )}
        </div>

        {/* Explainer note */}
        {explainer && (
          <p className="text-[11px] text-[#7a8299] mt-2.5 pt-2.5 border-t border-[#f0f1f5] leading-relaxed">
            {explainer}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity calendar — monthly view with prev/next navigation (collapsible)
// ---------------------------------------------------------------------------

var TYPE_COLOR = {
  gym:       { bg: '#d5e4d8', text: '#2a6e3f' },
  climb:     { bg: '#f0d9c8', text: '#b05a1a' },
  hangboard: { bg: '#e4d8f0', text: '#6b3fa0' },
}

var DOT_COLOR = {
  gym:       '#2a6e3f',
  climb:     '#b05a1a',
  hangboard: '#6b3fa0',
}

var DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

var MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Build the 6-row grid for a given month.
 * Each row is 7 cells (Mon–Sun). Cells outside the month are null.
 */
function buildMonthGrid(year, month) {
  // First day of month
  var first = new Date(year, month, 1)
  var firstDow = first.getDay()
  firstDow = firstDow === 0 ? 6 : firstDow - 1  // shift to Mon=0
  var daysInMonth = new Date(year, month + 1, 0).getDate()

  var rows = []
  var row  = []
  // Leading blanks
  for (var b = 0; b < firstDow; b++) row.push(null)

  for (var d = 1; d <= daysInMonth; d++) {
    var ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    row.push(ds)
    if (row.length === 7) {
      rows.push(row)
      row = []
    }
  }
  // Trailing blanks
  if (row.length > 0) {
    while (row.length < 7) row.push(null)
    rows.push(row)
  }
  return rows
}

/**
 * Convert JS Date.getDay() (0=Sun) to schedule day (1=Mon…7=Sun)
 */
function jsToScheduleDay(jsDay) {
  return jsDay === 0 ? 7 : jsDay
}

function ActivityCalendar({ sessions, scheduleEntries, defaultExpanded }) {
  var now   = new Date()
  var [viewYear,  setViewYear]  = useState(now.getFullYear())
  var [viewMonth, setViewMonth] = useState(now.getMonth())
  var [expanded,  setExpanded]  = useState(!!defaultExpanded)

  // Build date → types map
  var dateTypes = useMemo(function () {
    var map = {}
    sessions.forEach(function (s) {
      if (!map[s.date]) map[s.date] = {}
      map[s.date][s.type] = true
    })
    return map
  }, [sessions])

  // Build set of scheduled day-of-week numbers (1=Mon…7=Sun)
  var scheduledDays = useMemo(function () {
    var set = {}
    ;(scheduleEntries || []).forEach(function (e) {
      e.days.forEach(function (d) { set[d] = true })
    })
    return set
  }, [scheduleEntries])

  var grid  = useMemo(function () { return buildMonthGrid(viewYear, viewMonth) }, [viewYear, viewMonth])
  var today = todayStr()

  function isScheduled(dateStr) {
    if (!dateStr) return false
    var d = new Date(dateStr + 'T12:00:00')
    return !!scheduledDays[jsToScheduleDay(d.getDay())]
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else { setViewMonth(viewMonth - 1) }
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else { setViewMonth(viewMonth + 1) }
  }

  function cellStyle(dateStr) {
    if (!dateStr) return {}
    var types = dateTypes[dateStr]
    if (!types) return {}
    var keys = Object.keys(types)
    // Use the first type's colour for the background; if multiple, blend darker
    if (keys.length === 1) {
      var tc = TYPE_COLOR[keys[0]]
      return tc ? { background: tc.bg, color: tc.text } : {}
    }
    // Multi-type: use a neutral warm tint
    return { background: '#e8ddd4', color: '#5a4a3a' }
  }

  function typeDots(dateStr) {
    if (!dateStr) return null
    var types = dateTypes[dateStr]
    if (!types) return null
    var keys = Object.keys(types)
    return keys.map(function (k) {
      return DOT_COLOR[k] || '#7a8299'
    })
  }

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] overflow-hidden">

        {/* Collapsible header */}
        <button
          onClick={function () { setExpanded(!expanded) }}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f8f9fc] transition-colors"
        >
          <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>
            Activity calendar
          </p>
          {expanded
            ? <ChevronUp size={18} className="text-[#7a8299]" />
            : <ChevronDown size={18} className="text-[#7a8299]" />
          }
        </button>

        {/* Collapsible body */}
        {expanded && (
          <div className="px-4 pb-4">

            {/* Month header with nav arrows */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-xl border border-[#e5e7ef] flex items-center justify-center text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '20px' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </p>
              <button
                onClick={nextMonth}
                className="w-9 h-9 rounded-xl border border-[#e5e7ef] flex items-center justify-center text-[#7a8299] hover:bg-[#f4f5f9] transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map(function (label, i) {
                return (
                  <div key={i} className="flex items-center justify-center py-1">
                    <span className="text-xs font-bold text-[#7a8299]" style={barlow}>{label}</span>
                  </div>
                )
              })}
            </div>

            {/* Date grid */}
            {grid.map(function (row, ri) {
              return (
                <div key={ri} className="grid grid-cols-7 gap-1 mb-1">
                  {row.map(function (ds, ci) {
                    if (!ds) {
                      return <div key={ci} />
                    }
                    var dayNum    = parseInt(ds.slice(8), 10)
                    var isToday   = ds === today
                    var style     = cellStyle(ds)
                    var hasData   = !!dateTypes[ds]
                    var scheduled = !hasData && isScheduled(ds)
                    var dots      = typeDots(ds)

                    return (
                      <div
                        key={ci}
                        className="flex flex-col items-center justify-center rounded-xl aspect-square"
                        style={Object.assign(
                          {},
                          hasData ? style : scheduled ? { background: '#f0f1f5' } : {},
                          isToday ? { border: '2px dashed #7a8299' } : {}
                        )}
                      >
                        <span
                          className="font-bold leading-none"
                          style={{
                            ...barlow,
                            fontSize:  '15px',
                            color:     hasData ? (style.color || '#1a1d2e') : scheduled ? '#7a8299' : '#1a1d2e',
                          }}
                        >
                          {dayNum}
                        </span>
                        {/* Type dots */}
                        {dots && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {dots.map(function (c, di) {
                              return (
                                <div
                                  key={di}
                                  className="rounded-full"
                                  style={{ width: '4px', height: '4px', background: c }}
                                />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Legend */}
            <div className="flex items-center gap-3 mt-2 pt-2.5 border-t border-[#f0f1f5] flex-wrap">
              {[
                { label: 'Gym',       bg: TYPE_COLOR.gym.bg },
                { label: 'Climb',     bg: TYPE_COLOR.climb.bg },
                { label: 'Hang',      bg: TYPE_COLOR.hangboard.bg },
                { label: 'Scheduled', bg: '#f0f1f5' },
              ].map(function (item) {
                return (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="rounded" style={{ width: '12px', height: '12px', background: item.bg }} />
                    <span className="text-[10px] font-semibold text-[#7a8299]" style={barlow}>{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weight & BMI card (conditional on profile toggle)
// ---------------------------------------------------------------------------

var BMI_CATS = [
  { max: 18.5, label: 'Underweight', color: '#4f7ef8', bg: '#eef1ff' },
  { max: 25,   label: 'Healthy',     color: '#2a9d5c', bg: '#edfaf2' },
  { max: 30,   label: 'Overweight',  color: '#d97706', bg: '#fffbeb' },
  { max: Infinity, label: 'Obese',   color: '#ef4444', bg: '#fef2f2' },
]

function bmiCategory(bmi) {
  for (var i = 0; i < BMI_CATS.length; i++) {
    if (bmi < BMI_CATS[i].max) return BMI_CATS[i]
  }
  return BMI_CATS[BMI_CATS.length - 1]
}

function WeightCard({ profile, weightEntries, goals }) {
  if (!profile) return null

  var h = profile.heightCm || 0
  var currentEntry = weightEntries.length > 0 ? weightEntries[0] : null
  var w = currentEntry ? currentEntry.weight : (profile.weightKg || 0)
  if (!w) return null

  var bmi    = h > 0 && w > 0 ? w / ((h / 100) * (h / 100)) : null
  var bmiCat = bmi ? bmiCategory(bmi) : null

  // 30-day trend
  var cutoff = daysAgo(30)
  var sum = 0, count = 0
  weightEntries.forEach(function (e) {
    if (e.date >= cutoff) { sum += e.weight; count++ }
  })
  var avg  = count >= 2 ? sum / count : null
  var diff = avg !== null ? w - avg : null

  // Active weight goal
  var weightGoal = (goals || []).find(function (g) { return g.type === 'weight' && !g.achieved }) || null
  var goalDiff   = weightGoal ? (w - Number(weightGoal.target)) : null

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#f4f5f9' }}>
          <Scale size={16} style={{ color: '#7a8299' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{w} kg</span>
            {bmiCat && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: bmiCat.bg, color: bmiCat.color, ...barlow }}>
                BMI {bmi.toFixed(1)} · {bmiCat.label}
              </span>
            )}
          </div>
          {diff !== null && (
            <div className="flex items-center gap-1 mt-0.5">
              {diff > 0.2 ? (
                <ArrowUpRight size={12} style={{ color: '#ef4444' }} />
              ) : diff < -0.2 ? (
                <ArrowDownRight size={12} style={{ color: '#2a9d5c' }} />
              ) : (
                <Minus size={12} style={{ color: '#7a8299' }} />
              )}
              <span className="text-[11px] text-[#7a8299]">
                {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg vs 30d avg ({avg.toFixed(1)})
              </span>
            </div>
          )}
          {goalDiff !== null && (
            <div className="flex items-center gap-1 mt-0.5">
              <Target size={12} style={{ color: '#d4742a' }} />
              <span className="text-[11px] text-[#7a8299]">
                {'Goal: ' + weightGoal.target + ' kg · '}
                {Math.abs(goalDiff) < 0.1
                  ? 'on target'
                  : goalDiff > 0
                    ? goalDiff.toFixed(1) + ' kg to lose'
                    : Math.abs(goalDiff).toFixed(1) + ' kg to gain'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule notice — upcoming / due today
// ---------------------------------------------------------------------------

var SCHED_DAY_NAMES = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' }

function ScheduleNotice({ scheduleEntries, sessions }) {
  var navigate = useNavigate()
  var { routines: gymRoutines } = useRoutines()
  var { routines: hangRoutines } = useHangRoutines()

  if (!scheduleEntries || !scheduleEntries.length) return null

  var today    = new Date()
  var todayDow = jsToScheduleDay(today.getDay())
  var todayStr2 = todayStr()

  // Check if any session logged today
  var loggedToday = sessions.some(function (s) { return s.date === todayStr2 })

  // Find routines due today
  var dueToday = scheduleEntries.filter(function (e) {
    return e.days.indexOf(todayDow) >= 0
  })

  function routineKind(routineId) {
    if (hangRoutines.some(function (r) { return r.id === routineId })) return 'hang'
    if (gymRoutines.some(function (r) { return r.id === routineId })) return 'gym'
    return null
  }

  function openRoutine(entry) {
    var kind = routineKind(entry.routineId)
    if (!kind) return
    navigate('/log', { state: { openRoutine: { id: entry.routineId, kind: kind } } })
  }

  // Find next scheduled day if nothing due today (or already done today)
  var nextEntries = null
  var nextDaysAway = null
  if (dueToday.length === 0 || loggedToday) {
    for (var ahead = 1; ahead <= 7; ahead++) {
      var checkDow = ((todayDow - 1 + ahead) % 7) + 1
      var found = scheduleEntries.filter(function (e) { return e.days.indexOf(checkDow) >= 0 })
      if (found.length > 0) {
        nextEntries = found
        nextDaysAway = ahead
        break
      }
    }
  }

  // Due today and not yet logged
  if (dueToday.length > 0 && !loggedToday) {
    return (
      <div className="px-4">
        <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-[#e5e7ef] px-4 py-2.5">
          <CalendarDays size={16} style={{ color: '#4f7ef8' }} className="shrink-0" />
          <span className="text-xs font-bold text-[#1a1d2e] shrink-0" style={barlow}>Due today:</span>
          <div className="flex-1 flex flex-wrap gap-1.5">
            {dueToday.map(function (e) {
              var kind = routineKind(e.routineId)
              var accent = kind === 'hang' ? '#8b5cf6' : '#4f7ef8'
              return (
                <button
                  key={e.id}
                  onClick={function () { openRoutine(e) }}
                  disabled={!kind}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: accent, fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {e.routineName || 'Routine'} ›
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Next scheduled
  if (nextEntries && nextDaysAway) {
    var dayName = SCHED_DAY_NAMES[((todayDow - 1 + nextDaysAway) % 7) + 1]
    var nextNames = nextEntries.map(function (e) { return e.routineName }).join(', ')
    return (
      <div className="px-4">
        <div className="flex items-center gap-2.5 bg-white rounded-2xl border border-[#e5e7ef] px-4 py-2.5">
          <CalendarDays size={16} style={{ color: '#7a8299' }} className="shrink-0" />
          <p className="text-xs text-[#7a8299]">
            <span className="font-semibold" style={barlow}>Next:</span> {nextNames} · {dayName}{nextDaysAway === 1 ? ' (tomorrow)' : ' (' + nextDaysAway + ' days)'}
          </p>
        </div>
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Coach tip — cached daily one-liner
// ---------------------------------------------------------------------------

var TIP_CACHE_KEY = 'il_coach_tip'

function CoachTip({ sessions, profile, apiKey, goals, weightLog }) {
  var [tip, setTip]         = useState(null)
  var [loading, setLoading] = useState(false)

  var pKey    = localStorage.getItem('il_ai_persona') || 'jonas'
  var persona = PERSONAS[pKey] || PERSONAS.jonas

  function fetchTip(skipCache) {
    if (!apiKey || sessions.length === 0 || loading) return

    if (!skipCache) {
      try {
        var cached = JSON.parse(localStorage.getItem(TIP_CACHE_KEY) || '{}')
        if (cached.date === todayStr() && cached.persona === pKey && cached.tip) {
          setTip(cached.tip)
          return
        }
      } catch (e) { /* ignore */ }
    }

    var context = buildContext(sessions, profile, goals, weightLog)
    setLoading(true)
    callGroq(apiKey, persona, [
      { role: 'user', content: 'You are ' + persona.name + '. Write ONE sentence — a specific training observation or tip based on my recent data. Must sound unmistakably like ' + persona.name + '. Max 20 words. No greeting, no preamble. Stay fully in character.' }
    ], context)
      .then(function (reply) {
        setTip(reply)
        localStorage.setItem(TIP_CACHE_KEY, JSON.stringify({ date: todayStr(), persona: pKey, tip: reply }))
      })
      .catch(function () { /* silently fail */ })
      .finally(function () { setLoading(false) })
  }

  useEffect(function () { fetchTip(false) }, [apiKey, sessions.length])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!apiKey || (!tip && !loading)) return null

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-2.5 flex items-start gap-2.5">
        <MessageCircle size={16} style={{ color: persona.color, marginTop: '2px' }} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-[#7a8299] mb-0.5" style={barlow}>{persona.name}</p>
          {loading ? (
            <p className="text-xs text-[#bbbcc8]">Thinking…</p>
          ) : (
            <p className="text-xs text-[#1a1d2e] leading-relaxed">{tip}</p>
          )}
        </div>
        <button
          onClick={function () { fetchTip(true) }}
          disabled={loading}
          className="p-1 rounded-lg text-[#bbbcc8] hover:text-[#7a8299] hover:bg-[#f4f5f9] transition-colors shrink-0 mt-0.5"
          title="New tip"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Climber level widgets — Boulder + Rope
// ---------------------------------------------------------------------------

var V_GRADES_DASH      = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']
var FRENCH_GRADES_DASH = ['4','5','5+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c']

function LevelCard({ label, icon, accentColor, peakStats, currentStats, gradeSystem }) {
  if (!peakStats || !peakStats.hasData) return null
  var lc = peakStats.consistent ? (LEVEL_COLOR[peakStats.consistent.level] || LEVEL_COLOR.Beginner) : null
  var currentLc = currentStats && currentStats.consistent ? (LEVEL_COLOR[currentStats.consistent.level] || LEVEL_COLOR.Beginner) : null
  var samePeak = peakStats.consistent && currentStats && currentStats.consistent && peakStats.consistent.grade === currentStats.consistent.grade

  function CG({ grade }) {
    if (!grade) return null
    return <span className="font-bold" style={{ ...barlow, color: gradeColor(grade, gradeSystem) }}>{grade}</span>
  }

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-3 py-2 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: lc ? lc.bg : '#f4f5f9' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#7a8299] uppercase" style={barlow}>{label}</span>
            {peakStats.consistent ? (
              <span className="font-black text-sm leading-none" style={{ ...barlow, color: lc.color }}>{peakStats.consistent.level}</span>
            ) : (
              <span className="text-[9px] text-[#bbbcc8]" style={barlow}>Log more to get a level</span>
            )}
            {!samePeak && currentStats && currentStats.consistent && currentLc && (
              <>
                <span className="text-[8px] text-[#bbbcc8]">|</span>
                <span className="text-[8px] text-[#7a8299]" style={barlow}>90d</span>
                <span className="font-black text-xs leading-none" style={{ ...barlow, color: currentLc.color }}>{currentStats.consistent.level}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-[#7a8299]">
            {peakStats.highestSend && <span>Project <CG grade={peakStats.highestSend.grade} /></span>}
            {peakStats.consistent && <span>Consistent <CG grade={peakStats.consistent.grade} /></span>}
            {peakStats.highestFlash && <span>Flash <CG grade={peakStats.highestFlash.grade} /></span>}
            {!peakStats.consistent && !peakStats.highestSend && (
              <span className="text-[#bbbcc8]">{peakStats.total} climbs logged</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alcohol-free streak widget
// ---------------------------------------------------------------------------

function AlcoholFreeCard({ drinkEntries }) {
  var streak = calcAlcoholFreeStreak(drinkEntries)
  var accent = '#2a9d5c'

  var primary, secondary
  if (streak.months >= 1) {
    primary   = streak.months + (streak.months === 1 ? ' month' : ' months')
    secondary = streak.days + ' days'
  } else if (streak.weeks >= 1) {
    primary   = streak.weeks + (streak.weeks === 1 ? ' week' : ' weeks')
    secondary = streak.days + ' days'
  } else {
    primary   = streak.days + (streak.days === 1 ? ' day' : ' days')
    secondary = null
  }

  // Weekly drink kcal — last 7 days, only show if at least one entry has kcal
  var weekKcal = 0
  var hasKcal  = false
  var cutoff   = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  var cutoffStr = cutoff.toISOString().slice(0, 10)
  ;(drinkEntries || []).forEach(function (e) {
    if (e.date >= cutoffStr && e.kcal) {
      weekKcal += e.kcal
      hasKcal = true
    }
  })

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#edfaf2' }}>
          <Droplets size={16} style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{primary}</span>
            {secondary && (
              <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{secondary}</span>
            )}
          </div>
          <p className="text-[11px] text-[#7a8299] mt-0.5">alcohol-free</p>
          {hasKcal && (
            <p className="text-[10px] text-[#bbbcc8] mt-0.5" style={barlow}>
              this week: ~{weekKcal} kcal from drinks
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Goals widget
// ---------------------------------------------------------------------------

var GOAL_META_DASH = {
  boulder_grade: { label: 'Boulder', color: '#c0622a', Icon: Mountain },
  rope_grade:    { label: 'Rope',    color: '#4f7ef8', Icon: Mountain },
  run:           { label: 'Run',     color: '#2a9d5c', Icon: Activity },
  swim:          { label: 'Swim',    color: '#0891b2', Icon: Activity },
  cycle:         { label: 'Cycle',   color: '#8b5cf6', Icon: Activity },
  weight:        { label: 'Weight',  color: '#d4742a', Icon: Scale    },
}

function GoalsWidget({ goals, sessions, weightLog, onNavigate }) {
  var active = (goals || []).filter(function (g) { return !g.achieved })
  if (active.length === 0) return null

  return (
    <div className="px-4">
      <div
        className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 cursor-pointer hover:bg-[#f8f9fc] transition-colors"
        onClick={onNavigate}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Target size={13} style={{ color: '#7a8299' }} />
          <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest" style={barlow}>Goals</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {active.map(function (g) {
            var meta     = GOAL_META_DASH[g.type] || GOAL_META_DASH.boulder_grade
            var Icon     = meta.Icon
            var current  = getCurrentValue(g.type, sessions, weightLog)
            var progress = calcGoalProgress(g, current)
            var today    = new Date(); today.setHours(0, 0, 0, 0)
            var target   = new Date(g.targetDate + 'T00:00:00')
            var days     = Math.round((target - today) / 86400000)
            var dc       = days <= 7 ? '#ef4444' : days <= 30 ? '#d97706' : '#7a8299'

            return (
              <div key={g.id} className="flex items-center gap-2">
                <Icon size={11} style={{ color: meta.color }} className="shrink-0" />
                <span className="text-[11px] font-bold text-[#1a1d2e] shrink-0 w-28 truncate" style={barlow}>
                  {meta.label} {String(g.target)}{g.unit ? ' ' + g.unit : ''}
                </span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: '5px', background: '#e5e7ef' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: Math.round(Math.min(1, progress) * 100) + '%', background: meta.color }}
                  />
                </div>
                <span className="text-[9px] font-bold w-14 text-right shrink-0" style={{ ...barlow, color: dc }}>
                  {days < 0 ? 'Overdue' : days === 0 ? 'Today!' : days + 'd left'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cardio stats widget
// ---------------------------------------------------------------------------

var ACTIVITY_LABEL = {
  swim: 'Swim', run: 'Run', cycle: 'Cycle', row: 'Row',
  walk: 'Walk', yoga: 'Yoga', other: 'Other',
}

function CardioStatsCard({ sessions, weightEntries }) {
  var cutoff = daysAgo(89)
  var cardio = sessions.filter(function (s) {
    return s.type === 'cardio' && s.date >= cutoff
  })
  if (cardio.length === 0) return null

  var totalMins = 0
  var byType = {}

  cardio.forEach(function (s) {
    var act = s.cardioActivity || 'other'
    if (!byType[act]) byType[act] = { count: 0, distKm: 0, hasKm: false }
    byType[act].count++
    totalMins += s.cardioDurationMins || 0
    var km = sessionDistKm(s)
    if (km !== null) { byType[act].distKm += km; byType[act].hasKm = true }
  })

  var types = Object.keys(byType).sort(function (a, b) {
    return byType[b].count - byType[a].count
  })

  var detail = types.map(function (act) {
    var t = byType[act]
    var part = (ACTIVITY_LABEL[act] || capitalise(act)) + ' ' + t.count
    if (t.hasKm) part += ' · ' + fmtDist(t.distKm)
    return part
  }).join('  ·  ')

  // Sum kcal — use stored values if present, otherwise compute dynamically from weight log
  var sortedWeights = (weightEntries || []).slice().sort(function (a, b) {
    return b.date > a.date ? 1 : -1
  })
  var totalKcalMid = 0
  var hasKcal = false
  cardio.forEach(function (s) {
    var low = s.cardioKcalLow, high = s.cardioKcalHigh
    if (!(low && high) && s.cardioDurationMins && s.difficulty) {
      var metRange = getMETRange(s.cardioActivity, s.cardioStrokeType || null, s.difficulty)
      if (metRange) {
        for (var i = 0; i < sortedWeights.length; i++) {
          if (sortedWeights[i].date <= s.date) {
            var kcal = estimateCalories(metRange, sortedWeights[i].weight, s.cardioDurationMins)
            low = kcal.low; high = kcal.high
            break
          }
        }
      }
    }
    if (low && high) {
      totalKcalMid += Math.round((low + high) / 2)
      hasKcal = true
    }
  })

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#ecfdf5' }}>
          <Activity size={16} style={{ color: '#0d9488' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{cardio.length}</span>
            <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>sessions</span>
            <span className="text-[9px] text-[#bbbcc8]" style={barlow}>· last 90 days</span>
            {totalMins > 0 && (
              <span className="text-[10px] font-bold ml-auto" style={{ ...barlow, color: '#0d9488' }}>
                {fmtDuration(totalMins)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#7a8299] mt-0.5 truncate" style={barlow}>{detail}</p>
          {hasKcal && (
            <p className="text-[10px] text-[#bbbcc8] mt-0.5" style={barlow}>~{totalKcalMid.toLocaleString()} kcal burned</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gym stats widget
// ---------------------------------------------------------------------------

var CAT_LABEL = {
  back: 'Back', chest: 'Chest', legs: 'Legs', arms: 'Arms',
  core: 'Core', shoulders: 'Shoulders', mobility: 'Mobility', cardio: 'Cardio',
}

function GymStatsCard({ sessions }) {
  var cutoff = daysAgo(89)
  var gym = sessions.filter(function (s) {
    return s.type === 'gym' && s.date >= cutoff
  })
  if (gym.length === 0) return null

  var totalSets = 0
  var catCount  = {}

  gym.forEach(function (s) {
    (s.exercises || []).forEach(function (ex) {
      if (ex.done === false) return
      totalSets += (ex.sets || []).length
      var cat = ex.category || 'other'
      catCount[cat] = (catCount[cat] || 0) + 1
    })
  })

  var dominantCat = null
  var maxCount = 0
  Object.keys(catCount).forEach(function (cat) {
    if (catCount[cat] > maxCount) { maxCount = catCount[cat]; dominantCat = cat }
  })
  var dominantLabel = dominantCat ? (CAT_LABEL[dominantCat] || capitalise(dominantCat)) : null

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#eef1ff' }}>
          <Dumbbell size={16} style={{ color: '#4f7ef8' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{gym.length}</span>
            <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>sessions</span>
            <span className="text-[9px] text-[#bbbcc8]" style={barlow}>· last 90 days</span>
          </div>
          <p className="text-[11px] text-[#7a8299] mt-0.5" style={barlow}>
            {totalSets > 0 ? totalSets + ' sets' : 'No sets logged'}
            {dominantLabel ? '  ·  ' + dominantLabel + ' heavy' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  var { data }     = useData()
  var { sessions } = useSessions()
  var { profile }  = useProfile()
  var { entries: weightEntries } = useWeightLog()
  var { entries: scheduleEntries } = useSchedule()
  var { goals }    = useGoals()
  var { entries: drinkEntries } = useDrinkLog()
  var navigate     = useNavigate()
  var apiKey = data.groqKey || ''

  // Widget visibility from profile prefs (default all on)
  var prefs = (profile && profile.dashWidgets) || {}
  var showWidget = function (key) { return prefs[key] !== false }

  // Compute discipline stats for level cards (peak + current 90d)
  var recent90 = useMemo(function () {
    return filterSessionsByDays(sessions, 90)
  }, [sessions])

  var boulderPeak = useMemo(function () {
    return calcDisciplineStats(sessions, ['boulder'], V_GRADES_DASH, 'v')
  }, [sessions])

  var boulderCurrent = useMemo(function () {
    return calcDisciplineStats(recent90, ['boulder'], V_GRADES_DASH, 'v')
  }, [recent90])

  var ropePeak = useMemo(function () {
    return calcDisciplineStats(sessions, ['lead', 'toprope'], FRENCH_GRADES_DASH, 'french')
  }, [sessions])

  var ropeCurrent = useMemo(function () {
    return calcDisciplineStats(recent90, ['lead', 'toprope'], FRENCH_GRADES_DASH, 'french')
  }, [recent90])

  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-8 gap-4 pt-4">
      <QuickStats sessions={sessions} />
      <ScheduleNotice scheduleEntries={scheduleEntries} sessions={sessions} />

      {showWidget('trainingLoad') && <TrainingLoad sessions={sessions} />}
      {showWidget('gymStats')     && <GymStatsCard sessions={sessions} />}
      {showWidget('cardioStats')  && <CardioStatsCard sessions={sessions} weightEntries={weightEntries} />}

      {showWidget('boulderLevel') && (
        <LevelCard label="Boulder" accentColor="#c0622a" peakStats={boulderPeak} currentStats={boulderCurrent} gradeSystem="v"
          icon={<Mountain size={14} style={{ color: '#c0622a' }} />}
        />
      )}
      {showWidget('ropeLevel') && (
        <LevelCard label="Rope" accentColor="#4f7ef8" peakStats={ropePeak} currentStats={ropeCurrent} gradeSystem="french"
          icon={<Mountain size={14} style={{ color: '#4f7ef8' }} />}
        />
      )}

      {showWidget('alcoholFree') && <AlcoholFreeCard drinkEntries={drinkEntries} />}
      {showWidget('goals') && <GoalsWidget goals={goals} sessions={sessions} weightLog={weightEntries} onNavigate={function () { navigate('/plan') }} />}

      {showWidget('coachTip') && <CoachTip sessions={sessions} profile={profile} apiKey={apiKey} goals={goals} weightLog={weightEntries} />}
      {showWidget('weight') && <WeightCard profile={profile} weightEntries={weightEntries} goals={goals} />}

      <ActivityCalendar
        sessions={sessions}
        scheduleEntries={scheduleEntries}
        defaultExpanded={!showWidget('trainingLoad') && !showWidget('boulderLevel') && !showWidget('ropeLevel') && !showWidget('coachTip') && !showWidget('weight') && !showWidget('goals') && !showWidget('alcoholFree')}
      />

      {sessions.length === 0 && (
        <div className="px-4 text-center pt-4">
          <p className="text-sm text-[#7a8299]">Start logging sessions to see your stats here.</p>
        </div>
      )}

      <p className="text-[9px] text-[#bbbcc8] text-center pb-2" style={barlow}>
        Customise widgets in Plan → Profile
      </p>
    </div>
  )
}
