# BetaLog — SDLC (Software Development Lifecycle)

> Last updated: 2026-08-20

How code goes from idea to production at betalog.co.uk.

---

## Branches

Work flows in one direction: **feature branch → `main`**.

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Production. The only long-lived branch. | betalog.co.uk (Cloudflare Pages, auto-deploy) |
| Feature branches | Where the work happens. Short-lived, one per piece of work, branched off `main`. | Preview URL (Cloudflare auto-generates per branch) |

**A merge into `main` is a live release.** Cloudflare deploys it within ~60 seconds, so the
pre-merge checklist below is the gate that protects production — there is no stage after it.

Never commit directly to `main`. Build on a feature branch, verify it on that branch's preview URL,
then merge. The branch is what gets reviewed and tested; `main` only ever receives finished work.

Cloud sessions (Claude Code on the web) are given a `claude/<description>` branch automatically; on
the laptop, name the branch however you like. Delete the branch once it's merged.

### Why two stages, not three

This repo ran a documented `feature → preprod → main` flow from 2026-08-10. It was never used once:
`preprod` was created pointing at `main`'s tip and never received a merge, and `main`'s history is
linear throughout. Every session that shipped work recorded it as a "deviation" from a process that
had never actually run.

The stage was dropped rather than enforced, because it bought nothing here. Cloudflare Pages builds
a preview URL for **every** branch, so verification on a real URL already happens one stage earlier.
A staging branch earns its place when several people land work independently and a release needs a
batching point — not when one person ships one thing at a time. What actually protects production is
the checklist and Cloudflare's instant rollback, and neither needs an extra branch.

If that changes — more contributors, or releases that bundle several features — the third stage can
come back. It should come back with CI attached, or it will drift the same way.

### Retired branches

- **`preprod`** — retired 2026-08-20, never used. See above.
- **`betalog-react`** — retired. The old long-lived development branch, superseded by short feature
  branches off `main`.
- **`betalog-dev`** — retired. Vanilla-era, predates the React rewrite.

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

This starts the Vite dev server (usually `http://localhost:5173`). Hot-reloads on save.

For mobile testing: use the network URL shown by Vite (e.g. `http://192.168.1.x:5173`), or use
VS Code port forwarding.

### 3. Test

- **Browser:** check the feature works on desktop and mobile viewport
- **iPhone/Android:** open the network URL on your phone (same WiFi)
- **Data:** test against existing sessions/exercises — check that nothing breaks
- **Firebase:** if touching auth/sync/friends, test with both accounts
- **Build check:** `npm run build` — catches import and syntax errors
- **Unit tests:** `npm test` — the pure functions in `src/lib`
- **Lint:** `npm run lint`

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
- `chore:` — tooling, config, deploys
- `docs:` — documentation only

**Every commit must also update:**
- `logs/YYYY-MM-DD.md` — what was changed, files affected
- `DEVLOG.md` — only when a milestone/step is complete
- `CLAUDE.md` — only if architecture changed

### 5. Verify on the branch preview

Cloudflare builds a preview deploy for the branch automatically. Find its URL in the Cloudflare
Pages dashboard and check the feature there — desktop and mobile. This is the last chance to catch
something before it is live, because the next step is the release.

### 6. Release

Run the pre-merge checklist, then:

```
git checkout main
git pull origin main
git merge <feature-branch>
git push origin main
git push origin --delete <feature-branch>
```

Cloudflare auto-deploys to betalog.co.uk within ~60 seconds.

### 7. Verify production

- Visit betalog.co.uk
- Hard refresh (Ctrl+Shift+R) to bypass the service worker cache
- Spot-check the feature on desktop and mobile
- If something is wrong: roll back via the Cloudflare dashboard (instant, no code change needed)

---

## Firestore Rules (separate process)

Security rules live in `betalog-react/firestore.rules` and deploy independently — they are **not**
part of the Cloudflare pipeline, so merging to `main` does not ship them:

```
cd betalog-react
firebase deploy --only firestore:rules
```

Do this whenever `firestore.rules` changes.

---

## Workers (separate process)

`workers/betalog-calendar/` deploys independently of the app:

```
cd workers/betalog-calendar
npx wrangler deploy
```

---

## Pre-Merge Checklist

Before merging a feature branch into `main` — this is the release gate:

- [ ] Feature tested locally on desktop and mobile
- [ ] Verified on the branch's Cloudflare preview deploy
- [ ] `npm run build` passes cleanly
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] No debug code, console.logs, or placeholder content
- [ ] `logs/YYYY-MM-DD.md` updated for today's work
- [ ] `DEVLOG.md` updated if a milestone was completed
- [ ] `CLAUDE.md` updated if architecture changed
- [ ] Firestore rules deployed if `firestore.rules` changed
- [ ] Worker deployed if `workers/` changed

---

## Rollback

If a bad deploy reaches production:

1. **Instant rollback:** Cloudflare Pages dashboard → Deployments → last good deploy → Rollback
2. **Code fix:** fix on a feature branch, verify the preview, merge to `main` again — hotfixes use
   the same flow, they don't skip the checklist

---

## Diagram

```
  feature branch                        main branch              betalog.co.uk
  ──────────────                       ───────────              ─────────────
        │                                    │                         │
   branch off main ◄────────────────────────┤                         │
        │                                    │                         │
   dev + local test                          │                         │
        │                                    │                         │
   push ── preview URL                       │                         │
        │   (verify here)                    │                         │
        │                                    │                         │
   pre-merge checklist                       │                         │
        │                                    │                         │
        └──── merge ────────────────────────► push ──────────────► auto-deploy
                                             │                         │
   branch deleted                            │                    live in ~60s
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
| Calendar feed Worker | `workers/betalog-calendar/` |
| Documentation | Root `*.md` files |
| Daily logs | `logs/YYYY-MM-DD.md` |
| Milestone tracker | `DEVLOG.md` |
| Claude Code guidance | `CLAUDE.md` (root) |
| Legacy vanilla app | `index.html` (no longer actively developed) |
