import { useState, useEffect, useRef } from 'react'
import { X, SkipForward, Pause, Play, StopCircle } from 'lucide-react'
import { useData } from '../../App'
import useSessions from '../../hooks/useSessions'
import useWakeLock from '../../hooks/useWakeLock'
import Storage from '../../lib/storage'
import {
  GET_READY_SECS, BOOK_AHEAD_MS, initialState, nextTimerState,
  startCue, cueAtBoundary, dueBoundaries, leadSeconds, reportedLatencySeconds,
} from '../../lib/hangTimer'
import ConfirmDialog from '../ui/ConfirmDialog'
import GripDiagram from './GripDiagram'

// ---------------------------------------------------------------------------
// Audio — Web Audio API synthesis, no files needed
// ---------------------------------------------------------------------------

var _audioCtx = null

function getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    } catch { /* not supported */ }
  }
  return _audioCtx
}

/**
 * Play one tone on the audio clock. `at` is a ctx.currentTime to start at;
 * omitted means now. Returns a handle whose cancel() silences the tone if it
 * has not started yet — the cue was booked ahead and the phase ended early
 * (skip, pause, close).
 */
function playTone(freq, durationMs, vol, at) {
  var ctx = getAudioCtx()
  if (!ctx) return null
  try {
    if (ctx.state === 'suspended') ctx.resume()
    var start  = at != null ? Math.max(at, ctx.currentTime) : ctx.currentTime
    var dur    = durationMs / 1000
    var attack = 0.008   // 8 ms linear ramp removes the onset click

    // Two oscillators: triangle fundamental (warm) + sine octave (shimmer)
    var osc1   = ctx.createOscillator()
    var osc2   = ctx.createOscillator()
    var gain1  = ctx.createGain()
    var gain2  = ctx.createGain()
    var master = ctx.createGain()
    var filt   = ctx.createBiquadFilter()

    osc1.type = 'triangle'
    osc1.frequency.value = freq || 440
    osc2.type = 'sine'
    osc2.frequency.value = (freq || 440) * 2   // octave above

    filt.type = 'lowpass'
    filt.frequency.value = Math.min((freq || 440) * 8, 8000)
    filt.Q.value = 0.8

    osc1.connect(gain1); gain1.connect(filt)
    osc2.connect(gain2); gain2.connect(filt)
    filt.connect(master); master.connect(ctx.destination)

    gain1.gain.value = 1.0
    gain2.gain.value = 0.25   // octave sits quietly behind the fundamental

    // Attack → exponential decay envelope
    master.gain.setValueAtTime(0, start)
    master.gain.linearRampToValueAtTime(vol || 0.5, start + attack)
    master.gain.exponentialRampToValueAtTime(0.0001, start + dur)

    osc1.start(start); osc2.start(start)
    osc1.stop(start + dur + 0.05); osc2.stop(start + dur + 0.05)

    return {
      startAt: start,
      cancel: function () {
        // Disconnecting the output silences a tone that has not begun; one that
        // has is left to finish. The oscillators still stop at their own time.
        try { master.disconnect() } catch { /* already gone */ }
      },
    }
  } catch { /* ignore */ }
  return null
}

// Named sound cues — each a list of [freq, durationMs, vol, offsetSecs].
var CUES = {
  countdownTick: [[600, 120, 0.5,  0]],
  readyStart:    [[880, 300, 0.7,  0]],
  hangStart:     [[880, 300, 0.7,  0]],
  restStart:     [[440, 300, 0.6,  0]],
  setRestStart:  [[330, 260, 0.6,  0], [330, 260, 0.6, 0.30]],
  lastSeconds:   [[700, 120, 0.55, 0]],
  done:          [[523, 200, 0.6,  0], [659, 200, 0.6, 0.22], [784, 400, 0.7, 0.44]],
}

/**
 * Play a named cue, now or at a ctx time. Returns a handle covering every
 * tone in it, or null when there is no audio.
 */
