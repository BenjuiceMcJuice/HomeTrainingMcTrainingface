/**
 * BetaLog — Competitions: the model and the maths.
 *
 * Pure. No React, no Storage, no Firebase — `storage.js` and the hook import
 * this, never the other way round (the same rule as `stats.js`).
 *
 * A competition is one document a gym (or anyone) creates: a date, a venue,
 * a scoresheet of numbered problems, and the scoring. An entrant's card —
 * how many goes, a zone, a top, per problem — is a climb session in their
 * own log with a `comp` block, mirrored into the comp's `entries` for the
 * leaderboard. Scores are never stored anywhere; every number on a board is
 * computed here from the raw cards, so there is nothing to forge but one's
 * own goes.
 *
 * @see docs/specs/betalog_competitions_spec.md
 */

import { V_GRADES, FRENCH_GRADES } from './stats'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bumped when the comp document's shape changes; an older build refuses newer. */
export var COMP_SCHEMA_VERSION = 1

export var CODE_PREFIX = 'CP-'
/** No 0/O/1/I — the same alphabet as friend codes, for the same reason. */
export var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export var CODE_LENGTH = 5

export var MAX_ATTEMPTS_LIMIT = 20
export var STATUSES = ['draft', 'open', 'live', 'judging', 'closed']

/** @type {import('./types').CompScoring} */
export var DEFAULT_SCORING = {
  maxAttempts: 5,
  topPercentByAttempt: [100, 80, 60, 50, 50],
  zonePercent: 25,
  bestN: null,
}

/** What the generator offers first: the four-circuit thirty-problem sheet. */
/** A new comp starts with this many problems on the sheet (Ben, 2026-09-27). */
export var DEFAULT_PROBLEM_COUNT = 10

export var DEFAULT_CIRCUITS = [
  { colour: 'green', points: 10, from: 1, to: 3 },
  { colour: 'blue',  points: 20, from: 4, to: 6 },
  { colour: 'red',   points: 30, from: 7, to: 8 },
  { colour: 'black', points: 50, from: 9, to: 10 },
]

export var DEFAULT_CATEGORIES = ['Open']

/**
 * The comp types. A rope comp uses the same goes / zone / top card (zone a
 * marked hold, top the chains); only the grades and the logged discipline
 * differ. A comp with no `discipline` predates the field and is a boulder comp.
 */
export var COMP_TYPES = [
  { value: 'boulder', label: 'Boulder', gradeSystem: 'v',      grades: V_GRADES },
  { value: 'toprope', label: 'Rope',    gradeSystem: 'french', grades: FRENCH_GRADES },
]

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

/**
 * A join code: `CP-` + five characters from the unambiguous alphabet.
 * @param {function(): number} [random] - returns [0, 1); injectable for tests
 */
export function makeCode(random) {
  var rnd = random || Math.random
  var s = ''
  for (var i = 0; i < CODE_LENGTH; i++) {
    s += CODE_ALPHABET.charAt(Math.floor(rnd() * CODE_ALPHABET.length))
  }
  return CODE_PREFIX + s
}

/**
 * What a typed code means: uppercased, spaces dropped, the prefix added if
 * left off. Returns null when it cannot be a code at all.
 * @param {string} input
 * @returns {string|null}
 */
export function normaliseCode(input) {
  if (typeof input !== 'string') return null
  var s = input.replace(/\s+/g, '').toUpperCase()
  if (s.indexOf(CODE_PREFIX) !== 0) s = CODE_PREFIX + s
  return isCompCode(s) ? s : null
}

