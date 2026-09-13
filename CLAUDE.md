# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**BetaLog** is a climbing training PWA — logs boulder, lead, top rope, gym, and hangboard sessions; tracks grade progression; runs hangboard timers; provides an AI coach via Groq API; syncs data via Firebase; and has a friends system with climbing level comparison. Live at `betalog.co.uk` (Cloudflare Pages).

## Active Codebase

**The React app in `betalog-react/` is the active codebase.** All development happens here.

The vanilla `index.html` in the repo root is legacy — it was the original app but is no longer actively developed. Do not modify it unless explicitly asked.

## Tech Stack

- **React 18** + **Vite** + **Tailwind v4**
- **Firebase** — Auth (Google + email/password) + Firestore (cloud sync, friends)
- **Groq API** — AI coach (user-supplied key)
- **Cloudflare Pages** — hosting, auto-deploys from `main`
- **Vitest** — unit tests for the pure functions in `src/lib` (`npm test`). ESLint is configured (`npm run lint`). No CI pipeline — run them locally before merging.

## Development

```
cd betalog-react
npm run dev          # Vite dev server, hot reload
npm run build        # Production build (run before committing to check for errors)
npm test             # Vitest unit tests (src/lib/__tests__)
```

See `docs/guides/betalog_sdlc.md` for the full dev → test → deploy workflow.

## Branches

Work flows in one direction: **feature branch → `main`**.

- **`main`** — production, and the only long-lived branch. Every push auto-deploys to betalog.co.uk via Cloudflare Pages, so **a merge into `main` is a live release**. Nothing is committed here directly.
- **Feature branches** — where the work happens. Short-lived, branched off `main`, one per piece of work. Cloudflare builds a preview deploy for every branch, so a change can be checked on a real URL before it is released. Cloud sessions (Claude Code on the web) get a `claude/<description>` branch automatically; on the laptop, name it however you like. Delete the branch once merged.

**Never commit or develop directly on `main`.** Build the change on a feature branch, verify it on that branch's preview deploy, then merge. Because the merge *is* the release, the pre-merge checklist in `docs/guides/betalog_sdlc.md` is the gate — `npm run build`, `npm test` and `npm run lint` must pass, the change must be verified running, **and `BACKLOG.md` must be updated in the same commit** — close the row you finished, open a row for anything you found and are not fixing. **If the change makes a spec's status line wrong, fix that too, in the same commit.** A spec saying *specced, not built* about something that shipped is the same drift that put six wrong claims into these docs on 2026-09-12; the cheapest time to catch it is while you still know what you changed.

**The version number is the milestone number.** `package.json` `version` (shown in Settings as *Version*) is bumped **only when a `DEVLOG.md` milestone entry lands** — minor for a milestone, major when the product changes shape — never per release; the cache name already counts releases and the build hash already identifies the deploy. `npm version <x.y.z> --no-git-tag-version` in `betalog-react/`, in the same commit as the DEVLOG entry. It sat at 0.0.0 from the rewrite until 2026-09-13, which is the drift this rule exists to stop. 1.0.0 is *the grade pyramid is finished*.

### When to merge without asking

A merge into `main` is a live release, so the decision to merge is not automatic. Two cases:

- **Something is broken → fix it and merge.** No need to ask. This covers anything already failing or
  wrong in production: a dead API call, a miscounted figure, a control that renders blank, a crash.
  Restoring intended behaviour is not a change to the product. Verify it (build, tests, lint, and the
  running app where it is user-visible), merge, and say what shipped.
- **Anything new, or any change to a screen that already works → stop at the branch.** Build it,
  verify it, push the branch, then present it and *wait for an explicit instruction to merge*. This
  covers new features, restructures, moved or renamed UI, and refactors with any visible effect —
  even when a spec already sanctions them. Approval to *start* work is not approval to release it.

Documentation-only changes follow the first case. When it is genuinely unclear which side something
falls on, ask — the cost of asking is one message, the cost of an unwanted release is a live change
nobody chose.

**Retired branches** — `preprod`, `betalog-react` and `betalog-dev`. Don't check them out or push to them. A three-stage `feature → preprod → main` flow was documented on 2026-08-10 and never once used; it was dropped on 2026-08-20 in favour of the two-stage flow that had been the real practice all along. The reasoning is recorded in the SDLC guide.

## File Structure

