# DEVLOG — BetaLog React Rewrite

Milestone tracker for the React rewrite. Updated when a step is complete, not after every file change.
Granular daily work is in `logs/YYYY-MM-DD.md`.

---

## Milestones

| Date       | Milestone                          | Status |
|------------|------------------------------------|--------|
| 2026-03-22 | React scaffold + shell + nav       | ✅ Done |
| 2026-03-23 | Step 0 — Data foundation           | ✅ Done |
| 2026-03-23 | Step 1 — Exercise library          | ✅ Done |
| 2026-03-23 | Step 2 — Routines                  | ✅ Done |
| 2026-03-23 | Step 3a — Gym session logging      | ✅ Done |
| 2026-03-24 | Step 3b — History                  | ✅ Done |
| 2026-03-24 | Step 3c — Climb log                | ✅ Done |
| 2026-03-24 | Step 4 — Hangboard timer           | ✅ Done |
| 2026-03-25 | Step 5 — Dashboard                 | ✅ Done |
| 2026-03-25 | Step 5b — Profile & Weight Log     | ✅ Done |
| 2026-03-26 | Step 6 — AI Coach                  | ✅ Done |
| —          | Step 7 — Firebase auth + sync      | ⬜ Pending |

---

## Build Order (data-first)

### ✅ Step 0 — Data foundation
- `src/lib/types.js` — JSDoc typedefs for all schema shapes
- `src/lib/storage.js` — single module owning all localStorage access; idempotent migration on every load
- `src/App.jsx` — DataContext + `useData()` hook; `Storage.load()` runs once on mount
- `betalog_data_model.md` — canonical data model, source of truth for all data structures

### ✅ Step 1 — Exercise library
- `src/lib/defaultExercises.js` — 89 exercises, canonical format, no equipment in names
- `src/hooks/useExercises.js` — CRUD + `toggleFavourite` + `seedDefaultExercises()`
- `src/components/exercises/ExerciseModal.jsx` — add/edit modal; name, category (muscle group), movementPattern, equipment, muscles, reps/time toggle, sets/reps/duration/rest, coaching notes, YouTube "How to" link
- `src/pages/Plan.jsx` — Exercises tab: search, category chips, favourites-first list, FAB

### ✅ Step 2 — Routines
- `src/hooks/useRoutines.js` — CRUD, filters to `type:'gym'`
- `src/components/routines/RoutineModal.jsx` — two-screen modal: exercise list with reorder + expand to set sets/reps/weight; searchable exercise picker
- `src/pages/Plan.jsx` — Routines tab unlocked

### ✅ Step 3a — Gym session logging
- `src/hooks/useSessions.js` — addSession, deleteSession, sorted newest-first
- `src/components/log/GymLogSheet.jsx` — slide-up sheet; pre-fills from routine or exercise defaults; set-level reps/weight editing; difficulty selector (1–5); notes; produces canonical Session object
- `src/pages/Log.jsx` — gym log entry point

### ✅ Step 3b — History
- `src/components/log/SessionCard.jsx` — gym / climb / hangboard card variants
- `src/components/log/SessionDetailSheet.jsx` — slide-up detail; edit (gym only, opens GymLogSheet pre-filled) + delete with confirm
- `src/pages/History.jsx` — date-grouped feed, empty state
- `Session` schema extended: `routineId`, `routineName`, `SessionExercise.trackingType`
- `GymLogSheet` updated: stores `routineId`/`routineName`, accepts `initialSession` for edit mode
- `useSessions` updated: `updateSession(id, updates)`

### ✅ Step 3c — Climb log
- `src/components/log/ClimbLogger.jsx` — inline logger; discipline selector (stays selected), grade chips (resets after log), outcome buttons (tap = log), running climbs list with remove, session feel + notes + save
- `src/pages/Log.jsx` — restructured with Train/Climb/Hang mode switcher (segment control); Train wraps existing routines/exercises tabs + GymLogSheet unchanged
- `src/components/log/SessionCard.jsx` — ClimbCard derives discipline badge from individual climbs; handles mixed sessions ("Mixed" badge, purple)
- Mixed disciplines allowed per session; `session.discipline` = common discipline or null if mixed; grade system per climb (V/French)

