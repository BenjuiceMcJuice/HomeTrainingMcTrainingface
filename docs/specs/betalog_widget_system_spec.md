# BetaLog — Dashboard widget system

> Written 2026-08-20. Planned, not built.

The declutter (`betalog_ia_declutter_spec.md`) fixed *where things live*. This one is about the
Dashboard widgets **behaving like each other** — right now they don't, and the differences are
accidental rather than designed.

---

## The audit

Eight widgets, plus the activity calendar. What they actually do today:

| Widget | Lines | Collapsible | Timeframe control | Chart | Border |
|---|---|---|---|---|---|
| `TrainingLoad` | 113 | no | no — fixed 7d/30d | no | `#fde68a` |
| `GymStatsCard` | 52 | no | no — fixed 90d | no | `#c7d7fd` |
| `CardioStatsCard` | 161 | yes | `7d / 90d` | no | `#99e6d8` |
| `LevelCard` ×2 | 170 | yes | `90d / All time` | yes | `#f5c9a8` |
| `AlcoholFreeCard` | 575 | yes | `30d / 12w / 12m` | yes | inline, dynamic |
| `CoachTip` | 83 | no | no | no | `#e5e7ef` |
| `WeightCard` | 91 | no | no — fixed 30d avg | no | `#a7e6c6` |
| `ActivityCalendar` | 207 | yes | month stepper | no | `#e5e7ef` |

### Five findings

**1. The activity calendar is not a widget.** It is absent from `DEFAULT_ORDER`
(`Dashboard.jsx:34`) and from `WIDGET_OPTS` in `WidgetPicker.jsx`, and is rendered hardcoded *after*
the Edit layout button (`Dashboard.jsx:224`). It cannot be reordered, cannot be switched off, and
does not count against `MAX_WIDGETS` — yet it carries a collapse chevron exactly like the widgets do,
so it looks like one. This is the single biggest inconsistency on the screen.

**2. The calendar does not show all activities.** `DOT_COLOR` covers `gym`, `climb` and `hangboard`
only. **Cardio sessions render no dot at all** — a swim or a run simply does not appear. The legend
does not mention cardio either, so nothing signals the omission.

**3. Timeframe chips speak three different languages.** Same-looking controls, different concepts:

| Card | Chips | What they mean |
|---|---|---|
| Alcohol | `30d / 12w / 12m` | bucket *granularity* — 30 daily, 12 weekly, 12 monthly buckets |
| Cardio | `7d / 90d` | window *length* |
| Level | `90d / All time` | window vs everything |

"12w" and "90d" look like the same kind of chip and are not. Three fixed windows are also
unadjustable and mostly unstated: training load 7d/30d, weight 30d average, gym 90 days — and gym
computes its window as `daysAgo(89)` while elsewhere the codebase uses
`filterSessionsByDays(sessions, 90)`. Same window, two expressions.

**4. The collapse affordance is small, and got smaller.** The chevron is a 16px icon with `p-1`
padding — roughly a **24px tap target**, well under the ~44px normally recommended for touch.
`ActivityCalendar` previously used its *entire header row* as the toggle; phase 2 of the declutter
replaced that with the small chevron. That was a regression, introduced by me, not noticed at the
time.

**5. Collapse exists on four of nine.** The rule is "has a body worth hiding", which is sound — but
invisible. A user sees chevrons on some cards and not others with no way to know why. Giving cardio
and gym real bodies (below) removes the exception rather than explaining it.

---

## Two rules

Carried in the spirit of the declutter's rules, which held up well.

**1. Every widget is the same shape.** Header, then body. The header carries the headline and is the
collapse control. The body carries detail and any control that changes the detail. A widget that
cannot fill a body does not get a chevron — and that should be rare enough to notice.

**2. One vocabulary for time.** A chip labelled `90d` means the same thing on every card: *the window
of data being summarised*. How a chart buckets that window is the chart's business, not the user's.

---

## Widget anatomy

```
┌─────────────────────────────────────────────┐
│ ICON   HEADLINE NUMBER + unit          ⌃    │  header — whole row is the tap target
│        one line of context                  │
├─────────────────────────────────────────────┤
│  [30d] [90d] [12m]                          │  body — window chips first
│                                             │
│  …chart / detail…                           │
│                                             │
│  legend                                     │
└─────────────────────────────────────────────┘
```

- **The whole header row toggles collapse**, chevron included. This is what fixes finding 4.
- **No interactive controls in the header.** Nested buttons are invalid HTML and ambiguous to tap,
  which is exactly why the chips must move down. `LevelCard` already works this way after
  2026-08-20, so the pattern exists rather than being invented here.
- **Chips live at the top of the body**, because they change the body.
- **Collapsed still says something** — unchanged from the declutter's contract.

### Timeframe vocabulary

Standardise on window length: **`30d` · `90d` · `12m`**, not every card offering all three.

| Card | Offers | Default |
|---|---|---|
| Alcohol | 30d / 90d / 12m | 90d |
| Cardio | 30d / 90d / 12m | 90d |
| Gym | 30d / 90d / 12m | 90d |
| Level ×2 | 90d / All time | 90d |
| Training load | — (a 7d:30d ratio; the windows *are* the metric) | — |
| Weight | 30d / 90d | 30d |
| Calendar | month stepper (it is a calendar) | this month |

