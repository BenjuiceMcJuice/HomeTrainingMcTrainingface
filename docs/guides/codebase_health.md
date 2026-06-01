# BetaLog — Codebase Health & Tidy-up Recommendations

Written: 2026-05-31. Based on a full read of the active `betalog-react/` source.

This is an honest audit, not a rewrite plan. The app works, ships, and has real users.
These are the friction points that will compound as the feature list grows.

---

## Priority 1 — Quick wins (low effort, high payoff)

### 1a. Add ESLint

**Why now:** The only quality gate is `npm run build`. ESLint catches real bugs (undefined
variables, missing deps in `useEffect`, wrong hook call order) that Vite silently ignores.
It also makes the ES5-vs-modern question explicit so you can decide once rather than
accidentally mixing styles.

**Effort:** ~30 mins. Install, configure, run once, fix the noisy stuff.

```bash
cd betalog-react
npm install -D eslint eslint-plugin-react eslint-plugin-react-hooks
```

Add a minimal `.eslintrc.cjs` — don't enable every rule, just `react-hooks/rules-of-hooks`
and `react-hooks/exhaustive-deps` to start. Those two alone prevent the most common class
of React bugs.

**Risk:** None. Doesn't change runtime behaviour.

---

### 1b. Nail down the JS style once

**Why now:** The codebase is currently `var` + `function(){}` everywhere, but it's React 18
with JSX — the ecosystem, docs, and every Stack Overflow answer assume modern JS. This creates
constant friction when reading examples or onboarding anyone new.

**The decision:** Pick one and stick to it. Recommendation: migrate to modern (`const`/`let`,
arrow functions, destructuring). The ES5 style was inherited from the vanilla app rewrite —
there's no runtime reason to keep it in a Vite/React project.

**Effort:** Medium. `Dashboard.jsx` alone has ~183 `var` declarations. Not a one-afternoon
job, but mechanical — no logic changes, just syntax. Do it file-by-file as you touch things
rather than a big-bang rewrite.

**Risk:** Low. ESLint (see 1a) will catch any slip-ups during migration.

---

## Priority 2 — Structural issues (medium effort, prevents future pain)

### 2a. Split Dashboard.jsx

**The problem:** 1,261 lines containing 17 top-level functions. It's a module pretending to be
a file. Adding a new widget means scrolling past unrelated code to find the right insertion
point. The file will reach 1,500+ lines within a few features.

**What's in there that shouldn't be:**

| Function(s) | Should live in |
|---|---|
| `daysAgo`, `weekStart`, `calcWeekSessions`, `calcLoad`, `getZone` | `src/lib/stats.js` (pure functions, no React) |
| `capitalise`, `fmtDuration`, `fmtDist`, `sessionDistKm` | `src/lib/utils.js` (currently 6 lines — meant for this) |
| `QuickStats`, `TrainingLoad`, `ActivityCalendar` | `src/components/dashboard/` |
| `WeightCard`, `LevelCard`, `GoalsWidget` | `src/components/dashboard/` |
| `CardioStatsCard`, `GymStatsCard`, `AlcoholFreeCard` | `src/components/dashboard/` |
| `CoachTip`, `CalorieBalanceCard`, `ScheduleNotice` | `src/components/dashboard/` |

**Suggested structure after split:**

```
src/
  lib/
    stats.js       ← absorb the pure calc functions from Dashboard
    utils.js       ← absorb fmtDuration, fmtDist, capitalise, sessionDistKm
  components/
    dashboard/
      QuickStats.jsx
      TrainingLoad.jsx
      ActivityCalendar.jsx
      WeightCard.jsx
      LevelCard.jsx
      GoalsWidget.jsx
      CoachTip.jsx
      CalorieBalanceCard.jsx
      AlcoholFreeCard.jsx
      CardioStatsCard.jsx
      GymStatsCard.jsx
      ScheduleNotice.jsx
  pages/
    Dashboard.jsx  ← imports + renders the above; should shrink to ~100 lines
```

**Effort:** Half a day. No logic changes — purely moving code around and fixing imports.
Do it in one commit so git history is clean (a pure rename/move commit is easy to revert).

**Risk:** Low. Vite's hot reload will surface any broken imports immediately.

---

### 2b. Split App.jsx

**The problem:** 743 lines containing three distinct concerns:

1. **Auth flow** — `LoginScreen`, `_googleTimer`, Google popup/redirect logic (~200 lines)
2. **Settings sheet** — `SettingsSheet`, `GroqKeyInput` (~300 lines)
3. **App root** — `DataContext`, routing, `App()` component (~200 lines)

**Suggested split:**

```
src/
  components/
    auth/LoginScreen.jsx        ← extracted from App.jsx
    layout/SettingsSheet.jsx    ← extracted from App.jsx (currently in layout/ already has Nav.jsx)
  App.jsx                       ← DataContext + App() only; should shrink to ~150 lines
```

**Effort:** 1–2 hours. Same mechanical move as Dashboard — no logic changes.

