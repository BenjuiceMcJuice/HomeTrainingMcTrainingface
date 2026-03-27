/**
 * BetaLog — Shared stats utilities
 *
 * Pure data functions used by both UI components (Dashboard, ClimbingStats)
 * and storage.js (public profile builder). No React imports — safe to use
 * from any module without circular dependencies.
 */

// ---------------------------------------------------------------------------
// Grade constants
// ---------------------------------------------------------------------------

var V_GRADES      = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']
var FRENCH_GRADES = ['4','5','5+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c']

// ---------------------------------------------------------------------------
// Grade → Level mapping
// ---------------------------------------------------------------------------

var V_LEVEL = {
  V0: 'Beginner', V1: 'Beginner',
  V2: 'Intermediate', V3: 'Intermediate',
  V4: 'Advanced', V5: 'Advanced',
  V6: 'Expert', V7: 'Expert',
  V8: 'Elite', V9: 'Elite',
  V10: 'Pro', V11: 'Pro',
  V12: 'World Class', V13: 'World Class', V14: 'World Class', V15: 'World Class', V16: 'World Class', V17: 'World Class',
}

var FRENCH_LEVEL = {
  '4': 'Beginner', '5': 'Beginner', '5+': 'Beginner',
  '6a': 'Intermediate', '6a+': 'Intermediate', '6b': 'Intermediate', '6b+': 'Intermediate',
  '6c': 'Advanced', '6c+': 'Advanced', '7a': 'Advanced', '7a+': 'Advanced',
  '7b': 'Expert', '7b+': 'Expert', '7c': 'Expert', '7c+': 'Expert',
  '8a': 'Elite', '8a+': 'Elite',
  '8b': 'World Class', '8b+': 'World Class', '8c': 'World Class', '8c+': 'World Class',
  '9a': 'World Class', '9a+': 'World Class', '9b': 'World Class', '9b+': 'World Class', '9c': 'World Class',
}

var LEVEL_COLOR = {
  'Beginner':     { color: '#8892a4', bg: '#f1f2f6' },
  'Intermediate': { color: '#0d9488', bg: '#ecfdf5' },
  'Advanced':     { color: '#3b82f6', bg: '#eff6ff' },
  'Expert':       { color: '#8b5cf6', bg: '#f5f3ff' },
  'Elite':        { color: '#ea580c', bg: '#fff7ed' },
  'Pro':          { color: '#dc2626', bg: '#fef2f2' },
  'World Class':  { color: '#d97706', bg: '#fffbeb' },
}

function gradeLevel(grade, system) {
  return (system === 'v' ? V_LEVEL : FRENCH_LEVEL)[grade] || null
}

/**
 * Get the colour for a grade based on its level tier.
 * @param {string} grade - e.g. 'V6' or '7a'
 * @param {string} system - 'v' or 'french'
 * @returns {string} hex colour string, or default grey
 */
function gradeColor(grade, system) {
  var level = gradeLevel(grade, system)
  if (!level || !LEVEL_COLOR[level]) return '#7a8299'
  return LEVEL_COLOR[level].color
}

/**
 * Filter sessions to the last N days.
 * @param {object[]} sessions
 * @param {number} days
 * @returns {object[]}
 */
function filterSessionsByDays(sessions, days) {
  var cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  var cutoffStr = cutoff.toISOString().slice(0, 10)
  return sessions.filter(function (s) { return s.date >= cutoffStr })
}

// ---------------------------------------------------------------------------
// Climbing stats calculation
// ---------------------------------------------------------------------------

function calcConsistentGrade(gradeMap, gradeOrder, system) {
  var best = null
  gradeOrder.forEach(function (g) {
    var d = gradeMap[g]
    if (!d || d.attempts < 3) return
    if (d.sends / d.attempts >= 0.4) {
      best = { grade: g, level: gradeLevel(g, system), system: system, idx: gradeOrder.indexOf(g) }
    }
  })
  return best
}

/**
 * Build stats for a single discipline group.
 * @param {object[]} sessions
 * @param {string[]} disciplines - e.g. ['boulder'] or ['lead','toprope']
 * @param {string[]} gradeOrder
 * @param {string} system - 'v' or 'french'
 */
