# DEVLOG — BetaLog React Rewrite

Milestone tracker for the React rewrite. Updated when a step is complete, not after every file change.
Granular daily work is in `logs/YYYY-MM-DD.md`.

---

## Route B is live — web push reminders sending — 2026-09-04

Merged, deployed and **verified on a real iPhone**: a reminder fired, the notification appeared, and
tapping it opened the app. The whole chain is proven — cron → KV → due-check → VAPID signing → Apple
→ service worker → notification → tap. Route A is untouched and still works; the two are independent,
as designed.

**What it took beyond the merge**, none of which a cloud session could do: `firebase deploy` for the
rules, `wrangler kv namespace create SUBS`, the VAPID secrets, `wrangler deploy`, the Pages
environment variable, and a phone.

### Three things went wrong, and each is worth keeping

**The rules deploy silently did nothing.** Run from a stale `main` checkout it reported
`already up to date, skipping upload` — a success message for deploying the *vulnerable* rules. The
CLI reads the working tree and knows nothing about branches. Check the output says `released rules`.

**Both VAPID secrets were set to literal placeholder text.** The documented flow printed the two keys
and asked for them to be pasted into two further commands; the placeholders went in verbatim. It
surfaced only as `Invalid EC key ... Point is not on curve` from inside the push library, five
minutes at a time. Now `scripts/rotate-vapid-keys.mjs` generates the pair and pipes both halves
straight to wrangler — nothing displayed, nothing copied, and it refuses anything not 87/43 chars.

**Every send failure was invisible.** `sendDue` swallowed exceptions into `stats.failed` and threw
the stats away inside `ctx.waitUntil`, so a failing send and having nothing to send looked identical:
`outcome=ok`, no logs, no exceptions. Three log lines turned an hour of guesswork into two decisive
answers — first Apple rejecting with `VapidPkHashMismatch`, then a clean `sent:1`.
**The smoke test passes 30 checks against a stubbed push service, which is why this shipped looking
verified.** It cannot see anything a real push service does.

### Also fixed

**Tapping a notification did nothing.** `notificationclick` used `client.navigate()` with a
`client.focus()` fallback; on an installed iOS web app `navigate()` can reject and `focus()` is then
a no-op, so the chain silently did nothing. Now focus-else-`openWindow`. That loses the deep link
when a window is already open — accepted, since the app opening at all is the point and the
notification names the routine. `CACHE_NAME` v3 → v4 so installed apps drop the stale asset cache.

**Rotation is not free once live.** The public key is baked into the app bundle at build time *and*
into every subscription when it is created, so rotating means: set the Pages variable, rebuild, and
turn notifications off and on again on every device. It was free at 10:00 and cost all three by 10:30.

**Icon confirmed fine on iOS** — the SVG renders, so no PNG work is needed. **Still unverified:**
whether `navigator.setAppBadge` does anything. Does not block anything.

---

## Schedule reminders — Route B, web push — 2026-09-03 *(shipped 2026-09-04 — see above)*

Route A shipped on 19 August and the spec's build order said to live with it for a fortnight before
deciding whether push was worth its cost. Ben's verdict on 3 September: **"works but it's rough."**
The roughness was the mechanism, not the idea — a calendar alert opens the Calendar app, arrives on
the phone's refresh schedule rather than yours, and needs the iOS **Remove Alerts** toggle turned off
by hand before it fires at all. None of that is fixable inside Route A.

**Route A is kept, not replaced.** The two are independent: either, both or neither can be on. Push
is better where it works, the calendar feed works everywhere.

**What's built:** `pushSchedule.js` (the due-time rule, pure and tested) and `push.js` (support
detection, tokens, subscription handling) in the app; `usePush` + `PushSync` mirroring the
`useCalendarFeed` + `CalendarFeedSync` pattern; a `PushReminders` card in Plan → Schedule; `push` and
`notificationclick` handlers in `sw.js`; and `workers/betalog-push/`, a KV-backed Worker with a `*/5`
cron sender. **`CACHE_NAME` bumped v2 → v3** — without it an existing install never receives the new
handlers.

**The Worker imports the app's `pushSchedule.js` directly** rather than reimplementing the rule,
following the precedent the calendar Worker set by keeping the whole `.ics` builder in the app.
Confirmed by grepping the bundled output.

**Decisions worth keeping:** a push subscription is per device, so `il_pushSub` is deliberately
excluded from Firestore sync — the opposite of the shared calendar token, and syncing it would let
turning notifications off on the phone break the laptop. A 60-minute grace window stops a Worker
outage firing a morning's worth of reminders at 11am. Dedupe is per entry per local day. There is no
`GET` on the Worker, so a leaked token cannot be read back into a sendable endpoint.

**Correction on the record:** I had told Ben snooze/done buttons were a Route B win. That is a Push
API capability in general; whether iOS honours notification `actions` in an installed web app is
unverified, and nothing built depends on it. Noted in the spec so it isn't inherited as fact.

**Verified:** 246 tests (was 190), build green, lint 0 errors. 18 Worker smoke checks against an
in-memory KV and a stubbed push service. `wrangler deploy --dry-run` bundles at 18.56 KiB. The card
driven in Chromium across all five device states. **Not verified: any notification reaching a real
phone** — that needs VAPID keys, a KV namespace, a deploy and a device.

**Two things stand between this and working:** the deploy steps in
`workers/betalog-push/README.md`, and a merge. Both are Ben's.

---

## Docs caught up with the app — 2026-09-03

First session in a fortnight, opened with "what's next". Establishing that turned up the
documentation describing an app that no longer exists. No source changed; all of this is correction.

**The privacy spec claimed BetaLog uses no analytics.** It has since the Cloudflare Web Analytics
beacon shipped — this was the follow-up recorded in the DEVLOG at the time and never actioned. The
legal section's "does not use advertising networks, analytics platforms, or tracking pixels" is now
a Cloudflare row in the third-party table, a narrowed sentence (advertising networks and *cross-site*
pixels, still true), and a paragraph on why cookieless matters: nothing stored on the device, no
identifier surviving a visit, so no PECR consent banner and nothing to opt out of. The plain-English
"What we don't do" list says the same in its own register, leading with "we do count page views" —
a reader who spots the omission themselves stops trusting the rest of the list.

**Scope worth stating plainly: the privacy page does not exist.** No `/privacy` route, no HTML file
— the spec is the only artefact. So nobody was ever served the wrong text; it was wrong in the
document that becomes the page, which is why fixing it now is the whole point. `CLAUDE.md` records
the page as unbuilt so the next session doesn't rediscover it.

**Four specs said "Planned" for features that are live** — each checked against the code, not
assumed: IA declutter (all four phases shipped 2026-08-20, while its own header said not started),
Goals (`GoalsSection.jsx`, `Storage.saveGoals`, `Goal` in `types.js` — the typedef matches the spec
field for field), Health log (`HealthMode` in `Log.jsx`, `useDrinkLog.js`, `AlcoholFreeCard.jsx`),
and calorie tracking (MET tables and `estimateSessionKcalMid()` in `stats.js`). All four are kept as
design records with headers pointing at the implementing files. A stale header is worse than none —
it invites building the same thing twice.

**`CLAUDE.md` corrected too:** `Log.jsx` described three modes where `MODES` has five (Cardio and
Health were added, the note never followed), and six specs on disk were missing from the
documentation index.

190 tests passing, build green, lint 0 errors (15 pre-existing `exhaustive-deps` warnings, untouched).

**Still open, unchanged by today:** the `friendCodes` Firestore rule fix is merged to `main` but
**not deployed** — rules don't ship with a Cloudflare deploy, so production stays exposed until
`cd betalog-react && firebase deploy --only firestore:rules` is run from the laptop. That is one
command and the highest-value item outstanding.

---

## Calendar day readout says minutes, not "m" — 2026-08-21

Reported from the live calendar: "Thu 20 · Sport 50m" read as fifty *metres*. It was fifty minutes —
`describeDay` printed `cardioDurationMins + 'm'` on a line that sits beside swim and run distances.

Minutes are now spelled out, and distance leads where it was logged, since that is usually what you
set out to do: "Run 5.0 km · 28 min", "Swim 800 m · 40 min", "Swim 800 m" with no duration, "Sport
50 min" with no distance. Formatting follows `fmtDist`, and `deriveSessionMetres` converts pool
lengths and miles as everywhere else.

**Calories were considered as the unit here and on the cardio chart, and rejected.** A kcal figure
estimates METs × weight × time rather than recording something logged — the MET correction on the
19th silently rewrote every historical figure, and a new weight entry shifts the past too. The
calendar answers what you did, not what it cost; calories stay a footnote under the cardio chart. A
`mins / kcal` toggle on the chart is cheap now that `BarTimeline` and `estimateSessionKcalMid` exist,
and kcal beats distance as a second unit (km cannot be summed across swim, run and cycle in one
bar) — but Ben's call was that the card is busy enough. Recorded here so the argument is not
reconstructed from scratch later.

