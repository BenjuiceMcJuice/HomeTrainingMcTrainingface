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
import { seedDefaultRoutines } from './lib/defaultRoutines'

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

function SettingsSheet({ open, onClose, data, setData }) {
  var [name,     setName]     = useState('')
  var [heightCm,  setHeightCm]  = useState(170)
  var [aiEnabled, setAiEnabled] = useState(false)
  var [apiKey,    setApiKey]    = useState('')
  var [saved,     setSaved]     = useState(false)
  var [orig,      setOrig]      = useState({ name: '', heightCm: 170, aiEnabled: false, apiKey: '' })

  var [confirmEx,   setConfirmEx]   = useState(false)
  var [confirmHang, setConfirmHang] = useState(false)

  // To use a test key, paste it here locally — never commit a real key
  var TEST_KEY = ''

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
    // Only use stored key if it looks like a real Groq key, otherwise fall back to test key
    var isRealKey = apiKey && apiKey.indexOf('gsk_') === 0
    var effectiveKey = aiEnabled ? (isRealKey ? apiKey : TEST_KEY) : ''

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
    seedDefaultExercises(true)
    var reloaded = Storage.load()
    setData(reloaded)
    setConfirmEx(false)
  }

  function handleRestoreRoutines() {
    if (!confirmHang) { setConfirmHang(true); return }
    seedDefaultRoutines(true)
    var reloaded = Storage.load()
    setData(reloaded)
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
            <div>
              <p className={labelCls} style={barlow}>Groq API Key</p>
              <input
                className={inputCls}
                type="password"
                value={apiKey}
                onChange={function (e) { setApiKey(e.target.value) }}
                placeholder="gsk_..."
              />
              {!apiKey && (
                <p className="text-[9px] text-[#bbbcc8] mt-1 leading-relaxed">
                  Get a free key at{' '}
                  <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="underline text-[#4f7ef8]">console.groq.com/keys</a>.
                  Leave blank to use the built-in test key.
                </p>
              )}
              {apiKey && (
                <p className="text-[9px] text-[#2a9d5c] mt-0.5" style={barlow}>Key set</p>
              )}
            </div>
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
