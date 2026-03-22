# DEVLOG

## 2026-03-22

Initial setup — betalog-dev branch created, CLAUDE.md updated with branch workflow. CSS split is next step.

## 2026-03-22 — Step 1a: CSS split

Extracted the entire `<style>` block (366 lines) from `index.html` into `css/app.css`. Replaced inline styles with `<link rel="stylesheet" href="css/app.css">` in the `<head>`. No functional changes. Files changed: `index.html`, `css/app.css` (new).
