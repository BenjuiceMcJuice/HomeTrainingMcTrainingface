import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SCORING, DEFAULT_CIRCUITS, MAX_ATTEMPTS_LIMIT,
  makeCode, normaliseCode, isCompCode,
  newComp, generateProblems, resizeTopTable, gradeSystemFor, validateComp,
  splitHiddenGrades, revealGrades,
  emptyResult, normaliseResult, applyCardAction, applyVoid,
  scoreProblem, scoreCard, formatScore, rankEntries, scoringSentence,
  climbsFromCard, sessionForComp, summariseCard, compSessionId, compClimbId,
  resultCell, resultsCsv,
} from '../competition'

var NOW = '2026-10-18T14:00:00.000Z'

function sheet() {
  var p = generateProblems(30, DEFAULT_CIRCUITS)
  // Grade a few: p1 green V0 shown, p9 blue V2 shown, p17 red V4 hidden, p25 black V6 hidden
  p[0]  = Object.assign({}, p[0],  { grade: 'V0', gradeSystem: 'v' })
  p[8]  = Object.assign({}, p[8],  { grade: 'V2', gradeSystem: 'v' })
  p[16] = Object.assign({}, p[16], { grade: 'V4', gradeSystem: 'v', showGrade: false })
  p[24] = Object.assign({}, p[24], { grade: 'V6', gradeSystem: 'v', showGrade: false })
  return p
}

function comp(overrides) {
  var c = newComp({ name: 'Autumn Comp', date: '2026-10-18', venue: { name: 'Redpoint Bristol', lat: null, lng: null }, problems: sheet() }, 'org1', 'Ben', NOW)
  c.code = 'CP-K7M2Q'
  return Object.assign(c, overrides || {})
}

/** Build a card from a shorthand: { p1: 'T1', p2: 'Z2', p3: '-3' } */
function card(short) {
  var out = {}
  Object.keys(short).forEach(function (id) {
    var s = short[id]
    var n = parseInt(s.slice(1), 10)
    var r = emptyResult()
    r.attempts = n
    if (s[0] === 'T') { r.top = true; r.topAttempt = n; r.zone = true; r.zoneAttempt = n }
    if (s[0] === 'Z') { r.zone = true; r.zoneAttempt = n }
    out[id] = r
  })
  return out
}

// ---------------------------------------------------------------------------

describe('codes', () => {
  it('makes CP- plus five unambiguous characters', () => {
    var seq = [0, 0.5, 0.999, 0.25, 0.75]
    var i = 0
    var code = makeCode(function () { return seq[i++ % seq.length] })
    expect(code).toMatch(/^CP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/)
    expect(code).toBe('CP-AS9J2')   // A(0) S(16) 9(31) J(8) 2(24) of the 32-character alphabet
    expect(isCompCode(makeCode())).toBe(true)
  })

  it('normalises what someone types', () => {
    expect(normaliseCode('k7m2q')).toBe('CP-K7M2Q')
    expect(normaliseCode(' cp-k7m 2q ')).toBe('CP-K7M2Q')
    expect(normaliseCode('CP-K7M2')).toBe(null)     // too short
    expect(normaliseCode('CP-K7M20')).toBe(null)    // 0 is not in the alphabet
    expect(normaliseCode(null)).toBe(null)
  })
})

