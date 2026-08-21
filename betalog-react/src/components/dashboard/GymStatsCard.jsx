import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import WidgetShell from './WidgetShell'
import BarTimeline from './BarTimeline'
import { filterSessionsByDays, buildValueTimeline, WINDOW_BUCKET_MODE } from '../../lib/stats'
import { barlow, capitalise } from '../../lib/utils'
import useWidgetWindow from '../../hooks/useWidgetWindow'
import { windowDays } from '../../lib/widgetWindow'

const CAT_LABEL = {
  back: 'Back', chest: 'Chest', legs: 'Legs', arms: 'Arms',
  core: 'Core', shoulders: 'Shoulders', mobility: 'Mobility', cardio: 'Cardio',
}

const ACCENT = '#4f7ef8'

/** Sets logged in one session, skipping exercises that were marked not done. */
function sessionSets(s) {
  var n = 0
  ;(s.exercises || []).forEach(function (ex) {
    if (ex.done === false) return
    n += (ex.sets || []).length
  })
  return n
}

export default function GymStatsCard({ sessions, editMode }) {
  const { window: activeWindow, options, setWindow } = useWidgetWindow('gymStats')
  const [picked, setPicked] = useState(null)

  const allGym = sessions.filter(s => s.type === 'gym')
  const hasIn  = {}
  options.forEach(function (w) { hasIn[w] = filterSessionsByDays(allGym, windowDays(w)).length > 0 })
  if (!hasIn['12m']) return null

  const gym = filterSessionsByDays(allGym, windowDays(activeWindow))

  let totalSets = 0
  const catCount = {}
  gym.forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (ex.done === false) return
      totalSets += (ex.sets || []).length
      const cat = ex.category || 'other'
      catCount[cat] = (catCount[cat] || 0) + 1
    })
  })

  let dominantCat = null, maxCount = 0
  Object.keys(catCount).forEach(cat => {
    if (catCount[cat] > maxCount) { maxCount = catCount[cat]; dominantCat = cat }
  })
  const dominantLabel = dominantCat ? (CAT_LABEL[dominantCat] || capitalise(dominantCat)) : null

  // Sets per bucket — a count of sessions never showed whether the volume
  // behind them was going up or down.
  const mode         = WINDOW_BUCKET_MODE[activeWindow] || 'week'
  const timeline     = buildValueTimeline(gym, mode, sessionSets)
  const pickedBucket = picked !== null && timeline.buckets[picked] ? timeline.buckets[picked] : null

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#c7d7fd] px-4 py-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#eef1ff' }}>
          <Dumbbell size={16} style={{ color: ACCENT }} />
        </div>
        <WidgetShell widgetKey="gymStats" editMode={editMode} className="flex-1 min-w-0" header={
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{gym.length}</span>
            <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>sessions</span>
            <span className="text-[10px] text-[#bbbcc8]" style={barlow}>{activeWindow}</span>
            {totalSets > 0 && (
              <span className="text-[10px] font-bold ml-auto" style={{ ...barlow, color: ACCENT }}>
                {totalSets} sets
              </span>
            )}
          </div>
        }>
          <div className="flex items-center gap-0.5 mt-1.5">
            {options.map((w) => {
              const active = w === activeWindow
              const disabled = !hasIn[w]
              return (
                <button
                  key={w}
                  onClick={() => { if (!disabled) { setPicked(null); setWindow(w) } }}
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold leading-none transition-colors"
                  style={{
                    ...barlow,
                    background: active ? ACCENT : '#eef1ff',
                    color:      active ? '#fff'  : disabled ? '#d1d5db' : ACCENT,
                    cursor:     disabled ? 'default' : 'pointer',
                  }}
                >
                  {w}
                </button>
              )
            })}
          </div>

          {gym.length > 0 && (
            <BarTimeline
              buckets={timeline.buckets}
              accentColor={ACCENT}
              unitLabel="sets"
              cardBg="#ffffff"
              selected={picked}
              onSelect={setPicked}
              gap={mode === 'day' ? 2 : 3}
              labelMode={mode === 'day' ? 'edges' : 'step'}
              labelStep={mode === 'week' ? 3 : 2}
              endLabel="today"
            />
          )}

          {gym.length === 0
            ? <p className="text-[11px] text-[#bbbcc8] mt-0.5" style={barlow}>No sessions in the last {activeWindow}</p>
            : pickedBucket
              ? <p className="text-[11px] text-[#1a1d2e] mt-1 truncate" style={barlow}>
                  {pickedBucket.fullLabel} · {pickedBucket.count === 1 ? '1 session' : pickedBucket.count + ' sessions'} · {pickedBucket.value} sets
                </p>
              : <p className="text-[11px] text-[#7a8299] mt-1 truncate" style={barlow}>
                  {totalSets > 0 ? totalSets + ' sets' : 'No sets logged'}
                  {dominantLabel ? '  ·  ' + dominantLabel + ' heavy' : ''}
                </p>
          }
        </WidgetShell>
      </div>
    </div>
  )
}
