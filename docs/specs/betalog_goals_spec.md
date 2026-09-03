# Goals Feature Spec

**Status:** **Built** — `src/components/goals/GoalsSection.jsx`, `Storage.saveGoals`, `Goal` in `types.js`  
**Scope:** Data layer → Plan tab → Dashboard widget → AI Coach context

> Goals are the whole of **Plan > Goals** (the tab was renamed from Profile in the IA declutter,
> 2026-08-20). The `Goal` shape below matches `types.js` as built. Kept as the record of the design.

---

## Overview

Users can set personal goals for climbing grades, bodyweight, and cardio performance, each with a target date. Progress is auto-detected from existing session/weight data. Goals surface in the Plan tab, on the Dashboard, and are injected into the AI Coach context so Groq can give targeted advice.

---

## Goal Types

| Type | Target | Progress source |
|---|---|---|
| `boulder_grade` | V-grade string (e.g. `V7`) | `boulderLevel.level` from `stats.js` |
| `rope_grade` | French grade string (e.g. `7a`) | `ropeLevel.level` from `stats.js` |
| `weight` | number (kg) | latest entry in weight log |
| `run` | number (km) | best `distance` across run cardio sessions |
| `swim` | number (km or lengths) | best `distance` across swim cardio sessions |
| `cycle` | number (km) | best `distance` across cycle cardio sessions |

Hangboard goals (e.g. edge size / hang duration) deferred — hard to auto-detect from current session schema.

---

## Data Model

```js
// Goal object
{
  id:            string,          // uuid
  type:          string,          // see Goal Types table above
  target:        string | number, // grade string or numeric value
  unit:          string | null,   // 'kg', 'km', 'lengths' — null for grades
  targetDate:    string,          // ISO date YYYY-MM-DD
  startValue:    string | number, // value at goal creation (for progress bar baseline)
  createdAt:     string,          // ISO timestamp
  achieved:      boolean,
  achievedDate:  string | null,   // ISO date when auto-detected as hit
}
```

Goals stored at `data.goals` (array) in localStorage, synced to Firestore alongside other user data via existing `syncToFirestore` mechanism.

---

## Progress Calculation

Progress is a 0–1 float from `startValue` → `target`, capped at 1.0.

**Grades:** use grade array index position from `stats.js` (`V_GRADES` / `FRENCH_GRADES`). Progress = `(currentIdx - startIdx) / (targetIdx - startIdx)`.

**Numeric (weight, cardio):** linear. Progress = `(current - startValue) / (target - startValue)`. For weight loss, invert: `(startValue - current) / (startValue - target)`.

**Auto-achieve:** on each app load (or after a session save), check all incomplete goals. If `currentValue >= target` (or `<=` for weight loss), set `achieved = true` and `achievedDate = today`.

---

## Hook — `useGoals`

```
src/hooks/useGoals.js
```

Methods:
- `addGoal(goal)` — generates id + createdAt + startValue (reads current stats at creation time)
- `updateGoal(id, updates)`
- `deleteGoal(id)`
- `checkAndAchieve(sessions, weightLog)` — runs auto-achieve logic, called after any session/weight save

---

## Plan Tab — Goals Section

Location: Profile tab in Plan, below athlete profile card (above or below weight trend — TBD).

### Goal card (active)

```
┌─────────────────────────────────────┐
│ 🧗 Boulder Grade                    │
│                                     │
│   V4 ──────████░░░░── V7            │
│   Currently V5 · 2 grades to go     │
│                      47 days left   │
└─────────────────────────────────────┘
```

- Progress bar: filled portion = calculated progress (0–1)
- "X days left" — amber when ≤ 30 days, red when ≤ 7 days
- Tap card → edit sheet (change target or date; cannot change type)
- Long press or swipe → delete with confirm

### Goal card (achieved)

```
┌─────────────────────────────────────┐
│ ✅ Boulder Grade — V7               │
│   Achieved 12 Apr · goal was 1 Jun  │
└─────────────────────────────────────┘
```

Compact green row. Stays visible as history. Separate "Achieved" section below active goals.

### Add goal sheet

Slide-up sheet. Fields:
1. **Type** — pill selector: Boulder / Rope / Run / Swim / Cycle / Weight
2. **Target** — grade chip grid (for climbing) or numeric input + unit label (others)
3. **Target date** — date picker

On save: `startValue` is auto-populated from current stats (user never sets it).

---

## Dashboard Widget

Location: Dashboard, between Training Load and Activity Calendar (approximate — exact position TBD).

Only shown if user has at least one active goal.

```
┌─────────────────────────────────────┐
│ Goals                               │
│                                     │
│ 🧗 Boulder V7   ████░░░░  47 days  │
│ 🏃 Run 10km     ██████░░  23 days  │
│ ⚖️  75kg        ████████  8 days   │
└─────────────────────────────────────┘
```

- One row per active goal: icon + label + mini progress bar + days remaining
- Days remaining coloured amber/red by same thresholds as Plan cards
- Tapping the card navigates to Plan > Profile tab (Goals section)
- Achieved goals not shown on Dashboard

---

## AI Coach Context

In `Coach.jsx`, the context blob passed to Groq gains a Goals section:

```
GOALS:
- Boulder Grade: currently V5, target V7 by 2026-07-13 (47 days). Progress: 33%.
- Run: best session 6.2km, target 10km by 2026-06-19 (23 days). Progress: 62%.
- Bodyweight: currently 78kg, target 75kg by 2026-06-02 (8 days). Progress: 80%.
```

This enables advice like:
- Flagging that a deadline is close relative to current progress
- Suggesting specific session types to close a grade gap
- Noting contradictions (e.g. weight goal vs high training volume)

No prompt engineering needed — Groq picks up goal context naturally from the text.

---

## Build Order

1. `useGoals.js` hook + data model + `checkAndAchieve` logic
2. `stats.js` — export grade arrays so goal progress calc can use them
3. Plan tab — Goals section with add sheet + active/achieved cards
4. Dashboard — Goals widget
5. Coach.jsx — inject goals into context string

---

## Out of Scope (this version)

- Hangboard goals (edge/duration) — schema doesn't support reliable auto-detect yet
- Time-based cardio goals (e.g. 5km in under 25 min) — needs distance + duration combo logic
- Push notifications when a goal is achieved
- Social goals / sharing with friends