```
betalog-react/                 The active React app
  src/
    App.jsx                    Root component, auth, data context, settings sheet
    main.jsx                   Entry point, service worker registration
    lib/
      firebase.js              Firebase config
      storage.js               All localStorage + Firestore access
      stats.js                 Shared pure functions: grade stats, streaks, levels, public profile
      pyramid.js               Grade pyramid model — tiers, readiness, base/working/project
      goals.js                 The one reader for "what grade you are" (currentReading) + goal progress
      types.js                 JSDoc typedefs for all data shapes
      defaultExercises.js      89 seeded exercises
      defaultRoutines.js       12 seeded climbing routines
    hooks/
      useSessions.js           Session CRUD
      useExercises.js          Exercise CRUD + seeding
      useRoutines.js           Routine CRUD
      useProfile.js            Athlete profile read/write
      useWeightLog.js          Weight log CRUD
      useSchedule.js           Training schedule
      useFriends.js            Friend codes, add/remove, profile fetching
      useGoals.js              Goal CRUD + auto-achieve
      useDrinkLog.js           Drink log CRUD
      useWeekScores.js         Sealed weekly Shameometer scores
      useCalendarFeed.js       Calendar feed token (Route A)
      usePush.js               Web push subscription (Route B)
      useHangRoutines.js       Hangboard routine CRUD
      useWidgetWindow.js       Per-widget timeframe, persisted in the profile
    pages/
      Dashboard.jsx            Quick stats, training load, level widgets, calendar
      Log.jsx                  Session logging (Train/Climb/Hang/Cardio/Health modes)
      History.jsx              Date-grouped session feed
      Plan.jsx                 Tabs: Goals, Schedule, Routines, Exercises (opens on Goals)
      Coach.jsx                AI coach with 4 personas
    components/
      layout/Nav.jsx           Bottom nav (mobile) + top nav (desktop)
      dashboard/               Widget cards, WidgetShell (collapse), WidgetPicker (edit mode)
      friends/FriendsSheet.jsx Slide-up friends sheet
      log/                     GymLogSheet, ClimbLogger, HangboardTimer, etc.
      routines/                RoutineModal, HangRoutineModal, ScheduleCard
      schedule/CalendarReminders.jsx  Calendar feed setup (Plan > Schedule)
      schedule/PushReminders.jsx      Web push setup (Plan > Schedule)
      goals/GoalsSection.jsx   Goals — the whole of Plan > Goals
      exercises/               ExerciseModal
      ui/                      NumericStepper, shared components
  public/
    manifest.json              PWA manifest
    sw.js                      Service worker
    icon.svg                   App icon
  firestore.rules              Firestore security rules (deploy via Firebase CLI)
  firebase.json                Firebase CLI config
  .firebaserc                  Firebase project link (betalog-340b3)

workers/                       Cloudflare Workers — deployed separately via wrangler,
  betalog-calendar/            NOT by a Cloudflare Pages build. Serves the .ics feed (Route A)
  betalog-push/                Web push sender, KV + cron trigger (Route B)

index.html                     LEGACY — vanilla app, no longer actively developed
DEVLOG.md                      Milestone tracker (read this first in any new session)
logs/YYYY-MM-DD.md             Daily work logs
docs/
  specs/                       Data models, feature specs, migration specs
  guides/                      SDLC, deployment, Firebase setup
  strategy/                    Vision, partner overview
  archive/                     Obsolete docs (vanilla-era)
```

## Architecture

### Data Flow

`Storage.load()` reads all localStorage keys with migration on load → `DataContext` provides `{ data, setData }` to all components → hooks (`useSessions`, `useExercises`, etc.) wrap `setData` with domain logic → every `setData` call also triggers `Storage.syncToFirestore(userId)` in the background.

### Key Patterns

- **ES5 style** in most files: `var`, `function(){}`, `Object.assign`. Match this in new code.
- **Slide-up sheets** for modals (SettingsSheet, FriendsSheet, GymLogSheet pattern): fixed overlay + white rounded panel from bottom.
- **Hooks own domain logic**: each `use*.js` hook manages one data type. Components call hook methods, never touch Storage directly.
- **`stats.js` is pure**: no React imports. Safe to use from `storage.js` without circular dependencies.

### Firebase

- Project: `betalog-340b3` (Spark/free plan, europe-west2)
- Auth: Google sign-in + email/password
- Firestore: `users/{userId}` for main data, `users/{userId}/public/profile` for friend-visible data, `friendCodes/{code}` for friend code lookups
- Rules deployed via: `cd betalog-react && firebase deploy --only firestore:rules`

## Backlog, dev log and daily logs

