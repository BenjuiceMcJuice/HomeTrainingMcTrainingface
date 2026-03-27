> **OBSOLETE** — This step is complete (2026-03-23). The implementation is in the code. See `DEVLOG.md` for build history.

# Step 3 — Gym Session Logging (COMPLETED)

Spec for Claude Code. Covers `useSessions.js`, `GymLogSheet.jsx`, and Plan.jsx wiring.
Read alongside `betalog_data_model.md` (canonical data model) and `DEVLOG.md` (build order).

---

## Overview

Gym session logging has two entry points but one shared component (`GymLogSheet`).
Both entry points open the same sheet, pre-filled with defaults. The user can edit
any value before saving. Default routine/exercise data is never mutated.

Climb and hangboard logging are out of scope for this step.

---

## Entry points

### Log button
- Present on every **routine row** and every **exercise row** in `Plan.jsx`
- Styled as a small pill button using the app's existing `btn btn-primary btn-sm` classes
- Label: **"Log"** — short, unambiguous, no icon needed
- Sits to the left of the existing edit/chevron controls on each row
- Tapping it opens `GymLogSheet` pre-filled with all defaults
- No other behaviour — the sheet handles everything from there

**Sizing and feel:** `btn-sm` padding (`6px 12px`), Barlow Condensed font, accent blue
background (`#4f7ef8`), rounded corners (`8px`). Should read as a clear action but not
dominate the row — same visual weight as the existing "Edit" buttons in the old app's
routine list.

### Tap to log (name / row body)
- Tapping the routine or exercise name (or the row body, excluding the edit/quick-log buttons) also opens `GymLogSheet`
- Identical behaviour to Quick Log — same component, same pre-fill
- This replaces any existing tap-to-edit behaviour on exercise rows in the log context
  (edit behaviour stays on the Plan page via the existing edit button/chevron)

### Single exercise restriction
- Remove any multi-select / checkbox / "log selected exercises" UI from the exercise list
- One tap → one session for that exercise, period
- No batch logging from the exercise list
- Deferred: suggest creating a routine if the same exercises are repeatedly logged solo
  (log this pattern in History step, not here)

---

## GymLogSheet component

**File:** `src/components/log/GymLogSheet.jsx`

### Trigger & props

```jsx
<GymLogSheet
  source={{ type: 'routine' | 'exercise', id: string }}
  open={boolean}
  onClose={() => void}
  onSaved={() => void}   // called after session is saved — parent can show toast etc.
/>
```

On mount (when `open` becomes true), deep-copy the routine or exercise from context.
Never mutate the source data. All edits live in local component state only.

### Sheet behaviour
- Slides up from the bottom — same animation/style as `RoutineModal`
- Full-height on mobile
- Header: source name (routine name or exercise name) + today's date (formatted `Mon 23 Mar`)
- Close button (X) top right — discards all changes, no confirmation needed

---

## Sheet layout

### Exercise cards

For a **routine source:** one card per exercise in the routine, in routine order.
For a **single exercise source:** one card for that exercise.

Each card mirrors the expanded exercise row style from `RoutineModal`:

```
┌─────────────────────────────────────┐
│  Exercise name   [movement chip]    │
│─────────────────────────────────────│
│  SET   REPS / DURATION   WEIGHT     │
│   1    [ 8 ]             [ 60 kg ]  │
│   2    [ 8 ]             [ 60 kg ]  │
│   3    [ 8 ]             [ 60 kg ]  │
└─────────────────────────────────────┘
```

- Each set is a separate line item — one row per set
- Set number is a static label (not editable)
- Reps input: numeric, min 0. Label is "REPS" for `trackingType: "reps"` exercises,
  "SECS" for `trackingType: "time"` (uses `defaultDuration` as the default value)
- Weight input: numeric, signed kg. Display "BW" as placeholder when value is 0.
  Accepts negative values (assisted). Show unit "kg" inline.
