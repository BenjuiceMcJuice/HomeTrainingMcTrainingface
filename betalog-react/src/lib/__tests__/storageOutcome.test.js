import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../firebase', () => ({ auth: {}, db: {}, googleProvider: {}, browserPopupRedirectResolver: {} }))

var mem = {}
globalThis.localStorage = {
  getItem: function (k) { return k in mem ? mem[k] : null },
  setItem: function (k, v) { mem[k] = String(v) },
  removeItem: function (k) { delete mem[k] },
  key: function (i) { return Object.keys(mem)[i] || null },
  get length() { return Object.keys(mem).length },
}

import Storage from '../storage'

function climb(outcome) {
  return { id: 'c-' + outcome, grade: 'V4', gradeSystem: 'v', discipline: 'boulder', outcome: outcome, attempts: 1 }
}

describe('climb outcomes on load (BTL-B126)', function () {
  beforeEach(function () { mem = {} })

  it('folds the retired "project" into "attempt", as it does the old "fell", and keeps the rest', function () {
    localStorage.setItem('il_sessions', JSON.stringify([{
      id: 's1', type: 'climb', date: '2026-10-01', discipline: 'boulder',
      climbs: [climb('project'), climb('fell'), climb('repeat'), climb('sent'), climb('flashed'), climb('attempt')],
    }]))
    var outcomes = Storage.load().sessions[0].climbs.map(function (c) { return c.outcome })
    expect(outcomes).toEqual(['attempt', 'attempt', 'repeat', 'sent', 'flashed', 'attempt'])
  })
})
