import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Copy, CopyPlus, Check, Pencil, Download, Trash2, Users, Printer } from 'lucide-react'
import qrcode from 'qrcode-generator'
import useCompetitions, { useComp, useCompEntries, useMySession } from '../../hooks/useCompetitions'
import { resultsCsv, newComp, copyCompFields, compType, compPhase, compStartMs, compEndMs, fmtTimeLeft, toLocalInput, endFieldsFromInput } from '../../lib/competition'
import useNow from '../../hooks/useNow'
import { now } from '../../lib/storage'
import { barlow } from '../../lib/utils'
import QrCode from '../../components/comps/QrCode'
import { Card, Eyebrow, StatusPill, CompTabs, CompStepper } from './CompLayout'
import { fmtCompDate } from '../../lib/compUi'
import { compPosterPdf } from '../../lib/compPoster'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

/**
 * /comp/:code/manage — organisers only: status, the code and QR, the
 * entrant count, Edit, Export CSV, Delete.
 */
export default function CompManage({ user }) {
  var { code } = useParams()
  var navigate = useNavigate()
  var uid = user ? user.uid : null
  var { comp, isOrganiser, loading, error, notFound } = useComp(code, uid)
  var { setStatus, setEnd: saveEnd, remove, draft, saveDraft } = useCompetitions(uid)
  var session = useMySession(code)
  var { entries } = useCompEntries(code, isOrganiser)
  var [busy, setBusy] = useState(false)
  var [actionError, setActionError] = useState(null)
  var [askReplaceDraft, setAskReplaceDraft] = useState(false)
  var nowMs = useNow(15000)

  if (loading) return <p className="text-sm text-[#7a8299] text-center py-10" style={barlow}>Loading…</p>
  if (notFound) return <Navigate to={'/comp/' + code} replace />
  if (error) return <Card><p className="text-sm text-[#ef4444]">{error}</p></Card>
  if (!comp) return null
  if (!isOrganiser) return <Navigate to={'/comp/' + code} replace />

  function move(status) {
    setBusy(true); setActionError(null)
    setStatus(code, status).catch(function (err) { setActionError(err.message || 'Could not change the status') }).finally(function () { setBusy(false) })
  }

  function setEnd(fields, reopen) {
    setBusy(true); setActionError(null)
    return saveEnd(comp, fields, reopen).finally(function () { setBusy(false) })
  }

  function download(blob, suffix) {
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.download = (comp.name || code).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + suffix
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
  }

  function exportCsv() {
    download(new Blob([resultsCsv(comp, entries)], { type: 'text/csv;charset=utf-8' }), '-results.csv')
  }

  // The join card as an A4 poster to print — the same QR, drawn as vectors.
  function downloadPoster() {
    var qr = qrcode(0, 'M')
    qr.addData(joinUrl)
    qr.make()
    var n = qr.getModuleCount()
    var modules = []
    for (var r = 0; r < n; r++) {
      var row = []
      for (var c = 0; c < n; c++) row.push(qr.isDark(r, c))
      modules.push(row)
    }
    var when = fmtCompDate(comp.date) + (comp.startAt ? ', ' + comp.startAt : '')
    var pdf = compPosterPdf({
      name: comp.name || code,
      code: code,
      url: joinUrl,
      lines: [compType(comp).label + ' comp · ' + when, comp.venue && comp.venue.name],
      notes: comp.notes,
      modules: modules,
    })
    download(new Blob([pdf], { type: 'application/pdf' }), '-poster.pdf')
  }

  // A new draft in this comp's format, grades blank for the new set. There is
  // one draft per device, so an unsaved one is replaced only on a yes — asked
  // in the app's own dialog, not the browser's.
  function copyToNew() {
    if (draft) { setAskReplaceDraft(true); return }
    makeCopy()
  }

  function makeCopy() {
    setAskReplaceDraft(false)
    var ts = now()
    var name = (comp.organiserNames && comp.organiserNames[uid]) || 'Organiser'
    saveDraft(newComp(copyCompFields(comp, ts), uid, name, ts))
    navigate('/comp/new')
  }

  function del() {
    setBusy(true); setActionError(null)
    remove(code).then(function () { navigate('/comp', { replace: true }) }).catch(function (err) {
      setActionError(err.message || 'Could not delete'); setBusy(false)
    })
  }

  var joinUrl = window.location.origin + '/comp/' + code

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-[#1a1d2e] leading-tight" style={{ ...barlow, fontSize: '24px' }}>{comp.name}</p>
          <p className="text-xs text-[#7a8299]">Manage</p>
        </div>
        <StatusPill comp={comp} />
      </div>

      <WorkflowPanel comp={comp} phase={compPhase(comp, nowMs)} nowMs={nowMs} entries={entries} busy={busy} onMove={move} onSetEnd={setEnd} />
      {actionError && <p className="text-xs text-[#ef4444]">{actionError}</p>}

      <Card>
        <Eyebrow>Join code</Eyebrow>
        <div className="flex flex-col items-center gap-3">
          <span className="font-black tracking-widest text-[#1a1d2e]" style={{ fontFamily: "'Courier New', monospace", fontSize: '28px' }}>{code}</span>
          <QrCode value={joinUrl} size={200} label={'QR code for ' + code} />
          <p className="text-[10px] text-[#bbbcc8] text-center break-all">{joinUrl}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <CopyButton text={joinUrl} />
            <button onClick={downloadPoster} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#eef1ff', color: '#4f7ef8', ...barlow }}>
              <Printer size={13} /> Poster (PDF)
            </button>
          </div>
        </div>
        <p className="text-[10px] text-[#7a8299] mt-3 text-center">Print the poster, or put the code or the QR on your own. Scanning it opens this comp in BetaLog.</p>
      </Card>

      <Card>
        <Eyebrow>Entrants</Eyebrow>
        <p className="flex items-center gap-2 text-sm text-[#1a1d2e]"><Users size={14} className="text-[#7a8299]" />{entries.length} {entries.length === 1 ? 'entrant' : 'entrants'}</p>
        {entries.length > 0 && (
          <p className="text-[11px] text-[#7a8299] mt-1 truncate">{entries.map(function (e) { return e.displayName }).join(', ')}</p>
        )}
      </Card>

      <Card>
        <Eyebrow>Actions</Eyebrow>
        <div className="flex flex-col gap-2">
          <Link to={'/comp/' + code + '/edit'} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e5e7ef] text-sm font-bold text-[#1a1d2e]" style={barlow}>
            <Pencil size={15} className="text-[#7a8299]" /> Edit details and scoresheet
          </Link>
          <button onClick={copyToNew} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e5e7ef] text-sm font-bold text-[#1a1d2e] text-left disabled:opacity-50" style={barlow}>
            <CopyPlus size={15} className="text-[#7a8299]" /> Copy to a new comp
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e5e7ef] text-sm font-bold text-[#1a1d2e] text-left" style={barlow}>
            <Download size={15} className="text-[#7a8299]" /> Export results (CSV)
          </button>
          <ConfirmButton
            label="Delete this competition"
            confirmLabel="Tap again to delete — entrants' cards go too"
            icon={<Trash2 size={15} />}
            disabled={busy}
            onConfirm={del}
          />
        </div>
      </Card>

      <CompTabs code={code} isOrganiser entered={!!session} board />

      <ConfirmDialog
        open={askReplaceDraft}
        title="Replace your draft?"
        message="You have a draft competition on this phone. Copying this comp replaces it."
        confirmLabel="Replace draft"
        danger
        onConfirm={makeCopy}
        onCancel={function () { setAskReplaceDraft(false) }}
      />
    </div>
  )
}

