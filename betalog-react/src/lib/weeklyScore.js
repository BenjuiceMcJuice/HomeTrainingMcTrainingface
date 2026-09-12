/**
 * BetaLog — the weekly Shameometer score.
 *
 * Pure. No React imports, so it can be tested directly and used from anywhere.
 * Spec: `docs/specs/betalog_shameometer_spec.md`.
 *
 * One number, 0-100, for the current week (Monday-Sunday), from three inputs:
 *
 *   Training   75   what you actually did, by session type
 *   Schedule   25   how many scheduled days you honoured
 *   Alcohol   -25 to +10   a modifier, not a component
 *
 * Training is the backbone rather than the schedule because an adherence-only
 * score reads zero for anyone whose schedule is aspirational, and a gauge with
 * one value is not a gauge. A schedule is an opportunity to score, never a tax
 * for having one — when nothing is scheduled its 25 points fold into training
 * so the dial still reaches 100.
 *
 * Two decisions worth knowing before changing anything here:
 *
 * 1. **Sessions score by type, not by duration or calories.** Those fields are
 *    unreliable — most walks are logged against an untouched 30-minute default,
 *    which makes every duration-derived figure wrong (see logs/2026-09-10.md).
 *    Type is immune to that. Revisit if the logging is ever fixed.
 * 2. **The schedule is scored per *day*, not per routine instance.** A schedule
 *    with three daily routines asks for 21 sessions a week; scoring each one
 *    separately means a good week of prehab banks 3/21 and the component is
 *    unwinnable. Honouring a scheduled day is the behaviour worth measuring.
 */

import { mondayOf, shiftDate, todayStr } from './stats'
// Shared with the adherence scorer so both agree on what "the same routine"
// means. Duplicating the version-suffix regex would let them drift apart.
import { routineFamily as routineFamilyOf } from './adherence'

/** Effort points by session type. Climbing and hangboarding are the point. */
var SESSION_POINTS = { climb: 3, hangboard: 3, gym: 2, cardio: 2 }

/**
 * A gym session scores by how much was in it *(BTL-B10, 2026-09-13)*.
 *
 * A flat 2 made ten minutes of ankle alphabet count the same as an hour of
 * lifting, and it showed: backfilling Ben's log scored **w/c 13 April at 100,
 * EXCELLENT** off five consecutive days of ankle rehab physio. There are two
 * honest readings of that week — doing your physio five days running during an
 * injury genuinely is excellent — but "EXCELLENT" meaning the same thing for
 * rehab as for hard training makes early history not comparable with later.
 *
 * `difficulty` cannot fix it: those sessions were logged as 2, like everything
 * else. So the score reads **session content**, which is the one thing that
 * actually differs — a rehab session is two or three movements, a training
 * session is six or eight.
 *
 * Bands rather than a per-exercise rate, because the difference worth capturing
 * is *rehab vs training vs a full session*, not one extra accessory lift. The
 * middle band keeps the old value, so an ordinary gym session scores exactly
 * what it always did and only the extremes move.
 */
var GYM_POINTS = [
  { minExercises: 6, points: 3 },  // a full session, worth a climb
  { minExercises: 3, points: 2 },  // the ordinary case — unchanged
  { minExercises: 1, points: 1 },  // rehab, a warm-up, one lift and home
]

/** Walks are real but cheap, and there are a lot of them. */
var WALK_POINTS = 1

/**
 * Most a single day can contribute. One enormous Saturday should not carry a
 * week — spreading load is better training, and the score should say so.
 */
var DAY_CAP = 4

/** A good week: a climb, a gym session, a swim and two walks. Or three climbs. */
var WEEKLY_TARGET = 9

var W_TRAIN = 75
var W_SCHED = 25

/** The UK weekly guideline, as already used by `alcoholGuideline()`. */
var UNITS_ALLOWANCE = 14
var PENALTY_PER_UNIT = 1
var PENALTY_CAP = 25
var DRY_BONUS = 10

/**
 * Targets pro-rate to the part of the week elapsed, but never below three days'
 * worth. At one seventh, a single Monday walk reads EXCELLENT; without any
 * pro-rating, every Monday reads VERY POOR. Three is the floor that makes both
 * ends behave.
 */
var MIN_ELAPSED_DAYS = 3

/**
 * The dial's five bands, best first. `min` is inclusive. Names match the face
 * of the gauge; `note` is the line underneath, in the Shameometer voice.
 */
var SCORE_BANDS = [
  // 88, not 85: perfect training (75) plus the dry bonus (10) is 85, so an 85
  // threshold let a week with the schedule completely ignored read EXCELLENT —
  // the schedule could never affect the band at the top, which is most of the
  // point. At 88, top marks need some of it (or no schedule at all, in which
  // case training carries the full 100).
  { min: 88, label: 'EXCELLENT', note: 'Nothing to be ashamed of. Odd, isn\'t it.', color: '#166534', bg: '#ecfdf5' },
  { min: 70, label: 'GOOD',      note: 'A proper week. Do it again.',                color: '#22c55e', bg: '#f0fdf4' },
  { min: 50, label: 'FAIR',      note: 'Middling. You know which bit was missing.',  color: '#c8b520', bg: '#fefce8' },
  { min: 30, label: 'POOR',      note: 'Not much happened here.',                    color: '#f0a63a', bg: '#fffbeb' },
  { min:  0, label: 'VERY POOR', note: 'A week you would rather not discuss.',       color: '#e2603f', bg: '#fff1f2' },
]

