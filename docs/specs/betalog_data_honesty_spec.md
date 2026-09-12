# Data Honesty — what the app may claim from a log

**Status:** **Principle, not a feature.** Governs copy and readouts across the pyramid,
the AI coach, the Shameometer, friends, and any future coach-facing view. Parts of it
are already followed by accident; this writes it down so it is followed on purpose.

> Ben, 2026-09-12: *"my data is not so complete and I'm getting back after recovering
> so I know I could do more, I'm limiting myself on purpose"* — then: *"this principle
> could be fleshed out more for a climbing coach."*

---

## 1. The principle

**Everything BetaLog computes describes the log. Nothing it computes describes the
climber.**

A climber returning from injury, deliberately deloading, or simply not logging
warm-ups produces *exactly the same data* as one who has hit a ceiling. No amount of
modelling separates them, because the distinguishing fact was never recorded.

The app must therefore never promote a statement about the log into a statement about
the person.

| Honest | Dishonest |
|---|---|
| "Nothing logged at V5 yet" | "You can't do V5" |
| "No sessions logged this week" | "You did nothing this week" |
| "Base V4, from 6 sessions in 180 days" | "You are a V4 climber" |
| "Tried V5 nine times, no sends" | "V5 is out of reach" |

---

## 2. Why it gets sharper with a coach

For the owner of the log this is a mild courtesy. **Ben reading his own thin pyramid
already knows why it is thin** — he supplies the missing context silently and
instantly, without noticing he is doing it.

A coach has none of that. The vision already plans for this: *coaching profiles* in the
Partner tier, and *coach notes on member sessions (opt-in)* in the backlog. Once a
second person reads the data:

- **The output is the whole picture.** There is no silent correction, because the
  reader was not there.
- **It is acted on.** A coach makes training decisions about someone else from it.
  A misread pyramid becomes a misprescribed block.
- **It carries authority.** A number on a screen from a training app reads as measured
  fact, especially to the athlete being shown it.

So the failure mode changes from *mildly annoying* to *confidently wrong about a person
who is not in the room*. That is the case the wording has to survive.

---

## 3. Six rules that follow

### 3.1 Absence is not evidence

"No V5 sends" and "tried V5 nine times, never sent" are opposite facts that both read
as an empty tier. The pyramid model already keeps `attempts` separate from `sends` and
`credited`; **any readout must use them**, because the second is a climber knocking on
the door and the first is a climber who has not walked down the corridor.

### 3.2 Every reading carries its provenance

A figure without its sample size invites over-reading. Attach the basis:

> Base **V4** · 6 sessions, 180 days · last logged 4 days ago

There is precedent in the codebase already. `lib/coach.js` sends the model
*"currently V6 (all time — nothing consistent in the last 90 days)"* rather than
"currently V6", precisely so an LLM cannot build confident advice on a stale figure.
The same instinct, applied everywhere.

### 3.3 Silence means nothing happened *in the log*

A gap is not a rest week, an injury, or laziness — it is a gap. The Shameometer already
gets this right by construction: **today is never missed** (the window ends yesterday),
and nothing counts before an entry's `remindFrom`, so adding a routine today does not
open with weeks of retroactive failure. Extend the same care to anything that scores
absence.

### 3.4 Describe the gap, never diagnose the person

`nextUp` produces *"get 3 more V4s and 2 more V5s logged"* — a description of what the
pyramid is missing, and fine. *"You're not training hard enough"* is a claim about a
person from data that cannot support it, and is not.

The test: could the sentence be false because of something that happened off-app? If
yes, it is a diagnosis, not a description.

### 3.5 Thin data must read as thin

A reading from four climbs and one from four hundred should not present identically.
Either show the basis (3.2) or widen the uncertainty — but do not quietly report both
in the same confident voice. **A model that is allowed to be partly built is better
than one forced to be either right or wrong**; that is exactly why the pyramid replaced
the single consistent grade.

### 3.6 The athlete owns the context the app is missing

The honest fix for "deliberately limiting myself" is not to infer it — it is to let the
athlete say it, and to carry what they said alongside the numbers.

**Sketch, not yet specced as a feature:** a period marker the athlete sets — *returning
from injury*, *deloading*, *not logging warm-ups* — that travels with the data and
appears on any readout a coach sees. It needs no modelling at all: nothing has to score
differently, the note simply has to be *visible* next to the figure it explains. That is
the cheap 90% of the problem.

---

## 4. What this rules out

- **Inferring intent from data.** No "detected deload", no "looks like you're
  plateauing". The app cannot see intent and must not guess at it.
- **Prescriptive language from absence.** Gaps generate observations, not instructions.
- **A single number where a shape exists.** The reason this whole document exists is
  that `calcConsistentGrade` crushed a log into one grade, and four constants then had
  to be invented to smuggle the discarded facts back in.
- **Presenting a derived figure as a measurement.** See the grade pyramid spec §7: a
  readiness percentage is a measurement of the base; a "% chance" is a prediction, and
  the two must not wear the same clothes.

---

## 5. Scope, deliberately small

This is a **writing and readout standard**, not a subsystem. Nothing here needs new
computation, new storage, or a settings screen. It is applied by:

1. Wording readouts as statements about the log.
2. Attaching provenance to figures that carry weight.
3. Showing attempts beside sends wherever an empty tier appears.

The athlete-set period marker in §3.6 is the one piece that would need building, and it
is deliberately left as a sketch until a coach-facing view actually exists.

---

## 6. Where it applies today

| Surface | State |
|---|---|
| Grade pyramid | §5 of its spec states the rule; wording follows it |
| AI coach context | Already labels an all-time grade as stale (`lib/coach.js`) |
| Shameometer | Already avoids scoring the unscoreable — today, and pre-`remindFrom` weeks |
| Plan › Goals | Labels `(all time)` when the 90-day window could not be read |
| Friends / public profile | **Publishes a bare grade with no basis** — the weakest surface against this rule |
| Coach-facing views | Do not exist yet. This document is written so that they start correct |

---

## Related

- `docs/specs/betalog_grade_pyramid_spec.md` — §5 (what the pyramid does not know), §7 (why a % chance is not honest)
- `docs/strategy/betalog_vision.md` — coaching profiles (Partner tier), coach notes on member sessions (backlog)
- `docs/specs/betalog_shameometer_spec.md` — the "today is never missed" rule
