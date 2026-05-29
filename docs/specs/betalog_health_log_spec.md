# BetaLog — Health Log Feature Spec

**Status:** Planned  
**Created:** 2026-05-29

---

## Overview

Add a **Health** tab to the Log page that consolidates:

1. **Weight logging** — moved here from Plan → Profile (data/hook stays the same; UI entry point changes)
2. **Alcohol logging** — new feature; tracks drink entries with type, volume, ABV, and quantity

A new **Alcohol-free streak** dashboard widget shows consecutive days, weeks, or months without alcohol. All dashboard widgets remain toggleable in the Plan → Profile section.

---

## 1. Data Model

### 1.1 `DrinkEntry`

New type in `src/lib/types.js`. Stored in `BetaLogData.drinkLog`.

```
@typedef {Object} DrinkEntry
@property {string}  id
@property {string}  date         — ISO date "YYYY-MM-DD"
@property {"beer_cider"|"wine"|"spirit"|"other"} type
@property {string|null}  label   — optional descriptor ("Guinness", "Prosecco"), displayed alongside type
@property {number}  volumeMl     — volume per serving in ml (default by type, adjustable)
@property {number}  abv          — ABV as a percentage, e.g. 4.5 (not 0.045)
@property {number}  quantity     — number of servings (default 1, integer or 0.5-step)
@property {number}  units        — derived: (volumeMl × abv × quantity) / 1000  [UK units]
@property {string|null}  note
@property {string}  createdAt    — ISO datetime
```

`units` is **derived and stored** (not recalculated on read) so historical entries remain correct if defaults change.

### 1.2 Default drink presets

| Type | Label | Volume (ml) | ABV (%) | Units per serving |
|---|---|---|---|---|
| `beer_cider` | Beer / Cider | 568 (pint) | 4.5 | 2.6 |
| `wine` | Wine | 175 (glass) | 13.0 | 2.3 |
| `spirit` | Spirit | 25 (measure) | 40.0 | 1.0 |

All four fields (volume, ABV, quantity) are adjustable in the entry sheet before saving. Defaults are just starting values.

### 1.3 `BetaLogData` root object extension

Add `drinkLog: DrinkEntry[]` to the root typedef and to `Storage.load()` migration (default `[]`).

---

## 2. Storage (`src/lib/storage.js`)

- Add `Storage.saveDrinkLog(entries)` — mirrors the pattern of `saveWeightLog`
- Include `drinkLog` in `syncToFirestore` payload and `mergeFromCloud` merge
- Add `drinkLog` key to `STORAGE_KEYS` constant (or equivalent)

---

## 3. Hook: `useDrinkLog.js`

New file at `src/hooks/useDrinkLog.js`. Mirrors the shape of `useWeightLog.js`.

```js
export default function useDrinkLog() {
  // returns:
  // entries     — DrinkEntry[], sorted newest-first by date
  // addEntry(date, type, label, volumeMl, abv, quantity, note)
  // updateEntry(id, updates)
  // deleteEntry(id)
}
```

`addEntry` computes `units = (volumeMl * abv * quantity) / 1000` and stores it on the entry.

---

## 4. UI — Health tab in Log

### 4.1 Tab strip

Add **Health** as a fourth tab in `src/pages/Log.jsx`, alongside Train / Climb / Hang / Cardio.  
Accent colour: **green** (`#2a9d5c`) — health/wellbeing feel, distinct from other tabs.

### 4.2 Health tab content

Two sections stacked vertically inside the tab:

#### Weight section

- Heading: "Weight"
- A single numeric input (kg) + "Log" button — identical to the current weight input in ProfileTab
- Shows last logged weight and date hint below ("logged today", "logged 3d ago")
- Saves via existing `useWeightLog.addEntry` / `updateEntry`
- The weight input in Plan → Profile tab can remain as-is (convenient for quick access) or be removed — TBD at implementation time; keep both initially to avoid regression

#### Alcohol section

- Heading: "Alcohol"
- "Add drink" button opens **DrinkLogSheet** (slide-up sheet)
- Below the button: today's entries listed inline (type label + quantity + units, with delete)
- If no entries today: "None logged today" empty state

### 4.3 `DrinkLogSheet` — slide-up sheet

Follows the GymLogSheet / CardioLogSheet pattern (fixed overlay, white panel from bottom).

**Fields:**

1. **Drink type** — segmented control: Beer/Cider · Wine · Spirit · Other  
   - Selecting a preset fills Volume, ABV with defaults for that type
   - Selecting "Other" shows a free-text label input

2. **Label** (optional, text input) — e.g. "Guinness", "Prosecco"  
   - Auto-hidden unless type is "other" or user taps to expand; keep it optional and unobtrusive

