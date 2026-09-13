import { barlow } from '../../lib/utils'
import { gradeLevel, LEVEL_COLOR } from '../../lib/stats'

/**
 * The grade ladder as a picker, with each rung carrying what the log says about
 * the base for it.
 *
 * Before this, every grade from V0 to V17 was an identical grey chip, so the only
 * way to find out that your base is complete for V5 and empty for V6 was to tap
 * each one and read the pyramid that appeared underneath. The reading already
 * existed; it just wasn't on the thing you were choosing with.
 *
 * ## Why it only ever marks grades *up*
 *
 * The obvious move is to tint every chip by its readiness score, using the app's
 * `SCORE_COLOR`. That paints twelve of eighteen chips red, because almost every
 * grade on the ladder is above anyone's base — and a wall of red on a picker
 * reads as a refusal to let you choose, which is both wrong and the opposite of
 * what the data-honesty spec asks for. **An empty base is not evidence you cannot
 * climb the grade; it is the log having nothing to say.**
 *
 * So the ramp is one-sided. Grades the log supports are marked; grades it says
 * nothing about stay plain and stay fully selectable. Nothing here gates Save.
 *
 * @param {{
 *   grades: string[],
 *   value: string,
 *   onChange: (grade: string) => void,
 *   rungs?: {grade: string, score: number, label: string, complete: boolean, sentTarget: boolean}[],
 *   ready?: string|null,
 * }} props
 */
export default function GradeTargetPicker({ grades, value, onChange, rungs, ready, system }) {
  var byGrade = {}
  ;(rungs || []).forEach(function (r) { byGrade[r.grade] = r })

  var anyMarked = (rungs || []).some(function (r) { return r.score >= 3 })
  var sys = system || (grades && grades[0] && String(grades[0]).charAt(0) === 'V' ? 'v' : 'french')

  // The ladder in its level bands (2026-09-13, Ben): a caption where the band
  // changes, and a plain chip's text in the band's colour, so "6c is the first
  // Advanced grade" is read off the picker rather than looked up. The green and
  // amber fills keep saying what the *log* supports; the level is a convention
  // about the grade itself, and the two are kept on different parts of the chip
  // so neither is mistaken for the other.
  var lastLevel = null

  return (
    <div>
      <div className="flex flex-wrap gap-1 items-center">
        {grades.map(function (g) {
          var active = g === value
          var r      = byGrade[g]
          var score  = r ? r.score : 1
          var isReady = ready && g === ready
          var level  = gradeLevel(g, sys)
          var lc     = level ? (LEVEL_COLOR[level] || null) : null
          var caption = null
          if (level && level !== lastLevel) {
            caption = (
              <span
                key={'cap-' + level}
                className="basis-full text-[8px] font-bold uppercase tracking-widest mt-1 first:mt-0"
                style={{ ...barlow, color: lc ? lc.color : '#bbbcc8' }}
              >
                {level}
              </span>
            )
            lastLevel = level
          }

          // One-sided ramp, and only **two** bands — see the note above. Three
          // tints needed a three-entry legend to be readable, and the extra shade
          // was distinguishing "complete" from "nearly", which the chip's tooltip
          // and the pyramid below it both already say in words. 1 and 2 are
          // deliberately not coloured at all rather than coloured red — their
          // text takes the level colour instead.
          var style
          if (active) {
            style = { background: '#4f7ef8', borderColor: '#4f7ef8', color: '#fff' }
          } else if (score === 5) {
            style = { background: '#e8f6ee', borderColor: '#2a9d5c', color: '#1f7a46' }
          } else if (score >= 3) {
            style = { background: '#fffbeb', borderColor: '#fcd34d', color: '#b45309' }
          } else {
            style = { background: '#f4f5f9', borderColor: '#e5e7ef', color: lc ? lc.color : '#7a8299' }
          }

          return [caption, (
            <button
              key={g}
              onClick={function () { onChange(g) }}
              title={r ? r.label : undefined}
              className="px-2.5 py-0.5 rounded-lg border text-xs font-bold transition-colors relative"
              style={{ ...style, ...barlow }}
            >
              {g}
              {/* The hardest grade whose base is complete. A ring rather than a
                  word, because the chips are too small for a word and the legend
                  below says what it means. */}
              {isReady && !active && (
                <i
                  className="absolute rounded-full"
                  style={{
                    top: '-2px', right: '-2px', width: '5px', height: '5px',
                    background: '#2a9d5c', border: '1px solid #fff',
                  }}
                />
              )}
            </button>
          )]
        })}
      </div>

      {/* Only shown when there is something to explain. On a thin log every chip
          is plain, and a legend for markings nobody can see is noise. */}
      {anyMarked && (
        <div className="flex items-center gap-2.5 flex-wrap mt-1.5">
          <Key color="#2a9d5c" bg="#e8f6ee" label="Base complete" />
          <Key color="#fcd34d" bg="#fffbeb" label="Base part-built" />
          {ready && (
            <span className="flex items-center gap-1">
              <i className="rounded-full" style={{ width: '5px', height: '5px', background: '#2a9d5c' }} />
              <span className="text-[9px] text-[#7a8299]" style={barlow}>
                Hardest base you have
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Key({ color, bg, label }) {
  return (
    <span className="flex items-center gap-1">
      <i className="rounded-sm" style={{ width: '8px', height: '8px', background: bg, border: '1px solid ' + color }} />
      <span className="text-[9px] text-[#7a8299]" style={barlow}>{label}</span>
    </span>
  )
}
