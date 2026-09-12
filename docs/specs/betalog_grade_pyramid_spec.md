# Grade Pyramid Spec

**Status:** **Phase 1 built** — `src/lib/pyramid.js`, 31 tests. Wired to nothing.
Phases 2–5 not started.
**Supersedes (eventually):** the single consistent-grade reading in `lib/goals.js` and
the four tuning constants in `lib/gradeGoalScore.js`.

> Written 2026-09-12 after three defects shipped in one day, all in the grade goal
> feature, all found by Ben from screenshots. The spec exists because the third one
> made the pattern obvious: the bugs were not three mistakes, they were one
> abstraction failing three times.

---

## Why

`calcConsistentGrade` reduces an entire climbing log to **one grade** — the hardest
with ≥3 attempts and ≥40% sent. Every fact about the *shape* of someone's climbing is
discarded at that line.

On 2026-09-11 four constants had to be invented to smuggle pieces of it back:

| Constant | Existed to stop | Symptom that forced it |
|---|---|---|
| running-max / "rise must stick" | a career high erasing later grade changes | "No grade change in your log" for a V3 → V4 climber |
| `MIN_WINDOW_SESSIONS` | one evening of warm-ups redefining your grade | three V1s reporting "Currently V1 · 4 grades to go" |
| `IDLE_PENALTY` | volume and reach double-charging for inactivity | one session scoring **worse** than no sessions |
| `SENT_AT_TARGET_FLOOR` | inference outranking evidence | a flashed 6b+ reading "Unlikely as set" |

Each is the same failure: **a rule that was right about the case in mind and wrong
about the case beside it.** A model needing four such patches in a day is the wrong
model.

Meanwhile the log is *already* the right shape. One row per climb — grade,
discipline, outcome, session date — is exactly the **grade pyramid** coaches ask for
on paper. `GradeChart` even draws it, once, and nothing reads it.

---

## Does the pyramid hold up? *(research, 2026-09-12)*

Checked rather than assumed, because the whole design rests on it.

**The pyramid is standard, and old.** Eric Hörst introduced the grade pyramid in *How
to Climb 5.12*. It is now common coaching material (Power Company Climbing, Jurassic
Climbing Academy, The Front, Good Stone). The canonical structure is
**1 · 2 · 4 · 8** reading down from the target — a 2:1 ratio per tier — with the base
at a grade the climber sends consistently.

**Progression does slow sharply.** Coaching consensus: a beginner moves V0 → V2 in a
couple of months; a V4–V6 climber spends roughly 6–12 months a grade; past V8 it is
years. So `LEVEL_FACTOR` in `gradeGoalScore.js` is pointed the right way.

**What is deliberately *not* claimed.** One widely-copied line puts each V-grade at
"slightly more than a tripling in difficulty". That is a blog summary, not a
measurement, and no arithmetic here rests on it. The months-per-grade figures are
coaching experience, not a controlled study. They justify a **shape**, not a constant
— which is why the model derives what it can from the athlete's own log.

**The caveat that matters.** Power Company's objection to naive pyramids: the tiers
below your project are about **variety**, not just count. Eight laps on the same soft
V3 is not a base. BetaLog cannot see variety at all (see the route-identity gap
below), so every figure it produces counts *sends*, not distinct problems, and should
say so.

---

## What the data actually is

Every tap in `ClimbLogger` writes one row: `{ grade, gradeSystem, discipline,
outcome, attempts: 1 }` against a session date. Outcomes are `flashed`, `sent`,
`attempt`, `project`.

Two things found while reading it:

- **`Climb.attempts` is dead.** Typed as a number, hardcoded to `1` at the only call
  site. One tap is one climb; attempt counts come from row counts. Harmless, but it
  is not data.
- **There is no route identity.** `Climb.routeId` exists and is always `null`. Six
  sends of *the same* V4 are indistinguishable from six different V4s — and a pyramid
  is explicitly about distinct climbs. This is the one real gap, and it shapes the
  design.

---

## The model — `lib/pyramid.js` *(phase 1, built)*

### Three readings replace one number

| Reading | Means | Rule |
|---|---|---|
| **Project** | hardest grade sent, however rarely | ≥1 send |
| **Working** | hardest grade genuinely being tried, sent or not | ≥`WORKING_MIN_ATTEMPTS` (3) attempts |
| **Base** | the grade you *own* | hardest grade with `credited ≥ max(shape)` |

`WORKING_MIN_ATTEMPTS` is deliberately the same 3 `calcConsistentGrade` already uses,
so "working grade" stays continuous with the number the app has always shown.

