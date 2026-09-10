# BetaLog — Weekly Shameometer

> **Status: BUILT** on `claude/ai-calls-review-inalmy`, 2026-09-10. Not merged.
> Two decisions changed during the build and are marked **[revised]** below.
>
> A first cut shipped to `claude/ai-calls-review-inalmy` as a schedule-adherence-only
> card before this spec existed. That card is superseded by what follows; its scoring
> library survives as one component of three. See "What survives" at the end.

---

## 1. What exists today, and how it works

Ben asked how the current logic works, so this is the honest account of it before
proposing to replace it.

`lib/adherence.js` joins two things that had never been joined: the **schedule**
(which routines are due on which weekdays) and the **session log** (which routines
were actually done). Everything else on the Dashboard summarises what *was* logged,
which means a routine could fire reminders for six weeks and never appear anywhere
as a failure.

It walks every date in a window, asks "was this a scheduled weekday for this
routine", and if so asks "is there a session that day carrying this routine's id".
Three rules decide what is fair to count:

| Rule | What it does | Why |
|---|---|---|
| **Today is never missed** | Window ends *yesterday* | A routine due today is still in play. Counting it would sink the score every morning and recover it every evening — noise, not signal. |
| **Nothing before `remindFrom`** | Each entry's own start date bounds its window | That field already holds the first scheduled day at the time the reminder was set. Without it, adding a routine today opens with weeks of retroactive failure. |
| **Match by family, not id** | `dr-submaxrepeaters-v4` ≡ `-v5` | Seeded routines carry a version suffix; a session stores whichever was current when logged. Ben's schedule points at v5 while all three hangboard sessions are v4 — a strict match reports "never done" for a routine he demonstrably did. |

The overall percentage **pools due days** rather than averaging per-routine rates: a
routine scheduled 7×/week is a bigger commitment than a Monday one, and averaging
lets the Monday one paper over it.

**The problem with it.** On Ben's data it reads `0% · 0/37`, and it has read some
version of zero for every week since the schedule was created. A gauge that has one
value is not a gauge. It also measures only the thing he does least, while ignoring
every session he *does* log — which is both demotivating and, as a picture of a
week's training, simply wrong.

---

## 2. What this replaces it with

**One dial, one week, three inputs.**

- **Scope: the current week**, Monday–Sunday (`mondayOf` already exists in `stats.js`).
  A week is short enough that a bad one is recoverable and a good one is visible,
  and it matches how the training actually gets planned.
- **Shape: a needle dial**, five bands, `VERY POOR → EXCELLENT`.
- **Inputs: training done, schedule adherence, alcohol.** Training is the backbone,
  the schedule is a top-up, alcohol is a modifier that can knock a good week down.

---

## 3. The model

### 3a. Effort points

Not all sessions are equal, and the log already knows enough to say so. Without
weighting, three 30-minute walks would read the same as three climbing sessions,
and on Ben's data the dial would sit at EXCELLENT off walking alone.

| Session | Points | |
|---|---|---|
| `climb` | **3** | The point of the app |
| `hangboard` | **3** | Hard, specific, and the most-skipped |
| `gym` | **2** | |
| `cardio` — swim / sport | **2** | |
| `cardio` — walk | **1** | Real but cheap; he logs a lot of them |

**Daily cap: 4 points.** One enormous Saturday should not carry a week — spreading
load across days is better training and the score should say so.

**Deliberately not used: calories, duration, distance.** The walk-duration default
bug (24 of 36 walks logged at exactly 30 min regardless of distance, see
`logs/2026-09-10.md`) makes every duration-derived figure unreliable. A score built
on session *type* is immune to it. Revisit once that's fixed.

### 3b. The three components

| Component | Weight | Formula |
|---|---|---|
| **Training** | **75** | `min(points / 9, 1) × 75` |
| **Schedule** | **25** | `(scheduled days honoured / scheduled days) × 25` **[revised]** |
| **Alcohol** | **−25 … +10** | see below |