/**
 * The workflow panel (spec §7d): the stages as a stepper, then one card that
 * says what happens next, when, and has the button that does it.
 */
function WorkflowPanel({ comp, phase, nowMs, entries, busy, onMove, onSetEnd }) {
  var [picking, setPicking] = useState(false)
  var start = compStartMs(comp)
  var end = compEndMs(comp)
  var n = entries.length
  var withGoes = entries.filter(function (e) {
    return Object.keys(e.card || {}).some(function (k) { return (e.card[k] && e.card[k].attempts) > 0 })
  }).length
  var entered = n + (n === 1 ? ' entered' : ' entered')

  var text, facts, main, secondary
  if (phase === 'open') {
    text = start !== null
      ? 'Scoring starts by itself at ' + comp.startAt + ' on ' + fmtCompDate(comp.date) + ' — in ' + fmtTimeLeft(start - nowMs) + '. Share the code below.'
      : 'No start time — start scoring when the comp begins. Share the code below.'
    facts = entered
    main = <ConfirmButton label="Start scoring now" confirmLabel="Tap again — every card opens now" disabled={busy} onConfirm={function () { onMove('live') }} primary />
  } else if (phase === 'live') {
    text = end !== null
      ? 'Scoring ends by itself at ' + endLabel(comp) + ' — ' + fmtTimeLeft(end - nowMs) + ' left. Then judging starts.'
      : 'No set end — end scoring when you are ready. Then judging starts.'
    facts = entered + ' · ' + withGoes + (withGoes === 1 ? ' card' : ' cards') + ' with goes'
    main = <ConfirmButton label="End scoring now" confirmLabel="Tap again — every card locks now" disabled={busy} onConfirm={function () { onMove('judging') }} primary />
    secondary = { label: 'Change end time', reopen: false }
  } else if (phase === 'judging') {
    text = 'Scoring has ended. Check the board: open a climber\'s card and amend anything wrong, then close. Closing reveals hidden grades and makes the results final.'
    facts = entered + ' · ' + withGoes + (withGoes === 1 ? ' card' : ' cards') + ' with goes'
    main = <ConfirmButton label="Close and publish results" confirmLabel={'Tap again — ' + n + (n === 1 ? ' card becomes' : ' cards become') + ' final'} disabled={busy} onConfirm={function () { onMove('closed') }} primary />
    secondary = { label: 'Reopen scoring', reopen: true }
  } else if (phase === 'closed') {
    text = 'Results are final. Closed ' + (comp.closedAt ? new Date(comp.closedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '') + '. Grades are shown to everyone.'
    facts = entered
  } else {
    text = 'A draft — open entries from the editor.'
  }

  return (
    <Card>
      <CompStepper phase={phase} />
      <div className="mt-4 pt-3 border-t border-[#f0f1f6]">
        <Eyebrow>{phase === 'closed' ? 'Done' : 'Next step'}</Eyebrow>
        <p className="text-sm text-[#1a1d2e]">{text}</p>
        {facts && <p className="text-[11px] text-[#7a8299] mt-1">{facts}</p>}
        {phase !== 'draft' && phase !== 'open' && (
          <Link to={'/comp/' + comp.code + '/board'} className="inline-block mt-2 text-sm font-bold text-[#4f7ef8]" style={barlow}>Open the board →</Link>
        )}
        {(main || secondary) && (
          <div className="flex flex-col gap-2 mt-3">
            {main}
            {secondary && !picking && (
              <button onClick={function () { setPicking(true) }} disabled={busy} className="py-2.5 rounded-xl text-sm font-bold border border-[#e5e7ef] bg-white text-[#1a1d2e]" style={barlow}>
                {secondary.label}
              </button>
            )}
            {secondary && picking && (
              <EndPicker
                comp={comp} nowMs={nowMs} reopen={secondary.reopen} busy={busy}
                onCancel={function () { setPicking(false) }}
                onSave={function (fields) { return onSetEnd(fields, secondary.reopen).then(function () { setPicking(false) }) }}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

/** "17:00", or "Sun 19 Oct 09:00" when a reopen moved the end to another day. */
function endLabel(comp) {
  return comp.endDate && comp.endDate !== comp.date ? fmtCompDate(comp.endDate).replace(/ \d{4}$/, '') + ' ' + comp.endAt : comp.endAt
}

/** A date-and-time picker for a new end — later than now (spec §7d). */
function EndPicker({ comp, nowMs, reopen, busy, onCancel, onSave }) {
  var current = compEndMs(comp)
  var [value, setValue] = useState(toLocalInput(Math.max(current || 0, nowMs + 30 * 60000)))
  var [error, setError] = useState(null)
  var fields = endFieldsFromInput(comp, value)
  var ms = fields ? new Date(value).getTime() : NaN
  var ok = fields && ms > nowMs
  function save() {
    if (!ok) { setError('Pick a date and time later than now'); return }
    setError(null)
    onSave(fields).catch(function (err) { setError(err.message || 'Could not save') })
  }
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#f8f9fc] border border-[#e5e7ef]">
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide" style={barlow}>{reopen ? 'Scoring reopens now and ends at' : 'New end'}</span>
        <input
          type="datetime-local" value={value} min={toLocalInput(nowMs)}
          onChange={function (e) { setValue(e.target.value); setError(null) }}
          className="block w-full min-w-0 max-w-full appearance-none min-h-[2.5rem] px-3 py-2 rounded-xl border border-[#e5e7ef] bg-white text-sm text-[#1a1d2e] text-left [&::-webkit-date-and-time-value]:text-left"
        />
      </label>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#7a8299] bg-white border border-[#e5e7ef]" style={barlow}>Cancel</button>
        <button onClick={save} disabled={busy || !fields} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ ...barlow, background: busy || !fields ? '#7a8299' : '#2a9d5c' }}>
          {reopen ? 'Reopen scoring' : 'Save end'}
        </button>
      </div>
    </div>
  )
}

/** The Settings pattern: first tap arms it for 3 s, second tap does it. */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled, icon, primary }) {
  var [armed, setArmed] = useState(false)
  useEffect(function () {
    if (!armed) return undefined
    var t = setTimeout(function () { setArmed(false) }, 3000)
    return function () { clearTimeout(t) }
  }, [armed])
  function click() {
    if (!armed) { setArmed(true); return }
    setArmed(false)
    onConfirm()
  }
  var base = 'flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-colors'
  var style = armed
    ? { background: '#ef4444', color: '#fff' }
    : primary ? { background: disabled ? '#7a8299' : '#1a1d2e', color: '#fff' } : { background: '#fff5f5', color: '#ef4444', border: '1px solid #fecaca' }
  return (
    <button disabled={disabled} onClick={click} className={base} style={Object.assign({}, barlow, style)}>
      {!armed && icon}{armed ? confirmLabel : label}
    </button>
  )
}

function CopyButton({ text }) {
  var [copied, setCopied] = useState(false)
  function copy() {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(text).then(function () {
      setCopied(true)
      setTimeout(function () { setCopied(false) }, 1500)
    })
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#eef1ff', color: '#4f7ef8', ...barlow }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy link'}
    </button>
  )
}
