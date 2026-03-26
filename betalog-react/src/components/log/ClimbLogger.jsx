import { useState } from 'react'
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

const DEFAULT_ACCENT = '#c0622a'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveSessionDiscipline(climbs) {
  if (!climbs.length) return null
  var first  = climbs[0].discipline
  var allSame = climbs.every(function (c) { return c.discipline === first })
  return allSame ? first : null
}

// ---------------------------------------------------------------------------
// ClimbLogger
// ---------------------------------------------------------------------------

/**
 * Inline climb-session logger.
 * Discipline stays selected between climbs; grade resets after each log.
 *
 * @param {{ onSaved: () => void }} props
 */
export default function ClimbLogger({ onSaved }) {
  const { addSession } = useSessions()

  const [climbs,     setClimbs]     = useState([])
  const [discipline, setDiscipline] = useState(null)
  const [grade,      setGrade]      = useState(null)
  const [difficulty, setDifficulty] = useState(null)
  const [notes,      setNotes]      = useState('')
  const [location,   setLocation]   = useState('')
  const [date,       setDate]       = useState(function () { return new Date().toISOString().slice(0, 10) })
  const [error,      setError]      = useState(null)

  var discMeta = discipline ? DISCIPLINES.find(function (d) { return d.value === discipline }) : null
  var accent   = discMeta ? discMeta.accent : DEFAULT_ACCENT

  function pickDiscipline(val) {
    setDiscipline(val)
    setGrade(null)   // grade list changes, reset selection
  }

  function logClimb(outcome) {
    if (!discipline || !grade) return
    var climb = {
      id:          uuid(),
      grade:       grade,
      gradeSystem: discMeta.gradeSystem,
      discipline:  discipline,
      outcome:     outcome,
      attempts:    1,
      routeId:     null,
      gymId:       null,
      centreId:    null,
    }
    setClimbs(function (prev) { return [climb].concat(prev) })
    setGrade(null)   // reset grade for next climb
    setError(null)
  }

  function removeClimb(id) {
    setClimbs(function (prev) { return prev.filter(function (c) { return c.id !== id }) })
  }

  function handleSave() {
    if (!climbs.length) { setError('Log at least one climb first'); return }
    if (!difficulty)    { setError('Select a session feel to save'); return }

    // Stamp location onto each climb
    var loc = location.trim() || null
    var stampedClimbs = climbs.slice().reverse().map(function (c) {
      return Object.assign({}, c, { location: loc })
    })

    var ts = new Date().toISOString()
    addSession({
      date:        date || ts.slice(0, 10),
      type:        'climb',
      discipline:  deriveSessionDiscipline(climbs),
      routineId:   null,
      routineName: null,
      difficulty:  difficulty,
      notes:       notes,
      location:    loc,
      exercises:   [],
      climbs:      stampedClimbs,
      hangGrips:   [],
    })

    // Reset for next session (keep location — likely same venue next time)
    setClimbs([])
    setDiscipline(null)
    setGrade(null)
    setDifficulty(null)
    setNotes('')
    setDate(new Date().toISOString().slice(0, 10))
    setError(null)
    window.scrollTo(0, 0)
    onSaved()
  }

  var canLog  = !!discipline && !!grade
  var canSave = climbs.length > 0 && !!difficulty

  return (
    <div className="flex flex-col gap-0">

      {/* Discipline selector */}
      <div className="px-4 pb-3">
        <div className="flex gap-2">
          {DISCIPLINES.map(function (d) {
            var active = discipline === d.value
            return (
              <button
                key={d.value}
                onClick={function () { pickDiscipline(d.value) }}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors border-2"
                style={
                  active
                    ? { background: d.accent, borderColor: d.accent, color: '#fff',    fontFamily: "'Barlow Condensed', sans-serif" }
                    : { background: '#f8f9fc', borderColor: '#e5e7ef', color: '#7a8299', fontFamily: "'Barlow Condensed', sans-serif" }
                }
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grade chips */}
      {discMeta ? (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {discMeta.grades.map(function (g) {
              var active = grade === g
              return (
                <button
                  key={g}
                  onClick={function () { setGrade(g) }}
                  className="px-3 py-1.5 rounded-full text-sm font-bold transition-colors border"
                  style={
                    active
                      ? { background: accent, borderColor: accent, color: '#fff',    fontFamily: "'Barlow Condensed', sans-serif" }
                      : { background: '#fff',  borderColor: '#e5e7ef', color: '#1a1d2e', fontFamily: "'Barlow Condensed', sans-serif" }
                  }
                >
                  {g}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <p className="text-sm text-[#bbbcc8] text-center py-2">Pick a discipline to see grades</p>
        </div>
      )}

      {/* Outcome buttons */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          {OUTCOMES.map(function (o) {
            return (
              <button
                key={o.value}
                onClick={function () { logClimb(o.value) }}
                disabled={!canLog}
                className="flex-1 py-2.5 rounded-xl text-base font-bold transition-colors"
                style={
                  canLog
                    ? { background: o.fill, color: '#fff',     fontFamily: "'Barlow Condensed', sans-serif" }
                    : { background: '#f4f5f9', color: '#bbbcc8', fontFamily: "'Barlow Condensed', sans-serif", cursor: 'not-allowed' }
                }
              >
                {o.label}
              </button>
            )
          })}
        </div>
        {!discMeta && (
          <p className="text-xs text-[#bbbcc8] text-center mt-2">
            Select discipline + grade first
          </p>
        )}
        {discMeta && !grade && (
          <p className="text-xs text-[#bbbcc8] text-center mt-2">
            Pick a grade and log the sendage
          </p>
        )}
      </div>

      {/* Logged climbs */}
      {climbs.length > 0 && (
        <div className="bg-white rounded-2xl mx-4 overflow-hidden border border-[#e5e7ef] mb-4">
          <div className="px-4 py-2 bg-[#f8f9fc] border-b border-[#e5e7ef]">
            <p
              className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              This session · {climbs.length} climb{climbs.length !== 1 ? 's' : ''}
            </p>
          </div>
          {climbs.map(function (c) {
            var outMeta  = OUTCOMES.find(function (o) { return o.value === c.outcome })
            var discLabel = DISCIPLINES.find(function (d) { return d.value === c.discipline })
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f1f5] last:border-0">
                <span
                  className="font-bold text-sm text-[#1a1d2e] w-12 shrink-0"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {c.grade}
                </span>
                <span className="text-xs text-[#7a8299] flex-1">
                  {discLabel ? discLabel.label : ''}
                </span>
                <span
                  className="text-xs font-semibold shrink-0"
                  style={{ color: outMeta ? outMeta.fill : '#7a8299' }}
                >
                  {outMeta ? outMeta.label : c.outcome}
                </span>
                <button
                  onClick={function () { removeClimb(c.id) }}
                  className="p-1 rounded-lg text-[#bbbcc8] hover:text-[#e11d48] hover:bg-[#fff5f5] transition-colors ml-1 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Session footer */}
      <div className="mx-4 bg-white rounded-2xl border border-[#e5e7ef] px-4 pt-4 pb-4 flex flex-col gap-3 mb-4">
        <div>
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
                  style={
                    active
                      ? { background: DIFFICULTY_FILL[n], borderColor: DIFFICULTY_FILL[n], color: '#fff' }
                      : { background: '#f8f9fc', borderColor: '#e5e7ef', color: '#7a8299' }
                  }
                >
                  <span
                    className="text-sm font-bold leading-none"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {n}
                  </span>
                  <span className="text-[9px] font-semibold leading-tight text-center">
                    {DIFFICULTY_LABELS[n - 1]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Location */}
        <input
          value={location}
          onChange={function (e) { setLocation(e.target.value) }}
          placeholder="Where did you climb? (optional)"
          className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#c0622a] transition-colors"
        />

        <textarea
          value={notes}
          onChange={function (e) { setNotes(e.target.value) }}
          placeholder="Anything to note about this session..."
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#c0622a] resize-none transition-colors"
        />

        {/* Date */}
        <div className="flex items-center justify-between px-1">
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

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl text-white font-bold transition-opacity"
          style={{
            background: accent,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize:   '16px',
            opacity:    canSave ? 1 : 0.45,
          }}
        >
          Save Session
        </button>
      </div>

    </div>
  )
}
