import { useState, useEffect } from 'react'
import { Loader2, Activity, AlertTriangle, Target, Zap } from 'lucide-react'
import { useData } from '../App'
import useSessions from '../hooks/useSessions'
import useProfile from '../hooks/useProfile'
import {
  PERSONA_KEYS, getPersona, buildContext, callGroq,
  parseAnalysis, coachErrorMessage,
} from '../lib/coach'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }
var labelCls = 'text-[10px] font-bold text-[#7a8299] uppercase tracking-wide'

// ---------------------------------------------------------------------------
// Analysis prompt
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(personaName) {
  return [
    'VOICE: You are ' + personaName + '. Every text field in the JSON below must be written in your distinct voice and personality. Do not write in neutral assistant language under any circumstances.',
    '',
    'Analyse my recent training data and respond with ONLY valid JSON (no markdown, no text before/after):',
    '{',
    '  "summary": "3-4 sentences in your voice. Overall trajectory, the single most important finding, and one specific observation.",',
    '  "recovery": "1 sentence in your voice on rest patterns or effort trend. null if no issue.",',
    '  "pyramid": "1 sentence in your voice on climbing send rate distribution and projecting level. null if no climbing data.",',
    '  "plateau": "1 sentence in your voice if genuinely plateaued. null if progressing or insufficient data.",',
    '  "actions": [',
    '    {"what": "action title max 7 words", "why": "2 sentences in your voice — specific prescription based on the data", "type": "performance|recovery|hangboard|structure|health"}',
    '  ]',
    '}',
    'Include 2-4 actions. Each must be distinct and specific to the data. No generic advice.',
    'CRITICAL: Valid JSON only. No trailing commas. Escape quotes inside strings.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Analysis result cards
// ---------------------------------------------------------------------------

var FLAG_META = {
  recovery: { icon: Activity,      label: 'Recovery', riskColor: '#d94f6b', okColor: '#2a9d5c' },
  pyramid:  { icon: Target,        label: 'Projecting', color: '#4f7ef8' },
  plateau:  { icon: AlertTriangle, label: 'Plateau',  color: '#d97706' },
}

function FlagCard({ type, text }) {
  if (!text || text === 'null') return null
  var meta = FLAG_META[type]
  if (!meta) return null
  var isRisk = type === 'recovery' && /risk|flag|warning|overtrain|injur/i.test(text)
  var color = type === 'recovery' ? (isRisk ? meta.riskColor : meta.okColor) : meta.color
  var Icon = meta.icon
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border" style={{ borderColor: color + '30', background: color + '08' }}>
      <Icon size={14} style={{ color: color, marginTop: '2px' }} className="shrink-0" />
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wide mr-1.5" style={{ ...barlow, color: color }}>{meta.label}</span>
        <span className="text-xs text-[#1a1d2e] leading-relaxed">{text}</span>
      </div>
    </div>
  )
}

var ACTION_COLOR = {
  recovery: '#d94f6b', hangboard: '#8b5cf6', performance: '#4f7ef8', structure: '#2a9d5c', health: '#2a9d5c',
}

function ActionCard({ action }) {
  var color = ACTION_COLOR[action.type] || '#7a8299'
  return (
    <div className="rounded-xl border-l-[3px] bg-[#f8f9fc] px-3 py-2.5" style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ ...barlow, background: color + '15', color: color }}>
          {action.type || 'exercise'}
        </span>
        <span className="text-sm font-bold text-[#1a1d2e] leading-tight" style={barlow}>{action.what}</span>
      </div>
      <p className="text-xs text-[#7a8299] leading-relaxed">{action.why}</p>
    </div>
  )
}

