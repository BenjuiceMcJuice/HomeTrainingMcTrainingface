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

// New keys added after initial release — default OFF so existing users
// aren't pushed over the MAX_WIDGETS limit without opting in.
var OPT_IN_KEYS = { gymStats: true, cardioStats: true }

export default function WidgetPicker() {
  var { profile, saveProfile } = useProfile()
  var [widgets, setWidgets] = useState({})

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
