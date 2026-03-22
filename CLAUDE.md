# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**BetaLog** (v4.4.1) is a climbing training PWA — logs boulder, lead, top rope, gym, and hangboard sessions; tracks grade progression; runs hangboard timers; and provides an AI coach via Groq API. Live at `betalog.co.uk`. No backend, no accounts — all data in `localStorage`.

**Current state:** Vanilla JS single-file app (`index.html`), hosted on GitHub Pages.
**Future state:** React + shadcn/ui rewrite in `betalog-react/`, hosted on Vercel. Firebase auth + Firestore in a later phase. See the "Future Direction" section below and `betalog_react_setup.md` for setup instructions.

See `betalog_technical.md` for current architecture detail. See `betalog_vision.md` for product strategy and feature roadmap.

## Development

No build step, no tests, no linting, no package.json. Edit files directly and test in a browser.

To run a local server, use VS Code Live Server (right-click `index.html` → Open with Live Server). VS Code should point at the local `HomeTrainingMcTrainingface` folder — Live Server serves files directly from disk, no GitHub involved.

## SDLC & Testing Approach

**Step 1 — Development**
Claude Code edits local files directly on the `betalog-dev` branch. Changes are instant on disk — no build step.

**Step 2 — Local testing**
VS Code Live Server serves the local files. Test in a browser or on iPhone (same network). The version number in the app UI (e.g. v4.4.1) confirms exactly which build is being tested. Hard refresh (Ctrl+Shift+R) clears cache.

**Step 3 — Commit to betalog-dev**
Claude Code commits and pushes to `betalog-dev` on GitHub after each meaningful change. This saves progress and keeps everything reversible. Multiple commits per feature are fine — fix bugs, iterate, keep committing.

**Step 4 — User sign-off**
Manual testing only. Check: does it look right, does it work on iPhone, is anything else broken. If bugs are found, fix on `betalog-dev` and commit again.

**Step 5 — Merge to main (production)**
Only when the user explicitly says so. Claude Code merges `betalog-dev` → `main` and pushes. GitHub Pages auto-deploys within ~30 seconds. Hard refresh on betalog.co.uk confirms the live version number.

## Branch & Local Dev Workflow

- **`main`** — production branch, auto-deploys to GitHub Pages on push.
- **`betalog-dev`** — active development branch. All new work happens here. Test locally before merging to `main`.

Local dev setup:
1. Switch to the `betalog-dev` branch: `git checkout betalog-dev`
2. Run a local static server (VS Code Live Server, `npx serve .`, or `python -m http.server`)
3. Test all changes locally against the dev server before pushing
4. Before merging to `main`, run the pre-merge checklist below
5. Merge `betalog-dev` → `main` to deploy to GitHub Pages

**Never commit code directly to `main`.** All work happens on `betalog-dev`.

The file being actively developed on `betalog-dev` is `index.html` (same file as production — the code split into multiple JS/CSS files is a planned future step, see "Planned Migration" below).

### Pre-merge checklist (betalog-dev → main)

Before merging to production, verify:
- [ ] `DEVLOG.md` has an entry for everything being merged (date, what was done, files changed, any gotchas)
- [ ] `CLAUDE.md` reflects any architectural changes made (new files, new subsystems, changed patterns)
- [ ] The feature/fix has been tested locally on the dev branch
- [ ] No debug code, console.logs, or placeholder content left in

## File Structure

```
index.html              HTML + CSS + JS — the app (~7,640 lines)
storage.js              Storage namespace — all localStorage read/write
betalog_technical.md    Build doc: architecture, Firebase migration, code split plan
betalog_vision.md       Product doc: strategy, roadmap, feature design
gym_partner.html        Marketing landing page for gym partners (not part of the app)
betalog_gym_partner.html  Older planning doc (superseded by the two .md files above)
```

## Architecture

`index.html` has three sections in order:

