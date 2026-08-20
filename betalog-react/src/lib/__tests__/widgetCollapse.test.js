import { describe, it, expect } from 'vitest'
import { COLLAPSE_DEFAULTS, isCollapsed, toggleCollapsed } from '../widgetCollapse'

describe('isCollapsed', () => {
  it('falls back to the default when the user has never touched the widget', () => {
    expect(isCollapsed({}, 'alcoholFree')).toBe(true)      // chart-heavy
    expect(isCollapsed({}, 'trainingLoad')).toBe(false)    // glanceable
    expect(isCollapsed({}, 'activityCalendar')).toBe(true)
    expect(isCollapsed({}, 'cardioStats')).toBe(true)
  })

  it('lets a stored value win over the default, in both directions', () => {
    // The regression this guards: `map[key] || DEFAULT[key]` would re-collapse
    // a chart widget on every load once the user expanded it.
    expect(isCollapsed({ widgetCollapsed: { alcoholFree: false } }, 'alcoholFree')).toBe(false)
    expect(isCollapsed({ widgetCollapsed: { trainingLoad: true } }, 'trainingLoad')).toBe(true)
  })

  it('treats a missing or empty profile as defaults', () => {
    expect(isCollapsed(null, 'alcoholFree')).toBe(true)
    expect(isCollapsed(undefined, 'trainingLoad')).toBe(false)
    expect(isCollapsed({ widgetCollapsed: {} }, 'cardioStats')).toBe(true)
  })

  it('defaults an unknown widget to expanded', () => {
    expect(isCollapsed({}, 'somethingNew')).toBe(false)
  })
})

describe('toggleCollapsed', () => {
  it('flips a widget away from its default', () => {
    expect(toggleCollapsed({}, 'alcoholFree')).toEqual({ alcoholFree: false })
    expect(toggleCollapsed({}, 'trainingLoad')).toEqual({ trainingLoad: true })
  })

  it('flips a stored value back', () => {
    var profile = { widgetCollapsed: { alcoholFree: false } }
    expect(toggleCollapsed(profile, 'alcoholFree')).toEqual({ alcoholFree: true })
  })

  it('preserves other widgets and does not mutate the stored map', () => {
    var stored  = { alcoholFree: false, cardioStats: true }
    var profile = { widgetCollapsed: stored }
    var next    = toggleCollapsed(profile, 'alcoholFree')
    expect(next).toEqual({ alcoholFree: true, cardioStats: true })
    expect(stored).toEqual({ alcoholFree: false, cardioStats: true })
    expect(next).not.toBe(stored)
  })

  it('round-trips back to the starting state', () => {
    var once  = toggleCollapsed({}, 'cardioStats')
    var twice = toggleCollapsed({ widgetCollapsed: once }, 'cardioStats')
    expect(isCollapsed({ widgetCollapsed: twice }, 'cardioStats')).toBe(isCollapsed({}, 'cardioStats'))
  })
})

describe('COLLAPSE_DEFAULTS', () => {
  it('folds only the chart-heavy widgets', () => {
    // The level cards joined in phase 3, when the grade-distribution chart was
    // folded into their body. Moving those charts onto the Dashboard only
    // declutters if they arrive collapsed.
    expect(Object.keys(COLLAPSE_DEFAULTS).sort())
      .toEqual(['activityCalendar', 'alcoholFree', 'boulderLevel', 'cardioStats', 'ropeLevel'])
  })

  it('leaves the glanceable widgets expanded', () => {
    ;['trainingLoad', 'gymStats', 'coachTip', 'weight'].forEach((key) => {
      expect(isCollapsed({}, key)).toBe(false)
    })
  })
})