Verified in a browser across five days covering each shape. Lint clean, 190 tests (was 188), build
green.

---

## Cardio calories now follow the selected bar — 2026-08-21

Reported from the live card: tapping a bar updated the summary line ("week of 15/6 · 10 sessions ·
8h 30m") but left the calories at the 90-day total underneath it. The figure did change with the
window chips, so it was not frozen — it just had nothing to do with the selection.

`buildStats` totalled calories across the window and the card rendered that unconditionally. The
per-session estimate moved into `estimateSessionKcalMid()` in `stats.js`, and the card now uses it
twice: summed for the window total, and through `buildValueTimeline` for a per-bucket series. Select
a bar and it reports that bucket; clear the selection and the total returns. A bucket with sessions
but no usable estimate says so rather than showing "~0 kcal".

Extracting it added 6 tests to a calculation that had been 25 lines inline in a component —
including that a session is costed at the body weight recorded on or before it, never today's.

Verified in a browser: 30d/90d/12m totals ~10,683 / ~32,067 / ~102,471 kcal, three bars at 90d
giving ~2,080 / ~3,687 / ~1,849 consistent with their own durations, and clearing the selection
returning the exact unpicked total. Lint clean, 188 tests (was 182), build green.

---

## 2026-08-21 — the dashboard widget system, end to end

One day, seven releases: all six phases of `docs/specs/betalog_widget_system_spec.md` plus a
cleanup. The spec was written the day before and not built; it is now finished, and kept as the
record of what was decided and why. Per-phase entries follow this one; the day's detail is in
`logs/2026-08-21.md`.

Two fixes landed after this summary was written, from Ben using the shipped screens — the cardio
card's calories ignoring the selected bar, and the calendar readout printing "50m" for fifty
minutes. Both have their own entries above.

**What the Dashboard looks like now.** Every widget is the same shape — a header that carries the
headline and is itself the collapse control, then a body holding the detail and any control that
changes it. Chips say `30d / 90d / 12m` and mean the same thing everywhere. Gym, cardio and alcohol
all draw the same bars from the same buckets. Borders are neutral, so the colour that remains
means something.

| | Phase | Shipped |
|---|---|---|
| A | the shell — whole header collapses, chips move into the body | `d990858` |
| B | one vocabulary — `30d / 90d / 12m`, persisted per card | `35a2557` |
| C | the chart component — `barChart.js` + `BarTimeline` | `dd958f7` |
| D | cardio and gym charts | `0fb30fa` |
| E | the activity calendar | `0d910f7` |
| F | neutral borders | `e15bd40` |
| — | loose ends — picker save, opt-in mismatch, dead card | `8b0bcfe` |

**All five audit findings closed.** The calendar is a real widget (E). Cardio sessions appear on it
(E). Chips speak one language (B). The collapse target went from ~24px to the whole header, 44px+
(A). Collapse is no longer an unexplained exception — cardio and gym gained bodies, so six of nine
fold and the three that don't have nothing to hide (D).

**Three decisions settled**, all recorded in the spec: windows are per-card and persisted (Ben's
call); the calendar gets tap-a-day rather than a week-strip; borders go neutral. The last two were
left to Claude and both followed the spec's own recommendation.

**Bugs found and fixed along the way**, none of them in the spec:

- Cardio sessions rendered *no dot at all* on the calendar, and nothing in the legend hinted at it.
  A session type missing from the colour map now falls back to a neutral dot rather than vanishing.
- Toggling any widget in the picker silently hid gym and cardio stats — the Dashboard defaulted them
  on while the picker defaulted them off, so the first toggle of anything wrote them `false`.
- The picker saved inside a state updater, a render-phase update React warns about.
- Cardio's empty state read "No sessions this week" whatever window was selected.
- `daysAgo(89)` on the gym card, the last place spelling a 90-day window differently.
- `CalorieBalanceCard.jsx`, imported nowhere, deleted.

**Testing.** 107 tests this morning, 182 tonight — all on pure functions in `src/lib`: the window
store, bar geometry, the shared timeline builder, and the calendar's day summary. Every phase also
went through a browser at 400px via a throwaway harness that stubs the Firebase-gated data context;
phase C's "nothing user-visible" claim was checked as byte-identical screenshots before and after.

**Left alone deliberately:** the alcohol card's tier-coloured border (it encodes streak milestone,
not decoration) and the schedule notice's blue (a call to action, not a stat card). Intensity-by-dot-
size and the calendar week-strip remain unbuilt and are still open if the month grid proves the
wrong shape in use.

---

## Dashboard loose ends cleared — 2026-08-21

Three small fixes after the widget system spec finished, shipped to `main` on Ben's instruction.

**The widget picker saved during render.** `toggleWidget` called `saveProfile` inside the
`setWidgets` updater — a render-phase update of a component above it, which React warns about, and
an updater that writes to storage can be re-run. The save now happens after the state is set.

**`CalorieBalanceCard.jsx` deleted** — imported nowhere, dead before this work started.

**Toggling any widget silently hid gym and cardio stats.** Found while verifying the first fix.
`Dashboard.showWidget` defaults a widget on (`prefs[key] !== false`); `WidgetPicker` kept an
`OPT_IN_KEYS` list defaulting `gymStats` and `cardioStats` *off*, from when they were new and
`MAX_WIDGETS` was tight. The Dashboard therefore rendered two cards the picker thought were off, and
the first toggle of anything wrote the picker's whole map and made them vanish. `OPT_IN_KEYS` is
gone: the picker defaults on, matching the Dashboard, and nine widgets against a cap of ten means
the limit argument no longer applies. A deliberate `false` is still respected.

Verified in the browser: nine drag handles, eight after one toggle off, nine after toggling back, no
React warnings. Lint clean, 182 tests, build green.

---

## Widget system phase F — neutral borders — 2026-08-21

Final phase of `docs/specs/betalog_widget_system_spec.md`, shipped to `main` on Ben's instruction.
The colour decision was left to Claude: **neutral borders**, which is what the spec recommended.

Five decorative outlines became `#e5e7ef` — training load (`#fde68a`), gym (`#c7d7fd`), cardio
(`#99e6d8`), both level cards (`#f5c9a8`) and weight (`#a7e6c6`) — along with the peach hairline
under the level cards' goal section. Training load's was the clearest case: yellow whatever the load
zone said, above a red "pushing hard" badge already carrying the meaning.

Colour now only appears where it means something: icon bubbles, chart bars, chips, level badges,
grade text, the BMI pill, calendar dots. Two borders keep theirs on purpose — the alcohol card's,
which encodes streak tier rather than decorating (and is already neutral with no milestone active),
and the schedule notice's blue, which marks a call to action rather than a stat card.

Verified by querying computed styles across every card in a browser: one distinct border colour on
the page. Lint clean, 182 tests, build green.

### The widget system spec is complete

All six phases shipped in one day. Every audit finding is closed:

1. ~~The activity calendar is not a widget~~ — phase E.
2. ~~The calendar does not show all activities~~ — phase E: cardio dots, legend entry, neutral
   fallback so a future type cannot vanish silently.
3. ~~Timeframe chips speak three different languages~~ — phase B: `30d / 90d / 12m` everywhere,
   persisted per card.
4. ~~The collapse affordance is small~~ — phase A: the whole header row, 44px+.
5. ~~Collapse exists on four of nine~~ — phase D: cardio and gym gained bodies; six of nine fold and
   the three that do not have nothing to hide.

Both rules hold: every widget is header-then-body, and a chip labelled `90d` means the same thing on
every card.

Known follow-ups, both pre-existing and neither a widget-system issue: `WidgetPicker.toggleWidget`
calls `saveProfile` inside its state updater (React render-phase warning), and
`CalorieBalanceCard.jsx` is imported nowhere.

---

## Widget system phase E — the activity calendar — 2026-08-21

Fifth phase of `docs/specs/betalog_widget_system_spec.md`, shipped to `main` on Ben's instruction.
The calendar-detail decision was left to Claude: **tap-a-day**, which is what the spec recommended —
smallest of the three options, answers "what happened when" directly, and leaves the week-strip
available if the month grid proves the wrong shape in use.

**It is a real widget.** `activityCalendar` joins `DEFAULT_ORDER`, `renderWidget` and `WIDGET_OPTS`,
and the hardcoded render after the Edit layout button is gone. It reorders, switches off and counts
against `MAX_WIDGETS` — 9 widgets defined against a limit of 10. Not an opt-in key: the calendar has
always been on screen, so it defaults visible and no existing user loses it. **Audit finding 1, the
biggest inconsistency on the screen, is closed.**

**Cardio finally appears.** `DOT_COLOR` and `TYPE_COLOR` covered gym, climb and hangboard only, so a
swim or a run left the day blank with nothing in the legend to signal it (**finding 2**). Cardio is
now teal, matching its card, with a legend entry — and a type in neither map falls back to a neutral
dot and cell instead of rendering as nothing, which is how cardio went missing unnoticed.

**Collapsed, it says something.** The header was the bare words "Activity calendar", failing the
declutter's first contract. It now reads `ACTIVITY 18 sessions August` over a per-type breakdown for
the month in view.

