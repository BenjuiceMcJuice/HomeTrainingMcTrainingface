# Grade Pyramid Spec

**Status:** **Phase 1 built** — `src/lib/pyramid.js`, 32 tests, wired to nothing.
Phase 2 (surfacing) not started. Phases 3–4 (likelihood, goals) specced below, not built.
**Supersedes (eventually):** the single consistent-grade reading in `lib/goals.js` and
the four tuning constants in `lib/gradeGoalScore.js`.

> Written 2026-09-12 after three defects shipped in one day, all in the grade goal
> feature, all found by Ben from screenshots. The bugs were not three mistakes — they
> were one abstraction failing three times.

---

## 1. Why

`calcConsistentGrade` reduces an entire climbing log to **one grade**: the hardest with
≥3 attempts and ≥40% sent. Every fact about the *shape* of someone's climbing is
discarded at that line.

On 2026-09-11 four constants had to be invented to smuggle pieces of it back:

| Constant | Existed to stop | Symptom that forced it |
|---|---|---|
| running-max / "rise must stick" | a career high erasing later grade changes | "No grade change in your log" for a V3 → V4 climber |
| `MIN_WINDOW_SESSIONS` | one evening of warm-ups redefining your grade | three V1s reporting "Currently V1 · 4 grades to go" |
| `IDLE_PENALTY` | volume and reach double-charging for inactivity | one session scoring **worse** than no sessions |
| `SENT_AT_TARGET_FLOOR` | inference outranking evidence | a flashed 6b+ reading "Unlikely as set" |

Each is the same failure: **a rule that was right about the case in mind and wrong
about the case beside it.**

The log is *already* the right shape. One row per climb — grade, discipline, outcome,
session date — is exactly the **grade pyramid** coaches ask for on paper. `GradeChart`
even draws it, once, and nothing reads it.

---

## 2. The research behind the shape

**The pyramid is standard, and old.** Eric Hörst introduced the grade pyramid in *How
to Climb 5.12*; it is now common coaching material (Power Company Climbing, Jurassic
Climbing Academy, The Front, Good Stone). The canonical structure is
**1 · 2 · 4 · 8** reading down from the target — a 2:1 ratio per tier — with the base
at a grade the climber sends consistently.

**Progression does slow sharply with grade.** Coaching consensus: a beginner moves
V0 → V2 in a couple of months; a V4–V6 climber spends roughly 6–12 months a grade;
past V8 it is years.

**Deliberately not claimed.** One widely-copied line puts each V-grade at "slightly
more than a tripling in difficulty". That is a blog summary, not a measurement, and no
arithmetic here rests on it. The months-per-grade figures are coaching experience, not
a controlled study. **They justify a shape, not a constant.**

**The caveat.** Power Company's objection to naive pyramids: the tiers below your
project are about **variety**, not count. Eight laps on one soft V3 is not a base.

Sources are listed at the foot of this document.

---

## 3. What goes in

Every tap in `ClimbLogger` writes one row:

```js
{ grade: 'V4', gradeSystem: 'v', discipline: 'boulder',
  outcome: 'sent' | 'flashed' | 'attempt' | 'project', attempts: 1 }
```

against a session `date`. That is the entire input. Two notes:

- **`Climb.attempts` is dead** — typed as a number, hardcoded to `1` at the only call
  site. One tap is one climb; counts come from rows.
- **`Climb.routeId` is always `null`** — six sends of *the same* V4 are
  indistinguishable from six different V4s. A pyramid is explicitly about distinct
  climbs, so this is the one real gap and it shapes rule 3 below.

---

## 4. The pyramid logic *(phase 1, built)*

### 4.1 Build the tiers — `buildPyramid()`

1. **Filter** to `type === 'climb'` sessions inside the window whose climbs match the
   goal's disciplines (`boulder`, or `lead` + `toprope`) and whose grade is on that
   ladder. Anything else is ignored.
2. **Window**: `PYRAMID_WINDOW_DAYS = 180`. Longer than the 90 days `goals.js` uses for
   *current form*, because these answer different questions — form is "what are you
   climbing now", a pyramid is "what have you built". Sends accumulate rather than
   expire, and at one or two sessions a week a 90-day window could never fill an
   eight-wide base.
