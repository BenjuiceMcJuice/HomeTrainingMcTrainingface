import { useState, useEffect } from 'react'
import { X, AlertTriangle, Download } from 'lucide-react'
import { barlow } from '../../lib/utils'
import {
  DELETE_PHRASE, phraseMatches, signInMethod, reauthenticate, deleteAccount, deletionErrorMessage,
} from '../../lib/accountDeletion'

// Settings › Account › Delete account (BTL-B32). Three screens, each one a
// deliberate step: what goes, a tick that says you understand it cannot come
// back, then typing DELETE and signing in again. Nothing is touched until the
// last button, and the sign-in comes before any deletion.

var barlowText = { fontFamily: "'Barlow', sans-serif" }
var RED = '#dc2626'

function Bullet({ children }) {
  return (
    <li className="flex gap-2 text-xs text-[#1a1d2e] leading-snug" style={barlowText}>
      <span className="text-[#bbbcc8] shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}

function StepDots({ step }) {
  return (
    <div className="flex gap-1.5 mb-3" aria-label={'Step ' + step + ' of 3'}>
      {[1, 2, 3].map(function (n) {
        return <span key={n} className="h-1 flex-1 rounded-full" style={{ background: n <= step ? RED : '#e5e7ef' }} />
      })}
    </div>
  )
}

export default function DeleteAccountSheet({ open, onClose, user, data, onExport }) {
  var [step,       setStep]       = useState(1)
  var [understood, setUnderstood] = useState(false)
  var [phrase,     setPhrase]     = useState('')
  var [password,   setPassword]   = useState('')
  var [working,    setWorking]    = useState(null) // progress line while deleting
  var [error,      setError]      = useState(null)

  useEffect(function () {
    if (!open) return
    setStep(1); setUnderstood(false); setPhrase(''); setPassword(''); setWorking(null); setError(null)
  }, [open])

  if (!open || !user) return null

  var method = signInMethod(user)
  var standalone = typeof window !== 'undefined' && (window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches))
  // Same limit as sign-in: Google's popup cannot come back to an installed iOS app.
  var googleBlocked = method === 'google' && standalone
  var ready = phraseMatches(phrase) && (method !== 'password' || password.length > 0) && !googleBlocked

  function close() {
    if (working) return
    onClose()
  }

  function run() {
    if (!ready || working) return
    setError(null)
    setWorking('Confirming it is you…')
    reauthenticate(user, password)
      .then(function () { return deleteAccount(user, data, setWorking) })
      .then(function () {
        setWorking('Done. Your account has been deleted.')
        setTimeout(function () { window.location.replace('/') }, 1200)
      })
      .catch(function (err) {
        setWorking(null)
        setError(deletionErrorMessage(err))
      })
  }

  var sessions = (data && data.sessions) ? data.sessions.length : 0

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-6 max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-3">
          <p className="font-black flex items-center gap-2" style={{ ...barlow, fontSize: '20px', color: RED }}>
            <AlertTriangle size={20} /> Delete account
          </p>
          {!working && (
            <button onClick={close} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors" aria-label="Close">
              <X size={20} />
            </button>
          )}
        </div>

        <StepDots step={step} />

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>This deletes everything, for good</p>
            <ul className="flex flex-col gap-1.5">
              <Bullet>Your whole log — {sessions} session{sessions === 1 ? '' : 's'}, every climb, hang and workout</Bullet>
              <Bullet>Goals, routines, schedule, weight and drink logs, weekly scores and venues</Bullet>
              <Bullet>Your profile, and what your friends can see of it. You disappear from their friends list</Bullet>
              <Bullet>Your calendar feed and push reminders on this device</Bullet>
              <Bullet>Your sign-in ({user.email || 'this account'})</Bullet>
              <Bullet>The copy on this device</Bullet>
            </ul>
            <p className="text-xs text-[#7a8299] leading-snug" style={barlowText}>
              Not covered: feedback you have sent (ask through Send feedback and it will be removed),
              and reminders turned on from another phone or computer — switch those off there first,
              in Plan › Schedule.
            </p>
            <button
              onClick={onExport}
              className="w-full py-2 rounded-lg text-xs font-semibold border border-[#e5e7ef] text-[#4f7ef8] hover:bg-[#f8f9fc] transition-colors flex items-center justify-center gap-1.5"
              style={barlow}
            >
              <Download size={12} /> Export your data first (JSON)
            </button>
            <div className="flex gap-2 mt-1">
              <button onClick={close} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-[#e5e7ef] text-[#1a1d2e]" style={barlow}>
                Keep my account
              </button>
              <button onClick={function () { setStep(2) }} className="flex-1 py-2.5 rounded-xl text-sm font-bold border" style={{ ...barlow, borderColor: RED, color: RED }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>Are you sure?</p>
            <p className="text-xs text-[#1a1d2e] leading-snug" style={barlowText}>
              There is no undo and no backup. Once it is gone, nobody — including the developer — can bring it back.
              If you only want a break, signing out keeps everything.
            </p>
            <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl border" style={{ borderColor: understood ? RED : '#e5e7ef' }}>
              <input
                type="checkbox"
                checked={understood}
                onChange={function (e) { setUnderstood(e.target.checked) }}
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ accentColor: RED }}
              />
              <span className="text-xs text-[#1a1d2e] leading-snug" style={barlowText}>
                I understand my account and all my training data will be permanently deleted and cannot be recovered.
              </span>
            </label>
            <div className="flex gap-2 mt-1">
              <button onClick={close} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-[#e5e7ef] text-[#1a1d2e]" style={barlow}>
                Keep my account
              </button>
              <button
                onClick={function () { if (understood) setStep(3) }}
                disabled={!understood}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border"
                style={{ ...barlow, borderColor: understood ? RED : '#e5e7ef', color: understood ? RED : '#bbbcc8', cursor: understood ? 'pointer' : 'default' }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>Last check</p>
            <div>
              <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1" style={barlow}>
                Type {DELETE_PHRASE} to confirm
              </p>
              <input
                value={phrase}
                onChange={function (e) { setPhrase(e.target.value); setError(null) }}
                disabled={!!working}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder={DELETE_PHRASE}
                className="w-full px-2.5 py-2 rounded-lg border text-sm text-[#1a1d2e] bg-white placeholder:text-[#e5e7ef] focus:outline-none"
                style={{ borderColor: phraseMatches(phrase) ? RED : '#e5e7ef' }}
              />
            </div>

            {method === 'password' && (
              <div>
                <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1" style={barlow}>
                  Your password
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={function (e) { setPassword(e.target.value); setError(null) }}
                  disabled={!!working}
                  autoComplete="current-password"
                  className="w-full px-2.5 py-2 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white focus:outline-none focus:border-[#4f7ef8]"
                />
              </div>
            )}
            {method === 'google' && !googleBlocked && (
              <p className="text-xs text-[#7a8299] leading-snug" style={barlowText}>
                Google will ask you to sign in once more, to prove it is you.
              </p>
            )}
            {googleBlocked && (
              <p className="text-xs leading-snug" style={{ ...barlowText, color: RED }}>
                Google sign-in cannot open from the installed app. Open betalog.co.uk in Safari, sign in,
                and delete your account from Settings there.
              </p>
            )}

            {error && <p className="text-xs leading-snug" style={{ ...barlowText, color: RED }}>{error}</p>}
            {working && <p className="text-xs font-semibold text-[#1a1d2e]" style={barlow}>{working}</p>}

            <div className="flex gap-2 mt-1">
              {!working && (
                <button onClick={close} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-[#e5e7ef] text-[#1a1d2e]" style={barlow}>
                  Keep my account
                </button>
              )}
              <button
                onClick={run}
                disabled={!ready || !!working}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ ...barlow, background: ready && !working ? RED : '#f0b4b4', cursor: ready && !working ? 'pointer' : 'default' }}
              >
                {working ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
