import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Nav from './components/layout/Nav'
import SettingsSheet from './components/layout/SettingsSheet'
import LoginScreen from './components/auth/LoginScreen'
import FriendsScreen from './components/friends/FriendsScreen'
import Dashboard from './pages/Dashboard'
import Log from './pages/Log'
import History from './pages/History'
import Plan from './pages/Plan'
import Coach from './pages/Coach'
import Admin from './pages/Admin'
import Storage from './lib/storage'
import { auth, db } from './lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { seedDefaultExercises } from './hooks/useExercises'
import { seedDefaultRoutines } from './lib/defaultRoutines'
import { barlow } from './lib/utils'

// ---------------------------------------------------------------------------
// Data context
// ---------------------------------------------------------------------------

const DataContext = createContext(null)

/** @returns {{ data: import('./lib/types').BetaLogData, setData: Function } | null} */
export function useData() {
  return useContext(DataContext)
}

// ---------------------------------------------------------------------------
// Scroll to top on route change
// ---------------------------------------------------------------------------

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [user,         setUser]         = useState(undefined) // undefined = loading, null = signed out
  const [isAdmin,      setIsAdmin]      = useState(false)
  const [data,         setData]         = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [friendsOpen,  setFriendsOpen]  = useState(false)
  const [syncing,      setSyncing]      = useState(false)
  const [syncFailed,   setSyncFailed]   = useState(false)
  const syncTimerRef = useRef(null)

  // Listen for auth state changes
  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u || null)
      if (!u) { setIsAdmin(false); return }
      getDoc(doc(db, 'centreAdmins', u.uid)).then(snap => setIsAdmin(snap.exists()))
    })
  }, [])

  // Load data once auth resolves
  useEffect(() => {
    if (user === undefined) return // still loading auth

    seedDefaultExercises()
    seedDefaultRoutines()
    const loaded = Storage.load()
    setData(loaded) // eslint-disable-line react-hooks/set-state-in-effect -- initialising from localStorage on auth resolve

    if (user) {
      setSyncing(true)
      Storage.pullFromFirestore(user.uid).then(cloudData => {
        if (cloudData) {
          const localProfile = loaded.athleteProfile || {}
          const cloudUpdated = cloudData.updatedAt || ''
          const localUpdated = localProfile.updatedAt || ''
          const localEmpty   = !loaded.sessions || loaded.sessions.length === 0

          if (localEmpty && cloudData.sessions && cloudData.sessions.length > 0) {
            Storage.mergeFromCloud(cloudData)
            setData(Storage.load())
          } else if (cloudUpdated > localUpdated) {
            Storage.mergeFromCloud(cloudData)
            setData(Storage.load())
          }
        } else {
          Storage.syncToFirestore(user.uid)
        }
      }).finally(() => setSyncing(false))
    }
  }, [user])

  // Prompt for name on first login if not set
  const hasPromptedName = useRef(false)
  useEffect(() => {
    if (hasPromptedName.current) return
    if (user && data && (!data.athleteProfile || !data.athleteProfile.name)) {
      hasPromptedName.current = true
      setSettingsOpen(true) // eslint-disable-line react-hooks/set-state-in-effect -- one-shot prompt, guarded by ref
    }
  }, [user, data])

  // Wrap setData to also sync to Firestore (debounced, passes data directly to avoid re-loading)
  const setDataAndSync = useCallback(updater => {
    setData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (user) {
        clearTimeout(syncTimerRef.current)
        syncTimerRef.current = setTimeout(() => {
          Storage.syncToFirestore(
            user.uid, next,
            () => setSyncFailed(true),
            { email: user.email, displayName: user.displayName }
          )
        }, 300)
      }
      return next
    })
  }, [user])

  const handleSignOut = () => {
    localStorage.removeItem('il_groq_key')
    localStorage.removeItem('il_friendCode')
    localStorage.removeItem('il_friendCodeExpires')
    if ('caches' in window) caches.keys().then(names => names.forEach(n => caches.delete(n)))
    signOut(auth)
    setSettingsOpen(false)
  }

  // Auth loading
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-[#7a8299]" style={barlow}>Loading…</p>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  if (!data)  return null

  return (
    <DataContext.Provider value={{ data, setData: setDataAndSync }}>
      <div className="min-h-screen bg-white font-sans text-[#1a1d2e]">
        <ScrollToTop />
        <Nav
          onSettingsClick={() => setSettingsOpen(true)}
          onFriendsClick={() => setFriendsOpen(true)}
        />
        {syncing && (
          <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[90] px-3 py-1 rounded-full bg-[#1a1d2e] text-white text-[10px] font-semibold shadow-lg" style={barlow}>
            Syncing…
          </div>
        )}
        {syncFailed && !syncing && (
          <div
            className="fixed top-12 left-1/2 -translate-x-1/2 z-[90] px-3 py-1 rounded-full bg-[#e11d48] text-white text-[10px] font-semibold shadow-lg cursor-pointer"
            style={barlow}
            onClick={() => setSyncFailed(false)}
          >
            Sync failed — tap to dismiss
          </div>
        )}
        <main className="pb-16 md:pb-0">
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/log"     element={<Log />} />
            <Route path="/history" element={<History />} />
            <Route path="/plan"    element={<Plan />} />
            <Route path="/coach"   element={<Coach />} />
            <Route path="/admin"   element={isAdmin ? <Admin user={user} /> : <Navigate to="/" replace />} />
          </Routes>
        </main>
        <FriendsScreen
          open={friendsOpen}
          onClose={() => setFriendsOpen(false)}
          userId={user.uid}
          data={data}
        />
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          data={data}
          setData={setDataAndSync}
          user={user}
          onSignOut={handleSignOut}
          isAdmin={isAdmin}
        />
      </div>
    </DataContext.Provider>
  )
}