3. **Count per grade**: `attempts` (every row), `sends` (`sent` or `flashed`),
   `flashes`, and `sessions` (days on which that grade was sent).
4. **Credit, with a per-session cap**: `credited` adds at most
   `MAX_SENDS_PER_SESSION = 2` sends per grade per session. Laps are training, not
   pyramid entries, and with no route identity this is the cheapest honest defence
   against lap inflation. Raw `sends` is reported alongside, so nothing is hidden.

### 4.2 The three readings

| Reading | Means | Rule |
|---|---|---|
| **Project** | hardest grade sent, however rarely | ≥1 send |
| **Working** | hardest grade genuinely being tried, sent or not | ≥`WORKING_MIN_ATTEMPTS` (3) attempts |
| **Base** | the grade you *own* | hardest grade with `credited ≥ max(shape)` |

`WORKING_MIN_ATTEMPTS` is deliberately the same 3 `calcConsistentGrade` already uses,
so "working grade" stays continuous with the number the app has always shown.

**`Base` was originally "hardest grade whose pyramid is complete", and that was wrong**
— it conflated two questions. Readiness asks *can I get to this grade*, and a single
send on a broad base answers yes; so on a well-logged V4/V5 season, one V6 send made
Base report **V6**. Ownership is the other question — have you done it *repeatedly* —
so Base now reads the spread directly, and answers **V4** on that same log.

### 4.3 Readiness for a target — `pyramidReadiness()`

Walk down from the target grade, one tier per entry in `PYRAMID_SHAPE`:

```
tier[i].grade = ladder[targetIdx - i]
tier[i].need  = PYRAMID_SHAPE[i]          // 1, 2, 4, 8
```

**Depth** is `PYRAMID_MAX_DEPTH = 4` — the literature's own shape. It shrinks further
near the bottom of the ladder, where there is nowhere to put a fourth tier; that is
the right shape at a low grade, not a broken one (`truncated: true`, still able to
complete).

**Rule 1 — surplus spills downward.** Each tier is filled from its own grade's
`credited` first; the remainder carries to the tier beneath.

```
avail   = own + carry
have    = min(avail, need)
met     = avail >= need
carry   = max(0, avail - need)
```

Ten sends at 6c+ therefore demonstrate the 6c tier — climbing harder plainly covers
easier — while a *single* send at 7a fills only the top tier and nothing below, which
is the entire point of a pyramid. **Spill is also what makes unlogged warm-up grades
harmless**: real volume above flows down and covers the tier nobody bothers to log,
while a climber with no volume has nothing to spill and is not flattered.

**Rule 2 — readiness is the base beneath the target, at its weakest tier.**

```
base  = tiers below the target        // the target tier is not part of its own base
pct   = min(have / need) over base    // a pyramid is as strong as its thinnest row
score = complete ? 5 : clamp(1..4, round(1 + pct * 4))
```

Two things follow, and each fixes a defect that a real log produced.

*The target tier is excluded.* An empty top row is the normal state of a goal — not
having done it yet is why it is a goal — so counting it drags every unstarted goal to
the floor and makes the mark say nothing. What the target tier holds is a different
fact, carried by `sentTarget` and `describeTargetEvidence`.

*The score is the weakest base tier, proportionally.* This replaced a bottom-up count
of whole met tiers that stopped at the first gap, and it was **Ben's own export on
2026-09-12 that killed it**: a rope log with `6b+ 1/1, 6b 2/2, 6a+ 4/4, 6a 7/8` —
three rows full, the base a single send short — scored **1, "No base yet"**, the same
mark as a climber who has never tied in. Counting whole tiers can only answer in
quarters, so being one send short of a row reads identically to never having climbed.

The defect bottom-up counting was itself written to fix — a full easy row carrying an
empty top, which read 57% ready for V6 on a log whose best send was V4 — is handled by
the exclusion plus the minimum: an empty V5 row is a zero-width link and holds the
whole reading at 1 however much V3 sits under it.

