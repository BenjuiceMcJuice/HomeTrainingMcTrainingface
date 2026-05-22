# BetaLog — Cardio Session Type Spec

## Overview

Add a lightweight `"cardio"` session type for cross-training activities (swim, run, cycle, etc.). This is a first-class session type — counts toward streaks and totals — but deliberately simple: no exercises array, no climbs, no grips.

**Motivation:** Climbers routinely cross-train. Logging these sessions alongside climbing and gym work gives the AI coach complete context and keeps the weekly streak honest.

---

## Data Model

### New `SessionType` value

```
"gym" | "climb" | "hangboard" | "cardio"   ← add "cardio"
```

### New fields on `Session` (only populated when `type === "cardio"`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `cardioActivity` | `string` | yes | One of the preset values below, or `"other"` |
| `cardioLabel` | `string \| null` | no | Custom label when `cardioActivity === "other"`, e.g. `"Martial Arts"` |
| `cardioDurationMins` | `number` | yes | Total duration in minutes |
| `cardioQuantity` | `number \| null` | no | Optional volume: lengths, km, miles, laps, etc. |
| `cardioUnit` | `string \| null` | no | Free-text unit to pair with quantity: `"lengths"`, `"km"`, `"miles"`, `"laps"` |
| `difficulty` | `1–5` | yes | Perceived effort — same scale as other session types |
| `notes` | `string` | no | Free text — stroke, route, conditions, etc. |

**Preset activity values:**

```
swim | run | cycle | row | walk | yoga | other
```

No stroke, pool-length, or sport-specific fields — `notes` handles that (`"breaststroke, 25m pool"`). Keeps the model flat and avoids sport-specific branching.

### Unchanged fields (still required on all sessions)

`id`, `date`, `type`, `createdAt`, `updatedAt`, `discipline: null`, `exercises: []`, `climbs: []`, `hangGrips: []`

### `useSessions.addSession` defaults

Add to the defaults object:

```js
cardioActivity: null,
cardioDurationMins: null,
cardioQuantity: null,
cardioUnit: null,
cardioLabel: null,
```

---

## UI — Log page

### New mode tab

Add `"cardio"` to the `MODES` array in `Log.jsx`:

```js
{ key: 'cardio', label: 'Cardio', accent: '#0d9488' }   // teal
```

This appears as a fourth pill after Train / Climb / Hang.

### CardioMode component (`Log.jsx` or extracted to `CardioLogSheet.jsx`)

A slide-up sheet (same pattern as `GymLogSheet`) triggered by the Cardio tab. Contains:

1. **Activity selector** — horizontal scrollable chip row: Swim · Run · Cycle · Row · Walk · Yoga · Other
2. **Custom label input** — text input, only shown when "Other" is selected. Placeholder: `"Activity name"`
3. **Duration** — NumericStepper, step 5, range 5–300 min. Label: `Duration (min)`
4. **Quantity + Unit** — shown for Swim / Run / Cycle / Row; hidden for Walk / Yoga / Other by default (but a "add distance / laps" toggle reveals it for any activity)
   - Quantity: NumericStepper, integer, range 1–9999
   - Unit: short select or text input — options: `lengths`, `km`, `miles`, `laps`, `m`
   - Swim defaults unit to `lengths`; Run/Cycle default to `km`; Row defaults to `m`
5. **Difficulty** — same 1–5 pill row used in GymLogSheet
6. **Date** — date input, defaults to today
7. **Notes** — textarea, placeholder: `"Stroke, route, conditions…"`
8. **Save button** — creates session and closes sheet

No timer. Cardio is logged after the fact.

---

## UI — SessionCard

### TYPE_META entry

```js
cardio: { label: 'Cardio', bg: '#ecfdf5', color: '#0d9488' }
```

### `cardioDetail()` helper

```
Swim · 20 lengths · 45 min
Run · 5.2 km · 32 min
Yoga · 60 min
```

Format: `{activity name} · {quantity} {unit} · {duration} min`
- If no quantity: `{activity name} · {duration} min`
- If `cardioActivity === "other"` and `cardioLabel` set: use `cardioLabel` instead of "other"

### `sessionName()` update

```js
if (session.type === 'cardio') {
  return session.cardioLabel || capitalise(session.cardioActivity) || 'Cardio'
}
```

---

## UI — SessionDetailSheet

### CardioDetail component

Sections:
1. **Activity** — teal badge with activity name (or custom label)
2. **Stats row** — Duration · Quantity (if set) · Difficulty
3. **Notes** — shown if non-empty

No edit flow in v1 — delete and re-log is fine for cardio. (Edit can come later if needed.)

---

## Stats / Dashboard

No changes required:

- `QuickStats` counts all sessions regardless of type — cardio sessions count toward "this week" and "total" automatically.
- `calcWeeklyStreak` iterates all sessions — cardio sessions count toward streak automatically.
- `calcDisciplineStats` already ignores non-climb sessions — no change needed.

---

## AI Coach

No code changes needed. The coach's `buildContext()` serialises all sessions; cardio sessions will appear naturally. The `notes` field is the place to put stroke, route, etc. — the coach can reason about it.

---

## Files changed

| File | Change |
|---|---|
| `src/lib/types.js` | Add `"cardio"` to `SessionType`; document new cardio fields |
| `src/hooks/useSessions.js` | Add cardio field defaults in `addSession` |
| `src/pages/Log.jsx` | Add `"cardio"` to `MODES`; add `CardioMode` component |
| `src/components/log/CardioLogSheet.jsx` | **New file** — the slide-up log form |
| `src/components/log/SessionCard.jsx` | Add `TYPE_META` entry, `cardioDetail()`, update `sessionName()` |
| `src/components/log/SessionDetailSheet.jsx` | Add `CardioDetail` component |

---

## Out of scope (v1)

- Edit flow for cardio sessions (delete + re-log is sufficient)
- Per-sport fields (stroke, pool length, elevation, pace) — use `notes`
- Cardio breakdown on Dashboard (e.g. cardio vs gym split) — not worth it yet
- Integrations (Strava, Apple Health) — future
