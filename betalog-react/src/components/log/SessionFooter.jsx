/**
 * The parts every logger's footer shares, so they read the same on every
 * screen (review of 2026-10-11): the session feel in one form and under one
 * name, the date on one labelled row, and one wording for the error.
 *
 * Before this the 1–5 row was drawn five times in two shapes (number + word in
 * the climb and hang loggers, word only in the gym and cardio footers), named
 * "Session feel", "effort" and "difficulty" by turns, with three different
 * sentences when it was missing; and the date sat somewhere different in every
 * logger. The save button's words are the callers' — `saveLabel` keeps them to
 * two: *Save* for something new, *Save changes* for an edit. The live climb
 * logger's *Done* is a different act (the climbs are already saved) and stays.
 * The labels, colours and the error line live in `lib/sessionFeel.js`.
 */

import { FEEL_LABELS, FEEL_FILL } from '../../lib/sessionFeel'

var condensed = { fontFamily: "'Barlow Condensed', sans-serif" }

/**
 * The 1–5 session feel, labelled, number over word.
 * @param {{ value: number|null, onChange: (n: number) => void }} props
 */
export function SessionFeel({ value, onChange }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-2" style={condensed}>
        Session feel
      </p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(function (n) {
          var active = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={function () { onChange(n) }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition-colors"
              style={active
                ? { background: FEEL_FILL[n], borderColor: FEEL_FILL[n], color: '#fff' }
                : { background: '#f8f9fc', borderColor: '#e5e7ef', color: '#7a8299' }
              }
            >
              <span className="text-sm font-bold leading-none" style={condensed}>{n}</span>
              <span className="text-[9px] font-semibold leading-tight text-center">{FEEL_LABELS[n - 1]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The date, labelled, on its own row.
 * @param {{ value: string, onChange: (iso: string) => void, label?: string }} props
 */
export function SessionDateRow({ value, onChange, label }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-wide" style={condensed}>
        {label || 'Session date'}
      </span>
      <input
        type="date"
        value={value}
        onChange={function (e) { onChange(e.target.value) }}
        className="text-xs text-[#7a8299] border-0 bg-transparent focus:outline-none focus:text-[#1a1d2e] transition-colors"
      />
    </div>
  )
}