**[revised] The schedule is scored per *day*, not per routine instance.** Ben's
schedule asks for 17 routine sessions a week (three routines, two of them daily), so
prehab three times — a genuinely good week — would bank 3/17 = 18% and the component
would be effectively unwinnable. A day counts as due when anything is scheduled on
it, and done when any routine due that day was logged. Prehab ×3 becomes 3/7 = 43%.
It changes nothing at the extremes (all or nothing score identically) and only adds
fairness in the middle, where partial credit belongs.

*Considered and rejected: dropping the weight to 15.* It collapses the range — a
quiet week reads POOR whether every routine was done or none, which makes the
routines feel pointless. That is a worse failure than being harsh.

**Weekly training target: 9 points.** Roughly a climb, a gym session, a swim and two
walks — or three climbs. Reachable on a good week, not on a lazy one. Ben's best
weeks in the log hit 12–15; his median is 5.

**When nothing is scheduled**, the schedule's 25 points fold into training rather
than being lost, so the dial still reaches 100 for someone who trains hard and keeps
no schedule. A schedule should be an opportunity to score, never a tax for having
one.

**Alcohol.** Allowance is **14 units/week** (the UK guideline, already used by
`alcoholGuideline()` in `stats.js`).

- **Zero units all week: +10 bonus.** The single biggest lever Ben actually pulls,
  and the streak card proves he responds to it.
- **Up to 14 units: no penalty.** Within guideline is not a failure.
- **Above 14: −1 point per unit over, capped at −25.** So 20 units costs 6; 39 units
  costs the full 25. Enough to knock a decent week down a band or two — his ask —
  without making a heavy week unrecoverable and therefore pointless to try in.

Final score is clamped to **0–100**.

### 3c. Bands

Matching the reference dial exactly:

| Band | Range | Colour |
|---|---|---|
| **EXCELLENT** | 88–100 **[revised]** | `#166534` |
| **GOOD** | 70–84 | `#4ade80` → `#22c55e` |
| **FAIR** | 50–69 | `#d9e34a` |
| **POOR** | 30–49 | `#f0a63a` |
| **VERY POOR** | 0–29 | `#e2603f` |

**[revised] EXCELLENT starts at 88, not 85.** Perfect training (75) plus the dry
bonus (10) is exactly 85, so an 85 threshold let a week with the schedule completely
ignored read EXCELLENT — the schedule could never affect the verdict at the top of
the scale, which is most of the point of having it. At 88, top marks need some
schedule adherence. When no schedule exists at all, training carries the full 100 and
EXCELLENT stays reachable. Two tests guard this boundary specifically.

Under the dial, one line of copy per band in the existing Shameometer voice — the
band name is the verdict, the line is the nudge.

### 3d. Part-way through a week

A weekly dial read on Monday morning is nearly empty by definition, and a dial that
says VERY POOR at 9am every Monday trains you to ignore it.

**Decision: the needle shows a pro-rated "on pace" score, with the elapsed-day
divisor floored at 3.** Targets scale to the part of the week elapsed — so Monday's
training target is `9 × 3/7 ≈ 3.9` points and the alcohol allowance is `14 × 3/7 = 6`
units. One climbing session on Monday reads GOOD, which is true: you are on pace.

The floor of 3 exists because `× 1/7` on Monday makes a single walk read EXCELLENT.
Schedule adherence keeps using **days elapsed excluding today**, preserving rule 1
from §1.

Under the needle: `week to date · day N of 7`, and **last week's final score as a
ghost tick** on the dial face, so the comparison is right there.

*Rejected:* showing the raw week-to-date score (reads as failure until Friday);
showing last week until midweek (the current week is the one you can still change).