**Tap a day** and a line appears under the grid: "Wed 19 · Swim 45m", "Thu 4 · Gym 12 sets · 3 climbs
to V5 · 2 units". The text comes from `describeDay()` in `stats.js` — pure, 10 tests — which reads
grades off the right scale per discipline, counts only sent climbs towards the day's grade, skips gym
exercises marked not done, and names an unknown session type rather than dropping it.

Verified: lint clean, 182 tests (was 172), build green, and a browser run — the cardio-only day
renders and reads back, legend complete, 9 drag handles in edit mode, picker chip switches the card
off and persists.

Noticed and left for a follow-up: `WidgetPicker.toggleWidget` calls `saveProfile` inside the
`setWidgets` updater, a render-phase update that logs a React warning. It predates this phase.

Only F — colour — remains.

---

## Widget system phase D — cardio and gym charts — 2026-08-21

Fourth phase of `docs/specs/betalog_widget_system_spec.md`, shipped to `main` on Ben's instruction.
The two one-line cards gain bodies, built on phase C's `BarTimeline`.

- **Cardio** — minutes trained per bucket, in the card's teal, above the existing activity
  breakdown, kcal line and goal bars.
- **Gym** — sets per bucket, in the card's blue, and it becomes a proper collapsible widget:
  `WidgetShell`, `30d / 90d / 12m` chips, and a header carrying sessions, window and total sets.
  The "most-trained muscle group" line sits beneath, more useful next to a trend.

Both support tap-a-bar like alcohol: the summary line becomes that bucket's readout
("week of 3/8 · 1 session · 5 sets") and returns on a second tap.

`stats.js` gained `buildBucketScaffold(mode)` — the empty buckets for a window — extracted from
`buildAlcoholTimeline`, which now uses it, plus `buildValueTimeline(items, mode, valueOf)` as the
general form on top. All three charts therefore cover the same span and label their axes the same
way, asserted directly by a test comparing cardio's buckets to alcohol's key for key. The alcohol
timeline's own tests passed through the refactor untouched. `ALCOHOL_TIMELINE_MODES` and
`ALCOHOL_WINDOW_MODE` lost their prefix — neither belongs to alcohol any more.

**Audit finding 5 is closed.** Six of nine widgets fold; the three that do not — training load
(whose 7d:30d windows *are* the metric), coach tip (a sentence) and weight (a number) — have nothing
to hide, which is the rule the spec wanted made visible rather than explained.

One unplanned fix: the taller bodies exposed that cardio, gym and the two level cards centred their
icon against the whole card, leaving it level with the bars instead of the headline. Those three
moved to `items-start`, matching the spec's anatomy. Weight keeps centring — it has no body.

Verified: lint clean, 172 tests (was 165), build green, and a browser run — six widgets collapsed on
arrival, 30/13/12 bars across the windows on both new charts, correct tooltips and readouts, windows
persisting per card.

Only E (the calendar) and F (colour) remain, both still waiting on decisions.

---

## Widget system phase C — the chart component — 2026-08-21

Third phase of `docs/specs/betalog_widget_system_spec.md`, shipped to `main` on Ben's instruction.
Extraction only — the dashboard does not change by a pixel.

`AlcoholTimeline`'s bars are now something any widget can use, split in two:

- **`src/lib/barChart.js`** — the arithmetic, pure and testable. `buildBarGeometry(values, opts)`
  returns the scale, each bar's height, which bars are over the guideline, where the guideline line
  sits and which bucket carries the peak label; `labelledIndices(count, step)` moved here too,
  generalised from the alcohol card's mode-specific version.
- **`src/components/dashboard/BarTimeline.jsx`** — the rendering: bars, guideline, peak value label,
  tap-to-select, and both x-axis label styles (every nth bucket, or ends-and-middle where daily
  buckets are too many to label individually).

`AlcoholFreeCard` maps its buckets to `{key, label, fullLabel, value}`, passes its colours and
guideline in, and loses ~70 lines along with all of its geometry.

The tests went on the geometry rather than the component: vitest runs in `node` here with no jsdom,
and the numbers are the interesting part. 13 tests, several pinning behaviour that was implicit
before — the 3px floor under a tiny value, last-peak-wins when the maximum repeats, and the
guideline dropping out on an empty window.

Verified as invisible, not asserted to be: the alcohol card was screenshotted at 30d, 90d, 12m and
with a bar selected, then the pre-refactor card swapped back in and the same four shots taken again.
All four pairs byte-identical. Lint clean, 165 tests (was 152), build green.

Phase D — cardio and gym gaining bar bodies from this component — is now cheap, which was the point.

---

## Widget system phase B — one vocabulary — 2026-08-21

Second phase of `docs/specs/betalog_widget_system_spec.md`, shipped to `main` on Ben's instruction.

**Every timeframe chip now means the same thing** — the window of data being summarised. Cardio's
`7d / 90d` and alcohol's `30d / 12w / 12m` both become `30d / 90d / 12m`, defaulting to 90d. The
alcohol chips used to select bucket *granularity*, which is why `12w` sat beside cardio's `90d`
looking like the same control; the card now derives its bars from the window (30d → daily, 90d →
weekly, 12m → monthly) via `ALCOHOL_WINDOW_MODE` in `stats.js`. Weekly buckets went 12 → 13, because
a chip saying 90d has to cover 90 days and 12 Monday-aligned weeks only cover 84.

