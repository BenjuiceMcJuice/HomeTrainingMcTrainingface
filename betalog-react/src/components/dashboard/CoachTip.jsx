import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { todayStr } from '../../lib/stats'
import { barlow } from '../../lib/utils'
import WidgetMark, { WidgetEdge } from './WidgetMark'
import { getPersona, buildContext, callGroq, coachErrorMessage, TIP_MAX_TOKENS } from '../../lib/coach'

const TIP_CACHE_KEY = 'il_coach_tip'

export default function CoachTip({ sessions, profile, apiKey, goals, weightLog }) {
  // The tip carries the persona it was written in, not whichever persona is
  // selected now — the voice is baked into the sentence, so labelling a cached
  // Jonas line as Geoff would just be a lie.
  const [tip,     setTip]     = useState(null)   // { text, personaKey }
  const [loading, setLoading] = useState(false)
  const [failed,  setFailed]  = useState('')

  const currentKey = localStorage.getItem('il_ai_persona') || 'jonas'

  const fetchTip = (skipCache) => {
    if (!apiKey || sessions.length === 0 || loading) return

    if (!skipCache) {
      try {
        const cached = JSON.parse(localStorage.getItem(TIP_CACHE_KEY) || '{}')
        // Keyed on the date alone. It used to include the persona, which meant
        // trying all four personas on the Coach page cost four more tip calls —
        // each one a near-full request against an 8,000/min budget.
        if (cached.date === todayStr() && cached.tip) {
          setTip({ text: cached.tip, personaKey: cached.persona || 'jonas' })
          return
        }
      } catch { /* ignore */ }
    }

    const persona = getPersona(currentKey)
    // A one-sentence tip does not need fourteen days of per-session detail.
    const context = buildContext(sessions, profile, goals, weightLog, { detail: 'summary' })
    setFailed('')
    setLoading(true)
    callGroq(apiKey, persona, [
      { role: 'user', content: 'You are ' + persona.name + '. Write ONE sentence — a specific training observation or tip based on my recent data. Must sound unmistakably like ' + persona.name + '. Max 20 words. No greeting, no preamble. Stay fully in character.' }
    ], context, { maxTokens: TIP_MAX_TOKENS })
      .then(reply => {
        setTip({ text: reply, personaKey: currentKey })
        localStorage.setItem(TIP_CACHE_KEY, JSON.stringify({ date: todayStr(), persona: currentKey, tip: reply }))
      })
      // Surfacing this matters: swallowing it made the whole widget return null,
      // so a bad key or an unreachable Groq just made the card vanish with no
      // clue why — and in edit mode it left a blank draggable box behind.
      .catch((err) => {
        console.error('Coach tip failed', err)
        // Show a message worth reading. When Groq withdrew llama-3.3-70b-versatile
        // the API said exactly that, and a generic "couldn't reach the coach" sent
        // us hunting an API key that was never the problem. Rate limits get
        // translated, because Groq's own 429 leads with an org id.
        setFailed(coachErrorMessage(err, getPersona(currentKey).name))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTip(false) }, [apiKey, sessions.length]) // eslint-disable-line react-hooks/exhaustive-deps,react-hooks/set-state-in-effect

  if (!apiKey || (!tip && !loading && !failed)) return null

  const shown = getPersona(tip ? tip.personaKey : currentKey)

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-2.5 flex items-start gap-2 relative">
        {/* The persona's colour is the mark; the tip itself no longer wraps
            against a 26px gutter it was never using. */}
        <WidgetEdge accent={shown.color} />
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#7a8299] mb-0.5" style={barlow}>
            <WidgetMark icon={MessageCircle} accent={shown.color} size={13} />
            {shown.name}
          </p>
          {loading
            ? <p className="text-xs text-[#bbbcc8]">Thinking…</p>
            : failed && !tip
              ? <p className="text-xs text-[#bbbcc8]">{failed}</p>
              : <p className="text-xs text-[#1a1d2e] leading-relaxed">{tip ? tip.text : ''}</p>
          }
        </div>
        <button
          onClick={() => fetchTip(true)}
          disabled={loading}
          className="p-1 rounded-lg text-[#bbbcc8] hover:text-[#7a8299] hover:bg-[#f4f5f9] transition-colors shrink-0 mt-0.5"
          title="New tip"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