describe('newComp and the generator', () => {
  it('starts as a draft with the creator as the only organiser', () => {
    var c = newComp({ name: 'X' }, 'u1', 'Ben', NOW)
    expect(c.status).toBe('draft')
    expect(c.code).toBe(null)
    expect(c.organisers).toEqual(['u1'])
    expect(c.organiserNames).toEqual({ u1: 'Ben' })
    expect(c.scoring).toEqual(DEFAULT_SCORING)
    expect(c.scoring).not.toBe(DEFAULT_SCORING)
    expect(c.categories).toEqual(['Open'])
    expect(c.boardVisibleToEntrants).toBe(true)
    expect(c.schemaVersion).toBe(1)
  })

  it('generates 30 problems by circuit', () => {
    var p = generateProblems(30, DEFAULT_CIRCUITS)
    expect(p.length).toBe(30)
    expect(p[0]).toEqual({ id: 'p1', number: 1, colour: 'green', points: 10, grade: null, gradeSystem: null, showGrade: true, label: null })
    expect(p[8].colour).toBe('blue');  expect(p[8].points).toBe(20)
    expect(p[16].colour).toBe('red');  expect(p[16].points).toBe(30)
    expect(p[29].colour).toBe('black'); expect(p[29].points).toBe(50)
  })

  it('a number outside every circuit gets the last circuit points and no colour', () => {
    var p = generateProblems(32, DEFAULT_CIRCUITS)
    expect(p[31].colour).toBe(null)
    expect(p[31].points).toBe(50)
    expect(generateProblems(0, DEFAULT_CIRCUITS)).toEqual([])
    expect(generateProblems(2, [])[1].points).toBe(10)
  })

  it('resizes the top table by truncating or padding with the last value', () => {
    expect(resizeTopTable([100, 80, 60, 50, 50], 3)).toEqual([100, 80, 60])
    expect(resizeTopTable([100, 80, 60, 50, 50], 7)).toEqual([100, 80, 60, 50, 50, 50, 50])
    expect(resizeTopTable([], 2)).toEqual([100, 80])
    expect(resizeTopTable([100], 99).length).toBe(MAX_ATTEMPTS_LIMIT)
  })

  it('knows a V-grade from a Font grade', () => {
    expect(gradeSystemFor('V4')).toBe('v')
    expect(gradeSystemFor('v10')).toBe('v')
    expect(gradeSystemFor('6b+')).toBe('french')
    expect(gradeSystemFor(null)).toBe(null)
  })
})

describe('validateComp', () => {
  it('passes a well-formed comp', () => {
    expect(validateComp(comp())).toEqual([])
  })

  it('names each missing detail', () => {
    var errs = validateComp(newComp({}, 'u', 'n', NOW))
    expect(errs).toContain('Give the competition a name')
    expect(errs).toContain('Say where it is')
    expect(errs).toContain('Add at least one problem')
  })

  it('checks the scoring knobs', () => {
    var c = comp(); c.scoring = Object.assign({}, c.scoring, { maxAttempts: 0 })
    expect(validateComp(c).join(' ')).toMatch(/Max goes/)
    c = comp(); c.scoring = Object.assign({}, c.scoring, { maxAttempts: 3 })          // table still length 5
    expect(validateComp(c)).toContain('The top table needs one percentage per go')
    c = comp(); c.scoring = Object.assign({}, c.scoring, { topPercentByAttempt: [100, 80, 90, 50, 50] })
    expect(validateComp(c)).toContain('A top on a later go cannot be worth more than on an earlier one')
    c = comp(); c.scoring = Object.assign({}, c.scoring, { topPercentByAttempt: [100, 80, 60, 50, 101] })
    expect(validateComp(c)).toContain('Top percentages must be 0–100')
    c = comp(); c.scoring = Object.assign({}, c.scoring, { zonePercent: -1 })
    expect(validateComp(c)).toContain('Zone percentage must be 0–100')
    c = comp(); c.scoring = Object.assign({}, c.scoring, { bestN: 31 })
    expect(validateComp(c)).toContain('Best N must be between 1 and the number of problems')
    c = comp(); c.scoring = Object.assign({}, c.scoring, { bestN: 10 })
    expect(validateComp(c)).toEqual([])
  })

  it('checks categories and problems', () => {
    var c = comp({ categories: [] })
    expect(validateComp(c)).toContain('At least one category')
    c = comp({ categories: ['Open', 'open'] })
    expect(validateComp(c)).toContain('Category "open" appears twice')
    c = comp(); c.problems = c.problems.concat([Object.assign({}, c.problems[0], { id: 'p99' })])
    expect(validateComp(c)).toContain('Problem 1 appears twice')
    c = comp(); c.problems[3] = Object.assign({}, c.problems[3], { points: 0 })
    expect(validateComp(c)).toContain('Problem 4 needs points above 0')
    c = comp(); c.problems[3] = Object.assign({}, c.problems[3], { grade: 'V3', gradeSystem: null })
    expect(validateComp(c)).toContain('Problem 4 has a grade with no grade system')
  })
})

