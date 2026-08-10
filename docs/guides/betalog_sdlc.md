# BetaLog — SDLC (Software Development Lifecycle)

> Last updated: 2026-08-10

How code goes from idea to production at betalog.co.uk.

---

## Branches

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | The production branch. Only tested work lands here. | betalog.co.uk (via Cloudflare Pages, auto-deploy) |
| Feature branches | Where all work happens. Short-lived, one per piece of work, branched off `main`. | Preview URL (Cloudflare auto-generates per push) |

**Never commit or develop directly on `main`.** Work on a feature branch, test it there, then merge to `main` — that merge is the production release.

Cloud sessions (Claude Code on the web) are given a `claude/<description>` branch automatically; on the laptop, name the branch however you like. The old long-lived `betalog-react` development branch is **retired** and no longer exists on the remote — branch off `main` instead.

---

## Development Workflow

### 1. Start a session

```
git checkout main
git pull origin main
git checkout -b <feature-branch>
```

Read `DEVLOG.md` and the most recent `logs/YYYY-MM-DD.md` to understand where things are.

### 2. Develop locally

```
cd betalog-react
npm run dev
```

This starts Vite dev server (usually `http://localhost:5173`). Hot-reloads on save.

For mobile testing: use the network URL shown by Vite (e.g. `http://192.168.1.x:5173`), or use VS Code port forwarding.

### 3. Test

- **Browser:** Check the feature works on desktop and mobile viewport
- **iPhone/Android:** Open the network URL on your phone (same WiFi)
- **Data:** Test with existing sessions/exercises — check that nothing breaks
- **Firebase:** If touching auth/sync/friends, test with both accounts
- **Build check:** Run `npm run build` before committing — catches type errors and import issues

### 4. Commit and push

```
git add <specific files>
git commit -m "feat: description of what changed"
git push -u origin <feature-branch>
```

**Commit conventions:**
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructure, no behaviour change
- `docs:` — documentation only

**Every commit must also update:**
- `logs/YYYY-MM-DD.md` — what was changed, files affected
- `DEVLOG.md` — only when a milestone/step is complete
- `CLAUDE.md` — only if architecture changed

### 5. Verify preview deploy

After pushing the feature branch, Cloudflare builds a preview deploy automatically. Check the Cloudflare Pages dashboard for the preview URL and verify the feature works on the live preview.

### 6. Merge to production

Only when you're confident the feature is ready:

```
git checkout main
git pull origin main
git merge <feature-branch>
git push origin main
```

Cloudflare auto-deploys to betalog.co.uk within ~60 seconds.

### 7. Verify production

- Visit betalog.co.uk
- Hard refresh (Ctrl+Shift+R) to bypass service worker cache
- Spot-check the feature on desktop and mobile
- If something is wrong: rollback via Cloudflare dashboard (instant, no code change needed)

---

## Firestore Rules (separate process)

Security rules live in `betalog-react/firestore.rules` and deploy independently:

```
cd betalog-react
firebase deploy --only firestore:rules
```

Do this whenever `firestore.rules` changes — it's not part of the Cloudflare deploy pipeline.

---

## Pre-Merge Checklist

Before merging a feature branch → `main`:

- [ ] Feature tested locally on desktop and mobile
- [ ] `npm run build` passes cleanly
- [ ] No debug code, console.logs, or placeholder content
- [ ] `logs/YYYY-MM-DD.md` updated for today's work
- [ ] `DEVLOG.md` updated if a milestone was completed
- [ ] `CLAUDE.md` updated if architecture changed
- [ ] Firebase rules deployed if `firestore.rules` changed

---

## Rollback

If a bad deploy reaches production:

1. **Instant rollback:** Cloudflare Pages dashboard → Deployments → find last good deploy → Rollback
2. **Code fix:** Fix on a feature branch, test, merge to `main` again

---

## Diagram

```
  feature branch              main branch          betalog.co.uk
  ──────────────           ───────────────          ─────────────
        │                          │                        │
   branch off main ◄───────────────┤                        │
        │                          │                        │
   dev + test                      │                        │
        │                          │                        │
   push to remote ──── preview URL (Cloudflare)             │
        │                          │                        │
   merge to main ─────────────► push ──────────────► auto-deploy
        │                          │                        │
   branch retired                  │                   live in ~60s
```

---

## What Lives Where

| Concern | Location |
|---|---|
| App source code | `betalog-react/src/` |
| Build config | `betalog-react/vite.config.js` |
| Firebase config | `betalog-react/src/lib/firebase.js` |
| Firestore rules | `betalog-react/firestore.rules` |
| Firebase project link | `betalog-react/.firebaserc` |
| PWA manifest | `betalog-react/public/manifest.json` |
| Service worker | `betalog-react/public/sw.js` |
| Documentation | Root `*.md` files |
| Daily logs | `logs/YYYY-MM-DD.md` |
| Milestone tracker | `DEVLOG.md` |
| Claude Code guidance | `CLAUDE.md` (root) |
| Legacy vanilla app | `index.html` (no longer actively developed) |
