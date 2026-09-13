/**
 * BetaLog — AI coach personas, prompt context and the Groq call.
 *
 * No React imports: the Coach page and the Dashboard tip widget both build
 * their prompt from here, and the pure parts are unit-tested in
 * lib/__tests__/coach.test.js.
 *
 * Token budget matters. The Groq free tier is 8,000 tokens per minute and the
 * pre-flight check counts the prompt PLUS whatever completion you reserve via
 * max_tokens — so a request costs its reservation whether or not the model
 * uses it. Keep `maxTokens` as tight as the job allows and prefer the
 * 'summary' context for anything that isn't the full analysis.
 */

import { getCurrentValueDetail as getGoalCurrentValueDetail, calcGoalProgress } from './goals'

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

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

export var PERSONA_KEYS = ['jonas', 'chad', 'marina', 'geoff']

/** Resolve a stored persona key to a persona, falling back to Jonas. */
export function getPersona(key) {
  return PERSONAS[key] || PERSONAS.jonas
}

// ---------------------------------------------------------------------------
// Session context builder
// ---------------------------------------------------------------------------

/**
 * Session notes are free text with no length limit in the UI, and they used to
 * go into the prompt whole. A fortnight of thorough note-taking was the one
 * realistic way for a user's own data to push a request past the rate limit,
 * so they are truncated here.
 */
export var NOTE_MAX = 200

export function capNote(note) {
  if (!note) return ''
  var clean = String(note).replace(/\s+/g, ' ').trim()
  if (clean.length <= NOTE_MAX) return clean
  return clean.slice(0, NOTE_MAX - 1).trimEnd() + '…'
}

function iso(daysBack) {
  var d = new Date()
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().slice(0, 10)
}

function climbSummary(climbs) {
  var g = {}
  climbs.forEach(function (c) { var k = c.grade + ' ' + c.outcome; g[k] = (g[k] || 0) + 1 })
  return Object.keys(g).map(function (k) { return g[k] + 'x ' + k }).join(', ')
}

function cardioLabel(s) {
  if (s.cardioLabel) return s.cardioLabel
  if (s.cardioActivity) return s.cardioActivity.charAt(0).toUpperCase() + s.cardioActivity.slice(1)
  return 'Cardio'
}

