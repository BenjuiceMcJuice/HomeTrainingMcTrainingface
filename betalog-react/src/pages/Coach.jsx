import { useState, useEffect } from 'react'
import { Loader2, Activity, AlertTriangle, Target, Zap } from 'lucide-react'
import { useData } from '../App'
import useSessions from '../hooks/useSessions'
import useProfile from '../hooks/useProfile'

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }
var labelCls = 'text-[10px] font-bold text-[#7a8299] uppercase tracking-wide'

export var PERSONAS = {
  jonas: {
    name: 'Jonas Ridge',
    desc: 'Elite coach — calm, precise, data-driven',
    color: '#4f7ef8',
    system: 'You are Jonas Ridge, an elite climbing and strength coach with a background in sports science and alpine competition. Speak with calm, unhurried precision. You never hype, never fluff. You trust the data and let it speak. Use correct anatomical and training terminology naturally. Structure your feedback clearly. You occasionally reference specific training methodologies (ARCing, max hangs, periodisation) when relevant. Your highest compliment is: "That tracks."',
  },
  chad: {
    name: 'CrankMaster Chad',
    desc: 'Boulder bro — hype, stoke, surprisingly smart',
    color: '#2a9d5c',
    system: 'You are CrankMaster Chad. You live at the crag. You tape your fingers before you tape your shoes. You have somehow absorbed an unreasonable amount of climbing physiology but you process it entirely through the lens of someone who thinks chalk is a personality. Your energy is genuine and relentless. You find the data legitimately exciting. Write everything as Chad would actually talk — enthusiastic, informal, probably slightly too loud. The science must be accurate but the vibe must be undeniably boulder bro.',
  },
  marina: {
    name: 'Dr Marina Sorel',
    desc: 'Sports physiologist — dry, precise, faintly sarcastic',
    color: '#8b5cf6',
    system: 'You are Dr Marina Sorel, a French sports physiologist and former competition route-setter. You are brilliant, precise, and quietly — sometimes not so quietly — sarcastic. You have seen every training mistake imaginable and you have very little patience for people who ignore rest or skip warmups. Your sarcasm is dry and delivered with complete composure. You are never cruel — but you are honest. French inflection in your phrasing — "this is not so surprising, no?", "but of course", "the body, it does not negotiate".',
  },
  geoff: {
    name: 'Geoff',
    desc: 'Your mate — banter, self-deprecation, somehow useful',
    color: '#d4742a',
    system: 'You are Geoff, a friendly, chaotic middle-aged climbing partner. You speak like a British mate at the climbing wall: supportive but constantly taking the mick. You are weak, scared of committing to moves, and inflexible, and you joke about it constantly. You encourage the user but always with humour and teasing. You are not a coach — you are a mate who accidentally read some training science and is now dangerously opinionated. You give real evidence-based advice but deliver it as if you just stumbled across it. Everything is affectionate, self-deprecating, and rooted in shared weakness and struggle.',
  },
}

var PERSONA_KEYS = ['jonas', 'chad', 'marina', 'geoff']

// ---------------------------------------------------------------------------
// Session context builder
// ---------------------------------------------------------------------------

