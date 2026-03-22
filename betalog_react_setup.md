# BetaLog — React Migration Setup Guide

This document covers the full technical setup for the BetaLog React rewrite.
It is a reference for Claude Code and for the developer doing the setup steps
that require a terminal or browser account creation.

See `CLAUDE.md` for the migration strategy and rationale.

---

## Overview of the stack

| Layer | Tool | Why |
|---|---|---|
| Framework | React 18 + Vite | Fast dev server, simple build, standard tooling |
| UI components | shadcn/ui | Polished accessible components, you own the source |
| Styling | Tailwind CSS | Required by shadcn, utility-first, no custom CSS needed |
| Routing | React Router v6 | Simple page navigation |
| Storage (Phase 1) | localStorage via abstracted module | Same data model as current app |
| Auth (Phase 2) | Firebase Auth | Google login, built-in |
| Database (Phase 2) | Firebase Firestore | Real-time sync, replaces localStorage |
| Hosting | Vercel | Auto-deploys from GitHub, preview URLs, free tier |
| Domain | betalog.co.uk | Re-point DNS from GitHub Pages to Vercel |

---

## Part 1 — Local project setup

These steps are run once by the developer in a terminal.

### 1.1 Create the React + Vite project

From the `HomeTrainingMcTrainingface` folder:

```bash
npm create vite@latest betalog-react -- --template react
cd betalog-react
npm install
```

This creates a `betalog-react/` subfolder alongside the existing `index.html`.
The old app continues to work untouched during the migration.

### 1.2 Install Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Update `tailwind.config.js` to scan React files:

```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Add Tailwind directives to `src/index.css` (replace existing content):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 1.3 Install shadcn/ui

shadcn/ui uses a CLI to add components one at a time into your project.
Run the initialiser:

```bash
npx shadcn@latest init
```

It will ask a few questions — sensible defaults:
- Style: **Default**
- Base colour: your choice (Zinc or Slate work well for a dark theme)
- CSS variables: **Yes**

Then add components as needed, e.g.:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add tabs
npx shadcn@latest add input
npx shadcn@latest add badge
```

Components are copied into `src/components/ui/` — you own the source and can
edit them freely.

### 1.4 Install React Router

```bash
npm install react-router-dom
```

### 1.5 Run the dev server

```bash
npm run dev
```

Opens at `http://localhost:5173`. Hot-reloads on save — no manual refresh needed.

---

## Part 2 — Vercel hosting setup

These steps are done once via browser (Vercel website + GitHub).

### 2.1 Create a Vercel account

Sign up at vercel.com using your GitHub account. Free tier is sufficient.

### 2.2 Import the GitHub repo

1. In Vercel dashboard → **Add New Project**
2. Select the `HomeTrainingMcTrainingface` repo
3. Set **Root Directory** to `betalog-react` (important — not the repo root)
4. Framework preset: **Vite** (Vercel detects this automatically)
5. Click **Deploy**

Vercel will build and deploy. You get a URL like `betalog-react.vercel.app`.

### 2.3 Set up preview deployments

This happens automatically. Every push to any branch creates a unique preview
URL — great for testing features before they go live.

### 2.4 Point betalog.co.uk at Vercel

1. In Vercel project → **Settings → Domains**
2. Add `betalog.co.uk`
3. Vercel gives you DNS records to add (usually an A record and CNAME)
4. Update those records in your domain registrar (wherever betalog.co.uk is registered)
5. DNS propagation takes up to 24 hours but usually under an hour

Once done, `betalog.co.uk` serves the React app from Vercel instead of GitHub Pages.

### 2.5 Deployment workflow going forward

```
edit code → commit → push to betalog-dev
  → Vercel builds preview → preview URL for testing
  → sign off → merge betalog-dev to main
  → Vercel auto-deploys to betalog.co.uk (~30 seconds)
```

---

## Part 3 — Firebase setup (Phase 2 — do this when ready for accounts)

### 3.1 Create a Firebase project

