# DEVLOG

## 2026-03-22 — React migration planning

Decided to rewrite BetaLog in React + shadcn/ui for a more polished, maintainable product. Firebase auth + Firestore to follow in a later phase when user numbers grow. Vanilla JS code split (Steps 1c-1h) is paused — superseded by the React rewrite plan.

Key decisions:
- React 18 + Vite for the new app in `betalog-react/` folder
- shadcn/ui + Tailwind for UI components
- Vercel for hosting (replaces GitHub Pages), same betalog.co.uk domain
- Phase 1 still uses localStorage — same data model, same keys, just abstracted
- Phase 2 (Firebase) only triggered when user numbers make localStorage limits a real problem

Files changed: `CLAUDE.md` (Future Direction section updated), `betalog_react_setup.md` (new — full setup guide for React/shadcn/Vercel/Firebase).

## 2026-03-22

Initial setup — betalog-dev branch created, CLAUDE.md updated with branch workflow. CSS split is next step.

## 2026-03-22 — Step 1a: CSS split

Extracted the entire `<style>` block (366 lines) from `index.html` into `css/app.css`. Replaced inline styles with `<link rel="stylesheet" href="css/app.css">` in the `<head>`. No functional changes. Bumped to v4.4.1. Merged to main and confirmed live on betalog.co.uk. Files changed: `index.html`, `css/app.css` (new).

**Code split status:**
- Step 1a `css/app.css` ✅ done, live on prod
- Step 1b `storage.js` ✅ done (existed before this session)
- Step 1c `js/coach.js` ← next
- Step 1d `js/dashboard.js`
- Step 1e `js/log.js`
- Step 1f `js/train.js`
- Step 1g `js/wallmap.js` (new file, nothing to extract yet)
- Step 1h `js/app.js`

Service worker to be built after all splits are complete.
