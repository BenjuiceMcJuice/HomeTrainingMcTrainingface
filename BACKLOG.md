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
| BTL-B31 | Reconcile the privacy copy with what the app actually does — **and now list what friends see** (2026-09-18: the pyramid, per-grade attempts/sends/flashes, 30-day counts, the last climb date and an all-time best joined the profile) | Decision | **Ben** | Ready | — |
| BTL-B45 | Friends screen on a phone — both boards, the row copy, and the detail card; a friend who has not synced reads *not shared yet* on the 30-day board and under the card | Check | **Ben** | Ready | — |
| BTL-B32 | No way to delete your account or data — the policy assumes there is | Feature | Session | Ready | — |
| BTL-B27 | Rename the repo `HomeTrainingMcTrainingface` → `betalog` (low priority) | Chore | **Ben** | Ready | — |
| BTL-B29 | Cardio goals read an all-time PB — the career-high pattern grades just dropped | Decision | **Ben** | Ready | — |
| BTL-B37 | If the removed 6b+ goal comes back after a reload, it is sync: on load the cloud copy replaces local whenever `users/{uid}.updatedAt` is newer than the *profile's* `updatedAt`, which is nearly always, so a delete whose write failed is undone silently | Check | **Ben** | Ready | — |
| BTL-B46 | Venue chips on a phone — first tap of the pin prompts, chips appear, a saved venue is offered on the next open without a tap; check on the preview deploy | Check | **Ben** | Ready | — |
| BTL-B51 | Own goal pyramid on a phone — *Own 6c* on Plan › Goals, the New Goal sheet (tap Send ↔ Own and the counts should switch 4/4 · 2/2 · 1/1 ↔ 5/8 · 2/8 · 1/8) and the Dashboard rope widget; *owned* on the 6a+ row; *Pyramid complete* on both kinds, *Ready · Pyramid part-built* under the grade picker, no *base* anywhere but the header; check on the live site | Check | **Ben** | Ready | — |
| BTL-B47 | Level colours on a phone — the logger's grade chips by band with the level word under the picked one, the *V4 · Advanced* pill on climb cards in History, the band words on the detail sheet; check on the live site | Check | **Ben** | Ready | — |
| BTL-B55 | Complete! card on a phone — *Rope Grade · Send 6c* in its slot on Plan › Goals with no Achieved list under it; *Set your next goal* opens the sheet on Rope at 6c+; setting it removes the card; the green row in History still deletes; check on the live site | Check | **Ben** | Ready | — |
| BTL-B54 | Automatic release pickup on a phone — after this lands, Dave's card should fill in on its own once his app is next opened or brought to the front; then, on your own phone, a later release should reach an installed app on its first launch, not its second. Watch for a reload cutting a hangboard timer | Check | **Ben** | Ready | — |
| BTL-B49 | The *Own* forecast still jumps at the second send — one 6c reads the base rate (mid-October), two 6c over the same span read the 6c rate (mid-March 2027). A grade's own rate is always slower than the rows below it, so the first measured reading will land later than the assumption it replaces. Options: blend the two rates by sample size, measure the target rate from the first send *at that grade* rather than the first climb in the window, or accept the step and let the steps line explain it | Decision | **Ben** | Ready | — |

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

### BTL-B9 and BTL-B30 — Ben's logging model, and what it costs the cap

Ben, 2026-09-12: *"I will only likely log each climb I do. So for example if I do the same V4 twice
I'd log it twice. Repeating a grade / climb still counts imho. If I log it it should count. And
realistically people won't log the same V4 loads and then expect to try a V5."*

**That probably closes BTL-B9 rather than fixing it.** `attempts: 1` on all 54 climbs was filed as a
defect because 7 rows marked `sent` and 3 marked `attempt` all carried the same count. Under
one-row-per-climb that is not a contradiction: each row *is* one attempt, and the field is
degenerate rather than broken. The real question is whether `attempts` should exist at all, or
whether projecting is better read from several rows at one grade with no send among them — which the
pyramid already sees. **Decide before building anything on it.**

**BTL-B30 is the sharper one, because it contradicts a shipped decision.**
`MAX_SENDS_PER_SESSION = 2` (spec decision 1) credits at most two sends per grade per session. It
exists as the cheap stand-in for route identity — eight laps on one soft V3 is not a base — and Q4
(BTL-B11) asks whether to replace it with real route identity. Ben's position cuts underneath both:
if the athlete logged ten V4s, the cap throws away eight things they deliberately recorded, and his
argument is that the failure mode it guards against does not happen in practice.

**It is load-bearing in three places**, so this is not a one-line change: the base itself, the
readiness shortfall, and — since 2026-09-12 — the phase 3 **fill rate**, which counts credited sends
precisely so that the sends filling the base are counted like the sends that are the base. Raising or
removing the cap moves every pyramid, every readiness score and every projected date at once. Worth
measuring against the real export before changing, since the whole model has been wrong twice
already and both times a real log caught it.

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

### BTL-B41 / BTL-B42 — the climb location from where the phone is