**Consequence worth knowing:** because the needle reads "on pace", it drifts *down*
on any day nothing is logged and jumps *up* when something is. A week that starts
strong and stops will fall back as the days pass. That is the intended behaviour —
it makes the dial a live nudge rather than a Sunday-night verdict — but it does mean
the mid-week number is not a prediction of where the week will finish.

---

## 4. Calibrated against real data

Every week in Ben's export, scored under the model above. This is the check that
matters — a scoring model that has never been run against real weeks is a guess.

| Week | Points | Schedule | Units | Score | Band |
|---|---|---|---|---|---|
| 25 May | 15 | — | 32.1 | **82** | GOOD |
| 01 Jun | 12 | — | 0.0 | **100** | EXCELLENT |
| 08 Jun | 5 | — | 24.4 | **45** | POOR |
| 15 Jun | 13 | — | 73.8 | **75** | GOOD |
| 22 Jun | 2 | — | 52.1 | **0** | VERY POOR |
| 29 Jun | 3 | — | 46.3 | **8** | VERY POOR |
| 06 Jul | 1 | — | 24.7 | **0** | VERY POOR |
| 20 Jul | 8 | — | 15.9 | **87** | EXCELLENT |
| 27 Jul | 4 | — | 27.1 | **31** | POOR |
| 03 Aug | 5 | — | 33.0 | **37** | POOR |
| 10 Aug | 0 | — | 22.3 | **0** | VERY POOR |
| 17 Aug | 6 | 0/6 | 17.0 | **47** | POOR |
| 24 Aug | 2 | 0/10 | 67.5 | **0** | VERY POOR |
| 31 Aug | 2 | 0/13 | 38.7 | **0** | VERY POOR |
| **07 Sep** | **6** | **0/17** | **0.0** | **60** | **FAIR** |

Sanity checks this passes:

- **The holiday weeks bottom out** (24 Aug, 31 Aug — 0). Correct.
- **15 Jun scores GOOD despite 73.8 units** — 13 training points earned it, and the
  −25 cap stops the drinking erasing genuinely hard training. Deliberate: the model
  should not tell someone who trained hard that the week was worthless.
- **This week reads FAIR (60), not EXCELLENT.** Three sessions and fully dry earns
  the training and bonus points; the 0/17 schedule is what holds it down. That is
  the intended message, and the fix is in his hands.
- **Spread across all five bands**, which the current card never achieves.

The constants — `9`, `75/25`, `−1/unit`, `−25` cap, `+10` bonus, the points table —
are the entire tuning surface and live in one config object. Expect to adjust after
a few weeks of real use.

---

## 5. The dial

Inline SVG, no library. A 180° arc, five coloured segments with a grey label ring,
and a needle on a pivot.

- ~150px tall at 400px wide; scales with the card.
- Needle animates on mount and on score change (`transition: transform 600ms`),
  respecting `prefers-reduced-motion`.
- Ghost tick for last week's score, in `#bbbcc8`.
- Score, band name and the week's headline numbers sit under it.
- `role="meter"` with `aria-valuenow` / `aria-valuetext` carrying the band name, as
  the existing card already does.

Expanded body: a three-row breakdown showing what each component contributed
(`Training 50/75 · Schedule 0/25 · Alcohol +10`), then **"biggest gain available"** —
the single cheapest action that would move the needle most this week. A low score
should always come with a next action, not just a verdict.

---

## 6. What survives, what changes

| | |
|---|---|
| `lib/adherence.js` | **Kept as-is.** Becomes the schedule component. All three rules and its 26 tests still apply. |
| `ShameometerCard.jsx` | **Replaced.** Meter bar → dial; 30d/90d window → fixed week; adherence-only → three inputs. |
| **New** `lib/weeklyScore.js` | Pure. Points table, the three components, banding, pro-rating. Unit-tested like `adherence.js`. |
| **New** `components/dashboard/ScoreDial.jsx` | The SVG dial, taking `score`, `band`, `ghost`. |
| `widgetWindow.js` | Drop the `shameometer` entry — the window is always "this week". |
| Widget key | Stays `shameometer`, so anyone who has already positioned the card keeps their layout. |