3. **Quantity** — NumericStepper, step 1, min 0.5, default 1  
   - Label: "Drinks"

4. **Volume** — NumericStepper (ml), step 10, min 10, default per type  
   - Label: "ml per drink"

5. **ABV** — NumericStepper (%), step 0.5, min 0.5, default per type  
   - Label: "ABV %"

6. **Units preview** — live-calculated read-only display: "= X.X UK units"  
   - Updates as fields change; colour-coded: green ≤ 2, amber 2–6, red > 6

7. **Note** — optional text input

8. **Date** — defaults to today; tappable to change (date picker or inline text)

9. **Save** / **Cancel** buttons

---

## 5. Stats (`src/lib/stats.js`)

Add `calcAlcoholFreeStreak(drinkLog)`.

**Logic:**

1. Find the most recent `DrinkEntry.date`.
2. Count consecutive days **from today backwards** where no drink entry exists.
3. Return `{ days: number }` — raw consecutive alcohol-free days ending today (or ending at last break point).

**Display rules in the widget:**

| Raw days | Display |
|---|---|
| 0 | "0 days alcohol-free" (or hide / show "logged today") |
| 1–6 | "N days alcohol-free" |
| 7–29 | "N weeks alcohol-free" (floor to nearest week, show remaining days as sub-text) |
| 30–89 | "N months alcohol-free" (floor to nearest month) |
| 90+ | "N months alcohol-free" |

Also return `{ weeks: number, months: number }` for flexibility.

---

## 6. Dashboard widget — Alcohol-free streak

### 6.1 Component: `AlcoholFreeCard`

New card component in `Dashboard.jsx`.

- Rendered when `profile.dashWidgets.alcoholFree === true`
- Fetches `useDrinkLog().entries` (or receives them from parent)
- Calls `calcAlcoholFreeStreak(entries)`
- Displays:
  - Primary: streak value + unit (e.g. **"14"** with label **"weeks alcohol-free"**)
  - Secondary: sub-detail when in weeks/months mode — e.g. "98 days" in smaller text
  - If streak = 0: "Logged today — streak paused" or similar
  - Icon: a small leaf or drop — `Droplets` from Lucide (or `Leaf`)
  - Accent colour: green `#2a9d5c`

### 6.2 Widget toggle

In `src/components/profile/ProfileTab.jsx`, add to `WIDGET_OPTS`:

```js
{ key: 'alcoholFree', label: 'Alcohol-free streak' }
```

The `MAX_WIDGETS` limit is currently 4. With 7 total options available (including Goals, which was made toggleable 2026-05-29), **increase MAX_WIDGETS to 5** to give users meaningful choice without overcrowding the dashboard.

### 6.3 Dashboard render order (suggested)

1. QuickStats strip (always shown)
2. Schedule notice (always shown when applicable)
3. Goals widget (if toggled)
4. Training load (if toggled)
5. Boulder level (if toggled)
6. Rope level (if toggled)
7. Weight & BMI (if toggled)
8. **Alcohol-free streak** (if toggled) ← new
9. Coach tip (if toggled)
10. Activity calendar (always shown)

---

## 7. History feed integration

Drink entries appear inline in `src/pages/History.jsx` alongside weight entries and sessions, grouped by date.

Each entry shows: drink type icon, label (if set), quantity, units total, and a delete button.  
Edit is not required for MVP — delete and re-add.

---

## 8. Firestore sync

`drinkLog` is included in the `users/{userId}` document sync:
- Serialised as an array of `DrinkEntry` objects (same pattern as `weightLog`, `sessions`, etc.)
- Merged on cloud pull: use `mergeFromCloud` array merge by `id`
- No public profile exposure — drink data is private, never exposed to friends

---

## 9. Implementation order

1. **Types + Storage** — `DrinkEntry` typedef, `saveDrinkLog`, `drinkLog` in `BetaLogData` and migration
2. **Hook** — `useDrinkLog.js`
3. **Stats** — `calcAlcoholFreeStreak` in `stats.js`
4. **DrinkLogSheet** — slide-up logging UI
5. **Health tab** — new tab in Log page with weight section + alcohol section
6. **Dashboard widget** — `AlcoholFreeCard`, add to widget toggle options, increase MAX_WIDGETS
7. **History feed** — inline drink entry cards
8. **Build check** — `npm run build` clean, no regressions

---

## 10. Out of scope (this spec)

- Weekly / monthly unit totals on Dashboard (possible follow-on widget)
- Drink type breakdown charts
- Import/export of drink data
- Correlating alcohol days with weight changes (interesting future analysis)
- Notifications or prompts ("you haven't logged today")
