/**
 * NumericStepper
 *
 * A [ − ] [ value ] [ + ] control for integer fields.
 * - Tap −/+ to nudge by `step`
 * - Tap the value to type a number directly (select-all on focus)
 * - Configurable step size — use larger steps (e.g. 15) for long-duration fields
 *
 * @param {{ value: number, onChange: (n: number) => void, min?: number, max?: number, step?: number }} props
 */
export default function NumericStepper({ value, onChange, min = 1, max = 999, step = 1 }) {
  function dec() {
    onChange(Math.max(min, value - step))
  }

  function inc() {
    onChange(Math.min(max, value + step))
  }

  function handleChange(e) {
    var n = parseInt(e.target.value, 10)
    if (!isNaN(n) && n >= min && n <= max) onChange(n)
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
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onFocus={function (e) { e.target.select() }}
        onChange={handleChange}
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
