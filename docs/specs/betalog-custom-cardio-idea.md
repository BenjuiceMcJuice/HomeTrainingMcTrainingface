# BetaLog — Ideas & Feature Notes

---

## Idea 1: New "Sport" Cardio Tile + MET-Based Calorie Calc

### The Problem
The "Log Other" cardio sheet has a free-text "Activity name..." field with no calorie logic. Mixing known sports (with reliable MET values) and genuinely misc activities in the same bucket is messy.

### The Solution: Split into Sport + Other

Add a **Sport** tile to the Cardio picker alongside the existing ones:

**Swim / Walk / Run / Cycle / Yoga / Sport / Other**

- **Sport** → searchable dropdown of common activities with known MET values baked in. Calorie calc is automatic.
- **Other** → stays as free text for genuinely misc stuff (gardening, moving house, etc.). Uses a default MET of `5.0` or no calc at all.

### UI Flow — Sport
1. User taps **Sport** from the Cardio picker
2. Searchable dropdown of activities appears
3. User picks e.g. "Squash" → MET stored silently in background
4. Duration + effort captured as normal → calc fires on Save Session
5. Calorie range appears in the feed card just like Walk/Run

### Calorie Calculation Model

```
kcal = MET × weight_kg × (durationMins / 60) × effort_modifier
```

**Example — 40 min easy basketball (~80kg):**
`6.5 × 80 × 0.667 × 0.8 ≈ 277 kcal`

**Effort modifiers:**
| Effort    | Modifier |
|-----------|----------|
| Easy      | 0.8      |
| Moderate  | 1.0      |
| Hard      | 1.25     |
| Very Hard | 1.5      |
| Max       | 1.75     |

User weight sourced from most recent weigh-in entry at log time.

---

### Full MET Lookup Table

```js
const SPORT_MET_VALUES = {
  "Badminton":                  5.5,
  "Basketball (casual)":        6.5,
  "Basketball (competitive)":   8.0,
  "Boxing (bag work)":          6.0,
  "Boxing (sparring)":          9.0,
  "Cricket":                    4.8,
  "Cycling (leisure)":          4.0,
  "Cycling (racing)":           10.0,
  "Dancing":                    4.8,
  "Football (casual)":          7.0,
  "Football (competitive)":     10.0,
  "Golf (walking)":             4.3,
  "Gymnastics":                 3.8,
  "Hiking":                     5.3,
  "Hockey":                     8.0,
  "Kayaking":                   5.0,
  "Martial Arts":               10.0,
  "Netball":                    6.5,
  "Padel":                      6.0,
  "Paddleboarding":             6.0,
  "Rowing (moderate)":          7.0,
  "Rugby":                      8.3,
  "Skateboarding":              5.0,
  "Skiing":                     7.0,
  "Snowboarding":               5.3,
  "Squash":                     12.0,
  "Surfing":                    3.0,
  "Swimming (leisure)":         6.0,
  "Swimming (laps)":            8.0,
  "Table Tennis":               4.0,
  "Tennis (casual)":            7.3,
  "Tennis (competitive)":       8.0,
  "Volleyball":                 4.0,
  "Weightlifting":              3.5,
  "Wrestling":                  6.0,
}
```

---

### Open Questions
- [ ] Is user weight accessible at log time? Most recent weigh-in is the obvious source
- [ ] Keep free-text fallback in Sport with generic MET `5.0`, or force a list selection?
- [ ] Other tile: show estimated kcal at all, or just log time/effort with no number?

---

## Idea 2: About / How-To Page

A standalone web page (separate from the app) explaining how BetaLog works in a clean, approachable layout.

**Target audience:** new users, or anyone being shown the app for the first time (e.g. gym pilot at Redpoint Bristol).

### Format Options
- Hosted at `betalog.co.uk/how-it-works` or similar
- Or a separate static page linked from the app's settings/onboarding screen

### Content Sections to Consider
- What BetaLog is (one punchy paragraph)
- How to log a session (cardio, strength, weigh-in)
- How the calorie estimates work
- What the AI coaching does
- How the friends/feed system works
- FAQ (e.g. "why is my grade not updating?" — known bug)

### Design Direction
- Mobile-first, big text, minimal chrome
- Scroll-snap single-pager style
- Screenshots or simple illustrations per section
- Plain HTML/CSS or React — no Firebase needed

### Open Questions
- [ ] Public-facing marketing page, or in-app onboarding flow? (Different design priorities)
- [ ] Should it link to sign-up, or purely informational?
- [ ] Worth building before the Redpoint gym pilot as a leave-behind?

---

## Related
- Weigh-in data already tracked in BetaLog (visible in feed)
- Existing hardcoded cardio burn calc to be replaced/supplemented by Idea 1
- Groq already integrated for AI coaching — escape hatch pattern reuses same setup