describe('hidden grades', () => {
  it('nulls hidden grades on the public copy and keeps them privately', () => {
    var split = splitHiddenGrades(sheet())
    expect(split.problems[0].grade).toBe('V0')
    expect(split.problems[16].grade).toBe(null)
    expect(split.problems[16].gradeSystem).toBe(null)
    expect(split.problems[16].showGrade).toBe(false)
    expect(split.grades).toEqual({ p17: { grade: 'V4', gradeSystem: 'v' }, p25: { grade: 'V6', gradeSystem: 'v' } })
  })

  it('reveal puts them back and leaves showGrade as the setter chose', () => {
    var split = splitHiddenGrades(sheet())
    var back = revealGrades(split.problems, split.grades)
    expect(back[16].grade).toBe('V4')
    expect(back[16].showGrade).toBe(false)
    expect(back[24].grade).toBe('V6')
    expect(revealGrades(split.problems, null)[16].grade).toBe(null)
  })

  it('an ungraded hidden problem has nothing to hide', () => {
    var p = generateProblems(1, DEFAULT_CIRCUITS)
    p[0].showGrade = false
    expect(splitHiddenGrades(p).grades).toEqual({})
  })
})

// ---------------------------------------------------------------------------

describe('normaliseResult', () => {
  it('repairs anything that breaks the invariants', () => {
    var s = DEFAULT_SCORING
    expect(normaliseResult(null, s)).toEqual(emptyResult())
    expect(normaliseResult({ attempts: 9 }, s).attempts).toBe(5)
    expect(normaliseResult({ attempts: -2 }, s).attempts).toBe(0)
    // top beyond attempts is dropped
    expect(normaliseResult({ attempts: 2, top: true, topAttempt: 3 }, s).top).toBe(false)
    // a top without a zone gets one on the same go
    var r = normaliseResult({ attempts: 3, top: true, topAttempt: 2 }, s)
    expect(r.zone).toBe(true); expect(r.zoneAttempt).toBe(2)
    // a zone after the top moves up to the top
    r = normaliseResult({ attempts: 3, top: true, topAttempt: 2, zone: true, zoneAttempt: 3 }, s)
    expect(r.zoneAttempt).toBe(2)
    // a zone before the top stays
    r = normaliseResult({ attempts: 3, top: true, topAttempt: 3, zone: true, zoneAttempt: 1 }, s)
    expect(r.zoneAttempt).toBe(1)
  })
})