**`Base` was originally "hardest grade whose pyramid is complete", and that was
wrong** — it conflated two questions. Readiness asks *can I get to this grade*, and a
single send sitting on a broad base answers yes; so on a well-logged V4/V5 season one
V6 send made Base report **V6**. Owning a grade is the other question — have you done
it repeatedly — so Base now reads the spread directly. On that same log it answers
**V4**: twenty-four V4 sends against four V5s and one V6, which is what a coach would
say looking at it.

### Three rules that make it robust

1. **Surplus spills downward.** A send is credited to its own tier first; the
   remainder satisfies tiers beneath. Ten sends at 6c+ therefore demonstrate the 6c
   tier — climbing harder plainly covers easier — while a *single* send at 7a fills
   only the top tier and nothing below, which is the entire point of a pyramid.
2. **One session cannot fill a tier.** `MAX_SENDS_PER_SESSION` (2) caps what any one
   session contributes per grade. Laps are training, not pyramid entries, and without
   route identity this is the cheapest honest defence against lap inflation. Raw
   `sends` is still reported alongside `credited`, so nothing is hidden.
3. **No minimum-evidence guard is needed.** A thin log produces empty tiers, which is
   the truth. `MIN_WINDOW_SESSIONS` exists in `goals.js` only because one number had
   to be either right or wrong with nothing between; a pyramid is allowed to be
   partly built.

### Readiness

For a target grade, walk the shape downward, filling each tier from its own grade's
credited sends plus any surplus carried from above. `score = 1 + pct × 4` rounded —
**the scale is the completeness, so there are no thresholds to tune.** `nextUp` names
the tier with the biggest shortfall. How `pct` itself is measured is the subject of
the two sections below, both of which changed on Ben's input.

### Depth is capped at three tiers *(Ben, 2026-09-12)*

> "V2 and below probably don't need to factor that much as most people can do a V2
> first couple of tries and these low level ones won't get logged. The harder you
> climb this is likely to happen for V3s also. Almost like the pyramid can only ever
> be x rows in depth based on what your current grade is."

Correct, and the evidence is blunt. Against a log whose hardest send was **V4**:

| Depth | "ready for V6" | "ready for V7" |
|---|---|---|
| 4 tiers | 80% | **53%** |
| 3 tiers (`PYRAMID_MAX_DEPTH`) | 33% | **0%** |

The fourth tier sits in warm-up territory. It fills with volume the climber barely
thinks about, and lends that volume to goals three grades out of reach.

This also reverses the truncation rule added earlier the same day. A V1 pyramid has
nowhere to put a third tier, and that was being treated as a defect —
`truncated → never complete`, so beginners could never have a Base. Under Ben's
framing a shallow pyramid at a low grade is **the correct shape**, not a broken one.
`truncated` is still reported, but no longer disqualifying.

### Readiness is built from the bottom, stopping at the first gap

Counting total material let full easy tiers carry an empty top: the same V4 climber
read **57% ready for V6** because the V4 row was full while V5 and V6 were untouched.

A pyramid with a hole in it is not partly built — it is built *up to the hole*, which
is true of real pyramids and turns out to be what makes the figure discriminate.
`pct = solidTiers / depth`, counting consecutive met tiers upward from the base. Total
material is still reported as `fillPct` for anything that wants it, and `topTierMet`
and `sentTarget` are separate flags so a send at the target is never hidden.

### Worked output, realistic rope log

A fortnightly rope log, mostly 6b with some 6a+/6a, one 6b+ flashed today:

Two logs, three targets each. `*` marks a tier that is not met.

```
SOLID — a V4/V5 season with one V6 in it
  project V6 · working V5 · base V4
  V5: 100%  Pyramid complete    V5 1/1   V4 2/2   V3 4/4
  V6: 100%  Pyramid complete    V6 1/1   V5 2/2   V4 4/4
  V7:  33%  Base thin           V7 0/1*  V6 1/2*  V5 4/4

SPARSE — hardest send V4
  project V4 · working V4 · base V4
  V5:  67%  Base nearly there   V5 0/1*  V4 2/2   V3 4/4
  V6:  33%  Base thin           V6 0/1*  V5 0/2*  V4 4/4
  V7:   0%  No base yet         V7 0/1*  V6 0/2*  V5 0/4*
```

Six honest and *actionable* answers from one model with no special cases. The sparse
climber is told plainly that V5 is nearly there and V7 is not a conversation yet.

---

## What this retires

