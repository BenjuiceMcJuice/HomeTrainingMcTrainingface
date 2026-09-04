import { describe, it, expect } from 'vitest'
import { buildTrendGeometry, trendPath, CHART_HEIGHT, EMPTY_HEIGHT } from '../trendChart'

describe('buildTrendGeometry', () => {
  it('zooms the axis onto the data instead of starting at zero', () => {
    const g = buildTrendGeometry([78, 79, 80], {})
    // Bars from zero would put these three within 2% of each other; a zoomed
    // axis is the whole reason this file exists.
    expect(g.lo).toBeGreaterThan(70)
    expect(g.hi).toBeLessThan(85)
    expect(g.min).toBe(78)
    expect(g.max).toBe(80)
    expect(g.points[0].y).toBeCloseTo(((78 - g.lo) / g.span) * CHART_HEIGHT, 5)
    expect(g.points[2].y).toBeGreaterThan(g.points[0].y)
  })

  it('snaps the bounds outward to a readable half-unit', () => {
    const g = buildTrendGeometry([78.3, 79.7], {})
    expect(g.lo).toBe(Math.round(g.lo * 2) / 2)
    expect(g.hi).toBe(Math.round(g.hi * 2) / 2)
    expect(g.lo).toBeLessThanOrEqual(78.3)
    expect(g.hi).toBeGreaterThanOrEqual(79.7)
  })

  it('holds a floor under the span so daily noise stays flat', () => {
    // 300g of variation is a full glass of water, not a trend.
    const g = buildTrendGeometry([78.0, 78.3, 78.1], {})
    expect(g.span).toBeGreaterThanOrEqual(2)
    const spread = Math.max(...g.points.map(p => p.y)) - Math.min(...g.points.map(p => p.y))
    expect(spread).toBeLessThan(CHART_HEIGHT / 4)
  })

  it('leaves gaps as gaps rather than reading them as zero', () => {
    const g = buildTrendGeometry([78, null, 79], {})
    expect(g.points[1]).toBe(null)
    expect(g.count).toBe(2)
    expect(g.firstIndex).toBe(0)
    expect(g.lastIndex).toBe(2)
    expect(g.change).toBe(1)
    // A null must not drag the floor to zero
    expect(g.lo).toBeGreaterThan(70)
  })

  it('collapses when the window holds no readings at all', () => {
    const g = buildTrendGeometry([null, null], {})
    expect(g.isEmpty).toBe(true)
    expect(g.chartHeight).toBe(EMPTY_HEIGHT)
    expect(g.lo).toBe(null)
    expect(g.points).toEqual([null, null])
    expect(g.targetShown).toBe(false)
  })

  it('puts a nearby target on the scale', () => {
    const g = buildTrendGeometry([78, 79], { target: 76 })
    expect(g.targetShown).toBe(true)
    expect(g.target).toBe(76)
    expect(g.lo).toBeLessThanOrEqual(76)
    expect(g.targetY).toBeCloseTo(((76 - g.lo) / g.span) * CHART_HEIGHT, 5)
  })

  it('drops a distant target rather than squashing the data flat', () => {
    const g = buildTrendGeometry([98, 99], { target: 70 })
    expect(g.targetShown).toBe(false)
    expect(g.target).toBe(null)
    expect(g.targetY).toBe(null)
    expect(g.lo).toBeGreaterThan(90)
  })

  it('places points at bucket centres so the line sits over its labels', () => {
    const g = buildTrendGeometry([1, 2, 3, 4], {})
    expect(g.points[0].x).toBeCloseTo(12.5, 5)
    expect(g.points[3].x).toBeCloseTo(87.5, 5)
  })
})

describe('trendPath', () => {
  it('bridges gaps instead of breaking the line at every missed weigh-in', () => {
    const g = buildTrendGeometry([78, null, 79], {})
    const d = trendPath(g.points, g.chartHeight)
    expect(d.startsWith('M ')).toBe(true)
    expect((d.match(/L/g) || []).length).toBe(1)
  })

  it('draws nothing when there is only one point to join', () => {
    const g = buildTrendGeometry([78, null], {})
    expect(trendPath(g.points, g.chartHeight)).toBe('')
  })
})