### ✅ Step 4 — Hangboard timer
- `src/hooks/useHangRoutines.js` — CRUD for hangboard routines (type:'hangboard' filter)
- `src/components/routines/HangRoutineModal.jsx` — create/edit routines; grip list with expandable inline editor; two selects per grip: Fingers + Grip Type (matching original app); exports constants for reuse in Log
- `src/components/log/HangboardTimer.jsx` — full-screen timer; phase state machine (preview→ready→hanging→rep-rest→set-rest→done); Pause/Resume, Skip, End & Save, Discard; Web Audio API sounds (no files — oscillator synthesis); last-3-seconds warning ticks on both hang and rest phases; done screen with session feel + notes + date
- `src/pages/Plan.jsx` — Routines tab now grouped: Training (blue) / Hanging (purple) / Climbing coming soon (orange); inline "New" buttons per section; separate Hang tab removed
- `src/pages/Log.jsx` — Hang mode: Routines sub-tab + Free Hang sub-tab (inline grip/timing setup → timer)

### ✅ Step 5 — Dashboard
- Quick stats strip: weekly streak (with best record), sessions this week, total
- Training load card: ACWR-inspired acute/chronic comparison, zone labels, explainer text
- Activity calendar: monthly grid, prev/next nav, colour-coded by type, scheduled days in grey, collapsible
- Weight/BMI card: conditional on profile toggle, 30d trend
- Schedule notice: due today / next upcoming

### ✅ Step 5b — Profile, Weight Log & Schedule
- `useProfile`, `useWeightLog`, `useSchedule` hooks
- Profile tab in Plan: weight input → upserts today's weight log entry, BMI auto-calc, weight trend, goals, dashboard toggle
- Weight entries inline in History feed with edit/delete
- Schedule: up to 3 routines × days-of-week, lives in Routines tab, shown on dashboard calendar + notice
- Settings cog on Plan tab: Name + Height (rarely changed)

### ✅ Step 6 — AI Coach
- 5th nav tab (Coach, orange accent) with full chat UI
- 4 personas: Jonas Ridge, CrankMaster Chad, Dr Marina Sorel, Geoff — switchable, persisted
- Groq API (llama-3.3-70b-versatile) with inline key management
- Auto-builds session context from last 14 days + athlete profile
- Dashboard coach tip widget — daily cached one-liner, toggleable from Coach tab

### ⬜ Step 7 — Firebase
- Auth + Firestore sync
- `Storage` adapter is the only file that changes — designed for this swap

---

## Deferred ideas

- **Weight as % bodyweight** — when a non-zero weight is set on an exercise or routine, show a small inline note converting it to % of the athlete's bodyweight (e.g. "+10kg · 14% BW"). Requires athlete profile bodyweight to be set (`AthleteProfile.weightKg`). Display only — no new data stored. Good place: below the weight input in `ExerciseModal` and `RoutineModal`, and on the routine row summary line.

- **Climb session location (free text)** — add a nullable `session.location` string to climb sessions. Captured once at the ClimbLogger save screen (one input, optional). At save time, the location is denormalised onto every `Climb` object in the session — so each climb carries its location for analytics, even though the user only entered it once. This enables per-climb location comparisons: flash rate at Redpoint vs Depot, grade calibration across venues (sandbagged vs featherbagged), your consistent ceiling per centre. When Firebase launches, `session.location` (free text) maps to `session.centreId`, and the same centreId is stamped on each climb. Free-text string stays as display fallback for outdoor/unmatched sessions. Do this before Firebase — every session logged without it is permanently context-free.
