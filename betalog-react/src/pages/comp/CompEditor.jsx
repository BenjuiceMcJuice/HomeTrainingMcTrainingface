import { useState, useEffect, useMemo, useRef } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Eye, EyeOff, X, Plus, Wand2 } from 'lucide-react'
import useCompetitions, { useComp } from '../../hooks/useCompetitions'
import useProfile from '../../hooks/useProfile'
import VenuePicker from '../../components/log/VenuePicker'
import NumericStepper from '../../components/ui/NumericStepper'
import { now } from '../../lib/storage'
import {
  newComp, generateProblems, resizeTopTable, validateComp, compType, scoringSentence, compPhase, validateTimeChange,
  COMP_TYPES, DEFAULT_CIRCUITS, DEFAULT_PROBLEM_COUNT, MAX_ATTEMPTS_LIMIT,
} from '../../lib/competition'
import { barlow } from '../../lib/utils'
import { Card, Eyebrow, HowCompsWork } from './CompLayout'
import useNow from '../../hooks/useNow'
import { ConfirmButton } from './CompManage'
import { ColourDot } from './CompDetails'

var ACCENT = '#4f7ef8'
var COLOUR_SUGGESTIONS = ['green', 'blue', 'red', 'black', 'yellow', 'orange', 'purple', 'pink', 'white', 'grey']

/**
 * /comp/new (mode "draft") and /comp/:code/edit (mode "edit") — spec §2, §4–6.
 *
 * A draft lives on this device until *Open entries* gives it a code. Editing
 * a live comp freezes what a card has already been scored against (§8):
 * scoring, max goes, points and the problem list — except adding a problem
 * and showing or hiding a grade.
 */
export default function CompEditor({ mode, user }) {
  var { code } = useParams()
  var uid = user ? user.uid : null
  var { profile } = useProfile()
  var comps = useCompetitions()
  var live = useComp(mode === 'edit' ? code : null, uid)

  if (mode === 'edit') {
    if (live.loading) return <p className="text-sm text-[#7a8299] text-center py-10" style={barlow}>Loading…</p>
    if (live.notFound || live.error) return <Navigate to={'/comp/' + code} replace />
    if (!live.comp) return null
    if (!live.isOrganiser) return <Navigate to={'/comp/' + code} replace />
    if (!live.editable) return <p className="text-sm text-[#7a8299] text-center py-10" style={barlow}>Loading…</p>
    return (
      <EditorForm
        key={live.editable.code + ':' + live.editable.updatedAt}
        mode="edit"
        initial={live.editable}
        comps={comps}
      />
    )
  }

  var initial = comps.draft || newComp({}, uid, (profile && profile.name) || (user && user.displayName) || 'Organiser', now())
  return <EditorForm key="draft" mode="draft" initial={initial} comps={comps} />
}

