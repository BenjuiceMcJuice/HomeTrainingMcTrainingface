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

## Weight goals — the rate they imply *(added 2026-09-04)*

A weight goal is a distance and a date, which together are a **rate**. `lib/weightRate.js` works it out
and judges it; the Dashboard weight card shows it, and the goal sheet gates on it. Both read the same
function, so the app can never refuse a goal it would then quietly recommend.

### The limit, and where it comes from

| Band | Loss, % of bodyweight per week | Behaviour |
|---|---|---|
| Steady | ≤ 0.7% | shown, no comment |
| Brisk | 0.7 – 1.0% | shown in amber, with a note |
| Too fast | > 1.0%, **or** > 1 kg/week | shown in red, **and cannot be saved** |

- **1 kg/week absolute.** [NHS weight-loss guidance](https://www.nhs.uk/better-health/lose-weight/) is
  0.5–1 kg (1–2 lb) a week off roughly a 600 kcal daily deficit, and is explicit that heavier
  restriction without medical supervision risks missing nutrients.
- **1% of bodyweight per week.** A flat kg figure is the wrong shape for a climbing app — 1 kg/week
  off 55 kg is nearly twice the ask it is off 100 kg. In elite athletes,
  [Garthe et al. (2011)](https://pubmed.ncbi.nlm.nih.gov/21558571/) compared 0.7%/week against
  1.4%/week for the same total loss: the slower group gained lean mass and improved countermovement
  jump and bench press, the faster group did not. 0.7% is therefore the top of *steady*, not a
  warning threshold, and past ~1% the speed is being paid for in lean tissue — the opposite of the
  point in a sport scored on strength-to-weight.

  **0.7% is a ceiling, not a target.** The study compared 0.7 against 1.4 and nothing slower, so it
  shows what 1.4%/week costs, not that 0.7% beats 0.5%. Slower is fine and generally at least as
  good for body composition; it simply takes longer. Nothing in the app nudges anyone towards 0.7% —
  it is the last rate with nothing to say about it.
- Both ceilings apply and the tighter wins: the proportional one binds below 100 kg, the absolute
  one above it. With no weigh-in and no profile weight, only the absolute ceiling is available and
  the sheet says so.

### Gains are flagged, never blocked

Realistic lean gain is ~0.25–0.5% of bodyweight a week; above that a goal is unrealistic rather than
unsafe. Refusing it would be the app overreaching — the hard stop exists for the health risk that
comes with rapid *loss*.

### What is deliberately not checked

The rule is about **rate, not destination**: nothing here judges whether the target weight itself is
sensible for the person. A BMI floor on the target (RED-S is a real risk in climbing) is a separate
question and is not built.

Existing goals are not migrated or invalidated. One saved before this rule, or overtaken by its own
target date, still shows — in red, with what it is asking for.

### Where the words live *(revised 2026-09-04, after seeing it on a phone)*

The first build put the full explanation on the Dashboard card, and on a real screen it was three
lines of red prose in a widget whose job is a number at a glance.

- **Dashboard card:** the pace only — `Lose 1.33 kg/wk · 5.8 kg/month · 57d left`. Colour carries the
  verdict (grey / amber / red); no sentence.
- **Plan › Goals:** the pace *and* the reasoning, on every weight goal — including a steady one,
  which now says what a healthy rate would be rather than staying silent. The goal is where you go to
  understand or change it.
- **Goal sheet:** unchanged — the pace, the reason, and Save disabled when a loss is too fast.

---

## Backlog — an achievability rating *(idea, 2026-09-04, not built)*

Sessions already carry `difficulty: 1|2|3|4|5` ("session feel", perceived effort) with a chip
selector in `ClimbLogger` and `CardioLogSheet`. The same 1–5 shape could score a goal's
**achievability** when it is set, and keep scoring it as the data comes in:

- **Weight** — the rate work above is most of the input already: `pctPerWeek` against the bands gives
  a 1–5 directly, and the trend (is the line actually moving that way?) could adjust it.
- **Climbing** — from the athlete's own history rather than a table: how far the target grade is from
  the current consistent grade, how long previous grade jumps took, and recent volume and frequency.
  "V4 → V5 in 57 days" is a different ask for someone climbing four times a week than for someone
  logging two sessions a month, and BetaLog already holds both numbers.

Worth doing as one system, so a goal of any type carries a comparable score, rather than a bespoke
rule per type. Not specced beyond this.

---

## Backlog — the coach should actually coach the goals *(idea, 2026-09-04, not built)*

**What already works:** `buildContext` in `Coach.jsx` puts every active goal into the Groq context
with its current value, target, target date, days remaining and progress percentage. That part is
built and has been for a while.

**What is missing is the asking.** `buildAnalysisPrompt` requests `summary`, `recovery`, `pyramid`,
`plateau` and `actions` — **no goal field at all**. Goals go in as data and nothing in the prompt
requires the model to say anything about them, so whether the advice engages with them is luck. The
fix is a prompt shape, not a data-plumbing job.

### Three things to add

1. **A goals verdict in the JSON.** One entry per active goal: is it on track at the current rate,
   what the data says about that, and the single change that would help most. Distinct from
   `actions`, which is about training behaviour rather than the goal.

2. **The derived numbers, not just the raw ones.** The context sends sessions and a progress
   percentage; the app now computes far more than that, and none of it is in the prompt:
   - `weightRate.assessWeightGoalRate` — kg/week required, percent of bodyweight per week, the band,
     and the healthy ceiling for this athlete. The coach currently cannot say "this goal needs
     1.33 kg/wk, which is above the healthy limit for you", even though the goal sheet refuses to
     save exactly that.
   - `buildAverageTimeline` on the weight log — the actual trend, and whether it points at the target
     or away from it. A goal at 0% progress with the line going *up* is a different conversation
     from one merely behind schedule.
   - Training load (7d:30d), consistent grade, discipline volume, streaks — the form side of
     "goals and current form".

3. **Cross-goal and goal-vs-form contradictions**, which is where a coach earns its keep and no
   single widget can look: a 9.9% cut and a V4 → V5 goal inside the same 57 days pull against each
   other; a weight-loss goal alongside rising training volume; a rope grade goal with no rope
   sessions logged in a month. The original spec already listed contradiction-spotting as the point
   of putting goals in the context — it was never asked for in the prompt.

### Notes

- Goals reach the coach twice: structured `data.goals`, and the free-text `profile.goals` string from
  the Coach tab's own box. Worth resolving which is authoritative before adding more weight to
  either.
- Shares its inputs with the achievability rating above. If both get built, the rating is the number
  and the coach is the sentence — they should agree, which argues for the rating landing first and
  the coach being handed its output rather than re-deriving it.
- Cost: all of this is prompt and context size, no new data. The context already carries 30 days of
  sessions, so the budget is not free.

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
