import { useEffect, useMemo, useRef } from 'react'
import { useData } from '../App'
import Storage from '../lib/storage'
import { sealWeeks } from '../lib/weekLog'
import { todayStr } from '../lib/stats'

/**
 * The sealed weekly score log.
 *
 * Sealing runs here rather than in `Storage.load()` because it needs the whole
 * dataset *after* migration, and because writing to storage during a load that
 * other hooks are already reading from is how circular updates start.
 *
 * There is no Sunday-night timer — a PWA has nowhere to run one. Every completed
 * week without a record is sealed on the first render that has data, so opening
 * the app on Monday morning or a month later produces the same records.
 *
 * A `ranFor` ref keeps this to one pass per day per mount: `sealWeeks` is
 * idempotent, but re-running it on every data change would mean a write on
 * every session logged.
 */
export default function useWeekScores() {
  var { data, setData } = useData()
  var entries = useMemo(function () { return data.weekScores || [] }, [data.weekScores])
  var ranFor  = useRef(null)

  useEffect(function () {
    if (!data || !data.sessions) return
    var today = todayStr()
    if (ranFor.current === today) return
    ranFor.current = today

    var result = sealWeeks({
      sessions:        data.sessions,
      scheduleEntries: Array.isArray(data.schedule) ? data.schedule : [],
      drinkLog:        data.drinkLog,
    }, data.weekScores || [], today)

    if (!result.added.length) return

    Storage.saveWeekScores(result.records)
    setData(function (prev) { return Object.assign({}, prev, { weekScores: result.records }) })
  }, [data, setData])

  return { entries: entries }
}
