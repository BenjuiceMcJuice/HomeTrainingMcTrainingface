# Data Migration — Old App → React Rewrite

Spec for Claude Code. Covers the migration function in `src/lib/storage.js` that
transforms old localStorage data into the canonical data model on first load.

Read alongside `betalog_data_model.md` (canonical data model) and `CLAUDE.md`.

---

## Overview

The old app and the React rewrite share the same localStorage keys on the same device.
A user who has been using the old app will already have data in localStorage when they
open the React app for the first time — no export/import needed.

However, the old app's data shapes differ from the canonical schema in several ways.
The migration function must normalise all old shapes to the canonical schema
**on every `Storage.load()` call**, idempotently. Running it on already-migrated data
must be a no-op — nothing should change on a second pass.

Migration does not prompt the user. It is silent and automatic.

---

## Where migration lives

`src/lib/storage.js` — inside the `Storage.load()` function, called once on app mount
from `App.jsx`. Migration runs before data is written to DataContext.

The migration function should be a private function `migrateSession(session)` that
takes one session object and returns the canonical shape. Apply it with `.map()` over
the full sessions array, then write the migrated array back to `il_sessions` only if
any session was actually changed (check with a dirty flag to avoid unnecessary writes).

Same pattern for exercises: `migrateExercise(exercise)`.

---

## Session migrations

### 1. type / discipline split

Old app stored climb type directly in `type`:

```js
// OLD
{ type: "boulder" }
{ type: "lead" }
{ type: "toprope" }

// NEW
{ type: "climb", discipline: "boulder" }
{ type: "climb", discipline: "lead" }
{ type: "climb", discipline: "toprope" }
```

Detection: `session.type` is one of `"boulder"`, `"lead"`, `"toprope"`.
Action: set `type = "climb"`, set `discipline = old type value`.

### 2. Quick sessions

Old app had `type: "quick"` for fast gym logs with no exercise detail.

```js
// OLD
{ type: "quick", exercises: [] }

// NEW
{ type: "gym", discipline: null }
```

Detection: `session.type === "quick"`.
Action: set `type = "gym"`. `discipline` is already null or absent — set to null.

### 3. Field rename — diff → difficulty

```js
// OLD
{ diff: 3 }

// NEW
{ difficulty: 3 }
```

Detection: `session.diff !== undefined`.
Action: set `difficulty = session.diff`, delete `diff`.
If `session.diff` is absent and `session.difficulty` is absent, set `difficulty = null`.
Null is valid for migrated historical sessions — do not block display of old sessions
that predate the mandatory difficulty requirement.

### 4. hangProtocol → hangGrips

Old app stored a single hangboard protocol object:

```js
// OLD
{
  type: "hangboard",
  hangProtocol: {
    grip: "half-crimp",
    onSecs: 7,
    offSecs: 3,
    sets: 6,
    reps: 5,
    weightDir: "added",
    weight: 5
  }
}

// NEW
{
  type: "hangboard",
  hangGrips: [
    {
      id: "<uuid>",
      grip: "half-crimp",
      gripName: "Half Crimp",
      activeSecs: 7,
      restSecs: 3,
      setRest: 180,        // default — not stored in old format
      reps: 5,
      sets: 6,
      weightMode: "added",
      weightKg: 5
    }
  ]
}
```

Detection: `session.hangProtocol !== undefined` or `session.grips` is an array using
the old field names (`onSecs`, `offSecs`, `weightDir`, `weightPct`).

Action: wrap in array, rename fields, assign uuid, default `setRest` to 180,
resolve `gripName` from a lookup table of grip → display label.
Map `weightDir: "none"` → `weightMode: "bodyweight"`, `weightKg: 0`.
Map `weightDir: "added"` → `weightMode: "added"`, `weightKg: session.hangProtocol.weight`.
Map `weightDir: "assisted"` → `weightMode: "assisted"`, `weightKg: session.hangProtocol.weight`.
Map `weightPct` (percentage-based old format) → skip weightKg conversion, set `weightKg: 0`
and add a `_migrationNote: "weightPct not converted"` field for manual review.

Grip name lookup:
```js
const GRIP_NAMES = {
  "half-crimp":    "Half Crimp",
  "open-hand":     "Open Hand",
  "full-crimp":    "Full Crimp",
  "two-finger-23": "Two Finger (Middle+Ring)",
  "two-finger-34": "Two Finger (Ring+Pinky)",
  "mono":          "Mono",
  "sloper":        "Sloper",
  "pinch":         "Pinch",
  "jug":           "Jug",
};
```

### 5. outcome: "fell" → "attempt"

Within `session.climbs[]`:

```js
// OLD
{ outcome: "fell" }

// NEW
{ outcome: "attempt" }
```

Detection: `climb.outcome === "fell"`.
Action: set `outcome = "attempt"`.

### 6. Missing climb IDs

Old climb objects have no `id` field.

Detection: `climb.id === undefined`.
Action: assign `crypto.randomUUID()`.

### 7. Missing createdAt / updatedAt

Old sessions have no `createdAt` or `updatedAt`.

Detection: `session.createdAt === undefined`.
Action:
- `createdAt` — synthesise from `session.date + "T00:00:00.000Z"` as a best
  approximation. Not accurate but good enough for display and sorting.
- `updatedAt` — set to same value as `createdAt` on migration.

### 8. Missing discipline field on gym/hangboard sessions

New schema requires `discipline: null` on non-climb sessions.

Detection: `session.discipline === undefined` and `session.type` is `"gym"` or
`"hangboard"`.
Action: set `discipline = null`.

