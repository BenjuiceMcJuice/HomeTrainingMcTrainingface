# DEVLOG

## 2026-03-22

Initial setup — betalog-dev branch created, CLAUDE.md updated with branch workflow. CSS split is next step.

## 2026-03-22 — Step 1a: CSS split

Extracted the entire `<style>` block (366 lines) from `index.html` into `css/app.css`. Replaced inline styles with `<link rel="stylesheet" href="css/app.css">` in the `<head>`. No functional changes. Files changed: `index.html`, `css/app.css` (new).

## 2026-03-22 — React scaffold

Set up the `betalog-react` branch and scaffolded the React rewrite. Stack: Vite + React 18, Tailwind CSS v4 (via `@tailwindcss/vite`), shadcn/ui (Radix, Nova theme, all components), React Router v6. BetaLog colour tokens (`#4f7ef8` blue, `#c0622a` orange) wired into Tailwind theme. Path alias `@/` configured in `vite.config.js` and `jsconfig.json`. App runs at `localhost:5173`. No BetaLog features yet — clean scaffold only. Next: replace Vite default with BetaLog shell (dark bg, nav, placeholder Dashboard).