function AnalysisResult({ analysis }) {
  if (!analysis) return null
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {analysis.summary && (
        <p className="text-sm text-[#1a1d2e] leading-relaxed">{analysis.summary}</p>
      )}
      {(analysis.recovery || analysis.pyramid || analysis.plateau) && (
        <div className="flex flex-col gap-2">
          <FlagCard type="recovery" text={analysis.recovery} />
          <FlagCard type="pyramid"  text={analysis.pyramid} />
          <FlagCard type="plateau"  text={analysis.plateau} />
        </div>
      )}
      {analysis.actions && analysis.actions.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-widest mb-2" style={barlow}>Focus areas</p>
          <div className="flex flex-col gap-2">
            {analysis.actions.map(function (a, i) { return <ActionCard key={i} action={a} /> })}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Coach page — analyse only
// ---------------------------------------------------------------------------

export default function Coach() {
  var { data }     = useData()
  var { sessions } = useSessions()
  var { profile, saveProfile } = useProfile()

  var [personaKey, setPersonaKey] = useState(function () {
    return localStorage.getItem('il_ai_persona') || 'jonas'
  })
  var [analysis,   setAnalysis]   = useState(null)
  var [goals,      setGoals]      = useState('')
  var [loading,    setLoading]    = useState(false)
  var [error,      setError]      = useState(null)

  var persona = getPersona(personaKey)
  var apiKey  = data.groqKey || ''

  useEffect(function () {
    setGoals(profile && profile.goals ? profile.goals : '')
  }, [profile])

  function saveGoals() {
    saveProfile({ goals: goals })
  }

  function selectPersona(key) {
    setPersonaKey(key)
    localStorage.setItem('il_ai_persona', key)
    setAnalysis(null)
    setError(null)
  }

  function runAnalysis() {
    if (loading) return
    setLoading(true)
    setError(null)
    setAnalysis(null)

    // Re-read key fresh from localStorage in case data context is stale
    var freshKey = localStorage.getItem('il_groq_key') || apiKey
    var context = buildContext(sessions, profile, data.goals, data.weightLog)
    var prompt  = buildAnalysisPrompt(persona.name)

    callGroq(freshKey, persona, [{ role: 'user', content: prompt }], context)
      .then(function (text) {
        var parsed = parseAnalysis(text)
        if (!parsed) {
          setError('AI response was malformed — try again, it usually works second time')
          return
        }
        setAnalysis(parsed)
      })
      .catch(function (err) {
        setError(coachErrorMessage(err, persona.name))
      })
      .finally(function () { setLoading(false) })
  }

  // No API key
  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center px-8 text-center gap-3 pt-20">
        <p className="text-base font-bold text-[#1a1d2e]" style={barlow}>AI Coach</p>
        <p className="text-sm text-[#7a8299] max-w-xs">
          Enable AI features in Settings (cog icon, top right) to get personalised training analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] md:h-[calc(100dvh-52px)]">

      {/* Persona picker */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0 border-b border-[#e5e7ef]" style={{ scrollbarWidth: 'none' }}>
        {PERSONA_KEYS.map(function (key) {
          var p = getPersona(key)
          var active = personaKey === key
          return (
            <button
              key={key}
              onClick={function () { selectPersona(key) }}
              className="shrink-0 px-3 py-1.5 rounded-xl border-2 transition-colors"
              style={active
                ? { borderColor: p.color, background: p.color + '10' }
                : { borderColor: '#e5e7ef', background: '#fff' }
              }
            >
              <span className="text-[11px] font-bold text-[#1a1d2e]" style={barlow}>{p.name}</span>
            </button>
          )
        })}
      </div>

      {/* Persona description */}
      <div className="px-4 py-1.5 border-b border-[#e5e7ef] shrink-0">
        <p className="text-[10px] text-[#7a8299] leading-relaxed">
          <span className="font-bold" style={{ ...barlow, color: persona.color }}>{persona.name}</span>
          {' — '}{persona.desc}
        </p>
      </div>

      {/* Goals field */}
      <div className="px-4 py-2 border-b border-[#e5e7ef] shrink-0">
        <p className={labelCls + ' mb-1'} style={barlow}>What are you working towards?</p>
        <input
          className="w-full px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-xs text-[#1a1d2e] bg-[#f8f9fc] placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#c0622a] transition-colors"
          value={goals}
          onChange={function (e) { setGoals(e.target.value) }}
          onBlur={function () { if (goals !== (profile && profile.goals || '')) saveGoals() }}
          placeholder="e.g. Send V6 by summer, improve lead endurance, train 3x per week…"
        />
        <p className="text-[9px] text-[#bbbcc8] mt-0.5">Your coach uses this to tailor advice to your specific goals</p>
      </div>

      {/* Analyse button — always at top */}
      <div className="px-4 py-3 border-b border-[#e5e7ef] shrink-0">
        <button
          onClick={runAnalysis}
          disabled={loading || sessions.length === 0}
          className="w-full py-2.5 rounded-xl text-white font-bold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2"
          style={{ background: loading ? '#7a8299' : sessions.length > 0 ? persona.color : '#bbbcc8', ...barlow }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {persona.name} is analysing…
            </>
          ) : (
            <>
              <Zap size={16} />
              {analysis ? 'Re-analyse' : 'Analyse my training'}
            </>
          )}
        </button>
        {sessions.length === 0 && !loading && (
          <p className="text-[10px] text-[#bbbcc8] text-center mt-1">Log some sessions first</p>
        )}
      </div>

      {/* Analysis results */}
      <div className="flex-1 overflow-y-auto">
        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center px-8 text-center gap-3 pt-12">
            <p className="text-xs text-[#7a8299] max-w-xs">
              {persona.name} analyses your last 30 days of training and gives structured, personalised feedback.
            </p>
          </div>
        )}

        {error && (
          <div className="px-4 pt-8 text-center">
            <p className="text-xs text-[#ef4444]">{error}</p>
          </div>
        )}

        <AnalysisResult analysis={analysis} />
      </div>
    </div>
  )
}
