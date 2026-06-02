import { useState } from 'react'
import useSessions from '../hooks/useSessions'
import useWeightLog from '../hooks/useWeightLog'
import useDrinkLog from '../hooks/useDrinkLog'
import useProfile from '../hooks/useProfile'
import SessionCard from '../components/log/SessionCard'
import SessionDetailSheet from '../components/log/SessionDetailSheet'
import DrinkLogSheet from '../components/log/DrinkLogSheet'
import WeightEditSheet from '../components/log/WeightEditSheet'
import { Scale, Droplets } from 'lucide-react'
import { getMETRange, estimateCalories, getPaceMET, deriveSessionMetres } from '../lib/stats'

// ---------------------------------------------------------------------------
// Date grouping helpers
// ---------------------------------------------------------------------------

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

// Compute cardio kcal dynamically when not stored on session
function enrichCardioKcal(session, weightEntries, profileWeight) {
  if (session.type !== 'cardio') return session
  if (session.cardioKcalLow && session.cardioKcalHigh) return session
  if (!session.cardioDurationMins) return session
  var metres = deriveSessionMetres(session)
  var metRange = (metres && session.cardioDurationMins)
    ? getPaceMET(session.cardioActivity, session.cardioStrokeType || null, metres, session.cardioDurationMins)
    : (session.difficulty ? getMETRange(session.cardioActivity, session.cardioStrokeType || null, session.difficulty) : null)
  if (!metRange) return session
  var weightKg = null
  var sorted = (weightEntries || []).slice().sort(function (a, b) {
    return b.date > a.date ? 1 : -1
  })
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].date <= session.date) { weightKg = sorted[i].weight; break }
  }
  if (!weightKg && profileWeight) weightKg = profileWeight
  if (!weightKg) return session
  var kcal = estimateCalories(metRange, weightKg, session.cardioDurationMins)
  return Object.assign({}, session, { cardioKcalLow: kcal.low, cardioKcalHigh: kcal.high })
}

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
  } catch {
    return dateStr
  }
}

var DRINK_TYPE_LABELS = { beer_cider: 'Beer/Cider', wine: 'Wine', spirit: 'Spirit', other: 'Other' }

/**
 * Group items by date. Each item must have a .date string.
 * Items are tagged with ._kind = 'session' | 'weight' | 'drink'.
 * Returns [ { label, date, items[] }, ... ] newest-first.
 */
function groupByDate(sessions, weightEntries, drinkEntries) {
  var all = []
  sessions.forEach(function (s) {
    all.push(Object.assign({}, s, { _kind: 'session', _sortKey: s.createdAt || s.date }))
  })
  weightEntries.forEach(function (w) {
    all.push(Object.assign({}, w, { _kind: 'weight', _sortKey: w.date }))
  })
  ;(drinkEntries || []).forEach(function (d) {
    all.push(Object.assign({}, d, { _kind: 'drink', _sortKey: d.createdAt || d.date }))
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

function WeightRow({ entry, onEdit }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[#f8f9fc] transition-colors border-t border-[#f0f1f5]"
      onClick={function () { onEdit(entry) }}
    >
      <Scale size={12} className="text-[#bbbcc8] shrink-0" />
      <span className="text-[11px] text-[#7a8299] flex-1">Weigh-in</span>
      <span className="text-[12px] font-bold text-[#1a1d2e]" style={barlow}>{entry.weight} kg</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DrinkRow — small inline drink entry with edit + delete
// ---------------------------------------------------------------------------

function DrinkRow({ entry, onEdit }) {
  var uColor = entry.units <= 2 ? '#2a9d5c' : entry.units <= 6 ? '#d97706' : '#ef4444'
  var label  = DRINK_TYPE_LABELS[entry.type] || entry.type
  if (entry.label) label += ' · ' + entry.label

  return (
    <div
      className="flex flex-col px-3 py-1.5 cursor-pointer hover:bg-[#f8f9fc] transition-colors border-t border-[#f0f1f5]"
      onClick={function () { onEdit(entry) }}
    >
      <div className="flex items-center gap-2">
        <Droplets size={12} style={{ color: '#2a9d5c' }} className="shrink-0" />
        <span className="text-[11px] text-[#7a8299] flex-1">
          {entry.quantity !== 1 ? entry.quantity + '× ' : ''}{label}
        </span>
        <span className="text-[12px] font-bold" style={{ ...barlow, color: uColor }}>{entry.units} units</span>
        {entry.kcal > 0 && (
          <span className="text-[10px] text-[#bbbcc8]" style={barlow}>~{entry.kcal} kcal</span>
        )}
      </div>
      {entry.note && (
        <p className="text-[10px] text-[#bbbcc8] truncate italic mt-0.5 ml-5">{entry.note}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// History page
// ---------------------------------------------------------------------------

export default function History() {
  var { sessions } = useSessions()
  var { entries: weightEntries, deleteEntry } = useWeightLog()
  var { entries: drinkEntries, deleteEntry: deleteDrink } = useDrinkLog()
  var { profile } = useProfile()
  var profileWeight = profile && profile.weightKg ? profile.weightKg : null
  var [selected,       setSelected]       = useState(null)
  var [editingWeight,  setEditingWeight]  = useState(null)
  var [editingDrink,   setEditingDrink]   = useState(null)

  var groups   = groupByDate(sessions, weightEntries, drinkEntries)
  var hasItems = sessions.length > 0 || weightEntries.length > 0 || drinkEntries.length > 0

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
        var drinkItems   = group.items.filter(function (i) { return i._kind === 'drink' })

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
                var enriched = enrichCardioKcal(session, weightEntries, profileWeight)
                return (
                  <SessionCard
                    key={session.id}
                    session={enriched}
                    onClick={function () { setSelected(session) }}
                  />
                )
              })}
              {weightItems.map(function (w) {
                return (
                  <WeightRow
                    key={w.id}
                    entry={w}
                    onEdit={setEditingWeight}
                  />
                )
              })}
              {drinkItems.map(function (d) {
                return (
                  <DrinkRow
                    key={d.id}
                    entry={d}
                    onEdit={setEditingDrink}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Weight edit sheet */}
      <WeightEditSheet
        open={editingWeight !== null}
        initialEntry={editingWeight}
        onClose={function () { setEditingWeight(null) }}
        onSaved={function () { setEditingWeight(null) }}
        onDelete={deleteEntry}
      />

      {/* Detail sheet */}
      <SessionDetailSheet
        session={selected}
        open={selected !== null}
        onClose={function () { setSelected(null) }}
      />

      {/* Drink edit sheet */}
      <DrinkLogSheet
        open={editingDrink !== null}
        initialEntry={editingDrink}
        onClose={function () { setEditingDrink(null) }}
        onSaved={function () { setEditingDrink(null) }}
        onDelete={deleteDrink}
      />
    </div>
  )
}
