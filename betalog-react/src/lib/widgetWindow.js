/**
 * BetaLog — dashboard widget timeframe windows.
 *
 * Pure. No React imports, so it can be tested directly and used from anywhere.
 *
 * One vocabulary for time (docs/specs/betalog_widget_system_spec.md, rule 2):
 * a chip labelled `90d` means *the window of data being summarised*, on every
 * card. How a chart buckets that window is the chart's business — the alcohol
 * card draws daily bars at 30d and weekly ones at 90d, and the user never has
 * to think about it.
 *
 * The chosen window is **per card, and persisted** in `profile.widgetWindow`,
 * beside `widgetCollapsed`, so it syncs across devices and survives a reload.
 * Rejected one dashboard-wide window: it reads as more coherent but takes away
 * looking at 12 months of drinking beside 30 days of cardio, which is most of
 * why the cards carry separate chips at all.
 */

/** Every window a card can offer, in the order the chips render. */
var WINDOW_OPTIONS = {
  cardioStats:  ['30d', '90d', '12m'],
  gymStats:     ['30d', '90d', '12m'],
  alcoholFree:  ['30d', '90d', '12m'],
  // The level cards compare recent form against everything ever logged, which
  // is a different question from "how much, lately" — so they keep their own
  // pair rather than being forced onto the shared three.
  boulderLevel: ['90d', 'all'],
  ropeLevel:    ['90d', 'all'],
}

/** 90d everywhere: long enough to show a trend, short enough to be current. */
var WINDOW_DEFAULTS = {
  cardioStats:  '90d',
  gymStats:     '90d',
  alcoholFree:  '90d',
  boulderLevel: '90d',
  ropeLevel:    '90d',
}

/** Days in each shared window. `all` has no length — callers handle it. */
var WINDOW_DAYS = {
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

/**
 * Which window is this card showing? Falls back to the default when the user
 * has never touched it, and when a stored value is no longer offered — a card
 * whose chips change must not be left pointing at a window it cannot render.
 */
function getWindow(profile, widgetKey) {
  var stored  = ((profile && profile.widgetWindow) || {})[widgetKey]
  var options = WINDOW_OPTIONS[widgetKey] || []
  if (stored && options.indexOf(stored) !== -1) return stored
  return WINDOW_DEFAULTS[widgetKey] || options[0] || null
}

/**
 * The map to persist after choosing a window. Never mutates the original, and
 * ignores a window the card does not offer.
 */
function setWindow(profile, widgetKey, value) {
  var map     = (profile && profile.widgetWindow) || {}
  var options = WINDOW_OPTIONS[widgetKey] || []
  if (options.indexOf(value) === -1) return map
  var next = Object.assign({}, map)
  next[widgetKey] = value
  return next
}

/** Length of a shared window in days. Null for `all`, or anything unknown. */
function windowDays(window) {
  return WINDOW_DAYS[window] || null
}

export { WINDOW_OPTIONS, WINDOW_DEFAULTS, WINDOW_DAYS, getWindow, setWindow, windowDays }