function EditorForm({ mode, initial, comps }) {
  var navigate = useNavigate()
  var [comp, setComp] = useState(initial)
  var [busy, setBusy] = useState(false)
  var [error, setError] = useState(null)
  var [showErrors, setShowErrors] = useState(false)
  var nowMs = useNow(30000)
  // The stage on the clock, from the comp as it was opened: a comp past its
  // start is running even if no organiser's phone has moved the status yet.
  var phase = mode === 'edit' ? compPhase(initial, nowMs) : 'draft'
  var frozen = phase === 'live' || phase === 'judging' || phase === 'closed'

  // A draft is written to this device on every change, debounced.
  var saveDraft = comps.saveDraft
  var timer = useRef(null)
  useEffect(function () {
    if (mode !== 'draft') return undefined
    clearTimeout(timer.current)
    timer.current = setTimeout(function () { saveDraft(comp) }, 300)
    return function () { clearTimeout(timer.current) }
  }, [comp, mode, saveDraft])

  function set(patch) { setComp(function (c) { return Object.assign({}, c, patch) }) }
  function setScoring(patch) { set({ scoring: Object.assign({}, comp.scoring, patch) }) }

  var errors = useMemo(function () {
    var out = validateComp(comp)
    return mode === 'edit' ? out.concat(validateTimeChange(initial, comp, nowMs)) : out
  }, [comp, mode, initial, nowMs])

  function openEntries() {
    setShowErrors(true)
    if (errors.length) return
    setBusy(true); setError(null)
    comps.openEntries(comp).then(function (stored) {
      navigate('/comp/' + stored.code + '/manage', { replace: true })
    }).catch(function (err) { setError(err.message || 'Could not open entries'); setBusy(false) })
  }

  function saveChanges() {
    setShowErrors(true)
    if (errors.length) return
    setBusy(true); setError(null)
    comps.save(comp).then(function () {
      navigate('/comp/' + comp.code + '/manage', { replace: true })
    }).catch(function (err) { setError(err.message || 'Could not save'); setBusy(false) })
  }

  function discardDraft() {
    comps.clearDraft()
    navigate('/comp', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '26px' }}>
          {mode === 'draft' ? 'Organise a competition' : 'Edit competition'}
        </p>
        <p className="text-xs text-[#7a8299]">
          {mode === 'draft'
            ? 'Saved as a draft on this phone as you go. Nobody sees it until you open entries.'
            : frozen ? 'Scoring has started, so the scoring and the points are fixed. You can add problems and show or hide grades.' : 'Entries are open. Changes reach everyone who has the code.'}
        </p>
        <HowCompsWork className="mt-1" />
      </div>

      <DetailsSection comp={comp} set={set} frozen={frozen} phase={phase} />
      <ScoringSection comp={comp} setScoring={setScoring} frozen={frozen} />
      <CategoriesSection comp={comp} set={set} frozen={frozen} />
      <ScoresheetSection comp={comp} set={set} frozen={frozen} showErrors={showErrors} />

      {showErrors && errors.length > 0 && (
        <Card className="border-[#fecaca] bg-[#fff5f5]">
          <Eyebrow>Before this can go out</Eyebrow>
          <ul className="text-xs text-[#ef4444] list-disc pl-4 flex flex-col gap-0.5">
            {errors.map(function (e, i) { return <li key={i}>{e}</li> })}
          </ul>
        </Card>
      )}
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}

      <div className="flex flex-col gap-2">
        {mode === 'draft' ? (
          <>
            <button disabled={busy} onClick={openEntries} className="w-full py-3.5 rounded-xl text-white font-bold text-sm" style={{ background: busy ? '#7a8299' : ACCENT, ...barlow }}>
              {busy ? 'Opening…' : 'Open entries — get the join code'}
            </button>
            <ConfirmButton label="Discard this draft" confirmLabel="Tap again to discard" onConfirm={discardDraft} disabled={busy} />
          </>
        ) : (
          <button disabled={busy} onClick={saveChanges} className="w-full py-3.5 rounded-xl text-white font-bold text-sm" style={{ background: busy ? '#7a8299' : ACCENT, ...barlow }}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

function DetailsSection({ comp, set, frozen, phase }) {
  // Spec §7d: the date and start are fixed once scoring starts; the end and
  // its switch while running only; nothing after — reopening is on Manage.
  var startLocked = phase === 'live' || phase === 'judging' || phase === 'closed'
  var endLocked = phase === 'judging' || phase === 'closed'

  var type = compType(comp)
  var graded = (comp.problems || []).some(function (p) { return p.grade })

  // A grade only means something on its own scale, so a change of type clears
  // them — after a yes in the app's own dialog when there are grades to lose.
  var [pendingType, setPendingType] = useState(null)

  function setType(value) {
    if (value === type.value) return
    if (graded) { setPendingType(value); return }
    applyType(value)
  }

  function applyType(value) {
    setPendingType(null)
    set({
      discipline: value,
      problems: (comp.problems || []).map(function (p) { return Object.assign({}, p, { grade: null, gradeSystem: null }) }),
    })
  }

  // The registry venue when one is picked — its id and position go on the
  // comp; a typed name goes on as text alone.
  function setVenue(name, ref) {
    set({ venue: {
      id:   ref ? ref.id : null,
      name: name,
      lat:  ref && ref.lat != null ? ref.lat : null,
      lng:  ref && ref.lng != null ? ref.lng : null,
    } })
  }

  return (
    <Card>
      <ConfirmDialog
        open={!!pendingType}
        title="Clear the grades?"
        message="Changing the type clears the grades on the scoresheet: V grades and French grades are different scales."
        confirmLabel="Change type"
        danger
        onConfirm={function () { applyType(pendingType) }}
        onCancel={function () { setPendingType(null) }}
      />
      <Eyebrow>Details</Eyebrow>
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <input value={comp.name} onChange={function (e) { set({ name: e.target.value }) }} placeholder="Autumn Boulder Comp" className={inputCls} />
        </Field>
        <div className="flex flex-col gap-1" role="group" aria-label="Type">
          <span className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide" style={barlow}>Type</span>
          <div className="flex gap-1.5">
            {COMP_TYPES.map(function (t) {
              var on = t.value === type.value
              return (
                <button
                  key={t.value} type="button" disabled={frozen && !on}
                  onClick={function () { setType(t.value) }}
                  className="flex-1 py-2 rounded-xl text-sm font-bold border"
                  style={{ ...barlow, background: on ? ACCENT : '#fff', color: on ? '#fff' : (frozen ? '#bbbcc8' : '#1a1d2e'), borderColor: on ? ACCENT : '#e5e7ef' }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
        <Field label="Date">
          <input type="date" disabled={startLocked} value={comp.date || ''} onChange={function (e) { set({ date: e.target.value, endDate: null }) }} className={dateCls} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Starts">
            <input type="time" disabled={startLocked} value={comp.startAt || ''} onChange={function (e) { set({ startAt: e.target.value || null }) }} className={dateCls} />
          </Field>
          <Field label="Ends">
            <input type="time" disabled={endLocked} value={comp.endAt || ''} onChange={function (e) { set({ endAt: e.target.value || null }) }} className={dateCls} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>End scoring automatically</p>
            <p className="text-[10px] text-[#7a8299]">
              {comp.autoClose === false
                ? 'Off — scoring runs until you close the comp.'
                : comp.endAt ? 'Cards stop taking goes at ' + comp.endAt + ' and the comp closes. Change the end time to extend it.' : 'Set an end time to use this.'}
            </p>
          </div>
          <Toggle on={comp.autoClose !== false} disabled={endLocked} onChange={function (on) { set({ autoClose: on }) }} label="End scoring automatically" />
        </div>
        {startLocked && (
          <p className="text-[10px] text-[#7a8299] -mt-1">
            {endLocked ? 'Scoring has ended, so the times are fixed. To run longer, reopen scoring from Manage.' : 'Scoring has started, so the date and start are fixed. You can move the end, but not to before now.'}
          </p>
        )}
        <Field label="Venue">
          <VenuePicker
            value={(comp.venue && comp.venue.name) || ''}
            venue={comp.venue && comp.venue.id ? { id: comp.venue.id, name: comp.venue.name } : null}
            onChange={setVenue}
            accent={ACCENT}
            autoLocate
          />
        </Field>
        <Field label="Notes for the poster">
          <textarea value={comp.notes || ''} onChange={function (e) { set({ notes: e.target.value }) }} rows={2} placeholder="Registration from 10, scoring 11 till 3, prizes at half past." className={inputCls} />
        </Field>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

var ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th']

function ScoringSection({ comp, setScoring, frozen }) {
  var s = comp.scoring
  if (frozen) {
    return (
      <Card>
        <Eyebrow>Scoring · fixed while live</Eyebrow>
        <p className="text-xs text-[#1a1d2e]">{scoringSentence(s)}</p>
      </Card>
    )
  }
  function setMax(n) {
    setScoring({ maxAttempts: n, topPercentByAttempt: resizeTopTable(s.topPercentByAttempt, n) })
  }
  function setPct(i, v) {
    var table = s.topPercentByAttempt.slice()
    table[i] = v
    setScoring({ topPercentByAttempt: table })
  }
  return (
    <Card>
      <Eyebrow>Scoring</Eyebrow>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>Max goes per problem</p>
            <p className="text-[10px] text-[#7a8299]">The card stops counting here.</p>
          </div>
          <NumericStepper value={s.maxAttempts} onChange={setMax} min={1} max={MAX_ATTEMPTS_LIMIT} />
        </div>

        <div>
          <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>A top is worth, by go</p>
          <p className="text-[10px] text-[#7a8299] mb-2">Percent of the problem's points. Later goes cannot be worth more than earlier ones.</p>
          <div className="flex flex-wrap gap-1.5">
            {s.topPercentByAttempt.map(function (pct, i) {
              return (
                <label key={i} className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] font-bold text-[#7a8299] uppercase" style={barlow}>{ORDINALS[i] || (i + 1)}</span>
                  <PctInput value={pct} onChange={function (v) { setPct(i, v) }} />
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>A zone without a top</p>
            <p className="text-[10px] text-[#7a8299]">Percent of the problem's points.</p>
          </div>
          <PctInput value={s.zonePercent} onChange={function (v) { setScoring({ zonePercent: v }) }} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>Only the best N problems count</p>
            <p className="text-[10px] text-[#7a8299]">{s.bestN ? 'Best ' + s.bestN + ' of ' + (comp.problems || []).length : 'Every problem counts'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Toggle on={!!s.bestN} onChange={function (on) { setScoring({ bestN: on ? Math.min(10, Math.max(1, (comp.problems || []).length || 10)) : null }) }} />
            {s.bestN && <NumericStepper value={s.bestN} onChange={function (n) { setScoring({ bestN: n }) }} min={1} max={Math.max(1, (comp.problems || []).length)} />}
          </div>
        </div>

        <p className="text-xs text-[#1a1d2e] bg-[#f8f9fc] rounded-xl px-3 py-2">{scoringSentence(s)}</p>
      </div>
    </Card>
  )
}

function PctInput({ value, onChange }) {
  return (
    <div className="flex items-center rounded-lg border border-[#e5e7ef] bg-white overflow-hidden">
      <input
        type="number" inputMode="numeric" min={0} max={100}
        value={value}
        onChange={function (e) { var n = parseInt(e.target.value, 10); onChange(isNaN(n) ? 0 : n) }}
        onFocus={function (e) { e.target.select() }}
        className="w-12 py-1.5 text-center text-sm font-bold text-[#1a1d2e] outline-none"
        style={barlow}
      />
      <span className="pr-2 text-[10px] text-[#7a8299]">%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function CategoriesSection({ comp, set, frozen }) {
  var [input, setInput] = useState('')
  var cats = comp.categories || []
  function add(e) {
    if (e) e.preventDefault()
    var v = input.trim()
    if (!v) return
    if (cats.some(function (c) { return c.toLowerCase() === v.toLowerCase() })) { setInput(''); return }
    set({ categories: cats.concat([v]) })
    setInput('')
  }
  function removeCat(c) { set({ categories: cats.filter(function (x) { return x !== c }) }) }
  return (
    <Card>
      <Eyebrow>Categories</Eyebrow>
      <p className="text-[10px] text-[#7a8299] mb-2">Labels, not rules — an entrant picks one. Leave it at Open for one board.</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {cats.map(function (c) {
          return (
            <span key={c} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold bg-[#f4f5f9] text-[#1a1d2e]" style={barlow}>
              {c}
              {!frozen && cats.length > 1 && (
                <button onClick={function () { removeCat(c) }} aria-label={'Remove ' + c} className="p-0.5 rounded-full text-[#7a8299] hover:bg-black/5"><X size={12} /></button>
              )}
            </span>
          )
        })}
      </div>
      {!frozen && (
        <form onSubmit={add} className="flex gap-2">
          <input value={input} onChange={function (e) { setInput(e.target.value) }} placeholder="Female, Male, Under 16…" className={inputCls + ' flex-1'} />
          <button type="submit" className="px-3 rounded-xl text-sm font-bold" style={{ background: '#eef1ff', color: ACCENT, ...barlow }}>Add</button>
        </form>
      )}
      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[#f0f1f6]">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>Leaderboard visible to entrants</p>
          <p className="text-[10px] text-[#7a8299]">
            {comp.boardVisibleToEntrants !== false ? 'Entrants see the live board while they climb.' : 'Hidden until the close — only organisers see it before then.'}
          </p>
        </div>
        <Toggle on={comp.boardVisibleToEntrants !== false} onChange={function (on) { set({ boardVisibleToEntrants: on }) }} label="Leaderboard visible to entrants" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Scoresheet
// ---------------------------------------------------------------------------

function ScoresheetSection({ comp, set, frozen, showErrors }) {
  var problems = comp.problems || []
  var [genOpen, setGenOpen] = useState(problems.length === 0)
  var sorted = problems.slice().sort(function (a, b) { return a.number - b.number })
  var type = compType(comp)
  var shownCount = problems.filter(function (p) { return p.showGrade !== false }).length
  var allShown = problems.length > 0 && shownCount === problems.length

  function update(id, patch) {
    set({ problems: problems.map(function (p) { return p.id === id ? Object.assign({}, p, patch) : p }) })
  }
  function remove(id) { set({ problems: problems.filter(function (p) { return p.id !== id }) }) }
  function addProblem() {
    var maxN = problems.reduce(function (m, p) { return Math.max(m, p.number || 0) }, 0)
    var last = sorted[sorted.length - 1]
    var idN = problems.reduce(function (m, p) { var n = parseInt(String(p.id).replace(/^p/, ''), 10); return isNaN(n) ? m : Math.max(m, n) }, 0)
    set({
      problems: problems.concat([{
        id: 'p' + (idN + 1), number: maxN + 1, colour: last ? last.colour : null, points: last ? last.points : 10,
        grade: null, gradeSystem: null, showGrade: false, label: null,
      }]),
    })
  }
  function setAllShown(on) { set({ problems: problems.map(function (p) { return Object.assign({}, p, { showGrade: on }) }) }) }

  return (
    <Card>
      <Eyebrow>Scoresheet · {problems.length} problems</Eyebrow>

      {problems.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 mb-3 rounded-xl bg-[#f8f9fc] border border-[#e5e7ef]">
          <div className="flex items-start gap-2 min-w-0">
            <span className="mt-0.5 shrink-0" style={{ color: shownCount ? ACCENT : '#7a8299' }}>{shownCount ? <Eye size={15} /> : <EyeOff size={15} />}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>
                {allShown ? 'Grades visible to entrants' : shownCount === 0 ? 'Grades NOT visible to entrants' : shownCount + ' of ' + problems.length + ' grades visible to entrants'}
              </p>
              <p className="text-[10px] text-[#7a8299]">
                {allShown ? 'Entrants see every grade on the scoresheet.' : 'Hidden grades are shown to everyone when the comp closes.'} Set one problem with its eye.
              </p>
            </div>
          </div>
          <Toggle on={allShown} onChange={setAllShown} label="Grades visible to entrants" />
        </div>
      )}

      {!frozen && (
        <div className="mb-3">
          {genOpen ? (
            <Generator
              onGenerate={function (list) { set({ problems: list }); setGenOpen(false) }}
              hasProblems={problems.length > 0}
              onClose={function () { setGenOpen(false) }}
            />
          ) : (
            <button onClick={function () { setGenOpen(true) }} className="flex items-center gap-1.5 text-xs font-bold text-[#4f7ef8]" style={barlow}>
              <Wand2 size={13} /> Generate a sheet by circuit
            </button>
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="grid gap-x-1.5 gap-y-1.5 items-center" style={{ gridTemplateColumns: '2.6rem minmax(0, 1fr) 2.9rem 3.2rem 2rem 1.6rem' }}>
          <Hdr>#</Hdr><Hdr>Colour</Hdr><Hdr>Pts</Hdr><Hdr>Grade</Hdr><span className="flex justify-center text-[#7a8299]" title="Grade visible to entrants"><Eye size={12} /></span><span />
          {sorted.map(function (p) {
            return <ProblemRow key={p.id} p={p} flagUngraded={showErrors} grades={type.grades} gradeSystem={type.gradeSystem} frozen={frozen} onChange={function (patch) { update(p.id, patch) }} onRemove={function () { remove(p.id) }} />
          })}
        </div>
      )}
      <datalist id="comp-colours">{COLOUR_SUGGESTIONS.map(function (c) { return <option key={c} value={c} /> })}</datalist>

      {sorted.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#7a8299] mt-2">
          <span className="flex items-center gap-1"><Eye size={11} style={{ color: ACCENT }} /> entrants see the grade</span>
          <span className="flex items-center gap-1"><EyeOff size={11} /> hidden until the close</span>
        </p>
      )}

      <button onClick={addProblem} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#4f7ef8]" style={barlow}>
        <Plus size={13} /> Add a problem
      </button>
      <p className="text-[10px] text-[#bbbcc8] mt-2">Every problem needs a grade — it is how each problem tried becomes a climb in the entrant's log.</p>
    </Card>
  )
}

function Hdr({ children }) { return <span className="text-[9px] font-bold text-[#7a8299] uppercase" style={barlow}>{children}</span> }

function ProblemRow({ p, flagUngraded, grades, gradeSystem, frozen, onChange, onRemove }) {
  function setGrade(g) {
    onChange({ grade: g || null, gradeSystem: g ? gradeSystem : null })
  }
  // A grade from before the picker that is not on this scale stays visible until it is changed.
  var options = p.grade && grades.indexOf(p.grade) === -1 ? [p.grade].concat(grades) : grades
  return [
    <input
      key="n" type="number" inputMode="numeric" min={1} disabled={frozen}
      value={p.number}
      onChange={function (e) { var n = parseInt(e.target.value, 10); onChange({ number: isNaN(n) ? 0 : n }) }}
      className={cellCls + ' font-black text-center'} style={barlow}
    />,
    <span key="c" className="flex items-center gap-1.5 min-w-0">
      <ColourDot colour={p.colour} />
      <input
        list="comp-colours" disabled={frozen}
        value={p.colour || ''}
        onChange={function (e) { onChange({ colour: e.target.value || null }) }}
        placeholder="colour"
        className={cellCls + ' flex-1 min-w-0'}
      />
    </span>,
    <input
      key="p" type="number" inputMode="numeric" min={1} disabled={frozen}
      value={p.points}
      onChange={function (e) { var n = parseFloat(e.target.value); onChange({ points: isNaN(n) ? 0 : n }) }}
      className={cellCls + ' font-bold text-right'} style={barlow}
    />,
    <select
      key="g"
      value={p.grade || ''}
      onChange={function (e) { setGrade(e.target.value) }}
      aria-label={'Grade for problem ' + p.number}
      className={cellCls + ' text-center' + (flagUngraded && !p.grade ? ' border-[#ef4444]' : '')}
    >
      <option value="">—</option>
      {options.map(function (g) { return <option key={g} value={g}>{g}</option> })}
    </select>,
    <button
      key="s" onClick={function () { onChange({ showGrade: p.showGrade === false }) }}
      aria-label={p.showGrade === false ? 'Grade hidden from entrants — tap to show' : 'Grade visible to entrants — tap to hide'}
      title={p.showGrade === false ? 'Hidden from entrants' : 'Visible to entrants'}
      className="p-1.5 rounded-lg" style={{ color: p.showGrade === false ? '#7a8299' : ACCENT, background: p.showGrade === false ? '#f4f5f9' : '#eef1ff' }}
      disabled={!p.grade}
    >
      {p.showGrade === false ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>,
    <button key="x" onClick={onRemove} disabled={frozen} aria-label="Remove problem" className="p-1.5 rounded-lg text-[#bbbcc8] hover:text-[#ef4444] disabled:opacity-30">
      <X size={14} />
    </button>,
  ]
}

function Generator({ onGenerate, hasProblems, onClose }) {
  var [count, setCount] = useState(DEFAULT_PROBLEM_COUNT)
  var [circuits, setCircuits] = useState(function () { return DEFAULT_CIRCUITS.map(function (c) { return Object.assign({}, c) }) })
  var [armed, setArmed] = useState(false)

  function update(i, patch) { setCircuits(circuits.map(function (c, j) { return j === i ? Object.assign({}, c, patch) : c })) }
  function removeCircuit(i) { setCircuits(circuits.filter(function (_, j) { return j !== i })) }
  function addCircuit() {
    var last = circuits[circuits.length - 1]
    var from = last ? last.to + 1 : 1
    setCircuits(circuits.concat([{ colour: '', points: last ? last.points + 10 : 10, from: from, to: from + 5 }]))
  }
  function go() {
    if (hasProblems && !armed) { setArmed(true); setTimeout(function () { setArmed(false) }, 3000); return }
    onGenerate(generateProblems(count, circuits.filter(function (c) { return c.to >= c.from })))
  }
  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n }

  return (
    <div className="rounded-xl border border-dashed border-[#c9cfe3] p-3 bg-[#f8f9fc]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-[#1a1d2e] flex items-center gap-1.5" style={barlow}><Wand2 size={13} className="text-[#4f7ef8]" /> Generate by circuit</p>
        <button onClick={onClose} aria-label="Close generator" className="p-1 text-[#bbbcc8]"><X size={14} /></button>
      </div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-[#7a8299]">Problems, numbered from 1</p>
        <NumericStepper value={count} onChange={setCount} min={1} max={200} />
      </div>
      <div className="grid gap-x-1.5 gap-y-1 items-center" style={{ gridTemplateColumns: 'minmax(0, 1fr) 3.2rem 3rem 3rem 1.6rem' }}>
        <Hdr>Colour</Hdr><Hdr>Pts</Hdr><Hdr>From</Hdr><Hdr>To</Hdr><span />
        {circuits.map(function (c, i) {
          return [
            <span key={i + 'c'} className="flex items-center gap-1.5 min-w-0"><ColourDot colour={c.colour} /><input list="comp-colours" value={c.colour} onChange={function (e) { update(i, { colour: e.target.value }) }} placeholder="colour" className={cellCls + ' flex-1 min-w-0'} /></span>,
            <input key={i + 'p'} type="number" inputMode="numeric" value={c.points} onChange={function (e) { update(i, { points: num(e.target.value) }) }} className={cellCls + ' text-right font-bold'} style={barlow} />,
            <input key={i + 'f'} type="number" inputMode="numeric" value={c.from} onChange={function (e) { update(i, { from: num(e.target.value) }) }} className={cellCls + ' text-center'} />,
            <input key={i + 't'} type="number" inputMode="numeric" value={c.to} onChange={function (e) { update(i, { to: num(e.target.value) }) }} className={cellCls + ' text-center'} />,
            <button key={i + 'x'} onClick={function () { removeCircuit(i) }} aria-label="Remove circuit" className="p-1 text-[#bbbcc8] hover:text-[#ef4444]"><X size={13} /></button>,
          ]
        })}
      </div>
      <div className="flex items-center justify-between mt-3">
        <button onClick={addCircuit} className="flex items-center gap-1 text-[11px] font-bold text-[#4f7ef8]" style={barlow}><Plus size={12} /> Circuit</button>
        <button onClick={go} className="px-4 py-2 rounded-xl text-white text-xs font-bold" style={{ background: armed ? '#ef4444' : ACCENT, ...barlow }}>
          {armed ? 'Tap again — replaces the current sheet' : 'Generate ' + count + ' problems'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

var inputCls = 'w-full px-3 py-2 rounded-xl border border-[#e5e7ef] bg-white text-sm text-[#1a1d2e] outline-none focus:border-[#4f7ef8]'
// `appearance-none` and the moz class drop the number spinners, which ate half the width at 390 px.
// iOS Safari gives date and time inputs an intrinsic width that ignores w-full and pushes out of the
// card; appearance-none drops it, and min-h keeps an empty one from collapsing without its text.
var dateCls = inputCls + ' block min-w-0 max-w-full appearance-none min-h-[2.5rem] text-left [&::-webkit-date-and-time-value]:text-left disabled:bg-[#f8f9fc] disabled:text-[#7a8299]'
var cellCls = 'px-1.5 py-1.5 rounded-lg border border-[#e5e7ef] bg-white text-sm text-[#1a1d2e] outline-none focus:border-[#4f7ef8] disabled:bg-[#f8f9fc] disabled:text-[#7a8299] w-full min-w-0 appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide" style={barlow}>{label}</span>
      {children}
    </label>
  )
}

function Toggle({ on, onChange, label, disabled }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={function () { onChange(!on) }}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50"
      style={{ background: on ? ACCENT : '#e5e7ef' }}
    >
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? '22px' : '2px' }} />
    </button>
  )
}
