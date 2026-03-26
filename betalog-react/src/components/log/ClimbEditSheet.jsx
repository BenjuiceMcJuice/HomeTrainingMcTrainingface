import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import useSessions from '../../hooks/useSessions'
import { uuid } from '../../lib/storage'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const V_GRADES      = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V13','V14','V15','V16','V17']
const FRENCH_GRADES = ['4','5','5+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b']

const DISCIPLINES = [
  { value: 'boulder', label: 'Boulder',  grades: V_GRADES,      gradeSystem: 'v',      accent: '#c0622a' },
  { value: 'lead',    label: 'Lead',     grades: FRENCH_GRADES, gradeSystem: 'french', accent: '#4f7ef8' },
  { value: 'toprope', label: 'Top Rope', grades: FRENCH_GRADES, gradeSystem: 'french', accent: '#2a9d5c' },
]

const OUTCOMES = [
  { value: 'flashed', label: 'Flash',   fill: '#2a9d5c' },
  { value: 'sent',    label: 'Send',    fill: '#4f7ef8' },
  { value: 'attempt', label: 'Attempt', fill: '#7a8299' },
  { value: 'project', label: 'Project', fill: '#d4742a' },
]

const DIFFICULTY_LABELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
const DIFFICULTY_FILL   = { 1: '#22c55e', 2: '#eab308', 3: '#f97316', 4: '#ef4444', 5: '#18181b' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveSessionDiscipline(climbs) {
  if (!climbs.length) return null
  var first   = climbs[0].discipline
  var allSame = climbs.every(function (c) { return c.discipline === first })
  return allSame ? first : null
}

const selectCls = 'flex-1 min-w-0 px-2 py-2 rounded-lg border border-[#e5e7ef] bg-white text-sm text-[#1a1d2e] focus:outline-none focus:border-[#4f7ef8] transition-colors appearance-none'

// ---------------------------------------------------------------------------
// ClimbEditSheet
// ---------------------------------------------------------------------------

export default function ClimbEditSheet({ session, open, onClose, onSaved }) {
  const { updateSession } = useSessions()

  const [climbs,      setClimbs]      = useState([])
  const [showAdd,     setShowAdd]     = useState(false)
  const [newDisc,     setNewDisc]     = useState('')
  const [newGrade,    setNewGrade]    = useState('')
  const [newOutcome,  setNewOutcome]  = useState('')
  const [difficulty,  setDifficulty]  = useState(null)
  const [notes,       setNotes]       = useState('')
  const [date,        setDate]        = useState('')
  const [error,       setError]       = useState(null)

  useEffect(function () {
    if (!open || !session) return
    setClimbs(session.climbs.slice().reverse())   // newest-first for display
    setShowAdd(false)
    setNewDisc('')
    setNewGrade('')
    setNewOutcome('')
    setDifficulty(session.difficulty || null)
    setNotes(session.notes || '')
    setDate(session.date || new Date().toISOString().slice(0, 10))
    setError(null)
  }, [open, session])  // eslint-disable-line react-hooks/exhaustive-deps

  var discMeta    = newDisc ? DISCIPLINES.find(function (d) { return d.value === newDisc }) : null
  var gradeList   = discMeta ? discMeta.grades : []

  function handleDiscChange(val) {
    setNewDisc(val)
    setNewGrade('')    // grade list changes
    setNewOutcome('')
  }

  function handleOutcomeChange(val) {
    setNewOutcome(val)
    if (!newDisc || !newGrade || !val) return

    // All three set — auto-add climb and reset selects
    var dm    = DISCIPLINES.find(function (d) { return d.value === newDisc })
    var climb = {
      id:          uuid(),
      grade:       newGrade,
      gradeSystem: dm.gradeSystem,
      discipline:  newDisc,
      outcome:     val,
      attempts:    1,
      routeId:     null,
      gymId:       null,
      centreId:    null,
    }
    setClimbs(function (prev) { return prev.concat([climb]) })
    setNewGrade('')
    setNewOutcome('')
    setShowAdd(false)
    setError(null)
  }

  function removeClimb(id) {
    setClimbs(function (prev) { return prev.filter(function (c) { return c.id !== id }) })
  }

  function handleSave() {
    if (!climbs.length) { setError('Add at least one climb'); return }
    if (!difficulty)    { setError('Select a session feel'); return }

    updateSession(session.id, {
      date:       date,
      discipline: deriveSessionDiscipline(climbs),
      difficulty: difficulty,
      notes:      notes,
      climbs:     climbs.slice().reverse(),   // oldest-first in storage
    })
    onSaved()
    onClose()
  }

  if (!open || !session) return null

  var canSave = climbs.length > 0 && !!difficulty

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#e5e7ef] shrink-0">
          <p className="font-black text-[#1a1d2e]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}>
            Edit Session
          </p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 py-4">

          {/* Climbs list + inline add row */}
          <div className="bg-white rounded-2xl overflow-hidden border border-[#e5e7ef] mb-4">

            {/* Existing climbs */}
            {climbs.length === 0 && (
              <div className="px-4 py-3 text-sm text-[#bbbcc8] text-center">No climbs yet — add one below</div>
            )}
            {climbs.map(function (c) {
              var outMeta   = OUTCOMES.find(function (o) { return o.value === c.outcome })
              var discLabel = DISCIPLINES.find(function (d) { return d.value === c.discipline })
              return (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f0f1f5]">
                  <span className="flex-1 text-sm text-[#7a8299]">{discLabel ? discLabel.label : ''}</span>
                  <span className="flex-1 text-sm font-bold text-[#1a1d2e]"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {c.grade}
                  </span>
                  <span className="flex-1 text-sm font-semibold"
                    style={{ color: outMeta ? outMeta.fill : '#7a8299' }}>
                    {outMeta ? outMeta.label : c.outcome}
                  </span>
                  <button
                    onClick={function () { removeClimb(c.id) }}
                    className="p-1 rounded-lg text-[#bbbcc8] hover:text-[#e11d48] hover:bg-[#fff5f5] transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}

            {/* Add climb */}
            <div className="border-t border-[#e5e7ef]">
              {!showAdd ? (
                <button
                  onClick={function () { setShowAdd(true) }}
                  className="w-full px-4 py-3 text-sm font-semibold text-[#4f7ef8] hover:bg-[#f0f2ff] transition-colors text-left"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  + Add climb
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <select
                    value={newDisc}
                    onChange={function (e) { handleDiscChange(e.target.value) }}
                    className="flex-1 text-sm bg-transparent border-0 focus:outline-none appearance-none"
                    style={{ color: newDisc ? '#1a1d2e' : '#bbbcc8' }}
                  >
                    <option value="" disabled>Climb</option>
                    {DISCIPLINES.map(function (d) {
                      return <option key={d.value} value={d.value}>{d.label}</option>
                    })}
                  </select>

                  <select
                    value={newGrade}
                    onChange={function (e) { setNewGrade(e.target.value); setNewOutcome('') }}
                    disabled={!newDisc}
                    className="flex-1 text-sm font-bold bg-transparent border-0 focus:outline-none appearance-none"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", color: newGrade ? '#1a1d2e' : '#bbbcc8' }}
                  >
                    <option value="" disabled>Grade</option>
                    {gradeList.map(function (g) {
                      return <option key={g} value={g}>{g}</option>
                    })}
                  </select>

                  <select
                    value={newOutcome}
                    onChange={function (e) { handleOutcomeChange(e.target.value) }}
                    disabled={!newGrade}
                    className="flex-1 text-sm font-semibold bg-transparent border-0 focus:outline-none appearance-none"
                    style={{ color: newOutcome ? (OUTCOMES.find(function(o){return o.value===newOutcome})||{fill:'#bbbcc8'}).fill : '#bbbcc8' }}
                  >
                    <option value="" disabled>Result</option>
                    {OUTCOMES.map(function (o) {
                      return <option key={o.value} value={o.value}>{o.label}</option>
                    })}
                  </select>

                  <button
                    onClick={function () { setShowAdd(false); setNewDisc(''); setNewGrade(''); setNewOutcome('') }}
                    className="p-1 rounded-lg text-[#bbbcc8] hover:text-[#7a8299] shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Session feel */}
          <div className="mb-3">
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Session feel
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(function (n) {
                var active = difficulty === n
                return (
                  <button key={n}
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

          {/* Notes */}
          <textarea
            value={notes}
            onChange={function (e) { setNotes(e.target.value) }}
            placeholder="Anything to note about this session..."
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] resize-none transition-colors mb-3"
          />

          {/* Date */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
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

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-white font-bold transition-opacity mb-2"
            style={{
              background: '#4f7ef8',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   '16px',
              opacity:    canSave ? 1 : 0.45,
            }}
          >
            Update Session
          </button>

        </div>
      </div>
    </div>
  )
}