**Decision recorded: the window is per card, and persisted.** It lives in `profile.widgetWindow`
beside `widgetCollapsed`, so it syncs across devices and survives a reload — the level cards'
`90d / All time` included, which used to reset on every load. A single dashboard-wide window was
rejected: it takes away looking at 12 months of drinking beside 30 days of cardio. `lib/widgetWindow.js`
owns the options, defaults and validation (a stored window a card no longer offers falls back —
exactly what happens to anyone holding cardio's retired `7d`), with `hooks/useWidgetWindow.js` as the
component-facing wrapper. 14 new unit tests.

Gym's `daysAgo(89)` became `filterSessionsByDays(…, 90)`, the last place spelling a 90-day window
differently. Gym gets no chips until phase D gives it a body. Cardio's visibility gate moved from 90
days to 12 months, so the card is not hidden from the people its longest chip is for.

Verified: lint clean, 152 tests (was 138), build green, and a browser run confirming no `7d`/`12w`
chips remain, bar counts of 30/13/12 across the three windows, and the choices surviving a reload.

Phases C-F remain. C (extract the bar renderer) needs no decisions; E and F still do.

---

## Widget system phase A — the shell, properly — 2026-08-21

First phase of `docs/specs/betalog_widget_system_spec.md`, shipped to `main` on Ben's instruction.

**The whole widget header row is the collapse control.** `WidgetShell` renders the row as a
`<button>` with `min-h-[44px]`, so the tap target clears the touch threshold the old 16px chevron
(~24px with its padding) missed. The chevron is now a decorative `<span>`, lit on hover from the
row. Edit mode still renders a plain `<div>` — a tap meant for the drag handle must not fold the
card. This restores the full-row toggle `ActivityCalendar` had before declutter phase 2 replaced it
with the chevron, and gives the same affordance to the other four collapsible widgets.

**Timeframe chips moved into the bodies.** A button header cannot contain buttons, and the spec's
anatomy puts chips at the top of the body anyway, next to what they change. Cardio's `7d / 90d` and
alcohol's `30d / 12w / 12m` moved down; cardio's header gained a plain-text window label so a
collapsed card still says which window its count covers. `LevelCard` already worked this way.

Two fixes on the way past: the cardio empty state read "No sessions this week" whatever window was
selected, and `ActivityCalendar` still imported two chevron icons it no longer used.

Verified with lint, 138 unit tests, a production build, and a browser run at 400px (five headers
measuring 44-64px, each toggling from its far-left edge, edit mode showing no chevrons).

Phases B-F are still open. B needs the window-persistence decision; C (extract the bar renderer)
needs nothing and unblocks D.

---

## Cardio calorie bugs fixed — 2026-08-19

The 4 long-standing `stats.test.js` failures were two real bugs, not stale tests. Suite is green:
**107/107**.

**Effort slider was shifted one rung too hard.** `getMETRange` mapped effort 2 onto
`table[2]–table[3]` and effort 3-5 onto the same band, so Moderate and Hard returned *identical*
calories and everything below Hard was over-credited. Now each of the five rungs gives a distinct
band, anchored on the three tabulated intensities:

| Effort | Was (run) | Now (run) |
|---|---|---|
| 1 Easy | 7.0–9.0 | 5.6–7.0 |
| 2 Moderate | 9.0–12.0 | 7.0–9.0 |
| 3 Hard | 9.0–12.0 | 9.0–12.0 |
| 4 Very Hard | 9.0–12.0 | 12.0–13.8 |
| 5 Max | 9.0–12.0 | 13.8–15.6 |

Effort 4 and 5 extrapolate past the table, mirroring the shape `SPORT_EFFORT_MODS` already used for
sports — cardio and sport now respond to the slider the same way.

**Consequence worth knowing:** Easy and Moderate cardio sessions now report *lower* burn than they
did. That is the correction, not a regression — they were inflated. Calories are computed at display
time, so historical sessions re-render with the new figures; nothing stored changed.

**Fencepost in the run pace table.** `PACE_MET.run` gated the 10.5 MET band at 166 m/min but was
written `167`; 10 km/h is 166.67, so a bang-on 10 km/h run fell through to the 9.0 band. `167` → `166`.

Checked the other pace tables for the same class of error and left them alone deliberately: `cycle`
and `walk` thresholds sit just *below* their compendium band starts (16.1 km/h ≈ 268 m/min clears
267), so they are already generous rather than off by one. Their MET anchors are coarse against the
Compendium of Physical Activities, but that is an accuracy question with no documented spec behind
it — not something to change silently.

Committed straight to `main` on Ben's explicit instruction, against the `feature → preprod → main`
flow in CLAUDE.md. `npm test`, `npm run lint` and `npm run build` all pass. Not verified in the
running app — the change is pure functions with unit coverage.

---

## Feedback: shared Benjuicey Apps standard

Feedback across all of Ben's apps follows one standard — see the central docs in `benjuicey-apps/docs/`: **feedback-standard.md** (the standard) and **feedback-how-it-works.md** (end-to-end flow + how Claude triages submissions). Submissions from every app land in one shared backend, each stamped with the app's trigram.

- **This app's trigram:** `BTL`
- **Status:** ✅ **live since 2026-07-12.** The shared widget script is embedded in `betalog-react/index.html` with `data-no-button`, `appId: 'betalog'`, accent `#4f7ef8`. The Settings "Send feedback" button opens it via `window.BenjuiceyFeedback.open()` — this replaced the old `mailto:` link (which failed on devices with no configured mail client). Submissions land in the shared backend as `BTL-000x`.
- **Verified 2026-08-10:** Worker CORS allowlist includes `betalog.co.uk` / `www.betalog.co.uk` / `betalog.pages.dev` and is deployed (preflight returns `Access-Control-Allow-Origin: https://betalog.co.uk`). Widget mounts on the live site with the canonical categories `bug`/`content`/`request`/`general`, no console errors.
- **Note:** this app's own Firebase project (`betalog-340b3`) is for training data — feedback is separate and goes to the shared Worker.

---

## Calendar Worker deployed — 2026-08-19

Route A is **live**. `betalog-calendar` deployed to
`https://betalog-calendar.benjuicemcjuice.workers.dev` — the hostname the app already defaults to in
`betalog-react/src/lib/calendarFeed.js`, so no `VITE_CALENDAR_API` override is needed.

KV namespace `FEEDS` = `7b48f540f3d04fa4bf70898c2c58d430`, committed in `wrangler.toml` (not a
secret — without it nobody else can redeploy).

Verified against real Cloudflare KV, no phone needed:

- unknown token `GET` → `404` (routing + KV wired, nothing stored)
- `OPTIONS` with `Origin: https://betalog.co.uk` → `204`, origin reflected in
  `Access-Control-Allow-Origin`
- full round trip on a throwaway token → `PUT` `204`, `GET` `200` returning the stored VCALENDAR,
  `DELETE` `204`, then `404`. Test key removed.

Redeploy after a Worker change is just `cd workers/betalog-calendar && npx wrangler deploy`.

**iOS strips the alarms by default — 2026-08-20.** iOS turns **Remove Alerts** ON by default for
subscribed calendars (Calendar → the calendar → Subscription Details), which deletes every `VALARM`
as the feed is ingested. Events appear, reminders never fire, and nothing in the feed can change it —
the user has to turn that toggle off. The Settings copy now says so, because every iOS subscriber
hits this. Cost three on-device tests to find; ruled out silent mode, refresh lag, malformed output
and trigger encoding on the way.

**With Remove Alerts off, the alarm fires.** Confirmed on device 2026-08-20 — a "Glutes!!! — BetaLog"
notification at 13:40, from the subscribed feed. Route A is proven end to end: set a time in Plan,
subscribe once, and the Calendar app raises the reminder from then on.

**Confirmed on iOS — 2026-08-20.** Subscribed on the phone and the feed came through: a dedicated
"BetaLog Training" calendar, the routine rendered as `Glutes!!! — BetaLog` at 09:05-09:35, and the
`days[]` → `RRULE` expansion read back by iOS as "Repeats every week on Tuesday, Thursday and
Saturday". The `URL` property surfaced as a tappable betalog.co.uk link on the event. Route A is
end-to-end proven.

Free tier throughout — KV writes are capped at 1,000/day and this does one per schedule edit.

---

## Schedule reminders — Route A built 2026-08-19

The calendar feed works end to end. Set a time in **Plan → Schedule**, tap **Set up calendar
reminders** just below it, subscribe once on the phone — the Calendar app does the reminding from
then on, whether or not BetaLog has been opened. (Setup lived in the Settings sheet until the
declutter moved it beside the schedule on 2026-08-20.)

- **`src/lib/ics.js`** renders the feed in the app (22 unit tests); the Worker only stores and serves
  it. One tested implementation instead of two.
- **`workers/betalog-calendar/`** — `PUT`/`GET`/`DELETE /cal/<token>.ics`, KV-backed. **Not yet
  deployed**: needs `wrangler kv namespace create FEEDS`, the id pasted into `wrangler.toml`, and
  `wrangler deploy`. See its README.
- **Off by default, twice over**: no feed exists until it's enabled, and an entry with no time makes
  no alarm. No permission prompt anywhere — Route A needs none.
- **Times are floating** (no `TZID`), a deliberate deviation from the spec sketch: it avoids shipping
  a correct `VTIMEZONE` per zone and means 07:00 stays 07:00 while travelling. `tz` is still stored
  for Route B.
- **The token is the credential**, for reads and writes. 128 bits, revocable from Settings, kills
  every subscribed device at once. A leak exposes routine names and times — nothing else.
- **Verified in a browser** against a stand-in Worker: edits made in Plan reach the feed, clearing a
  time leaves a silent all-day event, deleting an entry removes its event, an unchanged schedule
  uploads nothing, and revoking 404s the URL.

**Next: live with it for a fortnight** before deciding whether Route B (web push) is worth its
platform constraints.

---

## Schedule reminders — step 1 built 2026-08-19

`ScheduleEntry` now carries an optional `remindAt` ("HH:MM" local) and `tz`, with a time picker per
entry on `ScheduleCard`. **One reminder per schedule entry, deliberately — not a daily digest.** Each
entry has its own time, which is what makes a morning *and* an evening reminder possible: hangboard
07:00 Mon/Wed/Fri and gym 18:30 Tue/Thu is two entries, two alerts.

- New `src/lib/reminders.js` — pure, no React imports, so the calendar-feed Worker can reuse it.
  14 unit tests in `src/lib/__tests__/reminders.test.js`.
- Clearing a reminder **deletes** `remindAt`/`tz` rather than nulling them — "no reminder" is an
  absence, which is what the `.ics` builder will test for.
- Dashboard's `ScheduleNotice` shows the time against each routine and sorts due-today by it.
- Known limits, both pre-existing: 3 entries max, and the same routine can't be scheduled twice — so
  "same routine, morning and evening" isn't expressible yet.

**This still doesn't send anything.** The next step is Route A: a Worker serving a private `.ics`.

---

## Schedule reminders — specced 2026-08-11

Ben asked whether the app could remind him on his phone to do his scheduled routines. Full spec:
`docs/specs/betalog_reminders_spec.md`. **Step 1 now built — see the entry above.**

Short version: two routes, staged deliberately.

- **Route A — a calendar feed.** A Worker serves a private `.ics`; the phone subscribes once and its
  own Calendar app does the reminding. No permissions, no Home Screen requirement, no Apple caveats,
  fires whether or not BetaLog has been opened in weeks. About an afternoon's work. **Build first.**
- **Route B — web push.** Service worker `push` handler, permission from a user gesture, subscription
  mirrored into KV, and a Cloudflare Worker on a Cron Trigger sending via VAPID. Note Node's
  `web-push` does **not** run on Workers — needs a WebCrypto library (PushForge or
  `@block65/webcrypto-web-push`). Several times the work.

**Prerequisite for both:** `ScheduleEntry` has `days[1–7]` but **no time of day and no timezone**.
Adding optional `remindAt` and `tz` is the first task either way; without `tz` a Worker running in
UTC is an hour out for half the year.

**Ordering is the point.** Route A first, then live with it for a fortnight and find out whether a
nudge actually changes behaviour, before committing to Route B's platform constraints.

**iOS constraint (Route B only):** push requires the app to be on the Home Screen — the Push API
isn't exposed to a Safari tab. Ben already has it installed. For everyone else the feature is
opt-in, feature-detected and off by default, so the failure mode is silence rather than breakage.

**Correction on the record:** an earlier note claimed the SVG `apple-touch-icon` meant iOS would show
a blank Home Screen icon. It doesn't — Ben's icon renders fine. No icon work needed, and it was never
a blocker.

---

## Milestones

| Date       | Milestone                          | Status |
|------------|------------------------------------|--------|
| 2026-03-22 | React scaffold + shell + nav       | ✅ Done |
| 2026-03-23 | Step 0 — Data foundation           | ✅ Done |
| 2026-03-23 | Step 1 — Exercise library          | ✅ Done |
| 2026-03-23 | Step 2 — Routines                  | ✅ Done |
| 2026-03-23 | Step 3a — Gym session logging      | ✅ Done |
| 2026-03-24 | Step 3b — History                  | ✅ Done |
| 2026-03-24 | Step 3c — Climb log                | ✅ Done |
| 2026-03-24 | Step 4 — Hangboard timer           | ✅ Done |
| 2026-03-25 | Step 5 — Dashboard                 | ✅ Done |
| 2026-03-25 | Step 5b — Profile & Weight Log     | ✅ Done |
| 2026-03-26 | Step 6 — AI Coach                  | ✅ Done |
| 2026-03-27 | Step 7 — Firebase auth + sync      | ✅ Done |
| 2026-03-27 | Step 8 — Friends & leaderboard     | ✅ Done |
| 2026-05-16 | Hangboard UX — grip diagram + inter-grip timer | ✅ Done |
| 2026-05-19 | Firebase auth iOS fixes — popup hang, standalone detection | ✅ Done |
| 2026-05-19 | Friends leaderboard — FriendsScreen with discipline toggle, detail view | ✅ Done |
| 2026-05-20 | Friends cards — peak primary, 90d secondary, leaderboard redesign | ✅ Done |
| 2026-05-22 | Cardio session type (swim/run/cycle/row/walk/yoga) | ✅ Done |
| 2026-05-27 | Gym log: add/remove sets per exercise during logging | ✅ Done |
| 2026-05-27 | Friends detail: All Time / Last 90 Days toggle + Proj/Flash sub-row | ✅ Done |
| 2026-05-29 | Health log — drink tracking, alcohol-free streak, calorie estimates | ✅ Done |
| 2026-05-29 | Gym stats + Cardio stats dashboard widgets | ✅ Done |
| 2026-05-29 | Cardio session editing + History audit | ✅ Done |
| 2026-05-29 | Climbing grade row switched to 90d data | ✅ Done |
| 2026-05-29 | Calorie balance widget (cardio burned vs drink kcal) | ✅ Done |
| 2026-05-29 | Sport cardio tile — replaces Yoga, 32 sports with MET-based calorie calc | ✅ Done |
| 2026-06-01 | Goals embedded into widgets — grade/weight/cardio goal progress bars in LevelCard/WeightCard/CardioStatsCard; CalorieBalance widget removed | ✅ Done |
| 2026-06-01 | Grade goal display — 90d current form + 90d send count at target grade, replaces meaningless 0%/100% bar | ✅ Done |
| 2026-06-02 | Weight edit decimal entry fix — NumericStepper now supports direct decimal input for fractional steps | ✅ Done |
| 2026-06-02 | Bug fix sweep (8 issues) — calorie MET bounds, empty date guard, negative distance guard, goal achievement deps, legacy weight key migration, friend code retry loop, sync debounce + no re-parse on write, Firebase error surfacing | ✅ Done |
| 2026-06-02 | Calorie calculator overhaul — corrected swim MET values (Compendium), stamp-on-save (no retro recalc), pace-based MET for run/cycle/row/walk, distance-based kcal/m for swimming (Pendergast 1977) | ✅ Done |
| 2026-06-21 | Alcohol indicator pip on activity calendar | ✅ Done |
| 2026-07-12 | Shared Benjuicey feedback widget — replaces mailto, submissions land as `BTL-000x` (verified live 2026-08-10) | ✅ Done |
| 2026-08-10 | Cloudflare Web Analytics live — manual JS snippet + SW cache bump; had been recording nothing for 5 months | ✅ Done |

---

## Build Order (data-first)

### ✅ Step 0 — Data foundation
- `src/lib/types.js` — JSDoc typedefs for all schema shapes
- `src/lib/storage.js` — single module owning all localStorage access; idempotent migration on every load
- `src/App.jsx` — DataContext + `useData()` hook; `Storage.load()` runs once on mount
- `betalog_data_model.md` — canonical data model, source of truth for all data structures

### ✅ Step 1 — Exercise library
- `src/lib/defaultExercises.js` — 89 exercises, canonical format, no equipment in names
- `src/hooks/useExercises.js` — CRUD + `toggleFavourite` + `seedDefaultExercises()`
- `src/components/exercises/ExerciseModal.jsx` — add/edit modal; name, category (muscle group), movementPattern, equipment, muscles, reps/time toggle, sets/reps/duration/rest, coaching notes, YouTube "How to" link
- `src/pages/Plan.jsx` — Exercises tab: search, category chips, favourites-first list, FAB

### ✅ Step 2 — Routines
- `src/hooks/useRoutines.js` — CRUD, filters to `type:'gym'`
- `src/components/routines/RoutineModal.jsx` — two-screen modal: exercise list with reorder + expand to set sets/reps/weight; searchable exercise picker
- `src/pages/Plan.jsx` — Routines tab unlocked

### ✅ Step 3a — Gym session logging
- `src/hooks/useSessions.js` — addSession, deleteSession, sorted newest-first
- `src/components/log/GymLogSheet.jsx` — slide-up sheet; pre-fills from routine or exercise defaults; set-level reps/weight editing; difficulty selector (1–5); notes; produces canonical Session object
- `src/pages/Log.jsx` — gym log entry point

### ✅ Step 3b — History
- `src/components/log/SessionCard.jsx` — gym / climb / hangboard card variants
- `src/components/log/SessionDetailSheet.jsx` — slide-up detail; edit (gym only, opens GymLogSheet pre-filled) + delete with confirm
- `src/pages/History.jsx` — date-grouped feed, empty state
- `Session` schema extended: `routineId`, `routineName`, `SessionExercise.trackingType`
- `GymLogSheet` updated: stores `routineId`/`routineName`, accepts `initialSession` for edit mode
- `useSessions` updated: `updateSession(id, updates)`

### ✅ Step 3c — Climb log
- `src/components/log/ClimbLogger.jsx` — inline logger; discipline selector (stays selected), grade chips (resets after log), outcome buttons (tap = log), running climbs list with remove, session feel + notes + save
- `src/pages/Log.jsx` — restructured with Train/Climb/Hang mode switcher (segment control); Train wraps existing routines/exercises tabs + GymLogSheet unchanged
- `src/components/log/SessionCard.jsx` — ClimbCard derives discipline badge from individual climbs; handles mixed sessions ("Mixed" badge, purple)
- Mixed disciplines allowed per session; `session.discipline` = common discipline or null if mixed; grade system per climb (V/French)

### ✅ Step 4 — Hangboard timer
- `src/hooks/useHangRoutines.js` — CRUD for hangboard routines (type:'hangboard' filter)
- `src/components/routines/HangRoutineModal.jsx` — create/edit routines; grip list with expandable inline editor; two selects per grip: Fingers + Grip Type (matching original app); exports constants for reuse in Log
- `src/components/log/HangboardTimer.jsx` — full-screen timer; phase state machine (preview→ready→hanging→rep-rest→set-rest→done); Pause/Resume, Skip, End & Save, Discard; Web Audio API sounds (no files — oscillator synthesis); last-3-seconds warning ticks on both hang and rest phases; done screen with session feel + notes + date
- `src/pages/Plan.jsx` — Routines tab now grouped: Training (blue) / Hanging (purple) / Climbing coming soon (orange); inline "New" buttons per section; separate Hang tab removed
- `src/pages/Log.jsx` — Hang mode: Routines sub-tab + Free Hang sub-tab (inline grip/timing setup → timer)

### ✅ Step 5 — Dashboard
- Quick stats strip: weekly streak (with best record), sessions this week, total
- Training load card: ACWR-inspired acute/chronic comparison, zone labels, explainer text
- Activity calendar: monthly grid, prev/next nav, colour-coded by type, scheduled days in grey, collapsible
- Weight/BMI card: conditional on profile toggle, 30d trend
- Schedule notice: due today / next upcoming

### ✅ Step 5b — Profile, Weight Log & Schedule
- `useProfile`, `useWeightLog`, `useSchedule` hooks
- Profile tab in Plan: weight input → upserts today's weight log entry, BMI auto-calc, weight trend, goals, dashboard toggle
- Weight entries inline in History feed with edit/delete
- Schedule: up to 3 routines × days-of-week, lives in Routines tab, shown on dashboard calendar + notice
- Settings cog on Plan tab: Name + Height (rarely changed)

### ✅ Step 6 — AI Coach
- 5th nav tab (Coach, orange accent) with full chat UI
- 4 personas: Jonas Ridge, CrankMaster Chad, Dr Marina Sorel, Geoff — switchable, persisted
- Groq API (llama-3.3-70b-versatile) with inline key management
- Auto-builds session context from last 14 days + athlete profile
- Dashboard coach tip widget — daily cached one-liner, toggleable from Coach tab

### ✅ Step 7 — Firebase
- Firebase project `betalog-340b3` (Spark plan, europe-west2)
- Auth: Google sign-in + email/password, login screen, sign-out in Settings
- Firestore sync: write on every save, pull on login, merge cloud → local
- Security rules: user-scoped read/write (`users/{userId}`)
- `Storage` adapter extended with `syncToFirestore`, `pullFromFirestore`, `mergeFromCloud`
- `setDataAndSync` wrapper ensures all hook saves trigger cloud sync

### ✅ Step 8 — Friends
- Friend codes: unique `BL-XXXXX` per user, stored in `friendCodes/{code}` index
- Add/remove: bidirectional linking via friend code entry
- Public profile: `users/{userId}/public/profile` — displayName, boulder/rope levels, streak, recent sessions
- Friends sheet: slide-up from header Users icon — code display, add input, friend cards with stats
- Firestore rules: public profile only readable by friends, friend code index readable by any auth user
- Refactored grade/streak logic into `src/lib/stats.js` (shared by Dashboard, ClimbingStats, storage sync)

---

## ⬅️ NEXT — Step 9: Buddy Comparison & Friend Activity

### Buddy comparison
Tap a friend card in FriendsSheet → slides into a side-by-side comparison view (same sheet, new panel). Left column = you, right column = them. Compares: consistent grade, peak, flash, 90d current (boulder + rope), streak, session volume, discipline breakdown. All data already available from public profiles — no new Firestore reads. Back arrow returns to friend list.

### Friend activity feed on Dashboard
- **Follow toggle** (bell icon) on each friend card in FriendsSheet — stored in localStorage, no Firestore change needed
- **On app load**, for each followed friend, fetch public profile and compare latest session date against a `lastSeenPerFriend` localStorage key
- **Dashboard "Friend Activity" card** showing new sessions since last visit, e.g.:
  - "Jamie — 5 boulder climbs, topped V6 · 3h ago"
  - "Sarah — 8 rope climbs, topped 7a · yesterday"
  - "Mike — Hangboard, 4 grips · 2d ago"
- Tapping an entry opens the buddy comparison view
- **Enrich public profile `recentSessions`** — add `topGrade` per session so the dashboard card can show it
- **Seen marker** — once dashboard is viewed, mark updates as seen so they don't repeat
- No Firestore real-time listeners (keeps Spark plan costs at zero). Lightweight poll on app open only.

### Expand public profile
Add to `recentSessions` entries: `topGrade` (highest grade in that session). Add `sessionsThisWeek`, `sessionsThisMonth`, `totalSessions` counts for the comparison view.

---

## ✅ Dashboard widget fixes — 2026-05-29

- Goals widget now toggleable in Plan → Profile (added to `WIDGET_OPTS`, wrapped in `showWidget('goals')`)
- WeightCard shows active weight goal target + distance to go (Goal: X kg · Y.Y kg to lose/gain/on target)
- Removed stale `showWeightOnDash` legacy guard from `WeightCard`
- MAX_WIDGETS raised 4 → 5

## ✅ Health Log — 2026-05-29

- `DrinkEntry` type + `drinkLog` key in `types.js` and `storage.js` (load, save, SYNC_KEYS, mergeFromCloud)
- `useDrinkLog.js` hook (addEntry computes UK units, deleteEntry, sorted newest-first)
- `calcAlcoholFreeStreak` in `stats.js` — counts consecutive alcohol-free days from today backwards
- `DrinkLogSheet.jsx` — slide-up sheet: type chips (Beer/Cider, Wine, Spirit, Other), quantity stepper (0.5 steps), volume + ABV inputs, live units preview (green/amber/red), note, date
- **Health tab** added to Log page — weight section (log/update today's weight) + alcohol section (today's drinks list + Add drink button)
- **AlcoholFreeCard** dashboard widget — days → weeks → months display, green Droplets icon, toggleable
- `Alcohol-free streak` added to `WIDGET_OPTS` in ProfileTab
- Drink entries appear inline in History feed (DrinkRow with Droplets icon + units colour-coded + delete)


## ✅ Firestore user audit — 2026-05-29

**Report:** `docs/ops/firestore_user_audit_2026-05-29.md`

- 19 user docs total; 10 ghost accounts (signed in, no data)
- 1 confirmed real external user: Dave of Knowle West (2 climb sessions, last 2026-05-20)
- "Another tester" (3 climb sessions to 2026-05-19) — identity unknown, worth asking
- All external sessions are climb-only; nobody outside Steve has tried gym/hang/goals/AI coach
- Steve's main account: 40 sessions, 14 weight entries, 3 goals, last active 2026-05-28
- Spark plan usage well within free limits at current scale
- Onboarding drop-off: 53% of sign-ups bounced with no data logged

---

## ✅ Calorie burn estimates for cardio sessions — 2026-05-29

**Spec:** `docs/specs/betalog-calorie-tracking-spec.md`

- MET tables added to `stats.js`: `MET_SWIM` (5 strokes × 3 effort bands), `MET_CARDIO` (swim/run/cycle/row/walk)
- `getMETRange(activity, strokeType, effort)` — returns `{ low, high }` MET values for the effort band
- `estimateCalories(metRange, weightKg, durationMins)` — returns `{ low, high }` kcal range
- `cardioStrokeType` field added to `Session` typedef and saved in `CardioLogSheet`
- Stroke type chip selector added to CardioLogSheet (Swim only): General / Breaststroke / Front Crawl / Backstroke / Butterfly
- `SessionDetailSheet` — `CardioDetail` looks up most recent weight ≤ session date via `useWeightLog`, computes and displays kcal range as "Est. Burn ~X–Y kcal"; stale weight (>14 days) shows warning icon; no weight → prompt to log in Health tab
- Stroke type displayed inline in the Activity chip when non-general

## ✅ Drink calories — 2026-05-29

- `kcal` field added to `DrinkEntry` typedef (derived, stored not re-derived)
- Formula: `units × 56 × multiplier` — multiplier: beer/cider 1.4, wine 1.15, spirit/other 1.0
- `useDrinkLog.addEntry` computes and stores `kcal` on every new entry
- `AlcoholFreeCard` on Dashboard now shows "this week: ~X kcal from drinks" sub-line (last 7 days; only shown when at least one entry has kcal — backward-compatible with old entries)

---

## ✅ Codebase health audit + tidy-up — 2026-06-01

Full audit of the React codebase. Produced `docs/guides/codebase_health.md` with 10 prioritised items. All actionable items completed same session.

- **ESLint** — installed, configured, 53 errors → 0 errors (13 acceptable HMR warnings remain)
- **JS style** — Dashboard.jsx and App.jsx converted to modern JS (`const`/`let`, arrow functions) as part of splits below
- **Dashboard.jsx split** — 1261 lines → 78 lines; 12 components extracted to `src/components/dashboard/`
- **App.jsx split** — 743 lines → 110 lines; `LoginScreen` → `src/components/auth/`, `SettingsSheet` → `src/components/layout/`
- **utils.js** — filled out with `barlow`, `daysAgo`, `capitalise`, `fmtDuration`, `fmtDist`, `sessionDistKm`, `jsToScheduleDay`
- **Vitest smoke tests** — 43 tests for all pure functions in `stats.js`; `npm test` added as a script
- Confirmed `CardioLogSheet` already stores `cardioKcalLow`/`cardioKcalHigh` at save time (P3a was pre-done)
- Confirmed `ClimbLogger` already captures `session.location` (P4c was pre-done)
- Admin security model documented as known Spark-plan trade-off (no Cloud Functions available)

---

## Planned — Admin page (spec TBD)

A private `/admin` route accessible only to a hardcoded admin UID (benjuice/Steve's Firebase UID). Lets the admin browse user data without going into the Firebase Console directly.

**Rough scope (to be specced):**
- Route guard: check `currentUser.uid === ADMIN_UID`, redirect home if not
- User list: display name, email, session count, last active date, grade level
- User detail: drill into a specific user's full data — sessions, weight log, goals, friend connections
- Usage summary: total users, MAU (monthly active), DAU, top grades across the user base
- Useful for: spotting bugs in real data, understanding how features are actually used, onboarding gym partners

**Notes:**
- All data already exists in Firestore under `users/{uid}` — admin page just needs elevated read access
- Firestore rules will need an admin bypass rule: `allow read: if request.auth.uid == "ADMIN_UID"`
- Keep it simple and internal — no fancy UI needed, just readable tables

---

## Planned — Dashboard widget expansion + 90-day window

### Drink calories — ✅ Done 2026-05-29
`kcal` on DrinkEntry + weekly sub-line on AlcoholFreeCard (Widget option A). See completed milestone above.

### Cardio widget — ✅ Done
`CardioStatsCard`, toggleable via the `cardioStats` widget key. Original plan:
- Shows last 90 days: total cardio sessions, breakdown by type (swim/run/cycle etc.)
- Key stats per dominant activity: total distance or duration, e.g. "8 swims · 14.2 km"
- Toggleable via `WIDGET_OPTS` key `cardioStats`
- Implementation: pure derived from `sessions` filtered to `type === 'cardio'` and last 90 days

### Gym/exercise widget — ✅ Done
`GymStatsCard`, toggleable via the `gymStats` widget key. Original plan:
- Shows last 90 days: gym session count, total sets logged, most-trained muscle group
- e.g. "12 sessions · 186 sets · Back heavy"
- Toggleable via `WIDGET_OPTS` key `gymStats`
- Implementation: filter `sessions` to `type === 'gym'`, aggregate exercise categories

### 90-day window for all widgets
Currently the training load, level cards, and other widgets use a mix of all-time and rolling windows.
Proposal: make the **default recency window for all stat-based widgets 90 days**, with "all-time peak" shown as secondary where relevant (climbing cards already do this).

- Training load: already uses 7d acute / 30d chronic — keep as-is (it's a relative metric)
- Climbing level cards: already show 90d current + all-time peak — keep as-is
- Gym/cardio widgets (new): 90d by default
- Goals widget: not time-windowed (shows active goals regardless) — keep as-is
- Alcohol-free streak: by definition rolling from today — keep as-is
- Coach tip: not time-windowed — keep as-is

**Action when implementing gym/cardio widgets:** use `filterSessionsByDays(sessions, 90)` as the default input. No changes needed to existing widgets.

### Boulder widget — 90d secondary level not updating (RESOLVED — not a bug)
Investigated 2026-05-29 via Firestore REST query on the test account (vfipIiWIrIWKXOM1YnUvOdjIDu32). All boulder sessions for this account were within the last 90 days — so all-time and 90d stats are identical. The `samePeak` check in `LevelCard` correctly suppresses the 90d tag when both produce the same level. Working as designed. The tag only appears when all-time and 90d diverge (e.g. an old high-water mark is outside the 90d window).

### Rope widget — 90d data not appearing (RESOLVED — working correctly)
Same account: rope data spans 2026-02-04 (7a+, 7a — outside 90 days) and 2026-05-29 (6a, 6a+, 6b — inside 90 days). All-time includes the 7a+ sessions; 90d only sees the 6a/6a+ data. Different underlying grades → `samePeak` is false → 90d tag shows as "Intermediate | 90d Intermediate". Both widgets working correctly. The rope tag appearing while the boulder tag is hidden is explained entirely by data distribution across the 90d boundary.

### Climbing level cards — Project/Consistent/Flash row is all-time only
Currently the level cards show all-time peak as primary + 90d level as secondary (only when different). However the **Project / Consistent / Flash grade row beneath is always all-time** — it doesn't reflect recent form. Consider switching that row to 90d data so it shows what you're actually climbing right now, with all-time grades moved to a secondary/tooltip position. Decision needed: does "Project V7" mean your all-time project or what you're projecting this season? Lean towards 90d for the grade row to match the "current fitness" intent of the widget.

---

## Planned — Calorie balance view (cardio burns vs drink intake)

Make calorie data comparable across activity types so it's easy to see the full picture — and so Groq can analyse it.

**Concept:** calories burned (cardio sessions) vs calories consumed (alcohol). Eventually expandable to food/nutrition if that's ever added.

**Data already available:**
- Cardio sessions: `estimateCalories` returns `{ low, high }` kcal burn range — not yet stored on the session, only computed on display
- Drink entries: `kcal` stored at log time

**Implementation steps:**
1. **Store kcal estimate on cardio sessions** — add `cardioKcalLow` + `cardioKcalHigh` to Session. Compute at save time in `CardioLogSheet` using `getMETRange`/`estimateCalories` + most recent weight at that date. Requires weight lookup at save time (pull from `useWeightLog`). If no weight, store null. Re-computation can happen if weight is logged retroactively (probably not worth the complexity — just store at log time and show a "—" if missing).
2. **Weekly calorie balance widget** — a dashboard card showing last 7 days:
   - Burned: sum of `cardioKcalLow`–`cardioKcalHigh` across cardio sessions (show midpoint or range)
   - Consumed (drinks): sum of `drinkEntry.kcal`
   - Balance: burned − consumed (positive = net burn)
   - Toggleable via `WIDGET_OPTS` key `calorieBalance`
3. **Groq context** — include weekly calorie balance in the coach context object so it can factor in energy availability, recovery, and training readiness.

**Notes:**
- Accuracy is directional, not medical-grade — same caveat as current kcal range display
- Food logging is out of scope; this is purely activity + alcohol
- Could expand to show a simple bar chart (calories in vs out per day over 7 days) as a future enhancement

---

## Planned — Groq coach focus mode

Currently the AI coach always analyses the full picture (climbing, gym, cardio, health). Add a focus selector so the user can direct the coach's attention to a specific area.

**Focus options:**
- **Climbing** (default) — grade progression, technique, project tips, climb-specific training
- **Exercise** — gym session volume, muscle balance, strength trends, routine suggestions
- **Cardio** — swim/run/cycle distance/duration trends, effort distribution, improvement tips
- **Health** — weight trend, alcohol units, calorie balance, sleep/recovery cues (available data only)
- **Summary** — full overview across all areas, highest-level weekly/monthly snapshot

**Implementation:**
- Add a focus tab strip or chip selector at the top of the Coach page (above the persona selector, or replace the current persona strip layout)
- `buildContext()` in `Coach.jsx` already assembles the data object passed to Groq — add a `focus` param that:
  - Trims the context to the relevant data slice (e.g. cardio focus only sends cardio sessions + weight)
  - Prepends a focus instruction to the system prompt: e.g. "Focus your analysis on the user's cardio training. Other data is provided for context only."
- Default focus = 'climbing' (no behaviour change for existing users)
- Persist the last-used focus in `profile.coachFocus` so it's remembered across sessions

---

## ✅ Cloudflare Web Analytics — 2026-08-10

Live on betalog.co.uk. Cookieless, so **no consent banner needed**. Full detail in `logs/2026-08-10.md`.

The site had been registered in Web Analytics for ~5 months and recorded **nothing**, due to two faults:
1. RUM was set to *"Enable, excluding visitor data in the EU"* — UK traffic routes via Cloudflare Manchester, which that exclusion covers, so the beacon was never served to the actual audience.
2. After switching to plain "Enable", auto-injection still never fired (absent from live HTML across ~36 min of polling; not edge cache, headers near-identical to `whatadisaster.uk` which auto-injects fine on the same account). Cause unknown.

Resolved with the **manual JS snippet** (`Enable with JS Snippet installation`), as `whatadisaster.pages.dev` already does:
- `betalog-react/index.html` — beacon snippet alongside the feedback widget
- `betalog-react/public/sw.js` — `CACHE_NAME` bumped v1 → v2. **Required:** the worker precaches `/index.html` and only purges old caches on a name change, so returning users would otherwise never receive the beacon.

⚠️ **If the beacon ever needs re-adding or the token changes, remember to bump `CACHE_NAME` again** — otherwise it silently won't reach existing users.

**Follow-up still open:**
- Update `docs/specs/betalog_privacy_spec.md` to describe the cookieless analytics — the privacy statements are now inaccurate (What a Disaster had to correct its disclaimer for exactly this reason)

---

## ⬅️ Open items — picked up next session

- **Declutter / information architecture rework** — ✅ **COMPLETE 2026-08-20.** All four phases shipped: 0) dead `GoalsWidget` deleted, BMI logic shared via `stats.js`; 1) Schedule became its own Plan tab with calendar setup beside it; 2) shared collapsible widget shell, state in `profile.widgetCollapsed`; 3) grade charts folded into `LevelCard` (arriving collapsed), `ClimbingStats` and the duplicate weight readout deleted, and Profile became **Goals** — the widget picker moved into the Dashboard's Edit layout mode beside the reordering it belongs with. Plan is now `Schedule | Routines | Exercises | Goals`. Full reasoning in `docs/specs/betalog_ia_declutter_spec.md`.