describe('applyCardAction', () => {
  var s = DEFAULT_SCORING
  function run(actions, start) {
    var c = start || {}
    actions.forEach(function (a) { c = applyCardAction(c, s, Object.assign({ problemId: 'p1' }, a), NOW) })
    return c.p1 || emptyResult()
  }

  it('counts goes up to the max and never past it', () => {
    var r = run([{ type: 'inc' }, { type: 'inc' }, { type: 'inc' }])
    expect(r.attempts).toBe(3)
    expect(r.at).toBe(NOW)
    r = run([{ type: 'inc' }, { type: 'inc' }, { type: 'inc' }, { type: 'inc' }, { type: 'inc' }, { type: 'inc' }])
    expect(r.attempts).toBe(5)
  })

  it('does not go below zero and returns the same card when nothing changes', () => {
    var c = {}
    expect(applyCardAction(c, s, { type: 'dec', problemId: 'p1' }, NOW)).toBe(c)
    expect(applyCardAction(c, s, { type: 'top', value: false, problemId: 'p1' }, NOW)).toBe(c)
    expect(applyCardAction(c, s, { type: 'nonsense', problemId: 'p1' }, NOW)).toBe(c)
    expect(applyCardAction(c, s, { type: 'inc' }, NOW)).toBe(c)
  })

  it('never mutates the card it was given', () => {
    var c = { p1: emptyResult() }
    var before = JSON.stringify(c)
    applyCardAction(c, s, { type: 'inc', problemId: 'p1' }, NOW)
    expect(JSON.stringify(c)).toBe(before)
  })

  it('a top on go 1 is a flash and brings a zone with it', () => {
    var r = run([{ type: 'top', value: true }])
    expect(r).toMatchObject({ attempts: 1, top: true, topAttempt: 1, zone: true, zoneAttempt: 1 })
  })

  it('a zone then more goes then a top records both goes', () => {
    var r = run([{ type: 'inc' }, { type: 'zone', value: true }, { type: 'inc' }, { type: 'inc' }, { type: 'top', value: true }])
    expect(r).toMatchObject({ attempts: 3, zone: true, zoneAttempt: 1, top: true, topAttempt: 3 })
  })

  it('zone on with no goes makes it go 1', () => {
    expect(run([{ type: 'zone', value: true }])).toMatchObject({ attempts: 1, zone: true, zoneAttempt: 1, top: false })
  })

  it('stepping goes back below a top clears the top, and below a zone clears the zone', () => {
    var r = run([{ type: 'inc' }, { type: 'zone', value: true }, { type: 'inc' }, { type: 'top', value: true }, { type: 'dec' }])
    expect(r).toMatchObject({ attempts: 1, top: false, topAttempt: null, zone: true, zoneAttempt: 1 })
    r = run([{ type: 'inc' }, { type: 'zone', value: true }, { type: 'inc' }, { type: 'top', value: true }, { type: 'dec' }, { type: 'dec' }])
    expect(r).toMatchObject({ attempts: 0, top: false, zone: false, zoneAttempt: null })
  })

  it('zone off takes the top with it; top off leaves the zone', () => {
    var r = run([{ type: 'inc' }, { type: 'inc' }, { type: 'top', value: true }, { type: 'zone', value: false }])
    expect(r).toMatchObject({ attempts: 2, top: false, zone: false })
    r = run([{ type: 'inc' }, { type: 'inc' }, { type: 'top', value: true }, { type: 'top', value: false }])
    expect(r).toMatchObject({ attempts: 2, top: false, topAttempt: null, zone: true, zoneAttempt: 2 })
  })

  it('a top at max goes still counts; the stepper is what stops', () => {
    var r = run([{ type: 'inc' }, { type: 'inc' }, { type: 'inc' }, { type: 'inc' }, { type: 'inc' }, { type: 'top', value: true }])
    expect(r).toMatchObject({ attempts: 5, top: true, topAttempt: 5 })
  })

  it('void resets one problem and leaves the rest', () => {
    var c = card({ p1: 'T2', p2: 'Z1' })
    var next = applyVoid(c, 'p1', NOW)
    expect(next.p1).toMatchObject({ attempts: 0, top: false, zone: false, at: NOW })
    expect(next.p2).toBe(c.p2)
  })

  it('holds the invariants under a random walk', () => {
    var seed = 7
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    var types = ['inc', 'dec', 'zone', 'top', 'reset']
    var c = {}
    for (var i = 0; i < 2000; i++) {
      var t = types[Math.floor(rnd() * types.length)]
      c = applyCardAction(c, s, { type: t, value: rnd() < 0.5, problemId: 'p' + (1 + Math.floor(rnd() * 3)) }, NOW)
      Object.keys(c).forEach(function (id) {
        var r = c[id]
        expect(r.attempts).toBeGreaterThanOrEqual(0)
        expect(r.attempts).toBeLessThanOrEqual(s.maxAttempts)
        if (r.top) { expect(r.zone).toBe(true); expect(r.topAttempt).toBeLessThanOrEqual(r.attempts); expect(r.zoneAttempt).toBeLessThanOrEqual(r.topAttempt) }
        if (r.zone) expect(r.zoneAttempt).toBeLessThanOrEqual(r.attempts)
        if (!r.top) expect(r.topAttempt).toBe(null)
        if (!r.zone) expect(r.zoneAttempt).toBe(null)
      })
    }
  })
})

// ---------------------------------------------------------------------------

