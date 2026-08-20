# BetaLog — Information Architecture Declutter

**Status:** planned, not started · **Written:** 2026-08-19

Plan and Dashboard have both accumulated by addition. Nothing is broken, but the same fact now
appears in more than one place, Plan buries its most-used feature three levels down, and the
Dashboard is a single unbroken scroll. This is the plan to fix that with two rules and four phases.

---

## The two rules

Everything below follows from these. If a future change conflicts with them, the rules win or they
get rewritten deliberately — not eroded.

### Rule 1 — Plan is where you change things. Dashboard is where you read them.

A read-only readout sitting on a Plan tab is a candidate for deletion. An editor sitting on the
Dashboard is a candidate for becoming a link. The exception is a *shortcut*: a one-tap action on a
read-only card (like "log it" on today's scheduled routine) is allowed, because it saves a
navigation rather than duplicating an editor.

### Rule 2 — One fact, one home.

If two screens compute the same number, one of them is deleted, not restyled. Where both genuinely
need it, the calculation lives in `src/lib/stats.js` and both call it — never two implementations.

---

## Audit — what is actually duplicated

| Fact | Appears in | Verdict |
|---|---|---|
| Grade distribution, project/flash/send% | `LevelCard` (Dashboard) **and** `ClimbingStats` (Plan → Profile) — both from `calcDisciplineStats` | **Merge.** Distribution becomes LevelCard's expanded body; remove from Profile |
| Weight, BMI, category | `WeightCard` (Dashboard) **and** the readout block in `ProfileTab` | **Split by Rule 1.** Profile keeps the inputs; the readout lives only in WeightCard |
| BMI category thresholds | `BMI_CATS` in `WeightCard.jsx:4` **and** `bmiCategory()` in `ProfileTab.jsx:42` | **Duplicate logic.** Extract one copy into `stats.js` |
| Today's scheduled routines | `ScheduleNotice` (Dashboard, read + log shortcut) **and** `ScheduleCard` (Plan, the editor) | **Keep both** — this is Rule 1 working correctly, not duplication |
| Goals | `GoalsSection` (Plan → Profile) **and** `GoalsWidget.jsx` | `GoalsWidget` (60 lines) is imported nowhere. **Dead code — delete** |

---

## Standard widget anatomy

Today only `ActivityCalendar` collapses, via local `useState` that resets on every navigation. That
does not scale to several widgets. One shared shell instead:

```
┌──────────────────────────────────────────┐
│ [icon] LABEL          summary value  [v] │  ← always visible, whole row is the toggle
├──────────────────────────────────────────┤
│ body — charts, breakdowns, detail        │  ← collapsible
└──────────────────────────────────────────┘
```

**Contract every dashboard widget follows:**

1. **Collapsed still says something.** The header carries the headline number, so collapsing hides
   detail, never the answer. A widget that goes blank when collapsed has its summary in the wrong
   place.
2. **State persists**, in `profile.widgetCollapsed` — a `{key: bool}` map alongside the existing
   `dashWidgets` and `widgetOrder`. Same store, so it syncs across devices for free.
3. **Chart-heavy widgets default collapsed**; glanceable ones default expanded. This is the part
   that makes the whole exercise worth doing — see the warning below.
4. **Collapse is disabled in edit mode**, so a tap meant for the drag handle can't fold the card.
5. `ActivityCalendar` migrates onto the shell and loses its bespoke `defaultExpanded` prop.

> **The load-bearing detail:** moving the grade charts onto the Dashboard only declutters if they
> arrive collapsed. Otherwise the scroll simply moves from Plan to Dashboard and nothing is gained.

Widget budget: `MAX_WIDGETS = 10`, 8 defined today. Folding the grade charts into the existing
`boulderLevel` / `ropeLevel` widgets rather than adding two new keys keeps two slots free.

---

## Plan tab structure

**Today:** `Profile | Exercises | Routines` — with the schedule editor buried at the top of
Routines, above the routine list, and calendar-reminder setup living somewhere else entirely
(Settings sheet).

**Proposed:** four tabs, ordered by how often they're opened.

| Tab | Holds | Moved from |
|---|---|---|
| **Schedule** | `ScheduleCard` + calendar-reminder subscribe/revoke | Top of Routines; Settings sheet |
| **Routines** | Training / Hanging / Climbing routines only | — |
| **Exercises** | Exercise library | — |
| **Goals** | Climbing and weight goals | Was *Profile* — see decision 4 |

Rationale: Schedule is a destination, not a preamble to Routines. Putting the calendar-subscribe
button next to the schedule it publishes is Rule 2 applied to *actions* — the thing and its setup in
one place, rather than the schedule in Plan and its delivery mechanism in Settings.

**Not a bottom-nav tab.** The bottom nav has 5 items at `flex-1`; a 6th puts them near 62px wide on
a phone, and Schedule isn't opened as often as Log or History.

---

## Phases

Each ships and reverts independently.

**Phase 0 — invisible tidy.** Delete `GoalsWidget.jsx`. Extract BMI categorisation into `stats.js`
with a unit test. No user-visible change; makes the later phases smaller.

**Phase 1 — Plan tabs.** Add the Schedule tab, move `ScheduleCard` into it, move the calendar
section out of the Settings sheet. Cheapest change, biggest immediate relief.

**Phase 2 — the widget shell.** Build the collapsible shell + `profile.widgetCollapsed`. Apply to
`AlcoholFreeCard` (565 lines, the tallest card), then `ActivityCalendar`, `CardioStatsCard`,
`GymStatsCard`. This is the only phase with genuinely new logic.

**Phase 3 — ✅ done 2026-08-20 — the dedup, and Profile becomes Goals.** Fold `GradeChart` into `LevelCard`'s
collapsible body, remove `ClimbingStats` from Profile, drop the read-only weight/BMI readout from
`ProfileTab`. Then decision 4: widget picker into Dashboard edit mode, name and height into Settings,
tab renamed **Goals**.

Phase 3 depends on Phase 2. Phases 0 and 1 depend on nothing.

---

## Decisions — settled 2026-08-19

1. **Collapse state syncs**, stored in `profile.widgetCollapsed` beside `widgetOrder`. Fold a widget
   on the phone and it is folded on the laptop. Rejected `localStorage` (less code, but the two
   devices drift and a reinstall loses it).
2. **Defaults: charts folded, numbers open.** Collapsed — alcohol, activity calendar, cardio stats,
   gym stats. Expanded — training load, boulder level, rope level, coach tip, weight. You land on
   headline numbers and open the charts you want. Rejected all-collapsed (reads as empty on first
   run) and all-expanded (delivers no declutter without per-device manual work).
3. **Calendar setup moves to the Schedule tab**, out of the Settings sheet, so the schedule and the
   mechanism that delivers it sit together. Accepted cost: it is arguably a setting, so expect to
   look in Settings out of habit for a while.

### 4. Profile becomes Goals — settled 2026-08-20

The original audit missed a duplication. **Which widgets exist** is a checkbox list in Plan → Profile
writing `dashWidgets`; **what order they appear in** is drag-and-drop behind "Edit layout" on the
Dashboard, writing `widgetOrder` (`Dashboard.jsx:185`). One concern, two screens — Rule 2. It is also
Rule 1: the picker is not a fact about the athlete, it is configuration for a different screen.

So the tab is taken apart rather than renamed:

| Was on Profile | Goes to | Why |
|---|---|---|
| Dashboard widget picker | Dashboard "Edit layout" mode | Joins `widgetOrder`; you choose widgets while looking at them |
| Name, height | ~~Settings sheet~~ **already there** | `SettingsSheet` has edited both since before this spec. The Plan tab only *displayed* them, so this was a deletion, not a move — Rule 1, a read-only readout on a Plan tab. |
| Weight / BMI readout | *deleted* | Already a phase-3 deletion — `WeightCard` owns it |
| `ClimbingStats` | *deleted* | Already a phase-3 deletion — `LevelCard` owns it |
| `GoalsSection` | stays, tab renamed **Goals** | The only thing left, and the only one you revisit |

Leaves Plan as `Schedule | Routines | Exercises | Goals` — four things you actively plan, on a page
called Plan. "Profile" was a noun among verbs.

**Accepted costs.** Height moves somewhere less obvious, and it is a real input, not a preference —
if the BMI readout ever goes blank this is the first place to look. And the widget picker becomes
modal: you must enter edit mode to reach it, where today it is always visible on a tab.

**Note for Phase 2:** the picker landing in edit mode means the shell's "collapse is disabled in edit
mode" rule now shares a screen with widget *selection*. Build the shell so edit mode is a single
clearly-signposted state, not two overlapping ones.

## Explicitly out of scope

Bottom-nav changes, the widget cap, dashboard drag-and-drop reordering, and any change to what the
widgets actually calculate. This is about where things live, not what they say.