/**
 * The band a score falls in.
 * @param {number} score - 0-100
 * @returns {object}
 */
export function scoreBand(score) {
  for (var i = 0; i < SCORE_BANDS.length; i++) {
    if (score >= SCORE_BANDS[i].min) return SCORE_BANDS[i]
  }
  return SCORE_BANDS[SCORE_BANDS.length - 1]
}

/**
 * Effort points for one session.
 * @param {import('./types').Session} session
 * @returns {number}
 */
export function sessionPoints(session) {
  if (!session) return 0
  if (session.type === 'cardio') {
    return session.cardioActivity === 'walk' ? WALK_POINTS : SESSION_POINTS.cardio
  }
  if (session.type === 'gym') {
    var n = (session.exercises || []).length
    // No exercises recorded is missing detail, not a small session — a gym log
    // with an empty list is a logging gap. Scoring it down would be inferring
    // something the log does not say, so it keeps the old flat value.
    if (n === 0) return SESSION_POINTS.gym
    for (var i = 0; i < GYM_POINTS.length; i++) {
      if (n >= GYM_POINTS[i].minExercises) return GYM_POINTS[i].points
    }
    return SESSION_POINTS.gym
  }
  return SESSION_POINTS[session.type] || 0
}

/** The seven ISO dates of the week containing `dateStr`, Monday first. */
export function weekDates(dateStr) {
  var monday = mondayOf(dateStr)
  var out = []
  for (var i = 0; i < 7; i++) out.push(shiftDate(monday, i))
  return out
}

/**
 * Training points for a week, with each day capped.
 * @returns {{ points: number, perDay: Object<string, number>, byType: Object<string, number> }}
 */
export function trainingPoints(sessions, dates) {
  var inWeek = {}
  dates.forEach(function (d) { inWeek[d] = 0 })

  var byType = {}
  ;(sessions || []).forEach(function (s) {
    if (!s || !(s.date in inWeek)) return
    var p = sessionPoints(s)
    inWeek[s.date] += p
    var key = s.type === 'cardio' && s.cardioActivity === 'walk' ? 'walk' : s.type
    byType[key] = (byType[key] || 0) + p
  })

  var total = 0
  var perDay = {}
  dates.forEach(function (d) {
    perDay[d] = Math.min(inWeek[d], DAY_CAP)
    total += perDay[d]
  })

  return { points: total, perDay: perDay, byType: byType }
}

/**
 * Schedule adherence for a week, counted in **days**.
 *
 * A day is due when at least one schedule entry wants a routine that day (and
 * that entry's `remindFrom` has passed). It is done when at least one of the
 * routines due that day was actually logged. Days from `todayIso` onward are
 * excluded: a routine due today is still in play.
 *
 * @param {import('./types').ScheduleEntry[]} scheduleEntries
 * @param {Object<string, Object<string, boolean>>} doneIndex - family -> {date: true}
 * @param {string[]} dates
 * @param {string} todayIso
 * @returns {{ due: number, done: number, dueDates: string[], doneDates: string[] }}
 */
export function scheduleDays(scheduleEntries, doneIndex, dates, todayIso) {
  var dueDates = []
  var doneDates = []

  dates.forEach(function (ds) {
    if (ds >= todayIso) return // today is never missed, and tomorrow hasn't happened
    var dt = new Date(ds + 'T12:00:00')
    var dow = dt.getDay() === 0 ? 7 : dt.getDay()

    var wanted = (scheduleEntries || []).filter(function (e) {
      if (!e || !e.days || e.days.indexOf(dow) === -1) return false
      if (e.remindFrom && ds < e.remindFrom) return false
      return true
    })
    if (!wanted.length) return

    dueDates.push(ds)
    var hit = wanted.some(function (e) {
      var fam = routineFamilyOf(e.routineId)
      return !!(fam && doneIndex[fam] && doneIndex[fam][ds])
    })
    if (hit) doneDates.push(ds)
  })

  return { due: dueDates.length, done: doneDates.length, dueDates: dueDates, doneDates: doneDates }
}

/** Units drunk within the week. */
export function weeklyUnits(drinkLog, dates) {
  var inWeek = {}
  dates.forEach(function (d) { inWeek[d] = true })
  var total = 0
  ;(drinkLog || []).forEach(function (x) {
    if (x && inWeek[x.date]) total += x.units || 0
  })
  return Math.round(total * 10) / 10
}

/**
 * The whole score for one week.
 *
 * @param {{sessions: object[], scheduleEntries: object[], drinkLog: object[]}} data
 * @param {string} [todayIso]   - defaults to today
 * @param {number} [weekOffset] - 0 = this week, -1 = last week, etc.
 * @returns {object}
 */