export function buildContext(sessions, profile) {
  var lines = []

  if (profile) {
    var parts = []
    if (profile.name)     parts.push('Name: ' + profile.name)
    if (profile.heightCm) parts.push('Height: ' + profile.heightCm + 'cm')
    if (profile.weightKg) parts.push('Weight: ' + profile.weightKg + 'kg')
    if (profile.heightCm && profile.weightKg) {
      var bmi = (profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1)
      parts.push('BMI: ' + bmi)
    }
    if (profile.goals) parts.push('Goals: ' + profile.goals)
    if (parts.length) lines.push('ATHLETE: ' + parts.join(', '))
  }

  var cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  var cutoffStr = cutoff.toISOString().slice(0, 10)
  var recent = sessions.filter(function (s) { return s.date >= cutoffStr })

  if (recent.length === 0) {
    lines.push('RECENT ACTIVITY: No sessions in the last 30 days.')
    return lines.join('\n')
  }

  var gymCount = 0, climbCount = 0, hangCount = 0, totalEffort = 0, effortCount = 0
  recent.forEach(function (s) {
    if (s.type === 'gym') gymCount++
    if (s.type === 'climb') climbCount++
    if (s.type === 'hangboard') hangCount++
    if (s.difficulty) { totalEffort += s.difficulty; effortCount++ }
  })
  lines.push('LAST 30 DAYS: ' + recent.length + ' sessions (gym:' + gymCount + ', climb:' + climbCount + ', hang:' + hangCount + ')')
  if (effortCount > 0) lines.push('Average effort: ' + (totalEffort / effortCount).toFixed(1) + '/5')

  var dates = []
  recent.forEach(function (s) { if (dates.indexOf(s.date) === -1) dates.push(s.date) })
  dates.sort()
  if (dates.length >= 2) {
    var gaps = []
    for (var i = 1; i < dates.length; i++) {
      gaps.push(Math.round((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000))
    }
    var avgGap = gaps.reduce(function (a, b) { return a + b }, 0) / gaps.length
    lines.push('Avg rest between sessions: ' + avgGap.toFixed(1) + ' days')
  }

  lines.push('')
  lines.push('SESSION LOG:')
  recent.forEach(function (s) {
    var p = [s.date, s.type]
    if (s.difficulty) p.push('effort:' + s.difficulty + '/5')
    if (s.routineName) p.push('routine:' + s.routineName)
    if (s.type === 'gym' && s.exercises.length > 0) {
      var totalSets = s.exercises.reduce(function (acc, e) { return acc + e.sets.length }, 0)
      p.push(totalSets + ' sets: ' + s.exercises.map(function (e) { return e.name }).join(', '))
    }
    if (s.type === 'climb' && s.climbs.length > 0) {
      var g = {}
      s.climbs.forEach(function (c) { var k = c.grade + ' ' + c.outcome; g[k] = (g[k] || 0) + 1 })
      p.push(Object.keys(g).map(function (k) { return g[k] + 'x ' + k }).join(', '))
    }
    if (s.type === 'hangboard' && s.hangGrips.length > 0) {
      p.push(s.hangGrips.map(function (gr) { return gr.gripName + ' ' + gr.sets + 'x' + gr.reps }).join(', '))
    }
    if (s.notes) p.push('notes:"' + s.notes + '"')
    lines.push('- ' + p.join(' | '))
  })

  lines.push('')
  lines.push('TERMINOLOGY: "gym" = strength training (pullups, weights, etc). "climb" = actual climbing. "hangboard" = finger strength protocols. Never confuse gym with climbing.')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Groq API call
// ---------------------------------------------------------------------------

export function callGroq(key, persona, messages, context) {
  var systemMsg = persona.system +
    '\n\nIMPORTANT: You are ' + persona.name + '. Every single text field in your response MUST be written in your distinct voice and personality. Do not lapse into neutral assistant language under any circumstances.' +
    '\n\nHere is the athlete\'s recent training data:\n\n' + context

  var apiMessages = [{ role: 'system', content: systemMsg }]
  messages.forEach(function (m) {
    apiMessages.push({ role: m.role, content: m.content })
  })

  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 1400,
    }),
  })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error((err.error && err.error.message) || 'API error ' + res.status)
        })
      }
      return res.json()
    })
    .then(function (data) {
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('No response from API — try again')
      }
      return data.choices[0].message.content
    })
}

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

function parseAnalysis(text) {
  var match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) }
  catch (e) {
    try {
      var cleaned = match[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/([{,]\s*)([a-zA-Z_]+)\s*:/g, '$1"$2":')
      return JSON.parse(cleaned)
    } catch (e2) { return null }
  }
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

  var persona = PERSONAS[personaKey] || PERSONAS.jonas
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
    var context = buildContext(sessions, profile)
    var prompt  = buildAnalysisPrompt(persona.name)

    callGroq(apiKey, persona, [{ role: 'user', content: prompt }], context)
      .then(function (text) {
        var parsed = parseAnalysis(text)
        if (!parsed) {
          setError('AI response was malformed — try again, it usually works second time')
          return
        }
        setAnalysis(parsed)
      })
      .catch(function (err) { setError(err.message || 'Something went wrong') })
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
          var p = PERSONAS[key]
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
