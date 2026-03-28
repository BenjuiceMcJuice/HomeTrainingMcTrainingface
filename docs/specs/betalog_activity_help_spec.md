# BetaLog — Activity Sessions, Help Page & Settings Spec

> Status: Deferred — app recently went live. Build after initial stabilisation.
> Last updated: 2026-03-27

---

## Part 1 — Activity Session Type

### Overview

A new session type `"activity"` covers cardio and cross-training: swimming, walking, running, cycling. Sits alongside `"gym"`, `"climb"`, and `"hangboard"` in the data model and session logging flow.

The framing is **Activity** not "Cardio" — neutral, non-gym, works equally for a swimmer and a hiker.

---

### Data model additions

#### Session changes

New valid value for `session.type`: `"activity"`

Two new fields added to Session, only populated when `type === "activity"`:

```
activityType:  "swimming" | "walking" | "running" | "cycling"
distance:      number | null   // in user's preferred unit (km or miles), null if not recorded
```

All other session fields behave as normal:
- `discipline: null`
- `exercises: []`, `climbs: []`, `hangGrips: []`
- `difficulty`, `notes`, `date`, `createdAt`, `updatedAt` — all standard

#### Session field matrix addition

| Field | `activity` |
|---|---|
| `type` | `"activity"` |
| `activityType` | swimming / walking / running / cycling |
| `distance` | number (km or miles) or null |
| `discipline` | `null` |
| `difficulty` | 1–5 (required) |
| `notes` | string |
| `exercises[]` | `[]` |
| `climbs[]` | `[]` |
| `hangGrips[]` | `[]` |

#### AthleteProfile addition

```
distanceUnit: "km" | "miles"   // default "km"
```

Set once in Profile settings. Applied to all distance display and input across the app.

---

### Logging flow

Activity sessions follow the same entry point as other session types — Log tab, select session type. Activity is added as a fourth option alongside Gym, Climb, Hangboard.

**Log sheet fields (in order):**
1. Activity type — chip selector: Swimming / Walking / Running / Cycling
2. Duration — time picker (hours + minutes)
3. Distance — number input with unit label (km or miles per profile setting). Optional — can be left blank.
4. Difficulty — 1–5 (mandatory, same as all session types)
5. Notes — free text, optional
6. Date — defaults to today, editable

Save behaviour identical to other session types.

---

### History feed

Activity sessions appear in the main History feed alongside all other session types — one feed, no separate tab.

Visual treatment: activity sessions get a distinct icon per type (swimmer, walker, runner, cyclist — simple line icons). Card shows activity type, duration, distance if logged, difficulty pill. Same card shape as gym/climb sessions — visually distinct enough via icon and label without being a different layout.

---

### Dashboard charts

New section in the Dashboard/Profile below the existing climbing charts.

**Climbing charts** — collapsed by default (currently expanded). User taps to expand. This frees up vertical space for the new sections.

**Activity section** — shows charts for logged activity sessions.

Chart 1 — Distance over time:
- X axis: weeks
- Y axis: distance in user's preferred unit
- Two views: weekly totals bar chart + per-session dots (toggle between them)
- Activity type filter: All / Swimming / Walking / Running / Cycling (chip row)
- If only one activity type has been logged, filter defaults to that type

Chart 2 — Duration over time:
- Same structure as distance chart
- Useful for swimming where distance may not always be logged

Combined vs split: one chart with type filter rather than separate charts per type. If only one type is logged the filter is hidden — no unnecessary UI. If multiple types are logged, the filter defaults to "All" with stacked or colour-coded bars per type.

**Gym exercises section** — a separate small chart or summary card showing gym session frequency and volume over time. Scope TBD when building — at minimum a sessions-per-week bar for gym type, possibly top exercises by frequency.

---

### Settings addition

**Distance unit preference** — added to Profile settings card. Toggle: km / miles. Affects all distance display and input in the app. Default: km.

---

## Part 2 — Help & Info Page

### Overview

A standalone page at `betalog.co.uk/help` covering FAQs, what's new, coming soon, and guides. Maintained separately from the app — updated when new functionality ships, no app deploy required.

The `?` button in the app links to this page. It opens in a new browser tab.

---

### `?` button placement

A `?` icon sits in the app header next to the settings cog. Tapping it opens `betalog.co.uk/help` in a new tab.