Ben, 2026-09-17: *"in the logging part where you choose a location can we add to the background a
GPS / location based selection of places for the climbing location maybe rather than free text?"*

**Decided 2026-09-18 — a saved-venues list the app grows itself**, over OpenStreetMap or Google
Places: free, no third party, the coordinates never leave the athlete's own data, and after one
visit to each wall every session there is a tap. Built the same day (`lib/venues.js`,
`hooks/useVenues.js`, `hooks/useGeolocation.js`, `components/log/VenuePicker.jsx`). An OSM lookup
for the first visit to a new wall slots in behind the same chips if typing it ever grates; nothing
built for the list would change. Location permission is asked only from the pin, on the Log page,
and the privacy copy carries a drafted paragraph for it — Ben's to settle under BTL-B31.

## Recently closed

| ID | Item | Closed |
|---|---|---|
| — | Settings sheet could not be closed on a phone — the panel had no height cap, so once the AI Coach key, Beep timing, build line and Admin panel rows made it taller than the screen it overflowed off the top, taking the X with it; the page underneath scrolled, the sheet did not. Capped at 85vh and scrolls inside itself, as the friends sheet already did | 2026-09-19 |
| — | An achieved goal keeps its slot on Plan › Goals as a *Complete!* card with *Set your next goal*, one rung up; the Achieved list is gone; History's green row is the record and the only delete | 2026-09-18 |
| — | A release runs on its first launch, not its second: the page reloads once when a new service worker takes over, and an app returning to the foreground checks for one. A friend's republished profile no longer waits on a second launch | 2026-09-18 |
| BTL-B41 | Climb venue from where the phone is — the logger's location field offers saved venues within 300 m as chips, prefills the one in range, and remembers where each session was saved | 2026-09-18 |
| BTL-B42 | Where venues come from — a saved list the app grows itself; OSM or Places can sit behind it later | 2026-09-18 |
| — | Friends see the pyramid, and two boards: **Level** (Base then Best, 180 days) and **Last 30 days** (hardest send then sends — the one that moves after every session). Every number on the friends screen names its window; each row says when they last climbed. The profile carries the readiness tiers for the next rung up, per-grade counts, the 30-day counts, the last climb date and an all-time best. The All Time / Last 90 Days toggle is gone — *All Time* showed the 180-day overlay and *Last 90 Days* the retired consistent grade. Live while open; republished once after update | 2026-09-18 |
| BTL-B53 | *"The wording base complete is confusing."* One word meant two things on one card: **Base 6a+** in the header is the grade you own, *Base complete* under it was the rows beneath the target. *Base* now means the owned grade only. Labels: *Pyramid complete · Ready for 6c · Nearly ready · Pyramid forming · Pyramid thin · No pyramid yet*; *Pyramid for 6c* eyebrow; *fill the pyramid*; picker legend *Ready · Pyramid part-built* with the ring dropped. The label describes the picture for either kind. Cut: *1 send at 6c already* and *Nothing logged at 6c yet* (the row says it); tries without a send stay | 2026-09-18 |
| BTL-B52 | Ben on BTL-B50 as shipped: *"I don't like it … the pyramid should stay the pyramid."* The eight-wide target row is gone; an *Own* goal keeps the 1·2·4·8 pyramid and the count beside each row is that grade's sends out of eight — *owned*, 5/8, 2/8, 1/8 — so owning reads as climbing the rows. Send goals unchanged | 2026-09-18 |
| BTL-B50 | An *Own* goal's pyramid drew the send pyramid — 6c 1/1 in green above "7 more 6c sends". The target row is now drawn against eight (1/8) on the card, the sheet and the Dashboard, labelled *Base complete* until full; a row with eight sends at its own grade reads **owned** in a deeper blue on every pyramid, friends' included | 2026-09-18 |
| BTL-B48 | Ben's first 6c pushed *Own 6c* from mid-December to October **2027** and one dot — one send over the 58 days since his first climb read as the 6c rate. The target row's rate now needs two sends; before that the base rate stands in, as it did at none. The forecast names the year when it is not this year, and says *now* rather than *around mid-September* when nothing is left | 2026-09-18 |
| BTL-B44 | Bottom tabs drifted up the page on iOS — a `position:fixed` bar with `backdrop-filter` is painted at a stale scroll position after the document height changes under it (widget collapse, sheet close, keyboard). Blur dropped, solid white, own compositing layer | 2026-09-18 |
| BTL-B43 | Hangboard grip diagram redrawn — the back of the hand for which fingers (unused ones fold to the knuckle), the hand from the thumb side for the grip, drawn to Ben's photos; 300×140 above the countdown | 2026-09-17 |
| — | Hangboard beeps land on the number — each cue is booked on the audio clock ahead of its second, led by the reported latency plus Settings › Beep timing (Bluetooth preset 180 ms) | 2026-09-17 |
| — | Hangboard timer keeps the screen awake — Screen Wake Lock while a set runs, re-taken when the app comes back to the front, released on done or close | 2026-09-17 |
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