describe('scoreProblem', () => {
  var s = DEFAULT_SCORING
  var black = { id: 'p25', number: 25, points: 50 }

  it('follows the §4 table', () => {
    expect(scoreProblem(s, black, card({ p25: 'T1' }).p25)).toBe(50)
    expect(scoreProblem(s, black, card({ p25: 'T2' }).p25)).toBe(40)
    expect(scoreProblem(s, black, card({ p25: 'T3' }).p25)).toBe(30)
    expect(scoreProblem(s, black, card({ p25: 'T4' }).p25)).toBe(25)
    expect(scoreProblem(s, black, card({ p25: 'T5' }).p25)).toBe(25)
    expect(scoreProblem(s, black, card({ p25: 'Z3' }).p25)).toBe(12.5)
    expect(scoreProblem(s, black, card({ p25: '-5' }).p25)).toBe(0)
    expect(scoreProblem(s, black, emptyResult())).toBe(0)
    expect(scoreProblem(s, null, emptyResult())).toBe(0)
  })

  it('flat scoring is every percentage at 100', () => {
    var flat = Object.assign({}, s, { topPercentByAttempt: [100, 100, 100, 100, 100], zonePercent: 0 })
    expect(scoreProblem(flat, black, card({ p25: 'T5' }).p25)).toBe(50)
    expect(scoreProblem(flat, black, card({ p25: 'Z1' }).p25)).toBe(0)
  })

  it('a table shorter than the go falls back to its last value', () => {
    var short = Object.assign({}, s, { topPercentByAttempt: [100, 50] })
    expect(scoreProblem(short, black, { attempts: 4, top: true, topAttempt: 4 })).toBe(25)
  })
})

describe('scoreCard', () => {
  var c = comp()

  it('adds up tops, zones, goes and flashes', () => {
    var sc = scoreCard(c.scoring, c.problems, card({ p1: 'T1', p9: 'T2', p17: 'Z2', p25: '-5', p2: 'T1' }))
    expect(sc.score).toBe(10 + 16 + 7.5 + 10)
    expect(sc.tops).toBe(3)
    expect(sc.zones).toBe(1)          // zones without a top
    expect(sc.flashes).toBe(2)
    expect(sc.attempts).toBe(1 + 2 + 2 + 5 + 1)
    expect(sc.counted.sort()).toEqual(['p1', 'p17', 'p2', 'p9'])
    expect(sc.perProblem.p25).toBe(0)
  })

  it('best N keeps the N highest problem scores', () => {
    var scoring = Object.assign({}, c.scoring, { bestN: 2 })
    var sc = scoreCard(scoring, c.problems, card({ p1: 'T1', p9: 'T1', p25: 'T1', p2: 'T1' }))
    expect(sc.score).toBe(50 + 20)
    expect(sc.counted).toEqual(['p25', 'p9'])
    expect(sc.tops).toBe(4)           // tops are still all the tops
  })

  it('an empty card scores nothing', () => {
    expect(scoreCard(c.scoring, c.problems, {})).toMatchObject({ score: 0, tops: 0, zones: 0, attempts: 0, flashes: 0, counted: [] })
    expect(scoreCard(c.scoring, c.problems, null).score).toBe(0)
  })

  it('formatScore shows integers plain and the rest to one place', () => {
    expect(formatScore(40)).toBe('40')
    expect(formatScore(12.5)).toBe('12.5')
    expect(formatScore(NaN)).toBe('0')
  })
})

describe('rankEntries', () => {
  var c = comp({ categories: ['Female', 'Male'] })
  var entries = [
    { uid: 'a', displayName: 'Ann', category: 'Female', card: card({ p25: 'T1', p1: 'T1' }) },           // 60, 2 tops, 2 goes
    { uid: 'b', displayName: 'Bob', category: 'Male',   card: card({ p25: 'T1', p1: 'T1' }) },           // 60, 2 tops, 2 goes — ties Ann
    { uid: 'c', displayName: 'Cat', category: 'Female', card: card({ p25: 'T1', p2: 'Z1', p3: 'Z1' }) }, // 55, 1 top
    { uid: 'd', displayName: 'Dan', category: 'Male',   card: card({ p25: 'T2', p1: 'T1', p2: 'T1' }) }, // 60, 3 tops, 4 goes — beats Ann on tops
    { uid: 'e', displayName: 'Eve', category: 'Male',   card: {} },
  ]

  it('orders by score, tops, zones, fewer goes, and shares ranks', () => {
    var rows = rankEntries(c, entries)
    expect(rows.map(function (r) { return r.uid })).toEqual(['d', 'a', 'b', 'c', 'e'])
    expect(rows.map(function (r) { return r.rank })).toEqual([1, 2, 2, 4, 5])
  })

  it('a category board ranks within the category', () => {
    var rows = rankEntries(c, entries, 'Female')
    expect(rows.map(function (r) { return r.uid + r.rank })).toEqual(['a1', 'c2'])
  })

  it('goes break a tie on score, tops and zones', () => {
    var rows = rankEntries(c, [
      { uid: 'x', displayName: 'X', category: 'Open', card: card({ p1: 'T1', p2: '-3' }) },
      { uid: 'y', displayName: 'Y', category: 'Open', card: card({ p1: 'T1' }) },
    ])
    expect(rows[0].uid).toBe('y')
    expect(rows[1].rank).toBe(2)
  })

  it('copes with nothing', () => {
    expect(rankEntries(c, [])).toEqual([])
    expect(rankEntries(null, [{ uid: 'z', card: {} }])[0]).toMatchObject({ displayName: 'Climber', score: 0, rank: 1 })
  })
})