### 9. Missing arrays

New schema requires `exercises: []`, `climbs: []`, `hangGrips: []` on all sessions.

Detection: any of these fields is `undefined`.
Action: set to empty array `[]`.

### 10. Old exercises array shape within gym sessions

Old gym sessions stored exercises as an array of exercise IDs or simple objects —
not the canonical `SessionExercise[]` shape with a `sets[]` array.

Detection: `session.exercises` contains items where `item.sets === undefined`.

This is a **best-effort migration** — old gym sessions did not store set-level data,
so there is nothing to reconstruct. Action:
- If `item` is a string (exercise ID only): convert to
  `{ exerciseId: item, name: "", sets: [] }`.
- If `item` is an object with flat fields (reps, weight etc.): wrap into
  `{ exerciseId: item.id || item.exerciseId, name: item.name || "", sets: [] }`.
- In both cases `sets: []` — the historical volume data is lost, which is acceptable.
  The session still appears in History with its date, type, and effort rating.

Do not attempt to reconstruct sets from flat fields — the old format is too varied.

---

## Exercise migrations

### 1. mp → movementPattern

```js
// OLD
{ mp: "pull" }

// NEW
{ movementPattern: "pull" }
```

Detection: `exercise.mp !== undefined`.
Action: rename `mp` → `movementPattern`. Delete `mp`.

### 2. cat → category (with value remapping)

Old `cat` values do not match new `category` values:

| Old cat | New category |
|---|---|
| `"pull"` | `"back"` |
| `"push"` | `"chest"` |
| `"hinge"` | `"legs"` |
| `"squat"` | `"legs"` |
| `"core"` | `"core"` |
| `"shoulder"` | `"shoulders"` |
| `"rehab"` | `"mobility"` |
| `"bodyweight"` | derive from `movementPattern` (see below) |
| `"weights"` | derive from `movementPattern` (see below) |
| anything else | `"other"` |

For `"bodyweight"` and `"weights"` (equipment-based old categories), derive from
`movementPattern`:
- `"push"` → `"chest"`
- `"pull"` → `"back"`
- `"hinge"` → `"legs"`
- `"squat"` → `"legs"`
- `"core"` → `"core"`
- `"shoulder"` → `"shoulders"`
- anything else → `"other"`

Detection: `exercise.cat !== undefined`.
Action: map old value to new, set `category`, delete `cat`.

### 3. Missing defaultWeight

Old exercises have no `defaultWeight` field.

Detection: `exercise.defaultWeight === undefined`.
Action: set `defaultWeight = 0` (bodyweight default).

### 4. Missing isFavourite

Detection: `exercise.isFavourite === undefined`.
Action: set `isFavourite = false`.

### 5. Missing trackingType

Detection: `exercise.trackingType === undefined`.
Action: default to `"reps"`. Most old exercises were rep-based.

### 6. Missing createdAt / updatedAt

Detection: `exercise.createdAt === undefined`.
Action: set both to `new Date().toISOString()` (migration timestamp, not original
creation time — acceptable for exercises).

---

## Migration strategy — idempotency

Every migration check must use the **presence of the old field** or the **presence of
an invalid value** as the trigger, never a version number or a migration flag.

Examples of idempotent checks:
- `if (session.diff !== undefined)` — safe, `diff` is deleted after migration
- `if (session.type === "boulder")` — safe, `type` becomes `"climb"` after migration
- `if (!session.createdAt)` — safe, `createdAt` is set after migration

Do not use:
- `if (!session._migrated)` — fragile, requires a flag to be maintained
- A one-time migration flag in localStorage — loses idempotency guarantee

---

## Write-back behaviour

After running migration over all sessions and exercises:

1. Compare migrated array to original (e.g. `JSON.stringify` comparison or dirty flag
   set inside each `migrateSession` call).
2. If any change was made, write back to localStorage:
   - `Storage.set('il_sessions', migratedSessions)`
   - `Storage.set('il_exercises', migratedExercises)`
3. If no changes, skip the write — do not write unnecessarily on every load.

---

## Testing checklist

Before marking Step 0 migration as done, verify each of the following manually in
the browser console against a localStorage populated with old app data:

- [ ] Old `type: "boulder"` session appears in history as `type: "climb"`, `discipline: "boulder"`
- [ ] Old `type: "quick"` session appears as `type: "gym"`
- [ ] `diff` is renamed to `difficulty` — old value preserved
- [ ] `hangProtocol` sessions appear with `hangGrips` array of one item
- [ ] `outcome: "fell"` climbs show as `"attempt"`
- [ ] All sessions have `createdAt`, `updatedAt`, `exercises`, `climbs`, `hangGrips`
- [ ] Old exercises have `movementPattern`, `category`, `defaultWeight`, `isFavourite`
- [ ] Running migration a second time produces no writes (check with a console log)
- [ ] New sessions logged after migration are unaffected by migration function

---

## What migration does NOT do

- Convert `weightPct` hangboard sessions to `weightKg` — flagged with `_migrationNote`
  for manual review, not auto-converted (unit is ambiguous without knowing bodyweight
  at the time of logging)
- Recover set-level data from old gym sessions — this data was never stored
- Migrate `il_hbRoutines` (hangboard routines stored in a separate key in the old app)
  — this is a separate migration task, deferred to Step 4

---

## Files to modify

| File | Action |
|---|---|
| `src/lib/storage.js` | Add `migrateSession()`, `migrateExercise()`, call in `load()` |

Migration belongs in `storage.js` only — no migration logic in components or hooks.
