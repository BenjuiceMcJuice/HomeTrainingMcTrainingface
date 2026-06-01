import { Dumbbell } from 'lucide-react'
import { barlow, daysAgo, capitalise } from '../../lib/utils'

const CAT_LABEL = {
  back: 'Back', chest: 'Chest', legs: 'Legs', arms: 'Arms',
  core: 'Core', shoulders: 'Shoulders', mobility: 'Mobility', cardio: 'Cardio',
}

export default function GymStatsCard({ sessions }) {
  const cutoff = daysAgo(89)
  const gym    = sessions.filter(s => s.type === 'gym' && s.date >= cutoff)
  if (gym.length === 0) return null

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

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl border border-[#e5e7ef] px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#eef1ff' }}>
          <Dumbbell size={16} style={{ color: '#4f7ef8' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-[#1a1d2e] text-lg leading-none" style={barlow}>{gym.length}</span>
            <span className="text-[10px] font-bold text-[#7a8299]" style={barlow}>sessions</span>
            <span className="text-[9px] text-[#bbbcc8]" style={barlow}>· last 90 days</span>
          </div>
          <p className="text-[11px] text-[#7a8299] mt-0.5" style={barlow}>
            {totalSets > 0 ? totalSets + ' sets' : 'No sets logged'}
            {dominantLabel ? '  ·  ' + dominantLabel + ' heavy' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
