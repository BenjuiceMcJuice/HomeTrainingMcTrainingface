import { useState, useEffect } from 'react'
import useProfile from '../../hooks/useProfile'
import { barlow } from '../../lib/utils'

/**
 * Which dashboard widgets are shown.
 *
 * Lives in the Dashboard's "Edit layout" mode, beside the drag-to-reorder it
 * belongs with: choosing widgets and ordering them are one job, and they used
 * to be split across two screens — the picker on a Plan tab writing
 * `dashWidgets`, the ordering here writing `widgetOrder`.
 */

var MAX_WIDGETS = 10

var WIDGET_OPTS = [
  { key: 'trainingLoad',  label: 'Training load' },
  { key: 'boulderLevel',  label: 'Boulder level' },
  { key: 'ropeLevel',     label: 'Rope level' },
  { key: 'coachTip',      label: 'Coach tip' },
  { key: 'weight',        label: 'Weight & BMI' },
  { key: 'alcoholFree',   label: 'Alcohol over time & streak' },
  { key: 'gymStats',      label: 'Gym stats' },
  { key: 'cardioStats',   label: 'Cardio stats' },
  { key: 'activityCalendar', label: 'Activity calendar' },
]


export default function WidgetPicker() {
  var { profile, saveProfile } = useProfile()
  var [widgets, setWidgets] = useState({})

  useEffect(function () {
    // Default ON, matching how the Dashboard itself decides what to render
    // (`prefs[key] !== false`). Gym and cardio stats used to be opt-in here
    // while the Dashboard showed them anyway, so the first time you toggled
    // *any* widget the picker wrote them false and two cards you had never
    // touched vanished. There is also no longer a limit argument for opt-in:
    // nine widgets against a cap of ten.
    var dw = (profile && profile.dashWidgets) || {}
    var wg = {}
    WIDGET_OPTS.forEach(function (opt) {
      wg[opt.key] = dw[opt.key] !== false
    })
    setWidgets(wg)
  }, [profile])

  var activeCount = Object.keys(widgets).filter(function (k) { return widgets[k] }).length

  // The save sits outside the state updater on purpose. It used to run inside
  // it, which made saving a render-phase update of a *different* component
  // (the profile lives above this one) — React warns about exactly that, and
  // an updater that writes to storage can be re-run at React's discretion.
  function toggleWidget(key) {
    var next = Object.assign({}, widgets)
    if (next[key]) {
      next[key] = false
    } else {
      if (activeCount >= MAX_WIDGETS) return
      next[key] = true
    }
    setWidgets(next)
    saveProfile({ dashWidgets: next })
  }

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3">
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
  )
}
