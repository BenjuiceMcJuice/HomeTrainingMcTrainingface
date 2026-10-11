/**
 * BetaLog — what is left of the calendar feed client.
 *
 * The calendar reminders route (Route A, `betalog_reminders_spec.md`) was
 * removed from the app on 2026-10-11 — Ben: *"I don't need the calendar
 * reminder option … it can be removed."* Push reminders are the one route.
 * What remains here revokes a feed a device published before that, so the
 * link it handed to a calendar app stops serving (storage.js does this once,
 * on load, when it finds the old record). The Worker itself stays deployed
 * until it is taken down by hand (BTL-B151).
 */

var API_BASE = (import.meta.env && import.meta.env.VITE_CALENDAR_API) ||
  'https://betalog-calendar.benjuicemcjuice.workers.dev'

/**
 * The https URL of a feed — what the Worker serves.
 * @param {string} token
 * @returns {string}
 */
export function feedUrl(token) {
  return API_BASE + '/cal/' + token + '.ics'
}

/**
 * Delete the feed server-side. Any calendar still subscribed starts 404ing.
 * @param {string} token
 * @returns {Promise<void>}
 */
export function revokeFeed(token) {
  if (typeof fetch !== 'function') return Promise.resolve()
  return fetch(feedUrl(token), { method: 'DELETE' }).then(function (res) {
    // 404 means it's already gone, which is the outcome we wanted
    if (!res.ok && res.status !== 404) throw new Error('Revoke failed (' + res.status + ')')
  })
}