Total material survives as `fillPct` for anything that wants it. `topTierMet` and
`sentTarget` are separate flags, so a send at the target is never hidden by an
unfinished base. `complete` means the *base* is complete; the label only says
"Pyramid complete" when the target has been sent as well.

**`nextUp`** names the **weakest** tier — lowest fill ratio, ties going to the lower
grade — rather than the biggest absolute shortfall, so the sentence and the mark are
always talking about the same row. This is the input for the coaching line in phase 4.

### 4.4 Worked output

Two logs, three targets each. `*` marks a tier not met.

```
SOLID — a V4/V5 season with one V6 in it
  project V6 · working V5 · base V4
  V5: 100%  Pyramid complete   V5 1/1   V4 2/2   V3 4/4   V2 8/8
  V6: 100%  Pyramid complete   V6 1/1   V5 2/2   V4 4/4   V3 8/8
  V7:  50%  Base forming       V7 0/1*  V6 1/2*  V5 4/4   V4 8/8

SPARSE — hardest send V4
  project V4 · working V4 · base V3
  V5: 100%  Base complete      V5 0/1*  V4 2/2   V3 4/4   V2 8/8
  V6:   0%  No base yet        V6 0/1*  V5 0/2*  V4 4/4   V3 8/8
  V7:   0%  No base yet        V7 0/1*  V6 0/2*  V5 0/4*  V4 6/8*
```

Six answers from one model with no special cases.

Two of them are worth reading twice, because they are where the weakest-link rule
earns its place. **SPARSE → V5 is `Base complete` with the target unsent**: a V4
climber with a broad base genuinely is ready to try V5, and the label says so without
ever claiming the V5 has been done. **SPARSE → V6 and V7 are flatly 0%**, where
counting whole tiers gave a comfortable-looking 50% and 25% — an empty V5 row is a
zero-width link, and no amount of V3 underneath it makes V7 partly built.

### 4.5 What the pyramid retires

| Patch | Replaced by |
|---|---|
| `SENT_AT_TARGET_FLOOR` | the send **is** the top tier — nothing to override |
| `IDLE_PENALTY` | tier counts only rise; no double charge is possible |
| `MIN_WINDOW_SESSIONS` | three V1s fill two V1 slots and move nothing above |
| running-max / rise-must-stick | tier fill, read directly |

A model that makes four special cases *disappear* is a better model; one that merely
relocates them is not worth the rewrite.

---

## 5. What the pyramid does not know

**Everything it outputs describes the log, not the climber.** This is a framing rule,
not a disclaimer, and it governs the copy in every later phase.

- **Logging is incomplete.** People do not log warm-ups, and often do not log at all on
  a bad day. Spill covers the first case; nothing covers the second.
- **Deliberate limiting looks identical to inability.** Ben, 2026-09-12: *"my data is
  not so complete and I'm getting back after recovering so I know I could do more, I'm
  limiting myself on purpose."* A climber returning from injury, deloading, or just
  choosing not to push produces exactly the same pyramid as one who has hit a ceiling.
  **The model cannot tell these apart and must not pretend to.**
- **Variety is invisible.** Without route identity, eight laps on one problem and eight
  different problems are the same eight sends, minus the per-session cap.

### The copy rule this forces

Never phrase a reading as a statement about the athlete's ability. *"Nothing logged at
V5 yet"* — not *"you can't do V5"*. *"No base yet"* is about the base, and the wording
must keep it that way.

**Not building a "returning from injury" or deload mode.** It would need input nobody
wants to give, and the honest wording above covers most of the harm. Noted as a known
limitation, deliberately unmodelled.

**This rule is bigger than the pyramid**, and it gets much sharper once a *coach* reads
someone else's data rather than an athlete reading their own. Fleshed out separately in
`docs/specs/betalog_data_honesty_spec.md`.

---

## 6. Phase 2 — surfacing it *(built 2026-09-12)*

- **Plan › Goals**: the achievability block is now the pyramid readout — the mark, the
  tiers with have/need, and the three sentences (`describePyramidBasis`,
  `describeTargetEvidence`, `describeNextUp`). `scoreGradeGoal` and all four of its
  tuning constants were deleted; `gradeGoalScore.js` keeps only the time side
  (`gradeTimeline`, `paceReference`), which phase 3 needs.
