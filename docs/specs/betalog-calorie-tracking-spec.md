# BetaLog — Calorie Tracking Feature Spec

**Date:** May 2026  
**Status:** **Built** — MET tables and `estimateSessionKcalMid()` in `src/lib/stats.js`  
**Scope:** Cardio exercise types only (initial phase)

> Shipped as an estimate shown under the cardio chart, per-window and per-bucket. Two later decisions
> are recorded in `DEVLOG.md` (2026-08-21): the MET values were corrected on the 19th, and calories were
> considered and **rejected** as a unit on the activity calendar — an estimate that shifts when weight or
> MET values change does not belong on a line answering "what did I do".

---

## Background

Discussion triggered by reviewing a logged swim session (Fri 22 May 2026):
- Activity: Breaststroke swim
- Duration: 30 min
- Distance: 20 lengths (660m)
- Effort: Moderate
- User weight at time: 94.3 kg (from weigh-in Thu 21 May)

Manual estimate for that session: **~320–360 kcal**

---

## Goal

Add a calorie burn estimate to cardio exercise log entries in BetaLog. Directional estimates shown as a range, not a single precise figure.

---

## Approach

Use MET (Metabolic Equivalent of Task) values combined with:
- User's most recent logged body weight
- Exercise duration
- Effort level (as a proxy for intensity)
- Exercise/activity type
- Stroke type (swimming only)

**Formula:**

```
kcal = MET × weight_kg × duration_hours
```

Where MET is selected from a range based on effort level.

---

## MET Reference Values

### Swimming

| Stroke | Easy | Moderate | Hard |
|---|---|---|---|
| Breaststroke | 4.8 | 5.5 | 6.8 |
| Front crawl | 4.5 | 6.0 | 8.3 |
| Backstroke | 4.5 | 5.5 | 7.5 |
| Butterfly | 7.0 | 9.0 | 11.0 |
| General / unspecified | 4.5 | 5.5 | 7.0 |

### Other Cardio (to be extended)

| Activity | Easy | Moderate | Hard |
|---|---|---|---|
| Cycling (indoor) | 5.5 | 8.0 | 12.0 |
| Running | 7.0 | 9.0 | 12.0 |
| Walking | 2.5 | 3.5 | 4.5 |
| Rowing | 4.5 | 7.0 | 10.0 |

---

## Display

Show as a kcal range, not a single number, to set honest expectations.

Example: `~320–360 kcal`

Range is calculated using the lower and upper MET bounds for the given effort band.

Display location: within the session detail card, alongside Duration and Distance.

Do **not** show on strength/train exercises (initial phase).

---

## Data Requirements

### Weight
- Use most recent weigh-in entry prior to or on the exercise date
- If no weigh-in exists: show `—` or prompt user to log weight
- Do not fall back to a default/assumed weight

### Swim stroke type
- New optional field on Swim log entries: `strokeType`
- Options: `breaststroke` | `front_crawl` | `backstroke` | `butterfly` | `general`
- Default: `general` if not specified
- Affects MET lookup

### Effort level
- Already exists in BetaLog: Easy / Moderate / Hard
- Maps directly to MET range bands

---

## Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| No heart rate data | ±20–30% accuracy loss vs HR-based estimate | Use effort level as proxy; show range not single value |
| Fitness level not tracked | Trained athletes burn less at same effort | Accepted limitation; no mitigation in v1 |
| Weight is a snapshot | May be days/weeks stale | Use most recent entry; flag if >14 days old |
| Effort is subjective | User's "Moderate" varies | Accepted; directional value still useful |
| Pool length assumed (33m) | Breaks for non-standard pools | Document assumption; consider making configurable |
| Stroke type is optional | Falls back to general MET | Prompt user to add stroke type for better accuracy |

---

## Out of Scope (v1)

- Strength / Train exercise calorie estimates (MET values exist but volume/load calculation is complex)
- Daily calorie total / dashboard summary
- Calorie goal setting
- Integration with food/nutrition logging
- Heart rate-based calculation

---

## Notes

- Breaststroke burns **~10–15% more** than front crawl at matched moderate effort, due to drag from frog kick recovery phase. Front crawl is more efficient and only overtakes at vigorous/competitive pace.
- Butterfly is significantly higher burn than all other strokes.
- This is directional data — Strava, Garmin etc. all show estimates. Users accept this as long as it's consistent.

---

## Implementation Checklist

- [ ] Add `strokeType` field to Swim exercise definition
- [ ] Add `strokeType` selector to Swim log entry form
- [ ] Build MET lookup function (exercise type + stroke + effort → MET range)
- [ ] Build calorie calc util: `estimateCalories(metRange, weightKg, durationMins)`
- [ ] Fetch most recent weigh-in for exercise date in session detail view
- [ ] Render kcal range in session detail card (cardio only)
- [ ] Handle missing weight gracefully (show `—` + prompt)
- [ ] Flag stale weight (>14 days) with a subtle indicator
