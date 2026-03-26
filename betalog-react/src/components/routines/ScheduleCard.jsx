import { useState } from 'react'
import { X, Plus, CalendarDays } from 'lucide-react'
import useSchedule from '../../hooks/useSchedule'
import useRoutines from '../../hooks/useRoutines'
import useHangRoutines from '../../hooks/useHangRoutines'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

var DAY_KEYS   = [1, 2, 3, 4, 5, 6, 7]
var DAY_LABELS = { 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S', 7: 'S' }

export default function ScheduleCard() {
  var { entries, canAdd, addEntry, updateEntry, removeEntry } = useSchedule()
  var { routines: gymRoutines }  = useRoutines()
  var { routines: hangRoutines } = useHangRoutines()

  var allRoutines = gymRoutines.concat(hangRoutines)

  var [adding,      setAdding]      = useState(false)
  var [newRoutine,  setNewRoutine]  = useState('')
  var [newDays,     setNewDays]     = useState([])

  function toggleNewDay(d) {
    setNewDays(function (prev) {
      return prev.indexOf(d) >= 0
        ? prev.filter(function (x) { return x !== d })
        : prev.concat([d])
    })
  }

  function handleAdd() {
    if (!newRoutine || !newDays.length) return
    var r = allRoutines.find(function (r) { return r.id === newRoutine })
    if (!r) return
    addEntry(r.id, r.name, newDays.slice().sort())
    setAdding(false)
    setNewRoutine('')
    setNewDays([])
  }

  function toggleDay(entryId, currentDays, d) {
    var next = currentDays.indexOf(d) >= 0
      ? currentDays.filter(function (x) { return x !== d })
      : currentDays.concat([d]).sort()
    updateEntry(entryId, { days: next })
  }

  var usedRoutineIds = {}
  entries.forEach(function (e) { usedRoutineIds[e.routineId] = true })
  var availableRoutines = allRoutines.filter(function (r) { return !usedRoutineIds[r.id] })

  return (
    <div className="bg-white rounded-2xl mx-4 border border-[#e5e7ef] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e5e7ef]">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-[#7a8299]" />
          <p className="font-bold text-[#1a1d2e] text-xs" style={barlow}>Schedule</p>
          <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{entries.length}/3</span>
        </div>
        {canAdd && !adding && availableRoutines.length > 0 && (
          <button
            onClick={function () { setAdding(true) }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-[#8b5cf6] hover:bg-[#f5eeff] transition-colors"
            style={barlow}
          >
            <Plus size={12} />
            Add
          </button>
        )}
      </div>

      {/* Existing entries */}
      {entries.map(function (entry) {
        var isHang = hangRoutines.some(function (r) { return r.id === entry.routineId })
        var accent = isHang ? '#8b5cf6' : '#4f7ef8'
        return (
          <div key={entry.id} className="px-4 py-2 border-b border-[#f0f1f5] last:border-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-[#1a1d2e] truncate" style={barlow}>
                {entry.routineName || 'Routine'}
              </p>
              <button
                onClick={function () { removeEntry(entry.id) }}
                className="p-0.5 rounded-lg text-[#bbbcc8] hover:text-[#e11d48] hover:bg-[#fff5f5] transition-colors shrink-0"
              >
                <X size={11} />
              </button>
            </div>
            <div className="flex gap-1">
              {DAY_KEYS.map(function (d) {
                var active = entry.days.indexOf(d) >= 0
                return (
                  <button
                    key={d}
                    onClick={function () { toggleDay(entry.id, entry.days, d) }}
                    className="flex-1 py-0.5 rounded text-[10px] font-bold transition-colors"
                    style={active
                      ? { background: accent, color: '#fff', ...barlow }
                      : { background: '#f4f5f9', color: '#bbbcc8', ...barlow }
                    }
                  >
                    {DAY_LABELS[d]}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Add new entry */}
      {adding && (
        <div className="px-4 py-2.5 bg-[#f8f9fc] border-b border-[#e5e7ef]">
          <select
            value={newRoutine}
            onChange={function (e) { setNewRoutine(e.target.value) }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-xs text-[#1a1d2e] bg-white focus:outline-none focus:border-[#8b5cf6] appearance-none transition-colors mb-2"
            style={newRoutine ? {} : { color: '#bbbcc8' }}
          >
            <option value="" disabled>Pick a routine…</option>
            {availableRoutines.map(function (r) {
              var isHang = r.type === 'hangboard'
              return <option key={r.id} value={r.id}>{r.name}{isHang ? ' (hang)' : ''}</option>
            })}
          </select>

          <div className="flex gap-1 mb-2">
            {DAY_KEYS.map(function (d) {
              var active = newDays.indexOf(d) >= 0
              return (
                <button
                  key={d}
                  onClick={function () { toggleNewDay(d) }}
                  className="flex-1 py-0.5 rounded text-[10px] font-bold transition-colors"
                  style={active
                    ? { background: '#8b5cf6', color: '#fff', ...barlow }
                    : { background: '#f4f5f9', color: '#bbbcc8', ...barlow }
                  }
                >
                  {DAY_LABELS[d]}
                </button>
              )
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newRoutine || !newDays.length}
              className="flex-1 py-1.5 rounded-lg text-white text-xs font-bold transition-colors"
              style={{ background: newRoutine && newDays.length ? '#8b5cf6' : '#bbbcc8', ...barlow }}
            >
              Add
            </button>
            <button
              onClick={function () { setAdding(false); setNewRoutine(''); setNewDays([]) }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#7a8299] hover:bg-[#f0f1f5] transition-colors"
              style={barlow}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !adding && (
        <div className="px-4 py-4 text-center">
          <p className="text-[11px] text-[#7a8299]">No routines scheduled</p>
        </div>
      )}
    </div>
  )
}
