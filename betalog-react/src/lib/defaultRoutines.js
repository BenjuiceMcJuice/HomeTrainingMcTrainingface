/**
 * BetaLog — Default routines
 *
 * Seeded into every new install. Safe to re-run (merge-seed pattern —
 * existing routines by ID are never overwritten, so user edits are preserved).
 *
 * IDs are stable strings so we can detect what's already seeded.
 * Prefix: 'dr-' = default routine
 */

import Storage from './storage'

// ---------------------------------------------------------------------------
// Grip helper
// ---------------------------------------------------------------------------

function grip(fingers, gripType, activeSecs, restSecs, setRest, reps, sets, edgeSize) {
  var gripLabels = {
    'open-hand':  'Open Hand',
    'half-crimp': 'Half Crimp',
    'full-crimp': 'Full Crimp',
    'drag':       'Drag',
  }
  var edge     = edgeSize || '30mm'
  var gtLabel  = gripLabels[gripType] || gripType
  return {
    id:         'dr-g-' + fingers.replace(/\s/g, '') + '-' + gripType + '-' + activeSecs + '-v2',
    fingers:    fingers,
    gripType:   gripType,
    grip:       gripType,
    edgeSize:   edge,
    gripName:   fingers + ' · ' + gtLabel + ' · ' + edge,
    activeSecs: activeSecs,
    restSecs:   restSecs,
    setRest:    setRest,
    reps:       reps,
    sets:       sets,
    weightMode: 'bodyweight',
    weightKg:   0,
  }
}

var TS = '2026-01-01T00:00:00.000Z'

// ---------------------------------------------------------------------------
// Default hangboard routines
// ---------------------------------------------------------------------------

export var DEFAULT_ROUTINES = [
  {
    id:          'dr-max-hangs-v5',
    type:        'hangboard',
    name:        'Max Hangs',
    description: 'High-intensity. Adjust weight (belt or pulley) so each hang is near-maximal — roughly 80–100% of the most you can sustain for the chosen grip. Long rest between sets for full neuromuscular recovery. The key variable is load, not volume.',
    exercises:   [],
    grips: [
      grip('4 Finger', 'half-crimp', 7, 3, 180, 1, 6),
      grip('4 Finger', 'open-hand',  7, 3, 180, 1, 6),
    ],
    createdAt:   TS,
    updatedAt:   TS,
  },
  {
    id:          'dr-7-3-repeaters-v4',
    type:        'hangboard',
    name:        '7:3 Repeaters',
    description: '7 seconds on, 3 seconds off × 6 reps per set. Targets finger strength endurance at sub-maximum load. A solid middle ground between max strength and pure endurance work.',
    exercises:   [],
    grips: [
      grip('4 Finger', 'half-crimp', 7, 3, 150, 6, 4),
      grip('4 Finger', 'open-hand',  7, 3, 150, 6, 4),
    ],
    createdAt:   TS,
    updatedAt:   TS,
  },
  {
    id:          'dr-submaxrepeaters-v4',
    type:        'hangboard',
    name:        'Sub-Max Repeaters',
    description: 'Tendon conditioning through low-load, high-frequency stimulus. You\'re not training to failure — you\'re ticking tendons over regularly to drive collagen production. Think physio-style maintenance that also builds strength over time.',
    exercises:   [],
    grips: [
      grip('4 Finger',  'open-hand',  10, 20, 30, 6, 1),
      grip('Front 3',   'open-hand',  10, 20, 30, 6, 1),
      grip('Front 2',   'open-hand',  10, 20, 30, 2, 1),
      grip('Middle 2',  'open-hand',  10, 20, 30, 2, 1),
      grip('Front 2',   'half-crimp', 10, 20, 30, 2, 1),
      grip('Middle 2',  'half-crimp', 10, 20, 30, 2, 1),
    ],
    createdAt:   TS,
    updatedAt:   TS,
  },
]

// IDs that existed in older builds and should be removed on load
export var RETIRED_ROUTINE_IDS = [
  // climbing routines — scrapped
  'dr-4x4s-boulder', 'dr-4x4s-lead', 'dr-4x4s-toprope',
  'dr-pyramid-boulder', 'dr-pyramid-lead', 'dr-pyramid-toprope',
  'dr-arcing-boulder', 'dr-arcing-lead', 'dr-arcing-toprope',
  'dr-endurance-laps-boulder', 'dr-endurance-laps-lead', 'dr-endurance-laps-toprope',
  // v1 hang routines — replaced by v2 with edgeSize
  'dr-max-hangs', 'dr-7-3-repeaters', 'dr-submaxrepeaters',
  // superseded versions
  'dr-max-hangs-v2', 'dr-max-hangs-v3', 'dr-max-hangs-v4',
  'dr-7-3-repeaters-v2', 'dr-7-3-repeaters-v3',
  'dr-submaxrepeaters-v2', 'dr-submaxrepeaters-v3',
]

// ---------------------------------------------------------------------------
// Seeder — merge-seed pattern, idempotent
// ---------------------------------------------------------------------------

export function seedDefaultRoutines() {
  var raw = JSON.parse(localStorage.getItem('il_routines') || '[]')

  var retiredSet  = new Set(RETIRED_ROUTINE_IDS)
  var purged      = raw.filter(function (r) { return !retiredSet.has(r.id) })
  var existingIds = new Set(purged.map(function (r) { return r.id }))
  var missing     = DEFAULT_ROUTINES.filter(function (r) { return !existingIds.has(r.id) })

  if (purged.length !== raw.length || missing.length > 0) {
    Storage.saveRoutines(purged.concat(missing))
  }
}