**Risk:** Low. `SettingsSheet` is already well-isolated (takes props in, fires callbacks out).

---

### 2c. Resolve the `utils.js` stub

`src/lib/utils.js` is 6 lines and essentially empty. Meanwhile `Dashboard.jsx` contains
`capitalise`, `fmtDuration`, `fmtDist`, and `sessionDistKm` — general-purpose helpers that
are duplicated or should be shared. Move them into `utils.js` when splitting Dashboard (2a).

---

## Priority 3 — Data integrity (lower urgency but worth knowing)

### 3a. Calorie estimates aren't stored on cardio sessions

**Current state:** `estimateCalories()` is called at *display time* in `SessionDetailSheet`.
If you change your logged weight later, the displayed burn estimate will silently change for
old sessions. The planned calorie balance widget (DEVLOG) also can't work without stored values.

**Fix:** Store `cardioKcalLow` + `cardioKcalHigh` on the session at save time in
`CardioLogSheet`. Use the most recent weight ≤ session date at that moment. Already specced
in DEVLOG — just needs implementing before the calorie balance widget is built.

---

### 3b. Multi-device sync has a silent conflict risk

**Current state:** localStorage is the source of truth. Firestore is pulled on login and
merged via `mergeFromCloud` — which keeps the *longer* array for list data (sessions, etc.)
and the *more recent* date for scalars.

**Edge case:** Log a session on mobile, then open the app on desktop before sync completes.
Both devices write to localStorage independently. When either syncs, the merge will keep
both session lists concatenated — which is usually fine. But edits (not adds) to an existing
session won't merge cleanly: last-write wins, and the "winner" is whichever device synced
last.

**Current risk level:** Low (one main user, mostly single-device). Worth documenting so
the fix is obvious if it ever bites: add a `updatedAt` timestamp to sessions and keep the
most-recent version on conflict rather than the current device-specific logic.

---

## Priority 4 — Longer term (don't rush these)

### 4a. Smoke tests for critical paths

No tests exist. For a personal app that's fine. If it ever goes to gym partners or a wider
audience, the minimum useful tests are:

- `stats.js` pure functions (grade calc, streak calc, calorie estimates) — these are
  testable without React and are the most likely source of silent regressions
- `storage.js` migration logic — `migrateData()` has run on real user data; a regression
  there is data loss

**Effort:** Medium. `vitest` is already in the Vite ecosystem — add it, write ~20 unit
tests for `stats.js`, and you have a meaningful safety net.

---

### 4b. Admin page security model needs finalising before building

The DEVLOG plans a `/admin` route gated by hardcoded UID. The Firestore rules change
needed (`allow read: if request.auth.uid == "ADMIN_UID"`) would give that UID unrestricted
read access to all user data.

Before building: decide whether to use a Firestore rule bypass (simple, but means the
admin UID has full read on production data) or a Cloud Function (more work, but auditable
and rate-limited). The Spark plan doesn't support Cloud Functions, so for now the UID-bypass
approach is the only viable option — just document that it's a known trade-off.

---

### 4c. Session location is missing and getting harder to retrofit

The DEVLOG flags this as deferred: `session.location` on climb sessions. Every session
logged without it is permanently context-free. The longer this stays deferred, the larger
the un-annotated dataset grows.

Not urgent, but if location-based analytics (grade calibration per venue, flash rate at
different walls) are genuinely wanted, this should be added before the user base grows
further.

---

## Summary table

| # | Item | Effort | Risk | Status |
|---|---|---|---|---|
| 1a | Add ESLint | 30 min | None | **Done** (2026-05-31) |
| 1b | Settle on modern JS style | Days (incremental) | Low | **Done** — Dashboard + App.jsx converted (2026-05-31) |
| 2a | Split `Dashboard.jsx` | Half day | Low | **Done** — 12 components extracted (2026-05-31) |
| 2b | Split `App.jsx` | 1–2 hrs | Low | **Done** — LoginScreen + SettingsSheet extracted (2026-06-01) |
| 2c | Fill `utils.js` | 30 min (part of 2a) | None | **Done** — barlow, daysAgo, fmtDuration, etc. added (2026-05-31) |
| 3a | Store calorie estimates at save time | 1 hr | Low | **Done** — already implemented in CardioLogSheet |
| 3b | Document multi-device conflict behaviour | 30 min | None | **Done** — described in this doc (§3b above) |
| 4a | Smoke tests for `stats.js` | Half day | None | **Done** — 43 vitest tests in `src/lib/__tests__/stats.test.js` (2026-06-01) |
| 4b | Decide admin page security model | Discussion | — | Deferred — Spark plan precludes Cloud Functions; UID-bypass is the only viable approach, documented as a known trade-off |
| 4c | Add `session.location` to climb sessions | 2 hrs | Low | **Done** — already implemented in ClimbLogger |

---

*This doc lives at `docs/guides/codebase_health.md`. Update it as items are completed.*