Per-routine detail (which routine, how many missed in a row, when it was last done)
moves into the expanded body, under the component breakdown. It is the most useful
part of what got built and should not be lost.

---

## 7. Open questions for Ben

1. **Is 9 points/week the right target?** It's calibrated to make a good week reach
   GOOD and a great week EXCELLENT, but you know what a realistic week looks like
   better than the log does.
2. **Is `−25` enough of a "whack" for drinking?** On 15 Jun it's the difference
   between EXCELLENT and GOOD. Raising the cap to −40 makes a heavy week
   unrecoverable regardless of training — deliberately avoided, but it's your call.
3. **Should climbing outdoors or a hard session count for more?** `difficulty` (1–3)
   is already logged on every session and is currently unused by the score. It could
   scale points ×0.75–1.25. Left out of v1 to keep the model explainable.
4. **Do the band names stay as the reference dial** (`VERY POOR → EXCELLENT`), or go
   back to the Shameometer voice (`Total shame → Flawless`)? Currently proposing the
   former on the face with the latter as the line underneath.

---

## 8. The sealed week log *(added 2026-09-10)*

Ben: *"can we log each week (Sunday night) the shame score for that week."*

### Why it is stored rather than derived

A week's score is computable from data already kept, so storing it looks
redundant. It isn't, because every input is mutable:

- **The schedule gets edited.** Cutting Sub-Max Repeaters from seven days a week
  to three shrinks the denominator for every week that ever ran, silently
  improving the entire history.
- **Sessions get backdated and corrected.**
- **The constants will be retuned** — §4 says as much.

Derived history answers *"what would that week score under today's rules"*. A
sealed record answers *"what did I actually get"*. The second is the one worth
keeping, so a completed week is frozen once and never recomputed. `scoreVersion`
marks the ruleset that produced it, so a later retune is visible rather than
silent.

### Why there is no Sunday-night timer

There is nowhere to run one. A PWA cannot wake itself at 23:59; a `setTimeout`
fires only while the tab is open, and the push Worker holds no session data.
Cloudflare Pages serves static files and has no per-user scheduled job either.

So a week is sealed **on the first app open after it ends**, and anything missed
is backfilled. Opening the app on the Monday or three weeks later produces
identical records. `sealWeeks` is idempotent — a week already recorded is never
rescored, whatever the data now says.

Records carry `backfilled: true` when they were scored after the fact rather than
on the first open after the week ended. It is a provenance flag, not a
correctness one, and it dims the bar in the history strip.

### Empty weeks are skipped

A week with no sessions, no drinks and nothing scheduled is not recorded. Those
are almost always weeks the app was not being used, and logging them as
"10 — nothing done, nothing drunk" fills the history with noise that looks like
data. Once a schedule exists every week has due days, so nothing is skipped from
that point on.

### Storage

`il_weekScores`, added to `SYNC_KEYS`. **The Firestore merge unions by week
rather than replacing**, unlike every other key: a sealed week is a record of
what happened, so whichever device wrote it first wins, and nothing is lost when
two devices sealed different weeks while offline.

### Known limitation, found while verifying

Backfilling Ben's log produced **100 · EXCELLENT for w/c 13 April** — five
consecutive days of ankle rehab physio, at 2 points each. A `gym` session scores
2 whatever it contains, so ten minutes of ankle alphabet counts the same as an
hour of lifting.

There are two honest readings. During an injury, doing your physio five days
running genuinely *is* an excellent week, and the score is right. Against that,
"EXCELLENT" reading the same for rehab as for hard training makes early weeks
in the history not comparable with later ones.

The `difficulty` field would not fix it — Ben logged those sessions as
difficulty 2, the same as everything else. A fix would need session *content*
(exercise count, or a category weighting). Left alone for now; flagged because
the history strip shows it.
