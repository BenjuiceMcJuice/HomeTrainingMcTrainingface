import { useState } from 'react'
import useProfile from '../../hooks/useProfile'
import Layer from '../ui/Layer'
import { barlow } from '../../lib/utils'

/**
 * The one question a new account is asked: what to call you.
 *
 * It used to be the whole Settings sheet opening by itself, so the first thing
 * a climber saw after signing up was Beep timing, Locations and Restore built-in
 * exercises with a Name field at the top (2026-10-11). Now it is one field and
 * one button; everything else waits in Settings for whoever wants it.
 *
 * No backdrop tap and no close: a profile without a name has no name for the
 * friends board, and the sheet opens exactly once per app load (App.jsx).
 */
export default function NamePrompt({ open, onDone }) {
  var { saveProfile } = useProfile()
  var [name, setName] = useState('')
  if (!open) return null

  var trimmed = name.trim()

  function submit(e) {
    e.preventDefault()
    if (!trimmed) return
    saveProfile({ name: trimmed })
    onDone()
  }

  return (
    <Layer>
    <div className="fixed inset-0 z-[85] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" />
      <form onSubmit={submit} className="relative bg-white rounded-t-2xl px-5 pt-5 pb-8">
        <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '22px', letterSpacing: '-0.2px' }}>
          Welcome to BetaLog
        </p>
        <p className="text-sm text-[#7a8299] mt-1 mb-4" style={{ fontFamily: "'Barlow', sans-serif" }}>
          What should we call you? It is the name your friends will see. Everything else can wait.
        </p>
        <input
          autoFocus
          type="text"
          autoComplete="name"
          value={name}
          onChange={function (e) { setName(e.target.value) }}
          placeholder="Your name"
          className="w-full px-3 py-2.5 rounded-lg border border-[#e5e7ef] text-base text-[#1a1d2e] bg-white focus:outline-none focus:border-[#4f7ef8] transition-colors"
        />
        <button
          type="submit"
          disabled={!trimmed}
          className="w-full mt-3 py-3 rounded-xl text-base font-bold text-white transition-colors disabled:opacity-40"
          style={{ ...barlow, background: '#4f7ef8' }}
        >
          Save
        </button>
      </form>
    </div>
    </Layer>
  )
}