/** @param {string} s */
export function isCompCode(s) {
  if (typeof s !== 'string' || s.indexOf(CODE_PREFIX) !== 0) return false
  var body = s.slice(CODE_PREFIX.length)
  if (body.length !== CODE_LENGTH) return false
  for (var i = 0; i < body.length; i++) {
    if (CODE_ALPHABET.indexOf(body.charAt(i)) === -1) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// The comp document
// ---------------------------------------------------------------------------

/**
 * A new draft. `fields` may carry any of the editable fields; the rest are
 * defaults. The code is null until *Open entries* assigns one.
 *
 * @param {object} fields
 * @param {string} uid - the creator, who becomes the first organiser
 * @param {string} organiserName
 * @param {string} nowIso
 * @returns {import('./types').Competition}
 */
export function newComp(fields, uid, organiserName, nowIso) {
  var f = fields || {}
  var names = {}
  names[uid] = organiserName || 'Organiser'
  return {
    schemaVersion: COMP_SCHEMA_VERSION,
    code: f.code || null,
    name: f.name || '',
    discipline: compType(f).value,
    date: f.date || nowIso.slice(0, 10),
    startAt: f.startAt || null,
    endAt: f.endAt || null,
    autoClose: f.autoClose !== false,
    venue: f.venue || { name: '', lat: null, lng: null },
    notes: f.notes || '',
    status: 'draft',
    scoring: f.scoring ? Object.assign({}, DEFAULT_SCORING, f.scoring) : Object.assign({}, DEFAULT_SCORING),
    categories: f.categories ? f.categories.slice() : DEFAULT_CATEGORIES.slice(),
    boardVisibleToEntrants: f.boardVisibleToEntrants !== false,
    problems: f.problems ? f.problems.slice() : generateProblems(DEFAULT_PROBLEM_COUNT, DEFAULT_CIRCUITS),
    organisers: [uid],
    organiserNames: names,
    gymId: null,
    centreId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    closedAt: null,
  }
}

/**
 * The fields to start a new comp from an old one — *Copy to a new comp*.
 * Everything that describes the format carries over (type, times, venue,
 * notes, scoring, categories, the scoresheet's numbers, colours, points and
 * show/hide); the date is today, and nothing about the old comp's run does
 * (code, status, organisers, entries). Grades start blank: a new comp is a
 * new set, and the setter grades it (Ben, 2026-09-27). Feed it to `newComp`.
 * @param {import('./types').Competition} comp
 * @param {string} nowIso
 * @returns {object}
 */
export function copyCompFields(comp, nowIso) {
  return {
    name: comp.name || '',
    discipline: compType(comp).value,
    date: nowIso.slice(0, 10),
    startAt: comp.startAt || null,
    endAt: comp.endAt || null,
    autoClose: comp.autoClose !== false,
    venue: Object.assign({ name: '', lat: null, lng: null }, comp.venue || {}),
    notes: comp.notes || '',
    scoring: Object.assign({}, comp.scoring || DEFAULT_SCORING, {
      topPercentByAttempt: ((comp.scoring || DEFAULT_SCORING).topPercentByAttempt || []).slice(),
    }),
    categories: (comp.categories || DEFAULT_CATEGORIES).slice(),
    boardVisibleToEntrants: comp.boardVisibleToEntrants !== false,
    problems: (comp.problems || []).map(function (p) { return Object.assign({}, p, { grade: null, gradeSystem: null }) }),
  }
}

/**
 * The generator: `count` problems numbered from 1, colour and points from
 * the circuits table (`{colour, points, from, to}`, inclusive number ranges).
 * A number no circuit covers gets no colour and the last circuit's points,
 * or 10 if there are none. Grades null, `showGrade` false — a grade is hidden
 * from entrants until the close unless the setter shows it (Ben, 2026-09-27).
 *
 * @param {number} count
 * @param {{colour: string, points: number, from: number, to: number}[]} circuits
 * @returns {import('./types').CompProblem[]}
 */
export function generateProblems(count, circuits) {
  var list = circuits || DEFAULT_CIRCUITS
  var out = []
  var n = Math.max(0, Math.floor(count || 0))
  for (var i = 1; i <= n; i++) {
    var circuit = null
    for (var c = 0; c < list.length; c++) {
      if (i >= list[c].from && i <= list[c].to) { circuit = list[c]; break }
    }
    var fallbackPoints = list.length ? list[list.length - 1].points : 10
    out.push({
      id: 'p' + i,
      number: i,
      colour: circuit ? circuit.colour : null,
      points: circuit ? circuit.points : fallbackPoints,
      grade: null,
      gradeSystem: null,
      showGrade: false,
      label: null,
    })
  }
  return out
}

/**
 * Resize the per-go percentage table to a new `maxAttempts`: truncate, or
 * pad with the last value (the "then 50%" case).
 * @param {number[]} table
 * @param {number} maxAttempts
 */
export function resizeTopTable(table, maxAttempts) {
  var n = Math.max(1, Math.min(MAX_ATTEMPTS_LIMIT, Math.floor(maxAttempts || 1)))
  var src = (table && table.length) ? table : DEFAULT_SCORING.topPercentByAttempt
  var out = []
  for (var i = 0; i < n; i++) out.push(i < src.length ? src[i] : src[src.length - 1])
  return out
}

// ---------------------------------------------------------------------------
// The clock and the stages (BTL-B86, BTL-B88 — spec §7d)
// ---------------------------------------------------------------------------

function wallClockMs(date, hhmm) {
  if (!date || !hhmm || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(hhmm)) return null
  var t = new Date(date + 'T' + hhmm + ':00').getTime()
  return isNaN(t) ? null : t
}

/** The day scoring ends — `endDate` when a reopen moved it past the comp's date. */
export function compEndDate(comp) {
  return (comp && (comp.endDate || comp.date)) || null
}

/**
 * When scoring ends, as epoch ms in the device's own time zone — the comp's
 * date and end time are the venue's wall clock, and everyone at the venue
 * shares it. Null when there is no end time, or the organiser has turned the
 * automatic end off (`autoClose: false`; absent means on).
 * @param {import('./types').Competition} comp
 * @returns {number|null}
 */
export function compEndMs(comp) {
  if (!comp || comp.autoClose === false) return null
  return wallClockMs(compEndDate(comp), comp.endAt)
}

/** When scoring starts by itself, as epoch ms; null with no start time (the organiser starts it). */
export function compStartMs(comp) {
  return comp ? wallClockMs(comp.date, comp.startAt) : null
}

/**
 * The clock as stored on the comp document, so the rules can open and lock
 * cards on it: `startMs`, `endMs` (null when there is none). Written by the
 * organiser's device on every save.
 */
export function compClockFields(comp) {
  return { startMs: compStartMs(comp), endMs: compEndMs(comp) }
}

/**
 * The comp's stage now: `draft`, `open` (pending start), `live` (running),
 * `judging` (finished, being checked) or `closed` (final). The stored status
 * moves on only when an organiser's device sees the comp, so the clock is
 * read too: an `open` comp past its start is running, and an `open` or
 * `live` comp past its automatic end is judging.
 * @param {import('./types').Competition} comp
 * @param {number} nowMs
 * @returns {string|null}
 */
export function compPhase(comp, nowMs) {
  if (!comp) return null
  var s = comp.status
  if (s !== 'open' && s !== 'live') return s
  var start = compStartMs(comp)
  if (s === 'open' && (start === null || nowMs < start)) return 'open'
  var end = compEndMs(comp)
  if (end !== null && nowMs >= end) return 'judging'
  return 'live'
}

/** True once a comp that ends automatically is past its end, or has been ended. */
export function scoringEnded(comp, nowMs) {
  var p = compPhase(comp, nowMs)
  return p === 'judging' || p === 'closed'
}

/**
 * The status an organiser's device should write so the stored status catches
 * up with the clock — `live` after the start, `judging` after the end — or
 * null when it already matches. Never moves a comp back, and never closes one.
 */
export function catchUpStatus(comp, nowMs) {
  var p = compPhase(comp, nowMs)
  if (!comp || p === comp.status) return null
  return p === 'live' || p === 'judging' ? p : null
}

/**
 * What an organiser may change about the times at each stage (spec §7d):
 * anything before the start; only the end while running, never to before
 * now; nothing once scoring has ended — reopening goes through Manage.
 * @param {import('./types').Competition} before - as stored
 * @param {import('./types').Competition} after - as edited
 * @param {number} nowMs
 * @returns {string[]}
 */
export function validateTimeChange(before, after, nowMs) {
  var p = compPhase(before, nowMs)
  var errors = []
  if (p === 'live') {
    if (after.date !== before.date || (after.startAt || null) !== (before.startAt || null)) {
      errors.push('The date and start time are fixed once scoring has started')
    }
    var end = compEndMs(after)
    if (end !== null && end <= nowMs && end !== compEndMs(before)) errors.push('The end must be later than now')
  } else if (p === 'judging' || p === 'closed') {
    var same = after.date === before.date
      && (after.startAt || null) === (before.startAt || null)
      && (after.endAt || null) === (before.endAt || null)
      && (after.endDate || null) === (before.endDate || null)
      && (after.autoClose !== false) === (before.autoClose !== false)
    if (!same) errors.push(p === 'judging' ? 'Scoring has ended, so the times are fixed — reopen scoring from Manage to set a new end' : 'The comp is final, so the times are fixed')
  }
  return errors
}

/** "YYYY-MM-DDTHH:MM" for a datetime-local input, on the device clock. */
export function toLocalInput(ms) {
  var d = new Date(ms)
  function pad(n) { return (n < 10 ? '0' : '') + n }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/**
 * The fields for a new end picked on a datetime-local input: `endAt`, and
 * `endDate` only when it is not the comp's own date. Null if the value is
 * not a date and time.
 */
export function endFieldsFromInput(comp, value) {
  var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value || '')
  if (!m) return null
  return { endDate: m[1] === comp.date ? null : m[1], endAt: m[2], autoClose: true }
}

/** "2h 14m", "14m", "under a minute" — the time left to an end. */
export function fmtTimeLeft(ms) {
  if (ms <= 0) return '0m'
  var mins = Math.floor(ms / 60000)
  if (mins < 1) return 'under a minute'
  var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60
  if (d) return d + 'd ' + h + 'h'
  return h ? h + 'h ' + m + 'm' : m + 'm'
}

/** The comp's entry in COMP_TYPES — boulder when the comp has none. */
export function compType(comp) {
  var d = comp && comp.discipline
  return COMP_TYPES.filter(function (t) { return t.value === d })[0] || COMP_TYPES[0]
}

/** 'v' for a V-grade, otherwise 'french'. Read only when a problem carries no gradeSystem. */
export function gradeSystemFor(grade) {
  if (!grade) return null
  return /^V\d/i.test(String(grade).trim()) ? 'v' : 'french'
}

function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n }
function isPct(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 100 }

/**
 * Everything the editor refuses. Empty means the comp can be saved.
 * @param {import('./types').Competition} comp
 * @returns {string[]}
 */
export function validateComp(comp) {
  var errors = []
  if (!comp) return ['No competition']
  if (!comp.name || !String(comp.name).trim()) errors.push('Give the competition a name')
  if (!comp.date || !/^\d{4}-\d{2}-\d{2}$/.test(comp.date)) errors.push('Pick a date')
  if (!comp.venue || !comp.venue.name || !String(comp.venue.name).trim()) errors.push('Say where it is')
  if (comp.startAt && comp.endAt && !comp.endDate && comp.endAt <= comp.startAt) errors.push('The end time must be after the start time')

  var s = comp.scoring || {}
  if (!isInt(s.maxAttempts) || s.maxAttempts < 1 || s.maxAttempts > MAX_ATTEMPTS_LIMIT) {
    errors.push('Max goes must be a whole number from 1 to ' + MAX_ATTEMPTS_LIMIT)
  }
  var table = s.topPercentByAttempt
  if (!Array.isArray(table) || table.length !== s.maxAttempts) {
    errors.push('The top table needs one percentage per go')
  } else {
    for (var i = 0; i < table.length; i++) {
      if (!isPct(table[i])) { errors.push('Top percentages must be 0–100'); break }
      if (i > 0 && table[i] > table[i - 1]) { errors.push('A top on a later go cannot be worth more than on an earlier one'); break }
    }
  }
  if (!isPct(s.zonePercent)) errors.push('Zone percentage must be 0–100')
  if (s.bestN !== null && s.bestN !== undefined) {
    if (!isInt(s.bestN) || s.bestN < 1 || s.bestN > (comp.problems || []).length) {
      errors.push('Best N must be between 1 and the number of problems')
    }
  }

  var cats = comp.categories || []
  if (!cats.length) errors.push('At least one category')
  var seenCat = {}
  cats.forEach(function (c) {
    var k = String(c || '').trim().toLowerCase()
    if (!k) errors.push('A category has no name')
    else if (seenCat[k]) errors.push('Category "' + c + '" appears twice')
    seenCat[k] = true
  })

  var problems = comp.problems || []
  var type = compType(comp)
  if (!problems.length) errors.push('Add at least one problem')
  var seenId = {}, seenNum = {}
  problems.forEach(function (p) {
    if (!p.id || seenId[p.id]) errors.push('Problem ids must be unique')
    seenId[p.id] = true
    if (!isInt(p.number) || p.number < 1) errors.push('Problem numbers must be whole numbers from 1')
    else if (seenNum[p.number]) errors.push('Problem ' + p.number + ' appears twice')
    seenNum[p.number] = true
    if (typeof p.points !== 'number' || !isFinite(p.points) || p.points <= 0) errors.push('Problem ' + p.number + ' needs points above 0')
    if (p.grade && !p.gradeSystem) errors.push('Problem ' + p.number + ' has a grade with no grade system')
    else if (p.grade && type.grades.indexOf(p.grade) === -1) errors.push('Problem ' + p.number + ': ' + p.grade + ' is not a ' + type.label.toLowerCase() + ' grade')
  })
  // Every problem is graded, so every problem tried is a climb in the log (BTL-B79).
  var ungraded = problems.filter(function (p) { return !p.grade }).map(function (p) { return p.number })
  ungraded.sort(function (a, b) { return a - b })
  if (ungraded.length) errors.push('Grade every problem — ' + (ungraded.length === 1 ? 'problem ' + ungraded[0] + ' has' : 'problems ' + ungraded.join(', ') + ' have') + ' no grade')

  return errors
}

// ---------------------------------------------------------------------------
// Hidden grades
// ---------------------------------------------------------------------------

/**
 * What goes on the comp document and what goes in the organiser-only
 * `private/grades` document. A hidden grade is nulled on the public copy so
 * it never reaches an entrant's phone.
 *
 * @param {import('./types').CompProblem[]} problems - as edited, grades present
 * @returns {{ problems: import('./types').CompProblem[], grades: Object<string, {grade: string, gradeSystem: string}> }}
 */
export function splitHiddenGrades(problems) {
  var grades = {}
  var pub = (problems || []).map(function (p) {
    if (p.showGrade !== false || !p.grade) return Object.assign({}, p)
    grades[p.id] = { grade: p.grade, gradeSystem: p.gradeSystem || gradeSystemFor(p.grade) }
    return Object.assign({}, p, { grade: null, gradeSystem: null })
  })
  return { problems: pub, grades: grades }
}

/**
 * The reverse: the organiser's editor and the Close step put the private
 * grades back. `showGrade` is left as it was — after the close it no longer
 * hides anything, but it records what the setter chose.
 * @param {import('./types').CompProblem[]} problems
 * @param {Object<string, {grade: string, gradeSystem: string}>} grades
 */
export function revealGrades(problems, grades) {
  var g = grades || {}
  return (problems || []).map(function (p) {
    if (!g[p.id]) return Object.assign({}, p)
    return Object.assign({}, p, { grade: g[p.id].grade, gradeSystem: g[p.id].gradeSystem || gradeSystemFor(g[p.id].grade) })
  })
}

// ---------------------------------------------------------------------------
// The card — one ProblemResult per problem, through one reducer
// ---------------------------------------------------------------------------

/** @returns {import('./types').ProblemResult} */
export function emptyResult() {
  return { attempts: 0, zone: false, zoneAttempt: null, top: false, topAttempt: null, at: null }
}

/**
 * Force the invariants on a result that came from anywhere else (another
 * device, an older build, a hand-edited document):
 *   0 ≤ attempts ≤ maxAttempts · top ⇒ zone · zoneAttempt ≤ topAttempt ≤ attempts
 * @param {object} r
 * @param {import('./types').CompScoring} scoring
 * @returns {import('./types').ProblemResult}
 */
export function normaliseResult(r, scoring) {
  var max = (scoring && scoring.maxAttempts) || DEFAULT_SCORING.maxAttempts
  var out = emptyResult()
  if (!r || typeof r !== 'object') return out
  var attempts = isInt(r.attempts) ? r.attempts : 0
  out.attempts = Math.max(0, Math.min(max, attempts))
  out.at = typeof r.at === 'string' ? r.at : null

  if (r.top && isInt(r.topAttempt) && r.topAttempt >= 1 && r.topAttempt <= out.attempts) {
    out.top = true
    out.topAttempt = r.topAttempt
  }
  if (r.zone && isInt(r.zoneAttempt) && r.zoneAttempt >= 1 && r.zoneAttempt <= out.attempts) {
    out.zone = true
    out.zoneAttempt = r.zoneAttempt
  }
  // A top implies a zone, on the same go at the latest.
  if (out.top && (!out.zone || out.zoneAttempt > out.topAttempt)) {
    out.zone = true
    out.zoneAttempt = out.topAttempt
  }
  return out
}

/**
 * The reducer behind the three controls. Returns a new card; the old one is
 * not touched. Unknown actions and unknown problems return the card as is.
 *
 * Actions: `{type: 'inc'}`, `{type: 'dec'}`, `{type: 'zone', value: bool}`,
 * `{type: 'top', value: bool}`, `{type: 'reset'}` — each with `problemId`.
 *
 * @param {Object<string, import('./types').ProblemResult>} card
 * @param {import('./types').CompScoring} scoring
 * @param {{type: string, problemId: string, value?: boolean}} action
 * @param {string} nowIso
 */
export function applyCardAction(card, scoring, action, nowIso) {
  if (!action || !action.problemId) return card
  var max = (scoring && scoring.maxAttempts) || DEFAULT_SCORING.maxAttempts
  var cur = normaliseResult((card || {})[action.problemId], scoring)
  var r = Object.assign({}, cur)

  switch (action.type) {
    case 'inc':
      if (r.attempts >= max) return card
      r.attempts += 1
      break
    case 'dec':
      if (r.attempts <= 0) return card
      r.attempts -= 1
      if (r.top && r.topAttempt > r.attempts) { r.top = false; r.topAttempt = null }
      if (r.zone && r.zoneAttempt > r.attempts) { r.zone = false; r.zoneAttempt = null }
      break
    case 'zone':
      if (action.value) {
        if (r.zone) return card
        if (r.attempts === 0) r.attempts = 1
        r.zone = true
        r.zoneAttempt = r.attempts
      } else {
        if (!r.zone) return card
        r.zone = false; r.zoneAttempt = null
        // No zone means no top either — a top is a zone and then some.
        r.top = false; r.topAttempt = null
      }
      break
    case 'top':
      if (action.value) {
        if (r.top) return card
        if (r.attempts === 0) r.attempts = 1
        r.top = true
        r.topAttempt = r.attempts
        if (!r.zone) { r.zone = true; r.zoneAttempt = r.attempts }
      } else {
        if (!r.top) return card
        r.top = false; r.topAttempt = null
      }
      break
    case 'reset':
      r = emptyResult()
      break
    default:
      return card
  }
  r.at = nowIso || null
  var next = Object.assign({}, card)
  next[action.problemId] = r
  return next
}

/**
 * An organiser's void: the problem goes back to no goes. The `before` is
 * kept by the caller in `voids[]`; this only produces the new card.
 */
export function applyVoid(card, problemId, nowIso) {
  return applyCardAction(card, null, { type: 'reset', problemId: problemId }, nowIso)
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * One problem's score: a top earns the problem's points at the percentage
 * for the go it came on; a zone without a top earns the zone percentage;
 * anything else earns nothing.
 * @param {import('./types').CompScoring} scoring
 * @param {import('./types').CompProblem} problem
 * @param {import('./types').ProblemResult} result
 * @returns {number}
 */
export function scoreProblem(scoring, problem, result) {
  if (!problem || !result) return 0
  var s = scoring || DEFAULT_SCORING
  var r = normaliseResult(result, s)
  var pts = typeof problem.points === 'number' ? problem.points : 0
  if (r.top) {
    var table = s.topPercentByAttempt || DEFAULT_SCORING.topPercentByAttempt
    var idx = Math.min(r.topAttempt, table.length) - 1
    var pct = table[idx]
    if (typeof pct !== 'number') pct = table[table.length - 1] || 0
    return pts * pct / 100
  }
  if (r.zone) return pts * (typeof s.zonePercent === 'number' ? s.zonePercent : 0) / 100
  return 0
}

/**
 * A whole card. `attempts` is the total goes over every problem — the last
 * tiebreak — and `flashes` is tops on go 1. With `bestN` set, only the N
 * highest problem scores are summed; `counted` names them.
 *
 * @param {import('./types').CompScoring} scoring
 * @param {import('./types').CompProblem[]} problems
 * @param {Object<string, import('./types').ProblemResult>} card
 * @returns {{score: number, tops: number, zones: number, attempts: number, flashes: number, counted: string[], perProblem: Object<string, number>}}
 */
export function scoreCard(scoring, problems, card) {
  var s = scoring || DEFAULT_SCORING
  var c = card || {}
  var per = {}
  var rows = []
  var tops = 0, zones = 0, attempts = 0, flashes = 0
  ;(problems || []).forEach(function (p) {
    var r = normaliseResult(c[p.id], s)
    var sc = scoreProblem(s, p, r)
    per[p.id] = sc
    attempts += r.attempts
    if (r.top) { tops++; if (r.topAttempt === 1) flashes++ }
    else if (r.zone) zones++
    if (sc > 0) rows.push({ id: p.id, score: sc })
  })
  rows.sort(function (a, b) { return b.score - a.score })
  var counted = (s.bestN && s.bestN > 0) ? rows.slice(0, s.bestN) : rows
  var score = 0
  counted.forEach(function (r) { score += r.score })
  return {
    score: round1(score),
    tops: tops,
    zones: zones,
    attempts: attempts,
    flashes: flashes,
    counted: counted.map(function (r) { return r.id }),
    perProblem: per,
  }
}

function round1(n) { return Math.round(n * 10) / 10 }

/** Integers stay integers; anything else shows one decimal place. */
export function formatScore(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0'
  return Math.floor(n) === n ? String(n) : n.toFixed(1)
}

/**
 * Score descending, then tops, then zones, then fewer goes. Equal on all
 * four shares a rank and the next rank skips (1, 2, 2, 4).
 */
function compareRows(a, b) {
  if (b.score !== a.score) return b.score - a.score
  if (b.tops !== a.tops) return b.tops - a.tops
  if (b.zones !== a.zones) return b.zones - a.zones
  if (a.attempts !== b.attempts) return a.attempts - b.attempts
  return 0
}

/**
 * The leaderboard. `entries` are the comp's entry documents (each with
 * `uid`, `displayName`, `category`, `card`); pass a `category` for one
 * board, or nothing for Overall.
 *
 * @param {import('./types').Competition} comp
 * @param {object[]} entries
 * @param {string} [category]
 * @returns {{uid: string, displayName: string, category: string, score: number, tops: number, zones: number, attempts: number, flashes: number, rank: number}[]}
 */
export function rankEntries(comp, entries, category) {
  var problems = (comp && comp.problems) || []
  var scoring = (comp && comp.scoring) || DEFAULT_SCORING
  var rows = (entries || []).filter(function (e) {
    return e && (!category || e.category === category)
  }).map(function (e) {
    var sc = scoreCard(scoring, problems, e.card)
    return {
      uid: e.uid,
      displayName: e.displayName || 'Climber',
      category: e.category || '',
      score: sc.score,
      tops: sc.tops,
      zones: sc.zones,
      attempts: sc.attempts,
      flashes: sc.flashes,
      rank: 0,
    }
  })
  rows.sort(function (a, b) {
    var c = compareRows(a, b)
    if (c !== 0) return c
    return a.displayName.localeCompare(b.displayName)
  })
  var prev = null
  rows.forEach(function (r, i) {
    r.rank = (prev && compareRows(prev, r) === 0) ? prev.rank : i + 1
    prev = r
  })
  return rows
}

/**
 * The two sentences on the comp card.
 * "Max 5 goes per problem. Top first go 100%, second 80%, third 60%, then 50%. Zone 25%. Best 10 count."
 */
export function scoringSentence(scoring) {
  var s = scoring || DEFAULT_SCORING
  var table = s.topPercentByAttempt || []
  var ords = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
  var parts = []
  var i = 0
  while (i < table.length) {
    // Collapse a run of equal values at the tail into "then X%".
    var allSame = true
    for (var j = i + 1; j < table.length; j++) if (table[j] !== table[i]) { allSame = false; break }
    // "then 50%" only for a run of two or more; a lone last value is named.
    if (allSame && i > 0 && table.length - i >= 2) { parts.push('then ' + table[i] + '%'); break }
    var ord = ords[i] || ('go ' + (i + 1))
    parts.push((i === 0 ? 'first go ' : ord + ' ') + table[i] + '%')
    i++
  }
  var goes = 'Max ' + s.maxAttempts + (s.maxAttempts === 1 ? ' go' : ' goes') + ' per problem.'
  var top = table.length ? 'Top ' + parts.join(', ') + '.' : ''
  var zone = 'Zone ' + s.zonePercent + '%.'
  var best = s.bestN ? ' Best ' + s.bestN + ' count.' : ''
  return [goes, top, zone].filter(Boolean).join(' ') + best
}

// ---------------------------------------------------------------------------
// The card as a session in the log
// ---------------------------------------------------------------------------

/** Deterministic ids, so a card re-derived on another device converges. */
export function compSessionId(code) { return 'comp-' + code }
export function compClimbId(code, problemId) { return 'comp-' + code + '-' + problemId }

/**
 * The climbs a card implies. Only graded problems with goes make a climb:
 * a top on go 1 is a flash, a later top a send with the real number of goes,
 * goes without a top an attempt. Zones are a comp fact, not a grade fact.
 * A hidden grade (null on the problem) makes no climb until it is revealed.
 *
 * @param {{code: string, card: object, problems: import('./types').CompProblem[], scoring: import('./types').CompScoring}} comp - the session's comp block
 * @param {string|null} location
 * @returns {import('./types').Climb[]}
 */
export function climbsFromCard(comp, location) {
  if (!comp) return []
  var out = []
  var problems = (comp.problems || []).slice().sort(function (a, b) { return a.number - b.number })
  problems.forEach(function (p) {
    if (!p.grade) return
    var r = normaliseResult((comp.card || {})[p.id], comp.scoring)
    if (r.attempts === 0) return
    var outcome = r.top ? (r.topAttempt === 1 ? 'flashed' : 'sent') : 'attempt'
    out.push({
      id: compClimbId(comp.code, p.id),
      grade: p.grade,
      gradeSystem: p.gradeSystem || gradeSystemFor(p.grade),
      discipline: compType(comp).value,
      outcome: outcome,
      attempts: r.top ? r.topAttempt : r.attempts,
      location: location || null,
      routeId: null,
      gymId: null,
      centreId: null,
      compCode: comp.code,
      compProblemId: p.id,
    })
  })
  return out
}

/**
 * Build or refresh the entrant's comp session from the comp document and
 * their entry. `existing` is the session already in the log, if any; its
 * notes and difficulty survive, everything else is re-derived.
 *
 * @param {import('./types').Competition} comp
 * @param {{category: string, card: object, voids?: object[]}} entry
 * @param {import('./types').Session|null} existing
 * @param {string} nowIso
 * @returns {import('./types').Session}
 */
export function sessionForComp(comp, entry, existing, nowIso) {
  var block = {
    code: comp.code,
    name: comp.name,
    discipline: compType(comp).value,
    category: entry.category || '',
    card: entry.card || {},
    problems: (comp.problems || []).slice(),
    scoring: Object.assign({}, comp.scoring || DEFAULT_SCORING),
    status: comp.status === 'closed' ? 'closed' : 'live',
    voids: (entry.voids || []).slice(),
  }
  var location = (comp.venue && comp.venue.name) || null
  return Object.assign(
    {
      exercises: [], hangGrips: [], routineId: null, routineName: null,
      cardioActivity: null, cardioLabel: null, cardioDurationMins: null,
      cardioQuantity: null, cardioUnit: null, cardioPoolLength: null,
      notes: '', difficulty: 3,
    },
    existing || {},
    {
      id: compSessionId(comp.code),
      type: 'climb',
      discipline: block.discipline,
      date: comp.date,
      location: location,
      comp: block,
      climbs: climbsFromCard(block, location),
      createdAt: (existing && existing.createdAt) || nowIso,
      updatedAt: nowIso,
    }
  )
}

/**
 * The entrant's session with a new card: `comp.card` replaced and the climbs
 * re-derived. Everything else — notes, difficulty, the sheet as last seen —
 * stays. The one write path for a go on the scorecard.
 */
export function withCard(session, card, nowIso) {
  if (!session || !session.comp) return session
  var block = Object.assign({}, session.comp, { card: card || {} })
  return Object.assign({}, session, {
    comp: block,
    climbs: climbsFromCard(block, session.location),
    updatedAt: nowIso,
  })
}

/**
 * Apply what the comp's copy of the card says that the session does not yet
 * know: new voids. For each void the session has not seen, the problem's
 * result becomes what the organiser left (no goes) and the void is kept
 * with its note. Anything else on the mirror is the session's own writes
 * coming back, and is ignored — the session is the source of truth for the
 * entrant's goes. Returns the same session when there is nothing new.
 */
export function applyEntryVoids(session, entry, nowIso) {
  if (!session || !session.comp || !entry) return session
  var seen = session.comp.voids || []
  var theirs = entry.voids || []
  if (theirs.length <= seen.length) return session
  var card = Object.assign({}, session.comp.card || {})
  theirs.slice(seen.length).forEach(function (v) {
    if (v && v.problemId) card[v.problemId] = normaliseResult((entry.card || {})[v.problemId], session.comp.scoring)
  })
  var block = Object.assign({}, session.comp, { card: card, voids: theirs.slice() })
  return Object.assign({}, session, { comp: block, climbs: climbsFromCard(block, session.location), updatedAt: nowIso })
}

/**
 * Bring the session's copy of the sheet, the scoring and the status up to
 * the comp document as now seen — a problem added, a grade shown, the close
 * with its reveal. The card is untouched; the climbs are re-derived, which is
 * how a hidden grade becomes a send at the close. Returns the same session
 * when nothing that matters changed.
 */
export function refreshSession(session, comp, nowIso) {
  if (!session || !session.comp || !comp) return session
  var status = comp.status === 'closed' ? 'closed' : 'live'
  var same = session.comp.status === status
    && session.comp.name === comp.name
    && session.date === comp.date
    && JSON.stringify(session.comp.problems) === JSON.stringify(comp.problems || [])
    && JSON.stringify(session.comp.scoring) === JSON.stringify(comp.scoring || DEFAULT_SCORING)
  if (same) return session
  return sessionForComp(comp, { category: session.comp.category, card: session.comp.card, voids: session.comp.voids }, session, nowIso)
}

/** The line History shows: "12 tops · 9 zones · 41 goes". */
export function summariseCard(comp) {
  if (!comp) return null
  var sc = scoreCard(comp.scoring, comp.problems, comp.card)
  return { score: sc.score, tops: sc.tops, zones: sc.zones, attempts: sc.attempts, flashes: sc.flashes }
}

// ---------------------------------------------------------------------------
// Results export
// ---------------------------------------------------------------------------

function csvCell(v) {
  var s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// ---------------------------------------------------------------------------
// The board (step 4)
// ---------------------------------------------------------------------------

/**
 * Who sees the leaderboard: organisers always; an entrant while the
 * organiser leaves it visible (`boardVisibleToEntrants`, default on), and
 * everyone entered once the comp is final. Anyone else cannot read the
 * entries at all (the rules), so never.
 */
export function canSeeBoard(comp, isOrganiser, entered) {
  if (!comp) return false
  if (isOrganiser) return true
  if (!entered) return false
  return comp.boardVisibleToEntrants !== false || comp.status === 'closed'
}

/** The boards to offer: one per category, plus Overall first when there is more than one. */
export function boardViews(comp) {
  var cats = ((comp && comp.categories) || []).filter(Boolean)
  if (cats.length <= 1) return [{ key: '', label: cats[0] || 'Overall' }]
  return [{ key: '', label: 'Overall' }].concat(cats.map(function (c) { return { key: c, label: c } }))
}

/** One result in words, for a row on the organiser's view of a card. */
export function resultLabel(result, scoring) {
  var r = normaliseResult(result, scoring)
  if (r.top) return r.topAttempt === 1 ? 'Flash' : 'Top · go ' + r.topAttempt
  if (r.zone) return 'Zone · go ' + r.zoneAttempt + (r.attempts > r.zoneAttempt ? ' · ' + r.attempts + ' goes' : '')
  if (r.attempts > 0) return r.attempts + (r.attempts === 1 ? ' go' : ' goes')
  return ''
}

/** "12 s ago", "3 min ago" — how old the board on screen is. */
export function fmtAgo(ms) {
  var s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return s + ' s ago'
  return Math.floor(s / 60) + ' min ago'
}

/**
 * One result cell per problem: T1 = top on go 1, Z2 = zone on go 2 without a
 * top, -3 = three goes and nothing, blank = untouched.
 */
export function resultCell(result, scoring) {
  var r = normaliseResult(result, scoring)
  if (r.top) return 'T' + r.topAttempt
  if (r.zone) return 'Z' + r.zoneAttempt
  if (r.attempts > 0) return '-' + r.attempts
  return ''
}

/**
 * The results table the gym prints: one row per entrant in Overall order,
 * then one column per problem.
 * @param {import('./types').Competition} comp
 * @param {object[]} entries
 * @returns {string}
 */
export function resultsCsv(comp, entries) {
  var problems = ((comp && comp.problems) || []).slice().sort(function (a, b) { return a.number - b.number })
  var byUid = {}
  ;(entries || []).forEach(function (e) { if (e && e.uid) byUid[e.uid] = e })
  var header = ['Rank', 'Name', 'Category', 'Score', 'Tops', 'Zones', 'Flashes', 'Goes']
    .concat(problems.map(function (p) { return '#' + p.number }))
  var lines = [header.map(csvCell).join(',')]
  rankEntries(comp, entries).forEach(function (row) {
    var e = byUid[row.uid] || {}
    var cells = [row.rank, row.displayName, row.category, formatScore(row.score), row.tops, row.zones, row.flashes, row.attempts]
      .concat(problems.map(function (p) { return resultCell((e.card || {})[p.id], comp.scoring) }))
    lines.push(cells.map(csvCell).join(','))
  })
  return lines.join('\n') + '\n'
}
