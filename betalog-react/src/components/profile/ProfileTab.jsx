import { useState, useEffect } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus, Scale } from 'lucide-react'
import useProfile from '../../hooks/useProfile'
import useWeightLog from '../../hooks/useWeightLog'
import ClimbingStats from './ClimbingStats'
import GoalsSection from '../goals/GoalsSection'

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

var MAX_WIDGETS = 10

var WIDGET_OPTS = [
  { key: 'trainingLoad',  label: 'Training load' },
  { key: 'boulderLevel',  label: 'Boulder level' },
  { key: 'ropeLevel',     label: 'Rope level' },
  { key: 'coachTip',      label: 'Coach tip' },
  { key: 'weight',        label: 'Weight & BMI' },
  { key: 'goals',         label: 'Goals' },
  { key: 'alcoholFree',   label: 'Alcohol-free streak' },
  { key: 'gymStats',      label: 'Gym stats' },
  { key: 'cardioStats',   label: 'Cardio stats' },
  { key: 'calorieBalance', label: 'Calorie balance' },
]

// New keys added after initial release — default OFF so existing users
// aren't pushed over the MAX_WIDGETS limit without opting in.
var OPT_IN_KEYS = { gymStats: true, cardioStats: true, calorieBalance: true }

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
  var { entries } = useWeightLog()

  var [widgets, setWidgets] = useState({})

  var today       = new Date().toISOString().slice(0, 10)
  var lastEntry   = entries.length > 0 ? entries[0] : null
  var profileName = profile ? (profile.name || '') : ''
  var h = profile && profile.heightCm ? profile.heightCm : 0

  useEffect(function () {
    var dw = (profile && profile.dashWidgets) || {}
    var wg = {}
    WIDGET_OPTS.forEach(function (opt) {
      if (OPT_IN_KEYS[opt.key]) {
        wg[opt.key] = dw[opt.key] === true
      } else {
        wg[opt.key] = dw[opt.key] !== false
      }
    })
    setWidgets(wg)
  }, [profile])

  var activeCount = Object.keys(widgets).filter(function (k) { return widgets[k] }).length

  function toggleWidget(key) {
    setWidgets(function (prev) {
      var next = Object.assign({}, prev)
      if (next[key]) {
        next[key] = false
      } else {
        var count = Object.keys(next).filter(function (k) { return next[k] }).length
        if (count >= MAX_WIDGETS) return prev
        next[key] = true
      }
      saveProfile({ dashWidgets: next })
      return next
    })
  }

  // Derived values — read-only, from most recent logged entry
  var currentWeight = lastEntry ? lastEntry.weight : (profile && profile.weightKg ? profile.weightKg : null)
  var bmi    = h > 0 && currentWeight ? currentWeight / ((h / 100) * (h / 100)) : null
  var bmiCat = bmi ? bmiCategory(bmi) : null
  var trend  = calcWeightTrend(entries)

  var weightHint = ''
  if (lastEntry) {
    if (lastEntry.date === today) {
      weightHint = 'today'
    } else {
      var then = new Date(lastEntry.date + 'T12:00:00')
      var nowD = new Date(today + 'T12:00:00')
      var days = Math.round((nowD - then) / 86400000)
      if (days === 1)       weightHint = 'yesterday'
      else if (days <= 7)   weightHint = days + 'd ago'
      else {
        try { weightHint = then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
        catch { weightHint = '' }
      }
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

        {/* Body comp — read-only display (log weight in Log → Health) */}
        <div className="rounded-xl bg-[#f8f9fc] border border-[#e5e7ef] px-3 py-2 mb-2">
          <div className="flex items-center gap-2">
            <Scale size={12} className="text-[#bbbcc8] shrink-0" />
            {currentWeight ? (
              <>
                <span className="text-sm font-bold text-[#1a1d2e]" style={barlow}>{currentWeight} kg</span>
                {weightHint && (
                  <span className="text-[9px] text-[#bbbcc8]" style={barlow}>{weightHint}</span>
                )}
                {bmi && bmiCat && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto" style={{ background: bmiCat.bg, color: bmiCat.color, ...barlow }}>
                    BMI {bmi.toFixed(1)} · {bmiCat.label}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-[#bbbcc8]" style={barlow}>No weight logged — use Log → Health</span>
            )}
          </div>

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

      </div>

      <GoalsSection />

      <ClimbingStats />
    </div>
  )
}