| Patch | Replaced by |
|---|---|
| `SENT_AT_TARGET_FLOOR` | the send **is** the top tier — nothing to override |
| `IDLE_PENALTY` | tier counts only rise; no double charge is possible |
| `MIN_WINDOW_SESSIONS` | three V1s fill two V1 slots and move nothing above |
| running-max / rise-must-stick | tier fill, read directly |

This is the test of the idea. A model that makes four special cases *disappear* is a
better model; one that merely relocates them is not worth the rewrite.

---

## Decisions, and where they stand

Ben approved the spec and phase 1 without ruling on these individually, so phase 1
ships the recommendation in each case as a **named, changeable parameter**. None is
baked in.

| # | Decision | Implemented as | Status |
|---|---|---|---|
| 1 | Repeats, with no route identity | `MAX_SENDS_PER_SESSION = 2`, `capPerSession` option | recommendation, not ruled on |
| 2 | How far back a pyramid looks | `PYRAMID_WINDOW_DAYS = 180`, `windowDays` option | recommendation, not ruled on |
| 3 | Tier depth on the French ladder | tiers are ladder rungs for both systems | recommendation, not ruled on |
| 5 | How deep a pyramid counts | `PYRAMID_MAX_DEPTH = 3`, `maxDepth` option | **Ben, 2026-09-12** |
| 4 | Friends comparison (`buildPublicProfile`) | untouched | phase 2+, not ruled on |

### Open question raised by phase 1 — answered

*Was:* is the four-tier shape too demanding for real logs? **Answered by Ben on
2026-09-12**: the fourth tier is not too demanding, it is the wrong tier. It sits in
warm-up territory, so it is simultaneously never logged *and* easily filled by volume
that means nothing — which made it both too harsh on honest logs and far too generous
on ambitious goals. Capped at three.

### Still open

- **Should depth vary with the target's height on the ladder**, rather than a flat
  three? Ben's phrasing ("x rows based on your current grade") allows for a V10
  pyramid being deeper than a V3 one, which is plausible — there is simply more
  meaningful room below a hard grade. Flat three is the current answer because it is
  the one the evidence supports; a curve would be invented numbers.
- **Does the model describe a real log better than the number does?** Still the
  question phase 2 waits on, and still wants Ben's actual export rather than
  fixtures.

---

## Two kinds of grade goal *(phase 4)*

| Goal | Done when | Reads as |
|---|---|---|
| **Send a 7a** | one send at the grade | top tier filled |
| **Become a 7a climber** | the pyramid under it is filled | all tiers filled |

The Dashboard already implements the first (`goalSends > 0` → progress 1) and
Plan › Goals already implements the second (consistent grade ≥ target). They have
simply never been told they are different goals, and have disagreed on screen since
the achievability rating shipped. Naming them makes the disagreement a feature.

---

## Phases

1. **The model** — `lib/pyramid.js`, pure, tested, wired to nothing. **Built.**
2. **Plan › Goals reads it** — the achievability block becomes the pyramid readout;
   the four tuning constants come out.
3. **The Dashboard shows the shape** — `GradeChart` already draws one bar per grade;
   invert it and mark the target tier.
4. **Two goal kinds** — in the goal sheet, resolving the Dashboard/Plan disagreement.
5. **Route identity** — optional name or colour per climb, enabling true dedupe and
   the variety check the literature asks for. Only worth doing if logging stays
   effortless.

---

## Sources

- [Not All Pyramids are Built the Same](https://www.powercompanyclimbing.com/blog/2020/5/6/not-all-pyramids-are-built-the-same) — Power Company Climbing
- [Focus On — Route Pyramid](http://www.jurassicclimbing.co.uk/2017/01/03/focus-on-route-pyramid-part-1/) — Jurassic Climbing Academy
- [Training Pyramids and Why They Rock](https://thefrontclimbingclub.com/blog/training-pyramids/) — The Front
- [Route Pyramids](https://www.goodstoneclimbing.com/notes/route-pyramids) — Good Stone
- [How Long Until the Next V Scale?](https://medium.com/@parttimeclimber/how-long-until-the-next-v-scale-621d0e8d400a) — Part-time Climber
- [Bouldering Grades: The Complete Guide](https://www.99boulders.com/bouldering-grades) — 99Boulders
- Eric Hörst, *How to Climb 5.12* — origin of the grade pyramid (cited via the above; not read directly)

Proposal page as presented to Ben: <https://claude.ai/code/artifact/753e0523-c392-4be7-a32c-0c085a7d9c83>