- **Dashboard widget consistency** — specced in `docs/specs/betalog_widget_system_spec.md`, not started. Six phases (A shell/tap-target · B one timeframe vocabulary · C extract the bar chart · D cardio + gym charts · E calendar becomes a real widget · F colour). Three decisions needed first: window persistence, colour approach, calendar detail level. Phase A depends on none of them.

- **`step9-wip` branch** holds finished Step 9 data-layer work: `topGrade` + `topGradeSystem` per recent session, `sessionsThisWeek`/`sessionsThisMonth`/`totalSessions`, and a fix for cardio sessions producing an empty `headline` in public profiles (broken since cardio shipped 2026-05-22). Build passed, logic verified against mixed boulder/rope sessions. **Not on the remote** — checked all 24 remote branches on 2026-08-20 and none carry these fields, so it exists only on the laptop. Rebase onto `main` (not `preprod`, retired 2026-08-20) before use, and **confirmed still present 2026-09-04** — `sessionsThisWeek` and friends appear nowhere in `main`'s source, only in this file's prose, so the work is genuinely unique. But it branched on 2026-07-12 and `main` has moved **85 commits** since, so "rebase before use" is a real piece of work, not a formality. Decide whether it is still wanted before paying that cost.
- **Feedback round-trip untested** — the widget is verified mounting and CORS-clear, but no actual submission has been sent through to Firestore.
- **Show the app version in Settings** — asked for 2026-09-04, not started. `package.json` is still at `0.0.0` and nothing anywhere tells you which build a device is running. That cost real time the day Route B went live: with the service worker serving assets cache-first, there was no way to tell whether the phone had picked up a new bundle, and the answer had to be inferred from Apple rejecting a push signed with a rotated key. A version alone would not have answered it — the string only changes when someone bumps it — so show the **build** too: Cloudflare exposes `CF_PAGES_COMMIT_SHA` at build time, which Vite can inject via `define` in `vite.config.js` (it is not `VITE_`-prefixed, so it is not picked up automatically). Worth showing the service worker's `CACHE_NAME` beside it, since that is what actually governs whether a device is running stale code.
- **`friendCodes` rule — ✅ DEPLOYED 2026-09-04.** Fixed and merged 2026-08-20, live from 4 September. `allow read` covered `list`, so any signed-in user could enumerate every friend code and its uid; narrowed to `allow get`, which still serves the by-ID lookup the feature uses. Verified against the Firestore emulator (`betalog-react/scripts/check-firestore-rules.mjs`, 7 assertions), including a control run proving the check fails against the old rule. **Rules do not ship with a merge.** Deploying it needed `cd betalog-react && firebase deploy --only firestore:rules` run by hand — and the first attempt ran from a stale `main` checkout and reported `already up to date, skipping upload`, which is a success message for deploying the *old* rules. Re-run from a checkout that actually carries the fix, and check the output says `released rules`, not `skipping upload`. Separately, `claude/skills-syntax-hZnz6` still holds a `_headers` file (CSP etc.) and a `centreAdmins` admin lookup; that branch's CSP predates the feedback widget, analytics and the calendar Worker and would block all three, so it needs its allowlist rebuilt before use.
- **Branch cleanup — local done 2026-09-04, remote pending.** Local branches are down to `main`, `step9-wip` and `betalog-react`. On the remote, 20 branches are fully merged into `main` and safe to delete; deleting them was blocked by tooling on 4 September, so it still needs one `git push origin --delete` run by hand. **Keep** `claude/skills-syntax-hZnz6` (holds a `_headers` CSP file and a `centreAdmins` admin lookup — the CSP predates the feedback widget, analytics and the calendar Worker and would block all three, so its allowlist needs rebuilding before use). **`betalog-react` is redundant** despite reading as unmerged: its only unique commit is the analytics beacon, which reached `main` by another route. Still unmerged and undecided: `betalog-dev`, `claude/betalog-pixel-icons-z90bzh` (ditched by decision 2026-08-20), `claude/climbing-centre-rockgympro-review-f3o8f0`, `claude/daves-name-discrepancy-9rm63w`.

