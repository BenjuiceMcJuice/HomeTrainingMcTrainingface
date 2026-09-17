import { describe, it, expect } from 'vitest'
import {
  nextTimerState, startCue, cueAtBoundary, dueBoundaries,
  leadSeconds, reportedLatencySeconds, clampOffset, MAX_OFFSET_MS,
} from '../hangTimer'

var grips = [
  { gripName: 'Half crimp', activeSecs: 7, restSecs: 3, reps: 2, sets: 2, setRest: 60, gripRest: 30 },
  { gripName: 'Open hand',  activeSecs: 10, restSecs: 5, reps: 1, sets: 1, setRest: 60 },
]

function ts(phase, timeLeft, extra) {
  return Object.assign({ phase: phase, gripIdx: 0, setIdx: 0, repIdx: 0, timeLeft: timeLeft }, extra)
}

describe('nextTimerState', function () {
  it('walks ready → hang → rep-rest → hang → set-rest → … → grip-rest → … → done', function () {
    var s = ts('ready', 15)
    s = nextTimerState(s, grips); expect(s.phase).toBe('hanging');   expect(s.timeLeft).toBe(7)
    s = nextTimerState(s, grips); expect(s.phase).toBe('rep-rest');  expect(s.timeLeft).toBe(3); expect(s.repIdx).toBe(1)
    s = nextTimerState(s, grips); expect(s.phase).toBe('hanging')
    s = nextTimerState(s, grips); expect(s.phase).toBe('set-rest');  expect(s.timeLeft).toBe(60); expect(s.setIdx).toBe(1)
    s = nextTimerState(s, grips); expect(s.phase).toBe('hanging')
    s = nextTimerState(s, grips); expect(s.phase).toBe('rep-rest')
    s = nextTimerState(s, grips); expect(s.phase).toBe('hanging')
    s = nextTimerState(s, grips); expect(s.phase).toBe('grip-rest'); expect(s.gripIdx).toBe(1); expect(s.timeLeft).toBe(30)
    s = nextTimerState(s, grips); expect(s.phase).toBe('hanging');   expect(s.timeLeft).toBe(10)
    s = nextTimerState(s, grips); expect(s.phase).toBe('done');      expect(s.timeLeft).toBe(0)
  })

  it('defaults gripRest to 30 and leaves preview/done alone', function () {
    var s = nextTimerState(ts('hanging', 0, { repIdx: 1, setIdx: 1 }), [grips[0], grips[1]].map(function (g) {
      var c = Object.assign({}, g); delete c.gripRest; return c
    }))
    expect(s.phase).toBe('grip-rest'); expect(s.timeLeft).toBe(30)
    expect(nextTimerState(ts('done', 0), grips).phase).toBe('done')
    expect(nextTimerState(ts('preview', 0), grips).phase).toBe('preview')
  })
})

describe('startCue', function () {
  it('names a cue for every running phase and none for preview', function () {
    expect(startCue('ready')).toBe('readyStart')
    expect(startCue('hanging')).toBe('hangStart')
    expect(startCue('rep-rest')).toBe('restStart')
    expect(startCue('set-rest')).toBe('setRestStart')
    expect(startCue('grip-rest')).toBe('setRestStart')
    expect(startCue('done')).toBe('done')
    expect(startCue('preview')).toBeNull()
  })
})

describe('cueAtBoundary', function () {
  it('is silent until the last three seconds, then ticks, then the next phase starts', function () {
    var s = ts('hanging', 7)
    expect(cueAtBoundary(s, 1, grips)).toBeNull()
    expect(cueAtBoundary(s, 3, grips)).toBeNull()      // 4 left
    expect(cueAtBoundary(s, 4, grips)).toBe('lastSeconds')  // 3 left
    expect(cueAtBoundary(s, 6, grips)).toBe('lastSeconds')  // 1 left
    expect(cueAtBoundary(s, 7, grips)).toBe('restStart')    // 0 left → rep-rest begins
    expect(cueAtBoundary(s, 8, grips)).toBeNull()
    expect(cueAtBoundary(s, 0, grips)).toBeNull()
  })

  it('uses the countdown tick in Get Ready and the hang cue at its end', function () {
    var s = ts('ready', 15)
    expect(cueAtBoundary(s, 11, grips)).toBeNull()
    expect(cueAtBoundary(s, 12, grips)).toBe('countdownTick')
    expect(cueAtBoundary(s, 15, grips)).toBe('hangStart')
  })

  it('ends the last hang with the done fanfare', function () {
    var s = ts('hanging', 10, { gripIdx: 1 })
    expect(cueAtBoundary(s, 10, grips)).toBe('done')
  })

  it('reads a resumed run from its frozen remaining time', function () {
    var s = ts('rep-rest', 2)
    expect(cueAtBoundary(s, 1, grips)).toBe('lastSeconds')
    expect(cueAtBoundary(s, 2, grips)).toBe('hangStart')
  })
})

describe('dueBoundaries', function () {
  var anchor = { at: 10000, timeLeft: 5 }

  it('books only boundaries inside the horizon, in order, once', function () {
    expect(dueBoundaries(anchor, 10000, 0, 300)).toEqual([])
    expect(dueBoundaries(anchor, 10750, 0, 300)).toEqual([{ k: 1, at: 11000 }])
    expect(dueBoundaries(anchor, 10750, 1, 300)).toEqual([])
    expect(dueBoundaries(anchor, 11800, 1, 300)).toEqual([{ k: 2, at: 12000 }])
  })

  it('catches up every missed boundary after a stall, and stops at the phase end', function () {
    expect(dueBoundaries(anchor, 13100, 1, 300)).toEqual([{ k: 2, at: 12000 }, { k: 3, at: 13000 }])
    expect(dueBoundaries(anchor, 99000, 3, 300)).toEqual([{ k: 4, at: 14000 }, { k: 5, at: 15000 }])
    expect(dueBoundaries(anchor, 99000, 5, 300)).toEqual([])
  })
})

describe('leadSeconds', function () {
  it('adds the reported latency and the user offset, in seconds', function () {
    expect(leadSeconds({ baseLatency: 0.01, outputLatency: 0.04 }, 180)).toBeCloseTo(0.23, 6)
    expect(leadSeconds({ baseLatency: 0.01 }, 0)).toBeCloseTo(0.01, 6)
    expect(leadSeconds(null, 100)).toBeCloseTo(0.1, 6)
  })

  it('ignores a missing, negative or non-numeric latency', function () {
    expect(reportedLatencySeconds({ baseLatency: -1, outputLatency: NaN })).toBe(0)
    expect(reportedLatencySeconds({ outputLatency: 'x' })).toBe(0)
    expect(reportedLatencySeconds(undefined)).toBe(0)
  })

  it('clamps the offset to [0, MAX_OFFSET_MS] and rounds it', function () {
    expect(clampOffset(-50)).toBe(0)
    expect(clampOffset('180')).toBe(180)
    expect(clampOffset(180.6)).toBe(181)
    expect(clampOffset(9999)).toBe(MAX_OFFSET_MS)
    expect(clampOffset(undefined)).toBe(0)
    expect(clampOffset(null)).toBe(0)
  })
})
