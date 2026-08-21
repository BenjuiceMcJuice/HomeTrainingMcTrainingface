import { describe, it, expect } from 'vitest'
import { buildBarGeometry, labelledIndices, CHART_HEIGHT, EMPTY_HEIGHT } from '../barChart'

describe('buildBarGeometry', () => {
  it('scales bars against the tallest value plus headroom', () => {
    const g = buildBarGeometry([0, 5, 10], {})
    expect(g.maxValue).toBe(10)
    expect(g.scaleMax).toBe(13)            // 10 * 1.3 headroom
    expect(g.chartHeight).toBe(CHART_HEIGHT)
    // The peak never fills the chart — the headroom is what the value label sits in.
    expect(g.bars[2].height).toBeCloseTo((10 / 13) * CHART_HEIGHT, 5)
    expect(g.bars[1].height).toBeCloseTo((5 / 13) * CHART_HEIGHT, 5)
  })

  it('gives a zero bucket a stub, and a tiny one a floor', () => {
    // Without the floor a real-but-small value renders shorter than the "nothing
    // logged" stub, which reads as less than nothing.
    const g = buildBarGeometry([0, 0.01, 100], {})
    expect(g.bars[0].height).toBe(2)
    expect(g.bars[1].height).toBe(3)
  })

  it('collapses an all-zero window instead of showing empty air', () => {
    const g = buildBarGeometry([0, 0, 0], {})
    expect(g.isEmpty).toBe(true)
    expect(g.chartHeight).toBe(EMPTY_HEIGHT)
    expect(g.bars.every(b => b.height === 2)).toBe(true)
    expect(g.peakIndex).toBe(-1)
  })

  it('labels the most recent bucket when the peak repeats', () => {
    const g = buildBarGeometry([7, 3, 7], {})
    expect(g.peakIndex).toBe(2)
  })

  it('places the guideline inside the chart and flags what is over it', () => {
    const g = buildBarGeometry([10, 20], { guideline: 14 })
    expect(g.scaleMax).toBe(26)            // 20 * 1.3
    expect(g.guidelineY).toBeCloseTo((14 / 26) * CHART_HEIGHT, 5)
    expect(g.bars[0].over).toBe(false)
    expect(g.bars[1].over).toBe(true)
  })

  it('keeps a guideline taller than every bar on the scale', () => {
    // A quiet window must not push the guideline off the top of the chart —
    // it is the reference the bars are read against.
    const g = buildBarGeometry([2, 3], { guideline: 14 })
    expect(g.scaleMax).toBeGreaterThan(14)
    expect(g.guidelineY).not.toBe(null)
  })

  it('drops the guideline on an empty window', () => {
    const g = buildBarGeometry([0, 0], { guideline: 14 })
    expect(g.guidelineY).toBe(null)
  })

  it('has no guideline when none is given', () => {
    const g = buildBarGeometry([1, 2], {})
    expect(g.guideline).toBe(null)
    expect(g.guidelineY).toBe(null)
    expect(g.bars.every(b => b.over === false)).toBe(true)
  })

  it('takes an explicit height', () => {
    const g = buildBarGeometry([5], { height: 100 })
    expect(g.chartHeight).toBe(100)
    expect(g.bars[0].height).toBeCloseTo((5 / 6.5) * 100, 5)
  })

  it('survives an empty, missing or junk series', () => {
    expect(buildBarGeometry([], {}).bars).toEqual([])
    expect(buildBarGeometry(undefined, {}).isEmpty).toBe(true)
    expect(buildBarGeometry([null, undefined, NaN], {}).bars.map(b => b.value)).toEqual([0, 0, 0])
  })
})

describe('labelledIndices', () => {
  it('counts back from the newest bucket, so it is always labelled', () => {
    expect(labelledIndices(5, 2)).toEqual({ 4: true, 2: true, 0: true })
    expect(labelledIndices(13, 3)).toEqual({ 12: true, 9: true, 6: true, 3: true, 0: true })
  })

  it('labels everything at step 1, and treats a junk step as 1', () => {
    expect(labelledIndices(3, 1)).toEqual({ 0: true, 1: true, 2: true })
    expect(labelledIndices(3, 0)).toEqual({ 0: true, 1: true, 2: true })
  })

  it('has nothing to label in an empty series', () => {
    expect(labelledIndices(0, 2)).toEqual({})
  })
})
