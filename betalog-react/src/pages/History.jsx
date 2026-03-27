import { useState } from 'react'
import useSessions from '../hooks/useSessions'
import useWeightLog from '../hooks/useWeightLog'
import SessionCard from '../components/log/SessionCard'
import SessionDetailSheet from '../components/log/SessionDetailSheet'
import { Scale, Pencil, Trash2, Check, X } from 'lucide-react'
import NumericStepper from '../components/ui/NumericStepper'

// ---------------------------------------------------------------------------
// Date grouping helpers
// ---------------------------------------------------------------------------

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr() {
  var d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function groupLabel(dateStr) {
  var today     = todayStr()
  var yesterday = yesterdayStr()
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  } catch (e) {
    return dateStr
  }
}

/**
 * Group items by date. Each item must have a .date string.
 * Items are tagged with ._kind = 'session' | 'weight'.
 * Returns [ { label, date, items[] }, ... ] newest-first.
 */
function groupByDate(sessions, weightEntries) {
  var all = []
  sessions.forEach(function (s) {
    all.push(Object.assign({}, s, { _kind: 'session', _sortKey: s.createdAt || s.date }))
  })
  weightEntries.forEach(function (w) {
    all.push(Object.assign({}, w, { _kind: 'weight', _sortKey: w.date }))
  })

  // Sort newest-first by date, then by createdAt/sortKey as tiebreaker
  all.sort(function (a, b) {
    if (b.date !== a.date) return b.date > a.date ? 1 : -1
    return b._sortKey > a._sortKey ? 1 : -1
  })

  var groups = []
  var map    = {}
  all.forEach(function (item) {
    var key = item.date
    if (!map[key]) {
      var group = { label: groupLabel(key), date: key, items: [] }
      groups.push(group)
      map[key] = group
    }
    map[key].items.push(item)
  })
  return groups
}

// ---------------------------------------------------------------------------
// WeightRow — small inline weight entry with edit
// ---------------------------------------------------------------------------

function WeightRow({ entry, onUpdate, onDelete }) {
  var [editing,   setEditing]   = useState(false)
  var [editVal,   setEditVal]   = useState(entry.weight)
  var [editDate,  setEditDate]  = useState(entry.date)
  var [confirm,   setConfirm]   = useState(false)

  function startEdit() {
    setEditVal(entry.weight)
    setEditDate(entry.date)
    setEditing(true)
    setConfirm(false)
  }

  function saveEdit() {
    onUpdate(entry.id, { weight: editVal, date: editDate })
    setEditing(false)
  }

  function handleDelete() {
    if (!confirm) { setConfirm(true); return }
    onDelete(entry.id)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#f8f9fc]">
        <Scale size={12} className="text-[#bbbcc8] shrink-0" />
        <input
          type="date"
          value={editDate}
          onChange={function (e) { setEditDate(e.target.value) }}
          className="text-[11px] text-[#7a8299] border-0 bg-transparent focus:outline-none w-24 shrink-0"
        />
        <div className="w-28 shrink-0">
          <NumericStepper value={editVal} min={30} max={200} step={0.5} onChange={setEditVal} />
        </div>
        <span className="text-[11px] text-[#bbbcc8] shrink-0">kg</span>
        <button
          onClick={saveEdit}
          className="p-1 rounded-lg text-[#2a9d5c] hover:bg-[#edfaf2] transition-colors shrink-0 ml-auto"
        >
          <Check size={14} />
        </button>
        <button
          onClick={function () { setEditing(false) }}
          className="p-1 rounded-lg text-[#7a8299] hover:bg-[#f0f1f5] transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Scale size={12} className="text-[#bbbcc8] shrink-0" />
      <span className="text-[11px] text-[#7a8299] flex-1">Weigh-in</span>
      <span className="text-[12px] font-bold text-[#1a1d2e]" style={barlow}>{entry.weight} kg</span>
      <button
        onClick={startEdit}
        className="p-1 rounded-lg text-[#bbbcc8] hover:text-[#4f7ef8] hover:bg-[#eef1ff] transition-colors shrink-0"
      >
        <Pencil size={11} />
      </button>
      <button
        onClick={handleDelete}
        className="p-1 rounded-lg transition-colors shrink-0"
        style={confirm
          ? { color: '#fff', background: '#e11d48' }
          : { color: '#bbbcc8' }
        }
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History page
// ---------------------------------------------------------------------------

export default function History() {
  var { sessions } = useSessions()
  var { entries: weightEntries, updateEntry, deleteEntry } = useWeightLog()
  var [selected, setSelected] = useState(null)

  var groups   = groupByDate(sessions, weightEntries)
  var hasItems = sessions.length > 0 || weightEntries.length > 0

  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-8">
      {/* Empty state */}
      {!hasItems && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-2 pt-16">
          <p className="text-[#1a1d2e] font-semibold text-base">No sessions yet</p>
          <p className="text-sm text-[#7a8299]">Log your first session from the Log tab.</p>
        </div>
      )}

      {/* Grouped feed */}
      {groups.map(function (group) {
        var sessionItems = group.items.filter(function (i) { return i._kind === 'session' })
        var weightItems  = group.items.filter(function (i) { return i._kind === 'weight' })

        return (
          <div key={group.date} className="mb-4">
            {/* Date heading */}
            <div className="px-4 pb-1.5">
              <p
                className="text-xs font-bold text-[#7a8299] uppercase tracking-widest"
                style={barlow}
              >
                {group.label}
              </p>
            </div>

            {/* Session cards + weight rows in one card */}
            <div className="bg-white rounded-2xl mx-4 overflow-hidden border border-[#e5e7ef]">
              {sessionItems.map(function (session) {
                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={function () { setSelected(session) }}
                  />
                )
              })}
              {weightItems.map(function (w) {
                return (
                  <WeightRow
                    key={w.id}
                    entry={w}
                    onUpdate={updateEntry}
                    onDelete={deleteEntry}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Detail sheet */}
      <SessionDetailSheet
        session={selected}
        open={selected !== null}
        onClose={function () { setSelected(null) }}
      />
    </div>
  )
}
