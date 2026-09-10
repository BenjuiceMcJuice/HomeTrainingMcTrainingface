import { describe, it, expect } from 'vitest'
import {
  buildContext, capNote, NOTE_MAX,
  parseRetryAfter, coachErrorMessage,
  getPersona, parseAnalysis,
  TIP_MAX_TOKENS, ANALYSIS_MAX_TOKENS,
} from '../coach'

const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const gym = (n, extra = {}) => ({
  date: daysAgo(n), type: 'gym', difficulty: 3,
  exercises: [{ name: 'Pullups', sets: [{}, {}, {}] }], ...extra,
})

const climb = (n, extra = {}) => ({
  date: daysAgo(n), type: 'climb', difficulty: 4,
  climbs: [
    { grade: 'V4', outcome: 'flash' },
    { grade: 'V4', outcome: 'flash' },
    { grade: 'V5', outcome: 'fail' },
  ], ...extra,
})

describe('capNote', () => {
  it('leaves short notes alone', () => {
    expect(capNote('felt strong')).toBe('felt strong')
  })

  it('collapses whitespace so newlines do not pad the prompt', () => {
    expect(capNote('felt\n\n  strong   today')).toBe('felt strong today')
  })

  it('truncates long notes to the cap', () => {
    const long = 'a'.repeat(NOTE_MAX + 500)
    const out  = capNote(long)
    expect(out.length).toBe(NOTE_MAX)
    expect(out.endsWith('…')).toBe(true)
  })

  it('handles missing notes', () => {
    expect(capNote(null)).toBe('')
    expect(capNote(undefined)).toBe('')
    expect(capNote('')).toBe('')
  })
})

describe('buildContext', () => {
  it('reports no activity when nothing is in range', () => {
    const out = buildContext([gym(90)], null, [], [])
    expect(out).toContain('No sessions in the last 30 days')
  })

  it('counts sessions by type over 30 days', () => {
    const out = buildContext([gym(2), climb(4), gym(20)], null, [], [])
    expect(out).toContain('LAST 30 DAYS: 3 sessions')
    expect(out).toContain('gym:2')
    expect(out).toContain('climb:1')
  })

  it('splits the last 14 days from prior history', () => {
    const out = buildContext([gym(3), gym(20)], null, [], [])
    expect(out).toContain('LAST 14 DAYS — PRIMARY FOCUS')
    expect(out).toContain('PRIOR HISTORY 15–30 DAYS AGO')
  })

  it('groups climbs by grade and outcome', () => {
    const out = buildContext([climb(3)], null, [], [])
    expect(out).toContain('2x V4 flash')
    expect(out).toContain('1x V5 fail')
  })

  it('caps notes inside the prompt', () => {
    const out = buildContext([gym(2, { notes: 'x'.repeat(1000) })], null, [], [])
    expect(out).not.toContain('x'.repeat(NOTE_MAX + 1))
    expect(out).toContain('…')
  })

  it('includes the athlete profile and BMI when both measurements exist', () => {
    const out = buildContext([gym(2)], { name: 'Ben', heightCm: 180, weightKg: 81 }, [], [])
    expect(out).toContain('Name: Ben')
    expect(out).toContain('BMI: 25.0')
  })

  describe('summary detail', () => {
    const sessions = [gym(1), climb(3), gym(6), gym(20, { notes: 'a long note '.repeat(40) })]

    it('keeps the aggregate lines', () => {
      const out = buildContext(sessions, null, [], [], { detail: 'summary' })
      expect(out).toContain('LAST 30 DAYS: 4 sessions')
      expect(out).toContain('MOST RECENT SESSIONS')
    })

    it('drops the per-session detail blocks', () => {
      const out = buildContext(sessions, null, [], [], { detail: 'summary' })
      expect(out).not.toContain('LAST 14 DAYS — PRIMARY FOCUS')
      expect(out).not.toContain('PRIOR HISTORY')
      expect(out).not.toContain('notes:')
    })

    it('is substantially cheaper than the full context', () => {
      const full    = buildContext(sessions, null, [], [])
      const summary = buildContext(sessions, null, [], [], { detail: 'summary' })
      expect(summary.length).toBeLessThan(full.length * 0.75)
    })

    it('still names the terminology so the model does not confuse gym with climbing', () => {
      const out = buildContext(sessions, null, [], [], { detail: 'summary' })
      expect(out).toContain('TERMINOLOGY')
    })
  })

  it('lists active goals with progress and omits achieved ones', () => {
    const goals = [
      { type: 'weight', target: 75, startValue: 85, targetDate: daysAgo(-30), unit: 'kg' },
      { type: 'run', target: 10, startValue: 5, targetDate: daysAgo(-60), unit: 'km', achieved: true },
    ]
    const out = buildContext([gym(2)], null, goals, [{ date: daysAgo(1), weight: 80 }])
    expect(out).toContain('Bodyweight')
    expect(out).toContain('Progress: 50%')
    expect(out).not.toContain('Run:')
  })
})

