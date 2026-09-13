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
| BTL-B7 | Public profile publishes `base` (spec Q3) | Feature | Session | Blocked | BTL-B8 |
| BTL-B8 | Q3 — should friends see Base instead of the consistent grade? | Decision | **Ben** | Ready | — |
| BTL-B9 | `attempts` never increments — probably not a bug, see note | Decision | **Ben** | Ready | — |
| BTL-B11 | Q4 — route identity per climb; **more relevant since the cap went** | Decision | **Ben** | Ready | — |
| BTL-B12 | Re-date the two stale goals — 7a and V5 are both unreachable | Chore | **Ben** | Ready | — |
| BTL-B13 | Prune the schedule — Sub-Max Repeaters is 7 days/wk with 2 reminders | Chore | **Ben** | Ready | — |
| BTL-B15 | Feedback widget round-trip — never actually submitted to Firestore | Check | **Ben** | Ready | — |
| BTL-B16 | Branch cleanup — 29 of 36 remote branches are merged | Chore | **Ben** | Ready | — |
| BTL-B17 | `step9-wip` — keep or drop? 158 commits behind `main` | Decision | **Ben** | Ready | — |
| BTL-B19 | User-facing pyramid explainer | Feature | Session | Blocked | `betalog.co.uk/help` existing |
| BTL-B20 | Dashboard widget consistency — 6 phases, spec written, not started | Feature | Session | Blocked | 3 decisions in the spec |
| BTL-B21 | AI coach output review — diet review + mini plan | Feature | Session | Blocked | scope decision |
| BTL-B22 | Admin page | Feature | Session | Blocked | spec TBD |
| BTL-B23 | Calorie balance view — cardio burn vs drink intake | Feature | Session | Blocked | scope decision |
| BTL-B26 | `/privacy` page — **copy is wrong in four places**, do not publish as written | Feature | Session | Blocked | BTL-B31 |
| BTL-B31 | Reconcile the privacy copy with what the app actually does | Decision | **Ben** | Ready | — |
| BTL-B32 | No way to delete your account or data — the policy assumes there is | Feature | Session | Ready | — |
| BTL-B33 | A *become* goal's forecast still projects readiness to send the target, not to own it | Feature | Session | Ready | — |
| BTL-B27 | Rename the repo `HomeTrainingMcTrainingface` → `betalog` (low priority) | Chore | **Ben** | Ready | — |
| BTL-B29 | Cardio goals read an all-time PB — the career-high pattern grades just dropped | Decision | **Ben** | Ready | — |

### The current project

**Finish the grade pyramid.** Ben, 2026-09-12: *"this is the next thing I want to build completely."*
Build order and full reasoning in `docs/specs/betalog_grade_pyramid_spec.md` §9a and §9b.

Steps 1–3 shipped: *Currently* (2026-09-12), the forecast (BTL-B5, 2026-09-12) and the two goal kinds
(BTL-B6, 2026-09-13). Left: **BTL-B8** → **BTL-B7**, then **BTL-B19**, plus **BTL-B33**.

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

## Recently closed

| ID | Item | Closed |
|---|---|---|
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
