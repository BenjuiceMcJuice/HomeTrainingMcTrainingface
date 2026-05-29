import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import useDrinkLog from '../../hooks/useDrinkLog'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var DRINK_TYPES = [
  { key: 'beer_cider', label: 'Beer / Cider' },
  { key: 'wine',       label: 'Wine'          },
  { key: 'spirit',     label: 'Spirit'        },
  { key: 'other',      label: 'Other'         },
]

var DEFAULTS = {
  beer_cider: { volumeMl: 568, abv: 4.5 },
  wine:       { volumeMl: 175, abv: 13.0 },
  spirit:     { volumeMl: 25,  abv: 40.0 },
  other:      { volumeMl: 330, abv: 5.0  },
}

var accent = '#2a9d5c'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function calcUnits(volumeMl, abv, quantity) {
  return Math.round((volumeMl * abv * quantity) / 1000 * 10) / 10
}

function unitsColor(units) {
  if (units <= 2)  return '#2a9d5c'
  if (units <= 6)  return '#d97706'
  return '#ef4444'
}

// ---------------------------------------------------------------------------
// DrinkLogSheet
// ---------------------------------------------------------------------------

/**
 * Bottom sheet for logging an alcohol drink entry.
 * @param {{ open: boolean, onClose: () => void, onSaved: () => void }} props
 */
export default function DrinkLogSheet({ open, onClose, onSaved }) {
  var { addEntry } = useDrinkLog()

  var [drinkType, setDrinkType] = useState('beer_cider')
  var [label,     setLabel]     = useState('')
  var [volumeMl,  setVolumeMl]  = useState(568)
  var [abv,       setAbv]       = useState(4.5)
  var [quantity,  setQuantity]  = useState(1)
  var [note,      setNote]      = useState('')
  var [date,      setDate]      = useState(todayISO)

  useEffect(function () {
    if (!open) return
    setDrinkType('beer_cider')
    setLabel('')
    setVolumeMl(DEFAULTS.beer_cider.volumeMl)
    setAbv(DEFAULTS.beer_cider.abv)
    setQuantity(1)
    setNote('')
    setDate(todayISO())
  }, [open])

  function handleTypeChange(key) {
    setDrinkType(key)
    setVolumeMl(DEFAULTS[key].volumeMl)
    setAbv(DEFAULTS[key].abv)
    setLabel('')
  }

  function handleSave() {
    addEntry(
      date,
      drinkType,
      drinkType === 'other' ? (label.trim() || null) : (label.trim() || null),
      volumeMl,
      abv,
      quantity,
      note.trim() || null,
    )
    onSaved()
    onClose()
  }

  function handleVolumeChange(e) {
    var v = parseInt(e.target.value, 10)
    if (!isNaN(v) && v > 0) setVolumeMl(v)
  }

  function handleAbvChange(e) {
    var v = parseFloat(e.target.value)
    if (!isNaN(v) && v > 0) setAbv(Math.round(v * 10) / 10)
  }

  function nudgeQuantity(delta) {
    setQuantity(function (prev) { return Math.max(0.5, Math.round((prev + delta) * 2) / 2) })
  }

  if (!open) return null

  var units       = calcUnits(volumeMl, abv, quantity)
  var uColor      = unitsColor(units)
  var labelCls    = 'text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2'
  var inputCls    = 'w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none transition-colors bg-white'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: '100dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7ef] shrink-0">
          <p className="font-black text-[#1a1d2e]"
             style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}>
            Log Drink
          </p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4 flex flex-col gap-4">

          {/* Type chips */}
          <div>
            <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Type</p>
            <div className="flex flex-wrap gap-2">
              {DRINK_TYPES.map(function (dt) {
                var active = drinkType === dt.key
                return (
                  <button
                    key={dt.key}
                    type="button"
                    onClick={function () { handleTypeChange(dt.key) }}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                    style={active
                      ? { background: accent, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }
                      : { background: '#f4f5f9', color: '#7a8299', fontFamily: "'Barlow Condensed', sans-serif" }
                    }
                  >
                    {dt.label}
                  </button>
                )
              })}
            </div>
            {/* Optional label — always show for 'other', optional toggle for others */}
            {drinkType === 'other' && (
              <input
                value={label}
                onChange={function (e) { setLabel(e.target.value) }}
                placeholder="What are you drinking?"
                className={inputCls + ' mt-2'}
              />
            )}
          </div>

          {/* Quantity */}
          <div>
            <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Drinks</p>
            <div className="flex items-center rounded-lg border border-[#e5e7ef] overflow-hidden bg-white">
              <button
                type="button"
                onClick={function () { nudgeQuantity(-0.5) }}
                className="shrink-0 w-9 py-2 bg-[#f8f9fc] text-[#7a8299] hover:bg-[#edfaf2] hover:text-[#2a9d5c] font-bold text-base leading-none transition-colors border-r border-[#e5e7ef] select-none"
              >
                −
              </button>
              <span className="flex-1 text-center text-sm font-semibold text-[#1a1d2e] py-2">
                {quantity % 1 === 0 ? quantity : quantity.toFixed(1)}
              </span>
              <button
                type="button"
                onClick={function () { nudgeQuantity(0.5) }}
                className="shrink-0 w-9 py-2 bg-[#f8f9fc] text-[#7a8299] hover:bg-[#edfaf2] hover:text-[#2a9d5c] font-bold text-base leading-none transition-colors border-l border-[#e5e7ef] select-none"
              >
                +
              </button>
            </div>
          </div>

          {/* Volume + ABV */}
          <div className="flex gap-3">
            <div className="flex-1">
              <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>ml per drink</p>
              <input
                type="number"
                value={volumeMl}
                onChange={handleVolumeChange}
                min="1"
                step="10"
                className={inputCls + ' text-center'}
              />
            </div>
            <div className="flex-1">
              <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>ABV %</p>
              <input
                type="number"
                value={abv}
                onChange={handleAbvChange}
                min="0.5"
                max="70"
                step="0.5"
                className={inputCls + ' text-center'}
              />
            </div>
          </div>

          {/* Units preview */}
          <div
            className="rounded-xl px-4 py-2.5 flex items-center justify-between"
            style={{ background: uColor + '18', border: '1px solid ' + uColor + '40' }}
          >
            <span className="text-xs text-[#7a8299]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              UK units
            </span>
            <span className="text-lg font-black" style={{ color: uColor, fontFamily: "'Barlow Condensed', sans-serif" }}>
              {units}
            </span>
          </div>

          {/* Note + Date */}
          <div className="flex gap-2">
            <input
              value={note}
              onChange={function (e) { setNote(e.target.value) }}
              placeholder="Note… (optional)"
              className={inputCls + ' flex-1'}
            />
            <input
              type="date"
              value={date}
              onChange={function (e) { setDate(e.target.value) }}
              className="shrink-0 px-2 py-2 rounded-xl border border-[#e5e7ef] text-xs text-[#7a8299] focus:outline-none transition-colors bg-white"
            />
          </div>

        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t border-[#e5e7ef] bg-white px-4 pt-3 pb-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-2.5 rounded-xl text-white font-bold transition-opacity"
            style={{ background: accent, fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px' }}
          >
            Save Drink
          </button>
        </div>

      </div>
    </div>
  )
}
