import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, LogOut } from 'lucide-react'
import NumericStepper from '../ui/NumericStepper'
import Storage from '../../lib/storage'
import DEFAULT_EXERCISES from '../../lib/defaultExercises'
import { DEFAULT_ROUTINES } from '../../lib/defaultRoutines'
import { barlow } from '../../lib/utils'

const labelCls = 'text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1'
const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors'

function GroqKeyInput({ apiKey, setApiKey }) {
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState(null) // 'ok' | 'fail' | null

  const testKey = () => {
    if (!apiKey || testing) return
    setTesting(true)
    setTestResult(null)
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
      }),
    })
      .then(res => {
        if (res.ok) { setTestResult('ok'); return }
        return res.json().then(err => {
          const msg = (err.error && err.error.message) || 'Error ' + res.status
          setTestResult(msg)
        })
      })
      .catch(e => setTestResult(e.message || 'fail'))
      .finally(() => setTesting(false))
  }

  return (
    <div>
      <p className={labelCls} style={barlow}>Groq API Key</p>
      <div className="flex gap-1.5">
        <input
          className={inputCls + ' flex-1 text-xs'}
          type="password"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value.trim()); setTestResult(null) }}
          placeholder="gsk_..."
        />
        {apiKey && (
          <button
            onClick={testKey}
            disabled={testing}
            className="px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors shrink-0"
            style={
              testResult === 'ok'   ? { background: '#edfaf2', borderColor: '#2a9d5c', color: '#2a9d5c', ...barlow }
              : testResult === 'fail' ? { background: '#fef2f2', borderColor: '#ef4444', color: '#ef4444', ...barlow }
              : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }
            }
          >
            {testing ? '...' : testResult === 'ok' ? 'Valid' : testResult && testResult !== 'fail' ? 'Error' : testResult === 'fail' ? 'Failed' : 'Test'}
          </button>
        )}
        {apiKey && (
          <button
            onClick={() => { setApiKey(''); setTestResult(null) }}
            className="px-2 py-1 rounded-lg text-[10px] font-bold text-[#ef4444] border border-[#fee2e2] hover:bg-[#fff5f5] transition-colors shrink-0"
            style={barlow}
          >
            Clear
          </button>
        )}
      </div>
      {!apiKey && (
        <p className="text-[9px] text-[#bbbcc8] mt-1 leading-relaxed">
          Get a free key at{' '}
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="underline text-[#4f7ef8]">console.groq.com/keys</a>
        </p>
      )}
      {apiKey && apiKey.indexOf('gsk_') !== 0 && (
        <p className="text-[9px] text-[#ef4444] mt-0.5" style={barlow}>Key should start with gsk_</p>
      )}
      {apiKey && apiKey.indexOf('gsk_') === 0 && !testResult && (
        <p className="text-[9px] text-[#7a8299] mt-0.5" style={barlow}>Hit Test to verify your key works</p>
      )}
      {testResult && testResult !== 'ok' && testResult !== 'fail' && (
        <p className="text-[9px] text-[#ef4444] mt-0.5 leading-relaxed">{testResult}</p>
      )}
    </div>
  )
}

