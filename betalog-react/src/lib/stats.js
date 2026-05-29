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
  var climbSessions  = sessions.filter(function (s) { return s.type === 'climb' })
  var streak         = calcWeeklyStreak(climbSessions)

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

// ---------------------------------------------------------------------------
// Calorie estimation (MET-based)
// ---------------------------------------------------------------------------

var SPORT_MET_VALUES = {
  'Badminton':                5.5,
  'Basketball (casual)':      6.5,
  'Basketball (competitive)': 8.0,
  'Boxing (bag work)':        6.0,
  'Boxing (sparring)':        9.0,
  'Cricket':                  4.8,
  'Dancing':                  4.8,
  'Football (casual)':        7.0,
  'Football (competitive)':   10.0,
  'Golf (walking)':           4.3,
  'Gymnastics':               3.8,
  'Hiking':                   5.3,
  'Hockey':                   8.0,
  'Kayaking':                 5.0,
  'Martial Arts':             10.0,
  'Netball':                  6.5,
  'Padel':                    6.0,
  'Paddleboarding':           6.0,
  'Rowing':                   7.0,
  'Rugby':                    8.3,
  'Skateboarding':            5.0,
  'Skiing':                   7.0,
  'Snowboarding':             5.3,
  'Squash':                   12.0,
  'Surfing':                  3.0,
  'Table Tennis':             4.0,
  'Tennis (casual)':          7.3,
  'Tennis (competitive)':     8.0,
  'Volleyball':               4.0,
  'Wrestling':                6.0,
  'Yoga (gentle)':            2.5,
  'Yoga (Vinyasa)':           4.0,
}

// Effort band multipliers [low, high] applied to base sport MET
var SPORT_EFFORT_MODS = {
  1: [0.8,  1.0 ],
  2: [0.9,  1.15],
  3: [1.1,  1.35],
  4: [1.3,  1.55],
  5: [1.5,  1.75],
}

var MET_SWIM = {
  breaststroke: { 1: 4.8, 2: 5.5, 3: 6.8 },
  front_crawl:  { 1: 4.5, 2: 6.0, 3: 8.3 },
  backstroke:   { 1: 4.5, 2: 5.5, 3: 7.5 },
  butterfly:    { 1: 7.0, 2: 9.0, 3: 11.0 },
  general:      { 1: 4.5, 2: 5.5, 3: 7.0 },
}

var MET_CARDIO = {
  swim:  { 1: 4.5, 2: 5.5, 3: 7.0 },
  run:   { 1: 7.0, 2: 9.0, 3: 12.0 },
  cycle: { 1: 5.5, 2: 8.0, 3: 12.0 },
  row:   { 1: 4.5, 2: 7.0, 3: 10.0 },
  walk:  { 1: 2.5, 2: 3.5, 3: 4.5 },
}

/**
 * Get MET range {low, high} for a cardio activity.
 * effort 1=Easy, 2=Moderate, 3=Hard, 4-5=Very Hard/Max.
 * @param {string} activity
 * @param {string|null} strokeType - swim only
 * @param {number} effort - 1-5
 * @param {string|null} sportKey - sport name key from SPORT_MET_VALUES (sport activity only)
 * @returns {{ low: number, high: number } | null}
 */
function getMETRange(activity, strokeType, effort, sportKey) {
  if (!activity || !effort) return null

  if (activity === 'sport') {
    if (!sportKey || !SPORT_MET_VALUES[sportKey]) return null
    var base = SPORT_MET_VALUES[sportKey]
    var mods = SPORT_EFFORT_MODS[effort] || SPORT_EFFORT_MODS[3]
    return { low: base * mods[0], high: base * mods[1] }
  }

  var table = (activity === 'swim' && strokeType && MET_SWIM[strokeType])
    ? MET_SWIM[strokeType]
    : MET_CARDIO[activity]
  if (!table) return null

  var low, high
  if (effort === 1) {
    low  = table[1]
    high = table[2] || table[1] * 1.1
  } else if (effort === 2) {
    low  = table[1]
    high = table[2]
  } else {
    // effort 3-5: Hard+ range
    low  = table[2]
    high = table[3] || table[2] * 1.15
  }
  return { low: low, high: high }
}

/**
 * Estimate calorie burn range from MET range, weight and duration.
 * @param {{ low: number, high: number }} metRange
 * @param {number} weightKg
 * @param {number} durationMins
 * @returns {{ low: number, high: number }}
 */
function estimateCalories(metRange, weightKg, durationMins) {
  var hours = durationMins / 60
  return {
    low:  Math.round(metRange.low  * weightKg * hours),
    high: Math.round(metRange.high * weightKg * hours),
  }
}

// ---------------------------------------------------------------------------
// Alcohol-free streak
// ---------------------------------------------------------------------------

/**
 * Calculate consecutive alcohol-free days ending today.
 * @param {import('./types').DrinkEntry[]} drinkLog
 * @returns {{ days: number, weeks: number, months: number }}
 */
function calcAlcoholFreeStreak(drinkLog) {
  var drinkDates = {}
  ;(drinkLog || []).forEach(function (e) { drinkDates[e.date] = true })

  var streak = 0
  var d = new Date()
  while (true) {
    var dateStr = d.toISOString().slice(0, 10)
    if (drinkDates[dateStr]) break
    streak++
    d.setDate(d.getDate() - 1)
    // Safety cap — don't loop forever on empty log
    if (streak > 3650) break
  }

  return {
    days:   streak,
    weeks:  Math.floor(streak / 7),
    months: Math.floor(streak / 30),
  }
}

export {
  V_GRADES, FRENCH_GRADES,
  V_LEVEL, FRENCH_LEVEL, LEVEL_COLOR,
  gradeLevel, gradeColor, filterSessionsByDays,
  calcDisciplineStats, calcConsistentGrade,
  calcWeeklyStreak, calcBestWeekStreak, mondayOf, todayStr,
  buildPublicProfile, calcAlcoholFreeStreak,
  getMETRange, estimateCalories, SPORT_MET_VALUES,
}
