# DEVLOG

## 2026-03-22

Initial setup — betalog-dev branch created, CLAUDE.md updated with branch workflow. CSS split is next step.

## 2026-03-22 — Step 1a: CSS split

Extracted the entire `<style>` block (366 lines) from `index.html` into `css/app.css`. Replaced inline styles with `<link rel="stylesheet" href="css/app.css">` in the `<head>`. No functional changes. Files changed: `index.html`, `css/app.css` (new).

## 2026-03-22 — React migration decision

Decided to rewrite BetaLog in React + shadcn/ui. Vanilla JS code split (steps 1c–1h) paused — superseded by the React rewrite. Key decisions: React 18 + Vite, shadcn/ui + Tailwind, Vercel hosting (replaces GitHub Pages), Phase 1 keeps localStorage, Phase 2 (Firebase) only when user numbers justify it.

## 2026-03-22 — React scaffold

Set up the `betalog-react` branch and scaffolded the React rewrite. Stack: Vite + React 18, Tailwind CSS v4 (via `@tailwindcss/vite`), shadcn/ui (Radix, Nova theme, all components), React Router v6. BetaLog colour tokens (`#4f7ef8` blue, `#c0622a` orange) wired into Tailwind theme. Path alias `@/` configured in `vite.config.js` and `jsconfig.json`. App runs at `localhost:5173`. Gotcha: Vite scaffold created a nested `.git` folder inside `betalog-react/` causing it to be tracked as a submodule — fixed by removing inner `.git` and re-adding as regular files.

## 2026-03-22 — BetaLog shell + colour scheme

Replaced Vite default page with BetaLog shell: white background, frosted glass nav (mobile bottom + desktop top), "Beta" dark + "Log" blue logo, Barlow + Barlow Condensed fonts, placeholder pages for Dashboard / Log / History / Plan with React Router. Colour scheme matches original app exactly. HMR confirmed working.

## NEXT STEPS — build order (data-first approach)

Priority is getting the core data entry right before the dashboard. Build in this order:

**Step 1 — Gym exercises**
- Exercise library: name, category (push/pull/legs/core/etc.), sets/reps/weight attributes
- Verify existing taxonomy from vanilla app is carried over correctly (`il_exercises` localStorage key)
- CRUD UI: add, edit, delete exercises
- Keep it clean and mobile-friendly with shadcn components

**Step 2 — Routines**
- Group exercises into named routines (`il_routines` localStorage key)
- Ordered list of exercises with sets/reps targets per routine
- UI should make reordering and editing feel effortless

**Step 3 — Climbing logs**
- Top rope, lead, bouldering each have slightly different attributes (grade systems differ, outcomes differ)
- Logging UI should adapt per discipline
- Data key: `il_sessions` with type="climb", climbs array per session

**Step 4 — Hangboard**
- Timer-driven, grip-focused logging
- Separate routine concept (hang time, rest, grip type, edge size)
- Data key: `il_hbRoutines`, sessions with type="hangboard"

**Step 5 — Dashboard** (last, once data exists)
- Streak, recent sessions, grade progression chart, quick stats
- All reads from localStorage — no new data model needed