Implementation: standard anchor tag, `target="_blank"`. No routing, no modal — just a link out.

---

### betalog.co.uk/help — page structure

Standalone HTML page. Matches BetaLog visual style (dark theme, Barlow font, accent blue). Not part of the React app — a separate static file or simple HTML served from the same domain/repo.

**Sections (in order):**

#### 1. What's New
Recent releases listed newest-first. Each entry:
- Version number and date
- 2–4 bullet points of what changed
- Kept brief — this is not a full changelog, just highlights

#### 2. Coming Soon
What is actively being worked on or planned next. Deliberately vague on timelines — "in development" or "planned" labels only. Manages expectations without committing to dates.

Items in this section: activity session logging, help page (meta), gym route board (partner feature).

#### 3. Guides
Short how-to sections for features members might not discover themselves:
- How to install BetaLog on your phone (PWA install instructions, iOS and Android)
- How to use the hangboard timer
- How to use the AI coach (including getting a Groq API key)
- How to log a climbing session
- How to back up your data

Each guide is a short paragraph or numbered steps — not a full manual.

#### 4. FAQs
Q&A format. Suggested initial entries:
- Is BetaLog free? (Yes, always free for climbers)
- Does it work offline? (Yes, fully)
- Where is my data stored? (On your device. Optional account sync coming.)
- Is there an iPhone/Android app? (Install from browser — no app store needed)
- How do I get the AI coach working? (Groq API key — link to groq.com)
- Can I use it at any gym? (Yes standalone; gym integration coming for partner gyms)

#### 5. Feedback
Brief intro: "Found a bug? Got a suggestion? Let us know."
Link or embedded version of the in-app feedback form (see Part 3).

---

### Maintenance workflow

When a feature ships:
1. Move it from "Coming Soon" to "What's New" on the help page
2. Add version number and date
3. Update any relevant guide if the feature has a learning curve
4. Push the updated help page — no app deploy needed

---

## Part 3 — In-App Feedback Form

### Overview

A simple feedback form accessible from within the app. Collects a message and optional email address. Stores submissions in Firestore for review.

---

### Entry points

- Settings page — "Send feedback" button near the bottom
- Help page (`betalog.co.uk/help`) — Feedback section links back to the in-app form or embeds a version of it

---

### Form fields

1. **Message** — textarea, required. Placeholder: "Bug report, feature request, or anything else..."
2. **Email** — text input, optional. Placeholder: "your@email.com — only if you'd like a reply"
3. **Submit** button

No login required. Anonymous submissions are fine.

---

### Submission behaviour

On submit:
- Validate message is not empty
- Write to Firestore: `feedback/{autoId}` with fields: `message`, `email` (null if blank), `submittedAt`, `userId` (if logged in, else null), `appVersion`
- Show success state: "Thanks — feedback received."
- Clear form

On error: show "Something went wrong — try again." Do not lose the message content.

---

### Firestore structure

```
feedback/
  {autoId}/
    message:     string
    email:       string | null
    submittedAt: ISO datetime
    userId:      string | null
    appVersion:  string          // e.g. "4.3"
```

No Firestore rules required beyond write-only for all users (no read from client).

---

## Part 4 — Version History in Settings

### Overview

A small collapsible section at the bottom of the Settings page listing recent app versions and what changed. Hardcoded in the app — updated with each release.

---

### UI

Collapsed by default. Header: "Version history" with a chevron. Tapping expands the list.

Each entry:
- Version number (e.g. v4.3) + date
- 2–3 line items of what changed

Only show the last 5–6 versions — this is not a full changelog, just recent history. Oldest entries can be dropped as new ones are added.

---

### Content format (hardcoded array in component)

```js
const VERSION_HISTORY = [
  {
    version: "4.3",
    date: "March 2026",
    changes: [
      "Migrated to React — faster, installable as PWA",
      "Firebase account sync",
      "Hangboard timer improvements",
    ]
  },
  // ... older entries
]
```

---

## Deferred — not building yet

All of the above is deferred until after initial post-launch stabilisation. Priority order when ready to build:

1. Version history in Settings — trivial, do this first
2. `?` button + help page — high value for Redpoint pilot, low build effort
3. Feedback form — straightforward Firestore write
4. Activity session type — larger data model + UI change, do last