1. **`<style>` block** (~366 lines) — all CSS. Design tokens on `:root`: `--accent` (#4f7ef8, blue) for gym/training, `--climb-accent` (#c0622a, orange) for climbing.
2. **HTML body** — `<div class="page" id="page-*">` shells shown/hidden by `showPage()`. Fixed bottom nav on mobile, sticky top on desktop (700px breakpoint).
3. **`<script>` block** — all JS, vanilla ES5 style. No `const`/`let`, no arrow functions, no template literals in most of the codebase. **Match this style in new code.**

## Data Layer

All localStorage access goes through `storage.js`, loaded before the main script block:

```js
Storage.loadData()       // reads all keys, returns DATA object — called once on init
Storage.save(key, val)   // JSON.stringify → localStorage
Storage.saveRaw(key, val) // raw string write (for non-JSON values)
```

`var DATA = Storage.loadData()` runs at startup. Most functions mutate `DATA` then call `Storage.save('il_sessions', DATA.sessions)` etc. After a write, `DATA = Storage.loadData()` is often called to refresh.

Main localStorage keys: `il_sessions`, `il_exercises`, `il_routines`, `il_hbRoutines`, `il_schedule`, `il_weight_log`, `il_badges`, `il_groq_key`.

## Navigation & Pages

`showPage(id, btn)` toggles `.active` on `.page` divs and `.nav-btn` elements.

Top-level page IDs: `dashboard`, `log`, `history`, `plan`. `page-session` is a drill-down sub-page. `train`, `coach`, `rewards`, `settings` are tabs/panels within pages, not top-level pages.

## Key Subsystems

| Area | Functions |
|---|---|
| Dashboard | `renderDashboard()`, `renderDashGradeChart()`, `renderActivityCal()` |
| Logging | `initLog()`, `setLogSessionType()`, `renderLogGymPanel()`, `renderLogClimbPanel()`, `renderLogHangboardPanel()` |
| Session save | `saveSession(mode)` — gym / quick / climb / hangboard |
| Exercise library | `renderExerciseLibrary()`, `openExerciseModal()`, `saveExercise()` |
| Routines | `renderRoutines()`, `rbSaveRoutine()`, `renderEditRoutineOrder()` |
| Hangboard timer | `renderLogHangboardPanel()`, `openHbRoutineModal()` |
| History | `renderHistory()`, `showSessionDetail()`, `saveSessionEdit()` |
| AI coach | `Jonas`, `Chad`, `Marina`, `Geoff` personas — each calls `https://api.groq.com/openai/v1/chat/completions` |
| Streak | `calcStreak()`, `updateStreak()` |
| Import/export | `exportData()`, `importData()` |

## Session Object Shape

```js
{ id, date, type: "gym"|"climb"|"hangboard"|"quick", diff: 1-5, exercises: [],
  climbs: [],   // climb type — each climb has { grade, outcome, routeId, gymId, centreId }
  grips: []     // hangboard type
}
```

`routeId`, `gymId`, `centreId` on climbs are nullable — standalone logging sets them to `null`.

## Future Direction — React Migration

**Decision (March 2026):** BetaLog will be rewritten in React + shadcn/ui for a more polished, maintainable product. Firebase auth + Firestore will be added in a second phase when user numbers justify it. See `betalog_react_setup.md` for full technical setup instructions.

### Why React

- Current `index.html` is 7,640+ lines and will get harder to maintain
- shadcn/ui gives a significantly more polished UI with far less custom CSS
- Component model makes features like session forms, modals, and charts much cleaner
- Enables proper tooling: Vite, TypeScript (optional), hot module replacement
- Sets up the codebase for Firebase sync and multi-user support

### Migration strategy

**Phase 1 — React rewrite (current focus)**
- New Vite + React project in `betalog-react/` folder alongside the existing app
- shadcn/ui + Tailwind for all UI components
- Storage layer still uses localStorage via an abstracted `storage` module — same data, same keys
- Deploy to Vercel (replaces GitHub Pages), same `betalog.co.uk` domain
- Port features one at a time: Dashboard → Log → History → Plan → Coach → Rewards

**Phase 2 — Firebase (when user numbers grow)**
- Add Firebase Auth (Google login)
- Swap `storage` module to write to Firestore instead of localStorage
- Existing users' data migrates on first login via an import step
- No second rewrite needed — only the storage module changes

### Why Firebase over Neon (Postgres)

Both are viable. Firebase wins for this use case because:
- Auth is built-in (Neon needs a separate auth service like Clerk)
- Real-time sync is built-in (Neon needs extra work)
- localStorage → Firestore is a clean swap with the existing abstraction
- Neon would be the better choice if complex SQL queries were needed

### Hosting: Vercel (replaces GitHub Pages)

- Free tier, auto-deploys on push to `main`
- Preview deployments on every branch push — shareable test URLs
- Custom domain (`betalog.co.uk`) — just re-point DNS
- Handles Vite builds natively, zero config

### localStorage limits (the trigger for Phase 2)

Browsers cap localStorage at ~5-10MB per origin. A power user logging daily sessions will hit this within months. The `storage` module abstraction means switching to Firestore requires no changes outside that module.

### Current code split (paused)

The vanilla JS code split (`css/app.css`, `storage.js`) is paused — it is superseded by the React rewrite plan. The `storage.js` abstraction is still valuable as a reference for the React storage module design.

## Dev Log

A file called `DEVLOG.md` lives in the root of the repo. After completing any task, Claude Code must append an entry to DEVLOG.md with:
- Date
- What was done
- Files changed
- Any gotchas or notes for next time

At the start of any new session, read DEVLOG.md to understand what has already been completed.

## Versioning

BetaLog uses semantic versioning: `MAJOR.MINOR.PATCH`.

- **MAJOR** (e.g. 5.0) — significant new feature set or architectural overhaul
- **MINOR** (e.g. 4.5) — new user-visible feature
- **PATCH** (e.g. 4.4.1) — bug fixes, refactors, code splits, or any non-functional change

**Rule:** Every commit that changes `index.html` must increment `APP_VERSION` (line ~595) and add a corresponding entry to the top of the `CHANGELOG` array. Update the version reference in `CLAUDE.md` (`**BetaLog** (vX.X.X)`) to match. This lets the user see what build they're testing in the app UI.

## Gotchas

- **`sw.js` does not exist.** `index.html` registers it as a service worker but the file is absent — PWA offline caching silently fails.
- **ES5 style throughout.** Match it. No `const`/`let`, no arrow functions, no template literals unless refactoring is explicitly in scope.
- **`DEFAULT_EXERCISES`** is defined in the main `<script>` block, not in `storage.js`. `Storage.loadData()` references it as a global — this works because `loadData` is only called after `DEFAULT_EXERCISES` is defined.