- **Dashboard**: both climbing widgets draw the same pyramid from the same
  `pyramidForGoal` call, in the widget body above the grade bars. The mark alone rides
  the goal line, because the shell's contract keeps charts out of the header.
- **One component**: `components/ui/PyramidChart.jsx` is shared by both screens, so a
  goal cannot read one way in Plan and another on the Dashboard.
- **Friends**: not done. `buildPublicProfile` still publishes the consistent grade.
  Base is the closest honest equivalent; switching it changes some friends' numbers
  once, so it is a deliberate separate decision.

### 6.1 Which way up

Rows draw **easiest grade at the top, target at the bottom** — a funnel narrowing to
the goal. Ben asked for this on 2026-09-12, and the app's own `GradeChart` had always
sorted easiest-first, so the previous hardest-first pyramid ran the ladder the opposite
way to the chart directly beneath it on the same widget. The model still builds and
spills hardest-first; the reversal is display only, and lives in `PyramidChart`.

### 6.2 What phase 2 deliberately did not touch

The goal header still reads "Currently V4 (all time) · 2 grades to go" from
`calcConsistentGrade`. Changing what *Currently* means would ripple into auto-achieve,
the progress bar's baseline and the public profile, so the pyramid sits beside that
reading rather than replacing it. Phase 4 is where the two get reconciled.

---

## 7. Phase 3 — likelihood *(specced, not built)*

Ben wants a **% chance of reaching grade XYZ**, and this section exists mostly to be
straight about what that figure can and cannot be.

### 7.1 Readiness % is not a probability

`pct` is *how much of the base exists*. It is a measurement. A chance of success is a
prediction, and turning one into the other needs an outcome dataset — thousands of
climbers with known pyramids and known results — which does not exist here and cannot
be derived from one person's log. **Any percentage presented as a probability would be
invented**, exactly like the "tripling in difficulty" figure this spec already refuses
to build on.

### 7.2 What *is* computable, honestly

Three quantities, all from the log:

1. **Shortfall** — how many credited sends are missing, per tier. Already computed.
2. **Fill rate** — credited sends per month at the relevant grades, over the window.
3. **Conversion time** — how long this athlete has historically taken to turn a full
   base into a send at the next grade. `gradeTimeline` in `gradeGoalScore.js` already
   measures grade changes from the log; the literature default stands in when the log
   has none.

From those: **projected ready date** = today + (shortfall ÷ fill rate) + conversion
time. Compare with the deadline and you get a margin, in weeks, derived end to end
from the athlete's own climbing.

### 7.3 The recommendation

**Lead with the date and the margin, not a percentage.**

> *Ready around **mid-March** at your current rate. Your deadline is **1 December**.*

That is honest, specific, and actionable in a way "38%" is not — and it answers the
deadline-sensitivity Ben asked for directly, because the same pyramid against a
one-week deadline and a three-month deadline produces two different margins without
any extra machinery.

If a single figure is still wanted, it should be labelled **confidence**, derived from
the margin ratio, and documented in the UI as *not* a probability. Buildable; flagged
here so the decision is explicit rather than accidental.

---

## 8. Phase 4 — goals *(specced, not built)*

Achievability becomes two things multiplied, each honest on its own:

- **Evidence** — pyramid readiness. Do you have the base?
- **Time** — the margin from §7. Does the deadline allow for what is missing?

A one-week deadline and a three-month deadline on the same pyramid differ only in the
second term, which is exactly the behaviour asked for.

**The commentary comes free.** `nextUp` already names the grade and the shortfall:

> *Get 3 more V4s and 2 more V5s logged and the base is there.*

### Two kinds of grade goal

| Goal | Done when | Reads as |
|---|---|---|
| **Send a 7a** | one send at the grade | top tier filled |
| **Become a 7a climber** | the pyramid under it is filled | all tiers filled |

The Dashboard already implements the first (`goalSends > 0` → progress 1) and
Plan › Goals the second (consistent grade ≥ target). They have never been told they are
different goals, and have disagreed on screen since the achievability rating shipped.
Naming them makes the disagreement a feature.