---

## Planned — Dashboard widget consistency

Full spec: **`docs/specs/betalog_widget_system_spec.md`**.

The declutter fixed *where things live*. This is about the widgets **behaving like each other**. Audit
of all nine found the differences are accidental, not designed.

**The five findings:**

1. **The activity calendar is not a widget.** Absent from `DEFAULT_ORDER` and `WIDGET_OPTS`, rendered
   hardcoded after the Edit layout button — unorderable, un-hideable, doesn't count against
   `MAX_WIDGETS`, yet carries a collapse chevron so it looks like one.
2. **The calendar omits cardio entirely.** `DOT_COLOR` has gym, climb and hangboard only, so a swim or
   a run renders no dot and the legend never mentions it.
3. **Timeframe chips speak three languages** — alcohol's `30d/12w/12m` is bucket granularity,
   cardio's `7d/90d` is window length, level's `90d/All time` is window vs everything. Identical-looking
   chips, different concepts.
4. **The collapse target is ~24px** (16px icon, `p-1`), well under the ~44px touch guideline — and
   `ActivityCalendar` used to use its whole header row until declutter phase 2 replaced it with the
   small chevron. A regression I introduced and didn't notice.
5. **Collapse is on four of nine**, by an invisible rule ("has a body worth hiding").

**Two rules:** every widget is the same shape (header carries the headline *and* is the tap target;
body carries detail and any control that changes it), and one vocabulary for time (`30d` means the
same thing everywhere — the window summarised, never bucket size).

