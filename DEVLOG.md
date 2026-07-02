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
| 2026-03-27 | Step 7 — Firebase auth + sync      | ✅ Done |
| 2026-03-27 | Step 8 — Friends & leaderboard     | ✅ Done |
| 2026-05-16 | Hangboard UX — grip diagram + inter-grip timer | ✅ Done |
| 2026-05-19 | Firebase auth iOS fixes — popup hang, standalone detection | ✅ Done |
| 2026-05-19 | Friends leaderboard — FriendsScreen with discipline toggle, detail view | ✅ Done |
| 2026-05-20 | Friends cards — peak primary, 90d secondary, leaderboard redesign | ✅ Done |
| 2026-05-22 | Cardio session type (swim/run/cycle/row/walk/yoga) | ✅ Done |
| 2026-05-27 | Gym log: add/remove sets per exercise during logging | ✅ Done |
| 2026-05-27 | Friends detail: All Time / Last 90 Days toggle + Proj/Flash sub-row | ✅ Done |
| 2026-05-29 | Health log — drink tracking, alcohol-free streak, calorie estimates | ✅ Done |
| 2026-05-29 | Gym stats + Cardio stats dashboard widgets | ✅ Done |
| 2026-05-29 | Cardio session editing + History audit | ✅ Done |
| 2026-05-29 | Climbing grade row switched to 90d data | ✅ Done |
| 2026-05-29 | Calorie balance widget (cardio burned vs drink kcal) | ✅ Done |
| 2026-05-29 | Sport cardio tile — replaces Yoga, 32 sports with MET-based calorie calc | ✅ Done |
| 2026-06-01 | Goals embedded into widgets — grade/weight/cardio goal progress bars in LevelCard/WeightCard/CardioStatsCard; CalorieBalance widget removed | ✅ Done |
| 2026-06-01 | Grade goal display — 90d current form + 90d send count at target grade, replaces meaningless 0%/100% bar | ✅ Done |
| 2026-06-02 | Weight edit decimal entry fix — NumericStepper now supports direct decimal input for fractional steps | ✅ Done |
| 2026-06-02 | Bug fix sweep (8 issues) — calorie MET bounds, empty date guard, negative distance guard, goal achievement deps, legacy weight key migration, friend code retry loop, sync debounce + no re-parse on write, Firebase error surfacing | ✅ Done |
| 2026-06-02 | Calorie calculator overhaul — corrected swim MET values (Compendium), stamp-on-save (no retro recalc), pace-based MET for run/cycle/row/walk, distance-based kcal/m for swimming (Pendergast 1977) | ✅ Done |
| 2026-07-02 | RGP integration & retention strategy — `docs/strategy/betalog_rgp_integration.md`: RGP API review, Cloudflare Worker sync architecture, rewards engine, coaching revenue, GDPR; vision + partner overview updated | ✅ Done |

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

### ✅ Step 7 — Firebase
- Firebase project `betalog-340b3` (Spark plan, europe-west2)
- Auth: Google sign-in + email/password, login screen, sign-out in Settings
- Firestore sync: write on every save, pull on login, merge cloud → local
- Security rules: user-scoped read/write (`users/{userId}`)
- `Storage` adapter extended with `syncToFirestore`, `pullFromFirestore`, `mergeFromCloud`
- `setDataAndSync` wrapper ensures all hook saves trigger cloud sync

### ✅ Step 8 — Friends
- Friend codes: unique `BL-XXXXX` per user, stored in `friendCodes/{code}` index
- Add/remove: bidirectional linking via friend code entry
- Public profile: `users/{userId}/public/profile` — displayName, boulder/rope levels, streak, recent sessions
- Friends sheet: slide-up from header Users icon — code display, add input, friend cards with stats
- Firestore rules: public profile only readable by friends, friend code index readable by any auth user
- Refactored grade/streak logic into `src/lib/stats.js` (shared by Dashboard, ClimbingStats, storage sync)

---

## ⬅️ NEXT — Step 9: Buddy Comparison & Friend Activity

### Buddy comparison
Tap a friend card in FriendsSheet → slides into a side-by-side comparison view (same sheet, new panel). Left column = you, right column = them. Compares: consistent grade, peak, flash, 90d current (boulder + rope), streak, session volume, discipline breakdown. All data already available from public profiles — no new Firestore reads. Back arrow returns to friend list.

### Friend activity feed on Dashboard
- **Follow toggle** (bell icon) on each friend card in FriendsSheet — stored in localStorage, no Firestore change needed
- **On app load**, for each followed friend, fetch public profile and compare latest session date against a `lastSeenPerFriend` localStorage key
- **Dashboard "Friend Activity" card** showing new sessions since last visit, e.g.:
  - "Jamie — 5 boulder climbs, topped V6 · 3h ago"
  - "Sarah — 8 rope climbs, topped 7a · yesterday"
  - "Mike — Hangboard, 4 grips · 2d ago"
