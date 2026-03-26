import { useState, useEffect, useRef } from 'react'
import { X, SkipForward, Pause, Play, StopCircle } from 'lucide-react'
import useSessions from '../../hooks/useSessions'
import ConfirmDialog from '../ui/ConfirmDialog'

// ---------------------------------------------------------------------------
// Audio — Web Audio API synthesis, no files needed
// ---------------------------------------------------------------------------

var _audioCtx = null

function getAudioCtx() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) { /* not supported */ }
  }
  return _audioCtx
}

function playTone(freq, durationMs, vol, type) {
  var ctx = getAudioCtx()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()
    var osc  = ctx.createOscillator()
    var gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq || 440
    osc.type = type || 'sine'
    gain.gain.setValueAtTime(vol || 0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.01)
  } catch (e) { /* ignore */ }
}

// Named sound cues
var sounds = {
  countdownTick: function () { playTone(600,  80,  0.25) },
  readyStart:    function () { playTone(880, 280,  0.4)  },  // distinct start beep
  hangStart:     function () { playTone(880, 280,  0.4)  },
  restStart:     function () { playTone(440, 280,  0.3)  },
  setRestStart:  function () {
    playTone(330, 220, 0.3)
    setTimeout(function () { playTone(330, 220, 0.3) }, 280)
  },
  lastSeconds:   function () { playTone(700,  70,  0.2)  },
  done:          function () {
    playTone(523, 150, 0.3)
    setTimeout(function () { playTone(659, 150, 0.3) }, 180)
    setTimeout(function () { playTone(784, 300, 0.35) }, 360)
  },
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_LABELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
const DIFFICULTY_FILL   = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }

const PHASE_META = {
  preview:    { label: '',          bg: '#ffffff', textColor: '#1a1d2e' },
  ready:      { label: 'GET READY', bg: '#1a1d2e', textColor: '#ffffff' },
  hanging:    { label: 'HANG',      bg: '#8b5cf6', textColor: '#ffffff' },
  'rep-rest': { label: 'REST',      bg: '#edfaf2', textColor: '#15803d' },
  'set-rest': { label: 'SET REST',  bg: '#eef1ff', textColor: '#3730a3' },
  done:       { label: 'DONE',      bg: '#f8f9fc', textColor: '#1a1d2e' },
}

const GET_READY_SECS = 15

// ---------------------------------------------------------------------------
// Timer state machine
// ---------------------------------------------------------------------------

function initialState() {
  return { phase: 'preview', gripIdx: 0, setIdx: 0, repIdx: 0, timeLeft: 0 }
}

function nextTimerState(s, grips) {
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
      return Object.assign({}, s, {
        phase:    'hanging',
        gripIdx:  nextGrip,
        setIdx:   0,
        repIdx:   0,
        timeLeft: grips[nextGrip].activeSecs,
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

  return s
}

// ---------------------------------------------------------------------------
// ProgressChips
// ---------------------------------------------------------------------------

function ProgressChips({ ts, grips, phase, paused, textColor }) {
  if (!grips.length) return null

  var grip = grips[ts.gripIdx]
  if (!grip) return null

  var activeChip = 'rep'
  if (phase === 'set-rest') activeChip = 'set'
  if (phase === 'ready')    activeChip = null

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

  const gripsRef    = useRef([])
  const intervalRef = useRef(null)   // track active interval for cleanup

  // Clear the active interval
  function clearTick() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
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

  // Tick — stops when paused, preview, or done
  useEffect(function () {
    if (ts.phase === 'preview' || ts.phase === 'done' || paused) {
      clearTick()
      return
    }

    clearTick()
    intervalRef.current = setInterval(function () {
      setTs(function (curr) {
        if (curr.timeLeft > 1) {
          return Object.assign({}, curr, { timeLeft: curr.timeLeft - 1 })
        }
        return nextTimerState(curr, gripsRef.current)
      })
    }, 1000)

    return clearTick
  }, [ts.phase, ts.gripIdx, paused])  // eslint-disable-line react-hooks/exhaustive-deps

  // Sound — phase transitions
  useEffect(function () {
    if (paused) return
    if (ts.phase === 'hanging')    sounds.hangStart()
    if (ts.phase === 'rep-rest')   sounds.restStart()
    if (ts.phase === 'set-rest')   sounds.setRestStart()
    if (ts.phase === 'done')       sounds.done()
  }, [ts.phase, ts.gripIdx])  // eslint-disable-line react-hooks/exhaustive-deps

  // Sound — countdown ticks (last 3s of ready phase, and last 3s of each hang/rest)
  useEffect(function () {
    if (paused) return
    var inLast3 = ts.timeLeft <= 3 && ts.timeLeft > 0
    if (ts.phase === 'ready' && inLast3) {
      sounds.countdownTick()
    } else if (inLast3 && (ts.phase === 'hanging' || ts.phase === 'rep-rest' || ts.phase === 'set-rest')) {
      sounds.lastSeconds()
    }
  }, [ts.timeLeft])  // eslint-disable-line react-hooks/exhaustive-deps

  function startTimer() {
    getAudioCtx()   // initialise inside a user-gesture so iOS allows audio
    setTs({ phase: 'ready', gripIdx: 0, setIdx: 0, repIdx: 0, timeLeft: GET_READY_SECS })
  }

  function skipPhase() {
    setTs(function (curr) { return nextTimerState(curr, gripsRef.current) })
  }

  function togglePause() {
    setPaused(function (p) { return !p })
  }

  function endAndSave() {
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
  var active = phase === 'ready' || phase === 'hanging' || phase === 'rep-rest' || phase === 'set-rest'

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