export default function SettingsSheet({ open, onClose, data, setData, user, onSignOut, isAdmin }) {
  const [name,      setName]      = useState('')
  const [heightCm,  setHeightCm]  = useState(170)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [apiKey,    setApiKey]    = useState('')
  const [saved,     setSaved]     = useState(false)
  const [orig,      setOrig]      = useState({ name: '', heightCm: 170, aiEnabled: false, apiKey: '' })

  const [nameError,   setNameError]   = useState(false)
  const [confirmEx,   setConfirmEx]   = useState(false)
  const [confirmHang, setConfirmHang] = useState(false)

  useEffect(() => {
    if (!open || !data) return
    const p  = data.athleteProfile || {}
    const n  = p.name || ''
    const h  = p.heightCm != null ? p.heightCm : 170
    const k  = data.groqKey || ''
    const ai = !!k
    setName(n); setHeightCm(h); setAiEnabled(ai); setApiKey(k) // eslint-disable-line react-hooks/set-state-in-effect -- syncing form fields from props when sheet opens
    setOrig({ name: n, heightCm: h, aiEnabled: ai, apiKey: k })
    setSaved(false); setNameError(false); setConfirmEx(false); setConfirmHang(false)
  }, [open, data])

  const hasChanges = name !== orig.name || heightCm !== orig.heightCm ||
    aiEnabled !== orig.aiEnabled || apiKey !== orig.apiKey

  const handleSave = () => {
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    const effectiveKey = aiEnabled && apiKey && apiKey.indexOf('gsk_') === 0 ? apiKey : ''
    const profile = Object.assign({}, data.athleteProfile || {}, {
      name, heightCm: heightCm || null, updatedAt: new Date().toISOString(),
    })
    Storage.saveAthleteProfile(profile)
    Storage.saveGroqKey(effectiveKey)
    setData(prev => Object.assign({}, prev, { athleteProfile: profile, groqKey: effectiveKey }))
    setApiKey(effectiveKey)
    setOrig({ name, heightCm, aiEnabled, apiKey: effectiveKey })
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  const handleRestoreExercises = () => {
    if (!confirmEx) { setConfirmEx(true); return }
    const existing    = data.exercises || []
    const byId        = {}
    existing.forEach(e => { byId[e.id] = e })
    const restoredIds = {}
    DEFAULT_EXERCISES.forEach(d => { restoredIds[d.id] = true })
    const restored    = DEFAULT_EXERCISES.map(d => Object.assign({}, d, { isFavourite: byId[d.id] ? byId[d.id].isFavourite : false }))
    const userCreated = existing.filter(e => !restoredIds[e.id])
    Storage.saveExercises(restored.concat(userCreated))
    setData(prev => Object.assign({}, prev, { exercises: restored.concat(userCreated) }))
    setConfirmEx(false)
  }

  const handleRestoreRoutines = () => {
    if (!confirmHang) { setConfirmHang(true); return }
    const existing    = data.routines || []
    const defaultIds  = {}
    DEFAULT_ROUTINES.forEach(r => { defaultIds[r.id] = true })
    const userCreated = existing.filter(r => !defaultIds[r.id])
    Storage.saveRoutines(DEFAULT_ROUTINES.concat(userCreated))
    setData(prev => Object.assign({}, prev, { routines: DEFAULT_ROUTINES.concat(userCreated) }))
    setConfirmHang(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '20px' }}>Settings</p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <p className={labelCls} style={barlow}>Name</p>
              <input
                className="w-full px-2 py-1 rounded-lg border text-xs text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none transition-colors"
                style={{ borderColor: nameError ? '#ef4444' : '#e5e7ef' }}
                value={name}
                onChange={e => { setName(e.target.value); if (nameError) setNameError(false) }}
                placeholder="Your name"
              />
              {nameError && <p className="text-[9px] text-[#ef4444] mt-0.5" style={barlow}>Name is required</p>}
            </div>
            <div className="w-28 shrink-0">
              <p className={labelCls} style={barlow}>Height (cm)</p>
              <NumericStepper value={heightCm} min={120} max={220} step={1} onChange={setHeightCm} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={e => { setAiEnabled(e.target.checked); if (!e.target.checked) setApiKey('') }}
              className="w-4 h-4 rounded accent-[#c0622a]"
            />
            <span className="text-xs text-[#1a1d2e] font-semibold" style={barlow}>AI Coach</span>
          </label>

          {aiEnabled && <GroqKeyInput apiKey={apiKey} setApiKey={setApiKey} />}

          <button
            onClick={handleSave}
            disabled={!hasChanges && !saved}
            className="w-full py-2.5 rounded-xl text-white font-bold text-sm transition-colors"
            style={{ background: saved ? '#2a9d5c' : hasChanges ? '#4f7ef8' : '#bbbcc8', cursor: hasChanges || saved ? 'pointer' : 'default', ...barlow }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>

          <div className="border-t border-[#e5e7ef] pt-3 mt-1">
            <p className={labelCls} style={barlow}>Data</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const dump = Storage.load()
                  dump.groqKey = ''
                  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
                  const url  = URL.createObjectURL(blob)
                  const a    = document.createElement('a')
                  a.href = url; a.download = 'betalog-export-' + new Date().toISOString().slice(0, 10) + '.json'
                  a.click(); URL.revokeObjectURL(url)
                }}
                className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#e5e7ef] text-[#7a8299] hover:bg-[#f8f9fc] transition-colors"
                style={barlow}
              >
                Export JSON
              </button>
              <label
                className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#e5e7ef] text-[#7a8299] hover:bg-[#f8f9fc] transition-colors text-center cursor-pointer"
                style={barlow}
              >
                Import JSON
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files && e.target.files[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      try {
                        const imported = JSON.parse(reader.result)
                        if (!imported.sessions || !imported.exercises) { alert('Invalid BetaLog export file'); return }
                        if (!confirm('This will replace ALL your data. Are you sure?')) return
                        if (imported.sessions)       Storage.saveSessions(imported.sessions)
                        if (imported.exercises)      Storage.saveExercises(imported.exercises)
                        if (imported.routines)       Storage.saveRoutines(imported.routines)
                        if (imported.schedule)       Storage.saveSchedule(imported.schedule)
                        if (imported.weightLog)      Storage.saveWeightLog(imported.weightLog)
                        if (imported.athleteProfile) Storage.saveAthleteProfile(imported.athleteProfile)
                        setData(Storage.load())
                        alert('Data imported successfully')
                        onClose()
                      } catch (err) {
                        alert('Failed to import: ' + err.message)
                      }
                    }
                    reader.readAsText(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>

          <div className="border-t border-[#e5e7ef] pt-3 mt-1">
            <p className={labelCls} style={barlow}>Restore defaults</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleRestoreExercises}
                className="w-full py-2 rounded-lg text-xs font-semibold border transition-colors"
                style={confirmEx
                  ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff', ...barlow }
                  : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }}
              >
                {confirmEx ? 'Tap again to confirm' : 'Restore built-in exercises'}
              </button>
              <button
                onClick={handleRestoreRoutines}
                className="w-full py-2 rounded-lg text-xs font-semibold border transition-colors"
                style={confirmHang
                  ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff', ...barlow }
                  : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }}
              >
                {confirmHang ? 'Tap again to confirm' : 'Restore built-in hang routines'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#e5e7ef] pt-3 mt-1">
            <p className={labelCls} style={barlow}>Feedback</p>
            <button
              onClick={() => window.BenjuiceyFeedback && window.BenjuiceyFeedback.open()}
              className="block w-full py-2 rounded-lg text-xs font-semibold border border-[#e5e7ef] text-[#7a8299] hover:bg-[#f8f9fc] transition-colors text-center"
              style={barlow}
            >
              Send feedback
            </button>
          </div>

          {user && (
            <div className="border-t border-[#e5e7ef] pt-3 mt-1">
              <p className={labelCls} style={barlow}>Account</p>
              <div className="flex items-center gap-3 mb-2">
                {user.photoURL && <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#1a1d2e] truncate">{user.displayName || 'User'}</p>
                  <p className="text-[10px] text-[#7a8299] truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="w-full py-2 rounded-lg text-xs font-semibold border border-[#e5e7ef] text-[#7a8299] hover:bg-[#f8f9fc] transition-colors flex items-center justify-center gap-1.5"
                style={barlow}
              >
                <LogOut size={12} />
                Sign out
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="border-t border-[#e5e7ef] pt-3 mt-1">
              <Link
                to="/admin"
                onClick={onClose}
                className="block w-full py-2 rounded-lg text-xs font-semibold border border-[#e5e7ef] text-[#7a8299] hover:bg-[#f8f9fc] transition-colors text-center"
                style={barlow}
              >
                Admin panel
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
