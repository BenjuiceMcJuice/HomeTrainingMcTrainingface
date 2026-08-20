/**
 * BetaLog — dashboard widget collapse state.
 *
 * Pure. No React imports, so it can be tested directly and used from anywhere.
 * Collapse state lives in `profile.widgetCollapsed`, a `{key: bool}` map beside
 * the existing `dashWidgets` and `widgetOrder`, so it syncs across devices.
 */

/**
 * Widgets absent from this map default to expanded. Chart-heavy ones fold, so
 * you land on headline numbers and open the charts you want.
 *
 * Rejected all-collapsed (reads as empty on first run) and all-expanded
 * (delivers no declutter without per-device manual work).
 */
var COLLAPSE_DEFAULTS = {
  alcoholFree:      true,
  activityCalendar: true,
  cardioStats:      true,
  // The level cards gained a grade-distribution chart in phase 3. The spec's
  // earlier list had them expanded, from when their whole body was two lines of
  // numbers — but moving the charts onto the Dashboard only declutters if they
  // arrive folded, otherwise the scroll just moves house from Plan. The headline
  // (level, project/consistent/flash, goal progress) stays visible either way.
  boulderLevel:     true,
  ropeLevel:        true,
}

/**
 * Is this widget collapsed? Falls back to the default when the user has never
 * touched it.
 *
 * Tests own-property, not truthiness: once someone expands a chart widget the
 * stored `false` has to beat the `true` default, and `map[key] || DEFAULT[key]`
 * would silently re-collapse it on every load.
 */
function isCollapsed(profile, widgetKey) {
  var map = (profile && profile.widgetCollapsed) || {}
  if (Object.prototype.hasOwnProperty.call(map, widgetKey)) return !!map[widgetKey]
  return !!COLLAPSE_DEFAULTS[widgetKey]
}

/** The map to persist after toggling one widget. Never mutates the original. */
function toggleCollapsed(profile, widgetKey) {
  var map  = (profile && profile.widgetCollapsed) || {}
  var next = Object.assign({}, map)
  next[widgetKey] = !isCollapsed(profile, widgetKey)
  return next
}

export { COLLAPSE_DEFAULTS, isCollapsed, toggleCollapsed }
