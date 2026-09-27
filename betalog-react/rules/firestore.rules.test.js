/**
 * Firestore rules tests — the competitions block (spec §10).
 *
 * The first rules tests in this repo, because these are the first rules
 * where a stranger could write something another climber sees. They run
 * against the Firestore emulator, not `npm test`:
 *
 *   npm run test:rules
 *
 * which is `firebase emulators:exec --only firestore "vitest run --config vitest.rules.config.js"`.
 * Needs the Firebase CLI (already on the laptop that deploys the rules) and
 * Java for the emulator.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore'

var env
var ORG = 'org-uid'
var ENT = 'entrant-uid'
var OTHER = 'other-uid'
var CODE = 'CP-TEST1'

function comp(status) {
  return {
    schemaVersion: 1, name: 'Test comp', date: '2026-10-18', startAt: null, endAt: null,
    venue: { name: 'Wall', lat: null, lng: null }, notes: '', status: status || 'draft',
    scoring: { maxAttempts: 5, topPercentByAttempt: [100, 80, 60, 50, 50], zonePercent: 25, bestN: null },
    categories: ['Open'], boardVisibleToEntrants: true,
    problems: [{ id: 'p1', number: 1, colour: 'red', points: 10, grade: null, gradeSystem: null, showGrade: false, label: null }],
    organisers: [ORG], organiserNames: { 'org-uid': 'Org' }, gymId: null, centreId: null,
    createdAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z', closedAt: null,
  }
}

function entry() {
  return { displayName: 'Ent', category: 'Open', card: {}, voids: [], enteredAt: 'x', updatedAt: 'x' }
}

/** Seed with the rules switched off. */
function seed(status, withEntry) {
  return env.withSecurityRulesDisabled(function (ctx) {
    var db = ctx.firestore()
    return setDoc(doc(db, 'competitions', CODE), comp(status)).then(function () {
      return setDoc(doc(db, 'competitions', CODE, 'private', 'grades'), { p1: { grade: 'V4', gradeSystem: 'v' } })
    }).then(function () {
      if (!withEntry) return
      return setDoc(doc(db, 'competitions', CODE, 'entries', ENT), entry())
    })
  })
}

function as(uid) { return env.authenticatedContext(uid).firestore() }
function anon() { return env.unauthenticatedContext().firestore() }