export function buildWeeklyScore(data, todayIso, weekOffset) {
  var today  = todayIso || todayStr()
  var offset = weekOffset || 0
  var anchor = offset ? shiftDate(mondayOf(today), offset * 7) : today
  var dates  = weekDates(anchor)

  // A past week is complete; the current one is however far in it is. The
  // boundary date also drives the schedule cut-off, so a past week scores every
  // one of its days rather than stopping at "today".
  var isPast   = dates[6] < today
  var boundary = isPast ? shiftDate(dates[6], 1) : today
  var elapsedRaw = isPast ? 7 : Math.min(7, Math.max(1, dates.indexOf(today) + 1))
  var elapsed  = Math.max(MIN_ELAPSED_DAYS, elapsedRaw)
  var fraction = elapsed / 7

  var doneIndex = {}
  ;(data.sessions || []).forEach(function (s) {
    var fam = routineFamilyOf(s && s.routineId)
    if (!fam || !s.date) return
    if (!doneIndex[fam]) doneIndex[fam] = {}
    doneIndex[fam][s.date] = true
  })

  var training = trainingPoints(data.sessions, dates)
  var sched    = scheduleDays(data.scheduleEntries, doneIndex, dates, boundary)
  var units    = weeklyUnits(data.drinkLog, dates)

  // No schedule in play — its weight folds into training rather than being
  // lost, so a hard week with no schedule can still reach 100.
  var hasSchedule = sched.due > 0
  var wTrain = hasSchedule ? W_TRAIN : W_TRAIN + W_SCHED
  var wSched = hasSchedule ? W_SCHED : 0

  var trainTarget = WEEKLY_TARGET * fraction
  var trainPct    = trainTarget > 0 ? Math.min(training.points / trainTarget, 1) : 0
  var trainScore  = trainPct * wTrain

  var schedPct   = hasSchedule ? sched.done / sched.due : 0
  var schedScore = schedPct * wSched

  var allowance = UNITS_ALLOWANCE * fraction
  var over      = Math.max(0, units - allowance)
  // `|| 0` normalises the -0 that falls out of negating a zero penalty, which
  // would otherwise render as "-0" in the breakdown.
  var alcohol   = units === 0 ? DRY_BONUS : -Math.min(over * PENALTY_PER_UNIT, PENALTY_CAP) || 0

  var raw   = trainScore + schedScore + alcohol
  var score = Math.max(0, Math.min(100, Math.round(raw)))

  return {
    score: score,
    band:  scoreBand(score),
    weekStart: dates[0],
    weekEnd:   dates[6],
    dayOfWeek: isPast ? 7 : elapsedRaw,
    complete:  isPast,

    training: {
      points: training.points,
      target: Math.round(trainTarget * 10) / 10,
      earned: Math.round(trainScore),
      max:    wTrain,
      perDay: training.perDay,
      byType: training.byType,
    },
    schedule: {
      due:    sched.due,
      done:   sched.done,
      earned: Math.round(schedScore),
      max:    wSched,
      active: hasSchedule,
      dueDates:  sched.dueDates,
      doneDates: sched.doneDates,
    },
    alcohol: {
      units:     units,
      allowance: Math.round(allowance * 10) / 10,
      delta:     Math.round(alcohol),
      dry:       units === 0,
      capped:    over * PENALTY_PER_UNIT > PENALTY_CAP,
    },
  }
}

/**
 * The single cheapest thing that would move the needle most this week.
 *
 * A low score should always come with a next action, not just a verdict.
 * @param {object} result - from buildWeeklyScore
 * @returns {string | null}
 */
export function biggestGain(result) {
  if (!result) return null
  var gains = []

  if (result.training.points < result.training.target) {
    var wTrain = result.training.max
    var perPoint = wTrain / WEEKLY_TARGET
    gains.push({ n: Math.round(perPoint * 3), text: 'A climbing or hangboard session is worth ~' + Math.round(perPoint * 3) + ' points' })
  }
  if (result.schedule.active && result.schedule.done < result.schedule.due) {
    var perDay = result.schedule.max / result.schedule.due
    gains.push({ n: Math.round(perDay * (result.schedule.due - result.schedule.done)), text: 'Honouring your scheduled days is worth ' + Math.round(perDay * (result.schedule.due - result.schedule.done)) + ' points' })
  }
  if (!result.alcohol.dry) {
    var back = Math.abs(result.alcohol.delta) + DRY_BONUS
    if (back > 0) gains.push({ n: back, text: 'A dry week swings ' + back + ' points' })
  }

  if (!gains.length) return null
  gains.sort(function (a, b) { return b.n - a.n })
  return gains[0].text
}

export {
  SESSION_POINTS, GYM_POINTS, WALK_POINTS, DAY_CAP, WEEKLY_TARGET,
  W_TRAIN, W_SCHED, UNITS_ALLOWANCE, PENALTY_PER_UNIT, PENALTY_CAP, DRY_BONUS,
  MIN_ELAPSED_DAYS, SCORE_BANDS,
}
