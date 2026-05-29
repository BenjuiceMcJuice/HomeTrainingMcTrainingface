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
  beer_cider: { volumeMl: 568, abv: '4.5' },
  wine:       { volumeMl: 175, abv: '13.0' },
  spirit:     { volumeMl: 25,  abv: '40.0' },
  other:      { volumeMl: 330, abv: '5.0'  },
}

var accent = '#2a9d5c'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function calcUnits(volumeMl, abv, quantity) {
  var v = parseFloat(volumeMl) || 0
  var a = parseFloat(abv) || 0
  return Math.round((v * a * quantity) / 1000 * 10) / 10
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
 * Bottom sheet for logging or editing an alcohol drink entry.
 * Pass `initialEntry` to open in edit mode.
 *
 * @param {{ open: boolean, onClose: () => void, onSaved: () => void, initialEntry?: object }} props
 */
export default function DrinkLogSheet({ open, onClose, onSaved, onDelete, initialEntry }) {
  var { addEntry, editEntry } = useDrinkLog()

  var [drinkType, setDrinkType] = useState('beer_cider')
  var [label,     setLabel]     = useState('')
  var [volumeStr, setVolumeStr] = useState('568')
  var [abvStr,    setAbvStr]    = useState('4.5')
  var [quantity,  setQuantity]  = useState(1)
  var [note,      setNote]      = useState('')
  var [date,           setDate]           = useState(todayISO)
  var [confirmDelete,  setConfirmDelete]  = useState(false)

  var isEdit = !!initialEntry

  useEffect(function () {
    if (!open) return
    setConfirmDelete(false)
    if (initialEntry) {
      setDrinkType(initialEntry.type || 'beer_cider')
      setLabel(initialEntry.label || '')
      setVolumeStr(String(initialEntry.volumeMl || 568))
      setAbvStr(String(initialEntry.abv || 4.5))
      setQuantity(initialEntry.quantity || 1)
      setNote(initialEntry.note || '')
      setDate(initialEntry.date || todayISO())
    } else {
      setDrinkType('beer_cider')
      setLabel('')
      setVolumeStr(String(DEFAULTS.beer_cider.volumeMl))
      setAbvStr(DEFAULTS.beer_cider.abv)
      setQuantity(1)
      setNote('')
      setDate(todayISO())
    }
  }, [open])

  function handleTypeChange(key) {
    setDrinkType(key)
    setVolumeStr(String(DEFAULTS[key].volumeMl))
    setAbvStr(DEFAULTS[key].abv)
    setLabel('')
  }

  function handleSave() {
    var vol = parseInt(volumeStr, 10) || 0
    var abv = parseFloat(abvStr) || 0
    if (vol <= 0 || abv <= 0) return

    if (isEdit) {
      editEntry(initialEntry.id, {
        date:     date,
        type:     drinkType,
        label:    label.trim() || null,
        volumeMl: vol,
        abv:      abv,
        quantity: quantity,
        note:     note.trim() || null,
      })
    } else {
      addEntry(
        date,
        drinkType,
        label.trim() || null,
        vol,
        abv,
        quantity,
        note.trim() || null,
      )
    }
    onSaved()
    onClose()
  }

  function nudgeQuantity(delta) {
    setQuantity(function (prev) { return Math.max(1, prev + delta) })
  }

  if (!open) return null

  var vol    = parseInt(volumeStr, 10) || 0
  var abv    = parseFloat(abvStr) || 0
  var units  = calcUnits(vol, abv, quantity)
  var uColor = unitsColor(units)

  var labelCls = 'text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2'
  var inputCls = 'w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] placeholder:text-[#bbbcc8] focus:outline-none transition-colors bg-white'
  var canSave  = vol > 0 && abv > 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: '100dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7ef] shrink-0">
          <p className="font-black text-[#1a1d2e]"
             style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}>
            {isEdit ? 'Edit Drink' : 'Log Drink'}
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
            {drinkType === 'other' && (
              <input
                value={label}
                onChange={function (e) { setLabel(e.target.value) }}
                placeholder="What are you drinking?"
                className={inputCls + ' mt-2'}
              />
            )}
          </div>

          {/* Quantity — compact inline row */}
          <div className="flex items-center justify-between gap-3">
            <p className={labelCls + ' mb-0'} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Drinks</p>
            <div className="flex items-center rounded-lg border border-[#e5e7ef] overflow-hidden bg-white">
              <button
                type="button"
                onClick={function () { nudgeQuantity(-1) }}
                className="w-9 py-2 bg-[#f8f9fc] text-[#7a8299] hover:bg-[#edfaf2] hover:text-[#2a9d5c] font-bold text-base leading-none transition-colors border-r border-[#e5e7ef] select-none"
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-semibold text-[#1a1d2e] py-2">
                {quantity}
              </span>
              <button
                type="button"
                onClick={function () { nudgeQuantity(1) }}
                className="w-9 py-2 bg-[#f8f9fc] text-[#7a8299] hover:bg-[#edfaf2] hover:text-[#2a9d5c] font-bold text-base leading-none transition-colors border-l border-[#e5e7ef] select-none"
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
                value={volumeStr}
                onChange={function (e) { setVolumeStr(e.target.value) }}
                min="1"
                step="10"
                inputMode="numeric"
                className={inputCls + ' text-center'}
              />
            </div>
            <div className="flex-1">
              <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>ABV %</p>
              <input
                type="number"
                value={abvStr}
                onChange={function (e) { setAbvStr(e.target.value) }}
                min="0.1"
                max="70"
                step="0.5"
                inputMode="decimal"
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
          className="shrink-0 border-t border-[#e5e7ef] bg-white px-4 pt-3 pb-4 flex gap-2"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={function () {
                if (!confirmDelete) { setConfirmDelete(true); return }
                onDelete(initialEntry.id)
                onClose()
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors shrink-0"
              style={confirmDelete
                ? { background: '#e11d48', borderColor: '#e11d48', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }
                : { borderColor: '#fee2e2', color: '#e11d48', background: '#fff5f5', fontFamily: "'Barlow Condensed', sans-serif" }
              }
            >
              <Trash2 size={14} />
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-white font-bold transition-opacity"
            style={{
              background: accent,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '15px',
              opacity: canSave ? 1 : 0.45,
            }}
          >
            {isEdit ? 'Save Changes' : 'Save Drink'}
          </button>
        </div>

      </div>
    </div>
  )
}
