# BetaLog — PWA Setup Guide

How to turn the BetaLog React app into a Progressive Web App.
Result: users can add betalog.co.uk to their home screen and get a native-feeling
app with a custom icon, full-screen experience, and offline support.

Last updated: 2026-03-24

---

## Overview

PWA requires three things:

1. **Icon assets** — PNG files at the right sizes
2. **Web manifest** — tells the browser the app name, icon, colours
3. **Service worker** — caches the app for offline use

`vite-plugin-pwa` handles 2 and 3 automatically. Icon assets need to be created once.

Total dev effort: ~1 session with Claude Code once icons are ready.

---

## Step 1 — Design the BetaLog icon

Do this before any code. Claude Code needs the final icon file to generate assets.

### What you need to create

A single square source image at **1024×1024px** minimum.

- Format: PNG with transparent background (preferred) or solid background
- Design: simple, bold, readable at small sizes — it will be shown at 48×48px on some devices
- Style: should work on both light and dark backgrounds (iOS adds its own background shape)

### Design options

**Option A — Do it yourself free:**
- Canva (canva.com) — free tier, export as PNG 1024×1024
- Figma (figma.com) — free tier, more control
- Keep it simple: a bold "B" or stylised "BL" monogram, or a simple carabiner / chalk
  mark / fingerprint icon that reads at small size

**Option B — Generate with AI:**
- Go to claude.ai and ask: *"Create a minimal logo icon for a climbing training app
  called BetaLog. Square format, simple bold design that works at small sizes,
  climbing theme, modern and clean."*
- Or use Adobe Firefly, Midjourney, or DALL-E with a similar prompt
- Download the result and clean it up in Canva/Figma if needed

**Option C — Commission:**
- Fiverr or 99designs if you want something polished before launch
- Not needed for the gym pilot — a clean simple AI icon is fine for now

### Icon design tips for PWAs

- Avoid fine detail — it disappears at 48px
- Leave a small amount of padding inside the square (about 10–15%) — iOS clips to
  a rounded rectangle and Android adds its own shape
- Bold single colour or two-colour designs work best
- Test it by shrinking a preview to 48×48 before finalising

---

## Step 2 — Generate icon asset sizes

Once you have a 1024×1024 source PNG, generate all the sizes you need.

### Sizes required

| File | Size | Used for |
|---|---|---|
| `icon-192.png` | 192×192 | Android home screen, PWA manifest |
| `icon-512.png` | 512×512 | Android splash screen, PWA manifest |
| `apple-touch-icon.png` | 180×180 | iOS home screen icon |
| `favicon.ico` | 32×32 + 16×16 | Browser tab |
| `favicon.svg` | vector | Modern browsers (optional but good) |
| `og-image.png` | 1200×630 | Social share preview (optional) |

### How to generate them free

**Option A — realfavicongenerator.net (recommended):**
1. Go to realfavicongenerator.net
2. Upload your 1024×1024 PNG
3. Configure iOS appearance (background colour, safe area padding)
4. Configure Android appearance (theme colour)
5. Download the ZIP — contains all sizes pre-named
6. Put the files in `betalog-react/public/`

**Option B — Claude Code:**
Once you have the source PNG in the repo, Claude Code can use Sharp (npm package)
to generate all sizes in a single script. Ask it to:
*"Generate all PWA icon sizes from public/icon-source.png using Sharp"*

---

## Step 3 — Install vite-plugin-pwa

Claude Code runs this from inside `betalog-react/`:

```bash
npm install -D vite-plugin-pwa
```

---

## Step 4 — Configure vite.config.js

Claude Code updates `betalog-react/vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'BetaLog',
        short_name: 'BetaLog',
        description: 'Climbing training and session tracker',
        theme_color: '#c0622a',        // climb-accent orange — update if brand colour changes
        background_color: '#0f0f0f',   // matches app dark background
        display: 'standalone',         // full screen, no browser chrome
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'   // Android adaptive icon
          }
        ]
      },
      workbox: {
        // Cache the app shell and all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Cache Firebase and Groq API calls with network-first strategy
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
            }
          }
        ]
      }
    })
  ]
})
```

**Colour values to update once brand is finalised:**
- `theme_color` — shows in Android status bar and browser chrome. Currently set to
  BetaLog's climb-accent orange (`#c0622a`). Change if brand colour changes.
- `background_color` — splash screen background. Currently dark to match app theme.

---

## Step 5 — Add meta tags to index.html

Claude Code adds these to `betalog-react/index.html` inside `<head>`:

```html
<!-- PWA -->
<meta name="application-name" content="BetaLog">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BetaLog">
<meta name="theme-color" content="#c0622a">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
```

The apple-specific tags are important — iOS doesn't fully respect the web manifest
and needs these separately.

---

## Step 6 — Place icon files in public/

All icon files go in `betalog-react/public/`. Vite copies everything in `public/`
to the build output root automatically.

```
betalog-react/public/
├── icon-source.png          (original 1024×1024 — keep for future regeneration)
├── icon-192.png
├── icon-512.png
├── apple-touch-icon.png     (180×180)
├── favicon.ico
└── favicon.svg              (optional)
```

---

## Step 7 — Test locally

```bash
# PWA only works in production build — not in dev server
npm run build
npm run preview
```

Open the preview URL on your phone browser. You should see "Add to Home Screen"
prompt appear (Android) or be available in the share sheet (iOS).

**Check with Lighthouse:**
1. Open Chrome DevTools → Lighthouse tab
2. Run audit on the preview URL
3. PWA section should show green — any failures will tell you exactly what's missing

---

## Step 8 — Deploy

Push to main → Vercel auto-deploys → betalog.co.uk is now a PWA.

HTTPS is required for PWAs — Vercel provides this automatically.

---

## Telling users how to install

### iOS (Safari)
1. Open betalog.co.uk in Safari
2. Tap the Share button (box with arrow)
3. Scroll down → "Add to Home Screen"
4. Tap Add

### Android (Chrome)
1. Open betalog.co.uk in Chrome
2. Chrome may show an automatic install banner
3. Or: tap the three-dot menu → "Add to Home Screen" / "Install app"

---

## What users get after installing

- BetaLog icon on home screen
- Opens full screen (no browser address bar)
- Loads instantly on repeat visits (cached)
- Works offline for everything except Firebase sync
- Status bar matches brand colour on Android
- Feels indistinguishable from a native app for typical use

---

## Limitations vs a native app

- Not in the App Store or Play Store — no organic discovery
- iOS push notifications are limited (Apple only fully supports them from iOS 16.4+
  and the user must have installed the PWA first)
- No access to native device features (not relevant for BetaLog currently)

These are acceptable limitations for a gym pilot where users are hand-onboarded.
Revisit native app decision when there is revenue to justify the rebuild effort.

---

## Future: "Add to Home Screen" prompt in-app

Once PWA is live, add a subtle in-app prompt that appears after a user's second
session suggesting they install the app. This increases the install rate significantly.
`vite-plugin-pwa` provides a `useRegisterSW` hook that can trigger this UI.
Defer this until after the gym pilot — it is a nice-to-have, not required for launch.