- Tapping an entry opens the buddy comparison view
- **Enrich public profile `recentSessions`** — add `topGrade` per session so the dashboard card can show it
- **Seen marker** — once dashboard is viewed, mark updates as seen so they don't repeat
- No Firestore real-time listeners (keeps Spark plan costs at zero). Lightweight poll on app open only.

### Expand public profile
Add to `recentSessions` entries: `topGrade` (highest grade in that session). Add `sessionsThisWeek`, `sessionsThisMonth`, `totalSessions` counts for the comparison view.

---

## ✅ Dashboard widget fixes — 2026-05-29

- Goals widget now toggleable in Plan → Profile (added to `WIDGET_OPTS`, wrapped in `showWidget('goals')`)
- WeightCard shows active weight goal target + distance to go (Goal: X kg · Y.Y kg to lose/gain/on target)
- Removed stale `showWeightOnDash` legacy guard from `WeightCard`
- MAX_WIDGETS raised 4 → 5

## ✅ Health Log — 2026-05-29

- `DrinkEntry` type + `drinkLog` key in `types.js` and `storage.js` (load, save, SYNC_KEYS, mergeFromCloud)
- `useDrinkLog.js` hook (addEntry computes UK units, deleteEntry, sorted newest-first)
- `calcAlcoholFreeStreak` in `stats.js` — counts consecutive alcohol-free days from today backwards
- `DrinkLogSheet.jsx` — slide-up sheet: type chips (Beer/Cider, Wine, Spirit, Other), quantity stepper (0.5 steps), volume + ABV inputs, live units preview (green/amber/red), note, date
- **Health tab** added to Log page — weight section (log/update today's weight) + alcohol section (today's drinks list + Add drink button)
- **AlcoholFreeCard** dashboard widget — days → weeks → months display, green Droplets icon, toggleable
- `Alcohol-free streak` added to `WIDGET_OPTS` in ProfileTab
- Drink entries appear inline in History feed (DrinkRow with Droplets icon + units colour-coded + delete)


## ✅ Firestore user audit — 2026-05-29

**Report:** `docs/ops/firestore_user_audit_2026-05-29.md`

- 19 user docs total; 10 ghost accounts (signed in, no data)
- 1 confirmed real external user: Dave of Knowle West (2 climb sessions, last 2026-05-20)
- "Another tester" (3 climb sessions to 2026-05-19) — identity unknown, worth asking
- All external sessions are climb-only; nobody outside Steve has tried gym/hang/goals/AI coach
- Steve's main account: 40 sessions, 14 weight entries, 3 goals, last active 2026-05-28
- Spark plan usage well within free limits at current scale
- Onboarding drop-off: 53% of sign-ups bounced with no data logged

---

## ✅ Calorie burn estimates for cardio sessions — 2026-05-29

**Spec:** `docs/specs/betalog-calorie-tracking-spec.md`

- MET tables added to `stats.js`: `MET_SWIM` (5 strokes × 3 effort bands), `MET_CARDIO` (swim/run/cycle/row/walk)
- `getMETRange(activity, strokeType, effort)` — returns `{ low, high }` MET values for the effort band
- `estimateCalories(metRange, weightKg, durationMins)` — returns `{ low, high }` kcal range
- `cardioStrokeType` field added to `Session` typedef and saved in `CardioLogSheet`
- Stroke type chip selector added to CardioLogSheet (Swim only): General / Breaststroke / Front Crawl / Backstroke / Butterfly
- `SessionDetailSheet` — `CardioDetail` looks up most recent weight ≤ session date via `useWeightLog`, computes and displays kcal range as "Est. Burn ~X–Y kcal"; stale weight (>14 days) shows warning icon; no weight → prompt to log in Health tab
- Stroke type displayed inline in the Activity chip when non-general

## ✅ Drink calories — 2026-05-29

- `kcal` field added to `DrinkEntry` typedef (derived, stored not re-derived)
- Formula: `units × 56 × multiplier` — multiplier: beer/cider 1.4, wine 1.15, spirit/other 1.0
- `useDrinkLog.addEntry` computes and stores `kcal` on every new entry
- `AlcoholFreeCard` on Dashboard now shows "this week: ~X kcal from drinks" sub-line (last 7 days; only shown when at least one entry has kcal — backward-compatible with old entries)

---

## ✅ Codebase health audit + tidy-up — 2026-06-01

Full audit of the React codebase. Produced `docs/guides/codebase_health.md` with 10 prioritised items. All actionable items completed same session.

