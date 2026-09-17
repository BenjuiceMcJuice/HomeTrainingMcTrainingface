/**
 * Hangboard timer — the state machine and the sound-cue schedule.
 *
 * Pure: no React, no DOM. `HangboardTimer.jsx` owns the clock and the Web
 * Audio graph; this file decides what the next state is and which cue sounds
 * at which second boundary, so both can be tested.
 *
 * Why the cues are booked ahead (2026-09-17): the tone used to be played by
 * an effect that ran after the number had already painted, and on top of that
 * came the audio output latency — small on the speaker, 150–250 ms on
 * Bluetooth headphones. So the beep always trailed the number. Now each
 * boundary's cue is scheduled on the audio clock before it lands, offset by
 * the latency the browser reports plus a user-set correction (Settings ›
 * Beep timing), so it reaches the ear as the number changes.
 */

export var GET_READY_SECS = 15

/** How far ahead of a boundary the tick books its cue, before the lead. */
export var BOOK_AHEAD_MS = 300

/** Ceiling on the user offset — anything past this is a broken setting, not headphones. */
export var MAX_OFFSET_MS = 500

export function initialState() {
  return { phase: 'preview', gripIdx: 0, setIdx: 0, repIdx: 0, timeLeft: 0 }
}

export function nextTimerState(s, grips) {
  var grip = grips[s.gripIdx]

  if (s.phase === 'ready') {
    return Object.assign({}, s, { phase: 'hanging', repIdx: 0, timeLeft: grip.activeSecs })
  }

  if (s.phase === 'hanging') {
    var nextRep = s.repIdx + 1
    if (nextRep < grip.reps) {
      return Object.assign({}, s, { phase: 'rep-rest', repIdx: nextRep, timeLeft: grip.restSecs })
    }
    var nextSet = s.setIdx + 1
    if (nextSet < grip.sets) {
      return Object.assign({}, s, { phase: 'set-rest', setIdx: nextSet, repIdx: 0, timeLeft: grip.setRest })
    }
    var nextGrip = s.gripIdx + 1
    if (nextGrip < grips.length) {
      var gripRestSecs = grip.gripRest != null ? grip.gripRest : 30
      // Advance gripIdx now so the diagram shows the upcoming grip during the rest
      return Object.assign({}, s, {
        phase:    'grip-rest',
        gripIdx:  nextGrip,
        setIdx:   0,
        repIdx:   0,
        timeLeft: gripRestSecs,
      })
    }
    return Object.assign({}, s, { phase: 'done', timeLeft: 0 })
  }

  if (s.phase === 'rep-rest') {
    return Object.assign({}, s, { phase: 'hanging', timeLeft: grip.activeSecs })
  }

  if (s.phase === 'set-rest') {
    return Object.assign({}, s, { phase: 'hanging', repIdx: 0, timeLeft: grip.activeSecs })
  }

  if (s.phase === 'grip-rest') {
    return Object.assign({}, s, { phase: 'hanging', repIdx: 0, timeLeft: grip.activeSecs })
  }

  return s
}

var START_CUE = {
  ready:       'readyStart',
  hanging:     'hangStart',
  'rep-rest':  'restStart',
  'set-rest':  'setRestStart',
  'grip-rest': 'setRestStart',
  done:        'done',
}

/** The cue that marks a phase beginning, or null for preview. */
export function startCue(phase) {
  return START_CUE[phase] || null
}

/**
 * The cue that sounds `k` seconds into a phase run that started with `ts`
 * (k = 1 is the first boundary, k = ts.timeLeft is the phase ending).
 * Null when nothing sounds there.
 */
export function cueAtBoundary(ts, k, grips) {
  var remaining = ts.timeLeft - k
  if (k < 1 || remaining < 0) return null
  if (remaining > 0) {
    if (remaining > 3) return null
    return ts.phase === 'ready' ? 'countdownTick' : 'lastSeconds'
  }
  return startCue(nextTimerState(ts, grips).phase)
}

/**
 * Boundaries of a phase run that land within `horizonMs` of `now` and have
 * not been booked yet. `anchor` is { at: wall-clock ms, timeLeft: secs }.
 * Returns [{ k, at }] in order; `at` is wall-clock ms.
 */
export function dueBoundaries(anchor, now, bookedUpTo, horizonMs) {
  var out = []
  for (var k = bookedUpTo + 1; k <= anchor.timeLeft; k++) {
    var at = anchor.at + k * 1000
    if (at - now > horizonMs) break
    out.push({ k: k, at: at })
  }
  return out
}

/**
 * Seconds a cue must be scheduled ahead of its boundary so it is heard on it:
 * the latency the audio context reports (base + output, either may be
 * missing) plus the user's correction in ms, clamped to [0, MAX_OFFSET_MS].
 */
export function leadSeconds(ctx, offsetMs) {
  var reported = reportedLatencySeconds(ctx)
  return reported + clampOffset(offsetMs) / 1000
}

export function reportedLatencySeconds(ctx) {
  if (!ctx) return 0
  var base = typeof ctx.baseLatency   === 'number' && isFinite(ctx.baseLatency)   ? ctx.baseLatency   : 0
  var out  = typeof ctx.outputLatency === 'number' && isFinite(ctx.outputLatency) ? ctx.outputLatency : 0
  return Math.max(0, base) + Math.max(0, out)
}

export function clampOffset(offsetMs) {
  var n = Number(offsetMs)
  if (!isFinite(n) || n < 0) return 0
  return Math.min(MAX_OFFSET_MS, Math.round(n))
}