function playCue(name, at) {
  var tones = CUES[name]
  if (!tones) return null
  var ctx = getAudioCtx()
  if (!ctx) return null
  var base = at != null ? at : ctx.currentTime
  var handles = tones.map(function (t) { return playTone(t[0], t[1], t[2], base + t[3]) })
  return {
    startAt: base,
    cancel: function () { handles.forEach(function (h) { if (h) h.cancel() }) },
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
const DIFFICULTY_FILL   = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }

const PHASE_META = {
  preview:     { label: '',           bg: '#ffffff', textColor: '#1a1d2e' },
  ready:       { label: 'GET READY',  bg: '#1a1d2e', textColor: '#ffffff' },
  hanging:     { label: 'HANG',       bg: '#8b5cf6', textColor: '#ffffff' },
  'rep-rest':  { label: 'REST',       bg: '#edfaf2', textColor: '#15803d' },
  'set-rest':  { label: 'SET REST',   bg: '#eef1ff', textColor: '#3730a3' },
  'grip-rest': { label: 'NEXT GRIP',  bg: '#fff7ed', textColor: '#c2410c' },
  done:        { label: 'DONE',       bg: '#f8f9fc', textColor: '#1a1d2e' },
}

// ---------------------------------------------------------------------------
// ProgressChips
// ---------------------------------------------------------------------------

function ProgressChips({ ts, grips, phase, paused, textColor }) {
  if (!grips.length) return null

  var grip = grips[ts.gripIdx]
  if (!grip) return null

  var activeChip = 'rep'
  if (phase === 'set-rest')  activeChip = 'set'
  if (phase === 'grip-rest') activeChip = 'grip'
  if (phase === 'ready')     activeChip = null

  // Use the phase textColor so it works on both dark (purple) and light (green/blue) backgrounds
  var color      = paused ? '#7a8299' : textColor
  var colorFull  = color
  var colorMuted = color + '60'  // ~38% opacity via hex

  var items = [
    { key: 'grip', label: 'Grip', current: ts.gripIdx + 1, total: grips.length },
    { key: 'set',  label: 'Set',  current: ts.setIdx  + 1, total: grip.sets    },
    { key: 'rep',  label: 'Rep',  current: ts.repIdx  + 1, total: grip.reps    },
  ]

  return (
    <div className="flex items-end gap-6 justify-center">
      {items.map(function (item) {
        var isActive = item.key === activeChip && !paused
        return (
          <div key={item.key} className="flex flex-col items-center">
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   '13px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: isActive ? colorFull : colorMuted,
              textTransform: 'uppercase',
            }}>
              {item.label}
            </span>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   isActive ? '72px' : '48px',
              fontWeight: 900,
              color:      isActive ? colorFull : colorMuted,
              lineHeight: 1,
            }}>
              {item.current}
            </span>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   '16px',
              fontWeight: 700,
              color:      colorMuted,
            }}>
              of {item.total}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HangboardTimer
// ---------------------------------------------------------------------------

export default function HangboardTimer({ routine, open, onClose, onSaved }) {
  const { addSession } = useSessions()

  const [ts,          setTs]          = useState(initialState)
  const [paused,      setPaused]      = useState(false)
  const [difficulty,  setDifficulty]  = useState(null)
  const [notes,       setNotes]       = useState('')
  const [date,        setDate]        = useState(() => new Date().toISOString().slice(0, 10))
  const [error,       setError]       = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const gripsRef      = useRef([])
  const intervalRef   = useRef(null)   // track active interval for cleanup
  const boundaryRef   = useRef(null)   // one-shot timeout aimed at the next second boundary

  // The audio lead — Settings › Beep timing. Read through a ref so the tick
  // closure always sees the current value without re-arming.
  const { data }      = useData()
  const offsetRef     = useRef(0)
  offsetRef.current   = (data && data.audioOffsetMs) || 0

  // Set by the tick when it has already booked the cue for a phase change, so
  // the phase-change effect below does not play it a second time.
  const transitionBookedRef = useRef(false)

  // Keep the screen on while a set is running (paused included — the climber is
  // still on the board). Released on done, close, or unmount.
  useWakeLock(Boolean(open) && ts.phase !== 'preview' && ts.phase !== 'done')
  const phaseStartRef = useRef(null)   // { at: Date.now(), timeLeft: n } — wall-clock anchor for current phase run

  // Clear the active interval
  function clearTick() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (boundaryRef.current) {
      clearTimeout(boundaryRef.current)
      boundaryRef.current = null
    }
  }

  // Full cleanup — interval + (optionally) audio context
  function cleanup() {
    clearTick()
    // Don't close the AudioContext — restarting it after close is unreliable on iOS.
    // Just let it sit idle; it costs nothing when silent.
  }

  // Reset when opened
  useEffect(function () {
    if (!open || !routine) return
    gripsRef.current = routine.grips || []
    setTs(initialState())
    setPaused(false)
    setDifficulty(null)
    setNotes('')
    setDate(new Date().toISOString().slice(0, 10))
    setError(null)
    setConfirmOpen(false)
    return cleanup  // cleanup if routine/open changes mid-session
  }, [open, routine])  // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(function () {
    return cleanup
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Tick — stops when paused, preview, or done.
  //
  // Two jobs, both anchored to the wall clock so a throttled tab snaps back
  // to the right remaining time rather than drifting:
  //   1. the display — a one-shot timeout aimed at the next second boundary
  //      flips the number on it; a 100 ms poll is the safety net behind it.
  //   2. the cues — each boundary's tone is booked on the audio clock
  //      BOOK_AHEAD_MS before it lands, minus the audio lead, so the beep
  //      reaches the ear as the number changes rather than after it.
  useEffect(function () {
    if (ts.phase === 'preview' || ts.phase === 'done' || paused) {
      clearTick()
      return
    }

    var anchor  = { at: Date.now(), timeLeft: ts.timeLeft }
    var runTs   = ts                 // the state this run started from — cues read from it
    var grips   = gripsRef.current
    var booked  = 0                  // highest boundary k with its cue booked
    var pending = []                 // booked cues that may still need cancelling
    phaseStartRef.current = anchor

    function sync() {
      var start = phaseStartRef.current
      if (!start) return

      var elapsed   = Math.floor((Date.now() - start.at) / 1000)
      var remaining = start.timeLeft - elapsed

      if (remaining > 0) {
        setTs(function (curr) {
          if (remaining === curr.timeLeft) return curr   // no change, skip re-render
          return Object.assign({}, curr, { timeLeft: remaining })
        })
        // Aim at the next boundary; a few ms late so floor() has crossed it
        if (boundaryRef.current) clearTimeout(boundaryRef.current)
        var nextAt = start.at + (elapsed + 1) * 1000
        boundaryRef.current = setTimeout(sync, Math.max(0, nextAt - Date.now()) + 4)
        return
      }

      // Phase expired — advance once and prevent re-entry until the effect re-fires
      phaseStartRef.current = null
      setTs(function (curr) { return nextTimerState(curr, grips) })
    }

    function book() {
      if (!phaseStartRef.current) return
      var ctx = getAudioCtx()
      if (!ctx) return
      if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(function () {})

      var now  = Date.now()
      var lead = leadSeconds(ctx, offsetRef.current)
      dueBoundaries(anchor, now, booked, BOOK_AHEAD_MS + lead * 1000).forEach(function (b) {
        booked = b.k
        var cue = cueAtBoundary(runTs, b.k, grips)
        if (!cue) return
        var at = ctx.currentTime + (b.at - now) / 1000 - lead
        var handle = playCue(cue, at)
        if (!handle) return
        var isTransition = b.k === anchor.timeLeft
        pending.push({ handle: handle, isTransition: isTransition })
        if (isTransition) transitionBookedRef.current = true
      })
    }

    // Remember what this device reports, for the Settings row
    Storage.saveAudioLatencyMs(Math.round(reportedLatencySeconds(getAudioCtx()) * 1000))

    clearTick()
    sync()
    book()
    intervalRef.current = setInterval(function () { sync(); book() }, 100)

    return function () {
      clearTick()
      // A cue booked for a boundary this run never reached must not sound
      var ctx = getAudioCtx()
      var nowCtx = ctx ? ctx.currentTime : 0
      pending.forEach(function (p) {
        if (p.handle.startAt > nowCtx + 0.005) {
          p.handle.cancel()
          if (p.isTransition) transitionBookedRef.current = false
        }
      })
    }
  }, [ts.phase, ts.gripIdx, paused])  // eslint-disable-line react-hooks/exhaustive-deps

  // Sound — a phase the climber started by hand (Start, Skip, End) gets its
  // cue now. A phase the clock reached had its cue booked ahead by the tick.
  useEffect(function () {
    if (paused) return
    if (transitionBookedRef.current) { transitionBookedRef.current = false; return }
    var cue = startCue(ts.phase)
    if (cue) playCue(cue)
  }, [ts.phase, ts.gripIdx])  // eslint-disable-line react-hooks/exhaustive-deps

  function startTimer() {
    getAudioCtx()   // initialise inside a user-gesture so iOS allows audio
    setTs({ phase: 'ready', gripIdx: 0, setIdx: 0, repIdx: 0, timeLeft: GET_READY_SECS })
  }

  function skipPhase() {
    phaseStartRef.current = null   // stop the running interval from processing this phase
    setTs(function (curr) { return nextTimerState(curr, gripsRef.current) })
  }

  function togglePause() {
    var nowPausing = !paused
    if (nowPausing) phaseStartRef.current = null   // prevent a stale tick transitioning while pausing
    setPaused(nowPausing)
  }

  function endAndSave() {
    phaseStartRef.current = null
    clearTick()
    setPaused(true)
    setTs(function (curr) { return Object.assign({}, curr, { phase: 'done', timeLeft: 0 }) })
  }

  function handleCancel() {
    setConfirmOpen(true)
  }

  function doDiscard() {
    cleanup()
    onClose()
  }

  function handleClose() {
    var phase = ts.phase
    if (phase === 'preview' || phase === 'done') {
      cleanup()
      onClose()
      return
    }
    handleCancel()
  }

  function handleSave() {
    if (!difficulty) { setError('Select a session feel'); return }
    addSession({
      date:        date,
      type:        'hangboard',
      discipline:  null,
      routineId:   routine.id,
      routineName: routine.name === 'Free Hang' ? null : routine.name,
      difficulty:  difficulty,
      notes:       notes,
      exercises:   [],
      climbs:      [],
      hangGrips:   routine.grips || [],
    })
    cleanup()
    onSaved()
    onClose()
  }

  if (!open || !routine) return null

  var grips  = routine.grips || []
  var grip   = grips[ts.gripIdx]
  var phase  = ts.phase
  var meta   = PHASE_META[phase] || PHASE_META.preview
  var active = phase === 'ready' || phase === 'hanging' || phase === 'rep-rest' || phase === 'set-rest' || phase === 'grip-rest'

  // Progress bar — rep-based
  var totalReps = grips.reduce(function (acc, g) { return acc + g.reps * g.sets }, 0)
  var completedReps = 0
  if (active && grip) {
    for (var i = 0; i < ts.gripIdx; i++) {
      completedReps += grips[i].reps * grips[i].sets
    }
    completedReps += ts.setIdx * grip.reps + ts.repIdx
  }
  var progressPct = totalReps > 0 ? (completedReps / totalReps) * 100 : 0

  function ctrlBtnStyle(accent) {
    return {
      background: accent || 'rgba(0,0,0,0.10)',
      color:      meta.textColor,
      fontFamily: "'Barlow Condensed', sans-serif",
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{
        background:           paused ? '#f4f5f9' : meta.bg,
        transition:           'background 0.25s',
        paddingBottom:        'env(safe-area-inset-bottom)',
        paddingLeft:          'env(safe-area-inset-left)',
        paddingRight:         'env(safe-area-inset-right)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <p
          className="font-black truncate"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize:   '20px',
            color:      paused ? '#1a1d2e' : meta.textColor,
          }}
        >
          {routine.name}{paused ? ' — Paused' : ''}
        </p>
        <button
          onClick={handleClose}
          className="p-2 rounded-xl transition-colors shrink-0"
          style={{ color: paused ? '#7a8299' : meta.textColor, background: 'rgba(0,0,0,0.06)' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* ── PREVIEW ── */}
      {phase === 'preview' && (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="bg-white rounded-2xl border border-[#e5e7ef] overflow-hidden mb-5">
            {grips.map(function (g, i) {
              return (
                <div key={g.id || i} className="flex items-center gap-3 px-4 py-3 border-b border-[#f0f1f5] last:border-0">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: '#f0f1f5', color: '#7a8299' }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1d2e] truncate">{g.gripName}</p>
                    <p className="text-xs text-[#7a8299] mt-0.5">
                      {g.sets}×{g.reps} · {g.activeSecs}s on / {g.restSecs}s off
                    </p>
                  </div>
                  <span className="text-xs text-[#bbbcc8] shrink-0"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {g.activeSecs * g.reps * g.sets}s total
                  </span>
                </div>
              )
            })}
          </div>

          <button
            onClick={startTimer}
            className="w-full py-4 rounded-2xl text-white font-black text-xl shadow-lg transition-transform active:scale-95"
            style={{ background: '#8b5cf6', fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Start Timer
          </button>
        </div>
      )}

      {/* ── ACTIVE TIMER ── */}
      {active && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-2">

          {/* Grip diagram */}
          {grip && (
            <GripDiagram
              grip={grip}
              color={paused ? '#7a8299' : meta.textColor}
              dimColor={paused ? '#c4c8d4' : meta.textColor + '35'}
            />
          )}

          {/* Phase label — large */}
          <p
            className="font-black uppercase tracking-widest leading-none"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   '52px',
              color:      paused ? '#bbbcc8' : meta.textColor,
            }}
          >
            {paused ? 'PAUSED' : meta.label}
          </p>

          {/* Big countdown */}
          <p
            className="font-black leading-none"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   '108px',
              color:      paused ? '#bbbcc8' : meta.textColor,
              lineHeight: 1,
            }}
          >
            {ts.timeLeft}
          </p>

          {/* Grip name */}
          {grip && (
            <p
              className="font-bold text-center"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize:   '26px',
                color:      paused ? '#7a8299' : meta.textColor,
              }}
            >
              {grip.gripName}
            </p>
          )}

          {/* Skip (Get Ready only) */}
          {phase === 'ready' && !paused && (
            <button
              onClick={skipPhase}
              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors mt-1"
              style={{ color: meta.textColor, opacity: 0.55, background: 'rgba(0,0,0,0.08)', fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Skip
            </button>
          )}

          {/* Progress */}
          <div className="mt-2">
            <ProgressChips ts={ts} grips={grips} phase={phase} paused={paused} textColor={meta.textColor} />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3 mt-5">
            {/* Pause / Resume */}
            <button
              onClick={togglePause}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              style={ctrlBtnStyle(paused ? 'rgba(139,92,246,0.15)' : 'rgba(0,0,0,0.10)')}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            {/* Skip phase — hidden while paused or in Get Ready (has its own skip) */}
            {!paused && phase !== 'ready' && (
              <button
                onClick={skipPhase}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                style={ctrlBtnStyle()}
              >
                <SkipForward size={16} />
                Skip
              </button>
            )}

            {/* End & Save */}
            <button
              onClick={endAndSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              style={{
                background: 'rgba(0,0,0,0.10)',
                color:      paused ? '#1a1d2e' : meta.textColor,
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >
              <StopCircle size={16} />
              End
            </button>
          </div>

          {/* Cancel session link */}
          <button
            onClick={handleCancel}
            className="text-xs font-semibold mt-2 px-4 py-1.5 rounded-lg transition-colors"
            style={{ color: paused ? '#e11d48' : meta.textColor, opacity: 0.45, fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Cancel session
          </button>
        </div>
      )}

      {/* ── DONE ── */}
      {phase === 'done' && (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="flex flex-col items-center gap-1 py-8">
            <p
              className="font-black text-[#1a1d2e]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px' }}
            >
              Session complete
            </p>
            <p className="text-sm text-[#7a8299]">
              {grips.length} grip{grips.length !== 1 ? 's' : ''} · log it below
            </p>
          </div>

          {/* Session feel */}
          <div className="mb-3">
            <p
              className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Session feel
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(function (n) {
                var active = difficulty === n
                return (
                  <button
                    key={n}
                    onClick={function () { setDifficulty(n); setError(null) }}
                    className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition-colors"
                    style={active
                      ? { background: DIFFICULTY_FILL[n], borderColor: DIFFICULTY_FILL[n], color: '#fff' }
                      : { background: '#f8f9fc', borderColor: '#e5e7ef', color: '#7a8299' }
                    }
                  >
                    <span className="text-sm font-bold leading-none"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{n}</span>
                    <span className="text-[9px] font-semibold leading-tight text-center">{DIFFICULTY_LABELS[n - 1]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <textarea
            value={notes}
            onChange={function (e) { setNotes(e.target.value) }}
            placeholder="Anything to note about this session..."
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#8b5cf6] resize-none transition-colors mb-3"
          />

          <div className="flex items-center justify-between px-1 mb-3">
            <span
              className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-wide"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Session date
            </span>
            <input
              type="date"
              value={date}
              onChange={function (e) { setDate(e.target.value) }}
              className="text-xs text-[#7a8299] border-0 bg-transparent focus:outline-none focus:text-[#1a1d2e] transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-white font-bold transition-opacity mb-3"
            style={{
              background:  '#8b5cf6',
              fontFamily:  "'Barlow Condensed', sans-serif",
              fontSize:    '16px',
              opacity:     difficulty ? 1 : 0.45,
            }}
          >
            Save Session
          </button>

          <button
            onClick={function () { cleanup(); onClose() }}
            className="w-full py-2 rounded-xl text-[#e11d48] text-sm font-semibold border border-[#fee2e2] hover:bg-[#fff5f5] transition-colors"
          >
            Cancel session
          </button>
        </div>
      )}

      {/* Progress bar */}
      {active && (
        <div className="shrink-0 w-full" style={{ height: '3px', background: meta.textColor + '25' }}>
          <div
            style={{
              height: '100%',
              width: progressPct + '%',
              background: meta.textColor,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel session?"
        message="Nothing will be saved."
        confirmLabel="Cancel session"
        danger
        onConfirm={doDiscard}
        onCancel={function () { setConfirmOpen(false) }}
      />
    </div>
  )
}