- **ESLint** — installed, configured, 53 errors → 0 errors (13 acceptable HMR warnings remain)
- **JS style** — Dashboard.jsx and App.jsx converted to modern JS (`const`/`let`, arrow functions) as part of splits below
- **Dashboard.jsx split** — 1261 lines → 78 lines; 12 components extracted to `src/components/dashboard/`
- **App.jsx split** — 743 lines → 110 lines; `LoginScreen` → `src/components/auth/`, `SettingsSheet` → `src/components/layout/`
- **utils.js** — filled out with `barlow`, `daysAgo`, `capitalise`, `fmtDuration`, `fmtDist`, `sessionDistKm`, `jsToScheduleDay`
- **Vitest smoke tests** — 43 tests for all pure functions in `stats.js`; `npm test` added as a script
- Confirmed `CardioLogSheet` already stores `cardioKcalLow`/`cardioKcalHigh` at save time (P3a was pre-done)
- Confirmed `ClimbLogger` already captures `session.location` (P4c was pre-done)
- Admin security model documented as known Spark-plan trade-off (no Cloud Functions available)

---

## Planned — Admin page (spec TBD)

A private `/admin` route accessible only to a hardcoded admin UID (benjuice/Steve's Firebase UID). Lets the admin browse user data without going into the Firebase Console directly.

**Rough scope (to be specced):**
- Route guard: check `currentUser.uid === ADMIN_UID`, redirect home if not
- User list: display name, email, session count, last active date, grade level
- User detail: drill into a specific user's full data — sessions, weight log, goals, friend connections
- Usage summary: total users, MAU (monthly active), DAU, top grades across the user base
- Useful for: spotting bugs in real data, understanding how features are actually used, onboarding gym partners

**Notes:**
- All data already exists in Firestore under `users/{uid}` — admin page just needs elevated read access
- Firestore rules will need an admin bypass rule: `allow read: if request.auth.uid == "ADMIN_UID"`
- Keep it simple and internal — no fancy UI needed, just readable tables

---

## Planned — Dashboard widget expansion + 90-day window

### Drink calories — ✅ Done 2026-05-29
`kcal` on DrinkEntry + weekly sub-line on AlcoholFreeCard (Widget option A). See completed milestone above.

### Cardio widget
A dashboard card for cardio activity — similar feel to the climbing level cards.
- Shows last 90 days: total cardio sessions, breakdown by type (swim/run/cycle etc.)
- Key stats per dominant activity: total distance or duration, e.g. "8 swims · 14.2 km"
- Toggleable via `WIDGET_OPTS` key `cardioStats`
- Implementation: pure derived from `sessions` filtered to `type === 'cardio'` and last 90 days

### Gym/exercise widget
A dashboard card for gym training — parallel to the cardio widget.
- Shows last 90 days: gym session count, total sets logged, most-trained muscle group
- e.g. "12 sessions · 186 sets · Back heavy"
- Toggleable via `WIDGET_OPTS` key `gymStats`
- Implementation: filter `sessions` to `type === 'gym'`, aggregate exercise categories

### 90-day window for all widgets
Currently the training load, level cards, and other widgets use a mix of all-time and rolling windows.
Proposal: make the **default recency window for all stat-based widgets 90 days**, with "all-time peak" shown as secondary where relevant (climbing cards already do this).

- Training load: already uses 7d acute / 30d chronic — keep as-is (it's a relative metric)
- Climbing level cards: already show 90d current + all-time peak — keep as-is
- Gym/cardio widgets (new): 90d by default
- Goals widget: not time-windowed (shows active goals regardless) — keep as-is
- Alcohol-free streak: by definition rolling from today — keep as-is
- Coach tip: not time-windowed — keep as-is

**Action when implementing gym/cardio widgets:** use `filterSessionsByDays(sessions, 90)` as the default input. No changes needed to existing widgets.

### Boulder widget — 90d secondary level not updating (RESOLVED — not a bug)
Investigated 2026-05-29 via Firestore REST query on the test account (vfipIiWIrIWKXOM1YnUvOdjIDu32). All boulder sessions for this account were within the last 90 days — so all-time and 90d stats are identical. The `samePeak` check in `LevelCard` correctly suppresses the 90d tag when both produce the same level. Working as designed. The tag only appears when all-time and 90d diverge (e.g. an old high-water mark is outside the 90d window).

### Rope widget — 90d data not appearing (RESOLVED — working correctly)
Same account: rope data spans 2026-02-04 (7a+, 7a — outside 90 days) and 2026-05-29 (6a, 6a+, 6b — inside 90 days). All-time includes the 7a+ sessions; 90d only sees the 6a/6a+ data. Different underlying grades → `samePeak` is false → 90d tag shows as "Intermediate | 90d Intermediate". Both widgets working correctly. The rope tag appearing while the boulder tag is hidden is explained entirely by data distribution across the 90d boundary.

### Climbing level cards — Project/Consistent/Flash row is all-time only
Currently the level cards show all-time peak as primary + 90d level as secondary (only when different). However the **Project / Consistent / Flash grade row beneath is always all-time** — it doesn't reflect recent form. Consider switching that row to 90d data so it shows what you're actually climbing right now, with all-time grades moved to a secondary/tooltip position. Decision needed: does "Project V7" mean your all-time project or what you're projecting this season? Lean towards 90d for the grade row to match the "current fitness" intent of the widget.

---

## Planned — Calorie balance view (cardio burns vs drink intake)

Make calorie data comparable across activity types so it's easy to see the full picture — and so Groq can analyse it.

**Concept:** calories burned (cardio sessions) vs calories consumed (alcohol). Eventually expandable to food/nutrition if that's ever added.

**Data already available:**
- Cardio sessions: `estimateCalories` returns `{ low, high }` kcal burn range — not yet stored on the session, only computed on display
- Drink entries: `kcal` stored at log time

**Implementation steps:**
1. **Store kcal estimate on cardio sessions** — add `cardioKcalLow` + `cardioKcalHigh` to Session. Compute at save time in `CardioLogSheet` using `getMETRange`/`estimateCalories` + most recent weight at that date. Requires weight lookup at save time (pull from `useWeightLog`). If no weight, store null. Re-computation can happen if weight is logged retroactively (probably not worth the complexity — just store at log time and show a "—" if missing).
2. **Weekly calorie balance widget** — a dashboard card showing last 7 days:
   - Burned: sum of `cardioKcalLow`–`cardioKcalHigh` across cardio sessions (show midpoint or range)
   - Consumed (drinks): sum of `drinkEntry.kcal`
   - Balance: burned − consumed (positive = net burn)
   - Toggleable via `WIDGET_OPTS` key `calorieBalance`
3. **Groq context** — include weekly calorie balance in the coach context object so it can factor in energy availability, recovery, and training readiness.

**Notes:**
- Accuracy is directional, not medical-grade — same caveat as current kcal range display
- Food logging is out of scope; this is purely activity + alcohol
- Could expand to show a simple bar chart (calories in vs out per day over 7 days) as a future enhancement

---

## Planned — Groq coach focus mode

Currently the AI coach always analyses the full picture (climbing, gym, cardio, health). Add a focus selector so the user can direct the coach's attention to a specific area.

**Focus options:**
- **Climbing** (default) — grade progression, technique, project tips, climb-specific training
- **Exercise** — gym session volume, muscle balance, strength trends, routine suggestions
- **Cardio** — swim/run/cycle distance/duration trends, effort distribution, improvement tips
- **Health** — weight trend, alcohol units, calorie balance, sleep/recovery cues (available data only)
- **Summary** — full overview across all areas, highest-level weekly/monthly snapshot

**Implementation:**
- Add a focus tab strip or chip selector at the top of the Coach page (above the persona selector, or replace the current persona strip layout)
- `buildContext()` in `Coach.jsx` already assembles the data object passed to Groq — add a `focus` param that:
  - Trims the context to the relevant data slice (e.g. cardio focus only sends cardio sessions + weight)
  - Prepends a focus instruction to the system prompt: e.g. "Focus your analysis on the user's cardio training. Other data is provided for context only."
- Default focus = 'climbing' (no behaviour change for existing users)
- Persist the last-used focus in `profile.coachFocus` so it's remembered across sessions

---

## Deferred ideas

- **Weight as % bodyweight** — when a non-zero weight is set on an exercise or routine, show a small inline note converting it to % of the athlete's bodyweight (e.g. "+10kg · 14% BW"). Requires athlete profile bodyweight to be set (`AthleteProfile.weightKg`). Display only — no new data stored. Good place: below the weight input in `ExerciseModal` and `RoutineModal`, and on the routine row summary line.

- **Climb session location (free text)** — add a nullable `session.location` string to climb sessions. Captured once at the ClimbLogger save screen (one input, optional). At save time, the location is denormalised onto every `Climb` object in the session — so each climb carries its location for analytics, even though the user only entered it once. This enables per-climb location comparisons: flash rate at Redpoint vs Depot, grade calibration across venues (sandbagged vs featherbagged), your consistent ceiling per centre. When Firebase launches, `session.location` (free text) maps to `session.centreId`, and the same centreId is stamped on each climb. Free-text string stays as display fallback for outdoor/unmatched sessions. Do this before Firebase — every session logged without it is permanently context-free.