- No done/tick toggle — sets are assumed complete. If the user logged it, it happened.
- No drag-to-reorder — this is a log, not a template
- No add/remove set controls in this step (deferred)

Pre-fill all values from defaults:
- Routine source: use `targetSets`, `targetReps`, `targetWeight`, `trackingType`,
  `targetDuration` from each `RoutineExercise`
- Exercise source: use `defaultSets`, `defaultReps`, `defaultWeight`, `trackingType`,
  `defaultDuration` from the `Exercise`

---

## Sticky footer

Sticks to the bottom of the sheet, above the OS home bar.

### Difficulty selector (mandatory)

- Label: "How was it?" or "Effort"
- 5 options displayed as tappable pills or icon buttons: 1 · 2 · 3 · 4 · 5
- Labels (small, below number): 1=Easy, 2=Moderate, 3=Hard, 4=Very Hard, 5=Max
- Starts **unselected** (null) — no default
- If user taps Save without selecting difficulty, show inline validation error:
  "Select an effort level to save" — do not save
- Once selected, highlight the chosen pill (accent colour)

**Effort model — what this rating is for:**
Effort is a session-level subjective fatigue/recovery signal only. It is not a proxy
for training load. Actual load is computed from volume (sets × reps × weight) using
the set data already stored in the session.

This means a 3-effort 5-exercise session and a 4-effort single-exercise session are
not compared via their effort scores — the volume data makes that comparison directly.
The AI coach uses effort to track fatigue trends and recovery adequacy; it uses volume
for load analysis. Keep these concerns separate in all coach prompts and history views.

Per-exercise RPE is not collected — one rating per session is the right balance between
signal quality and logging friction.

### Notes field

- Optional — label "Notes" or "Session notes"
- Single textarea, 2–3 rows
- Placeholder: "Anything to note about this session..."
- No character limit enforced in UI

### Save button

- Full width, accent colour
- Label: "Save Session"
- Disabled state (visually) if difficulty is null
- On tap: validate difficulty → build Session object → call `useSessions().addSession()` → call `onSaved()` → close sheet

---

## Session object produced

Built from the sheet state at save time. Conforms to the canonical `Session` schema.

```js
{
  id:         crypto.randomUUID(),
  date:       new Date().toISOString().slice(0, 10),   // "YYYY-MM-DD"
  type:       "gym",
  discipline: null,
  difficulty: <selected 1–5>,
  notes:      <notes value or "">,
  exercises: [
    {
      exerciseId: <id>,
      name:       <denormalised name>,
      sets: [
        { reps: <value>, weight: <value>, rir: null, done: true },
        ...one entry per set row in the sheet
      ]
    },
    ...one entry per card
  ],
  climbs:    [],
  hangGrips: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}
```

`done: true` on all sets — if it's in the log, it was done.

---

## useSessions hook

**File:** `src/hooks/useSessions.js`

```js
const { sessions, addSession, deleteSession } = useSessions()
```

- `sessions` — all sessions from context, sorted newest-first
- `addSession(sessionObj)` — assigns `id`, `createdAt`, `updatedAt` if not present,
  saves to `Storage`, updates context
- `deleteSession(id)` — removes from storage and context (used in History step)

Reads/writes `il_sessions` via the `Storage` module. Does not touch other keys.

---

## Plan.jsx changes

### Routine rows
- Add a **"Log"** button (`btn btn-primary btn-sm`) to each routine row, before the existing edit controls
- `onClick`: open `GymLogSheet` with `{ type: 'routine', id: routine.id }`
- Tapping the routine name/body: same — open `GymLogSheet`
  (previously may have opened the routine edit modal — move edit behaviour to the
  pencil/edit icon only, keep the row tap for logging)