describe('parseRetryAfter', () => {
  it('reads the seconds out of a Groq 429', () => {
    expect(parseRetryAfter('Please try again in 9.577499999s. Need more tokens?')).toBe(10)
  })

  it('handles whole seconds', () => {
    expect(parseRetryAfter('Please try again in 4s')).toBe(4)
  })

  it('handles minutes and seconds', () => {
    expect(parseRetryAfter('Please try again in 1m20s')).toBe(80)
  })

  it('returns null when there is no wait time to find', () => {
    expect(parseRetryAfter('Invalid API key')).toBe(null)
    expect(parseRetryAfter('')).toBe(null)
    expect(parseRetryAfter(null)).toBe(null)
  })
})

describe('coachErrorMessage', () => {
  it('translates a rate limit into a wait, not an org id', () => {
    const err = new Error('Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01k`')
    err.rateLimited = true
    err.retryAfterSec = 10
    const msg = coachErrorMessage(err, 'Geoff')
    expect(msg).toContain('Geoff')
    expect(msg).toContain('10s')
    expect(msg).not.toContain('org_01k')
  })

  it('still explains the limit when no wait time was given', () => {
    const err = new Error('Rate limit reached')
    err.rateLimited = true
    expect(coachErrorMessage(err, 'Geoff')).toContain('three requests a minute')
  })

  it('keeps the underlying message for other failures', () => {
    // Groq named the withdrawn model in its error once, and that message was
    // the only thing that explained why the coach had gone quiet.
    expect(coachErrorMessage(new Error('Invalid API Key'), 'Geoff')).toBe('Coach unavailable — Invalid API Key')
  })

  it('falls back when there is no persona or message', () => {
    expect(coachErrorMessage(null)).toBe('Coach unavailable — Something went wrong')
  })

  it('returns a self-contained sentence, not a fragment to prefix', () => {
    const err = new Error('Rate limit reached')
    err.rateLimited = true
    err.retryAfterSec = 10
    const msg = coachErrorMessage(err, 'Geoff')
    expect(msg.startsWith('Geoff')).toBe(true)
    expect(msg.split('—').length).toBeLessThanOrEqual(2)
  })
})

describe('token budgets', () => {
  it('gives the tip a far smaller reservation than the analysis', () => {
    // The pre-flight rate-limit check bills the reservation whether or not the
    // model uses it, so this gap is the whole point of the change.
    expect(TIP_MAX_TOKENS).toBeLessThan(ANALYSIS_MAX_TOKENS / 3)
  })

  it('leaves gpt-oss room to reason before it answers', () => {
    expect(TIP_MAX_TOKENS).toBeGreaterThanOrEqual(300)
  })
})

describe('getPersona', () => {
  it('resolves known keys', () => {
    expect(getPersona('geoff').name).toBe('Geoff')
  })

  it('falls back to Jonas for unknown or missing keys', () => {
    expect(getPersona('nobody').name).toBe('Jonas Ridge')
    expect(getPersona(undefined).name).toBe('Jonas Ridge')
  })
})

describe('parseAnalysis', () => {
  it('parses clean JSON', () => {
    expect(parseAnalysis('{"summary":"ok"}')).toEqual({ summary: 'ok' })
  })

  it('digs JSON out of surrounding prose', () => {
    expect(parseAnalysis('Here you go:\n{"summary":"ok"}\nCheers')).toEqual({ summary: 'ok' })
  })

  it('repairs trailing commas and unquoted keys', () => {
    expect(parseAnalysis('{summary: "ok",}')).toEqual({ summary: 'ok' })
  })

  it('returns null when there is no JSON at all', () => {
    expect(parseAnalysis('no json here')).toBe(null)
  })
})