describe('scoringSentence', () => {
  it('reads the defaults back', () => {
    expect(scoringSentence(DEFAULT_SCORING)).toBe('Max 5 goes per problem. Top first go 100%, second 80%, third 60%, then 50%. Zone 25%.')
  })
  it('handles one go, a flat table and best N', () => {
    expect(scoringSentence({ maxAttempts: 1, topPercentByAttempt: [100], zonePercent: 50, bestN: null })).toBe('Max 1 go per problem. Top first go 100%. Zone 50%.')
    expect(scoringSentence({ maxAttempts: 3, topPercentByAttempt: [100, 100, 100], zonePercent: 0, bestN: 10 })).toBe('Max 3 goes per problem. Top first go 100%, then 100%. Zone 0%. Best 10 count.')
    expect(scoringSentence({ maxAttempts: 2, topPercentByAttempt: [100, 70], zonePercent: 25, bestN: null })).toBe('Max 2 goes per problem. Top first go 100%, second 70%. Zone 25%.')
  })
})

// ---------------------------------------------------------------------------

describe('climbsFromCard', () => {
  function block(cardShort, problems) {
    return { code: 'CP-K7M2Q', card: card(cardShort), problems: problems || splitHiddenGrades(sheet()).problems, scoring: DEFAULT_SCORING }
  }

  it('maps the five states of §7', () => {
    var climbs = climbsFromCard(block({ p1: 'T1', p9: 'T3', p2: 'T1', p17: 'T1', p25: 'Z2' }), 'Redpoint Bristol')
    // p2 has no grade; p17 and p25 are hidden (null on the public sheet)
    expect(climbs.map(function (c) { return c.compProblemId })).toEqual(['p1', 'p9'])
    expect(climbs[0]).toEqual({
      id: 'comp-CP-K7M2Q-p1', grade: 'V0', gradeSystem: 'v', discipline: 'boulder', outcome: 'flashed', attempts: 1,
      location: 'Redpoint Bristol', routeId: null, gymId: null, centreId: null, compCode: 'CP-K7M2Q', compProblemId: 'p1',
    })
    expect(climbs[1]).toMatchObject({ outcome: 'sent', attempts: 3, grade: 'V2' })
  })

  it('goes without a top are an attempt with the real count; a zone alone is still an attempt', () => {
    var climbs = climbsFromCard(block({ p1: '-4', p9: 'Z2' }), null)
    expect(climbs[0]).toMatchObject({ outcome: 'attempt', attempts: 4, location: null })
    expect(climbs[1]).toMatchObject({ outcome: 'attempt', attempts: 2 })
  })

  it('a graded problem with no goes makes no climb', () => {
    expect(climbsFromCard(block({ p9: '-0' }), null)).toEqual([])
    expect(climbsFromCard(null, null)).toEqual([])
  })

  it('a hidden grade becomes a climb once revealed', () => {
    var split = splitHiddenGrades(sheet())
    var before = climbsFromCard(block({ p17: 'T2' }, split.problems), null)
    expect(before).toEqual([])
    var after = climbsFromCard(block({ p17: 'T2' }, revealGrades(split.problems, split.grades)), null)
    expect(after[0]).toMatchObject({ grade: 'V4', outcome: 'sent', attempts: 2 })
  })

  it('a top counts the goes to the top, not goes after it', () => {
    var r = { attempts: 4, top: true, topAttempt: 2, zone: true, zoneAttempt: 1 }
    var climbs = climbsFromCard({ code: 'CP-K7M2Q', card: { p1: r }, problems: sheet(), scoring: DEFAULT_SCORING }, null)
    expect(climbs[0].attempts).toBe(2)
  })
})