function goalLines(sessions, goals, weightLog) {
  var GOAL_LABEL = {
    boulder_grade: 'Boulder Grade', rope_grade: 'Rope Grade',
    run: 'Run', swim: 'Swim', cycle: 'Cycle', weight: 'Bodyweight',
  }
  var active = (goals || []).filter(function (g) { return !g.achieved })
  if (active.length === 0) return []

  var today = new Date().toISOString().slice(0, 10)
  var lines = ['', 'GOALS:']
  active.forEach(function (g) {
    var detail   = getGoalCurrentValueDetail(g.type, sessions, weightLog || [])
    var current  = detail.value
    var progress = calcGoalProgress(g, current)
    var days     = Math.round((new Date(g.targetDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
    var label    = GOAL_LABEL[g.type] || g.type
    var u        = g.unit ? ' ' + g.unit : ''
    var parts    = ['- ' + label + ':']
    // "Currently" on a grade goal is the pyramid's base grade — what the log
    // shows is owned over the window, not the hardest thing ever sent. Named as
    // such so the model cannot read it as a career high, with the project grade
    // alongside when the two differ. An absent base is stated, never filled in
    // from all-time: that fallback is what used to feed the coach a season two
    // years old as though it were today's form.
    var isGradeGoal = g.type === 'boulder_grade' || g.type === 'rope_grade'
    if (isGradeGoal) {
      var reading = detail.reading || {}
      var proj    = reading.project && reading.project !== current
        ? ' (best send ' + reading.project + ')'
        : ''
      if (current !== null) {
        parts.push('base grade ' + current + u + ' over the last ' + reading.windowDays + ' days' + proj + ',')
      } else {
        parts.push('no base grade yet' + proj + ',')
      }
    } else if (current !== null) parts.push('currently ' + current + u + ',')
    parts.push('target ' + g.target + u + ' by ' + g.targetDate + ' (' + days + ' days).')
    if (current !== null) parts.push('Progress: ' + Math.round(progress * 100) + '%.')
    lines.push(parts.join(' '))
  })
  return lines
}

var TERMINOLOGY = 'TERMINOLOGY: "gym" = strength training (pullups, weights, etc). "climb" = actual climbing. "hangboard" = finger strength protocols. "cardio" = cross-training (swim, run, cycle, etc). Never confuse gym with climbing. GRADES: "base" = the grade the climber owns (8+ sends in the last 180 days); "best" = the hardest single send in that window; a "send" goal is done on one send, an "own" goal when the base reaches the grade. Use these words, not "consistent" or "project", when talking about grades.'

/**
 * Build the training context sent to the model.
 *
 * @param {object[]} sessions
 * @param {object}   profile
 * @param {object[]} goals
 * @param {object[]} weightLog
 * @param {{detail?: 'full'|'summary'}} [opts] - 'summary' drops the per-session
 *   detail and returns the aggregate picture only. Roughly a quarter of the
 *   tokens, and all a one-line tip needs.
 * @returns {string}
 */
export function buildContext(sessions, profile, goals, weightLog, opts) {
  var summaryOnly = !!(opts && opts.detail === 'summary')
  var lines = []
  sessions = sessions || []

  if (profile) {
    var parts = []
    if (profile.name)     parts.push('Name: ' + profile.name)
    if (profile.heightCm) parts.push('Height: ' + profile.heightCm + 'cm')
    if (profile.weightKg) parts.push('Weight: ' + profile.weightKg + 'kg')
    if (profile.heightCm && profile.weightKg) {
      parts.push('BMI: ' + (profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1))
    }
    if (profile.goals) parts.push('Goals: ' + profile.goals)
    if (parts.length) lines.push('ATHLETE: ' + parts.join(', '))
  }

  var cutoffStr = iso(30)
  var recent = sessions.filter(function (s) { return s.date >= cutoffStr })

  if (recent.length === 0) {
    lines.push('RECENT ACTIVITY: No sessions in the last 30 days.')
    return lines.join('\n')
  }

  var cutoff14Str = iso(14)
  var primary = recent.filter(function (s) { return s.date >= cutoff14Str })
  var older   = recent.filter(function (s) { return s.date <  cutoff14Str })

  var gymCount = 0, climbCount = 0, hangCount = 0, cardioCount = 0, totalEffort = 0, effortCount = 0
  recent.forEach(function (s) {
    if (s.type === 'gym') gymCount++
    if (s.type === 'climb') climbCount++
    if (s.type === 'hangboard') hangCount++
    if (s.type === 'cardio') cardioCount++
    if (s.difficulty) { totalEffort += s.difficulty; effortCount++ }
  })
  var typeSummary = 'gym:' + gymCount + ', climb:' + climbCount + ', hang:' + hangCount
  if (cardioCount > 0) typeSummary += ', cardio:' + cardioCount
  lines.push('LAST 30 DAYS: ' + recent.length + ' sessions (' + typeSummary + ')')
  if (effortCount > 0) lines.push('Average effort: ' + (totalEffort / effortCount).toFixed(1) + '/5')

  var trainingDates = []
  recent.forEach(function (s) {
    if (s.type !== 'cardio' && trainingDates.indexOf(s.date) === -1) trainingDates.push(s.date)
  })
  trainingDates.sort()
  if (trainingDates.length >= 2) {
    var gaps = []
    for (var i = 1; i < trainingDates.length; i++) {
      gaps.push(Math.round((new Date(trainingDates[i]) - new Date(trainingDates[i - 1])) / 86400000))
    }
    var avgGap = gaps.reduce(function (a, b) { return a + b }, 0) / gaps.length
    lines.push('Avg rest between training sessions (excl. cardio): ' + avgGap.toFixed(1) + ' days')
  }
  if (cardioCount > 0) lines.push('Cardio sessions (walks/swims/runs): ' + cardioCount + ' in last 30 days')

  if (summaryOnly) {
    lines.push('Sessions in the last 14 days: ' + primary.length)
    var latest = recent.slice().sort(function (a, b) { return a.date > b.date ? -1 : 1 }).slice(0, 3)
    if (latest.length > 0) {
      lines.push('MOST RECENT SESSIONS:')
      latest.forEach(function (s) {
        var p = [s.date, s.type === 'cardio' ? cardioLabel(s) : s.type]
        if (s.difficulty) p.push('effort:' + s.difficulty + '/5')
        if (s.type === 'climb' && s.climbs && s.climbs.length > 0) p.push(climbSummary(s.climbs))
        lines.push('- ' + p.join(' | '))
      })
    }
    return lines.concat(goalLines(sessions, goals, weightLog)).concat(['', TERMINOLOGY]).join('\n')
  }

  lines.push('')
  lines.push('NOTE: Base your analysis primarily on the last 14 days. Prior history (15-30 days ago) is for trend context only — do not flag old behaviour as a current issue.')
  lines.push('')
  lines.push('LAST 14 DAYS — PRIMARY FOCUS:')
  if (primary.length === 0) lines.push('(no sessions)')
  primary.forEach(function (s) {
    var p = [s.date, s.type]
    if (s.difficulty) p.push('effort:' + s.difficulty + '/5')
    if (s.routineName) p.push('routine:' + s.routineName)
    if (s.type === 'gym' && s.exercises.length > 0) {
      var totalSets = s.exercises.reduce(function (acc, e) { return acc + e.sets.length }, 0)
      p.push(totalSets + ' sets: ' + s.exercises.map(function (e) {
        return e.name + (e.done === false ? ' (SKIPPED)' : '')
      }).join(', '))
      if (s.routineId) {
        var doneCount = s.exercises.filter(function (e) { return e.done !== false }).length
        if (doneCount < s.exercises.length) {
          p.push('completed ' + doneCount + '/' + s.exercises.length)
        }
      }
    }
    if (s.type === 'climb' && s.climbs.length > 0) p.push(climbSummary(s.climbs))
    if (s.type === 'hangboard' && s.hangGrips.length > 0) {
      p.push(s.hangGrips.map(function (gr) { return gr.gripName + ' ' + gr.sets + 'x' + gr.reps }).join(', '))
    }
    if (s.type === 'cardio') {
      p[1] = cardioLabel(s)
      if (s.cardioDurationMins) p.push(s.cardioDurationMins + 'min')
      if (s.cardioQuantity && s.cardioUnit) {
        var qtyStr = s.cardioQuantity + ' ' + s.cardioUnit
        if (s.cardioActivity === 'swim' && s.cardioUnit === 'lengths' && s.cardioPoolLength) {
          var metres = Math.round(s.cardioQuantity * s.cardioPoolLength)
          qtyStr += ' (' + (metres >= 1000 ? (metres / 1000).toFixed(1) + 'km' : metres + 'm') + ')'
        }
        p.push(qtyStr)
      }
    }
    if (s.notes) p.push('notes:"' + capNote(s.notes) + '"')
    lines.push('- ' + p.join(' | '))
  })

  if (older.length > 0) {
    lines.push('')
    lines.push('PRIOR HISTORY 15–30 DAYS AGO (trend context only):')
    older.forEach(function (s) {
      var p = [s.date, s.type]
      if (s.difficulty) p.push('effort:' + s.difficulty + '/5')
      if (s.routineName) p.push('routine:' + s.routineName)
      if (s.type === 'gym' && s.exercises.length > 0) {
        var doneCount = s.exercises.filter(function (e) { return e.done !== false }).length
        p.push(doneCount + '/' + s.exercises.length + ' exercises completed')
      }
      if (s.type === 'climb' && s.climbs.length > 0) p.push(climbSummary(s.climbs))
      if (s.type === 'hangboard' && s.hangGrips.length > 0) p.push(s.hangGrips.length + ' grip(s)')
      if (s.type === 'cardio') {
        p[1] = cardioLabel(s)
        if (s.cardioDurationMins) p.push(s.cardioDurationMins + 'min')
      }
      lines.push('- ' + p.join(' | '))
    })
  }

  return lines.concat(goalLines(sessions, goals, weightLog)).concat(['', TERMINOLOGY]).join('\n')
}

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------

/**
 * Pull the wait time out of a Groq 429 message.
 *
 * Groq says exactly how long to wait ("Please try again in 9.577499999s",
 * sometimes "in 1m20s"), and that number is far more use to the reader than
 * the raw message, which leads with a model id and an org id.
 *
 * @param {string} message
 * @returns {number|null} seconds to wait, rounded up
 */
export function parseRetryAfter(message) {
  if (!message) return null
  var m = String(message).match(/try again in\s+(?:(\d+)m)?\s*([\d.]+)?s/i)
  if (!m) return null
  var mins = m[1] ? parseInt(m[1], 10) : 0
  var secs = m[2] ? parseFloat(m[2]) : 0
  if (!mins && !secs) return null
  return Math.ceil(mins * 60 + secs)
}

/**
 * Turn an error from callGroq into something worth showing a climber.
 *
 * Always returns a self-contained sentence, so callers render it as-is rather
 * than prefixing it — two clauses either side of an em dash read as a stutter.
 *
 * @param {Error} err
 * @param {string} personaName
 * @returns {string}
 */
export function coachErrorMessage(err, personaName) {
  var raw = (err && err.message) || 'Something went wrong'
  var who = personaName || 'The coach'
  if (err && err.rateLimited) {
    var tail = err.retryAfterSec ? 'Try again in ' + err.retryAfterSec + 's.' : 'Give it a moment and try again.'
    return who + ' is out of breath. The free AI tier allows about three requests a minute. ' + tail
  }
  if (err && err.truncated) return who + ' ran out of room mid-sentence. Try again.'
  return 'Coach unavailable — ' + raw
}

// ---------------------------------------------------------------------------
// Groq API call
// ---------------------------------------------------------------------------

/**
 * Groq model and endpoint.
 *
 * Groq decommissions models on a schedule and does not fall back — a retired id
 * just starts returning an error, which is how the coach silently died in
 * August 2026 when `llama-3.3-70b-versatile` was withdrawn on the 16th.
 * Keep this in one place, and when it next breaks check
 * https://console.groq.com/docs/deprecations before changing it.
 */
export var GROQ_MODEL    = 'openai/gpt-oss-120b'
export var GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

/** Completion budget for the full JSON analysis. */
export var ANALYSIS_MAX_TOKENS = 1400

/**
 * Completion budget for the one-sentence dashboard tip.
 *
 * The answer itself is ~30 tokens, but gpt-oss is a reasoning model and its
 * reasoning tokens come out of the same budget — cut this much below 400 and
 * the model spends the lot thinking and returns empty content.
 */
export var TIP_MAX_TOKENS = 400

/**
 * @param {string} key
 * @param {object} persona
 * @param {{role: string, content: string}[]} messages
 * @param {string} context
 * @param {{maxTokens?: number}} [opts]
 * @returns {Promise<string>}
 */
export function callGroq(key, persona, messages, context, opts) {
  var maxTokens = (opts && opts.maxTokens) || ANALYSIS_MAX_TOKENS

  var systemMsg = persona.system +
    '\n\nIMPORTANT: You are ' + persona.name + '. Every single text field in your response MUST be written in your distinct voice and personality. Do not lapse into neutral assistant language under any circumstances.' +
    '\n\nHere is the athlete\'s recent training data:\n\n' + context

  var apiMessages = [{ role: 'system', content: systemMsg }]
  messages.forEach(function (m) {
    apiMessages.push({ role: m.role, content: m.content })
  })

  return fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  })
    .then(function (res) {
      if (!res.ok) {
        var headerRetry = parseFloat(res.headers && res.headers.get ? res.headers.get('retry-after') : null)
        return res.json().catch(function () { return {} }).then(function (body) {
          var msg = (body.error && body.error.message) || 'API error ' + res.status
          var err = new Error(msg)
          if (res.status === 429) {
            err.rateLimited  = true
            err.retryAfterSec = parseRetryAfter(msg) || (headerRetry ? Math.ceil(headerRetry) : null)
          }
          throw err
        })
      }
      return res.json()
    })
    .then(function (data) {
      var choice = data.choices && data.choices[0]
      if (!choice || !choice.message) throw new Error('No response from API — try again')
      var content = (choice.message.content || '').trim()
      if (!content) {
        // gpt-oss spends its budget on reasoning before it writes anything, so
        // a too-small max_tokens comes back as a well-formed, empty response.
        var err = new Error('The coach ran out of tokens before answering — try again')
        err.truncated = choice.finish_reason === 'length'
        throw err
      }
      return content
    })
}

// ---------------------------------------------------------------------------
// Analysis JSON
// ---------------------------------------------------------------------------

export function parseAnalysis(text) {
  var match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) }
  catch {
    try {
      var cleaned = match[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/([{,]\s*)([a-zA-Z_]+)\s*:/g, '$1"$2":')
      return JSON.parse(cleaned)
    } catch { return null }
  }
}
