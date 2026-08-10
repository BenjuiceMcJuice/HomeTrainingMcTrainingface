# BetaLog — SDLC (Software Development Lifecycle)

> Last updated: 2026-08-10

How code goes from idea to production at betalog.co.uk.

---

## Branches

Work flows in one direction only: **feature branch → `preprod` → `main`**.

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Production. Only a merge from `preprod` lands here. | betalog.co.uk (via Cloudflare Pages, auto-deploy) |
| `preprod` | Pre-production. Finished work is integrated and tested here before release. | Preview URL (Cloudflare auto-generates per push) |
| Feature branches | Where the work happens. Short-lived, one per piece of work, branched off `preprod`. | Preview URL (Cloudflare auto-generates per push) |

**Never commit or develop directly on `main`.** Build on a feature branch, merge into `preprod`, verify on the preview deploy, then merge `preprod` → `main` — that last merge is the production release.

Cloud sessions (Claude Code on the web) are given a `claude/<description>` branch automatically; on the laptop, name the branch however you like. The old long-lived `betalog-react` development branch is **retired** — `preprod` replaces it.

---

## Development Workflow

### 1. Start a session

```
git checkout preprod
git pull origin preprod
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

### 5. Merge to pre-production

When the feature is finished and building cleanly:

```
git checkout preprod
git pull origin preprod
git merge <feature-branch>
git push origin preprod
```

### 6. Verify the pre-prod preview

Cloudflare builds a preview deploy for `preprod` automatically. Check the Cloudflare Pages dashboard for its URL and verify the feature works there — desktop and mobile — before promoting. This is the last chance to catch something before it's live.

### 7. Promote to production

Only when pre-prod looks right:

```
git checkout main
git pull origin main
git merge preprod
git push origin main
```

Cloudflare auto-deploys to betalog.co.uk within ~60 seconds. Nothing else ever merges into `main`.

### 8. Verify production

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

Before promoting `preprod` → `main`:

- [ ] Feature tested locally on desktop and mobile
- [ ] Verified on the `preprod` preview deploy
- [ ] `npm run build` passes cleanly
- [ ] `npm test` passes
- [ ] No debug code, console.logs, or placeholder content
- [ ] `logs/YYYY-MM-DD.md` updated for today's work
- [ ] `DEVLOG.md` updated if a milestone was completed
- [ ] `CLAUDE.md` updated if architecture changed
- [ ] Firebase rules deployed if `firestore.rules` changed

---

## Rollback

If a bad deploy reaches production:

1. **Instant rollback:** Cloudflare Pages dashboard → Deployments → find last good deploy → Rollback
2. **Code fix:** Fix on a feature branch, merge to `preprod`, verify the preview, then promote to `main` again — the flow doesn't get skipped for hotfixes

---

## Diagram

```
  feature branch           preprod branch          main branch         betalog.co.uk
  ──────────────           ──────────────         ───────────         ─────────────
        │                        │                     │                     │
   branch off preprod ◄──────────┤                     │                     │
        │                        │                     │                     │
   dev + local test              │                     │                     │
        │                        │                     │                     │
   merge to preprod ───────────► push ── preview URL   │                     │
        │                        │       (verify here) │                     │
   branch retired                ├──── promote ──────► push ──────────► auto-deploy
                                 │                     │                     │
                                 │                     │                live in ~60s
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
