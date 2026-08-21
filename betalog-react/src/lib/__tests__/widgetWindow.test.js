import { describe, it, expect } from 'vitest'
import { WINDOW_OPTIONS, getWindow, setWindow, windowDays } from '../widgetWindow'

describe('getWindow', () => {
  it('defaults every card to 90d', () => {
    expect(getWindow({}, 'cardioStats')).toBe('90d')
    expect(getWindow({}, 'alcoholFree')).toBe('90d')
    expect(getWindow({}, 'boulderLevel')).toBe('90d')
    expect(getWindow({}, 'ropeLevel')).toBe('90d')
  })

  it('lets a stored window win over the default', () => {
    expect(getWindow({ widgetWindow: { cardioStats: '30d' } }, 'cardioStats')).toBe('30d')
    expect(getWindow({ widgetWindow: { alcoholFree: '12m' } }, 'alcoholFree')).toBe('12m')
    expect(getWindow({ widgetWindow: { boulderLevel: 'all' } }, 'boulderLevel')).toBe('all')
  })

  it('keeps each card independent', () => {
    // The point of per-card windows: 12 months of drinking beside 30 days of cardio.
    var profile = { widgetWindow: { alcoholFree: '12m', cardioStats: '30d' } }
    expect(getWindow(profile, 'alcoholFree')).toBe('12m')
    expect(getWindow(profile, 'cardioStats')).toBe('30d')
  })

  it('treats a missing or empty profile as defaults', () => {
    expect(getWindow(null, 'cardioStats')).toBe('90d')
    expect(getWindow(undefined, 'alcoholFree')).toBe('90d')
    expect(getWindow({ widgetWindow: {} }, 'ropeLevel')).toBe('90d')
  })

  it('falls back when the stored window is not one this card offers', () => {
    // Guards a card whose chips change under a stored value — the level cards
    // have never offered 12m, and cardio's old 7d chip is gone.
    expect(getWindow({ widgetWindow: { boulderLevel: '12m' } }, 'boulderLevel')).toBe('90d')
    expect(getWindow({ widgetWindow: { cardioStats: '7d' } }, 'cardioStats')).toBe('90d')
    expect(getWindow({ widgetWindow: { cardioStats: 'nonsense' } }, 'cardioStats')).toBe('90d')
  })

  it('returns null for a widget with no windows', () => {
    expect(getWindow({}, 'trainingLoad')).toBe(null)
  })
})

describe('setWindow', () => {
  it('returns a new map carrying the choice', () => {
    var profile = { widgetWindow: { alcoholFree: '30d' } }
    var next = setWindow(profile, 'cardioStats', '12m')
    expect(next).toEqual({ alcoholFree: '30d', cardioStats: '12m' })
  })

  it('never mutates the profile it was given', () => {
    var map = { cardioStats: '90d' }
    setWindow({ widgetWindow: map }, 'cardioStats', '30d')
    expect(map).toEqual({ cardioStats: '90d' })
  })

  it('ignores a window the card does not offer', () => {
    var map = { cardioStats: '90d' }
    expect(setWindow({ widgetWindow: map }, 'cardioStats', '7d')).toEqual(map)
    expect(setWindow({ widgetWindow: map }, 'boulderLevel', '30d')).toEqual(map)
    expect(setWindow({ widgetWindow: map }, 'trainingLoad', '90d')).toEqual(map)
  })

  it('handles a profile with no windows stored yet', () => {
    expect(setWindow(null, 'cardioStats', '30d')).toEqual({ cardioStats: '30d' })
    expect(setWindow({}, 'alcoholFree', '12m')).toEqual({ alcoholFree: '12m' })
  })
})

describe('windowDays', () => {
  it('gives the length of each shared window', () => {
    expect(windowDays('30d')).toBe(30)
    expect(windowDays('90d')).toBe(90)
    expect(windowDays('12m')).toBe(365)
  })

  it('has no length for all time, or for anything unknown', () => {
    expect(windowDays('all')).toBe(null)
    expect(windowDays('12w')).toBe(null)
    expect(windowDays(undefined)).toBe(null)
  })
})

describe('WINDOW_OPTIONS', () => {
  it('speaks one vocabulary on the cards that summarise a window', () => {
    expect(WINDOW_OPTIONS.cardioStats).toEqual(['30d', '90d', '12m'])
    expect(WINDOW_OPTIONS.alcoholFree).toEqual(['30d', '90d', '12m'])
  })

  it('keeps all-time on the level cards, which ask a different question', () => {
    expect(WINDOW_OPTIONS.boulderLevel).toEqual(['90d', 'all'])
    expect(WINDOW_OPTIONS.ropeLevel).toEqual(['90d', 'all'])
  })
})