beforeAll(async function () {
  env = await initializeTestEnvironment({
    projectId: 'betalog-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async function () { await env.cleanup() })

beforeEach(async function () { await env.clearFirestore() })

describe('competitions/{code}', () => {
  it('anyone signed in can get a comp by its code; nobody signed out can', async () => {
    await seed('open')
    await assertSucceeds(getDoc(doc(as(OTHER), 'competitions', CODE)))
    await assertFails(getDoc(doc(anon(), 'competitions', CODE)))
  })

  it('only an organiser can list, and only their own', async () => {
    await seed('open')
    var mine = query(collection(as(ORG), 'competitions'), where('organisers', 'array-contains', ORG))
    await assertSucceeds(getDocs(mine))
    var theirs = query(collection(as(OTHER), 'competitions'), where('organisers', 'array-contains', ORG))
    await assertFails(getDocs(theirs))
    await assertFails(getDocs(collection(as(OTHER), 'competitions')))
  })

  it('creating needs oneself as the only organiser and a draft status', async () => {
    await assertSucceeds(setDoc(doc(as(ORG), 'competitions', 'CP-NEW01'), comp('draft')))
    await assertFails(setDoc(doc(as(ORG), 'competitions', 'CP-NEW02'), comp('open')))
    var forOther = comp('draft'); forOther.organisers = [OTHER]
    await assertFails(setDoc(doc(as(ORG), 'competitions', 'CP-NEW03'), forOther))
    var two = comp('draft'); two.organisers = [ORG, OTHER]
    await assertFails(setDoc(doc(as(ORG), 'competitions', 'CP-NEW04'), two))
    await assertFails(setDoc(doc(anon(), 'competitions', 'CP-NEW05'), comp('draft')))
  })

  it('only an organiser updates or deletes', async () => {
    await seed('open', true)
    await assertSucceeds(updateDoc(doc(as(ORG), 'competitions', CODE), { status: 'live' }))
    await assertFails(updateDoc(doc(as(ENT), 'competitions', CODE), { status: 'live' }))
    await assertFails(updateDoc(doc(as(OTHER), 'competitions', CODE), { name: 'Mine now' }))
    await assertFails(deleteDoc(doc(as(ENT), 'competitions', CODE)))
    await assertSucceeds(deleteDoc(doc(as(ORG), 'competitions', CODE)))
  })
})

describe('private/grades', () => {
  it('organisers read and write; entrants and strangers cannot read', async () => {
    await seed('live', true)
    await assertSucceeds(getDoc(doc(as(ORG), 'competitions', CODE, 'private', 'grades')))
    await assertSucceeds(setDoc(doc(as(ORG), 'competitions', CODE, 'private', 'grades'), {}))
    await assertFails(getDoc(doc(as(ENT), 'competitions', CODE, 'private', 'grades')))
    await assertFails(getDoc(doc(as(OTHER), 'competitions', CODE, 'private', 'grades')))
  })
})

describe('entries/{uid}', () => {
  it('a stranger cannot read entries; an entrant and an organiser can', async () => {
    await seed('live', true)
    await assertFails(getDoc(doc(as(OTHER), 'competitions', CODE, 'entries', ENT)))
    await assertFails(getDocs(collection(as(OTHER), 'competitions', CODE, 'entries')))
    await assertSucceeds(getDoc(doc(as(ENT), 'competitions', CODE, 'entries', ENT)))
    await assertSucceeds(getDocs(collection(as(ENT), 'competitions', CODE, 'entries')))
    await assertSucceeds(getDocs(collection(as(ORG), 'competitions', CODE, 'entries')))
  })

  it('entering needs one\'s own uid, an open or live comp, and no voids', async () => {
    await seed('open')
    await assertSucceeds(setDoc(doc(as(ENT), 'competitions', CODE, 'entries', ENT), entry()))
    await assertFails(setDoc(doc(as(OTHER), 'competitions', CODE, 'entries', ENT), entry()))
    var voided = entry(); voided.voids = [{ problemId: 'p1' }]
    await assertFails(setDoc(doc(as(OTHER), 'competitions', CODE, 'entries', OTHER), voided))
    await env.clearFirestore(); await seed('draft')
    await assertFails(setDoc(doc(as(ENT), 'competitions', CODE, 'entries', ENT), entry()))
    await env.clearFirestore(); await seed('closed')
    await assertFails(setDoc(doc(as(ENT), 'competitions', CODE, 'entries', ENT), entry()))
  })

  it('while live an entrant changes only the card; while open only name and category', async () => {
    await seed('live', true)
    var ref = doc(as(ENT), 'competitions', CODE, 'entries', ENT)
    await assertSucceeds(updateDoc(ref, { card: { p1: { attempts: 1, zone: true, zoneAttempt: 1, top: false, topAttempt: null, at: 'x' } }, updatedAt: 'y' }))
    await assertFails(updateDoc(ref, { category: 'Female' }))
    await assertFails(updateDoc(ref, { voids: [{ problemId: 'p1' }] }))   // an unchanged voids: [] is no change at all
    await assertFails(updateDoc(ref, { card: {}, displayName: 'New' }))

    await env.clearFirestore(); await seed('open', true)
    ref = doc(as(ENT), 'competitions', CODE, 'entries', ENT)
    await assertSucceeds(updateDoc(ref, { category: 'Female', displayName: 'E', updatedAt: 'y' }))
    await assertFails(updateDoc(ref, { card: { p1: { attempts: 1, zone: false, zoneAttempt: null, top: false, topAttempt: null, at: 'x' } } }))
  })

  it('an entrant cannot write another card, and cannot write after the close', async () => {
    await seed('live', true)
    await assertFails(updateDoc(doc(as(OTHER), 'competitions', CODE, 'entries', ENT), { card: {} }))
    await env.clearFirestore(); await seed('closed', true)
    await assertFails(updateDoc(doc(as(ENT), 'competitions', CODE, 'entries', ENT), { card: {}, updatedAt: 'z' }))
  })

  it('an organiser can void (write card and voids) at any status', async () => {
    await seed('closed', true)
    await assertSucceeds(updateDoc(doc(as(ORG), 'competitions', CODE, 'entries', ENT), { card: {}, voids: [{ problemId: 'p1', by: ORG, at: 'x', note: 'n', before: {} }] }))
  })

  it('withdrawing is allowed while open, not once live; organisers always', async () => {
    await seed('open', true)
    await assertSucceeds(deleteDoc(doc(as(ENT), 'competitions', CODE, 'entries', ENT)))
    await env.clearFirestore(); await seed('live', true)
    await assertFails(deleteDoc(doc(as(ENT), 'competitions', CODE, 'entries', ENT)))
    await assertSucceeds(deleteDoc(doc(as(ORG), 'competitions', CODE, 'entries', ENT)))
  })
})

describe('what already existed still holds', () => {
  it('a user reads their own document and not another\'s', async () => {
    await env.withSecurityRulesDisabled(function (ctx) {
      return setDoc(doc(ctx.firestore(), 'users', ENT), { friends: [] })
    })
    await assertSucceeds(getDoc(doc(as(ENT), 'users', ENT)))
    await assertFails(getDoc(doc(as(OTHER), 'users', ENT)))
    expect(true).toBe(true)
  })
})
