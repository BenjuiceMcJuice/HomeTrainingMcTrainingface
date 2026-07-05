# BetaLog — Identity & Naming Spec

> This document specifies how BetaLog stores and resolves user names across the app.
> It separates the four things currently conflated into one "name", defines a single
> resolver so every screen agrees, and lays out how external sources (Rock Gym Pro)
> feed in without corrupting user-chosen names.
>
> Last updated: 2026-07-05
> Review trigger: any new name source (external import, new auth provider), any new
> surface that displays a user's name, or a change to the friends/social model.

---

## Why This Exists

A user currently has **two** names with no authority between them, and no shared
resolver — so the same person reads differently depending on the screen:

- **`athleteProfile.name`** — user-typed in Plan → Profile. Denormalised into the
  public profile via `buildPublicProfile()` → `displayName`. This is what **friends** see.
- **`authDisplayName`** — inherited automatically from Google sign-in, stored on
  `users/{uid}` for admin visibility only. This is what the **admin users list** shows.

Real example: one user appears as **"Dave of Knowle West"** on his friend profile
(his typed profile name) and **"David Richardson"** in the admin list (his Google
account name). Same Firebase UID, same email — two fields, each screen preferring a
different one.

Rock Gym Pro integration will add a **third** source (legal first/last name +
membership email). "Just pick one field" does not survive that. We need a model.

---

## The Principle

Separate four concepts that are currently collapsed into "name":

| Concept | Unique? | Shown to peers? | Editable? | Source |
|---|---|---|---|---|
| **Account ID** (`uid`) | yes | never | no | Firebase Auth |
| **Username / handle** | **yes** | yes (`@dave_kw`) | rarely | user-chosen |
| **Display name** | no | yes — the main label everywhere | freely | user-chosen, seeded from auth/RGP |
| **Legal name** | no | no — gym-admin only | no | Auth / Rock Gym Pro |

**Key decision: the *handle* is unique, not the display name.** Forcing display
names to be unique is user-hostile — two people called Dave both deserve to show as
"Dave". Every mature product (Discord, Instagram, Twitter) uses *unique handle +
non-unique display name*; Discord explicitly migrated to this. So:

- **Username** — unique, stable, lowercase, validated. The technical identity for
  social features (adding friends, profile URLs, @mentions).
- **Display name** — the friendly label shown in ~95% of the UI. May be a real name
  or a pseudonym. This is the user's **anonymity lever**.
- **Legal name** — private, used only for gym reconciliation and admin. Gated behind
  a visibility flag, hidden from peers by default.

---

## Data Model

### Additions to the athlete profile / user doc

```
users/{uid}
  username:        "dave_kw"          // unique handle, lowercased, null until claimed
  athleteProfile:
    name:          "Dave of Knowle West"   // EXISTING — becomes the display name
    legalName:     "David Richardson"       // NEW — private, from auth/RGP, admin-only
    nameVisibility: "nickname"              // NEW — "nickname" | "real", default "nickname"
  authDisplayName: "David Richardson"   // EXISTING — kept as a seed/fallback only
  email:           "david.richardson.is@gmail.com"  // EXISTING
  sources:                                  // NEW — namespaced external data, never destructive
    rgp:
      memberId:    "..."
      firstName:   "David"
      lastName:    "Richardson"
      importedAt:  "2026-07-05T..."
```

### Uniqueness index (reuse the existing pattern)

Firestore has no native unique constraint, but the app **already solves this** for
friend codes (`friendCodes/{code} → uid`). Do the same for usernames:

```
usernames/{lowercasedUsername}
  uid: "..."
```

Claim in a transaction: read the doc, reject if it exists and belongs to another uid,
otherwise write it and set `users/{uid}.username`. Releasing/changing a username
deletes the old index doc in the same transaction. Firestore rules restrict writes so
a user can only point a username doc at their own uid.

---

## The Resolver (do this first — fixes today's bug)

One pure function, used by **every** surface that renders a name. Lives in `stats.js`
(pure, no React imports — safe to call from `storage.js`).

```js
// resolveDisplayName(user) — single source of truth for "what do we show"
function resolveDisplayName(user) {
  return (user.athleteProfile && user.athleteProfile.name)   // explicit user choice
      || user.username                                        // handle
      || user.authDisplayName                                 // Google
      || (user.sources && user.sources.rgp && rgpName(user))  // imported
      || emailLocalPart(user.email)                           // "david.richardson"
      || 'Climber';
}
```

Repoint the three current call sites at it:
- `Admin.jsx:149` — `displayName` derivation
- `Admin.jsx:254-256` — the name sort comparator
- `stats.js:280` — `buildPublicProfile()` `displayName`

Once all three read `resolveDisplayName`, the David/Dave split disappears regardless
of whether usernames ship. **This is the cheapest high-value change and needs no
schema migration.**

Legal name is resolved separately and only where authorised (admin, gym dashboard):
`resolveLegalName(user) = athleteProfile.legalName || authDisplayName || rgpName`.

---

## External Sources — Rock Gym Pro Reconciliation

- **Join key: email.** RGP membership email = the Firebase Auth email. Match on that
  first; fall back to name + home gym for manual admin merge when email differs.
- **Never destructive.** Imported data lands under `sources.rgp.*`. It **only seeds
  empty fields** — it never overwrites a user's chosen `athleteProfile.name` or
  `username`. RGP legal name populates `legalName` (private), not the public name.
- **Provenance kept.** `sources.rgp.importedAt` and `memberId` are retained so a later
  re-import can update cleanly and an admin can see where a name came from.

---

## Anonymity & Privacy

- Username is always public — it is the address other members use.
- Display name defaults to the real name (seeded from auth/RGP) but can be swapped for
  a pseudonym at any time. This is how a user chooses to be anonymous to peers.
- Legal name defaults to **hidden from peers** (`nameVisibility: "nickname"`), visible
  to gym admin only. Setting `nameVisibility: "real"` is an explicit opt-in.
- Aligns with the opt-in stance already taken for leaderboards/feeds in the vision doc
  (Phase 6) and the privacy spec — nothing about a user is exposed without a choice.

---

## Phasing

### Phase 1 — Resolver + fields (small, safe, no migration)
- Add `resolveDisplayName` / `resolveLegalName` to `stats.js`.
- Repoint the three call sites (`Admin.jsx`, `buildPublicProfile`).
- Add `legalName`, `nameVisibility`, `sources` to the `AthleteProfile` / user typedefs
  in `types.js`. Kills the current inconsistency.

### Phase 2 — Username system
- `usernames/{handle}` uniqueness collection + Firestore rules (mirror `friendCodes`).
- Claim/validate UI in Plan → Profile (lowercase, allowed chars, reserved-word list,
  collision suggestions like `dave_kw2`).
- Backfill existing users with an auto-generated handle they confirm on next login.
- Optional: "add friend by @username" as a friendlier alternative to time-boxed codes.

### Phase 3 — RGP import + privacy surface
- RGP import pipeline writing to `sources.rgp`, email reconciliation, admin merge tool.
- Surface `nameVisibility` in the profile UI.

**Recommendation: ship Phase 1 regardless** — it is low-risk and fixes the visible
inconsistency. Treat usernames (Phase 2) as a deliberate step once the friend-adding
model is decided.

---

## Open Questions

- Should usernames become the primary friend-adding mechanism, replacing time-boxed
  friend codes, or run alongside them?
- Are usernames ever user-changeable after claim, and if so how often (handle squatting
  / impersonation risk)?
- On RGP import for a user who already has an account: auto-merge on email match, or
  always require admin confirmation?