Alcohol's current chips choose bucket granularity; under this rule the card derives granularity from
the window — 30d → daily bars, 90d → weekly, 12m → monthly — so the same chip means the same thing as
it does on cardio.

**Decided 2026-08-21: per-card, and persisted.** The window lives in `profile.widgetWindow`, a
`{key: window}` map beside `widgetCollapsed`, so it syncs across devices and survives a reload. A
single dashboard-wide window in `profile.dashWindow` reads as more coherent but takes away looking at
12 months of drinking beside 30 days of cardio, which is most of why the cards carry separate chips
at all. Built in phase B — `lib/widgetWindow.js` owns the options, defaults and validation;
`hooks/useWidgetWindow.js` is what components call.

### Colour

Border colours are currently decorative and arbitrary. Two options, needs a decision:

- **Keep per-card accents**, but derive them from one palette so they are a family rather than six
  unrelated choices.
- **Neutral borders throughout**, with colour used only inside the card (bars, chips, level badges),
  so colour always *means* something.

Recommendation: neutral borders. Six coloured outlines on one scroll is where "cheap" comes from, and
every card already carries its own accent internally.

---

## Cardio and gym charts

Both cards are one-liners today — a count and a summary sentence. Neither answers *am I doing more or
less than I was*, which is the question a training log exists to answer.

**Cardio** — bars over the selected window, one per bucket. Value = duration by default; the card
already computes distance and kcal, so those are candidate toggles later. Beneath: totals and the
existing goal progress bars.

**Gym** — bars over the selected window, value = sets. Beneath: the existing "most-trained muscle
group" line, which becomes more useful next to a trend.

Both reuse the bar renderer that `AlcoholTimeline` already implements — **extract it** rather than
writing a third one. That extraction is the real work in this phase; the two cards using it are
small afterwards.

Doing this also removes the collapse exception from finding 5: every widget then has a body.

---

## The activity calendar

**It becomes a real widget**: `activityCalendar` joins `DEFAULT_ORDER` and `WIDGET_OPTS`, so it can be
reordered and switched off like everything else, and it counts against `MAX_WIDGETS` (currently 10,
with 8 defined — room for it plus one).

**It shows every activity type.** Add `cardio` to `DOT_COLOR` and to the legend. Audit
`SessionType` against the map so a future type cannot be silently missing again — a session type with
no dot colour should fall back to a neutral dot, never to nothing.

**Making "what happened when" more obvious.** Today a day carries up to three coloured dots and
nothing else. Options, roughly in order of effort:

1. **Tap a day → a one-line summary** ("Thu 20: Gym · 4 climbs to V4 · 2 drinks"). The data is all
   present; History already renders this shape.
2. **Intensity, not just presence** — dot size or fill by session volume, so a heavy week reads
   differently from a light one at a glance.
3. **A week-strip mode** — the current month grid is a lot of vertical space for what is usually a
   question about the last fortnight.

Recommendation: 1 first. It is the smallest change and directly answers "what happened when".

**Headline when collapsed.** The calendar currently collapses to the bare words "Activity calendar",
which fails the declutter's contract 1 — a widget that goes blank when collapsed has its summary in
the wrong place. It needs a headline: sessions this month, or current streak.

---

## Phases

Each is independently shippable. Every one changes a screen that works, so **each waits for sign-off
before merging** per the release policy in `CLAUDE.md`.

**Phase A — the shell, properly.** Whole header becomes the tap target; chips move into the body on
cardio and alcohol; calendar's header restored to a full-width control. Small, fixes the regression,
establishes the pattern on cards that already exist. No new data.
**Shipped 2026-08-21** — see `logs/2026-08-21.md`.

**Phase B — one vocabulary.** Standardise chips on `30d / 90d / 12m`, alcohol derives bucket size
from the window, gym's `daysAgo(89)` replaced with the shared helper. Depends on the window-persistence
decision above.
**Shipped 2026-08-21** — see `logs/2026-08-21.md`.

**Phase C — the chart component.** Extract `AlcoholTimeline`'s bars into a reusable component with
its own tests. Nothing user-visible; makes D cheap.

**Phase D — cardio and gym charts.** Both cards gain bodies. Removes the collapse exception.

**Phase E — the calendar.** Becomes a real widget, gains cardio, gains a collapsed headline, gains
tap-a-day detail.

**Phase F — colour.** Whichever way the decision goes. Last because it is the most cosmetic and the
easiest to bikeshed.

C is a prerequisite for D. Everything else is independent.

---

## Decisions needed before building

1. ~~**Window persistence**~~ — **decided 2026-08-21: per-card, persisted** in
   `profile.widgetWindow`. Built in phase B.
2. **Colour** — family of accents, or neutral borders with colour only inside? Affects phase F.
3. **Calendar detail** — is tap-a-day enough, or is the week-strip the thing you actually want?
   Affects phase E.

Nothing in phase A depends on any of them.
