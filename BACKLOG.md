# BACKLOG — BetaLog

Everything outstanding, one row each. **Why it matters and how it was found lives in `DEVLOG.md`;**
this file only says what is left and who can do it.

Follows [the Benjuicey Apps backlog standard](https://github.com/BenjuiceMcJuice/Benjuicey-apps/blob/main/docs/backlog-standard.md)
(`Benjuicey-apps/docs/backlog-standard.md`). IDs are never reused.

**Kinds:** Check (go and look, no code) · Bug (wrong now) · Decision (needs a human choice) ·
Feature · Chore. **State:** Ready or Blocked.

---

## Open

| ID | Item | Kind | Who | State | Blocked on |
|---|---|---|---|---|---|
| BTL-B9 | `attempts` never increments — probably not a bug, see note | Decision | **Ben** | Ready | — |
| BTL-B11 | Q4 — route identity per climb; **more relevant since the cap went** | Decision | **Ben** | Ready | — |
| BTL-B12 | Re-date the two stale goals — 7a and V5 are both unreachable | Chore | **Ben** | Ready | — |
| BTL-B13 | Prune the schedule — Sub-Max Repeaters is 7 days/wk with 2 reminders | Chore | **Ben** | Ready | — |
| BTL-B15 | Feedback widget round-trip — never actually submitted to Firestore | Check | **Ben** | Ready | — |
| BTL-B16 | Branch cleanup — 29 of 36 remote branches are merged | Chore | **Ben** | Ready | — |
| BTL-B17 | `step9-wip` — keep or drop? 158 commits behind `main` | Decision | **Ben** | Ready | — |
| BTL-B20 | Dashboard widget consistency — 6 phases, spec written, not started | Feature | Session | Blocked | 3 decisions in the spec |
| BTL-B21 | AI coach output review — diet review + mini plan | Feature | Session | Blocked | scope decision |
| BTL-B22 | Admin page | Feature | Session | Blocked | spec TBD |
| BTL-B23 | Calorie balance view — cardio burn vs drink intake | Feature | Session | Blocked | scope decision |
| BTL-B26 | `/privacy` page — **copy is wrong in four places**, do not publish as written | Feature | Session | Blocked | BTL-B31 |
| BTL-B31 | Reconcile the privacy copy with what the app actually does | Decision | **Ben** | Ready | — |
| BTL-B32 | No way to delete your account or data — the policy assumes there is | Feature | Session | Ready | — |
| BTL-B27 | Rename the repo `HomeTrainingMcTrainingface` → `betalog` (low priority) | Chore | **Ben** | Ready | — |
| BTL-B29 | Cardio goals read an all-time PB — the career-high pattern grades just dropped | Decision | **Ben** | Ready | — |
| BTL-B37 | If the removed 6b+ goal comes back after a reload, it is sync: on load the cloud copy replaces local whenever `users/{uid}.updatedAt` is newer than the *profile's* `updatedAt`, which is nearly always, so a delete whose write failed is undone silently | Check | **Ben** | Ready | — |
| BTL-B39 | Spill with no cap lets one grade — or one evening — build a whole base. 14 V4s in a single session reads *Base complete* for V5; 20 V4s and 2 V5s reads *Base complete* for V6 with no V6 ever touched | Decision | **Ben** | Ready | — |
| BTL-B40 | The 180-day window is undated inside itself — a base built in March and untouched since reads the same as one built last week | Decision | **Ben** | Ready | — |
| BTL-B41 | The fill rate discards a gap at the *start* of the window but charges one at the end, so "3 sessions in 180 days" and "5.77 sends a month" print on the same card | Bug | Session | Blocked | Ben — fine for now, 2026-09-16 |
| BTL-B42 | The base shortfall is projected at one rate pooled across all base grades, so 2 V4s for a climber whose best is V3 are projected at his V2 rate — *"Base full in about 2 weeks"* | Bug | Session | Blocked | Ben — fine for now, 2026-09-16 |

### The current project

**Finish the grade pyramid.** Ben, 2026-09-12: *"this is the next thing I want to build completely."*
Build order and full reasoning in `docs/specs/betalog_grade_pyramid_spec.md` §9a and §9b.

Steps 1–4 shipped: *Currently* (2026-09-12), the forecast (BTL-B5, 2026-09-12), the two goal kinds
(BTL-B6, 2026-09-13), friends see Base (Q3 / BTL-B7, 2026-09-13), and the explainer (BTL-B19,
2026-09-13). **Every step is shipped or on its branch.**

**On the branch `feat/explainer`, not merged** (2026-09-13): the explainer page, public at
`/pyramid.html`, opened in a new tab from *How this works ↗* on the climbing widget and the goal card.
Verified in the browser pane at desktop and phone width, and by build and lint. Ben says merge.

### BTL-B26 / BTL-B31 — the privacy copy does not match the app

Checked against the code on 2026-09-13, before building the page. `betalog_privacy_spec.md` carries
a finished plain-English explainer and a full legal policy, and **four of its statements are not
true of the app**. A privacy policy is a legal statement about what the software does, so the page
was **not built** rather than published with them in.

| The copy says | The app |
|---|---|
| A whole **"Share links"** section — choose what to share, 7-day expiry, revoke from settings | No such feature exists anywhere in `src/` |
| *"Delete your account and all associated data from Settings"* | No deletion exists — see BTL-B32 |
| *"Export your data at any time (full data export — **coming soon**)"* | Shipped: Settings › Data › Export JSON |
| — nothing about friend codes or the public profile | Both exist: 24-hour `friendCodes`, and a `users/{id}/public/profile` document friends can read |

The last row is the one that matters most: the policy **omits the sharing that does happen** and
describes sharing that does not. Ben has to settle the wording — it is a statement about his
service, not a code change — hence BTL-B31. The minimal truthful edits are: drop the share-links
section, describe friend codes and the public profile instead, correct export to say it is
available, and either build deletion (BTL-B32) or say deletion is by email to the contact address
already given.

The spec's own TODO list anticipated half of this: *"Data export feature — referenced in the policy
as 'coming soon'. Must ship before the policy states it is available."* It shipped; nobody came back
to the policy. Same failure the backlog standard exists to stop.

### BTL-B9 — Ben's logging model, and what it cost the cap

Ben, 2026-09-12: *"I will only likely log each climb I do. So for example if I do the same V4 twice
I'd log it twice. Repeating a grade / climb still counts imho. If I log it it should count. And
realistically people won't log the same V4 loads and then expect to try a V5."*

**That probably closes BTL-B9 rather than fixing it.** `attempts: 1` on all 54 climbs was filed as a
defect because 7 rows marked `sent` and 3 marked `attempt` all carried the same count. Under
one-row-per-climb that is not a contradiction: each row *is* one attempt, and the field is
degenerate rather than broken. The real question is whether `attempts` should exist at all, or
whether projecting is better read from several rows at one grade with no send among them — which the
pyramid already sees. **Decide before building anything on it.**

**BTL-B30 closed on 2026-09-13** — the cap went, `MAX_SENDS_PER_SESSION = Infinity`, every logged
send counts. This section described it as open and undecided until 2026-09-16, which is exactly the
one-fact-in-three-places drift the backlog standard exists to stop; the spec and the model's own
module note said the same wrong thing and were fixed with it. What the removal actually bought and
cost is in the spec's *The per-session cap, removed 2026-09-13*, and the cost it left behind is now
BTL-B39 below.

### BTL-B39 and BTL-B40 — how much a base can be built out of one thing

*Ben, 2026-09-16: "Is the pyramid base thing accurate, ie if you've done two V4s you're ready for
V5?" Measured against the model rather than argued about. The premise is safely no; what it turned
up next door is less safe.*

**Two V4s reads `No base yet`, 1/5** — the V4 row is met at 2/2 and V3 and V2 are both empty, and
readiness is the weakest row (§4.3 rule 2), so it floors. Working as specified.

**What does pass is looser than the shape suggests**, because spill (§4.3 rule 1) has been load-
bearing on its own since the cap went. Two readings from the real model:

| Log | Reads |
|---|---|
| 14 V4s, **one session**, nothing else | `Base complete` — ready for V5 |
| 20 V4s + 2 V5s, no V6 ever attempted | `Base complete` — ready for V6 |

Both are spill doing all the work: surplus at one grade flows down and fills every row beneath it,
so an entire base can rest on volume at a single grade, logged on a single day. Spill was introduced
to stop unlogged warm-ups being punished, which is right, and the per-session cap used to bound how
much of it one evening could produce. Nothing bounds it now. **This is a decision, not a defect** —
it is the direct consequence of two choices Ben made deliberately (decisions 1 and 7) and it errs
in the flattering direction. The options if it should be bounded: put a cap back, require a tier to
span N sessions rather than N sends, discount spill as it travels down, or answer Q4/BTL-B11 with
real route identity, which is the only one that measures the variety the literature actually asks
for.

**BTL-B40 is the same shape in time.** `PYRAMID_WINDOW_DAYS = 180` and sends never decay inside it,
so 14 V4s from late March with nothing since still reads `Base complete` today. Correct by the
spec's own reasoning — a pyramid is what you have built, not current form — and worth stating in
the explainer rather than changing, since the alternative is a decay constant nobody can calibrate.

Neither is being changed without Ben's word: both move every pyramid, every readiness score and
every projected date at once, exactly as BTL-B30 did.

### BTL-B41 and BTL-B42 — the forecast on Ben's own card

*Ben, 2026-09-16, screenshot of the Dashboard boulder card: `Base V2 · Best V3 · Flash V3`, goal
**send V5**, 137d left, `V2 8/8 · V3 3/4 · V4 0/2 · V5 0/1`, "No base yet", 3 sessions in 180 days,
"Ready for V5 around mid-January at your current rate. That is 2 weeks inside your deadline."*
*"So… today i did some V3s and the bar is nearly full. This pyramid suggests that when I've done
2 V4s I'll be ready for V5…. Discuss?"*

**He is reading it right**, near enough — reproduced against the model, 2 V4s takes that log to
`Base nearly there` (4/5) with *"Log 1 more V3 to fill the base"*, and the V3 after it reads
`Base complete`. Three more climbs. **And the shape is not the problem**: 1·2·4·8 down from V5 *is*
Hörst's pyramid, 2 sends at the tier below the project is what the literature asks for, and V4's row
can only ever be filled by real V4 sends — spill runs downward, so nothing fakes it.

The problem is that **two of the three sentences underneath the pyramid are arithmetic the log does
not support**, and both flatter.

**BTL-B41 — the rate discards leading silence but charges trailing silence.** `fillRate` measures
from the first climb *in the window* to today (the 2026-09-13 fix, §7.2, right for someone who has
only just started logging). It cannot tell that case apart from a climber who has been logging all
180 days and only climbed in the last eight weeks. Same three sessions, same eleven sends, only the
position of the gap moved:

| Three sessions, eleven sends | Reads |
|---|---|
| clustered in the last 8 weeks | **5.77 sends a month** (11 in 58 days) — late January, *right on your deadline*, 4/5 |
| spread evenly over the 180 days | 1.91 a month (11 in 175 days) — early March, 4 weeks past, 3/5 |
| clustered early, nothing since May | 1.91 a month — early March, 4 weeks past, 3/5 |

The card prints **"3 sessions in 180 days"** — one session every sixty days — directly above a rate
that implies one a fortnight. Two readings of one log on one card, which is the failure the pyramid
spec exists to remove. The honest span is arguably first-climb-to-today *or* the whole window,
whichever the session spacing supports; at minimum the two figures must not contradict each other.

**BTL-B42 — the shortfall is projected at a rate pooled across every base grade.** His 5.77 a month
is earned almost entirely on V2s. The three sends he is short are two **V4s** — a grade he has never
touched — and one V3. Dividing one by the other, the card says:

> *Base full in about 2 weeks, then about 17 weeks to move up a grade.*

**Two weeks to send two V4s, from a log whose best boulder ever is V3.** The pyramid counts sends,
not difficulty, so 2 V4s and 8 V2s are 2 units and 8 units and the V4s look like the small errand
left over — when in fact they are the entire climb. `nextUp`'s *"Log 2 more V4s to fill the base"*
reads as a chore and is really the whole project.

**The machinery to fix it already exists.** BTL-B33 gave an *Own* goal's target row a per-grade
rate — the rate this athlete sends *that* grade, falling back to the base rate when they never have,
with `own.source` saying which. The base shortfall never got the same treatment. Applying it here
would make a grade you have never sent project at a stated fallback and say so, instead of silently
inheriting your warm-up pace.

**What is *not* wrong**, and worth writing down so it does not get relitigated: `Base complete` never
claims the target has been sent (`sentTarget` is separate, and the label only reads *Pyramid
complete* when both hold), and the forecast still charges 17 weeks of conversion after the base
fills. The model is not saying "2 V4s and you have V5". It is saying "2 V4s and you have the base to
work V5", which is the literature's own claim. B41 and B42 are about the sentences around it.

Both are ordinary bugs rather than decisions — neither changes the pyramid, only the date and the
rate — but both move every grade goal's forecast, so they wait for Ben's word like BTL-B30 did.

**Ben parked both, 2026-09-16:** *"The internet seems to agree with the 2:1 thing as we have though
so not all bad. I guess it's fine for now. Achievability is our own thing we can see how it goes."*
Left Blocked on him rather than closed — the arithmetic is still wrong in the two ways above, and the
reproduction is here for whenever the forecast next looks off. **The 2:1 shape is not in question**
and never was; B41 and B42 are only about the sentences under the pyramid. Worth knowing that
achievability is the half with no external reference to check against — the pyramid can be compared
with Hörst, the forecast can only be compared with what actually happens to Ben, so it is the part
that needs watching in use rather than arguing about in advance.

### After BTL-B28 — one thing the fix cannot undo

Cardio goal readings are now normalised to km (fixed 2026-09-12). **A goal that auto-achieved on the
old reading stays achieved**: `useGoals.js:30` is `if (g.achieved) return g`, so achievement is
stamped once and never re-evaluated — which is what stops corrections un-ticking real history, and
here means a swim goal that ticked off because 1500 m read as 1500 km is still marked done. Nothing
recalculates it. Delete and recreate that goal if it matters; there is no bulk fix worth writing for
what is at most a couple of rows.

### BTL-B27 — the repo rename, if it ever comes up

Not important, filed so it stops costing a wrong turn at the start of sessions that don't know.
**Everything except the repo name already says BetaLog**: the Pages project is `betalog`, the domain
is betalog.co.uk, Firebase is `betalog-340b3`, the app is `betalog-react/`, the trigram is `BTL`.

Cheap: no GitHub Actions in this repo, GitHub redirects old clone URLs, and Cloudflare's GitHub App
tracks the repo by ID so Pages survives. Four live references to update — the root
`.claude/launch.json`, `Benjuicey-apps/docs/trigrams.md`, `BristolStorm/CLAUDE.md`, and
`docs/guides/betalog_deployment.md`; the four in `logs/` are history, leave them.

**Do all of it or none.** `Publicdisaster` is a half-finished rename — product *Not a Disaster*, repo
`notadisaster`, Pages project `publicdisaster`, folder `Publicdisaster` — which is worse than never
having started (PUB-B11). Rename the GitHub repo, `git remote set-url`, and the local folder in one
go, with sessions and editors closed so OneDrive isn't renaming under a live working directory.

---

## Recently closed

| ID | Item | Closed |
|---|---|---|
| BTL-B40 | Analysis came back empty at v28 — gpt-oss spent the 1,400 budget reasoning. `reasoning_effort: 'low'` on every call, and an empty answer is asked for once more at 2,800 | 2026-09-13 |
| BTL-B39 | Coach page rate limits: waits out Groq's stated retry and sends again, counts down on the button, quotes Groq's own numbers, keeps one analysis per persona; Settings key test no longer names the retired llama model | 2026-09-13 |
| BTL-B38 | Both pyramids in the one blue, grade labels in their level colour, bar charts left orange | 2026-09-13 (branch) |
| BTL-B36 | Editing a climb session uses the logging form — discipline buttons, grade chips, the four outcome buttons — not a separate three-dropdown sheet | 2026-09-13 (branch) |
| BTL-B35 | Achieved goals can be removed from History, and the Achieved card's delete shows its confirm step | 2026-09-13 (branch) |
| BTL-B19 | The explainer — `betalog.co.uk/pyramid.html`: grades, levels, Base/Best/Flash, the pyramid, goals, the dots, the forecast, sources. Linked from the climbing widget and the goal card | 2026-09-13 (branch) |
| — | Level badge on the climbing widget, from the base; goal picker grouped by level band | 2026-09-13 (branch) |
| BTL-B33 | An *Own* goal's forecast projects the target row too — "Own 6c around June", "then 7 more 6c sends at your 6c rate" | 2026-09-13 (branch) |
| — | The dots read the deadline margin alone — a year in hand reads 5/5 on a forming base, not 3/5 | 2026-09-13 (branch) |
| — | One active goal per type — the sheet crosses out a type that already has one | 2026-09-13 (branch) |
| BTL-B34 | One vocabulary — *Base / Best / Flash*, goals are *Send X* / *Own X*; *Consistent* and *Project* (as a reading) retired from every screen | 2026-09-13 (branch) |
| BTL-B8 | Q3 answered — friends see Base, level word from the base | 2026-09-13 |
| BTL-B7 | Public profile publishes `base` via `buildPublicProfileWithBase`; older keys kept for older builds | 2026-09-13 (branch) |
| — | Send goals count any send in the pyramid window, and `achievedBy` records the send / base / value that did it | 2026-09-13 (branch) |
| — | The goal sheet refuses a send goal the log has already met, and says why; *become* stays open on a single send | 2026-09-13 (branch) |
| — | A sent target charges no grade-change time — Ben's 6a read 2/5 on a complete base | 2026-09-13 (branch) |
| — | Achieved goals appear in History on the day of the evidence | 2026-09-13 (branch) |
| — | Dashboard climbing cards draw the pyramid for the next rung up when no goal is set | 2026-09-13 (branch) |
| — | Readiness label takes the dots' colour; the Dashboard's last 90-day send count reads the pyramid window; auto-achieve re-runs when goals change | 2026-09-13 (branch) |
| — | Goal sheet dots match the goal card and Dashboard — one `readGradeGoal` call for all three | 2026-09-13 |
| BTL-B6 | Q2 answered — grade goals are *send* (default) or *become*, and tick off by kind | 2026-09-13 |
| BTL-B18 | Two windows — gone: auto-achieve's 90-day reading was deleted with B6 | 2026-09-13 |
| — | Fill rate measured from the first climb in the window, not the whole 180 days | 2026-09-13 |
| — | Forecast says "Ready for 6c around …" and splits the date into base + grade change | 2026-09-13 |
| BTL-B30 | Per-session send cap removed — every logged send counts | 2026-09-13 |
| — | Dashboard climbing card shows the projected date and deadline margin | 2026-09-13 |
| BTL-B4 | Grade goals drop the % bar — the pyramid is the progress display | 2026-09-13 |
| BTL-B25 | Docs drift swept, and folded into the merge checklist | 2026-09-13 |
| BTL-B24 | Climbs CSV export, one row per climb | 2026-09-13 |
| BTL-B14 | Build, cache and version shown in Settings | 2026-09-13 |
| BTL-B10 | Gym sessions score by exercise count, not a flat 2 | 2026-09-13 |
| BTL-B5 | Phase 3 — projected ready date and deadline margin | 2026-09-12 |
| BTL-B3 | Cardio calories — duration optional, distance-based model added | 2026-09-12 |
| BTL-B28 | Cardio goals normalise miles/lengths/metres to km | 2026-09-12 |
| BTL-B2 | New goal card checked signed in — reads correctly | 2026-09-12 |
| BTL-B1 | Push Worker deploy — confirmed it went out; reminders were never dead | 2026-09-12 |
| BTL-B0 | Reconcile "Currently" — it is the base grade now (spec Q1) | 2026-09-12 |
| — | Grade pyramid phases 1 and 2 | 2026-09-12 |
| — | Weekly Shameometer dial + sealed week log | 2026-09-10 |
| — | `friendCodes` rule narrowed to `allow get` and deployed | 2026-09-04 |
| — | Route B web push — live and verified on a real iPhone | 2026-09-04 |
| — | Several reminder times per routine, Worker included | 2026-09-04 |
| — | IA declutter, all four phases | 2026-08-20 |
| — | Dashboard widget system, phases A–F | 2026-08-21 |
