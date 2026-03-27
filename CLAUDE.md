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
- No tests, no linting, no CI pipeline

## Development

```
cd betalog-react
npm run dev          # Vite dev server, hot reload
npm run build        # Production build (run before committing to check for errors)
```

See `betalog_sdlc.md` for the full dev → test → deploy workflow.

## Branches

- **`main`** — production. Auto-deploys to betalog.co.uk via Cloudflare Pages on push.
- **`betalog-react`** — active development. All new work happens here.

**Never commit code directly to `main`.** All work goes through `betalog-react`, tested, then merged.

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
    pages/
      Dashboard.jsx            Quick stats, training load, level widgets, calendar
      Log.jsx                  Session logging (Train/Climb/Hang modes)
      History.jsx              Date-grouped session feed
      Plan.jsx                 Exercises, routines, schedule, profile, climbing stats
      Coach.jsx                AI coach with 4 personas
    components/
      layout/Nav.jsx           Bottom nav (mobile) + top nav (desktop)
      friends/FriendsSheet.jsx Slide-up friends sheet
      log/                     GymLogSheet, ClimbLogger, HangboardTimer, etc.
      routines/                RoutineModal, HangRoutineModal, ScheduleCard
      exercises/               ExerciseModal
      profile/                 ProfileTab, ClimbingStats
      ui/                      NumericStepper, shared components
  public/
    manifest.json              PWA manifest
    sw.js                      Service worker
    icon.svg                   App icon
  firestore.rules              Firestore security rules (deploy via Firebase CLI)
  firebase.json                Firebase CLI config
  .firebaserc                  Firebase project link (betalog-340b3)

index.html                     LEGACY — vanilla app, no longer actively developed
betalog_vision.md              Product strategy and feature roadmap
betalog_sdlc.md                Dev → test → deploy workflow
betalog_deployment.md          Cloudflare Pages setup guide
betalog_data_model.md          Canonical data schema (source of truth)
betalog_firebase_setup.md      Firebase project setup guide
DEVLOG.md                      Milestone tracker (read this first in any new session)
logs/YYYY-MM-DD.md             Daily work logs
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

## Dev Log

Two-tier logging system:

**`DEVLOG.md`** — milestone tracker. One entry per completed step/feature. Read this at the start of a new session.

**`logs/YYYY-MM-DD.md`** — daily work log. Granular: what was built, files changed, key decisions.

Rules:
- Update today's log file **as you go** — after each meaningful change, not at the end of the session
- Create the log file at the start of the day's work if it doesn't exist yet
- Only update `DEVLOG.md` when a milestone is complete
- At the start of any new session, read `DEVLOG.md` first, then the most recent log file

## Documentation Index

| File | Status | Purpose |
|---|---|---|
| `DEVLOG.md` | **CURRENT** | Milestone tracker — read first in any session |
| `betalog_sdlc.md` | **CURRENT** | Dev → test → deploy workflow |
| `betalog_deployment.md` | **CURRENT** | Cloudflare Pages setup and deployment guide |
| `betalog_vision.md` | **CURRENT** | Product strategy, gym partnership model, feature roadmap |
| `betalog_data_model.md` | **CURRENT** | Canonical data schema for all types |
| `betalog_firebase_setup.md` | **CURRENT** | Firebase project setup steps |
| `betalog_default_routines.md` | **CURRENT** | Default climbing routine specs |
| `betalog_partner_overview.md` | **CURRENT** | Gym partner sales/positioning doc |
| `data_migration.md` | **CURRENT** | localStorage migration spec (vanilla → React) |
| `betalog_technical.md` | **OBSOLETE** | Describes vanilla app architecture (v4.3). Superseded by this file. |
| `betalog_react_setup.md` | **OBSOLETE** | Initial React scaffold guide. Project has evolved past this. |
| `betalog_pwa.md` | **OBSOLETE** | PWA setup notes — PWA is now implemented in betalog-react/public/. |
| `step3_gym_session_logging.md` | **OBSOLETE** | Completed step spec. Implementation is in the code. |

## Gotchas

- **Firebase config is in source code** (`src/lib/firebase.js`). This is intentional — Firebase client keys are public by design. Security is enforced by Firestore rules, not key secrecy.
- **`stats.js` must not import from React components or hooks** — it's imported by `storage.js` which is imported by hooks. Circular dependency if this rule is broken.
- **Friend codes are time-boxed** (24h). Format: `BL-XXXXX-DDMMYY`. Old permanent codes show as expired.
- **Service worker** (`public/sw.js`) uses cache-first for app assets, network-first for API calls. Hard refresh (Ctrl+Shift+R) bypasses it during testing.