function calcDisciplineStats(sessions, disciplines, gradeOrder, system) {
  var gradeMap = {}
  var total = 0, sends = 0, flashes = 0
  var highestSend = null, highestFlash = null

  sessions.forEach(function (s) {
    if (s.type !== 'climb') return
    ;(s.climbs || []).forEach(function (c) {
      if (disciplines.indexOf(c.discipline) === -1) return
      total++
      var g = c.grade
      if (!gradeMap[g]) gradeMap[g] = { attempts: 0, sends: 0, flashes: 0 }
      gradeMap[g].attempts++

      if (c.outcome === 'flashed') {
        gradeMap[g].sends++; gradeMap[g].flashes++; sends++; flashes++
      } else if (c.outcome === 'sent') {
        gradeMap[g].sends++; sends++
      }

      if (c.outcome === 'sent' || c.outcome === 'flashed') {
        var idx = gradeOrder.indexOf(g)
        if (highestSend === null || idx > highestSend.idx) highestSend = { grade: g, idx: idx }
        if (c.outcome === 'flashed') {
          if (highestFlash === null || idx > highestFlash.idx) highestFlash = { grade: g, idx: idx }
        }
      }
    })
  })

  var consistent = calcConsistentGrade(gradeMap, gradeOrder, system)

  return {
    gradeMap: gradeMap,
    total: total,
    sends: sends,
    flashes: flashes,
    sendRate: total > 0 ? Math.round(sends / total * 100) : 0,
    flashRate: total > 0 ? Math.round(flashes / total * 100) : 0,
    highestSend: highestSend,
    highestFlash: highestFlash,
    consistent: consistent,
    hasData: Object.keys(gradeMap).length > 0,
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Returns the Monday (ISO date) of the week containing the given date string.
 */
function mondayOf(dateStr) {
  var d = new Date(dateStr + 'T12:00:00')
  var day = d.getDay()
  var diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Streak calculation
// ---------------------------------------------------------------------------

function calcBestWeekStreak(weekSet) {
  var mondays = Object.keys(weekSet).sort()
  if (!mondays.length) return 0

  var best = 1
  var run  = 1
  for (var i = 1; i < mondays.length; i++) {
    var prev = new Date(mondays[i - 1] + 'T12:00:00')
    prev.setDate(prev.getDate() + 7)
    if (prev.toISOString().slice(0, 10) === mondays[i]) {
      run++
      if (run > best) best = run
    } else {
      run = 1
    }
  }
  return best
}

/**
 * Weekly streak: consecutive weeks (Mon-Sun) with at least one session.
 * Returns { current, best }.
 */
function calcWeeklyStreak(sessions) {
  if (!sessions.length) return { current: 0, best: 0 }

  var weekSet = {}
  sessions.forEach(function (s) {
    weekSet[mondayOf(s.date)] = true
  })

  var thisMon = mondayOf(todayStr())
  var current = 0
  var check   = thisMon

  if (!weekSet[check]) {
    var d = new Date(check + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    check = d.toISOString().slice(0, 10)
    if (!weekSet[check]) return { current: 0, best: calcBestWeekStreak(weekSet) }
  }

  while (weekSet[check]) {
    current++
    var prev = new Date(check + 'T12:00:00')
    prev.setDate(prev.getDate() - 7)
    check = prev.toISOString().slice(0, 10)
  }

  return { current: current, best: Math.max(current, calcBestWeekStreak(weekSet)) }
}

// ---------------------------------------------------------------------------
// Public profile builder
// ---------------------------------------------------------------------------

/**
 * Build the public profile data object for Firestore.
 * @param {object[]} sessions - all user sessions
 * @param {object|null} profile - athleteProfile
 * @returns {object} PublicProfile shape
 */
function buildPublicProfile(sessions, profile) {
  var boulderPeak    = calcDisciplineStats(sessions, ['boulder'], V_GRADES, 'v')
  var ropePeak       = calcDisciplineStats(sessions, ['lead', 'toprope'], FRENCH_GRADES, 'french')
  var recent90       = filterSessionsByDays(sessions, 90)
  var boulderCurrent = calcDisciplineStats(recent90, ['boulder'], V_GRADES, 'v')
  var ropeCurrent    = calcDisciplineStats(recent90, ['lead', 'toprope'], FRENCH_GRADES, 'french')
  var streak         = calcWeeklyStreak(sessions)

  // Last 5 sessions, summary only
  var sorted = sessions.slice().sort(function (a, b) {
    return a.date > b.date ? -1 : a.date < b.date ? 1 : 0
  })
  var recent = sorted.slice(0, 5).map(function (s) {
    var headline = ''
    if (s.type === 'climb') {
      var count = (s.climbs || []).length
      var sendCount = (s.climbs || []).filter(function (c) {
        return c.outcome === 'sent' || c.outcome === 'flashed'
      }).length
      headline = count + ' climb' + (count !== 1 ? 's' : '') + ', ' + sendCount + ' sent'
    } else if (s.type === 'gym') {
      var exCount = (s.exercises || []).length
      headline = exCount + ' exercise' + (exCount !== 1 ? 's' : '')
    } else if (s.type === 'hangboard') {
      var gripCount = (s.hangGrips || []).length
      headline = gripCount + ' grip' + (gripCount !== 1 ? 's' : '')
    }
    return {
      date: s.date,
      type: s.type,
      discipline: s.discipline || null,
      headline: headline,
    }
  })

  function levelSummary(stats) {
    if (!stats.hasData) return null
    return {
      consistent: stats.consistent ? stats.consistent.grade : null,
      project:    stats.highestSend ? stats.highestSend.grade : null,
      flash:      stats.highestFlash ? stats.highestFlash.grade : null,
      level:      stats.consistent ? stats.consistent.level : null,
    }
  }

  return {
    displayName: (profile && profile.name) || 'Climber',
    boulderLevel: levelSummary(boulderPeak),
    ropeLevel:    levelSummary(ropePeak),
    boulderCurrent: levelSummary(boulderCurrent),
    ropeCurrent:    levelSummary(ropeCurrent),
    streak:       streak.current,
    recentSessions: recent,
    updatedAt:    new Date().toISOString(),
  }
}

export {
  V_GRADES, FRENCH_GRADES,
  V_LEVEL, FRENCH_LEVEL, LEVEL_COLOR,
  gradeLevel, gradeColor, filterSessionsByDays,
  calcDisciplineStats, calcConsistentGrade,
  calcWeeklyStreak, calcBestWeekStreak, mondayOf, todayStr,
  buildPublicProfile,
}
