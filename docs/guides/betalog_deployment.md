# BetaLog — Deployment Guide (Cloudflare Pages)

> Last updated: 2026-08-10

BetaLog is deployed via **Cloudflare Pages** — auto-builds from GitHub on every push to `main`, served on a global CDN at `betalog.co.uk`.

**Pages project name:** `betalog` — every `*.pages.dev` URL below is derived from it.

---

## First-Time Setup (one-off)

### 1. Create the Cloudflare Pages project

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers and Pages** in the left sidebar
3. Click **Create** → select the **Pages** tab → **Connect to Git**
4. Authorize GitHub if prompted, then select the repo: **`benjuicemcjuice/HomeTrainingMcTrainingface`**

### 2. Configure build settings

| Setting | Value |
|---|---|
| **Production branch** | `main` |
| **Framework preset** | Vite |
| **Build command** | `cd betalog-react && npm install && npm run build` |
| **Build output directory** | `betalog-react/dist` |
| **Root directory** | _(leave blank)_ |

Click **Save and Deploy**. Cloudflare will run the first build — takes ~1 minute.

### 3. Add custom domain

Once the first deploy succeeds:

1. Go to your Pages project → **Custom domains** tab
2. Click **Set up a custom domain**
3. Enter `betalog.co.uk`
4. Since your DNS is already on Cloudflare, it will auto-configure the CNAME record
5. Also add `www.betalog.co.uk` and set it to redirect to the apex domain

### 4. Disable GitHub Pages (if active)

If GitHub Pages was previously serving betalog.co.uk:

1. Go to GitHub repo → Settings → Pages
2. Set source to **None** (disable GitHub Pages)
3. Remove the CNAME record in Cloudflare DNS that pointed to `*.github.io` (if one exists)

### 5. Verify

- Visit `betalog.co.uk` — should show the React app
- Check HTTPS padlock is green
- Test on mobile (install as PWA from browser)

---

## How Deployments Work (ongoing)

After initial setup, deployment is automatic:

1. Push code to `main` → Cloudflare detects the push
2. Cloudflare runs `cd betalog-react && npm install && npm run build`
3. Built files from `betalog-react/dist` are deployed to the CDN
4. Live within ~60 seconds

### URLs

| URL | What it serves |
|---|---|
| `betalog.co.uk` | Production (custom domain) |
| `https://betalog.pages.dev` | Production (Cloudflare alias for `main`) |
| `https://preprod.betalog.pages.dev` | The `preprod` branch — check releases here before promoting to `main` |
| `https://<branch>.betalog.pages.dev` | Any other branch's latest build (branch name lowercased, non-alphanumerics become hyphens) |
| `https://<commit-hash>.betalog.pages.dev` | One specific deployment, immutable — the per-build URL in the Deployments tab |

**Preview deploys:** every push to a non-production branch builds too, so `preprod` (and any feature branch) has a live URL of its own. The branch alias always points at that branch's most recent successful build; if it's serving the same bundle as production, that branch's build hasn't finished yet. See `betalog_sdlc.md` for where this sits in the release flow.

---

## Environment Variables

If needed in future (e.g. API keys that shouldn't be in code), add them in:

Cloudflare Dashboard → Pages project → Settings → Environment variables

Currently not needed — Firebase config is public (by design) and the Groq API key is user-supplied at runtime.

---

## Rollback

If a bad deploy goes out:

1. Go to Pages project → **Deployments** tab
2. Find the last known good deployment
3. Click the three dots → **Rollback to this deployment**

Instant — no rebuild needed.

---

## Firebase Rules Deployment

Firestore security rules are deployed separately via the Firebase CLI (not Cloudflare):

```
cd betalog-react
firebase deploy --only firestore:rules
```

This only needs to happen when `firestore.rules` changes. It's independent of the app deployment.
