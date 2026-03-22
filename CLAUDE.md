# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**BetaLog** (v4.4) is a climbing training PWA — logs boulder, lead, top rope, gym, and hangboard sessions; tracks grade progression; runs hangboard timers; and provides an AI coach via Groq API. Live at `betalog.co.uk` (GitHub Pages). No build system, no backend, no accounts — all data in `localStorage`.

See `betalog_technical.md` for detailed architecture, Firebase migration plan, and code split roadmap. See `betalog_vision.md` for product strategy and feature roadmap.

## Development

No build step. Edit files directly, commit, push to `main` — GitHub Pages deploys within ~30 seconds. Hard refresh to see changes (Ctrl+Shift+R on Windows).

```
npx serve .
# or
python -m http.server
```

No tests, no linting, no package.json.

## Branch & Local Dev Workflow

- **`main`** — production branch, auto-deploys to GitHub Pages on push.
- **`betalog-dev`** — active development branch. All new work happens here. Test locally before merging to `main`.

Local dev setup:
1. Switch to the `betalog-dev` branch: `git checkout betalog-dev`
2. Run a local static server (VS Code Live Server, `npx serve .`, or `python -m http.server`)
3. Test all changes locally against the dev server before pushing
4. When a feature is stable, merge `betalog-dev` → `main` to deploy to GitHub Pages

The file being actively developed on `betalog-dev` is `index.html` (same file as production — the code split into multiple JS/CSS files is a planned future step, see "Planned Migration" below).

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

## Planned Migration (in progress)

The code split is underway. `storage.js` is step 1b of the planned split (see `betalog_technical.md` for the full plan). Target structure after the split:

```
css/app.css
js/data.js      ← storage.js will move here and expand to a full Storage adapter
js/coach.js
js/dashboard.js
js/log.js
js/train.js
js/wallmap.js   ← new, for the gym wall map feature
js/app.js
```

Firebase auth + Firestore sync follows the code split. The `Storage` adapter in `storage.js` is designed to be the only file that changes when Firebase is wired up.

## Dev Log

A file called `DEVLOG.md` lives in the root of the repo. After completing any task, Claude Code must append an entry to DEVLOG.md with:
- Date
- What was done
- Files changed
- Any gotchas or notes for next time

At the start of any new session, read DEVLOG.md to understand what has already been completed.

## Gotchas

- **`sw.js` does not exist.** `index.html` registers it as a service worker but the file is absent — PWA offline caching silently fails.
- **ES5 style throughout.** Match it. No `const`/`let`, no arrow functions, no template literals unless refactoring is explicitly in scope.
- **`DEFAULT_EXERCISES`** is defined in the main `<script>` block, not in `storage.js`. `Storage.loadData()` references it as a global — this works because `loadData` is only called after `DEFAULT_EXERCISES` is defined.