---

## 9. Parked

- **Climbing-specific CSV export** *(Ben, 2026-09-12)* — "for data geeks". The existing
  Settings › Data › Export JSON dumps everything; a climbs-only CSV (date, discipline,
  grade, outcome) is a small separate job. Not now.
- **Route identity** — an optional name or colour per climb, enabling true dedupe and
  the variety check the literature actually asks for. Only worth doing if logging stays
  effortless.
- **A user-facing pyramid explainer** *(Ben, 2026-09-12)* — tiers, spill, the
  per-session cap, the window, and the caveats. **Not a new standalone page**: it is a
  guide on the already-specced `betalog.co.uk/help`
  (`docs/specs/betalog_activity_help_spec.md` §3), which is maintained outside the app
  so it updates without a deploy. Blocked on that page existing.
- **Return-from-injury / deload awareness** — see §5. Deliberately unmodelled.

---

## 10. Decisions

| # | Decision | Implemented as | Status |
|---|---|---|---|
| 1 | Repeats, with no route identity | `MAX_SENDS_PER_SESSION = 2` | recommendation |
| 2 | How far back a pyramid looks | `PYRAMID_WINDOW_DAYS = 180` | recommendation |
| 3 | Tier depth on the French ladder | tiers are ladder rungs for both systems | recommendation |
| 4 | Friends comparison | untouched, still the consistent grade | open |
| 5 | How deep a pyramid counts | `PYRAMID_MAX_DEPTH = 4` — the literature's shape | **Ben, 2026-09-12** |
| 6 | Whether to show a % chance | lead with projected date + margin | **proposed, §7** |
| 7 | How readiness is scored | weakest base tier, target excluded (§4.3 rule 2) | **built, 2026-09-12** |
| 8 | Which way the rows run | easiest at top, target at bottom (§6.1) | **Ben, 2026-09-12** |

Every parameter is named and overridable per call; none is baked in.

### History worth keeping

- **Depth went 4 → 3 → 4.** The evidence for cutting it (*53% ready for V7* on a log
  whose best send was V4) had been measured **before** readiness was rebuilt from the
  bottom, and did not survive the fix — re-measured, the same log and depth read 25%.
  A fix justified by a measurement taken with a broken instrument. Caught only by
  re-measuring after repairing the instrument, and cheap to catch because phase 1 is
  wired to nothing.
- **The truncation rule was added and then reversed** the same day, for the same
  reason: it was treating a symptom of the counting bug.
- **Bottom-up counting itself lasted one day.** It was written to fix real-looking
  readings and it did, but it could only ever answer in quarters, and the first real
  log put through it — Ben's export, 2026-09-12 — scored a rope pyramid one send short
  of complete as **"No base yet"**. Both it and the total-material counting it replaced
  were attempts to get a structural answer out of a tier *count*; the fix was to stop
  counting tiers and measure the thinnest one. Worth noting that all three of these
  reversals were caught by the same thing: putting a real log through the model and
  reading the output, rather than reasoning about it.

---

## Sources

- [Not All Pyramids are Built the Same](https://www.powercompanyclimbing.com/blog/2020/5/6/not-all-pyramids-are-built-the-same) — Power Company Climbing
- [Focus On — Route Pyramid](http://www.jurassicclimbing.co.uk/2017/01/03/focus-on-route-pyramid-part-1/) — Jurassic Climbing Academy
- [Training Pyramids and Why They Rock](https://thefrontclimbingclub.com/blog/training-pyramids/) — The Front
- [Route Pyramids](https://www.goodstoneclimbing.com/notes/route-pyramids) — Good Stone
- [How Long Until the Next V Scale?](https://medium.com/@parttimeclimber/how-long-until-the-next-v-scale-621d0e8d400a) — Part-time Climber
- [Bouldering Grades: The Complete Guide](https://www.99boulders.com/bouldering-grades) — 99Boulders
- Eric Hörst, *How to Climb 5.12* — origin of the grade pyramid (cited via the above; not read directly)

Proposal page as first presented: <https://claude.ai/code/artifact/753e0523-c392-4be7-a32c-0c085a7d9c83>