describe('sessionForComp', () => {
  var c = comp()
  var entry = { category: 'Open', card: card({ p1: 'T1', p9: 'Z1' }), voids: [] }

  it('builds a climb session on the comp date at the venue with derived climbs', () => {
    var s = sessionForComp(c, entry, null, NOW)
    expect(s.id).toBe(compSessionId('CP-K7M2Q'))
    expect(s).toMatchObject({ type: 'climb', discipline: 'boulder', date: '2026-10-18', location: 'Redpoint Bristol', difficulty: 3, notes: '', createdAt: NOW, updatedAt: NOW })
    expect(s.comp).toMatchObject({ code: 'CP-K7M2Q', name: 'Autumn Comp', category: 'Open', status: 'live' })
    expect(s.climbs.length).toBe(2)
    expect(s.climbs[0].id).toBe(compClimbId('CP-K7M2Q', 'p1'))
    expect(s.exercises).toEqual([]); expect(s.hangGrips).toEqual([])
  })

  it('keeps notes, difficulty and createdAt from the existing session; everything else is re-derived', () => {
    var existing = sessionForComp(c, entry, null, '2026-10-18T10:00:00.000Z')
    existing.notes = 'good day'; existing.difficulty = 5
    existing.climbs = [{ id: 'hand-edited' }]
    var s = sessionForComp(c, { category: 'Open', card: card({ p1: 'T1' }), voids: [] }, existing, NOW)
    expect(s.notes).toBe('good day'); expect(s.difficulty).toBe(5)
    expect(s.createdAt).toBe('2026-10-18T10:00:00.000Z'); expect(s.updatedAt).toBe(NOW)
    expect(s.climbs.length).toBe(1)
  })

  it('a closed comp marks the block closed', () => {
    expect(sessionForComp(comp({ status: 'closed' }), entry, null, NOW).comp.status).toBe('closed')
  })

  it('summariseCard reads the block', () => {
    var s = sessionForComp(c, entry, null, NOW)
    expect(summariseCard(s.comp)).toEqual({ score: 15, tops: 1, zones: 1, attempts: 2, flashes: 1 })
    expect(summariseCard(null)).toBe(null)
  })
})

// ---------------------------------------------------------------------------

describe('results CSV', () => {
  it('encodes a cell per problem', () => {
    expect(resultCell(card({ p: 'T1' }).p)).toBe('T1')
    expect(resultCell(card({ p: 'Z2' }).p)).toBe('Z2')
    expect(resultCell(card({ p: '-3' }).p)).toBe('-3')
    expect(resultCell(emptyResult())).toBe('')
    expect(resultCell(undefined)).toBe('')
  })

  it('writes one row per entrant in overall order with a column per problem', () => {
    var c = comp()
    c.problems = generateProblems(3, [{ colour: 'red', points: 10, from: 1, to: 3 }])
    var csv = resultsCsv(c, [
      { uid: 'a', displayName: 'Ann, "The Crimp"', category: 'Open', card: card({ p1: 'T1', p3: 'Z2' }) },
      { uid: 'b', displayName: 'Bob', category: 'Open', card: card({ p1: 'T1', p2: 'T2', p3: '-5' }) },
    ])
    var lines = csv.split('\n')
    expect(lines[0]).toBe('Rank,Name,Category,Score,Tops,Zones,Flashes,Goes,#1,#2,#3')
    expect(lines[1]).toBe('1,Bob,Open,18,2,0,1,8,T1,T2,-5')
    expect(lines[2]).toBe('2,"Ann, ""The Crimp""",Open,12.5,1,1,1,3,T1,,Z2')
    expect(lines[3]).toBe('')
  })
})
