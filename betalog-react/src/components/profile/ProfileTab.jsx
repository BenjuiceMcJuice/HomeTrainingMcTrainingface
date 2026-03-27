import { useState, useEffect } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import useProfile from '../../hooks/useProfile'
import useWeightLog from '../../hooks/useWeightLog'
import ClimbingStats from './ClimbingStats'

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

var barlow   = { fontFamily: "'Barlow Condensed', sans-serif" }
var inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors'

// ---------------------------------------------------------------------------
// BMI + trend helpers
// ---------------------------------------------------------------------------

var BMI_CATS = [
  { max: 18.5, label: 'Underweight', color: '#4f7ef8', bg: '#eef1ff' },
  { max: 25,   label: 'Healthy',     color: '#2a9d5c', bg: '#edfaf2' },
  { max: 30,   label: 'Overweight',  color: '#d97706', bg: '#fffbeb' },
  { max: Infinity, label: 'Obese',   color: '#ef4444', bg: '#fef2f2' },
]

function bmiCategory(bmi) {
  for (var i = 0; i < BMI_CATS.length; i++) {
    if (bmi < BMI_CATS[i].max) return BMI_CATS[i]
  }
  return BMI_CATS[BMI_CATS.length - 1]
}

function daysAgo(n) {
  var d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function calcWeightTrend(entries) {
  if (!entries.length) return null
  var current = entries[0].weight
  var cutoff  = daysAgo(30)
  var sum = 0, count = 0
  entries.forEach(function (e) {
    if (e.date >= cutoff) { sum += e.weight; count++ }
  })
  if (count < 2) return null
  var avg  = sum / count
  var diff = current - avg
  return { current: current, avg: avg, diff: diff }
}

// ---------------------------------------------------------------------------
// ProfileTab
// ---------------------------------------------------------------------------

export default function ProfileTab() {
  var { profile, saveProfile } = useProfile()
  var { entries, addEntry, updateEntry } = useWeightLog()

  var MAX_WIDGETS = 4

  var WIDGET_OPTS = [
    { key: 'trainingLoad',  label: 'Training load' },
    { key: 'boulderLevel',  label: 'Boulder level' },
    { key: 'ropeLevel',     label: 'Rope level' },
    { key: 'coachTip',      label: 'Coach tip' },
    { key: 'weight',        label: 'Weight & BMI' },
  ]

  var [weightKg, setWeightKg] = useState('')
  var [widgets,  setWidgets]  = useState({})
  var [saved,    setSaved]    = useState(false)
  var [orig,     setOrig]     = useState({ weightKg: '', widgets: {} })

  var today      = new Date().toISOString().slice(0, 10)
  var lastEntry  = entries.length > 0 ? entries[0] : null
  var todayEntry = lastEntry && lastEntry.date === today ? lastEntry : null
  var profileName = profile ? (profile.name || '') : ''
  var h = profile && profile.heightCm ? profile.heightCm : 0

  useEffect(function () {
    var w = ''
    var dw = (profile && profile.dashWidgets) || {}
    // Default all on if not set
    var wg = {}
    WIDGET_OPTS.forEach(function (opt) { wg[opt.key] = dw[opt.key] !== false })
    if (lastEntry) {
      w = String(lastEntry.weight)
    } else if (profile && profile.weightKg != null) {
      w = String(profile.weightKg)
    }
    setWeightKg(w); setWidgets(wg)
    setOrig({ weightKg: w, widgets: JSON.parse(JSON.stringify(wg)) })
    setSaved(false)
  }, [profile, lastEntry])

  var widgetsChanged = JSON.stringify(widgets) !== JSON.stringify(orig.widgets)
  var hasChanges = weightKg !== orig.weightKg || widgetsChanged

  var activeCount = Object.keys(widgets).filter(function (k) { return widgets[k] }).length

  function toggleWidget(key) {
    setWidgets(function (prev) {
      var next = Object.assign({}, prev)
      if (next[key]) {
        next[key] = false
      } else {
        // Check limit
        var count = Object.keys(next).filter(function (k) { return next[k] }).length
        if (count >= MAX_WIDGETS) return prev
        next[key] = true
      }
      return next
    })
  }

  function handleSave() {
    var w = weightKg ? Number(weightKg) : null
    saveProfile({ weightKg: w, dashWidgets: widgets })
    if (w != null && w > 0) {
      if (todayEntry) { updateEntry(todayEntry.id, { weight: w }) }
      else { addEntry(today, w, null) }
    }
    setOrig({ weightKg: weightKg, widgets: JSON.parse(JSON.stringify(widgets)) })
    setSaved(true)
    setTimeout(function () { setSaved(false) }, 2000)
  }

  // Derived values
  var w      = weightKg ? Number(weightKg) : 0
  var bmi    = h > 0 && w > 0 ? w / ((h / 100) * (h / 100)) : null
  var bmiCat = bmi ? bmiCategory(bmi) : null
  var trend  = calcWeightTrend(entries)

  var weightHint = ''
  if (lastEntry) {
    if (lastEntry.date === today) { weightHint = 'today' }
    else {
      try { weightHint = new Date(lastEntry.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
      catch (e) { weightHint = '' }
    }
  }

  return (
    <div className="px-4 pb-8 flex flex-col gap-3">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 pt-3 pb-3">

        {/* Name row */}
        {profileName && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-[#1a1d2e]" style={barlow}>{profileName}</span>
            {h > 0 && <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{h} cm</span>}
          </div>
        )}

        {/* Body comp widget — weight input + BMI + trend all in one block */}
        <div className="rounded-xl bg-[#f8f9fc] border border-[#e5e7ef] px-3 py-2 mb-2">
          {/* Row 1: weight input + BMI badge */}
          <div className="flex items-center gap-2">
            <input
              className="w-14 px-1.5 py-0.5 rounded-lg border border-[#e5e7ef] text-xs text-center text-[#1a1d2e] bg-white focus:outline-none focus:border-[#4f7ef8] transition-colors"
              type="number"
              inputMode="decimal"
              value={weightKg}
              onChange={function (e) { setWeightKg(e.target.value) }}
              placeholder="70"
            />
            <span className="text-[10px] text-[#bbbcc8]" style={barlow}>kg</span>
            {bmi && bmiCat && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: bmiCat.bg, color: bmiCat.color, ...barlow }}>
                BMI {bmi.toFixed(1)} · {bmiCat.label}
              </span>
            )}
            {weightHint && (
              <span className="text-[9px] text-[#bbbcc8] ml-auto" style={barlow}>{weightHint}</span>
            )}
          </div>

          {/* Row 2: trend (only if data) */}
          {trend && (
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-[#e5e7ef] text-[10px] text-[#7a8299]">
              {trend.diff > 0.2 ? (
                <ArrowUpRight size={11} style={{ color: '#ef4444' }} />
              ) : trend.diff < -0.2 ? (
                <ArrowDownRight size={11} style={{ color: '#2a9d5c' }} />
              ) : (
                <Minus size={11} style={{ color: '#7a8299' }} />
              )}
              <span>
                <span className="font-bold text-[#1a1d2e]" style={barlow}>{trend.current}</span> now · 30d avg{' '}
                <span className="font-bold" style={barlow}>{trend.avg.toFixed(1)}</span>
                <span className="font-semibold" style={{ color: trend.diff > 0.2 ? '#ef4444' : trend.diff < -0.2 ? '#2a9d5c' : '#7a8299' }}>
                  {' '}({trend.diff > 0 ? '+' : ''}{trend.diff.toFixed(1)})
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Dashboard widgets — toggle which appear */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide" style={barlow}>Dashboard widgets</p>
            <span className="text-[9px] text-[#bbbcc8]" style={barlow}>{activeCount}/{MAX_WIDGETS} max</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WIDGET_OPTS.map(function (opt) {
              var on = !!widgets[opt.key]
              var atLimit = activeCount >= MAX_WIDGETS && !on
              return (
                <button
                  key={opt.key}
                  onClick={function () { toggleWidget(opt.key) }}
                  disabled={atLimit}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors border"
                  style={on
                    ? { background: '#4f7ef8', borderColor: '#4f7ef8', color: '#fff', ...barlow }
                    : atLimit
                      ? { background: '#f4f5f9', borderColor: '#f0f1f5', color: '#bbbcc8', cursor: 'default', ...barlow }
                      : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }
                  }
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!hasChanges && !saved}
          className="w-full py-1.5 rounded-lg text-white font-bold text-xs transition-colors"
          style={{
            background: saved ? '#2a9d5c' : hasChanges ? '#4f7ef8' : '#bbbcc8',
            cursor: hasChanges || saved ? 'pointer' : 'default',
            ...barlow,
          }}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <ClimbingStats />
    </div>
  )
}
