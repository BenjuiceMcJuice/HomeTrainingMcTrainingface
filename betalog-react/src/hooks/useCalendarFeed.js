import { useState } from 'react'
import { useData } from '../App'
import Storage from '../lib/storage'
import { buildFeed } from '../lib/ics'
import { newFeedToken, publishFeed, revokeFeed, feedHash, feedUrl, webcalUrl } from '../lib/calendarFeed'

// Hash currently being uploaded, per token. Module-level on purpose: the root
// sync component and the Schedule tab both mount this hook, and a re-render can
// re-run the sync effect before the previous push has stored its hash in state.
// Without this guard that races into several identical uploads.
var inFlight = {}

/**
 * The calendar reminder feed: enable, disable, and keep it matching the schedule.
 *
 * Off until `enable()` is called — no feed exists, nothing is uploaded, and no
 * permission is ever requested. Route A needs none.
 */
export default function useCalendarFeed() {
  var { data, setData } = useData()
  var [busy,  setBusy]  = useState(false)
  var [error, setError] = useState(null)

  var feed = data.calendarFeed || null
  var enabled = !!(feed && feed.enabled && feed.token)

  function save(next) {
    Storage.saveCalendarFeed(next)
    setData(function (prev) { return Object.assign({}, prev, { calendarFeed: next }) })
  }

  /**
   * Render the current schedule as .ics text.
   * `dtstamp` and `anchorFrom` are pinned to the feed's creation instant so the
   * body only changes when the schedule itself does — a churning feed makes
   * subscribed clients duplicate or drop events.
   */
  function render(record) {
    return buildFeed(data.schedule || [], {
      dtstamp:    record.createdAt,
      anchorFrom: String(record.createdAt).slice(0, 10),
    })
  }

  /** Create a token and upload the first copy of the feed. */
  function enable() {
    if (busy) return Promise.resolve(null)
    setBusy(true)
    setError(null)
    var record = {
      token:     newFeedToken(),
      enabled:   true,
      createdAt: new Date().toISOString(),
    }
    var text = render(record)
    var hash = feedHash(text)
    inFlight[record.token] = hash
    return publishFeed(record.token, text)
      .then(function () {
        record.pushedAt   = new Date().toISOString()
        record.pushedHash = hash
        save(record)
        return record
      })
      .catch(function (err) {
        setError(err.message || 'Could not set up the calendar feed')
        return null
      })
      .finally(function () {
        if (inFlight[record.token] === hash) delete inFlight[record.token]
        setBusy(false)
      })
  }

  /** Delete the feed server-side and forget the token. */
  function disable() {
    if (!feed || busy) return Promise.resolve()
    setBusy(true)
    setError(null)
    delete inFlight[feed.token]
    return revokeFeed(feed.token)
      .then(function () { save(null) })
      .catch(function (err) {
        setError(err.message || 'Could not revoke the calendar feed')
      })
      .finally(function () { setBusy(false) })
  }

  /**
   * Re-upload if the schedule has changed since the last push. Safe to call often
   * — an unchanged feed is a no-op, not a request.
   * @returns {Promise<boolean>} true if an upload happened
   */
  function sync() {
    if (!enabled) return Promise.resolve(false)
    var text = render(feed)
    var hash = feedHash(text)
    if (hash === feed.pushedHash) return Promise.resolve(false)
    if (inFlight[feed.token] === hash) return Promise.resolve(false)
    inFlight[feed.token] = hash
    return publishFeed(feed.token, text)
      .then(function () {
        save(Object.assign({}, feed, { pushedAt: new Date().toISOString(), pushedHash: hash }))
        return true
      })
      .catch(function (err) {
        // Leave pushedHash alone so the next save retries
        console.warn('[calendar] feed sync failed:', err.message)
        return false
      })
      .finally(function () {
        if (inFlight[feed.token] === hash) delete inFlight[feed.token]
      })
  }

  return {
    feed:      feed,
    enabled:   enabled,
    busy:      busy,
    error:     error,
    url:       enabled ? feedUrl(feed.token) : null,
    webcal:    enabled ? webcalUrl(feed.token) : null,
    enable:    enable,
    disable:   disable,
    sync:      sync,
  }
}
