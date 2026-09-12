# Grade Pyramid Spec

**Status:** **Phase 1 built** — `src/lib/pyramid.js`, 29 tests. Wired to nothing.
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
| **Base** | the grade you *own* | hardest grade whose own pyramid is complete |

`WORKING_MIN_ATTEMPTS` is deliberately the same 3 `calcConsistentGrade` already uses,
so "working grade" stays continuous with the number the app has always shown rather
than introducing a second, differently-calibrated threshold. `Base` is defined by
reusing `pyramidReadiness` rather than by a fresh threshold, so "owning 7a" means
exactly what "Become a 7a climber" means in the goals below.

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

For a target grade, walk `PYRAMID_SHAPE` downward, filling each tier from its own
grade's credited sends plus any surplus carried from above. `pct = credited /
required`; `score = 1 + pct × 4` rounded — **the scale is the completeness, so there
are no thresholds to tune.** `nextUp` names the tier with the biggest shortfall.

### Truncation — found while testing, and it matters

A V2 pyramid has only V1 and V0 beneath it, so the four-tier shape cannot be built.
Left unhandled, V2 "completed" on three tiers and `baseGrade` dropped to **V2 for a
climber working V4** — a lower bar for lower grades, making the reading incomparable
across the ladder. Fixed: a truncated pyramid reports `truncated: true` and is never
`complete`. Beginners therefore have no Base, and callers should show Working or
Project instead. Honest, and comparable.

### Worked output, realistic rope log

A fortnightly rope log, mostly 6b with some 6a+/6a, one 6b+ flashed today:

```
TARGET 6b+   Pyramid complete  (5/5, 100% built)
   6b+  1/1  ok        6b   2/2  ok
   6a+  4/4  ok        6a   8/8  ok

TARGET 6c    Base nearly there  (4/5, 87% built)
   6c   0/1  short by 1          next up: 6b+ (1 more)
   6b+  1/2  short by 1
   6b   4/4  ok
   6a+  8/8  ok

TARGET 7a    No base yet  (1/5, 7% built)
   7a   0/1  short by 1          next up: 6b+ (7 more)
   6c+  0/2  short by 2
   6c   0/4  short by 4
   6b+  1/8  short by 7
```

Three different goals, three honest and *actionable* answers, from one model with no
special cases.

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
| 4 | Friends comparison (`buildPublicProfile`) | untouched | phase 2+, not ruled on |

### Open question raised by phase 1

**Is the four-tier shape too demanding for real logs?** A textbook 2/4/8 at V4/V3/V2
still fails "own V4" at 14/15, because the shape also wants eight sends at V1 and
nobody logs warm-ups. Either the shape is right and most people's Base is genuinely
lower than they think (which is what the coaching literature actually claims), or
`PYRAMID_SHAPE` wants softening for logged-data reality. **This needs looking at
against Ben's real log before phase 2.** It is the reason phase 1 ships wired to
nothing.

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