1. Go to console.firebase.google.com
2. **Create project** → name it `betalog`
3. Disable Google Analytics (not needed)

### 3.2 Enable Authentication

1. In Firebase console → **Authentication → Get started**
2. **Sign-in method → Google → Enable**
3. Add `betalog.co.uk` and `localhost` to authorised domains

### 3.3 Enable Firestore

1. **Firestore Database → Create database**
2. Start in **production mode**
3. Choose a region close to your users (e.g. `europe-west2` for UK)

### 3.4 Add Firebase to the React project

```bash
npm install firebase
```

Create `src/lib/firebase.js`:

```js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  // paste config from Firebase console → Project settings → Your apps
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

**Do not commit API keys to git.** Use environment variables:

```bash
# .env.local (never commit this file)
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
# etc.
```

Reference in code as `import.meta.env.VITE_FIREBASE_API_KEY`.

Add `.env.local` to `.gitignore`.

Add the same env vars to Vercel: **Project Settings → Environment Variables**.

### 3.5 Firestore data structure

Sessions will live at:
```
users/{userId}/sessions/{sessionId}
```

This mirrors the current localStorage structure but scoped per user.
The storage module swap (localStorage → Firestore) is the only code change
needed — all component code stays the same.

### 3.6 Firestore security rules

Replace the default rules in the Firebase console with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This ensures users can only read and write their own data.

---

## Part 4 — Project structure (React app)

Target file structure for `betalog-react/src/`:

```
src/
├── components/
│   ├── ui/               ← shadcn components (auto-generated, edit freely)
│   ├── layout/           ← Nav, Layout wrapper
│   ├── dashboard/        ← Dashboard page components
│   ├── log/              ← Session logging components
│   ├── history/          ← History and session detail
│   ├── coach/            ← AI coach UI
│   └── shared/           ← Reusable bits (GradeTag, SessionCard etc.)
├── lib/
│   ├── storage.js        ← Storage abstraction (localStorage in Phase 1, Firestore in Phase 2)
│   ├── firebase.js       ← Firebase init (Phase 2 only)
│   └── utils.js          ← Shared helpers
├── hooks/
│   ├── useStorage.js     ← Custom hook wrapping storage.js
│   └── useAuth.js        ← Firebase auth hook (Phase 2)
├── pages/
│   ├── Dashboard.jsx
│   ├── Log.jsx
│   ├── History.jsx
│   ├── Plan.jsx
│   └── Settings.jsx
├── App.jsx               ← Router setup
└── main.jsx              ← Entry point
```

---

## Part 5 — Data migration (localStorage → Phase 1 React)

The existing localStorage keys are unchanged. The React `storage.js` module
reads the same keys as the vanilla app:

```
il_sessions, il_exercises, il_routines, il_hbRoutines,
il_schedule, il_weight_log, il_badges, il_groq_key
```

A user switching from the old app to the new one on the same device will have
their data automatically available — no migration step needed for Phase 1.

For Phase 2 (Firestore), on first login the app reads localStorage and writes
all data to Firestore once, then switches to Firestore permanently.

---

## Part 6 — BetaLog brand tokens

Preserve these design decisions from the current app in Tailwind config:

| Token | Value | Use |
|---|---|---|
| `--accent` | `#4f7ef8` | Gym / training UI (blue) |
| `--climb-accent` | `#c0622a` | Climbing UI (orange) |
| Font | Barlow (Google Fonts) | All text |
| Background | Dark theme | `#0f0f0f` or similar |

Add to `tailwind.config.js` under `theme.extend.colors`:

```js
colors: {
  accent: '#4f7ef8',
  'climb-accent': '#c0622a',
}
```

---

## Quick reference — useful commands

```bash
npm run dev          # start dev server (localhost:5173)
npm run build        # production build → dist/
npm run preview      # preview production build locally

npx shadcn@latest add <component>   # add a new shadcn component

git checkout betalog-dev            # always work on dev branch
git push origin betalog-dev         # triggers Vercel preview build
git push origin main                # triggers Vercel production deploy
```
