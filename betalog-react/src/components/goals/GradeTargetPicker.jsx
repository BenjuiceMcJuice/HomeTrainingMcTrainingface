import { barlow } from '../../lib/utils'

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
export default function GradeTargetPicker({ grades, value, onChange, rungs, ready }) {
  var byGrade = {}
  ;(rungs || []).forEach(function (r) { byGrade[r.grade] = r })

  var anyMarked = (rungs || []).some(function (r) { return r.score >= 3 })

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {grades.map(function (g) {
          var active = g === value
          var r      = byGrade[g]
          var score  = r ? r.score : 1
          var isReady = ready && g === ready

          // One-sided ramp, and only **two** bands — see the note above. Three
          // tints needed a three-entry legend to be readable, and the extra shade
          // was distinguishing "complete" from "nearly", which the chip's tooltip
          // and the pyramid below it both already say in words. 1 and 2 are
          // deliberately not coloured at all rather than coloured red.
          var style
          if (active) {
            style = { background: '#4f7ef8', borderColor: '#4f7ef8', color: '#fff' }
          } else if (score === 5) {
            style = { background: '#e8f6ee', borderColor: '#2a9d5c', color: '#1f7a46' }
          } else if (score >= 3) {
            style = { background: '#fffbeb', borderColor: '#fcd34d', color: '#b45309' }
          } else {
            style = { background: '#f4f5f9', borderColor: '#e5e7ef', color: '#7a8299' }
          }

          return (
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
          )
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
