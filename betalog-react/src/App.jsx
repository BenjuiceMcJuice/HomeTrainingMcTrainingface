import { createContext, useContext, useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import NumericStepper from './components/ui/NumericStepper'
import Nav from './components/layout/Nav'
import Dashboard from './pages/Dashboard'
import Log from './pages/Log'
import History from './pages/History'
import Plan from './pages/Plan'
import Coach from './pages/Coach'
import Storage from './lib/storage'
import { seedDefaultExercises } from './hooks/useExercises'
import { seedDefaultRoutines, DEFAULT_ROUTINES } from './lib/defaultRoutines'
import DEFAULT_EXERCISES from './lib/defaultExercises'

// ---------------------------------------------------------------------------
// Data context
// ---------------------------------------------------------------------------

var DataContext = createContext(null)

/** @returns {{ data: import('./lib/types').BetaLogData, setData: Function } | null} */
export function useData() {
  return useContext(DataContext)
}

// ---------------------------------------------------------------------------
// Scroll to top on route change
// ---------------------------------------------------------------------------

function ScrollToTop() {
  var { pathname } = useLocation()
  useEffect(function () { window.scrollTo(0, 0) }, [pathname])
  return null
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

var barlow   = { fontFamily: "'Barlow Condensed', sans-serif" }
var labelCls = 'text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1'
var inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors'

// ---------------------------------------------------------------------------
// Settings sheet — global, always accessible from header cog
// ---------------------------------------------------------------------------

function GroqKeyInput({ apiKey, setApiKey }) {
  var [testing, setTesting] = useState(false)
  var [testResult, setTestResult] = useState(null) // 'ok' | 'fail' | null

  function testKey() {
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
      .then(function (res) {
        if (res.ok) { setTestResult('ok'); return }
        return res.json().then(function (err) {
          var msg = (err.error && err.error.message) || 'Error ' + res.status
          setTestResult(msg)
        })
      })
      .catch(function (e) { setTestResult(e.message || 'fail') })
      .finally(function () { setTesting(false) })
  }

  return (
    <div>
      <p className={labelCls} style={barlow}>Groq API Key</p>
      <div className="flex gap-1.5">
        <input
          className={inputCls + ' flex-1 text-xs'}
          type="password"
          value={apiKey}
          onChange={function (e) { setApiKey(e.target.value.trim()); setTestResult(null) }}
          placeholder="gsk_..."
        />
        {apiKey && (
          <button
            onClick={testKey}
            disabled={testing}
            className="px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors shrink-0"
            style={
              testResult === 'ok' ? { background: '#edfaf2', borderColor: '#2a9d5c', color: '#2a9d5c', ...barlow }
              : testResult === 'fail' ? { background: '#fef2f2', borderColor: '#ef4444', color: '#ef4444', ...barlow }
              : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }
            }
          >
            {testing ? '...' : testResult === 'ok' ? 'Valid' : testResult && testResult !== 'fail' ? 'Error' : testResult === 'fail' ? 'Failed' : 'Test'}
          </button>
        )}
        {apiKey && (
          <button
            onClick={function () { setApiKey(''); setTestResult(null) }}
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

function SettingsSheet({ open, onClose, data, setData }) {
  var [name,     setName]     = useState('')
  var [heightCm,  setHeightCm]  = useState(170)
  var [aiEnabled, setAiEnabled] = useState(false)
  var [apiKey,    setApiKey]    = useState('')
  var [saved,     setSaved]     = useState(false)
  var [orig,      setOrig]      = useState({ name: '', heightCm: 170, aiEnabled: false, apiKey: '' })

  var [confirmEx,   setConfirmEx]   = useState(false)
  var [confirmHang, setConfirmHang] = useState(false)


  useEffect(function () {
    if (!open || !data) return
    var p = data.athleteProfile || {}
    var n = p.name || ''
    var h = p.heightCm != null ? p.heightCm : 170
    var k = data.groqKey || ''
    var ai = !!k
    setName(n)
    setHeightCm(h)
    setAiEnabled(ai)
    setApiKey(k)
    setOrig({ name: n, heightCm: h, aiEnabled: ai, apiKey: k })
    setSaved(false)
    setConfirmEx(false)
    setConfirmHang(false)
  }, [open, data])

  var hasChanges = name !== orig.name || heightCm !== orig.heightCm ||
    aiEnabled !== orig.aiEnabled || apiKey !== orig.apiKey

  function handleSave() {
    // If AI enabled but no key entered, use test key
    var effectiveKey = aiEnabled && apiKey && apiKey.indexOf('gsk_') === 0 ? apiKey : ''

    var profile = Object.assign({}, data.athleteProfile || {}, {
      name:     name,
      heightCm: heightCm || null,
      updatedAt: new Date().toISOString(),
    })
    Storage.saveAthleteProfile(profile)
    Storage.saveGroqKey(effectiveKey)

    setData(function (prev) {
      return Object.assign({}, prev, { athleteProfile: profile, groqKey: effectiveKey })
    })

    // Update apiKey state to reflect what was actually saved
    setApiKey(effectiveKey)
    setOrig({ name: name, heightCm: heightCm, aiEnabled: aiEnabled, apiKey: effectiveKey })
    setSaved(true)
    setTimeout(function () { setSaved(false); onClose() }, 800)
  }

  function handleRestoreExercises() {
    if (!confirmEx) { setConfirmEx(true); return }
    // Restore all defaults, preserve user-created and favourites
    var existing = data.exercises || []
    var byId = {}
    existing.forEach(function (e) { byId[e.id] = e })
    var restoredIds = {}
    DEFAULT_EXERCISES.forEach(function (d) { restoredIds[d.id] = true })
    var restored = DEFAULT_EXERCISES.map(function (d) {
      return Object.assign({}, d, { isFavourite: byId[d.id] ? byId[d.id].isFavourite : false })
    })
    var userCreated = existing.filter(function (e) { return !restoredIds[e.id] })
    Storage.saveExercises(restored.concat(userCreated))
    setData(function (prev) { return Object.assign({}, prev, { exercises: restored.concat(userCreated) }) })
    setConfirmEx(false)
  }

  function handleRestoreRoutines() {
    if (!confirmHang) { setConfirmHang(true); return }
    // Restore default hang routines, preserve user-created
    var existing = data.routines || []
    var defaultIds = {}
    DEFAULT_ROUTINES.forEach(function (r) { defaultIds[r.id] = true })
    var userCreated = existing.filter(function (r) { return !defaultIds[r.id] })
    Storage.saveRoutines(DEFAULT_ROUTINES.concat(userCreated))
    setData(function (prev) { return Object.assign({}, prev, { routines: DEFAULT_ROUTINES.concat(userCreated) }) })
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
          {/* Name + Height — same row */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <p className={labelCls} style={barlow}>Name</p>
              <input
                className="w-full px-2 py-1 rounded-lg border border-[#e5e7ef] text-xs text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors"
                value={name}
                onChange={function (e) { setName(e.target.value) }}
                placeholder="Your name"
              />
            </div>
            <div className="w-28 shrink-0">
              <p className={labelCls} style={barlow}>Height (cm)</p>
              <NumericStepper value={heightCm} min={120} max={220} step={1} onChange={setHeightCm} />
            </div>
          </div>

          {/* AI Coach toggle */}
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={function (e) {
                setAiEnabled(e.target.checked)
                if (!e.target.checked) setApiKey('')
              }}
              className="w-4 h-4 rounded accent-[#c0622a]"
            />
            <span className="text-xs text-[#1a1d2e] font-semibold" style={barlow}>AI Coach</span>
          </label>

          {/* Groq API key — visible when AI enabled */}
          {aiEnabled && (
            <GroqKeyInput apiKey={apiKey} setApiKey={setApiKey} />
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!hasChanges && !saved}
            className="w-full py-2.5 rounded-xl text-white font-bold text-sm transition-colors"
            style={{
              background: saved ? '#2a9d5c' : hasChanges ? '#4f7ef8' : '#bbbcc8',
              cursor: hasChanges || saved ? 'pointer' : 'default',
              ...barlow,
            }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>

          {/* Export / Import */}
          <div className="border-t border-[#e5e7ef] pt-3 mt-1">
            <p className={labelCls} style={barlow}>Data</p>
            <div className="flex gap-2">
              <button
                onClick={function () {
                  var dump = Storage.load()
                  dump.groqKey = ''  // don't export API key
                  var blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
                  var url  = URL.createObjectURL(blob)
                  var a    = document.createElement('a')
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
                  onChange={function (e) {
                    var file = e.target.files && e.target.files[0]
                    if (!file) return
                    var reader = new FileReader()
                    reader.onload = function () {
                      try {
                        var imported = JSON.parse(reader.result)
                        if (!imported.sessions || !imported.exercises) {
                          alert('Invalid BetaLog export file')
                          return
                        }
                        if (!confirm('This will replace ALL your data. Are you sure?')) return
                        // Write each key
                        if (imported.sessions)       Storage.saveSessions(imported.sessions)
                        if (imported.exercises)      Storage.saveExercises(imported.exercises)
                        if (imported.routines)       Storage.saveRoutines(imported.routines)
                        if (imported.schedule)       Storage.saveSchedule(imported.schedule)
                        if (imported.weightLog)      Storage.saveWeightLog(imported.weightLog)
                        if (imported.athleteProfile) Storage.saveAthleteProfile(imported.athleteProfile)
                        // Reload
                        var reloaded = Storage.load()
                        setData(reloaded)
                        alert('Data imported successfully')
                        onClose()
                      } catch (err) {
                        alert('Failed to import: ' + err.message)
                      }
                    }
                    reader.readAsText(file)
                    e.target.value = ''  // reset so same file can be re-imported
                  }}
                />
              </label>
            </div>
          </div>

          {/* Restore defaults */}
          <div className="border-t border-[#e5e7ef] pt-3 mt-1">
            <p className={labelCls} style={barlow}>Restore defaults</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleRestoreExercises}
                className="w-full py-2 rounded-lg text-xs font-semibold border transition-colors"
                style={confirmEx
                  ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff', ...barlow }
                  : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }
                }
              >
                {confirmEx ? 'Tap again to confirm' : 'Restore built-in exercises'}
              </button>
              <button
                onClick={handleRestoreRoutines}
                className="w-full py-2 rounded-lg text-xs font-semibold border transition-colors"
                style={confirmHang
                  ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff', ...barlow }
                  : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }
                }
              >
                {confirmHang ? 'Tap again to confirm' : 'Restore built-in hang routines'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  var [data, setData]               = useState(null)
  var [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(function () {
    seedDefaultExercises()
    seedDefaultRoutines()
    var loaded = Storage.load()
    setData(loaded)
  }, [])

  if (!data) return null

  return (
    <DataContext.Provider value={{ data, setData }}>
      <div className="min-h-screen bg-white font-sans text-[#1a1d2e]">
        <ScrollToTop />
        <Nav onSettingsClick={function () { setSettingsOpen(true) }} />
        <main className="pb-16 md:pb-0">
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/log"     element={<Log />} />
            <Route path="/history" element={<History />} />
            <Route path="/plan"    element={<Plan />} />
            <Route path="/coach"   element={<Coach />} />
          </Routes>
        </main>
        <SettingsSheet
          open={settingsOpen}
          onClose={function () { setSettingsOpen(false) }}
          data={data}
          setData={setData}
        />
      </div>
    </DataContext.Provider>
  )
}