### Exercise rows
- Add a **"Log"** button (`btn btn-primary btn-sm`) to each exercise row, same position
- `onClick`: open `GymLogSheet` with `{ type: 'exercise', id: exercise.id }`
- Tapping the exercise name/body: same
- **Remove** any existing multi-select checkbox or "log selected" button/flow
- One exercise → one session, no exceptions in this step

### Sheet state
- Single `gymLogSheet` state object in Plan: `{ open: false, source: null }`
- One `<GymLogSheet>` instance rendered at the bottom of Plan, controlled by this state
- On `onSaved`: show a brief toast/snackbar — "Session saved" — same style as other
  feedback in the app

## What this step does NOT include

- Climb session logging (Step 3b, separate spec)
- Hangboard session logging (Step 4)
- Ad-hoc exercise logging without a routine or library exercise (not planned)
- Adding/removing sets within the log sheet (deferred)
- Editing a saved session (Step 6 — History)
- The "suggest a routine" nudge for repeated single-exercise logs (deferred to History)

---

## Files to create / modify

| File | Action |
|---|---|
| `src/hooks/useSessions.js` | Create |
| `src/components/log/GymLogSheet.jsx` | Create |
| `src/pages/Plan.jsx` | Modify — add Log buttons, wire sheet, remove multi-select |

---

## Computed metrics — data to preserve for Dashboard (Step 5)

> **Claude Code — do not build any of this in Step 3.** This section documents what
> metrics will be derived from session data in Step 5. Its purpose here is to ensure
> the session objects logged in this step contain everything those calculations will
> need. Do not add any metric computation, display, or summary logic to `useSessions`,
> `GymLogSheet`, or `Plan` — that work belongs in the Dashboard step and will be
> reviewed and confirmed before building.

### What Step 3 must preserve to enable Step 5

Every `SessionExercise` must store the full `sets` array with `reps`, `weight`, and
`trackingType` resolvable from context. This is already in the schema — just don't
strip or flatten it at save time.

The `difficulty` field (1–5, mandatory) must always be present on saved sessions.
Null is not a valid saved state — the sheet blocks save until it is set.

### Metrics that will be computed in Step 5 (for reference only)

**Volume (kg moved):** `sets × reps × weight` per exercise, summed per session.
For bodyweight exercises (`weight === 0`), substitute `AthleteProfile.weightKg` if
set; exclude the exercise from volume totals if not set. Timed exercises (`trackingType
=== "time"`) are excluded from kg volume — they will be shown as duration instead.

**Weekly volume:** sum of volume across all gym sessions in the last 7 days.

**Volume vs 4-week average:** weekly volume divided by average weekly volume over the
prior 4 weeks. Expressed as a percentage. This is the primary load indicator —
green = within normal range, amber = significantly elevated, grey = below normal.

**Average session effort:** mean of `difficulty` across sessions in a time window.

**Volume × effort index:** weekly volume multiplied by average effort, normalised to
the 4-week average. A simplified Acute:Chronic Workload Ratio — flags whether the
athlete is doing significantly more or less than their baseline.

**Effort trend:** `difficulty` scores plotted per session over 7–28 days. Persistent
4–5 scores with no low-effort recovery sessions is a flag for the AI coach.

**Climbing sessions:** volume metrics do not apply. Dashboard will show session count
and average effort only for climb sessions. Grade progression is a separate chart.
All climbing metric decisions are deferred to Step 5 review.

> All metric definitions, display format, and time windows will be reviewed and
> confirmed when building Step 5. Nothing here is final — it is directional only.

---

## Definition of done

- "Log" button on every routine row and exercise row in Plan
- Tapping routine/exercise name also opens the sheet
- Sheet opens pre-filled with correct defaults from routine or exercise
- Each set is an editable line item (reps/duration + weight)
- Difficulty selector is present, starts null, blocks save if not selected
- Notes field is present and optional
- Saving produces a valid `Session` object and writes to `il_sessions`
- Routine and exercise data is unchanged after saving a session
- Multi-select removed from exercise list
- "Session saved" toast shown after successful save
