import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Copy, CopyPlus, Check, Pencil, Download, Trash2, Users } from 'lucide-react'
import useCompetitions, { useComp, useCompEntries } from '../../hooks/useCompetitions'
import { resultsCsv, newComp, copyCompFields } from '../../lib/competition'
import { now } from '../../lib/storage'
import { barlow } from '../../lib/utils'
import QrCode from '../../components/comps/QrCode'
import { Card, Eyebrow, StatusPill, CompTabs } from './CompLayout'
import { STATUS_LABEL } from '../../lib/compUi'

/**
 * /comp/:code/manage — organisers only: status, the code and QR, the
 * entrant count, Edit, Export CSV, Delete.
 */
export default function CompManage({ user }) {
  var { code } = useParams()
  var navigate = useNavigate()
  var uid = user ? user.uid : null
  var { comp, isOrganiser, loading, error, notFound } = useComp(code, uid)
  var { setStatus, remove, draft, saveDraft } = useCompetitions()
  var { entries } = useCompEntries(code, isOrganiser)
  var [busy, setBusy] = useState(false)
  var [actionError, setActionError] = useState(null)

  if (loading) return <p className="text-sm text-[#7a8299] text-center py-10" style={barlow}>Loading…</p>
  if (notFound) return <Navigate to={'/comp/' + code} replace />
  if (error) return <Card><p className="text-sm text-[#ef4444]">{error}</p></Card>
  if (!comp) return null
  if (!isOrganiser) return <Navigate to={'/comp/' + code} replace />

  function move(status) {
    setBusy(true); setActionError(null)
    setStatus(code, status).catch(function (err) { setActionError(err.message || 'Could not change the status') }).finally(function () { setBusy(false) })
  }

  function exportCsv() {
    var csv = resultsCsv(comp, entries)
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.download = (comp.name || code).replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-results.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
  }

  // A new draft in this comp's format, grades blank for the new set. There is
  // one draft per device, so an unsaved one is replaced only on a yes.
  function copyToNew() {
    if (draft && !window.confirm('You have a draft competition on this phone. Replace it with a copy of this one?')) return
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

      <StatusCard comp={comp} busy={busy} onMove={move} entrants={entries.length} />
      {actionError && <p className="text-xs text-[#ef4444]">{actionError}</p>}

      <Card>
        <Eyebrow>Join code</Eyebrow>
        <div className="flex flex-col items-center gap-3">
          <span className="font-black tracking-widest text-[#1a1d2e]" style={{ fontFamily: "'Courier New', monospace", fontSize: '28px' }}>{code}</span>
          <QrCode value={joinUrl} size={200} label={'QR code for ' + code} />
          <p className="text-[10px] text-[#bbbcc8] text-center break-all">{joinUrl}</p>
          <CopyButton text={joinUrl} />
        </div>
        <p className="text-[10px] text-[#7a8299] mt-3 text-center">Put the code or the QR on the poster. Scanning it opens this comp in BetaLog.</p>
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

      <CompTabs code={code} isOrganiser />
    </div>
  )
}

function StatusCard({ comp, busy, onMove, entrants }) {
  var s = comp.status
  return (
    <Card>
      <Eyebrow>Status · {STATUS_LABEL[s]}</Eyebrow>
      {s === 'open' && (
        <>
          <p className="text-xs text-[#7a8299] mb-3">Entries are open. Start scoring when the comp begins — goes are only accepted while it is live.</p>
          <button disabled={busy} onClick={function () { onMove('live') }} className="w-full py-3 rounded-xl text-white font-bold text-sm" style={{ background: busy ? '#7a8299' : '#2a9d5c', ...barlow }}>
            Start scoring
          </button>
        </>
      )}
      {s === 'live' && (
        <>
          <p className="text-xs text-[#7a8299] mb-3">Scoring is live. Closing makes the results final, reveals hidden grades and stops every card.</p>
          <ConfirmButton
            label="Close the competition"
            confirmLabel={'Tap again to close — ' + entrants + ' cards become final'}
            disabled={busy}
            onConfirm={function () { onMove('closed') }}
            primary
          />
        </>
      )}
      {s === 'closed' && (
        <p className="text-xs text-[#7a8299]">Final. Closed {comp.closedAt ? new Date(comp.closedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : ''}. Grades are shown to everyone now.</p>
      )}
      {s === 'draft' && (
        <p className="text-xs text-[#7a8299]">A draft — open entries from the editor.</p>
      )}
    </Card>
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
