# BetaLog — Firebase Setup Guide

Step-by-step guide to set up Firebase for the React rewrite. Follow these in order.

---

## 1. Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Click **Add project**
3. Name it `betalog` (or similar)
4. Disable Google Analytics (not needed — we have our own tracking)
5. Click **Create project**

---

## 2. Enable Authentication

1. In Firebase console → **Build → Authentication**
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Enable **Google** (easiest for mobile)
5. Optionally enable **Email/Password** as a fallback
6. Note: no need for Phone or other providers initially

---

## 3. Create Firestore Database

1. In Firebase console → **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (we'll set rules next)
4. Select a region close to your users (e.g. `europe-west2` for UK)

---

## 4. Set Firestore Security Rules

In Firestore → **Rules** tab, replace the default with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

---

## 5. Register Web App

1. In Firebase console → **Project settings** (gear icon)
2. Scroll to **Your apps** → click the web icon (`</>`)
3. Register app name: `BetaLog`
4. **Don't** enable Firebase Hosting (we use GitHub Pages)
5. Copy the config object — you'll need it:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "betalog-xxxxx.firebaseapp.com",
  projectId: "betalog-xxxxx",
  storageBucket: "betalog-xxxxx.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

---

## 6. Install Firebase SDK

In the `betalog-react/` directory:

```bash
npm install firebase
```

---

## 7. Create Firebase Config File

Create `betalog-react/src/lib/firebase.js`:

```js
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

var firebaseConfig = {
  apiKey: "paste-from-step-5",
  authDomain: "betalog-xxxxx.firebaseapp.com",
  projectId: "betalog-xxxxx",
  storageBucket: "betalog-xxxxx.appspot.com",
  messagingSenderId: "...",
  appId: "..."
}

var app = initializeApp(firebaseConfig)

export var auth = getAuth(app)
export var googleProvider = new GoogleAuthProvider()
export var db = getFirestore(app)
```

> **Note:** Firebase web API keys are safe to commit — they're restricted by Firestore rules + auth, not by key secrecy. This is different from Groq keys.

---

## 8. Firestore Data Structure

All user data lives under `users/{userId}/`:

```
users/
  {userId}/
    profile          (single doc: AthleteProfile)
    sessions/        (collection: Session[])
    exercises/       (collection: Exercise[])
    routines/        (collection: Routine[])
    weightLog/       (collection: WeightEntry[])
    schedule         (single doc: ScheduleEntry[])
```

This mirrors our localStorage structure exactly. The `Storage` adapter in `storage.js` is the only file that changes — it currently reads/writes localStorage and will be extended to sync with Firestore.

---

## 9. Implementation Plan

### Phase 1: Auth (login/logout)
- Add sign-in screen (Google button)
- Store `userId` in app context
- No data sync yet — just auth working

### Phase 2: Firestore write
- On every `Storage.save*()` call, also write to Firestore
- localStorage remains the primary read source (fast)
- Firestore is the backup/sync destination

### Phase 3: Firestore read (sync)
- On login, pull Firestore data and merge with localStorage
- Conflict resolution: latest `updatedAt` wins
- On fresh device (no localStorage), pull everything from Firestore

### Phase 4: Real-time sync (optional)
- Firestore `onSnapshot` listeners for live sync across devices
- Only needed if multi-device simultaneous use is a priority

---

## 10. What Changes in the Codebase

| File | Change |
|---|---|
| `src/lib/firebase.js` | **New** — Firebase init, auth, Firestore exports |
| `src/lib/storage.js` | **Modified** — add Firestore write alongside localStorage |
| `src/App.jsx` | **Modified** — auth state, login/logout UI |
| `src/pages/` | **Unchanged** — all pages read from React context, unaware of storage backend |
| `src/hooks/` | **Unchanged** — all hooks use `useData()` context, unaware of storage backend |

The entire point of the `Storage` adapter pattern is that **only `storage.js` needs to know about Firebase**. Everything else stays the same.

---

## Checklist

- [ ] Firebase project created
- [ ] Authentication enabled (Google)
- [ ] Firestore database created with security rules
- [ ] Web app registered, config copied
- [ ] `npm install firebase`
- [ ] `firebase.js` config file created
- [ ] Auth working (login/logout)
- [ ] Firestore write working
- [ ] Firestore read/sync working
- [ ] Tested: new device login pulls data
- [ ] Tested: data persists after localStorage clear