**Phases:** A shell + tap target · B one vocabulary · C extract the bar renderer from `AlcoholTimeline`
· D cardio and gym charts · E calendar becomes a real widget with cardio, a collapsed headline and
tap-a-day detail · F colour. Only D depends on C.

**Open decisions:** window persistence (per-card local, per-card stored, or one dashboard-wide
window), colour (family of accents vs neutral borders), and how far the calendar detail goes. Phase A
depends on none of them.

---

## Planned — AI coach output review: diet review + mini plan

Review what the AI coach actually gives back and broaden it beyond commentary on past sessions.

**To review:**
- Audit the current coach output across all 4 personas — is it analysis-only, or does it give the user something actionable to *do next*?
- Check what `buildContext()` in `Coach.jsx` currently sends (it already has climbing, gym, cardio, weight, drink log)

**Candidate additions:**
- **Diet / nutrition review** — we already hold weight log, drink units + kcal, and cardio calories burned. Could give a review of calorie balance, alcohol intake vs training load, and weight trend against the active weight goal. Needs a decision on how far to go: commentary on existing data only, vs asking the user to log food (much bigger scope — new data type).
- **"Mini plan"** — a short, concrete output the user can act on: e.g. next 7 days of suggested sessions, or 3 focus points for the coming week, derived from goals + recent volume + rest days. Distinct from the existing schedule feature (which is user-authored) — this would be coach-generated.
- Consider pairing with the **coach focus mode** above (a "Health/Diet" focus and a "Plan" focus fit naturally as focus options rather than separate features)

