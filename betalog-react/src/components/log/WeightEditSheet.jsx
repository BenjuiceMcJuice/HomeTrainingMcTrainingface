import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import useWeightLog from '../../hooks/useWeightLog'
import NumericStepper from '../ui/NumericStepper'

var accent = '#4f7ef8'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Bottom sheet for editing a weight log entry.
 * @param {{ open: boolean, onClose: () => void, onSaved: () => void, onDelete: (id: string) => void, initialEntry: object }} props
 */
export default function WeightEditSheet({ open, onClose, onSaved, onDelete, initialEntry }) {
  var { updateEntry } = useWeightLog()

  var [editVal,       setEditVal]       = useState(70)
  var [editDate,      setEditDate]      = useState(todayISO())
  var [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(function () {
    if (!open || !initialEntry) return
    setEditVal(initialEntry.weight)
    setEditDate(initialEntry.date)
    setConfirmDelete(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: form resets on open only

  function handleSave() {
    updateEntry(initialEntry.id, { weight: editVal, date: editDate })
    onSaved()
    onClose()
  }

  if (!open || !initialEntry) return null

  var labelCls = 'text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2'

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7ef] shrink-0">
          <p
            className="font-black text-[#1a1d2e]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}
          >
            Edit Weigh-in
          </p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 flex flex-col gap-4">

          {/* Weight stepper */}
          <div>
            <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Weight</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <NumericStepper value={editVal} min={30} max={200} step={0.5} onChange={setEditVal} />
              </div>
              <span
                className="text-sm font-semibold text-[#7a8299] shrink-0"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                kg
              </span>
            </div>
          </div>

          {/* Date */}
          <div>
            <p className={labelCls} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Date</p>
            <input
              type="date"
              value={editDate}
              onChange={function (e) { setEditDate(e.target.value) }}
              className="w-full px-3 py-2 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] focus:outline-none transition-colors bg-white"
            />
          </div>

        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t border-[#e5e7ef] bg-white px-4 pt-3 pb-4 flex gap-2"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {onDelete && (
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
            className="flex-1 py-2.5 rounded-xl text-white font-bold"
            style={{
              background: accent,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '15px',
            }}
          >
            Save Changes
          </button>
        </div>

      </div>
    </div>
  )
}
