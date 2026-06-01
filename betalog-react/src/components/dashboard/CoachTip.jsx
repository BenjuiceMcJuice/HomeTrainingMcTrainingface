import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { todayStr } from '../../lib/stats'
import { barlow } from '../../lib/utils'
import { PERSONAS, buildContext, callGroq } from '../../pages/Coach'

const TIP_CACHE_KEY = 'il_coach_tip'

export default function CoachTip({ sessions, profile, apiKey, goals, weightLog }) {
  const [tip,     setTip]     = useState(null)
  const [loading, setLoading] = useState(false)

  const pKey    = localStorage.getItem('il_ai_persona') || 'jonas'
  const persona = PERSONAS[pKey] || PERSONAS.jonas

  const fetchTip = (skipCache) => {
    if (!apiKey || sessions.length === 0 || loading) return

    if (!skipCache) {
      try {
        const cached = JSON.parse(localStorage.getItem(TIP_CACHE_KEY) || '{}')
        if (cached.date === todayStr() && cached.persona === pKey && cached.tip) {
          setTip(cached.tip)
          return
        }
      } catch { /* ignore */ }
    }

    const context = buildContext(sessions, profile, goals, weightLog)
    setLoading(true)
    callGroq(apiKey, persona, [
      { role: 'user', content: 'You are ' + persona.name + '. Write ONE sentence — a specific training observation or tip based on my recent data. Must sound unmistakably like ' + persona.name + '. Max 20 words. No greeting, no preamble. Stay fully in character.' }
    ], context)
      .then(reply => {
        setTip(reply)
        localStorage.setItem(TIP_CACHE_KEY, JSON.stringify({ date: todayStr(), persona: pKey, tip: reply }))
      })
      .catch(() => { /* silently fail */ })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchTip(false) }, [apiKey, sessions.length]) // eslint-disable-line react-hooks/exhaustive-deps,react-hooks/set-state-in-effect

  if (!apiKey || (!tip && !loading)) return null

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-2.5 flex items-start gap-2.5">
        <MessageCircle size={16} style={{ color: persona.color, marginTop: '2px' }} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-[#7a8299] mb-0.5" style={barlow}>{persona.name}</p>
          {loading
            ? <p className="text-xs text-[#bbbcc8]">Thinking…</p>
            : <p className="text-xs text-[#1a1d2e] leading-relaxed">{tip}</p>
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
