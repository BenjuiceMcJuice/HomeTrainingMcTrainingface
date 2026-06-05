import { useState, useEffect } from 'react'
import { auth, googleProvider, browserPopupRedirectResolver } from '../../lib/firebase'
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { barlow } from '../../lib/utils'

// Timer ref lives outside the component so it survives re-renders
let _googleTimer = null

export default function LoginScreen() {
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [showEmail, setShowEmail] = useState(false)
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [isSignUp,  setIsSignUp]  = useState(false)

  // On iOS, signInWithPopup opens in a new tab instead of a popup.
  // The promise never resolves in the original tab, but onAuthStateChanged
  // WILL fire (via localStorage storage events) if auth succeeds.
  // visibilitychange catches when the user returns without completing auth
  // so we can reset the loading state instead of hanging forever.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (_googleTimer) {
        if (!auth.currentUser) {
          clearTimeout(_googleTimer)
          _googleTimer = null
          setLoading(false)
          setError('Sign in was cancelled. Try again or use email login.')
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const handleGoogle = () => {
    // iOS PWA (standalone): window.open() is intercepted by iOS and opens Safari.
    // The popup promise never resolves back to the PWA, causing an infinite hang.
    // signInWithRedirect also fails — iOS WKWebView clears localStorage on navigation,
    // so getRedirectResult loses its state on return. Neither method works.
    //
    // Fix: tell the user to sign in via Safari instead. Auth tokens are stored in
    // betalog.co.uk localStorage which the PWA shares — sign in once in Safari and
    // the installed app picks it up automatically.
    const isStandalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) {
      setShowEmail(true)
      setError("Google sign-in doesn't work in the installed app. Open betalog.co.uk in Safari to sign in with Google — or use email login below.")
      return
    }

    setLoading(true)
    setError(null)

    // Safety-net: if popup hangs for 60s (e.g. iOS Safari new-tab flow), give up
    if (_googleTimer) clearTimeout(_googleTimer)
    _googleTimer = setTimeout(() => {
      _googleTimer = null
      if (!auth.currentUser) {
        setLoading(false)
        setError('Google sign-in timed out. Please try email login.')
      }
    }, 60000)

    signInWithPopup(auth, googleProvider, browserPopupRedirectResolver)
      .then(() => {
        if (_googleTimer) { clearTimeout(_googleTimer); _googleTimer = null }
        // onAuthStateChanged handles navigation
      })
      .catch(err => {
        if (_googleTimer) { clearTimeout(_googleTimer); _googleTimer = null }
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          setLoading(false)
          return
        }
        setError(err.message || 'Sign in failed')
        setLoading(false)
      })
  }

  const handleEmail = () => {
    if (!email || !password) { setError('Enter email and password'); return }
    if (password.length < 12) { setError('Password must be at least 12 characters'); return }
    setLoading(true)
    setError(null)
    const fn = isSignUp ? createUserWithEmailAndPassword : signInWithEmailAndPassword
    fn(auth, email, password)
      .catch(err => {
        const msg = err.code === 'auth/user-not-found'      ? 'Incorrect email or password'
          : err.code === 'auth/wrong-password'              ? 'Incorrect email or password'
          : err.code === 'auth/email-already-in-use'        ? 'Sign in failed — try signing in instead'
          : err.code === 'auth/invalid-email'               ? 'Invalid email address'
          : err.message || 'Sign in failed'
        setError(msg)
        setLoading(false)
      })
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center gap-4">
      <p style={{ ...barlow, fontWeight: 900, fontSize: '36px', letterSpacing: '-0.5px', color: '#1a1a2e' }}>
        Beta<span style={{ color: '#4f7ef8' }}>Log</span>
      </p>
      <p className="text-sm text-[#7a8299] max-w-xs">
        Climbing training tracker. Sign in to sync your data across devices.
      </p>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full max-w-xs flex items-center gap-3 px-6 py-3 rounded-xl border border-[#e5e7ef] bg-white hover:bg-[#f8f9fc] transition-colors shadow-sm justify-center"
      >
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        <span className="text-sm font-semibold text-[#1a1d2e]">
          {loading && !showEmail ? 'Signing in…' : 'Sign in with Google'}
        </span>
      </button>

      <div className="flex items-center gap-3 w-full max-w-xs">
        <div className="flex-1 h-px bg-[#e5e7ef]" />
        <span className="text-[10px] text-[#bbbcc8]">or</span>
        <div className="flex-1 h-px bg-[#e5e7ef]" />
      </div>

      {!showEmail ? (
        <button onClick={() => setShowEmail(true)} className="text-xs text-[#4f7ef8] font-semibold" style={barlow}>
          Use email instead
        </button>
      ) : (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            className="w-full px-3 py-2.5 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
          />
          <button
            onClick={handleEmail}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-white font-bold text-sm transition-colors"
            style={{ background: loading ? '#7a8299' : '#4f7ef8', ...barlow }}
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
          <button onClick={() => { setIsSignUp(!isSignUp); setError(null) }} className="text-[11px] text-[#7a8299]">
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-[#ef4444] max-w-xs">{error}</p>}
      <p className="text-[10px] text-[#bbbcc8] max-w-xs mt-2">
        Your data syncs securely via Firebase across all your devices.
      </p>
    </div>
  )
}