**Open questions:**
- Does the mini plan get persisted (so it survives a reload / can be ticked off), or is it just chat output?
- Diet review without food logging risks being thin — is drink + weight + cardio enough to say anything useful?

---

## Planned — Information architecture declutter

Full plan: **`docs/specs/betalog_ia_declutter_spec.md`**.

Plan and Dashboard grew by addition, so the same fact now lives in more than one place and the
Dashboard is one long scroll. Two rules drive the whole thing:

1. **Plan is where you change things, Dashboard is where you read them.** A read-only readout on a
   Plan tab is a deletion candidate; an editor on the Dashboard becomes a link.
2. **One fact, one home.** Two screens computing the same number means one gets deleted, not
   restyled — and shared maths lives in `stats.js`.

**Audit found:** grade stats duplicated between `LevelCard` and `ClimbingStats`; weight/BMI
duplicated between `WeightCard` and `ProfileTab`, with the category thresholds implemented twice;
`GoalsWidget.jsx` dead (imported nowhere). `ScheduleNotice` vs `ScheduleCard` is *not* duplication —
that is rule 1 working.

**Plan tabs become** `Schedule | Routines | Exercises | Profile` — schedule promoted out of the top
of Routines, calendar-reminder setup moved beside it from the Settings sheet. Not a 6th bottom-nav
tab: five items at `flex-1` already, a sixth is ~62px wide on a phone.

**Widgets get one shell** — header with the headline number always visible, collapsible body,
collapse state persisted in `profile.widgetCollapsed` next to `widgetOrder`. Chart-heavy widgets
default collapsed. That last part is load-bearing: moving the grade charts to the Dashboard only
declutters if they arrive collapsed, otherwise the scroll just moves house.

**Phases:** 0 invisible tidy · 1 Plan tabs · 2 widget shell · 3 dedup. Only 3 depends on 2.

---

## Deferred ideas

- **Weight as % bodyweight** — when a non-zero weight is set on an exercise or routine, show a small inline note converting it to % of the athlete's bodyweight (e.g. "+10kg · 14% BW"). Requires athlete profile bodyweight to be set (`AthleteProfile.weightKg`). Display only — no new data stored. Good place: below the weight input in `ExerciseModal` and `RoutineModal`, and on the routine row summary line.

- **Climb session location (free text)** — add a nullable `session.location` string to climb sessions. Captured once at the ClimbLogger save screen (one input, optional). At save time, the location is denormalised onto every `Climb` object in the session — so each climb carries its location for analytics, even though the user only entered it once. This enables per-climb location comparisons: flash rate at Redpoint vs Depot, grade calibration across venues (sandbagged vs featherbagged), your consistent ceiling per centre. When Firebase launches, `session.location` (free text) maps to `session.centreId`, and the same centreId is stamped on each climb. Free-text string stays as display fallback for outdoor/unmatched sessions. Do this before Firebase — every session logged without it is permanently context-free.
