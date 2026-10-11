import { useState } from 'react'

/**
 * NumericStepper
 *
 * A [ − ] [ value ] [ + ] control for integer fields.
 * - Tap −/+ to nudge by `step`
 * - Tap the value to type a number directly (select-all on focus)
 * - Configurable step size — use larger steps (e.g. 15) for long-duration fields
 *
 * Typing goes through a draft: the box shows what has been typed so far and the
 * value only changes once the draft is a number inside [min, max], with the
 * draft clamped on blur. Before 2026-10-11 every keystroke outside the range
 * was thrown away, so a field with min 5 could not be typed into at all — the
 * "1" of "15" was refused and the box snapped back.
 *
 * @param {{ value: number, onChange: (n: number) => void, min?: number, max?: number, step?: number }} props
 */
export default function NumericStepper({ value, onChange, min = 1, max = 999, step = 1 }) {
  var [draft, setDraft] = useState(null)
  var isDecimal = step % 1 !== 0

  function parse(text) {
    var n = isDecimal ? parseFloat(text) : parseInt(text, 10)
    return isNaN(n) ? null : n
  }

  function dec() {
    onChange(Math.max(min, value - step))
  }

  function inc() {
    onChange(Math.min(max, value + step))
  }

  function handleChange(e) {
    var text = e.target.value
    setDraft(text)
    var n = parse(text)
    if (n !== null && n >= min && n <= max) onChange(n)
  }

  function handleBlur() {
    var n = draft === null ? null : parse(draft)
    if (n !== null) onChange(Math.min(max, Math.max(min, n)))
    setDraft(null)
  }

  return (
    <div className="flex items-center rounded-lg border border-[#e5e7ef] overflow-hidden bg-white">
      <button
        type="button"
        onClick={dec}
        className="shrink-0 w-9 py-2 bg-[#f8f9fc] text-[#7a8299] hover:bg-[#eef1ff] hover:text-[#4f7ef8] font-bold text-base leading-none transition-colors border-r border-[#e5e7ef] select-none"
      >
        −
      </button>
      <input
        type="text"
        inputMode={isDecimal ? 'decimal' : 'numeric'}
        pattern={isDecimal ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
        value={draft === null ? value : draft}
        onFocus={function (e) { e.target.select() }}
        onChange={handleChange}
        onBlur={handleBlur}
        className="flex-1 min-w-0 text-center text-sm font-semibold text-[#1a1d2e] bg-white py-2 px-1 border-none outline-none"
      />
      <button
        type="button"
        onClick={inc}
        className="shrink-0 w-9 py-2 bg-[#f8f9fc] text-[#7a8299] hover:bg-[#eef1ff] hover:text-[#4f7ef8] font-bold text-base leading-none transition-colors border-l border-[#e5e7ef] select-none"
      >
        +
      </button>
    </div>
  )
}
