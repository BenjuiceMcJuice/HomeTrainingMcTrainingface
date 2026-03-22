# DEVLOG

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