**Status lives in exactly one file: `BACKLOG.md`.** Everywhere else — this file, the doc index
below, every spec — describes what a thing *is*, never what state it is in. A spec says what it
specifies; whether it is built is a backlog row or a DEVLOG entry. That rule is the
[Benjuicey Apps backlog standard](https://github.com/BenjuiceMcJuice/Benjuicey-apps/blob/main/docs/backlog-standard.md),
and it was written after an audit here on 2026-09-12 found six standing claims wrong at once,
two of them hiding live problems — all six caused by one fact being written in three places.

| File | Answers |
|---|---|
| `BACKLOG.md` | What is still outstanding, who can do it, what it is blocked on |
| `DEVLOG.md` | What happened and why — narrative, newest first, never a to-do list |
| `logs/YYYY-MM-DD.md` | What happened today, in detail |

Three-tier logging system:

**`DEVLOG.md`** — milestone tracker. One entry per completed step/feature. Read this at the start of a new session.

**`logs/YYYY-MM-DD.md`** — daily work log. Granular: what was built, files changed, key decisions.

Rules:
- Update today's log file **as you go** — after each meaningful change, not at the end of the session
- Create the log file at the start of the day's work if it doesn't exist yet
- Only update `DEVLOG.md` when a milestone is complete
- At the start of any new session, read `DEVLOG.md` first, then the most recent log file

## Documentation Index

*Purpose only — build status is not recorded here, it is in `BACKLOG.md`.*

| File | Status | Purpose |
|---|---|---|
| `BACKLOG.md` | **CURRENT** | Everything outstanding — read first in any session |
| `DEVLOG.md` | **CURRENT** | What happened and why — read second |
| `docs/guides/betalog_sdlc.md` | **CURRENT** | Dev → test → deploy workflow |
| `docs/guides/betalog_deployment.md` | **CURRENT** | Cloudflare Pages setup and deployment guide |
| `docs/guides/betalog_firebase_setup.md` | **CURRENT** | Firebase project setup steps |
| `docs/strategy/betalog_vision.md` | **CURRENT** | Product strategy, gym partnership model, feature roadmap |
| `docs/strategy/betalog_partner_overview.md` | **CURRENT** | Gym partner sales/positioning doc |
| `docs/specs/betalog_data_model.md` | **CURRENT** | Canonical data schema for all types |
| `docs/specs/betalog_goals_spec.md` | **CURRENT** | Goals — built, the whole of Plan > Goals |
| `docs/specs/betalog_data_honesty_spec.md` | **CURRENT** | What the app may claim from a log — describes the log, never the climber. A copy/readout standard, sharpest for coach-facing views. No code |
| `docs/specs/betalog_grade_pyramid_spec.md` | **CURRENT** | Grade pyramid — the model that replaces the single consistent-grade reading. §9a is the build order, §9b the open questions |
| `docs/specs/betalog_health_log_spec.md` | **CURRENT** | Health log — built, weight + alcohol on Log > Health |
| `docs/specs/betalog_cardio_spec.md` | **CURRENT** | Cardio sessions — built, Log > Cardio |
| `docs/specs/betalog-calorie-tracking-spec.md` | **CURRENT** | MET-based cardio calorie estimates — built |
| `docs/specs/betalog_reminders_spec.md` | **CURRENT** | Schedule reminders — Route A (calendar feed) and Route B (web push), and how they deploy |
| `docs/specs/betalog-custom-cardio-idea.md` | **IDEA** | Custom cardio activity types — not specced out |
| `docs/specs/betalog_default_routines.md` | **CURRENT** | Default climbing routine specs |
| `docs/specs/data_migration.md` | **CURRENT** | localStorage migration spec (vanilla → React) |
| `docs/specs/betalog_privacy_spec.md` | **CURRENT** | Privacy policy spec + draft copy |
| `docs/specs/betalog_activity_help_spec.md` | **CURRENT** | Activity sessions, help page & feedback spec |
| `docs/specs/betalog_widget_system_spec.md` | **CURRENT** | Dashboard widget consistency — anatomy, timeframes, charts, calendar |
| `docs/specs/betalog_shameometer_spec.md` | **CURRENT** | Weekly Shameometer dial — training + schedule + alcohol score, plus the sealed week log |
| `docs/specs/betalog_ia_declutter_spec.md` | **CURRENT** | IA declutter — the Plan tab structure and where each widget lives |
| `docs/archive/betalog_technical.md` | **OBSOLETE** | Describes vanilla app architecture (v4.3). Superseded by this file. |
| `docs/guides/betalog_react_setup.md` | **OBSOLETE** | Initial React scaffold guide. Project has evolved past this. |
| `docs/guides/betalog_pwa.md` | **OBSOLETE** | PWA setup notes — PWA is now implemented in betalog-react/public/. |
| `docs/specs/step3_gym_session_logging.md` | **OBSOLETE** | Completed step spec. Implementation is in the code. |

## Gotchas

- **Firebase config is in source code** (`src/lib/firebase.js`). This is intentional — Firebase client keys are public by design. Security is enforced by Firestore rules, not key secrecy.
- **`stats.js` must not import from React components or hooks** — it's imported by `storage.js` which is imported by hooks. Circular dependency if this rule is broken.
- **Friend codes are time-boxed** (24h). Format: `BL-XXXXX-DDMMYY`. Old permanent codes show as expired.
- **Service worker** (`public/sw.js`) uses cache-first for app assets, network-first for API calls. Hard refresh (Ctrl+Shift+R) bypasses it during testing.
